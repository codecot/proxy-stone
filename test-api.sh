#!/bin/bash

# Base URL
BASE_URL="http://localhost:4000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Testing API endpoints..."

# Test basic health endpoint (no /api prefix)
echo -e "\n${GREEN}Testing /health${NC}"
curl -s "${BASE_URL}/health" | jq '.'

# Test detailed health endpoint
echo -e "\n${GREEN}Testing /api/health/detailed${NC}"
curl -s "${BASE_URL}/api/health/detailed" | jq '.'

# Test cache status
echo -e "\n${GREEN}Testing /api/cache/status${NC}"
curl -s "${BASE_URL}/api/cache/status" | jq '.'

# Test cluster status
echo -e "\n${GREEN}Testing /api/cluster/status${NC}"
curl -s "${BASE_URL}/api/cluster/status" | jq '.'

# Test metrics
echo -e "\n${GREEN}Testing /api/metrics${NC}"
curl -s "${BASE_URL}/api/metrics"

# Test request logging (expect 404 until enabled in server.ts)
echo -e "\n${GREEN}Testing /api/requests${NC} (expect 404 if not enabled)"
curl -s "${BASE_URL}/api/requests" | jq '.'

# Test performance analytics (expect 404 until enabled in server.ts)
echo -e "\n${GREEN}Testing /api/requests/analytics/performance${NC} (expect 404 if not enabled)"
curl -s "${BASE_URL}/api/requests/analytics/performance" | jq '.' 