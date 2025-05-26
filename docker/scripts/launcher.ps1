# Proxy Stone - Interactive Launcher Script (PowerShell)

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "Proxy Stone Interactive Launcher (PowerShell)" -ForegroundColor Cyan
    Write-Host "Usage: .\scripts\launcher.ps1" -ForegroundColor White
    Write-Host "This script provides an interactive menu to manage Proxy Stone configurations." -ForegroundColor White
    exit 0
}

# Function to print colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to print the banner
function Show-Banner {
    Write-ColorOutput "
╔═══════════════════════════════════════╗
║           🚀 PROXY STONE 🚀           ║
║        Docker Configuration           ║
║             Launcher                  ║
╚═══════════════════════════════════════╝
" -Color Cyan
}

# Function to show the main menu
function Show-Menu {
    Write-Host ""
    Write-ColorOutput "📋 Available Configurations:" -Color Yellow
    Write-Host ""
    Write-Host "  1) 🗃️  SQLite      - Simple file-based database (Development)"
    Write-Host "  2) 🐬 MySQL       - MySQL 8 with Adminer UI (Production)"
    Write-Host "  3) 🐘 PostgreSQL  - PostgreSQL 16 with pgAdmin (Production)"
    Write-Host ""
    Write-ColorOutput "🔧 Management Options:" -Color Yellow
    Write-Host ""
    Write-Host "  4) 📊 Status      - Check running services"
    Write-Host "  5) 🛑 Stop All    - Stop all configurations"
    Write-Host "  6) 🧹 Clean All   - Stop all + remove volumes (⚠️  DATA LOSS)"
    Write-Host ""
    Write-Host "  0) 🚪 Exit"
    Write-Host ""
}

# Function to check if Docker is running
function Test-Docker {
    try {
        $null = docker info 2>$null
        return $true
    }
    catch {
        Write-ColorOutput "❌ Docker is not running. Please start Docker Desktop first." -Color Red
        return $false
    }
}

# Function to start a configuration
function Start-Configuration {
    param(
        [string]$ConfigName,
        [string]$ScriptName,
        [string]$Description
    )
    
    Write-ColorOutput "🚀 Starting $Description..." -Color Green
    Write-Host ""
    
    Write-Host "Choose startup mode:"
    Write-Host "  1) Foreground (with logs)"
    Write-Host "  2) Background (detached)"
    Write-Host "  3) Background + rebuild images"
    Write-Host ""
    
    $mode = Read-Host "Enter choice (1-3)"
    
    $scriptPath = "scripts\$ScriptName"
    
    switch ($mode) {
        "1" {
            if (Test-Path "$scriptPath") {
                & ".\$scriptPath"
            } else {
                Write-ColorOutput "❌ Script not found: $scriptPath" -Color Red
                Write-ColorOutput "💡 Try using Docker Compose directly:" -Color Yellow
                Write-Host "docker-compose -f docker-compose.$ConfigName.yml up"
            }
        }
        "2" {
            if (Test-Path "$scriptPath") {
                & ".\$scriptPath" -d
            } else {
                Write-ColorOutput "❌ Script not found: $scriptPath" -Color Red
                Write-ColorOutput "💡 Try using Docker Compose directly:" -Color Yellow
                Write-Host "docker-compose -f docker-compose.$ConfigName.yml up -d"
            }
        }
        "3" {
            if (Test-Path "$scriptPath") {
                & ".\$scriptPath" -d -b
            } else {
                Write-ColorOutput "❌ Script not found: $scriptPath" -Color Red
                Write-ColorOutput "💡 Try using Docker Compose directly:" -Color Yellow
                Write-Host "docker-compose -f docker-compose.$ConfigName.yml up -d --build"
            }
        }
        default {
            Write-ColorOutput "❌ Invalid choice. Operation cancelled." -Color Red
        }
    }
}

# Function to show status
function Show-Status {
    Write-ColorOutput "📊 Checking service status..." -Color Blue
    Write-Host ""
    
    # Check each configuration
    $configs = @(
        @{Name="SQLite"; File="docker-compose.sqlite.yml"},
        @{Name="MySQL"; File="docker-compose.mysql.yml"},
        @{Name="PostgreSQL"; File="docker-compose.postgresql.yml"}
    )
    
    foreach ($config in $configs) {
        Write-ColorOutput "🔍 $($config.Name) Configuration:" -Color White
        Write-Host "─────────────────────────────"
        
        try {
            $services = docker-compose -f $config.File ps --services --filter "status=running" 2>$null
            if ($services) {
                Write-ColorOutput "🟢 Running services:" -Color Green
                docker-compose -f $config.File ps 2>$null
            } else {
                Write-ColorOutput "❌ No services running" -Color Red
            }
        }
        catch {
            Write-ColorOutput "❌ Error checking $($config.Name) status" -Color Red
        }
        Write-Host ""
    }
}

# Function to stop all services
function Stop-AllServices {
    param([switch]$RemoveVolumes)
    
    if ($RemoveVolumes) {
        Write-ColorOutput "⚠️  WARNING: This will delete ALL data!" -Color Red
        Write-Host ""
        $confirm = Read-Host "Are you sure? Type 'yes' to confirm"
        if ($confirm -ne "yes") {
            Write-ColorOutput "✅ Operation cancelled." -Color Green
            return
        }
        Write-ColorOutput "🧹 Stopping all services and removing volumes..." -Color Red
        & ".\scripts\stop-all.bat" -v
    } else {
        Write-ColorOutput "🛑 Stopping all services..." -Color Yellow
        & ".\scripts\stop-all.bat"
    }
}

# Main function
function Main {
    # Check prerequisites
    if (-not (Test-Docker)) {
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Show banner
    Show-Banner
    
    while ($true) {
        Show-Menu
        $choice = Read-Host "Enter your choice (0-6)"
        
        switch ($choice) {
            "1" {
                Start-Configuration "sqlite" "start-sqlite.bat" "SQLite Configuration"
            }
            "2" {
                Start-Configuration "mysql" "start-mysql.bat" "MySQL Configuration"
            }
            "3" {
                Start-Configuration "postgresql" "start-postgresql.bat" "PostgreSQL Configuration"
            }
            "4" {
                Show-Status
                Read-Host "Press Enter to continue"
            }
            "5" {
                Stop-AllServices
                Read-Host "Press Enter to continue"
            }
            "6" {
                Stop-AllServices -RemoveVolumes
                Read-Host "Press Enter to continue"
            }
            "0" {
                Write-ColorOutput "👋 Goodbye!" -Color Green
                exit 0
            }
            default {
                Write-ColorOutput "❌ Invalid choice. Please try again." -Color Red
                Read-Host "Press Enter to continue"
            }
        }
    }
}

# Run the main function
Main 