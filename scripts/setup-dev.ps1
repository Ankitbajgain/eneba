$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)

function Invoke-Docker {
    $previousPreference = $ErrorActionPreference
    try {
        # Windows PowerShell can treat Docker's normal stderr progress as errors.
        $ErrorActionPreference = 'Continue'
        & docker @args 2>&1 | ForEach-Object { $_.ToString() }
        $dockerExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($dockerExit -ne 0) { throw "Docker command failed: $($args -join ' ')" }
}

try {
    if (-not (Test-Path -LiteralPath '.env')) {
        $settings = Get-Content -Raw -LiteralPath '.env.example'
        $settings = $settings.Replace('local-marketplace-change-me', [guid]::NewGuid().ToString('N'))
        [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $settings)
    }
    if (-not (Test-Path -LiteralPath 'backend/.env')) {
        Copy-Item -LiteralPath 'backend/.env.example' -Destination 'backend/.env'
    }
    if (-not (Test-Path -LiteralPath 'frontend/.env')) {
        Copy-Item -LiteralPath 'frontend/.env.example' -Destination 'frontend/.env'
    }

    Invoke-Docker compose config --quiet
    Invoke-Docker compose build backend frontend
    Invoke-Docker compose run --rm --no-deps composer install --no-interaction --prefer-dist
    Invoke-Docker compose up -d --wait database
    Invoke-Docker compose exec -T database sh /opt/marketplace/prepare-test-db.sh

    $backendSettings = Get-Content -Raw -LiteralPath 'backend/.env'
    if ($backendSettings -notmatch '(?m)^APP_KEY=.+$') {
        Invoke-Docker compose run --rm --no-deps backend php artisan key:generate --ansi
    }
    Invoke-Docker compose run --rm --no-deps backend php artisan config:clear
    Invoke-Docker compose run --rm --no-deps backend php artisan migrate --force
    Invoke-Docker compose run --rm --no-deps backend php artisan db:seed --force
    # Initialize/refresh the private dependency volume from the committed lockfile.
    Invoke-Docker compose run --rm --no-deps frontend npm ci
    Invoke-Docker compose up -d --wait
    Write-Output 'Gateway: http://localhost:8080; frontend: http://localhost:5173; API: http://localhost:8000/api/v1/health (defaults; ports are configured in root .env).'
} finally { Pop-Location }
