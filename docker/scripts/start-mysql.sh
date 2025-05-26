#!/bin/bash

# Proxy Stone - MySQL Configuration Startup Script

set -e

echo "🚀 Starting Proxy Stone with MySQL configuration..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Parse command line arguments
DETACHED=false
BUILD=false
LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detached)
            DETACHED=true
            shift
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -l|--logs)
            LOGS=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -d, --detached    Run in detached mode (background)"
            echo "  -b, --build       Force rebuild of images"
            echo "  -l, --logs        Show logs after starting"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Services will be available at:"
            echo "  Frontend UI:      http://localhost:3000"
            echo "  Proxy API:        http://localhost:4000"
            echo "  MySQL Database:   localhost:3306"
            echo "  Adminer (DB UI):  http://localhost:8080"
            echo "  Redis Commander:  http://localhost:8081"
            echo ""
            echo "Default MySQL credentials:"
            echo "  User: devuser"
            echo "  Password: devpass"
            echo "  Database: proxydb"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Build command
COMPOSE_CMD="docker-compose -f docker-compose.mysql.yml"

if [ "$BUILD" = true ]; then
    echo "🔨 Building images..."
    $COMPOSE_CMD build
fi

# Start services
if [ "$DETACHED" = true ]; then
    echo "🐳 Starting services in detached mode..."
    $COMPOSE_CMD up -d
    
    echo ""
    echo "✅ Services started successfully!"
    echo ""
    echo "🌐 Access your application:"
    echo "  Frontend UI:      http://localhost:3000"
    echo "  Proxy API:        http://localhost:4000/health"
    echo "  Adminer (DB UI):  http://localhost:8080"
    echo "  Redis Commander:  http://localhost:8081"
    echo ""
    echo "🗄️  MySQL Connection:"
    echo "  Host: localhost:3306"
    echo "  User: devuser"
    echo "  Password: devpass"
    echo "  Database: proxydb"
    echo ""
    echo "📊 Check service status:"
    echo "  docker-compose -f docker-compose.mysql.yml ps"
    echo ""
    echo "📝 View logs:"
    echo "  docker-compose -f docker-compose.mysql.yml logs -f"
    echo ""
    echo "🛑 Stop services:"
    echo "  docker-compose -f docker-compose.mysql.yml down"
    
    if [ "$LOGS" = true ]; then
        echo ""
        echo "📝 Showing logs (Ctrl+C to exit)..."
        sleep 2
        $COMPOSE_CMD logs -f
    fi
else
    echo "🐳 Starting services with logs..."
    $COMPOSE_CMD up
fi 