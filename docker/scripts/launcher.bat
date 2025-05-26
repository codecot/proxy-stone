@echo off
setlocal enabledelayedexpansion

REM Proxy Stone - Simple Launcher Script (Windows Batch)

:main_menu
cls
echo.
echo ╔═══════════════════════════════════════╗
echo ║           🚀 PROXY STONE 🚀           ║
echo ║        Docker Configuration           ║
echo ║             Launcher                  ║
echo ╚═══════════════════════════════════════╝
echo.
echo 📋 Available Configurations:
echo.
echo   1) SQLite      - Simple file-based database (Development)
echo   2) MySQL       - MySQL 8 with Adminer UI (Production)
echo   3) PostgreSQL  - PostgreSQL 16 with pgAdmin (Production)
echo.
echo 🔧 Management Options:
echo.
echo   4) Stop All    - Stop all configurations
echo   5) Clean All   - Stop all + remove volumes (⚠️  DATA LOSS)
echo.
echo   0) Exit
echo.

set /p choice="Enter your choice (0-5): "

if "%choice%"=="1" goto start_sqlite
if "%choice%"=="2" goto start_mysql
if "%choice%"=="3" goto start_postgresql
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" goto clean_all
if "%choice%"=="0" goto exit_script

echo ❌ Invalid choice. Please try again.
pause
goto main_menu

:start_sqlite
echo.
echo 🚀 Starting SQLite Configuration...
echo.
echo Choose startup mode:
echo   1) Foreground (with logs)
echo   2) Background (detached)
echo   3) Background + rebuild images
echo.
set /p mode="Enter choice (1-3): "

if "%mode%"=="1" (
    scripts\start-sqlite.bat
) else if "%mode%"=="2" (
    scripts\start-sqlite.bat -d
) else if "%mode%"=="3" (
    scripts\start-sqlite.bat -d -b
) else (
    echo ❌ Invalid choice. Starting in detached mode...
    scripts\start-sqlite.bat -d
)
pause
goto main_menu

:start_mysql
echo.
echo 🚀 Starting MySQL Configuration...
echo.
echo Choose startup mode:
echo   1) Foreground (with logs)
echo   2) Background (detached)
echo   3) Background + rebuild images
echo.
set /p mode="Enter choice (1-3): "

if "%mode%"=="1" (
    scripts\start-mysql.bat
) else if "%mode%"=="2" (
    scripts\start-mysql.bat -d
) else if "%mode%"=="3" (
    scripts\start-mysql.bat -d -b
) else (
    echo ❌ Invalid choice. Starting in detached mode...
    scripts\start-mysql.bat -d
)
pause
goto main_menu

:start_postgresql
echo.
echo 🚀 Starting PostgreSQL Configuration...
echo.
echo Choose startup mode:
echo   1) Foreground (with logs)
echo   2) Background (detached)
echo   3) Background + rebuild images
echo.
set /p mode="Enter choice (1-3): "

if "%mode%"=="1" (
    scripts\start-postgresql.bat
) else if "%mode%"=="2" (
    scripts\start-postgresql.bat -d
) else if "%mode%"=="3" (
    scripts\start-postgresql.bat -d -b
) else (
    echo ❌ Invalid choice. Starting in detached mode...
    scripts\start-postgresql.bat -d
)
pause
goto main_menu

:stop_all
echo.
echo 🛑 Stopping all services...
scripts\stop-all.bat
pause
goto main_menu

:clean_all
echo.
echo ⚠️  WARNING: This will delete ALL data!
echo.
set /p confirm="Are you sure? Type 'yes' to confirm: "
if "%confirm%"=="yes" (
    echo 🧹 Stopping all services and removing volumes...
    scripts\stop-all.bat -v
) else (
    echo ✅ Operation cancelled.
)
pause
goto main_menu

:exit_script
echo.
echo �� Goodbye!
exit /b 0 