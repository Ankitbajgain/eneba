param([string]$Origin = 'http://localhost:8080')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
Add-Type -AssemblyName System.Net.Http
$email = 'auth-smoke-' + [guid]::NewGuid().ToString('N') + '@example.test'
$password = [guid]::NewGuid().ToString('N') + '!demo'
$origin = $Origin.TrimEnd('/')
$jar = [System.Net.CookieContainer]::new()
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.CookieContainer = $jar
$client = [System.Net.Http.HttpClient]::new($handler)
$client.DefaultRequestHeaders.Add('Accept', 'application/json')
$client.DefaultRequestHeaders.Add('Origin', $origin)
$client.DefaultRequestHeaders.Referrer = [Uri]"$origin/"
$client.DefaultRequestHeaders.Add('Sec-Fetch-Site', 'same-origin')

function Send-Request($Method, $Path, $Body, $Status, [bool]$Csrf = $true) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$origin$Path")
    if ($Method -eq 'POST') {
        $request.Content = [System.Net.Http.StringContent]::new(($Body | ConvertTo-Json -Compress), [Text.Encoding]::UTF8, 'application/json')
        if ($Csrf) {
            $cookie = $jar.GetCookies([Uri]$origin)['XSRF-TOKEN']
            if ($null -eq $cookie) { throw 'CSRF bootstrap did not set a token.' }
            $request.Headers.Add('X-XSRF-TOKEN', [Uri]::UnescapeDataString($cookie.Value))
        }
    }
    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        try {
            $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if ([int]$response.StatusCode -ne $Status) { throw "$Path expected $Status, received $([int]$response.StatusCode)." }
            if ($text) { return ($text | ConvertFrom-Json) }
        } finally { $response.Dispose() }
    } finally { $request.Dispose() }
}

try {
    Send-Request GET /api/v1/auth/me $null 401 | Out-Null
    Send-Request GET /sanctum/csrf-cookie $null 204
    $session = $jar.GetCookies([Uri]$origin)['marketplace_session']
    if (-not $session.HttpOnly) { throw 'Session cookie is not HttpOnly.' }
    if ($jar.GetCookies([Uri]$origin)['XSRF-TOKEN'].HttpOnly) { throw 'CSRF cookie should be readable by the client.' }
    $initialSession = $session.Value
    $registration = @{ name = 'HTTP Smoke Player'; email = $email; password = $password; password_confirmation = $password }
    $failure = Send-Request POST /api/v1/auth/register $registration 419 $false
    if ($failure.code -ne 'csrf_mismatch') { throw 'Missing CSRF token was not rejected safely.' }
    $account = Send-Request POST /api/v1/auth/register $registration 201
    if ($account.data.email -ne $email -or $account.data.PSObject.Properties.Name -contains 'password') { throw 'Unsafe user response.' }
    if ($jar.GetCookies([Uri]$origin)['marketplace_session'].Value -eq $initialSession) { throw 'Registration did not rotate session.' }
    $mine = Send-Request GET /api/v1/auth/me $null 200
    if ($mine.data.id -ne $account.data.id) { throw 'Session did not persist.' }
    Send-Request POST /api/v1/auth/logout @{} 204
    Send-Request GET /api/v1/auth/me $null 401 | Out-Null
    Send-Request GET /sanctum/csrf-cookie $null 204
    $beforeLogin = $jar.GetCookies([Uri]$origin)['marketplace_session'].Value
    Send-Request POST /api/v1/auth/login @{ email = $email; password = 'wrong-password' } 401 | Out-Null
    Send-Request POST /api/v1/auth/login @{ email = $email; password = $password } 200 | Out-Null
    if ($jar.GetCookies([Uri]$origin)['marketplace_session'].Value -eq $beforeLogin) { throw 'Login did not rotate session.' }
    $savedSession = $jar.GetCookies([Uri]$origin)['marketplace_session'].Value
    Send-Request POST /api/v1/auth/logout @{} 204
    $jar.Add([Uri]$origin, [System.Net.Cookie]::new('marketplace_session', $savedSession, '/'))
    Send-Request GET /api/v1/auth/me $null 401 | Out-Null
    Send-Request GET /sanctum/csrf-cookie $null 204
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        Send-Request POST /api/v1/auth/login @{ email = $email; password = 'wrong-password' } 401 | Out-Null
    }
    $limited = Send-Request POST /api/v1/auth/login @{ email = $email; password = 'wrong-password' } 429
    if ($limited.code -ne 'too_many_requests') { throw 'Login rate limit did not persist across HTTP requests.' }
    Write-Output 'PASS: gateway CSRF, cookie flags, registration, persistent session, login, session rotation, logout, old-session replay rejection and persistent rate limiting.'
} finally {
    $client.Dispose()
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & docker compose exec -T -e "AUTH_SMOKE_EMAIL=$email" backend php tests/cleanup-smoke.php 2>&1 | ForEach-Object { $_.ToString() }
        if ($LASTEXITCODE -ne 0) { throw 'Smoke account cleanup failed.' }
    } finally { $ErrorActionPreference = $previousPreference; Pop-Location }
}
