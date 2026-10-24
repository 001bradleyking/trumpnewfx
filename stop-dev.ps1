$ErrorActionPreference = 'SilentlyContinue'
$pidFile = Join-Path $PSScriptRoot '.runtime/pids.json'
if (-not (Test-Path $pidFile)) { Write-Host 'Aucun serveur NEWS FX enregistré.'; exit 0 }
$servers = Get-Content $pidFile -Raw | ConvertFrom-Json
$serverTargets = @(
    @{ Id = $servers.backend; Name = 'php.exe'; Argument = '-S 127.0.0.1:8000' },
    @{ Id = $servers.frontend; Name = 'node.exe'; Argument = (Join-Path $PSScriptRoot 'frontend/node_modules/vite/bin/vite.js') }
)

foreach ($target in $serverTargets) {
    if (-not $target.Id) { continue }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$target.Id)"
    if (-not $process) { continue }

    if ($process.Name -ne $target.Name -or $process.CommandLine -notlike "*$($target.Argument)*") {
        Write-Warning "Le PID $($target.Id) ne correspond pas au serveur NEWS FX attendu ; aucun arrêt n’a été effectué."
        continue
    }

    Stop-Process -Id ([int]$target.Id) -Force
}
Remove-Item -LiteralPath $pidFile -Force
Write-Host 'Les serveurs NEWS FX ont été arrêtés.'
