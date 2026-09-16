@echo off
set EXE=%~dp0Uygulama\Kitap Stüdyosu.exe
if exist "%EXE%" (
  start "" "%EXE%"
) else (
  echo Exe henuz olusturulmadi. Once npm run package:win calistirin.
  pause
)
