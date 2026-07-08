@echo off
chcp 65001 >nul
setlocal

set "SCRIPT_DIR=%~dp0"
set "LAUNCHER=%SCRIPT_DIR%启动H5.ps1"

if not exist "%LAUNCHER%" (
  echo 找不到启动脚本: "%LAUNCHER%"
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { $pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue; if ($pwsh) { & $pwsh.Source -NoLogo -ExecutionPolicy Bypass -File '%LAUNCHER%' } else { & '%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe' -NoLogo -ExecutionPolicy Bypass -File '%LAUNCHER%' } }"

endlocal
