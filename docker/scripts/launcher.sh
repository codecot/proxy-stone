#!/bin/bash

# Interactive Docker Environment Launcher
# Helps choose the right development setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Proxy Stone Development Environment Launcher"
echo "==============================================="
echo ""
echo "Choose your development scenario:"
echo ""
echo "1) Backend Development"
echo "   - Backend runs locally (npm run dev)"
echo "   - Infrastructure (Redis, DB, UI) in Docker"
echo "   - Best for: Backend development, debugging, hot reload"
echo ""
echo "2) UI Development"
echo "   - UI runs locally (npm run dev)"
echo "   - Backend and infrastructure in Docker"
echo "   - Best for: UI development, React hot reload"
echo ""
echo "3) Full Containerized"
echo "   - Everything runs in Docker"
echo "   - Best for: Testing, production-like environment"
echo ""
echo "4) Infrastructure Only"
echo "   - Only databases and Redis in Docker"
echo "   - Best for: Running both backend and UI locally"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "📊 Choose database:"
        echo "1) SQLite (lightweight, file-based)"
        echo "2) MySQL (with Adminer UI)"
        echo "3) PostgreSQL (with pgAdmin UI)"
        read -p "Database choice (1-3): " db_choice
        
        case $db_choice in
            1) "$SCRIPT_DIR/dev-backend.sh" --sqlite ;;
            2) "$SCRIPT_DIR/dev-backend.sh" --mysql ;;
            3) "$SCRIPT_DIR/dev-backend.sh" --postgres ;;
            *) echo "Invalid choice"; exit 1 ;;
        esac
        ;;
    2)
        echo ""
        echo "📊 Choose database:"
        echo "1) SQLite (lightweight, file-based)"
        echo "2) MySQL (with Adminer UI)"
        echo "3) PostgreSQL (with pgAdmin UI)"
        read -p "Database choice (1-3): " db_choice
        
        case $db_choice in
            1) "$SCRIPT_DIR/dev-ui.sh" --sqlite ;;
            2) "$SCRIPT_DIR/dev-ui.sh" --mysql ;;
            3) "$SCRIPT_DIR/dev-ui.sh" --postgres ;;
            *) echo "Invalid choice"; exit 1 ;;
        esac
        ;;
    3)
        echo ""
        echo "📊 Choose database:"
        echo "1) SQLite (lightweight, file-based)"
        echo "2) MySQL (with Adminer UI)"
        echo "3) PostgreSQL (with pgAdmin UI)"
        read -p "Database choice (1-3): " db_choice
        
        case $db_choice in
            1) "$SCRIPT_DIR/dev-full.sh" --sqlite ;;
            2) "$SCRIPT_DIR/dev-full.sh" --mysql ;;
            3) "$SCRIPT_DIR/dev-full.sh" --postgres ;;
            *) echo "Invalid choice"; exit 1 ;;
        esac
        ;;
    4)
        echo ""
        echo "📊 Choose database:"
        echo "1) SQLite (no container needed)"
        echo "2) MySQL (with Adminer UI)"
        echo "3) PostgreSQL (with pgAdmin UI)"
        read -p "Database choice (1-3): " db_choice
        
        cd "$(dirname "$SCRIPT_DIR")"
        
        case $db_choice in
            1) 
                docker compose up -d redis redis-commander
                echo ""
                echo "✅ Infrastructure started!"
                echo "📊 Services available:"
                echo "   - Redis: http://localhost:6379"
                echo "   - Redis Commander: http://localhost:8081"
                echo ""
                echo "🔧 Next steps:"
                echo "1. Copy environment files:"
                echo "   cp docker/env.backend-dev apps/backend/.env"
                echo "   cp docker/env.ui-dev apps/ui/.env"
                echo "2. Start backend: cd apps/backend && npm run dev"
                echo "3. Start UI: cd apps/ui && npm run dev"
                ;;
            2) 
                docker compose --profile mysql up -d redis redis-commander mysql adminer
                echo ""
                echo "✅ Infrastructure started!"
                echo "📊 Services available:"
                echo "   - Redis: http://localhost:6379"
                echo "   - Redis Commander: http://localhost:8081"
                echo "   - MySQL: localhost:3306"
                echo "   - Adminer: http://localhost:8080"
                echo ""
                echo "🔧 Next steps:"
                echo "1. Copy and update environment files:"
                echo "   cp docker/env.backend-dev apps/backend/.env"
                echo "   cp docker/env.ui-dev apps/ui/.env"
                echo "2. Update apps/backend/.env with MySQL settings"
                echo "3. Start backend: cd apps/backend && npm run dev"
                echo "4. Start UI: cd apps/ui && npm run dev"
                ;;
            3) 
                docker compose --profile postgres up -d redis redis-commander postgres pgadmin
                echo ""
                echo "✅ Infrastructure started!"
                echo "📊 Services available:"
                echo "   - Redis: http://localhost:6379"
                echo "   - Redis Commander: http://localhost:8081"
                echo "   - PostgreSQL: localhost:5432"
                echo "   - pgAdmin: http://localhost:5050"
                echo ""
                echo "🔧 Next steps:"
                echo "1. Copy and update environment files:"
                echo "   cp docker/env.backend-dev apps/backend/.env"
                echo "   cp docker/env.ui-dev apps/ui/.env"
                echo "2. Update apps/backend/.env with PostgreSQL settings"
                echo "3. Start backend: cd apps/backend && npm run dev"
                echo "4. Start UI: cd apps/ui && npm run dev"
                ;;
            *) echo "Invalid choice"; exit 1 ;;
        esac
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac 