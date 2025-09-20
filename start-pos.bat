@echo off
echo Starting POS System...
echo.
echo Installing dependencies...
call npm install
echo.
echo Starting server...
echo.
echo POS System will open in your browser at: http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo.
node pos-system.js
pause
