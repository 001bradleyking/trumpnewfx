$ErrorActionPreference = 'SilentlyContinue'
$pidFile = Join-Path $PSScriptRoot '.runtime/pids.json'
if (-not (Test-Path $pidFile)) { Write-Host 'Aucun serveur NEWS FX enregistré.'; exit 0 }
$servers = Get-Content $pidFile -Raw | ConvertFrom-Json
foreach ($processId in @($servers.backend, $servers.frontend)) {
    if ($processId) { Stop-Process -Id ([int]$processId) -Force }
}
Remove-Item -LiteralPath $pidFile -Force
Write-Host 'Les serveurs NEWS FX ont été arrêtés.'
