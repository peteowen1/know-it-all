@echo off
title Good Weekend Quiz Master Launcher
echo Launching Good Weekend Quiz Master...
cd /d C:\dev\gw-quiz-trainer

:: Check if port 5173 is running
netstat -ano | findstr :5173 > nul
if %errorlevel% equ 0 (
    echo Server is already running. Opening app...
    start http://localhost:5173/
) else (
    echo Starting server...
    start /b npm run dev
    timeout /t 3 > nul
    start http://localhost:5173/
)
