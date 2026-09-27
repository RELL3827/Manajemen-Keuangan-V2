@echo off
title EarnVoice - Mode Offline Windows
cd /d "%~dp0"
echo Membuka EarnVoice dalam Mode Offline (Lokal Windows)...
start "" "%~dp0EarnVoice.exe" --offline
exit
