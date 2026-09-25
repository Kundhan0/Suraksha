@echo off
echo ============================================
echo  Starting Project Suraksha (SIH26191)
echo ============================================
echo.

cd /d "%~dp0"

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting API + Web Server...
echo Open browser at http://localhost:8001
echo.

python -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload
