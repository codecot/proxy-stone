# Enhanced Request Logging & Observability System

The proxy server includes a **comprehensive request logging and observability system** with enhanced **SQLite database storage**, **advanced analytics**, and **powerful REST API interfaces** for monitoring all API requests that pass through the proxy.

## ✨ Enhanced Features

- **📊 Advanced SQLite Database**: Enhanced schema with backend tracking, performance metrics, and request context
- **🎯 Backend Service Tracking**: Monitor which backend services are being used
- **⚡ Performance Analytics**: Response times, percentiles, and bottleneck identification
- **📈 Cache Analytics**: Hit rates, TTL effectiveness, and cache performance insights
- **📏 Data Size Analysis**: Request/response size tracking and bandwidth monitoring
- **🚨 Error Analytics**: Comprehensive error tracking and analysis
- **🔍 Enhanced Filtering**: Filter by method, status, URL, backend, date range, cache hits
- **📈 Real-time Statistics**: Cache hit rates, response times, top URLs, backend performance
- **🎛️ Management Interface**: View, filter, and analyze request logs via comprehensive REST API
- **⚡ High Performance**: Indexed database queries for fast searches across all dimensions
- **🧹 Auto Cleanup**: Automatic removal of old logs (configurable)
- **💾 Persistent Storage**: Survives service restarts with full data retention

## 🚀 Quick Start

### Enable Enhanced Request Logging

```bash
# Method 1: CLI Arguments (Recommended)
npm run dev -- --enable-request-logging --request-log-db ./logs/requests.db

# Method 2: Environment Variables
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_DB_PATH=./logs/requests.db
npm run dev
```

### View Enhanced Analytics

```bash
# Get performance analytics
curl http://localhost:3000/requests/analytics/performance | jq

# Get cache analytics
curl http://localhost:3000/requests/analytics/cache | jq

# Get error analytics
curl http://localhost:3000/requests/analytics/errors | jq

# Get data size analytics
curl http://localhost:3000/requests/analytics/data-size | jq

# Get requests by backend host
curl http://localhost:3000/requests/by-backend/https%3A%2F%2Fapi.example.com | jq
```

## 📊 Enhanced Data Capture

Each request now logs comprehensive details including:

```json
{
  "id": 1,
  "timestamp": "2025-05-24 06:20:59",
  "method": "GET",
  "originalUrl": "/api/users/123",
  "targetUrl": "https://api.backend.com/users/123?include=profile",

  // 🎯 Enhanced Backend Tracking
  "backendHost": "https://api.backend.com",
  "backendPath": "/users/123?include=profile",

  "statusCode": 200,
  "responseTime": 952,

  // ⚡ Enhanced Performance Metrics
  "processingTime": 952,
  "dnsTiming": null,
  "connectTiming": null,
  "ttfbTiming": null,

  "requestHeaders": "{\"authorization\":\"Bearer token\"}",
  "responseHeaders": "{\"content-type\":\"application/json\"}",
  "requestBody": null,
  "responseBody": "{\"user\":{\"id\":123,\"name\":\"John\"}}",

  // 📝 Enhanced Parameter Tracking
  "queryParams": "{\"include\":\"profile\"}",
  "routeParams": "{\"id\":\"123\"}",

  "cacheHit": false,
  "cacheKey": "GET:https://api.backend.com/users/123:auth:bearer...",
  "cacheTTL": 300,

  "userAgent": "curl/8.5.0",
  "clientIp": "127.0.0.1",
  "errorMessage": null,

  // 📏 Enhanced Request Context
  "requestSize": 245,
  "responseSize": 1024,
  "contentType": "application/json",
  "responseContentType": "application/json"
}
```

## 🛠️ Enhanced Configuration Options

| CLI Argument               | Environment Variable     | Default              | Description            |
| -------------------------- | ------------------------ | -------------------- | ---------------------- |
| `--enable-request-logging` | `ENABLE_REQUEST_LOGGING` | `false`              | Enable request logging |
| `--request-log-db <path>`  | `REQUEST_LOG_DB_PATH`    | `./logs/requests.db` | Database file path     |

## 📡 Enhanced REST API Endpoints

### **🎯 Backend Analytics**

#### Get Requests by Backend Host

```bash
GET /requests/by-backend/:host
```

**Example:**

```bash
# Get all requests to a specific backend
curl "http://localhost:3000/requests/by-backend/https%3A%2F%2Fapi.example.com"
```

