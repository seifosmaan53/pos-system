@echo off
setlocal enabledelayedexpansion

REM Change to the directory where this batch file is located
cd /d "%~dp0"

echo.
echo ========================================
echo    STOP POS SYSTEM
echo ========================================
echo.

REM Check if PID file exists
if exist "pos-system.pid" (
    set /p PID=<pos-system.pid
    echo Found PID file: %PID%
    
    REM Check if process is still running
    tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul
    if %errorlevel% equ 0 (
        echo Stopping POS System (PID: %PID%)...
        taskkill /PID %PID% >nul 2>&1
        timeout /t 2 /nobreak >nul
        
        REM Check if still running
        tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul
        if %errorlevel% equ 0 (
            echo Gentle stop failed, forcing stop...
            taskkill /F /PID %PID% >nul 2>&1
        )
        
        del "pos-system.pid" >nul 2>&1
        echo POS System stopped successfully!
    ) else (
        echo Process not running, cleaning up PID file
        del "pos-system.pid" >nul 2>&1
    )
) else (
    echo No PID file found, checking port...
    
    REM Fallback: Check if POS system is running on port
    netstat -an | find ":8080" | find "LISTENING" >nul
    if %errorlevel% equ 0 (
        echo Stopping POS System...
        
        REM Find and kill node processes running pos-system.js
        for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| find "PID:"') do (
            set PID=%%a
            wmic process where "ProcessId=!PID!" get CommandLine 2>nul | find "pos-system.js" >nul
            if !errorlevel! equ 0 (
                taskkill /F /PID !PID! >nul 2>&1
            )
        )
        
        timeout /t 2 /nobreak >nul
        
        REM Check if it's stopped
        netstat -an | find ":8080" | find "LISTENING" >nul
        if %errorlevel% equ 0 (
            echo Failed to stop POS System
            echo Try restarting your computer
        ) else (
            echo POS System stopped successfully!
        )
    ) else (
        echo POS System is not running
    )
)

echo.
pause

