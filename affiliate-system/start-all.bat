@echo off
cd /d "C:\Users\A\Documents\New folder\affiliate-system"
title Affiliate System

:: Kill any leftover processes
taskkill /f /im node.exe 2>nul
taskkill /f /im cloudflared.exe 2>nul
timeout /t 2 /nobreak >nul

:: Start production server
echo [1/4] Starting Next.js production server...
start "NextServer" /min cmd /c "node node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000 > server.log 2>&1"
timeout /t 5 /nobreak >nul

:: Start Cloudflare Tunnel
echo [2/4] Starting Cloudflare Tunnel...
del tunnel.log 2>nul
start "CloudflareTunnel" /min cmd /c "cloudflared tunnel --url http://localhost:3000 --logfile tunnel.log > tunnel_stdout.log 2>&1"

:: Wait for tunnel URL
echo [3/4] Waiting for tunnel URL...
setlocal enabledelayedexpansion
set TUNNEL_URL=
for /l %%i in (1,1,30) do (
  timeout /t 1 /nobreak >nul
  for /f "tokens=*" %%a in ('findstr /r "https://.*\.trycloudflare\.com" tunnel.log 2^>nul') do (
    set "line=%%a"
    for /f "tokens=4" %%b in ("!line!") do set "TUNNEL_URL=%%b"
  )
  if defined TUNNEL_URL (
    echo Tunnel URL: !TUNNEL_URL!
    goto :update_env
  )
)

:update_env
if defined TUNNEL_URL (
  echo [4/4] Updating NEXTAUTH_URL in .env...
  > .env.tmp echo DATABASE_URL="file:C:/Users/A/Documents/New folder/affiliate-system/prisma/dev.db"
  >> .env.tmp echo NEXTAUTH_SECRET="affiliate-system-secret-key-2024"
  >> .env.tmp echo NEXTAUTH_URL="!TUNNEL_URL!"
  move /y .env.tmp .env >nul
  echo Updated .env with new tunnel URL
) else (
  echo [4/4] Could not detect tunnel URL. Check tunnel.log manually.
)

echo.
echo ========================================
echo  System is LIVE!
echo  Tunnel URL: %TUNNEL_URL%
echo ========================================
echo.
echo To stop: taskkill /f /im cloudflared.exe ^&^& taskkill /f /im node.exe
echo.
pause
