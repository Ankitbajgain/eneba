param([switch]$Build, [switch]$DatabaseOutage)
$ErrorActionPreference = 'Stop'

function Invoke-Docker {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & docker @args 2>&1 | ForEach-Object { $_.ToString() }
        $dockerExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($dockerExit -ne 0) { throw "Docker command failed: $($args -join ' ')" }
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker is required. Install/start Docker with Linux containers and Compose v2.'
    }
    if (-not (Test-Path -LiteralPath '.env')) {
        throw 'Copy .env.example to .env and configure local database passwords first.'
    }
    Invoke-Docker compose config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Compose configuration failed.' }

    if ($Build) {
        Invoke-Docker compose build --pull
        if ($LASTEXITCODE -ne 0) { throw 'Container image build failed.' }
    }
    Invoke-Docker compose up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'Services did not become healthy.' }

    Invoke-Docker compose exec -T nginx nginx -t
    if ($LASTEXITCODE -ne 0) { throw 'nginx configuration failed.' }
    $phpVersion = Invoke-Docker compose exec -T backend php -r 'echo PHP_VERSION;'
    if ($LASTEXITCODE -ne 0 -or $phpVersion -notmatch '^8\.3\.') {
        throw "Expected PHP 8.3; received $phpVersion"
    }
    $extensions = Invoke-Docker compose exec -T backend php -m
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect PHP extensions.' }
    foreach ($extension in @('pdo_mysql', 'mbstring', 'intl', 'zip', 'bcmath', 'Zend OPcache')) {
        if ($extensions -notcontains $extension) { throw "Required PHP extension missing: $extension" }
    }
    Invoke-Docker compose exec -T backend composer --version
    if ($LASTEXITCODE -ne 0) { throw 'Composer unavailable.' }
    Invoke-Docker compose exec -T frontend node --version
    if ($LASTEXITCODE -ne 0) { throw 'Node unavailable.' }

    # Resolve the published port without printing interpolated secrets.
    $binding = Invoke-Docker compose port nginx 80
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch '^127\.0\.0\.1:(\d+)$') {
        throw "Expected a loopback-only nginx binding; received $binding"
    }
    $port = [regex]::Match($binding, '\d+$').Value
    $origin = "http://localhost:$port"
    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.DefaultRequestHeaders.Add('Accept', 'text/html, application/json')
    $client.DefaultRequestHeaders.Add('Origin', $origin)
    $client.DefaultRequestHeaders.Referrer = [Uri]"$origin/"
    try {
        foreach ($case in @(
            @{ Path = '/healthz'; Status = 200 },
            @{ Path = '/'; Status = 200 },
            @{ Path = '/api/v1/health'; Status = 200 },
            @{ Path = '/api/v1/products'; Status = 200 },
            @{ Path = '/hidden.php'; Status = 404 },
            @{ Path = '/.env'; Status = 403 }
        )) {
            $response = $client.GetAsync("$origin$($case.Path)").GetAwaiter().GetResult()
            try {
                if ([int]$response.StatusCode -ne $case.Status) {
                    throw "$($case.Path): expected $($case.Status), received $([int]$response.StatusCode)"
                }
            } finally { $response.Dispose() }
        }
        if ($DatabaseOutage) {
            try {
                Invoke-Docker compose stop database
                $response = $client.GetAsync("$origin/api/v1/health").GetAwaiter().GetResult()
                try {
                    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
                    if ([int]$response.StatusCode -ne 503 -or $body.code -ne 'service_unavailable') {
                        throw 'Database outage did not produce the expected safe 503.'
                    }
                } finally { $response.Dispose() }
            } finally {
                Invoke-Docker compose up -d --wait database
            }
            $response = $client.GetAsync("$origin/api/v1/health").GetAwaiter().GetResult()
            try {
                if ([int]$response.StatusCode -ne 200) { throw 'Readiness did not recover after database restart.' }
            } finally { $response.Dispose() }
            Write-Output 'Database outage: safe 503 and recovery to 200 passed.'
        }
    } finally { $client.Dispose() }
    Write-Output 'Framework runtime checks passed. Services remain running; database data is preserved.'
} finally { Pop-Location }
