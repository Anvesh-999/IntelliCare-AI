@echo off
TITLE IntelliCare AI - Microservice Launcher
echo ===================================================
echo   Starting IntelliCare AI Microservices (No Docker)
echo ===================================================
echo.

echo [1/3] Starting Express Backend (Port 5000)...
start "IntelliCare Backend" cmd /k "cd backend && npm run dev"

echo [2/3] Starting FastAPI AI Service (Port 8000)...
start "IntelliCare AI Engine" cmd /k "cd ai_service && python main.py"

echo [3/3] Starting Vite React Frontend (Port 3000)...
start "IntelliCare Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo All microservices launched in separate windows!
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:5000
echo - AI Engine: http://localhost:8000
echo ===================================================
pause
