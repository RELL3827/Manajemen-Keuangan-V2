@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   EarnVoice - Setup Shortcut Desktop & Start Menu
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\EarnVoice.lnk'); $s.TargetPath = '%~dp0EarnVoice.exe'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%~dp0app.ico,0'; $s.Description = 'EarnVoice - Catat Keuangan Semudah Bicara'; $s.Save()"
echo [OK] Shortcut EarnVoice berhasil dibuat di Desktop!
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $startDir = [Environment]::GetFolderPath('StartMenu') + '\Programs'; $s = $ws.CreateShortcut($startDir + '\EarnVoice.lnk'); $s.TargetPath = '%~dp0EarnVoice.exe'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%~dp0app.ico,0'; $s.Description = 'EarnVoice - Catat Keuangan Semudah Bicara'; $s.Save()"
echo [OK] Shortcut EarnVoice berhasil ditambahkan ke Start Menu!
echo.
echo Selesai! Anda sekarang dapat membuka EarnVoice langsung dari Desktop atau Start Menu.
echo Tekan sembarang tombol untuk keluar...
pause >nul
