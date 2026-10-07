Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting AlgoTrading Workbench..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Ensure dotnet is in the PATH
$env:PATH = "$env:LOCALAPPDATA\dotnet;$env:PATH"

# Start Backend
Write-Host "[1/2] Starting backend (http://localhost:5000)..." -ForegroundColor Yellow
$backendProcess = Start-Process -NoNewWindow -PassThru -FilePath "dotnet.exe" -ArgumentList "run" -WorkingDirectory ".\backend"

# Wait a few seconds for backend to boot
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[2/2] Starting frontend (http://localhost:5173)..." -ForegroundColor Yellow
# Bypassing npm.cmd to directly run vite with node, which prevents errors with the '&' symbol in your folder path
$frontendProcess = Start-Process -NoNewWindow -PassThru -FilePath "node.exe" -ArgumentList "node_modules\vite\bin\vite.js" -WorkingDirectory ".\frontend"

Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Both services are now running!" -ForegroundColor Green
Write-Host "Press any key to stop everything and exit." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Wait for user input to stop
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`nStopping services..." -ForegroundColor Red
if ($backendProcess) { Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue }
if ($frontendProcess) { Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue }
Write-Host "Goodbye!" -ForegroundColor Cyan
