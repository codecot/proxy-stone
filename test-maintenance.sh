#!/bin/bash

echo "🧪 Testing Cluster Maintenance Mode"
echo "=================================="

# Test normal serving mode
echo "1. Testing normal serving mode..."
curl -s http://localhost:4000/proxy/get | jq '.url' || echo "❌ Request failed"

echo ""
echo "2. Checking cluster status..."
curl -s http://localhost:4000/api/cluster/status | jq '.serviceStatus // "Service status not available"'

echo ""
echo "3. Putting cluster in maintenance mode..."
curl -s -X POST http://localhost:4000/api/cluster/disable-serving | jq '.message // "Endpoint not available"'

echo ""
echo "4. Testing request during maintenance..."
curl -s http://localhost:4000/proxy/get | jq '.error, .message, .mode' || echo "❌ Request failed"

echo ""
echo "5. Checking response headers..."
curl -s -I http://localhost:4000/proxy/get | grep -E "(HTTP|Retry-After|X-Service-Mode)"

echo ""
echo "6. Re-enabling serving..."
curl -s -X POST http://localhost:4000/api/cluster/enable-serving | jq '.message // "Endpoint not available"'

echo ""
echo "7. Testing normal serving after re-enable..."
curl -s http://localhost:4000/proxy/get | jq '.url' || echo "❌ Request failed"

echo ""
echo "✅ Maintenance mode test complete!" 