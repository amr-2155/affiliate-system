# Phase 5: external health probe.
# Register with Task Scheduler (every minute) to auto-restart the app when
# it stops answering while the PM2 process is still alive (hung server):
#   powershell -ExecutionPolicy Bypass -File scripts\install-healthcheck-task.ps1

$projectDir = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c cd /d `"$projectDir`" && node scripts\healthcheck.mjs >> healthcheck.log 2>&1" `
  -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AffiliateSystemHealthcheck" -Action $action -Trigger $trigger -Settings $settings -Force
Write-Output "Scheduled task 'AffiliateSystemHealthcheck' created: probes /api/health every minute, restarts via PM2 after 3 consecutive failures."
