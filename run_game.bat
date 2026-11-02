@echo off
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m future_survival
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo Python was not found. Install Python 3.11 or newer and try again.
        pause
        exit /b 1
    )
    python -m future_survival
)

if errorlevel 1 (
    echo.
    echo The game did not start successfully. Check the error above.
    pause
    exit /b 1
)

endlocal
