@echo off
:loop
echo [%date% %time%] Starting cloudflared... >> "C:\Users\A\Documents\New folder\affiliate-system\tunnel.log"
"C:\Users\A\AppData\Local\npm-cache\_npx\8a26fc3a61fe4212\node_modules\cloudflared\bin\cloudflared.exe" tunnel --url http://localhost:3000 >> "C:\Users\A\Documents\New folder\affiliate-system\tunnel.log" 2>&1
echo [%date% %time%] cloudflared exited, restarting in 5 seconds... >> "C:\Users\A\Documents\New folder\affiliate-system\tunnel.log"
timeout /t 5 /nobreak >nul
goto loop