### **⚡ Performance Analytics**

#### Get Performance Analytics

```bash
GET /requests/analytics/performance
```

Returns comprehensive performance metrics:

```json
{
  "summary": {
    "totalRequests": 1500,
    "avgResponseTime": 423,
    "medianResponseTime": 350,
    "percentile95ResponseTime": 1200
  },
  "slowestRequests": [
    {
      "targetUrl": "https://api.example.com/heavy-query",
      "responseTime": 2500,
      "timestamp": "2025-05-24T06:20:59Z",
      "method": "POST"
    }
  ],
  "backendPerformance": {
    "https://api.example.com": {
      "count": 950,
      "avgTime": 380
    },
    "https://auth.service.com": {
      "count": 550,
      "avgTime": 120
    }
  }
}
```

### **📈 Cache Analytics**

#### Get Cache Analytics

```bash
GET /requests/analytics/cache
```

Returns detailed cache performance:

```json
{
  "summary": {
    "totalRequests": 1500,
    "cacheHits": 680,
    "cacheMisses": 820,
    "hitRate": 45.33
  },
  "ttlAnalysis": {
    "300s": { "hits": 250, "misses": 150, "hitRate": 62.5 },
    "600s": { "hits": 430, "misses": 670, "hitRate": 39.1 }
  },
  "topCachedEndpoints": [
    { "url": "https://api.example.com/config", "count": 45 },
    { "url": "https://api.example.com/users", "count": 32 }
  ],
  "cacheTimeSavings": {
    "estimatedTimeSaved": 245600,
    "requestsServedFromCache": 680
  }
}
```

### **📏 Data Size Analytics**

#### Get Data Size Analytics

```bash
GET /requests/analytics/data-size
```

Returns bandwidth and size metrics:

```json
{
  "summary": {
    "totalRequests": 1500,
    "totalRequestSize": 2457600,
    "totalResponseSize": 15728640,
    "avgRequestSize": 1638,
    "avgResponseSize": 10486,
    "totalDataTransfer": 18186240
  },
  "largestRequests": [
    {
      "url": "https://api.example.com/upload",
      "method": "POST",
      "requestSize": 52428800,
      "responseSize": 1024
    }
  ],
  "sizeDistribution": {
    "smallRequests": 850,
    "mediumRequests": 580,
    "largeRequests": 70
  }
}
```

### **🚨 Error Analytics**

#### Get Error Analytics

```bash
GET /requests/analytics/errors
```

Returns comprehensive error analysis:

```json
{
  "summary": {
    "totalRequests": 1500,
    "totalErrors": 95,
    "errorRate": 6.33,
    "serverErrors": 12,
    "clientErrors": 83
  },
  "errorsByStatus": {
    "404": 45,
    "401": 28,
    "500": 12,
    "403": 10
  },
  "errorsByBackend": {
    "https://api.example.com": 75,
    "https://auth.service.com": 20
  },
  "topErrorEndpoints": [
    { "url": "https://api.example.com/missing-endpoint", "count": 25 },
    { "url": "https://api.example.com/auth-required", "count": 18 }
  ]
}
```

### **📊 Legacy Endpoints (Enhanced)**

All existing endpoints have been enhanced with the new data:

```bash
# Get all requests (now with enhanced data)
curl http://localhost:3000/requests | jq

# Get request statistics (enhanced)
curl http://localhost:3000/requests/stats | jq

# All existing filtering works with new fields
curl "http://localhost:3000/requests?method=GET&cacheHit=true"
```

## 🔍 Enhanced Database Schema

The SQLite database now uses this comprehensive schema:

