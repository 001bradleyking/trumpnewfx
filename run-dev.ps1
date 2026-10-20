$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runtime = Join-Path $root '.runtime'
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$phpIni = Join-Path $root 'project.php.ini'

if (-not (Test-Path $phpIni)) { throw 'project.php.ini is missing; install the required PHP extensions first.' }
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$php = (Get-Command php -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source
$vite = Join-Path $frontend 'node_modules/vite/bin/vite.js'
if (-not (Test-Path $vite)) { throw 'React dependencies are not installed. Run npm install in frontend first.' }
$env:PHPRC = $phpIni

$backendProcess = Start-Process -FilePath $php -ArgumentList @('-c', $phpIni, '-S', '127.0.0.1:8000', '-t', 'public', 'router.php') -WorkingDirectory $backend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'backend.log') -RedirectStandardError (Join-Path $runtime 'backend-error.log')
$frontendProcess = Start-Process -FilePath $node -ArgumentList @($vite, '--host', '127.0.0.1') -WorkingDirectory $frontend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'frontend.log') -RedirectStandardError (Join-Path $runtime 'frontend-error.log')
@{ backend = $backendProcess.Id; frontend = $frontendProcess.Id } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtime 'pids.json')

Write-Host 'NEWS FX démarre en local.'
Write-Host 'Interface : http://127.0.0.1:5173'
Write-Host 'API Laravel : http://127.0.0.1:8000/api/status'
Write-Host "Journaux : $runtime"
