@echo off
title Crownridge LLP - Safety Report Generator Launcher
cls
echo ==============================================================
echo   CROWNRIDGE LLP - AI SAFETY INCIDENT REPORT GENERATOR
echo   Setup and Launch Utility
echo ==============================================================
echo.
echo [1/3] Verifying Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found or not added to your system PATH.
    echo Please download and install Node.js from: https://nodejs.org/
    echo after installation, restart this console and run again.
    echo.
    pause
    exit /b 1
)
echo Node.js version detected:
for /f "tokens=*" %%i in ('node -v') do set node_ver=%%i
echo %node_ver% (Status: Active)
echo.

echo [2/3] Resolving backend package dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm dependencies. Please check your internet connection.
    echo.
    pause
    exit /b 1
)
echo Dependencies installed successfully.
echo.

echo [3/3] Booting local safety server desk...
echo Base Endpoint: http://localhost:5000
echo.
echo Press Ctrl+C in this window to stop the server.
echo.
call npm start
pause
