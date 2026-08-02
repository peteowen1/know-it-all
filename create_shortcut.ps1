$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Good Weekend Quiz Master.lnk"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "C:\dev\gw-quiz-trainer\launch.bat"
$shortcut.WorkingDirectory = "C:\dev\gw-quiz-trainer"
$shortcut.WindowStyle = 7
$shortcut.IconLocation = "shell32.dll, 14"
$shortcut.Save()

Write-Output "Created shortcut at $shortcutPath"
