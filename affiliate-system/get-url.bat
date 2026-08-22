@echo off
echo === Current Cloudflare Tunnel URL ===
for /f "tokens=*" %%a in ('findstr /c:"trycloudflare.com" "C:\Users\A\Documents\New folder\affiliate-system\tunnel.log"') do set "lastline=%%a"
echo %lastline%
