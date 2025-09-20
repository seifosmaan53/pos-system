@echo off
title POS System - Complete Setup
color 0A
echo.
echo ========================================
echo    POS SYSTEM - COMPLETE SETUP
echo ========================================
echo.
echo This will install and start your POS system.
echo.

REM Check if this is first time installation
if not exist "node_modules" (
    echo First time installation detected...
    echo Running installation...
    call FIRST-TIME-INSTALL.bat
    if %errorlevel% neq 0 (
        echo Installation failed!
        pause
        exit /b 1
    )
    echo.
    echo Installation complete! Starting POS system...
    echo.
) else (
    echo POS system already installed.
    echo Starting system...
    echo.
)

REM Start the POS system
call START-POS.bat
