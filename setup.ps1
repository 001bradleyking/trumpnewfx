$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$phpIni = Join-Path $root 'project.php.ini'
$exampleIni = Join-Path $root 'project.php.ini.example'
$composer = Join-Path $root 'composer.phar'

if (-not (Test-Path $phpIni)) {
    Copy-Item -LiteralPath $exampleIni -Destination $phpIni
    Write-Host 'project.php.ini créé. Si nécessaire, ajustez extension_dir à votre installation PHP.'
}

$php = (Get-Command php -ErrorAction Stop).Source
$env:PHPRC = $phpIni
if (-not (Test-Path $composer)) {
    Invoke-WebRequest -Uri 'https://getcomposer.org/download/latest-stable/composer.phar' -OutFile $composer
}

php -c $phpIni $composer install --working-dir=backend --no-interaction
if ($LASTEXITCODE -ne 0) { throw 'Composer: échec installation des dépendances Laravel.' }

$backend = Join-Path $root 'backend'
$envFile = Join-Path $backend '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item -LiteralPath (Join-Path $backend '.env.example') -Destination $envFile
    $localEnvironment = (Get-Content -LiteralPath $envFile -Raw).Replace('MAIL_MAILER=smtp', 'MAIL_MAILER=log')
    [System.IO.File]::WriteAllText($envFile, $localEnvironment, [System.Text.UTF8Encoding]::new($false))
}
$database = Join-Path $backend 'database/database.sqlite'
if (-not (Test-Path $database)) { New-Item -ItemType File -Path $database | Out-Null }
if ((Select-String -LiteralPath $envFile -Pattern '^APP_KEY=$' -Quiet)) {
    php -c $phpIni (Join-Path $backend 'artisan') key:generate --force
    if ($LASTEXITCODE -ne 0) { throw 'Laravel: échec de la création de la clé.' }
}
php -c $phpIni (Join-Path $backend 'artisan') migrate --force
if ($LASTEXITCODE -ne 0) { throw 'Les migrations de la base de données ont échoué.' }

npm ci --prefix frontend --registry=https://registry.npmmirror.com --fetch-retries=6 --fetch-timeout=120000
if ($LASTEXITCODE -ne 0) { throw 'npm: échec installation des dépendances React.' }

Write-Host 'Dépendances installées. Lancez .\run-dev.ps1 pour démarrer NEWS FX.'
