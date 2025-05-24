# Request Logging & Management Interface

The proxy server includes a powerful **request logging system** with a **SQLite database** and **REST API interface** for viewing and managing all API requests that pass through the proxy.

## ✨ Features

- **📊 SQLite Database**: Lightweight, embedded database storage
- **🔍 Advanced Filtering**: Filter by method, status, URL, date range, cache hits
- **📈 Real-time Statistics**: Cache hit rates, response times, top URLs
- **🎛️ Management Interface**: View, filter, and delete request logs via API
- **⚡ High Performance**: Indexed database queries for fast searches
- **🧹 Auto Cleanup**: Automatic removal of old logs (configurable)
- **💾 Persistent Storage**: Survives service restarts

## 🚀 Quick Start

### Enable Request Logging

```bash
# Method 1: CLI Arguments (Recommended)
npm run dev -- --enable-request-logging --request-log-db ./logs/requests.db

# Method 2: Environment Variables
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_DB_PATH=./logs/requests.db
npm run dev
```

### View Logged Requests

```bash
# Get all requests (with pagination)
curl http://localhost:3000/requests | jq

# Get request statistics
curl http://localhost:3000/requests/stats | jq

# Get recent requests (last 100)
curl http://localhost:3000/requests/recent | jq
```

## 📊 What Gets Logged

Each request logs comprehensive details:

```json
{
  "id": 1,
  "timestamp": "2025-05-24 06:20:59",
  "method": "GET",
  "originalUrl": "/api/get",
  "targetUrl": "https://httpbin.org/get",
  "statusCode": 200,
  "responseTime": 952,
  "requestHeaders": "{\"user-agent\":\"curl/8.5.0\"}",
  "responseHeaders": "{\"content-type\":\"application/json\"}",
  "requestBody": null,
  "responseBody": "{\"args\":{}}",
  "cacheHit": false,
  "userAgent": "curl/8.5.0",
  "clientIp": "127.0.0.1",
  "errorMessage": null
}
```

## 🛠️ Configuration Options

| CLI Argument               | Environment Variable     | Default              | Description            |
| -------------------------- | ------------------------ | -------------------- | ---------------------- |
| `--enable-request-logging` | `ENABLE_REQUEST_LOGGING` | `false`              | Enable request logging |
| `--request-log-db <path>`  | `REQUEST_LOG_DB_PATH`    | `./logs/requests.db` | Database file path     |

## 📡 REST API Endpoints

### **Get All Requests**

```bash
GET /requests
```

**Query Parameters:**

- `method` - Filter by HTTP method (GET, POST, etc.)
- `status` - Filter by status code (200, 404, etc.)
- `url` - Filter by URL (partial match)
- `cacheHit` - Filter by cache hit/miss (true/false)
- `dateFrom` - Start date (ISO format)
- `dateTo` - End date (ISO format)
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset

**Examples:**

```bash
# Get all GET requests
curl "http://localhost:3000/requests?method=GET"

# Get all 404 errors
curl "http://localhost:3000/requests?status=404"

# Get cache hits only
curl "http://localhost:3000/requests?cacheHit=true"

# Get requests from last hour
curl "http://localhost:3000/requests?dateFrom=2025-05-24T06:00:00Z"

# Pagination
curl "http://localhost:3000/requests?limit=10&offset=20"
```

### **Get Request Statistics**

```bash
GET /requests/stats
```

Returns comprehensive statistics:

```json
{
  "stats": {
    "totalRequests": 150,
    "cacheHitRate": 45.33,
    "avgResponseTime": 423.7,
    "requestsByMethod": {
      "GET": 95,
      "POST": 45,
      "PUT": 10
    },
    "requestsByStatus": {
      "200": 130,
      "404": 15,
      "500": 5
    },
    "topUrls": [
      { "url": "https://api.example.com/users", "count": 25 },
      { "url": "https://api.example.com/posts", "count": 20 }
    ]
  }
}
```

### **Get Recent Requests**

```bash
GET /requests/recent
```

Returns the last 100 requests.

### **Get Specific Request**

```bash
GET /requests/:id
```

### **Get Requests by Method**

```bash
GET /requests/by-method/:method
```

### **Get Requests by Status Code**

```bash
GET /requests/by-status/:status
```

### **Get Cache Performance**

```bash
GET /requests/cache-performance
```

Returns cache hit vs miss analysis:

```json
{
  "cacheHits": {
    "count": 45,
    "requests": [
      /* recent cache hits */
    ]
  },
  "cacheMisses": {
    "count": 55,
    "requests": [
      /* recent cache misses */
    ]
  },
  "hitRate": 45.0
}
```

## 🧹 Management Endpoints

### **Clear Old Requests**

```bash
DELETE /requests/old?days=30
```

Removes requests older than specified days (default: 30).

### **Clear All Requests**

```bash
DELETE /requests/all
```

⚠️ **Warning**: This deletes ALL logged requests permanently.

## 📊 Usage Examples

### **Monitor API Usage**

```bash
# Get hourly request count
curl "http://localhost:3000/requests/stats" | jq '.stats.totalRequests'

# Monitor cache performance
curl "http://localhost:3000/requests/cache-performance" | jq '.hitRate'

# Find slow requests (you can implement custom filtering)
curl "http://localhost:3000/requests" | jq '.requests[] | select(.responseTime > 1000)'
```

