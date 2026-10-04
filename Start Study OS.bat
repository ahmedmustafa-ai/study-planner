@echo off
REM Double-click to start Study OS. Keep this window open while you use it (close it to stop).
REM Always uses http://localhost:5173 in your default browser, so your data is always the same data.
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing... this takes a minute.
  call npm install
)
echo.
echo Study OS is starting. If your browser does not open, go to http://localhost:5173
echo Use the SAME browser every time, and back up often: Settings ^> Back up now.
echo.
call npm run dev -- --open
pause
