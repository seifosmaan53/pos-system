@echo off
title POS System - First Time Installation
color 0A
echo.
echo ========================================
echo    POS SYSTEM - FIRST TIME INSTALL
echo ========================================
echo.
echo This will install and configure your POS system.
echo Please wait while we set everything up...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js is installed
echo.

REM Install dependencies
echo Installing POS system dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo ✓ Dependencies installed successfully
echo.

REM Create necessary directories
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs

echo ✓ System directories created
echo.

REM Create startup script
echo Creating startup script...
echo @echo off > START-POS.bat
echo title POS System - Running >> START-POS.bat
echo color 0A >> START-POS.bat
echo echo. >> START-POS.bat
echo echo ======================================== >> START-POS.bat
echo echo    POS SYSTEM - STARTING UP >> START-POS.bat
echo echo ======================================== >> START-POS.bat
echo echo. >> START-POS.bat
echo echo Starting POS system... >> START-POS.bat
echo echo Open your browser to: http://localhost:8080 >> START-POS.bat
echo echo. >> START-POS.bat
echo echo Press Ctrl+C to stop the system >> START-POS.bat
echo echo. >> START-POS.bat
echo node pos-system.js >> START-POS.bat
echo pause >> START-POS.bat

echo ✓ Startup script created
echo.

REM Create desktop shortcut
echo Creating desktop shortcut...
echo [InternetShortcut] > "%USERPROFILE%\Desktop\POS System.url"
echo URL=http://localhost:8080 >> "%USERPROFILE%\Desktop\POS System.url"
echo IconFile= >> "%USERPROFILE%\Desktop\POS System.url"
echo IconIndex=0 >> "%USERPROFILE%\Desktop\POS System.url"

echo ✓ Desktop shortcut created
echo.

echo ========================================
echo    INSTALLATION COMPLETE!
echo ========================================
echo.
echo Your POS system is ready to use!
echo.
echo To start the system:
echo 1. Double-click "START-POS.bat"
echo 2. Or use the desktop shortcut
echo.
echo The system will open in your browser at:
echo http://localhost:8080
echo.
echo Default login: No password required
echo.
echo ========================================
echo.
pause
