# 📊 Enable Request Analytics & Monitoring

## 🎯 **Overview**

Your proxy already has a **comprehensive request analytics and monitoring system** built-in! It provides detailed insights into API usage, performance, caching efficiency, error tracking, and much more. Here's how to enable and use all these powerful features.

## 🚀 **Quick Enable**

### **1. Start with Request Logging Enabled**

```bash
# Enable request logging with environment variables
cd apps/backend
ENABLE_REQUEST_LOGGING=true \
REQUEST_LOG_DB_PATH=./logs/requests.db \
npm run dev
```

### **2. Alternative: Enable via CLI**

```bash
# Enable via command line arguments
npm run dev -- --enable-request-logging --request-log-db ./logs/requests.db
```

### **3. Production Environment Variables**

```bash
# Add to your .env file or deployment config
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_DB_PATH=./logs/requests.db

# Optional: Configure storage type
export REQUEST_LOG_STORAGE_TYPE=sqlite  # or mysql, postgresql
export REQUEST_LOG_STORAGE_HOST=localhost
export REQUEST_LOG_STORAGE_PORT=5432
export REQUEST_LOG_STORAGE_DATABASE=proxy_analytics
```

## 📈 **Analytics API Endpoints**

Once enabled, you have access to comprehensive analytics:

### **🎯 Performance Analytics**

```bash
GET /api/requests/analytics/performance
```

**Response Example:**

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
      "timestamp": "2025-05-28T23:06:59Z",
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

### **💾 Cache Analytics**

```bash
GET /api/requests/analytics/cache
```

**Response Example:**

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

### **❌ Error Analytics**

```bash
GET /api/requests/analytics/errors
```

**Response Example:**

```json
{
  "summary": {
    "totalRequests": 1500,
    "totalErrors": 45,
    "errorRate": 3.0,
    "serverErrors": 12,
    "clientErrors": 33
  },
  "errorsByStatus": {
    "404": 20,
    "500": 8,
    "503": 4,
    "400": 13
  },
  "errorsByBackend": {
    "https://api.example.com": 30,
    "https://auth.service.com": 15
  },
  "topErrorEndpoints": [
    { "url": "https://api.example.com/broken", "count": 15 },
    { "url": "https://api.example.com/timeout", "count": 8 }
  ],
  "recentErrors": [
    {
      "url": "https://api.example.com/users/123",
      "method": "GET",
      "statusCode": 404,
      "errorMessage": "User not found",
      "timestamp": "2025-05-28T23:05:30Z",
      "responseTime": 120
    }
  ]
}
```

### **📊 Data Size Analytics**

```bash
GET /api/requests/analytics/data-size
```

**Response Example:**

```json
{
  "summary": {
    "totalRequests": 1500,
    "totalRequestSize": 15720000,
    "totalResponseSize": 89400000,
    "avgRequestSize": 10480,
    "avgResponseSize": 59600
  },
  "largestRequests": [
    {
      "url": "https://api.example.com/upload",
      "requestSize": 5242880,
      "timestamp": "2025-05-28T23:04:15Z"
    }
  ],
  "largestResponses": [
    {
      "url": "https://api.example.com/export/data",
      "responseSize": 8388608,
      "timestamp": "2025-05-28T23:03:45Z"
    }
  ]
}
```

## 🔍 **Request Filtering & Search**

### **Get All Requests**

```bash
GET /api/requests
```

### **Filter by Method**

```bash
GET /api/requests?method=POST
GET /api/requests?method=GET
```

### **Filter by Status Code**

```bash
GET /api/requests?status=500
GET /api/requests?status=404
```

### **Filter by URL Pattern**

```bash
GET /api/requests?url=api.example.com/users
```

### **Filter by Date Range**

```bash
GET /api/requests?dateFrom=2025-05-28&dateTo=2025-05-29
```

### **Filter by Cache Status**

```bash
GET /api/requests?cacheHit=true
GET /api/requests?cacheHit=false
```

### **Backend-Specific Analytics**

```bash
GET /api/requests/by-backend/https%3A%2F%2Fapi.example.com
```

## 📱 **Health & Monitoring**

### **System Health Check**

```bash
GET /health
```

**Response includes request logger status:**

```json
{
  "status": "ok",
  "services": {
    "requestLogger": {
      "status": "ok",
      "enabled": true,
      "stats": {
        "enabled": true,
        "total": 1500,
        "errors": 45,
        "avgDuration": 423,
        "errorRate": 3.0,
        "storageType": "sqlite"
      }
    }
  }
}
```

### **Prometheus Metrics**

```bash
GET /api/metrics
```

Returns Prometheus-compatible metrics for:

- Request counts by method/status
- Response time histograms
- Cache hit/miss ratios
- Error rates by endpoint

## 🛠 **Database Storage Options**

### **SQLite (Default)**

```bash
# Simple file-based storage
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_DB_PATH=./logs/requests.db
```

### **MySQL**

