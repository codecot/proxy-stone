#!/bin/bash

# Backend startup script with PostgreSQL configuration

echo "🚀 Starting Proxy Stone Backend with PostgreSQL"
echo "=============================================="

# Default PostgreSQL configuration from CLAUDE.md
DB_TYPE="postgresql"
DB_HOST="localhost"
DB_PORT="5434"
DB_NAME="proxy_stone"
DB_USER="proxy_user"
DB_PASSWORD="proxy_pass"
PORT="4401"
HOST="127.0.0.1"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --db-host)
            DB_HOST="$2"
            shift 2
            ;;
        --db-port)
            DB_PORT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--port PORT] [--host HOST] [--db-host DB_HOST] [--db-port DB_PORT]"
            exit 1
            ;;
    esac
done

echo "📊 Configuration:"
echo "   - Server: $HOST:$PORT"
echo "   - Database: $DB_TYPE"
echo "   - DB Connection: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Run the backend
npm run dev -- \
    --port "$PORT" \
    --host "$HOST" \
    --db-type "$DB_TYPE" \
    --db-host "$DB_HOST" \
    --db-port "$DB_PORT" \
    --db-name "$DB_NAME" \
    --db-user "$DB_USER" \
    --db-password "$DB_PASSWORD" \
    --enable-file-cache