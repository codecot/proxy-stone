# 🚀 Proxy Stone API Documentation

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request Analytics & Monitoring APIs](#request-analytics--monitoring-apis)
4. [Health & System APIs](#health--system-apis)
5. [Cache Management APIs](#cache-management-apis)
6. [Authentication & User Management APIs](#authentication--user-management-apis)
7. [Proxy & API Management](#proxy--api-management)
8. [Cluster Management APIs](#cluster-management-apis)
9. [Error Handling](#error-handling)
10. [Configuration](#configuration)

---

## 🎯 **Overview**

Proxy Stone provides a comprehensive API suite for:

- **Request Analytics** - Performance monitoring, cache analytics, error tracking
- **System Monitoring** - Health checks, metrics, real-time monitoring
- **Cache Management** - Intelligent caching with TTL and invalidation
- **Authentication** - JWT tokens, API keys, user management
- **Proxy Management** - API proxying with failover and recovery
- **Cluster Management** - Multi-node coordination and load balancing

**Base URL:** `http://localhost:4000`  
**API Prefix:** `/api` (for most endpoints)

---

## 🔐 **Authentication**

### **Authentication Methods**

1. **API Keys** - For service-to-service communication
2. **JWT Tokens** - For user sessions
3. **No Auth** - For public endpoints (health checks)

### **Headers**

```bash
# API Key Authentication
Authorization: Bearer your-api-key

# JWT Token Authentication
Authorization: Bearer jwt-token

# Content Type (for POST/PUT requests)
Content-Type: application/json
```

---

## 📊 **Request Analytics & Monitoring APIs**

### **Base Path:** `/api/requests`

### **1. Get All Requests**

```bash
GET /api/requests
```

**Query Parameters:**

- `method` - Filter by HTTP method (GET, POST, etc.)
- `status` - Filter by status code
- `url` - Filter by URL pattern
- `cacheHit` - Filter by cache status (true/false)
- `dateFrom` - Start date (ISO format)
- `dateTo` - End date (ISO format)
- `limit` - Limit results
- `offset` - Pagination offset

**Response:**

```json
{
  "requests": [
    {
      "id": "req_1738026420000_1",
      "method": "GET",
      "originalUrl": "/api/users",
      "targetUrl": "https://api.example.com/users",
      "backendHost": "api.example.com",
      "statusCode": 200,
      "responseTime": 245,
      "cacheHit": true,
      "timestamp": "2025-01-28T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 50
  }
}
```

### **2. Performance Analytics**

```bash
GET /api/requests/analytics/performance
```

**Response:**

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
      "timestamp": "2025-01-28T10:00:00Z",
      "method": "POST"
    }
  ],
  "backendPerformance": {
    "https://api.example.com": {
      "count": 950,
      "avgTime": 380
    }
  },
  "timestamp": "2025-01-28T10:30:00Z"
}
```

### **3. Cache Analytics**

```bash
GET /api/requests/analytics/cache
```

**Response:**

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
    { "url": "https://api.example.com/config", "count": 45 }
  ],
  "cacheTimeSavings": {
    "estimatedTimeSaved": 245600,
    "requestsServedFromCache": 680
  }
}
```

### **4. Error Analytics**

```bash
GET /api/requests/analytics/errors
```

**Response:**

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
    "503": 4
  },
  "topErrorEndpoints": [
    { "url": "https://api.example.com/broken", "count": 15 }
  ],
  "recentErrors": [
    {
      "url": "https://api.example.com/users/123",
      "method": "GET",
      "statusCode": 404,
      "errorMessage": "User not found",
      "timestamp": "2025-01-28T10:00:00Z"
    }
  ]
}
```

### **5. Data Size Analytics**

```bash
GET /api/requests/analytics/data-size
```

### **6. Recent Requests**

```bash
GET /api/requests/recent
```

### **7. Request Statistics**

```bash
GET /api/requests/stats
```

### **8. Filter by Method/Status/Backend**

```bash
GET /api/requests/by-method/GET
GET /api/requests/by-status/404
GET /api/requests/by-backend/https%3A%2F%2Fapi.example.com
```

---

## 🏥 **Health & System APIs**

### **1. System Health Check**

```bash
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "uptime": 86400.5,
  "timestamp": "2025-01-28T10:00:00Z",
  "version": "1.0.0",
  "services": {
    "cache": {
      "status": "ok",
      "enabled": true,
      "stats": {
        "totalItems": 1250,
        "hitRate": 78.5,
        "memoryUsage": "45MB"
      }
    },
    "database": {
      "status": "ok",
      "type": "sqlite",
      "path": "./storage/proxy.db"
    },
    "requestLogger": {
      "status": "ok",
      "enabled": true,
      "stats": {
        "total": 1500,
        "errors": 45,
        "avgDuration": 423,
        "errorRate": 3.0
      }
    },
    "snapshotManager": {
      "status": "ok",
      "totalSnapshots": 150,
      "activeSnapshots": 145
    }
  }
}
```

### **2. Detailed Health Management**

```bash
GET /api/health/detailed
GET /api/health/services
GET /api/health/database
GET /api/health/cache
```

### **3. Prometheus Metrics**

```bash
GET /api/metrics
```

**Response (Prometheus format):**

```
# HELP proxy_requests_total Total number of requests processed
# TYPE proxy_requests_total counter
proxy_requests_total{method="GET",path="/health",status_code="200"} 24
proxy_requests_total{method="GET",path="/api/users",status_code="200"} 150

# HELP proxy_request_duration_seconds Request duration in seconds
# TYPE proxy_request_duration_seconds histogram
proxy_request_duration_seconds_bucket{method="GET",path="/api/users",le="0.1"} 50
```

---

## 💾 **Cache Management APIs**

### **Base Path:** `/api/cache`

### **1. Cache Operations**

```bash
# Get cache statistics
GET /api/cache/stats

# Clear all cache
DELETE /api/cache/clear

# Clear specific cache key
DELETE /api/cache/clear/:key

# Get cache entry
GET /api/cache/get/:key

# Set cache entry
POST /api/cache/set
{
  "key": "api:users:list",
  "value": {"users": []},
  "ttl": 300
}
```

### **2. Cache Rules Management**

```bash
# Get cache rules
GET /api/cache/rules

# Update cache rules
PUT /api/cache/rules
{
  "rules": [
    {
      "pattern": "/api/users/*",
      "ttl": 300,
      "enabled": true
    }
  ]
}
```

---

## 👤 **Authentication & User Management APIs**

### **Base Path:** `/api/auth`

### **1. User Authentication**

```bash
# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "secure_password"
}

# Response
{
  "token": "jwt_token_here",
  "expiresIn": "24h",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### **2. Token Management**

```bash
# Refresh token
POST /api/auth/refresh
{
  "refreshToken": "refresh_token_here"
}

# Logout
POST /api/auth/logout

# Verify token
GET /api/auth/verify
```

### **3. User Management**

```bash
# Get current user
GET /api/auth/me

# Update profile
PUT /api/auth/profile
{
  "email": "admin@example.com",
  "name": "Administrator"
}

# Change password
POST /api/auth/change-password
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

### **4. API Key Management**

```bash
# List API keys
GET /api/auth/api-keys

# Create API key
POST /api/auth/api-keys
{
  "name": "Mobile App Key",
  "permissions": ["read", "write"],
  "expiresAt": "2025-12-31T23:59:59Z"
}

# Revoke API key
DELETE /api/auth/api-keys/:keyId
```

---

## 🌐 **Proxy & API Management**

### **Main Proxy Endpoint**

```bash
# Proxy any API request
ANY /*
```

**Features:**

- Automatic load balancing
- Failover and recovery
- Request/response caching
- Rate limiting
- Request logging
- Error tracking

**Headers:**

```bash
# Target backend override
X-Proxy-Target: https://alternative-api.example.com

# Cache control
X-Proxy-Cache-TTL: 300
X-Proxy-Cache-Skip: true

# Authentication passthrough
Authorization: Bearer user-token
```

### **Snapshot Management**

```bash
# Get API snapshots
GET /api/snapshots

# Create snapshot
POST /api/snapshots
{
  "url": "https://api.example.com/users",
  "data": {...},
  "ttl": 3600
}

# Get snapshot
GET /api/snapshots/:id

# Delete snapshot
DELETE /api/snapshots/:id
```

---

## 🏭 **Cluster Management APIs**

### **Base Path:** `/api/cluster`

### **1. Cluster Status**

```bash
GET /api/cluster/status
```

**Response:**

```json
{
  "nodeId": "node-1",
  "status": "active",
  "role": "primary",
  "nodes": [
    {
      "id": "node-1",
      "host": "localhost:4000",
      "status": "active",
      "role": "primary",
      "lastSeen": "2025-01-28T10:00:00Z"
    }
  ],
  "cluster": {
    "totalNodes": 3,
    "activeNodes": 3,
    "primaryNode": "node-1"
  }
}
```

### **2. Node Management**

```bash
# Register node
POST /api/cluster/register
{
  "nodeId": "node-2",
  "host": "192.168.1.100:4000",
  "capabilities": ["cache", "analytics"]
}

# Node heartbeat
POST /api/cluster/heartbeat

# Remove node
DELETE /api/cluster/nodes/:nodeId
```

---

## ❌ **Error Handling**

### **Standard Error Response**

```json
{
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "code": "VALIDATION_FAILED",
  "statusCode": 400,
  "timestamp": "2025-01-28T10:00:00Z",
  "requestId": "req_123456789",
  "details": {
    "field": "email",
    "constraint": "must be valid email"
  }
}
```

### **HTTP Status Codes**

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

---

## ⚙️ **Configuration**

### **Environment Variables**

```bash
# Server Configuration
PORT=4000
NODE_ENV=production

# Database Configuration
DB_TYPE=sqlite
DB_PATH=./storage/proxy.db

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=300
FILE_CACHE_ENABLED=true
FILE_CACHE_DIR=./cache

# Request Logging
ENABLE_REQUEST_LOGGING=true
REQUEST_LOG_DB_PATH=./logs/requests.db
REQUEST_LOG_STORAGE_TYPE=sqlite

# Authentication
AUTH_ENABLED=true
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
API_KEYS=key1,key2,key3

# Security
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### **API Rate Limits**

- **Global:** 100 requests/minute
- **Authentication:** 10 requests/minute
- **Analytics:** 50 requests/minute
- **Password Manager:** 30 requests/minute

### **Database Support**

- **SQLite** - Default, file-based
- **MySQL** - High performance
- **PostgreSQL** - Advanced features

---

## 🚀 **Quick Start Examples**

### **1. Basic Health Check**

```bash
curl http://localhost:4000/health
```

### **2. Get Password Manager Credentials**

```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:4000/api/password-manager/credentials
```

### **3. View Performance Analytics**

```bash
curl http://localhost:4000/api/requests/analytics/performance | jq
```

### **4. Import CSV Data**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"csvContent": "login,password,url\nuser@test.com,pass123,https://test.com"}' \
  http://localhost:4000/api/password-manager/upload-csv
```

### **5. Proxy API Request**

```bash
# Direct proxy - automatically routes to configured backend
curl http://localhost:4000/api/users

# With custom target
curl -H "X-Proxy-Target: https://jsonplaceholder.typicode.com" \
  http://localhost:4000/users
```

---

## 📚 **Additional Resources**

- **Multi-Database Guide:** See `DATABASE_IMPLEMENTATION_SUMMARY.md`
- **Analytics Guide:** See `ENABLE_REQUEST_ANALYTICS.md`
- **Configuration Reference:** See `apps/backend/src/config/`
- **API Examples:** See test files in project

---

**Ready for UI Development!** 🎉

This API provides a solid foundation for building:

- Admin dashboards
- Monitoring interfaces
- Password management UIs
- Analytics visualizations
- System configuration panels