```bash
# High-performance MySQL storage
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_STORAGE_TYPE=mysql
export REQUEST_LOG_STORAGE_HOST=localhost
export REQUEST_LOG_STORAGE_PORT=3306
export REQUEST_LOG_STORAGE_DATABASE=proxy_analytics
export REQUEST_LOG_STORAGE_USER=analytics_user
export REQUEST_LOG_STORAGE_PASSWORD=secure_password
```

### **PostgreSQL**

```bash
# Advanced PostgreSQL analytics
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_STORAGE_TYPE=postgresql
export REQUEST_LOG_STORAGE_HOST=localhost
export REQUEST_LOG_STORAGE_PORT=5432
export REQUEST_LOG_STORAGE_DATABASE=proxy_analytics
export REQUEST_LOG_STORAGE_USER=analytics_user
export REQUEST_LOG_STORAGE_PASSWORD=secure_password
```

## 📊 **Analytics Use Cases**

### **1. API Performance Monitoring**

```bash
# Monitor slowest endpoints
curl -s "http://localhost:4000/api/requests/analytics/performance" | \
  jq '.slowestRequests | .[] | select(.responseTime > 1000)'

# Check backend performance
curl -s "http://localhost:4000/api/requests/analytics/performance" | \
  jq '.backendPerformance'
```

### **2. Cache Optimization**

```bash
# Identify low cache hit rates
curl -s "http://localhost:4000/api/requests/analytics/cache" | \
  jq '.ttlAnalysis | to_entries | .[] | select(.value.hitRate < 50)'

# Find most cached endpoints
curl -s "http://localhost:4000/api/requests/analytics/cache" | \
  jq '.topCachedEndpoints | .[:5]'
```

### **3. Error Analysis**

```bash
# Find error hotspots
curl -s "http://localhost:4000/api/requests/analytics/errors" | \
  jq '.topErrorEndpoints | .[] | select(.count > 5)'

# Recent error analysis
curl -s "http://localhost:4000/api/requests/analytics/errors" | \
  jq '.recentErrors | .[:10]'
```

### **4. Traffic Analysis**

```bash
# High-traffic endpoints
curl -s "http://localhost:4000/api/requests/analytics/performance" | \
  jq '.backendPerformance | to_entries | sort_by(.value.count) | reverse | .[:10]'
```

## 🚨 **Automated Monitoring Scripts**

### **Performance Alert Script**

```bash
#!/bin/bash
# performance-monitor.sh

# Check average response time
avg_time=$(curl -s "http://localhost:4000/api/requests/analytics/performance" | \
  jq -r '.summary.avgResponseTime')

if (( $(echo "$avg_time > 1000" | bc -l) )); then
  echo "⚠️  High average response time: ${avg_time}ms"
  # Send alert (webhook, email, etc.)
fi

# Check error rate
error_rate=$(curl -s "http://localhost:4000/api/requests/analytics/errors" | \
  jq -r '.summary.errorRate')

if (( $(echo "$error_rate > 5.0" | bc -l) )); then
  echo "🚨 High error rate: ${error_rate}%"
  # Send alert
fi
```

### **Cache Efficiency Monitor**

```bash
#!/bin/bash
# cache-monitor.sh

hit_rate=$(curl -s "http://localhost:4000/api/requests/analytics/cache" | \
  jq -r '.summary.hitRate')

if (( $(echo "$hit_rate < 30" | bc -l) )); then
  echo "📉 Low cache hit rate: ${hit_rate}%"
  echo "Consider adjusting cache TTL or cache rules"
fi
```

## 🔧 **Advanced Configuration**

### **Data Retention**

```bash
# Automatic cleanup of old logs (30 days)
export REQUEST_LOG_RETENTION_DAYS=30

# Manual cleanup
curl -X POST "http://localhost:4000/api/requests/cleanup?days=30"
```

### **Custom Analytics Dashboard**

```javascript
// dashboard.js - Real-time analytics
async function getDashboardData() {
  const [performance, cache, errors, health] = await Promise.all([
    fetch("/api/requests/analytics/performance").then((r) => r.json()),
    fetch("/api/requests/analytics/cache").then((r) => r.json()),
    fetch("/api/requests/analytics/errors").then((r) => r.json()),
    fetch("/health").then((r) => r.json()),
  ]);

  return {
    performance,
    cache,
    errors,
    health: health.services.requestLogger,
    timestamp: new Date().toISOString(),
  };
}

// Update dashboard every 30 seconds
setInterval(async () => {
  const data = await getDashboardData();
  updateDashboard(data);
}, 30000);
```

## 🎉 **Benefits You Get**

✅ **API Performance Insights**: Identify slow endpoints and bottlenecks  
✅ **Cache Optimization**: Improve hit rates and reduce backend load  
✅ **Error Tracking**: Quickly identify and fix problematic endpoints  
✅ **Traffic Analysis**: Understand usage patterns and plan capacity  
✅ **Broken API Detection**: Automatically detect structure changes  
✅ **Snapshot Replacement**: Replace broken APIs with cached snapshots  
✅ **Top API Rankings**: See which APIs are most used/slowest  
✅ **Data-Driven Optimization**: Make informed decisions based on real usage

Start with just adding `ENABLE_REQUEST_LOGGING=true` to your environment and you'll have access to all these powerful analytics features! 🚀