```sql
CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  method TEXT NOT NULL,
  original_url TEXT NOT NULL,
  target_url TEXT NOT NULL,

  -- Enhanced backend tracking
  backend_host TEXT,
  backend_path TEXT,

  status_code INTEGER NOT NULL,
  response_time REAL NOT NULL,

  -- Enhanced performance metrics
  dns_timing REAL,
  connect_timing REAL,
  ttfb_timing REAL,
  processing_time REAL,

  request_headers TEXT,
  response_headers TEXT,
  request_body TEXT,
  response_body TEXT,

  -- Enhanced parameter tracking
  query_params TEXT,
  route_params TEXT,

  cache_hit BOOLEAN DEFAULT FALSE,
  cache_key TEXT,
  cache_ttl INTEGER,

  user_agent TEXT,
  client_ip TEXT,
  error_message TEXT,

  -- Enhanced request context
  request_size INTEGER,
  response_size INTEGER,
  content_type TEXT,
  response_content_type TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced indexes for performance
CREATE INDEX idx_timestamp ON requests(timestamp);
CREATE INDEX idx_method ON requests(method);
CREATE INDEX idx_status_code ON requests(status_code);
CREATE INDEX idx_target_url ON requests(target_url);
CREATE INDEX idx_backend_host ON requests(backend_host);
CREATE INDEX idx_cache_key ON requests(cache_key);
CREATE INDEX idx_cache_hit ON requests(cache_hit);
CREATE INDEX idx_response_time ON requests(response_time);
```

## 📈 Advanced Use Cases

### **Backend Service Monitoring**

```bash
# Monitor performance by backend service
curl "http://localhost:3000/requests/analytics/performance" | jq '.backendPerformance'

# Get all requests to a specific backend
curl "http://localhost:3000/requests/by-backend/$(echo 'https://api.example.com' | jq -rR @uri)"

# Find slowest backend services
curl "http://localhost:3000/requests/analytics/performance" | jq '.backendPerformance | to_entries | sort_by(.value.avgTime) | reverse'
```

### **Cache Optimization**

```bash
# Analyze cache effectiveness by TTL
curl "http://localhost:3000/requests/analytics/cache" | jq '.ttlAnalysis'

# Find endpoints that should be cached but aren't
curl "http://localhost:3000/requests?cacheHit=false&limit=100" | jq '.requests | group_by(.targetUrl) | map({url: .[0].targetUrl, count: length}) | sort_by(.count) | reverse'

# Calculate cache savings
curl "http://localhost:3000/requests/analytics/cache" | jq '.cacheTimeSavings'
```

### **Performance Bottleneck Identification**

```bash
# Find slowest endpoints
curl "http://localhost:3000/requests/analytics/performance" | jq '.slowestRequests'

# Analyze response time percentiles
curl "http://localhost:3000/requests/analytics/performance" | jq '.summary'

# Monitor data transfer efficiency
curl "http://localhost:3000/requests/analytics/data-size" | jq '.sizeDistribution'
```

### **Error Pattern Analysis**

```bash
# Monitor error patterns by backend
curl "http://localhost:3000/requests/analytics/errors" | jq '.errorsByBackend'

# Track error trends over time
curl "http://localhost:3000/requests?status=500&limit=50" | jq '.requests | group_by(.timestamp[:10]) | map({date: .[0].timestamp[:10], errors: length})'

# Identify problematic endpoints
curl "http://localhost:3000/requests/analytics/errors" | jq '.topErrorEndpoints'
```

## 🚀 Production Deployment

### **High-Volume Production Configuration**

```bash
# High-performance production config with enhanced logging
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_DB_PATH=/var/log/proxy/requests.db
export CACHE_TTL=3600

# Start with optimized settings
npm start -- --enable-request-logging --request-log-db /var/log/proxy/requests.db
```

### **Development with Full Analytics**

```bash
npm run dev -- \
  --enable-request-logging \
  --enable-file-cache \
  --request-log-db ./logs/requests.db \
  --file-cache-dir ./cache \
  --cache-ttl 300
```

### **Docker Configuration with Enhanced Logging**

```yaml
# docker-compose.yml
environment:
  - ENABLE_REQUEST_LOGGING=true
  - REQUEST_LOG_DB_PATH=/app/logs/requests.db
volumes:
  - ./logs:/app/logs
  - ./analytics:/app/analytics
ports:
  - '3000:3000'
```

## 📊 Analytics Dashboard Integration

### **Custom Dashboard Data Sources**

