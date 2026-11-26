@echo off
rem Creates the virtual environment on first run, installs dependencies and starts the app.
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv || goto :error
)

echo Installing dependencies...
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt || goto :error

echo Starting Cancha at http://127.0.0.1:8000  (Ctrl+C to stop)
rem Open the browser a few seconds later, once the server is up.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://127.0.0.1:8000"
".venv\Scripts\python.exe" -m uvicorn backend.main:app
goto :eof

:error
echo.
echo Something failed. Check that Python is installed and on PATH.
pause
