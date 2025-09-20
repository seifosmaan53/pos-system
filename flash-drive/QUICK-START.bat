@echo off
title POS System - Quick Start
color 0A
echo.
echo ========================================
echo    POS SYSTEM - QUICK START
echo ========================================
echo.
echo This is the ONE file you need to run!
echo It will install and start everything.
echo.
echo Press any key to begin...
pause >nul

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Node.js is not installed.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Create directories
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs

REM Start the system
echo.
echo Starting POS System...
echo Opening browser...
echo.
start http://localhost:8080
node pos-system.js
