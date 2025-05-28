# ⚡ Proxy Stone API Quick Reference

## 🚀 **Most Used Endpoints**

### **Health & Status**

```bash
GET /health                          # System health check
GET /api/metrics                     # Prometheus metrics
```

### **Password Manager**

```bash
GET    /api/password-manager/credentials     # List all credentials
GET    /api/password-manager/credentials/:id # Get single credential
POST   /api/password-manager/credentials     # Create credential
PUT    /api/password-manager/credentials/:id # Update credential
DELETE /api/password-manager/credentials/:id # Delete credential
POST   /api/password-manager/upload-csv      # Import CSV
GET    /api/password-manager/csv-template    # Download template
```

### **Analytics**

```bash
GET /api/requests/analytics/performance      # Performance metrics
GET /api/requests/analytics/cache           # Cache analytics
GET /api/requests/analytics/errors          # Error tracking
GET /api/requests                           # All requests with filters
GET /api/requests/recent                    # Recent requests
```

### **Cache Management**

```bash
GET    /api/cache/stats        # Cache statistics
DELETE /api/cache/clear        # Clear all cache
GET    /api/cache/get/:key     # Get cache entry
POST   /api/cache/set          # Set cache entry
```

### **Authentication**

```bash
POST /api/auth/login           # User login
POST /api/auth/refresh         # Refresh token
GET  /api/auth/me              # Current user info
POST /api/auth/logout          # Logout
```

---

## 🔧 **Common Query Parameters**

### **Password Manager Filters**

```bash
?category=admin                # Filter by category
?status=pending               # Filter by status
?importance=5                 # Filter by importance
?search=example.com           # Search in login/url
?limit=50&offset=100          # Pagination
```

### **Analytics Filters**

```bash
?method=GET                   # Filter by HTTP method
?status=404                   # Filter by status code
?cacheHit=true               # Filter by cache status
?dateFrom=2025-01-01         # Date range start
?dateTo=2025-01-31           # Date range end
```

---

## 📝 **Common Request Bodies**

### **Create Credential**

```json
{
  "login": "user@example.com",
  "password": "secure_password",
  "url": "https://api.example.com",
  "category": "api",
  "importance": 4,
  "status": "pending",
  "tags": ["production", "critical"]
}
```

### **CSV Import**

```json
{
  "csvContent": "login,password,url,category,importance,status\nuser@test.com,pass123,https://test.com,user,3,pending"
}
```

### **Bulk Update Status**

```json
{
  "ids": [1, 2, 3, 4],
  "status": "verified"
}
```

---

## 🛡️ **Authentication Headers**

```bash
# API Key (most common)
Authorization: Bearer your-api-key

# JWT Token
Authorization: Bearer jwt-token

# Content Type
Content-Type: application/json
```

---

## 📊 **Response Examples**

### **Health Check Response**

```json
{
  "status": "ok",
  "uptime": 86400.5,
  "services": {
    "cache": { "status": "ok", "enabled": true },
    "database": { "status": "ok", "type": "sqlite" },
    "requestLogger": { "status": "ok", "enabled": true }
  }
}
```

### **Credentials List Response**

```json
{
  "credentials": [...],
  "total": 150,
  "categories": ["admin", "api", "user"],
  "statuses": ["pending", "verified", "changed"],
  "pagination": {"limit": 100, "offset": 0, "hasMore": true}
}
```

### **Performance Analytics Response**

```json
{
  "summary": {
    "totalRequests": 1500,
    "avgResponseTime": 423,
    "medianResponseTime": 350,
    "percentile95ResponseTime": 1200
  },
  "slowestRequests": [...],
  "backendPerformance": {...}
}
```

---

## ❌ **Error Response Format**

```json
{
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "code": "VALIDATION_FAILED",
  "statusCode": 400,
  "timestamp": "2025-01-28T10:00:00Z",
  "requestId": "req_123456789"
}
```

---

## 🚀 **cURL Examples**

### **Get System Health**

```bash
curl http://localhost:4000/health
```

### **List Credentials with Filter**

```bash
curl -H "Authorization: Bearer your-api-key" \
  "http://localhost:4000/api/password-manager/credentials?category=admin&limit=10"
```

### **Import CSV Data**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"csvContent": "login,password,url\ntest@example.com,pass123,https://example.com"}' \
  http://localhost:4000/api/password-manager/upload-csv
```

### **Get Performance Analytics**

```bash
curl http://localhost:4000/api/requests/analytics/performance | jq
```

### **Create New Credential**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "login": "admin@newsite.com",
    "password": "secure123",
    "url": "https://newsite.com",
    "category": "admin",
    "importance": 5,
    "status": "pending"
  }' \
  http://localhost:4000/api/password-manager/credentials
```

---

## 🎯 **UI Development Ready!**

**Essential APIs for UI Components:**

- **Dashboard:** `/health`, `/api/requests/analytics/*`
- **Password Manager:** `/api/password-manager/credentials*`
- **Analytics:** `/api/requests/analytics/*`, `/api/metrics`
- **Cache Management:** `/api/cache/*`
- **System Monitor:** `/health`, `/api/requests/stats`

**Next Steps:**

1. Set up authentication flow
2. Build password manager interface
3. Create analytics dashboard
4. Add real-time monitoring
5. Implement cache management UI
