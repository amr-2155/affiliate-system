# Install as Windows scheduled task to auto-start on boot
$action = New-ScheduledTaskAction -Execute "C:\Users\A\Documents\New folder\affiliate-system\start-all.bat" -WorkingDirectory "C:\Users\A\Documents\New folder\affiliate-system"
$trigger = New-ScheduledTaskTrigger -AtStartup -RandomDelay "00:00:30"
$principal = New-ScheduledTaskPrincipal -UserId "A" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AffiliateSystem" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Output "Scheduled task 'AffiliateSystem' created. The system will auto-start on boot."
Write-Output "Run manually: start-all.bat"
Write-Output "Current tunnel URL: https://physical-came-guestbook-factory.trycloudflare.com"
