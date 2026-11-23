param(
    [Parameter(Mandatory = $true)][string]$AppUrl,
    [string]$EnvFile = '.env.production',
    [string]$ProjectName = 'eneba-production',
    [switch]$AllowLocalHttp
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $EnvFile) { throw 'The environment file already exists. Preserve its secrets across releases.' }
$uri = [Uri]$AppUrl
if (-not $uri.IsAbsoluteUri -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.UserInfo) { throw 'Supply an absolute origin without a path, credentials, query or fragment.' }
$localHttp = $AllowLocalHttp -and $uri.Scheme -eq 'http' -and $uri.IsLoopback
if ($uri.Scheme -ne 'https' -and -not $localHttp) { throw 'Public deployments require HTTPS. Local checks can use -AllowLocalHttp.' }
if ($ProjectName -notmatch '^[a-z0-9][a-z0-9_-]*$') { throw 'Use a lowercase Compose project name.' }
function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
$content = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../.env.production.example'))
$values = @{
    COMPOSE_PROJECT_NAME = $ProjectName
    APP_URL = $uri.GetLeftPart([UriPartial]::Authority)
    APP_KEY = 'base64:' + (New-Secret)
    KEY_FINGERPRINT_SECRET = New-Secret
    POSTGRES_PASSWORD = New-Secret
    SESSION_SECURE_COOKIE = $(if ($localHttp) { 'false' } else { 'true' })
    SANCTUM_STATEFUL_DOMAINS = $uri.Authority
}
foreach ($entry in $values.GetEnumerator()) {
    $content = [Regex]::Replace($content, '(?m)^' + $entry.Key + '=.*$', $entry.Key + '=' + $entry.Value)
}
[IO.File]::WriteAllText((Join-Path (Get-Location) $EnvFile), $content, (New-Object Text.UTF8Encoding $false))
Write-Output "Created $EnvFile with independent secrets. Keep this file private and back it up securely."
