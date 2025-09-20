@echo off
title POS System - Test
color 0A
echo.
echo ========================================
echo    POS SYSTEM - SYSTEM TEST
echo ========================================
echo.
echo Testing system components...
echo.

REM Test Node.js
echo Testing Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found - Please install Node.js first
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo ✓ Node.js is installed
)

REM Test dependencies
echo Testing dependencies...
if not exist "node_modules" (
    echo ❌ Dependencies not installed - Run installation first
    pause
    exit /b 1
) else (
    echo ✓ Dependencies installed
)

REM Test main files
echo Testing main files...
if not exist "pos-system.js" (
    echo ❌ Main server file missing
    pause
    exit /b 1
) else (
    echo ✓ Main server file found
)

if not exist "frontend\index.html" (
    echo ❌ Frontend files missing
    pause
    exit /b 1
) else (
    echo ✓ Frontend files found
)

REM Test server startup
echo Testing server startup...
echo Starting server for 5 seconds...
start /B node pos-system.js
timeout /t 3 /nobreak >nul

REM Test if server is running
curl -s http://localhost:8080/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Server is running and responding
) else (
    echo ❌ Server not responding
)

REM Stop server
taskkill /F /IM node.exe >nul 2>&1

echo.
echo ========================================
echo    TEST COMPLETE
echo ========================================
echo.
echo If all tests passed, your system is ready!
echo Run INSTALL-AND-START.bat to begin.
echo.
pause
