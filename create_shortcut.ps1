# Desktop shortcut to the live app. It opens quiz.peteowen.dev rather than
# launch.bat: the local dev server keeps its own separate progress and cannot
# reach the sync server, so playing through it never reaches your other devices.
# launch.bat stays for development.
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Know-It-All.url"

Set-Content -Path $shortcutPath -Encoding ASCII -Value @"
[InternetShortcut]
URL=https://quiz.peteowen.dev/
IconFile=C:\Windows\System32\shell32.dll
IconIndex=14
"@

Write-Output "Created shortcut at $shortcutPath"
