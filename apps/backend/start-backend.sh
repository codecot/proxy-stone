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
CLUSTER_IP=""
CLUSTER_PORT=""
CLUSTER_ID="default-cluster"
NODE_ID=""

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
        --cluster-ip)
            CLUSTER_IP="$2"
            shift 2
            ;;
        --cluster-port)
            CLUSTER_PORT="$2"
            shift 2
            ;;
        --cluster-id)
            CLUSTER_ID="$2"
            shift 2
            ;;
        --node-id)
            NODE_ID="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--port PORT] [--host HOST] [--db-host DB_HOST] [--db-port DB_PORT]"
            echo "          [--cluster-ip IP] [--cluster-port PORT] [--cluster-id ID] [--node-id ID]"
            exit 1
            ;;
    esac
done

echo "📊 Configuration:"
echo "   - Server: $HOST:$PORT"
echo "   - Database: $DB_TYPE"
echo "   - DB Connection: $DB_HOST:$DB_PORT/$DB_NAME"
if [ -n "$CLUSTER_IP" ]; then
    echo "   - Cluster Mode: Worker"
    echo "   - Coordinator: $CLUSTER_IP${CLUSTER_PORT:+:$CLUSTER_PORT}"
else
    echo "   - Cluster Mode: Coordinator"
fi
echo "   - Cluster ID: $CLUSTER_ID"
echo ""

# Build cluster arguments
CLUSTER_ARGS=""
if [ -n "$CLUSTER_IP" ]; then
    CLUSTER_ARGS="$CLUSTER_ARGS --cluster-ip $CLUSTER_IP"
fi
if [ -n "$CLUSTER_PORT" ]; then
    CLUSTER_ARGS="$CLUSTER_ARGS --cluster-port $CLUSTER_PORT"
fi
if [ -n "$CLUSTER_ID" ]; then
    CLUSTER_ARGS="$CLUSTER_ARGS --cluster-id $CLUSTER_ID"
fi
if [ -n "$NODE_ID" ]; then
    CLUSTER_ARGS="$CLUSTER_ARGS --node-id $NODE_ID"
fi

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
    --enable-file-cache \
    $CLUSTER_ARGS