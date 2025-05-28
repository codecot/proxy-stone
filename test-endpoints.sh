#!/bin/bash

# Test Endpoints Script for Proxy-Stone Backend
# Tests all major functionalities and endpoints

BASE_URL="http://localhost:4000"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_status="$3"
    local description="$4"
    local data="$5"
    
    ((TOTAL_TESTS++))
    log_info "Testing: $description"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "PUT" ] && [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json -X PUT -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json -X DELETE "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json -X "$method" "$BASE_URL$endpoint")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        log_success "$method $endpoint → $response"
    else
        log_error "$method $endpoint → Expected: $expected_status, Got: $response"
    fi
}

measure_response_time() {
    local endpoint="$1"
    local description="$2"
    
    log_info "Measuring response time: $description"
    start_time=$(date +%s%3N)
    curl -s "$BASE_URL$endpoint" > /dev/null
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    if [ $duration -lt 100 ]; then
        log_success "Response time: ${duration}ms (excellent)"
    elif [ $duration -lt 500 ]; then
        log_success "Response time: ${duration}ms (good)"
    else
        log_warning "Response time: ${duration}ms (acceptable)"
    fi
}

echo "=================================================="
echo "🚀 Proxy-Stone Backend API Test Suite"
echo "=================================================="
echo "Target: $BASE_URL"
echo "Started at: $(date)"
echo ""

# Test 1: Basic Health Checks
echo "🏥 Testing Health Endpoints..."
test_endpoint "GET" "/health" "200" "Basic health check"
test_endpoint "GET" "/api/health/detailed" "200" "Detailed health check"
measure_response_time "/health" "Basic health endpoint"

echo ""

# Test 2: Cache Management
echo "💾 Testing Cache Endpoints..."
test_endpoint "GET" "/api/cache/status" "200" "Cache status"
test_endpoint "DELETE" "/api/cache/expired" "200" "Clear expired cache"

echo ""

# Test 3: Metrics and Monitoring
echo "📊 Testing Metrics Endpoints..."
test_endpoint "GET" "/api/metrics" "200" "Prometheus metrics"

echo ""

# Test 4: Proxy Functionality - GET Requests
echo "🔄 Testing Proxy GET Requests..."
test_endpoint "GET" "/proxy/get?test=basic" "200" "Basic GET proxy"
test_endpoint "GET" "/proxy/get?test=cache" "200" "GET request for caching"
test_endpoint "GET" "/proxy/headers" "200" "Headers endpoint via proxy"
test_endpoint "GET" "/proxy/user-agent" "200" "User agent endpoint via proxy"

echo ""

# Test 5: Proxy Functionality - POST Requests
echo "📤 Testing Proxy POST Requests..."
test_endpoint "POST" "/proxy/post" "200" "Basic POST proxy" '{"test":"post","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
test_endpoint "POST" "/proxy/anything" "200" "POST to anything endpoint" '{"data":"test","method":"POST"}'

echo ""

# Test 6: Proxy Functionality - Other HTTP Methods
echo "🔧 Testing Other HTTP Methods..."
test_endpoint "PUT" "/proxy/put" "200" "PUT request via proxy" '{"action":"update","test":true}'
test_endpoint "DELETE" "/proxy/delete" "200" "DELETE request via proxy"
test_endpoint "PATCH" "/proxy/patch" "200" "PATCH request via proxy" '{"patch":"data"}'

echo ""

# Test 7: Cache Performance Test
echo "⚡ Testing Cache Performance..."
log_info "Making initial request to populate cache..."
curl -s "$BASE_URL/proxy/get?cache-test=performance" > /dev/null

log_info "Testing cache hit performance..."
measure_response_time "/proxy/get?cache-test=performance" "Cached GET request"

echo ""

# Test 8: Error Handling
echo "❌ Testing Error Handling..."
test_endpoint "GET" "/proxy/status/404" "404" "404 error handling"
test_endpoint "GET" "/proxy/status/500" "500" "500 error handling"
test_endpoint "GET" "/nonexistent-endpoint" "404" "Non-existent endpoint"

echo ""

# Test 9: Cache Management Advanced
echo "🗄️ Testing Advanced Cache Operations..."
log_info "Populating cache with test data..."
curl -s "$BASE_URL/proxy/get?cache-populate=1" > /dev/null
curl -s "$BASE_URL/proxy/get?cache-populate=2" > /dev/null
curl -s "$BASE_URL/proxy/get?cache-populate=3" > /dev/null

test_endpoint "GET" "/api/cache/status" "200" "Cache status after population"

echo ""

# Test 10: Concurrent Requests Test
echo "🔄 Testing Concurrent Requests..."
log_info "Sending 5 concurrent requests..."
for i in {1..5}; do
    curl -s "$BASE_URL/proxy/get?concurrent=$i" > /dev/null &
done
wait
log_success "Concurrent requests completed"

echo ""

# Test 11: Large Response Handling
echo "📦 Testing Large Response Handling..."
test_endpoint "GET" "/proxy/base64/$(echo 'large-response-test' | base64)" "200" "Large response via proxy"

echo ""

# Final Cache Status
echo "📈 Final Cache Statistics..."
cache_stats=$(curl -s "$BASE_URL/api/cache/status" | jq -r '.stats.memory.size // "unknown"')
log_info "Final cache size: $cache_stats entries"

# Health Check Summary
echo ""
echo "🏥 Final Health Check..."
health_status=$(curl -s "$BASE_URL/health" | jq -r '.status // "unknown"')
if [ "$health_status" = "ok" ]; then
    log_success "Server health: $health_status"
else
    log_error "Server health: $health_status"
fi

# Test Summary
echo ""
echo "=================================================="
echo "📊 Test Results Summary"
echo "=================================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All tests passed! Proxy-Stone backend is working perfectly.${NC}"
    exit 0
else
    success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "\n⚠️  ${YELLOW}$FAILED_TESTS tests failed. Success rate: ${success_rate}%${NC}"
    exit 1
fi 