@echo off
setlocal
title DoIT - Prepare Windows application
cd /d "%~dp0"
echo Preparing DoIT. Please wait...
copy /b "DoIT-Windows.zip.part01"+"DoIT-Windows.zip.part02"+"DoIT-Windows.zip.part03"+"DoIT-Windows.zip.part04"+"DoIT-Windows.zip.part05" "DoIT-Windows.zip" >nul
if errorlevel 1 goto error
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; if ((Get-FileHash -LiteralPath 'DoIT-Windows.zip' -Algorithm SHA256).Hash -ne 'F46645B79164D7ED3BA9C9459D7F945D4F3645BB3B22F560F4D191E32FF52C33'){throw 'Archive checksum mismatch'}; Expand-Archive -LiteralPath 'DoIT-Windows.zip' -DestinationPath 'DoIT' -Force"
if errorlevel 1 goto error
start "" "%~dp0DoIT\DoIT.exe"
exit /b 0
:error
echo Unable to prepare DoIT. Make sure all archive parts were extracted.
echo If you need help, report this message in the DoIT repository.
pause
exit /b 1
