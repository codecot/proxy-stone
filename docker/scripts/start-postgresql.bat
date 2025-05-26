@echo off
setlocal enabledelayedexpansion

REM Proxy Stone - PostgreSQL Configuration Startup Script (Windows)

echo 🚀 Starting Proxy Stone with PostgreSQL configuration...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Parse command line arguments
set DETACHED=false
set BUILD=false
set LOGS=false

:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="-d" set DETACHED=true
if "%~1"=="--detached" set DETACHED=true
if "%~1"=="-b" set BUILD=true
if "%~1"=="--build" set BUILD=true
if "%~1"=="-l" set LOGS=true
if "%~1"=="--logs" set LOGS=true
if "%~1"=="-h" goto show_help
if "%~1"=="--help" goto show_help
shift
goto parse_args

:show_help
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   -d, --detached    Run in detached mode (background)
echo   -b, --build       Force rebuild of images
echo   -l, --logs        Show logs after starting
echo   -h, --help        Show this help message
echo.
echo Services will be available at:
echo   Frontend UI:      http://localhost:3000
echo   Proxy API:        http://localhost:4000
echo   PostgreSQL DB:    localhost:5432
echo   pgAdmin (DB UI):  http://localhost:5050
echo   Redis Commander:  http://localhost:8081
echo.
echo Default PostgreSQL credentials:
echo   User: devuser
echo   Password: devpass
echo   Database: proxydb
echo.
echo Default pgAdmin credentials:
echo   Email: admin@local.dev
echo   Password: adminpass
pause
exit /b 0

:end_parse

REM Build command
set COMPOSE_CMD=docker-compose -f docker-compose.postgresql.yml

if "%BUILD%"=="true" (
    echo 🔨 Building images...
    %COMPOSE_CMD% build
    if errorlevel 1 (
        echo ❌ Build failed!
        pause
        exit /b 1
    )
)

REM Start services
if "%DETACHED%"=="true" (
    echo 🐳 Starting services in detached mode...
    %COMPOSE_CMD% up -d
    if errorlevel 1 (
        echo ❌ Failed to start services!
        pause
        exit /b 1
    )
    
    echo.
    echo ✅ Services started successfully!
    echo.
    echo 🌐 Access your application:
    echo   Frontend UI:      http://localhost:3000
    echo   Proxy API:        http://localhost:4000/health
    echo   pgAdmin (DB UI):  http://localhost:5050
    echo   Redis Commander:  http://localhost:8081
    echo.
    echo 🗄️  PostgreSQL Connection:
    echo   Host: localhost:5432
    echo   User: devuser
    echo   Password: devpass
    echo   Database: proxydb
    echo.
    echo 🔧 pgAdmin Login:
    echo   Email: admin@local.dev
    echo   Password: adminpass
    echo.
    echo 📊 Check service status:
    echo   docker-compose -f docker-compose.postgresql.yml ps
    echo.
    echo 📝 View logs:
    echo   docker-compose -f docker-compose.postgresql.yml logs -f
    echo.
    echo 🛑 Stop services:
    echo   docker-compose -f docker-compose.postgresql.yml down
    
    if "%LOGS%"=="true" (
        echo.
        echo 📝 Showing logs (Ctrl+C to exit)...
        timeout /t 2 >nul
        %COMPOSE_CMD% logs -f
    ) else (
        pause
    )
) else (
    echo 🐳 Starting services with logs...
    %COMPOSE_CMD% up
) 