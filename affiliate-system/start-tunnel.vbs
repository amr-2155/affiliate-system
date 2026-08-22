Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""C:\Users\A\AppData\Local\npm-cache\_npx\8a26fc3a61fe4212\node_modules\cloudflared\bin\cloudflared.exe"" tunnel --url http://localhost:3000 --protocol http2 > ""C:\Users\A\Documents\New folder\affiliate-system\tunnel.log"" 2>&1", 0, False
