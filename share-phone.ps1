$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$localUrl = 'http://127.0.0.1:5173'

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    throw "ngrok n'est pas installé. Installez-le avec : winget install --id Ngrok.Ngrok --exact"
}

$front = Invoke-WebRequest -UseBasicParsing -Uri $localUrl -TimeoutSec 3 -ErrorAction SilentlyContinue
$api = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/status' -TimeoutSec 3 -ErrorAction SilentlyContinue
if (-not $front -or -not $api) {
    Write-Host 'Démarrage du site et de son API...'
    & (Join-Path $root 'run-dev.ps1')
    Start-Sleep -Seconds 3
}

$configCheck = & ngrok config check 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "ngrok doit être lié à votre compte. Configurez le jeton avec : ngrok config add-authtoken VOTRE_JETON`nRécupérez-le dans votre tableau de bord ngrok."
}

$tunnel = Start-Process -FilePath (Get-Command ngrok).Source -ArgumentList @('http', '5173') -WindowStyle Hidden -PassThru
Write-Host 'Ouverture du tunnel ngrok...'
$publicUrl = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
        $publicUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url
        if ($publicUrl) { break }
    } catch { }
    if ($tunnel.HasExited) { throw "ngrok s'est arrêté. Vérifiez votre jeton ou consultez le tableau de bord ngrok." }
}

if (-not $publicUrl) { throw 'ngrok ne fournit pas encore de lien. Vérifiez votre connexion et votre compte.' }
Write-Host ''
Write-Host "Lien à ouvrir sur le téléphone : $publicUrl" -ForegroundColor Green
Write-Host 'Le lien reste actif tant que cette fenêtre et ngrok fonctionnent.'
Write-Host 'Pour arrêter le tunnel : Ctrl+C dans cette fenêtre, puis Stop-Process -Id ' $tunnel.Id
Write-Host 'Le serveur local reste disponible sur http://127.0.0.1:5173'
try { Wait-Process -Id $tunnel.Id } finally {
    if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force }
}
