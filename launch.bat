@echo off
title Good Weekend Quiz Master Launcher
echo Launching Good Weekend Quiz Master...
cd /d C:\dev\know-it-all

:: Kill any existing node process listening on port 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

:: Build and launch fresh preview server
echo Building latest 999-question bundle...
call npm run build

echo Starting server...
start /b npx vite preview --port 5173 --host
powershell -Command "Start-Sleep -Seconds 2"
start http://localhost:5173/
