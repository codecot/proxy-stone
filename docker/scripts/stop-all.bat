@echo off
setlocal enabledelayedexpansion

REM Proxy Stone - Stop All Services Script (Windows)

echo 🛑 Stopping all Proxy Stone services...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running.
    pause
    exit /b 1
)

REM Parse command line arguments
set REMOVE_VOLUMES=false

:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="-v" set REMOVE_VOLUMES=true
if "%~1"=="--volumes" set REMOVE_VOLUMES=true
if "%~1"=="-h" goto show_help
if "%~1"=="--help" goto show_help
shift
goto parse_args

:show_help
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   -v, --volumes     Remove volumes (WARNING: This will delete all data!)
echo   -h, --help        Show this help message
echo.
echo This script will stop all Proxy Stone configurations:
echo   - SQLite configuration
echo   - MySQL configuration
echo   - PostgreSQL configuration
pause
exit /b 0

:end_parse

REM Function to stop a configuration
call :stop_config "SQLite" "docker-compose.sqlite.yml"
call :stop_config "MySQL" "docker-compose.mysql.yml"
call :stop_config "PostgreSQL" "docker-compose.postgresql.yml"

REM Clean up any orphaned containers
echo 🧹 Cleaning up orphaned containers...
docker container prune -f >nul 2>&1

if "%REMOVE_VOLUMES%"=="true" (
    echo ⚠️  WARNING: Volume removal completed. All data has been deleted!
    echo 🧹 Cleaning up unused volumes...
    docker volume prune -f >nul 2>&1
)

echo ✅ All Proxy Stone services have been stopped!

REM Show remaining containers if any
echo.
echo 🔍 Checking for remaining proxy containers...
docker ps --filter "name=proxy" --format "table {{.Names}}\t{{.Status}}" > temp_containers.txt
for /f "skip=1" %%i in (temp_containers.txt) do (
    echo ⚠️  Some proxy-related containers are still running:
    type temp_containers.txt
    goto cleanup_temp
)
echo ✅ No proxy containers running.

:cleanup_temp
if exist temp_containers.txt del temp_containers.txt
pause
exit /b 0

REM Function to stop a configuration
:stop_config
set config_name=%~1
set compose_file=%~2

echo 🔍 Checking %config_name% configuration...

REM Check if any services are running
docker-compose -f "%compose_file%" ps -q >nul 2>&1
if errorlevel 1 (
    echo ℹ️  No running %config_name% services found
    echo.
    goto :eof
)

REM Check if there are actually running containers
docker-compose -f "%compose_file%" ps -q | findstr /r "." >nul
if errorlevel 1 (
    echo ℹ️  No running %config_name% services found
    echo.
    goto :eof
)

echo 🛑 Stopping %config_name% services...
if "%REMOVE_VOLUMES%"=="true" (
    docker-compose -f "%compose_file%" down -v
    if not errorlevel 1 echo ⚠️  Removed volumes for %config_name%
) else (
    docker-compose -f "%compose_file%" down
)

if not errorlevel 1 (
    echo ✅ %config_name% services stopped
) else (
    echo ❌ Failed to stop %config_name% services
)
echo.
goto :eof 