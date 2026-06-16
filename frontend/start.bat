@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM KARNEX frontend launcher (build admin dashboard or run Vite dev server).
REM Usage:
REM   frontend\start.bat           -> npm install + build admin dashboard
REM   frontend\start.bat --dev     -> Vite dev server (backend must be running)
REM   frontend\start.bat --dev --http

set "FRONTEND_DIR=%~dp0"
set "FRONTEND_ROOT=%FRONTEND_DIR%..\"
set "ADMIN_DASH=%FRONTEND_DIR%admin-dashboard"
set "BACKEND_ROOT=%FRONTEND_ROOT%..\AI-Interview-Model-B-V2"
set "MODE=build"
set "BACKEND_SCHEME=https"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--dev" set "MODE=dev"
if /I "%~1"=="--http" set "BACKEND_SCHEME=http"
shift
goto parse_args
:args_done

if exist "%FRONTEND_ROOT%.env" (
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /i "BACKEND_ROOT=" "%FRONTEND_ROOT%.env" 2^>nul`) do set "BACKEND_ROOT=%%B"
)

if not exist "%FRONTEND_DIR%index.html" (
  echo ERROR: Frontend not found at %FRONTEND_DIR%
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js/npm not in PATH. Install Node.js LTS.
  pause
  exit /b 1
)

if /I "%MODE%"=="dev" goto dev_mode

echo ========================================
echo  KARNEX — Build Frontend (admin UI)
echo ========================================
echo.

pushd "%ADMIN_DASH%"
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed.
  popd
  pause
  exit /b 1
)
call npm run build
set "BUILD_OK=!ERRORLEVEL!"
popd

if not "!BUILD_OK!"=="0" (
  echo ERROR: npm run build failed.
  pause
  exit /b 1
)

echo.
echo Frontend build complete.
echo.
echo Next step — start backend:
echo   cd %BACKEND_ROOT%
echo   start_app.bat
echo.
echo Then open: %BACKEND_SCHEME%://127.0.0.1:2020
exit /b 0

:dev_mode
echo ========================================
echo  KARNEX — Frontend Dev (Vite)
echo ========================================
echo.
echo Start backend first in another terminal:
echo   cd %BACKEND_ROOT%
echo   start_app.bat --http --no-browser
echo.
echo Dev URL: http://127.0.0.1:5173/admin/
echo.

pushd "%ADMIN_DASH%"
call npm install
if errorlevel 1 (
  popd
  pause
  exit /b 1
)
call npm run dev
popd
endlocal