### **Debug API Issues**

```bash
# Find all 5xx errors
curl "http://localhost:3000/requests" | jq '.requests[] | select(.statusCode >= 500)'

# Check specific endpoint usage
curl "http://localhost:3000/requests?url=users" | jq '.requests[].statusCode'

# Monitor specific user agent
curl "http://localhost:3000/requests" | jq '.requests[] | select(.userAgent | contains("Mobile"))'
```

### **Performance Analysis**

```bash
# Get average response time by method
curl "http://localhost:3000/requests/stats" | jq '.stats'

# Find bottleneck endpoints
curl "http://localhost:3000/requests/stats" | jq '.stats.topUrls'

# Cache effectiveness
curl "http://localhost:3000/requests/cache-performance" | jq '.hitRate'
```

## 🔧 Advanced Configuration

### **Production Setup**

```bash
# High-performance production config
export ENABLE_REQUEST_LOGGING=true
export REQUEST_LOG_DB_PATH=/var/log/proxy/requests.db
export CACHE_TTL=3600

# With monitoring
npm start -- --enable-request-logging --request-log-db /var/log/proxy/requests.db
```

### **Development with Full Logging**

```bash
npm run dev -- \
  --enable-request-logging \
  --enable-file-cache \
  --request-log-db ./logs/requests.db \
  --file-cache-dir ./cache \
  --cache-ttl 300
```

### **Docker Configuration**

```yaml
# docker-compose.yml
environment:
  - ENABLE_REQUEST_LOGGING=true
  - REQUEST_LOG_DB_PATH=/app/logs/requests.db
volumes:
  - ./logs:/app/logs
```

## 🔍 Database Schema

The SQLite database uses this optimized schema:

```sql
CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  method TEXT NOT NULL,
  original_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time REAL NOT NULL,
  request_headers TEXT,
  response_headers TEXT,
  request_body TEXT,
  response_body TEXT,
  cache_hit BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  client_ip TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_timestamp ON requests(timestamp);
CREATE INDEX idx_method ON requests(method);
CREATE INDEX idx_status_code ON requests(status_code);
CREATE INDEX idx_target_url ON requests(target_url);
```

## 📈 Performance Considerations

### **Database Size Management**

```bash
# Monitor database size
du -h logs/requests.db

# Clean old entries (automated)
curl -X DELETE "http://localhost:3000/requests/old?days=7"

# Manual cleanup
sqlite3 logs/requests.db "DELETE FROM requests WHERE timestamp < date('now', '-30 days');"
```

### **Query Performance**

- Indexes on commonly filtered columns
- Automatic pagination (default limit: 50)
- Truncated response body storage (max 10KB)
- Efficient date range queries

### **Storage Optimization**

```bash
# Vacuum database to reclaim space
sqlite3 logs/requests.db "VACUUM;"

# Analyze query performance
sqlite3 logs/requests.db ".explain on" "SELECT * FROM requests WHERE method='GET';"
```

## 🛡️ Security Notes

- Database file permissions: `600` (owner read/write only)
- Request bodies may contain sensitive data
- Consider log rotation in production
- IP addresses are logged (GDPR compliance)
- No authentication on logging endpoints (add if needed)

## 🔧 Troubleshooting

### **Request Logging Not Working**

1. Check if enabled: `curl /debug/config`
2. Verify database path permissions
3. Check server logs for SQLite errors
4. Ensure disk space available

### **Database File Issues**

```bash
# Check database integrity
sqlite3 logs/requests.db "PRAGMA integrity_check;"

# Repair corrupted database
sqlite3 logs/requests.db ".recover" > recovered.sql
```

### **Performance Issues**

```bash
# Monitor database locks
lsof logs/requests.db

# Check query performance
sqlite3 logs/requests.db ".timer on" "SELECT COUNT(*) FROM requests;"
```

## 💡 Custom Dashboards

You can build custom monitoring dashboards using the API:

```javascript
// Example: Real-time dashboard
async function getDashboardData() {
  const stats = await fetch('/requests/stats').then((r) => r.json());
  const recent = await fetch('/requests/recent').then((r) => r.json());
  const errors = await fetch('/requests?status=500').then((r) => r.json());

  return { stats, recent, errors };
}
```

## 🔗 Integration Examples

### **With Monitoring Tools**

```bash
# Prometheus metrics endpoint (custom implementation)
curl http://localhost:3000/requests/stats | jq -r '.stats | to_entries[]'

# Grafana dashboard queries
curl "http://localhost:3000/requests?dateFrom=$(date -d '1 hour ago' -Iseconds)"
```

### **Log Analysis**

```bash
# Export to CSV for analysis
curl "http://localhost:3000/requests?limit=1000" | jq -r '.requests[] | [.timestamp, .method, .statusCode, .responseTime] | @csv'

# Send to external logging
curl "http://localhost:3000/requests/recent" | jq '.requests[]' | curl -X POST -d @- https://logs.example.com/proxy
```

---

**Ready to analyze your API traffic?** Enable request logging and start exploring your proxy's usage patterns!
