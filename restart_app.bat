@echo off
setlocal

cd /d "%~dp0app"

echo Stopping local app on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:"0.0.0.0:5173 .* [0-9][0-9]*$" /C:"127.0.0.1:5173 .* [0-9][0-9]*$"') do (
  taskkill /PID %%a /F >nul 2>nul
)

echo Stopping local app websocket on port 24678...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:"0.0.0.0:24678 .* [0-9][0-9]*$" /C:"127.0.0.1:24678 .* [0-9][0-9]*$"') do (
  taskkill /PID %%a /F >nul 2>nul
)

echo Starting local Node app...
call npm run dev

endlocal
