# dev-start.ps1 — starts cloudflared tunnel, updates URLs, then launches shopify app dev
# Run from repo root: .\dev-start.ps1

$ErrorActionPreference = "Stop"

$cloudflaredExe = "C:\Users\euryy\AppData\Local\cloudflared\cloudflared.exe"
if (-not (Test-Path $cloudflaredExe)) {
    Write-Host "ERROR: cloudflared not found at $cloudflaredExe" -ForegroundColor Red
    exit 1
}

Write-Host "Starting cloudflared tunnel..." -ForegroundColor Cyan

# Start cloudflared in background, capture stderr (that's where the URL appears)
$tempLog = "$env:TEMP\cloudflared_tunnel.log"
if (Test-Path $tempLog) { Remove-Item $tempLog -Force }
$proc = Start-Process `
    -FilePath $cloudflaredExe `
    -ArgumentList "tunnel", "--url", "http://localhost:3000" `
    -RedirectStandardError $tempLog `
    -PassThru `
    -WindowStyle Hidden

Write-Host "Waiting for tunnel URL (up to 15s)..."
$url = $null
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $tempLog) {
        $content = Get-Content $tempLog -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            $url = $Matches[0]
            break
        }
    }
}

if (-not $url) {
    Write-Host "ERROR: Could not detect tunnel URL. Check cloudflared is installed." -ForegroundColor Red
    $proc | Stop-Process -Force
    exit 1
}

Write-Host "Tunnel URL: $url" -ForegroundColor Green

# Helper: write file as UTF-8 without BOM (PowerShell 5.1 Set-Content adds BOM)
function Write-Utf8NoBom([string]$path, [string]$content) {
    $enc = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($path, $content, $enc)
}

# Update .env
$envPath = Join-Path $PSScriptRoot ".env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'SHOPIFY_APP_URL=https://[^\r\n]+', "SHOPIFY_APP_URL=$url"
Write-Utf8NoBom $envPath $envContent

# Update shopify.app.toml — only replace trycloudflare URLs, leave revremind.com intact
$tomlPath = Join-Path $PSScriptRoot "shopify.app.toml"
$tomlContent = Get-Content $tomlPath -Raw
$tomlContent = $tomlContent -replace 'application_url = "https://[^"]+"', "application_url = `"$url`""
$tomlContent = $tomlContent -replace '"https://[a-z0-9-]+\.trycloudflare\.com/auth/callback"', "`"$url/auth/callback`""
Write-Utf8NoBom $tomlPath $tomlContent

Write-Host ".env and shopify.app.toml updated." -ForegroundColor Green
Write-Host ""
Write-Host "Starting shopify app dev..." -ForegroundColor Cyan
Write-Host "(Press Ctrl+C to stop everything)"
Write-Host ""

try {
    npx shopify app dev
} finally {
    Write-Host "Stopping cloudflared tunnel..."
    $proc | Stop-Process -Force -ErrorAction SilentlyContinue
}
