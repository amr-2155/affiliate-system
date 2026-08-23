# Phase 4: install an hourly online backup scheduled task.
# Run once as administrator (or a user allowed to register tasks):
#   powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1

$projectDir = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c cd /d `"$projectDir`" && npm run db:backup >> backup.log 2>&1" `
  -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AffiliateSystemBackup" -Action $action -Trigger $trigger -Settings $settings -Force

Write-Output "Scheduled task 'AffiliateSystemBackup' created: hourly VACUUM INTO backups, retention handled by the script (14 copies)."