```javascript
// Example: Real-time analytics dashboard
async function getComprehensiveDashboard() {
  const [performance, cache, errors, dataSize] = await Promise.all([
    fetch('/requests/analytics/performance').then((r) => r.json()),
    fetch('/requests/analytics/cache').then((r) => r.json()),
    fetch('/requests/analytics/errors').then((r) => r.json()),
    fetch('/requests/analytics/data-size').then((r) => r.json()),
  ]);

  return {
    performance,
    cache,
    errors,
    dataSize,
    timestamp: new Date().toISOString(),
  };
}

// Backend service health monitoring
async function getBackendHealth() {
  const performance = await fetch('/requests/analytics/performance').then((r) => r.json());
  const errors = await fetch('/requests/analytics/errors').then((r) => r.json());

  return Object.keys(performance.backendPerformance).map((backend) => ({
    backend,
    avgResponseTime: performance.backendPerformance[backend].avgTime,
    errorCount: errors.errorsByBackend[backend] || 0,
    requestCount: performance.backendPerformance[backend].count,
    healthScore: calculateHealthScore(
      performance.backendPerformance[backend].avgTime,
      errors.errorsByBackend[backend] || 0,
      performance.backendPerformance[backend].count
    ),
  }));
}
```

### **Prometheus/Grafana Integration**

```bash
# Export metrics for Prometheus
curl "http://localhost:3000/requests/analytics/performance" | jq -r '
  .backendPerformance | to_entries[] |
  "proxy_backend_response_time_avg{backend=\"\(.key)\"} \(.value.avgTime)\n" +
  "proxy_backend_request_count{backend=\"\(.key)\"} \(.value.count)"
'

# Cache metrics for monitoring
curl "http://localhost:3000/requests/analytics/cache" | jq -r '
  "proxy_cache_hit_rate \(.summary.hitRate)\n" +
  "proxy_cache_hits_total \(.summary.cacheHits)\n" +
  "proxy_cache_misses_total \(.summary.cacheMisses)"
'
```

## 🔧 Advanced Troubleshooting

### **Performance Analysis**

```bash
# Identify slow backends
sqlite3 logs/requests.db "
  SELECT backend_host, AVG(response_time) as avg_time, COUNT(*) as count
  FROM requests
  WHERE backend_host IS NOT NULL
  GROUP BY backend_host
  ORDER BY avg_time DESC;
"

# Find cache inefficiencies
sqlite3 logs/requests.db "
  SELECT target_url, cache_ttl,
         SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as hits,
         SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) as misses,
         ROUND(100.0 * SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as hit_rate
  FROM requests
  GROUP BY target_url, cache_ttl
  HAVING COUNT(*) > 10
  ORDER BY hit_rate ASC;
"
```

### **Data Analysis**

```bash
# Analyze request patterns
sqlite3 logs/requests.db "
  SELECT
    strftime('%Y-%m-%d %H:00', timestamp) as hour,
    COUNT(*) as requests,
    AVG(response_time) as avg_response_time,
    SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as cache_hits
  FROM requests
  WHERE timestamp > datetime('now', '-24 hours')
  GROUP BY hour
  ORDER BY hour;
"

# Monitor data usage
sqlite3 logs/requests.db "
  SELECT
    backend_host,
    SUM(request_size) as total_request_bytes,
    SUM(response_size) as total_response_bytes,
    COUNT(*) as request_count,
    AVG(response_size) as avg_response_size
  FROM requests
  WHERE backend_host IS NOT NULL
    AND request_size IS NOT NULL
    AND response_size IS NOT NULL
  GROUP BY backend_host
  ORDER BY total_response_bytes DESC;
"
```

## 💡 Best Practices

### **Performance Optimization**

1. **Regular Cleanup**: Set up automated cleanup of old logs
2. **Index Optimization**: Monitor query performance and add indexes as needed
3. **Batch Analysis**: Use analytics endpoints for dashboards rather than direct SQL
4. **Cache Monitoring**: Use cache analytics to optimize TTL settings

### **Security Considerations**

1. **Data Sanitization**: Request/response bodies may contain sensitive data
2. **Access Control**: Secure analytics endpoints in production
3. **Log Rotation**: Implement log rotation for disk space management
4. **Compliance**: Consider GDPR implications of IP address logging

### **Monitoring Integration**

```bash
# Health check with analytics
curl -f "http://localhost:3000/requests/analytics/performance" > /dev/null && echo "Analytics API healthy" || echo "Analytics API down"

# Automated alerts based on error rates
ERROR_RATE=$(curl -s "http://localhost:3000/requests/analytics/errors" | jq '.summary.errorRate')
if (( $(echo "$ERROR_RATE > 10" | bc -l) )); then
  echo "High error rate detected: $ERROR_RATE%"
  # Send alert
fi
```

This enhanced logging and observability system provides comprehensive insights into your proxy's performance, backend service health, cache effectiveness, and error patterns, enabling data-driven optimization and proactive monitoring.
