@echo off
setlocal enabledelayedexpansion
cd /d "C:\Users\A\Documents\New folder\affiliate-system"
title Affiliate System (Production)

:: ============================================================
:: Phase 5 - canonical production startup:
::   install -> build -> PM2 (next start) -> health check -> tunnel
:: Replaces the old dual path (runner.js dev server vs raw next start).
:: ============================================================

echo [1/6] Stopping leftover processes...
taskkill /f /im cloudflared.exe >nul 2>&1
call npx pm2 delete affiliate-system >nul 2>&1
timeout /t 2 /nobreak >nul

if not exist "node_modules" (
  echo [2/6] Installing dependencies ^(npm ci^)...
  call npm ci
  if errorlevel 1 goto :fail
) else (
  echo [2/6] Dependencies present, skipping npm ci.
)

echo [3/6] Hardening database ^(WAL^) and building...
call npm run db:init
if errorlevel 1 goto :fail
call npm run db:migrate
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail

echo [4/6] Starting via PM2...
call npx pm2 start ecosystem.config.js
if errorlevel 1 goto :fail

echo [5/6] Health check...
set /a tries=0
:health
timeout /t 3 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/api/health | findstr "200" >nul
if %errorlevel%==0 goto :healthy
set /a tries+=1
if %tries% lss 10 goto :health
echo Health check failed after 30s - check logs\pm2-error.log
goto :fail

:healthy
echo Health check OK.

echo [6/6] Starting Cloudflare Tunnel...
start "CloudflareTunnel" /min cmd /c "cloudflared tunnel --url http://localhost:3000 --logfile tunnel.log > tunnel_stdout.log 2>&1"

echo.
echo === Affiliate System is UP (PM2: affiliate-system) ===
echo Useful: npx pm2 status ^| npx pm2 monit ^| npx pm2 logs affiliate-system
goto :eof

:fail
echo.
echo === STARTUP FAILED - see output above ===
exit /b 1
