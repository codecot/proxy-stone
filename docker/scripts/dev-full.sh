#!/bin/bash

# Full Containerized Development Setup
# Starts all services (backend, UI, infrastructure) in Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"

echo "🚀 Starting Full Containerized Environment"
echo "=========================================="

# Parse arguments
DB_TYPE="sqlite"
PROFILE_ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --mysql)
            DB_TYPE="mysql"
            PROFILE_ARGS="--profile mysql"
            shift
            ;;
        --postgres)
            DB_TYPE="postgresql"
            PROFILE_ARGS="--profile postgres"
            shift
            ;;
        --sqlite)
            DB_TYPE="sqlite"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--sqlite|--mysql|--postgres]"
            exit 1
            ;;
    esac
done

echo "📊 Database: $DB_TYPE"

cd "$DOCKER_DIR"

# Determine compose files
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.full.yml"

if [ "$DB_TYPE" = "mysql" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.mysql.override.yml"
elif [ "$DB_TYPE" = "postgresql" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.postgres.override.yml"
fi

echo "🐳 Starting Docker services..."
docker compose $COMPOSE_FILES $PROFILE_ARGS up -d

echo ""
echo "✅ All services started successfully!"
echo ""
echo "📊 Services available:"
echo "   - UI: http://localhost:3000"
echo "   - Backend API: http://localhost:4000"
echo "   - Redis: http://localhost:6379"
echo "   - Redis Commander: http://localhost:8081"
if [ "$DB_TYPE" = "mysql" ]; then
    echo "   - MySQL: localhost:3306"
    echo "   - Adminer: http://localhost:8080"
elif [ "$DB_TYPE" = "postgresql" ]; then
    echo "   - PostgreSQL: localhost:5432"
    echo "   - pgAdmin: http://localhost:5050"
fi
echo ""
echo "🔍 To view logs: docker compose $COMPOSE_FILES logs -f"
echo "🛑 To stop: docker compose $COMPOSE_FILES down" 