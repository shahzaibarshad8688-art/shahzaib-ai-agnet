@echo off
title Shahzaib AI Agent - Personal Intelligence Workstation
color 0B

echo ==============================================================
echo    SHAHZAIB AI AGENT — AUTONOMOUS WORKSPACE
echo    Creator: SHAHZAIB ARSHAD KHAGGA
echo ==============================================================
echo.
echo Starting Shahzaib AI Agent server on http://localhost:3000 ...
echo.

REM Wait 2 seconds then open browser
timeout /t 2 /nobreak >nul
start "" http://localhost:3000

node backend/src/server.js

pause
