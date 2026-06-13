@echo off
:: rai.cmd - Wrapper to call rai.ps1 from CMD/prompt
:: Usage: rai start|stop|restart|status|logs|build|dev|migrate

:: Resolve the real location of this script (follow symlinks)
set "SCRIPT_DIR=%~dp0"

:: Check if rai.ps1 is in the same directory
if exist "%SCRIPT_DIR%rai.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%rai.ps1" %*
    exit /b %ERRORLEVEL%
)

:: Otherwise, check default install location
set "DEFAULT_DIR=%USERPROFILE%\rai-pool"
if exist "%DEFAULT_DIR%\rai.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%DEFAULT_DIR%\rai.ps1" %*
    exit /b %ERRORLEVEL%
)

echo Error: Could not find rai.ps1
echo Make sure RAI Pool is installed.
exit /b 1
