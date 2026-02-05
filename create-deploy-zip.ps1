# Create deployment ZIP for Codex Ticketing System
# Run from repo root: .\create-deploy-zip.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$deployDir = Join-Path $root "deploy"
$zipName = "Codex_Ticketing_System_deploy.zip"
$zipPath = Join-Path $root $zipName

Write-Host "Building API..." -ForegroundColor Cyan
Set-Location $root
& npm run build -w apps/api 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "API build failed." }

# Optional: build web if you want SPA in zip. Skip to avoid vite config issues; include web/dist only if it exists.
$webDistSrc = Join-Path $root "apps\web\dist"
if (-not (Test-Path $webDistSrc)) {
  Write-Host "Web dist not found (run 'npm run build -w apps/web' first to include SPA). Creating API-only zip." -ForegroundColor Yellow
}

Write-Host "Preparing deploy folder..." -ForegroundColor Cyan
if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force }
New-Item -ItemType Directory -Path $deployDir | Out-Null

# API (App Service root: dist, prisma, package.json)
Copy-Item -Path (Join-Path $root "apps\api\dist") -Destination (Join-Path $deployDir "dist") -Recurse
Copy-Item -Path (Join-Path $root "apps\api\prisma") -Destination (Join-Path $deployDir "prisma") -Recurse
Copy-Item -Path (Join-Path $root "apps\api\package.json") -Destination $deployDir
if (Test-Path (Join-Path $root "apps\api\package-lock.json")) {
  Copy-Item -Path (Join-Path $root "apps\api\package-lock.json") -Destination $deployDir -ErrorAction SilentlyContinue
}
Copy-Item -Path (Join-Path $root "apps\api\.env.example") -Destination (Join-Path $deployDir ".env.example") -ErrorAction SilentlyContinue

# Web app build (for static hosting). Include only if already built.
$webDist = Join-Path $root "apps\web\dist"
if (Test-Path $webDist) {
  New-Item -ItemType Directory -Path (Join-Path $deployDir "web") -Force | Out-Null
  Copy-Item -Path "$webDist\*" -Destination (Join-Path $deployDir "web") -Recurse
  Write-Host "Included web app in zip." -ForegroundColor Green
}

# Deploy instructions
$readme = @"
CODEX TICKETING SYSTEM - DEPLOY PACKAGE
========================================

API (Node.js)
-------------
This folder is the App Service root. On first deploy:

1. Set environment variables (see .env.example). Required: DATABASE_URL, DIRECT_URL, PORT, NODE_ENV, CORS_ORIGIN, WEB_APP_URL.
2. npm install
3. npx prisma generate
4. npx prisma migrate deploy   (or run migrations from your machine against production DB)
5. node dist/main

Startup command (e.g. Azure): node dist/main
Or with migrations: npx prisma generate && npx prisma migrate deploy && node dist/main

Web app (static)
----------------
The 'web' folder contains the built SPA. Host it on any static host (e.g. Azure Static Web Apps, CDN, or same server). Set VITE_API_BASE_URL to your API URL (e.g. https://your-api.azurewebsites.net/api).

Docs: see repo docs/azure-app-service-setup.md and docs/azure-env-settings.md
"@
Set-Content -Path (Join-Path $deployDir "README-DEPLOY.txt") -Value $readme -Encoding UTF8

Write-Host "Creating ZIP: $zipName" -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $deployDir "*") -DestinationPath $zipPath -Force

Remove-Item $deployDir -Recurse -Force
Write-Host "Done. Deployment package: $zipPath" -ForegroundColor Green
