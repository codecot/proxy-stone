#!/bin/bash

# Proxy Stone - Stop All Services Script

set -e

echo "🛑 Stopping all Proxy Stone services..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running."
    exit 1
fi

# Parse command line arguments
REMOVE_VOLUMES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --volumes     Remove volumes (WARNING: This will delete all data!)"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "This script will stop all Proxy Stone configurations:"
            echo "  - SQLite configuration"
            echo "  - MySQL configuration"
            echo "  - PostgreSQL configuration"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Function to stop a configuration
stop_config() {
    local config_name=$1
    local compose_file=$2
    
    echo "🔍 Checking $config_name configuration..."
    
    if docker-compose -f "$compose_file" ps -q | grep -q .; then
        echo "🛑 Stopping $config_name services..."
        if [ "$REMOVE_VOLUMES" = true ]; then
            docker-compose -f "$compose_file" down -v
            echo "⚠️  Removed volumes for $config_name"
        else
            docker-compose -f "$compose_file" down
        fi
        echo "✅ $config_name services stopped"
    else
        echo "ℹ️  No running $config_name services found"
    fi
    echo ""
}

# Stop all configurations
stop_config "SQLite" "docker-compose.sqlite.yml"
stop_config "MySQL" "docker-compose.mysql.yml"
stop_config "PostgreSQL" "docker-compose.postgresql.yml"

# Clean up any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker container prune -f > /dev/null 2>&1 || true

if [ "$REMOVE_VOLUMES" = true ]; then
    echo "⚠️  WARNING: Volume removal completed. All data has been deleted!"
    echo "🧹 Cleaning up unused volumes..."
    docker volume prune -f > /dev/null 2>&1 || true
fi

echo "✅ All Proxy Stone services have been stopped!"

# Show remaining containers if any
REMAINING=$(docker ps --filter "name=proxy" --format "table {{.Names}}\t{{.Status}}" | tail -n +2)
if [ -n "$REMAINING" ]; then
    echo ""
    echo "⚠️  Some proxy-related containers are still running:"
    echo "$REMAINING"
fi 