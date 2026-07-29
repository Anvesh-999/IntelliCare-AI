# IntelliCare AI PowerShell Launcher (No Docker & No Redis Required)

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting IntelliCare AI Microservices (Native)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Launching Express Backend (Port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"

Write-Host "[2/3] Launching FastAPI AI Service (Port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\ai_service'; python main.py"

Write-Host "[3/3] Launching Vite React Frontend (Port 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "All 3 services started in new windows!" -ForegroundColor Yellow
Write-Host "- Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "- Backend:   http://localhost:5000" -ForegroundColor Cyan
Write-Host "- AI Engine: http://localhost:8000" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
