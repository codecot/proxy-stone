#!/bin/bash

# Proxy Stone - Status Check Script

set -e

echo "📊 Proxy Stone Services Status"
echo "=============================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running."
    exit 1
fi

# Function to check configuration status
check_config() {
    local config_name=$1
    local compose_file=$2
    local ui_port=$3
    local api_port=$4
    local db_port=$5
    local admin_port=$6
    local redis_port=$7
    
    echo "🔍 $config_name Configuration:"
    echo "─────────────────────────────"
    
    # Check if any services are running
    RUNNING_SERVICES=$(docker-compose -f "$compose_file" ps --services --filter "status=running" 2>/dev/null || echo "")
    
    if [ -z "$RUNNING_SERVICES" ]; then
        echo "❌ No services running"
        echo ""
        return
    fi
    
    # Show service status
    echo "🟢 Running services:"
    docker-compose -f "$compose_file" ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}" 2>/dev/null || echo "  Error getting service details"
    
    echo ""
    echo "🌐 Access URLs:"
    
    # Check if services are actually responding
    if echo "$RUNNING_SERVICES" | grep -q "ui"; then
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ui_port" | grep -q "200\|404"; then
            echo "  ✅ Frontend UI:      http://localhost:$ui_port"
        else
            echo "  ⚠️  Frontend UI:      http://localhost:$ui_port (not responding)"
        fi
    fi
    
    if echo "$RUNNING_SERVICES" | grep -q "proxy"; then
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$api_port/health" | grep -q "200"; then
            echo "  ✅ Proxy API:        http://localhost:$api_port/health"
        else
            echo "  ⚠️  Proxy API:        http://localhost:$api_port/health (not responding)"
        fi
    fi
    
    if [ -n "$db_port" ] && echo "$RUNNING_SERVICES" | grep -qE "(mysql|postgres)"; then
        echo "  🗄️  Database:         localhost:$db_port"
    fi
    
    if [ -n "$admin_port" ] && echo "$RUNNING_SERVICES" | grep -qE "(adminer|pgadmin)"; then
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$admin_port" | grep -q "200\|404"; then
            echo "  ✅ DB Admin UI:      http://localhost:$admin_port"
        else
            echo "  ⚠️  DB Admin UI:      http://localhost:$admin_port (not responding)"
        fi
    fi
    
    if echo "$RUNNING_SERVICES" | grep -q "redis-commander"; then
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$redis_port" | grep -q "200\|404"; then
            echo "  ✅ Redis Commander:  http://localhost:$redis_port"
        else
            echo "  ⚠️  Redis Commander:  http://localhost:$redis_port (not responding)"
        fi
    fi
    
    echo ""
}

# Check all configurations
check_config "SQLite" "docker-compose.sqlite.yml" "3000" "4000" "" "" "8081"
check_config "MySQL" "docker-compose.mysql.yml" "3000" "4000" "3306" "8080" "8081"
check_config "PostgreSQL" "docker-compose.postgresql.yml" "3000" "4000" "5432" "5050" "8081"

# Show overall Docker stats
echo "🐳 Docker Overview:"
echo "─────────────────"
PROXY_CONTAINERS=$(docker ps --filter "name=proxy" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | tail -n +2)

if [ -n "$PROXY_CONTAINERS" ]; then
    echo "$PROXY_CONTAINERS"
else
    echo "No proxy-related containers running"
fi

echo ""

# Show resource usage
echo "💾 Resource Usage:"
echo "─────────────────"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker ps --filter "name=proxy" -q) 2>/dev/null || echo "No containers to show stats for"

echo ""
echo "💡 Quick Commands:"
echo "─────────────────"
echo "  Start SQLite:     ./scripts/start-sqlite.sh -d"
echo "  Start MySQL:      ./scripts/start-mysql.sh -d"
echo "  Start PostgreSQL: ./scripts/start-postgresql.sh -d"
echo "  Stop All:         ./scripts/stop-all.sh"
echo "  View Logs:        docker-compose -f docker-compose.[config].yml logs -f" 