# 🔐 Authentication & Authorization Guide

This guide shows how to use the conditional authentication system in proxy-stone.

## 🚀 Quick Start

### 1. **Disabled by Default** (No Auth)

```bash
# Start without auth (default behavior)
npm start

# All endpoints are accessible without authentication
curl http://localhost:3000/api/cache/entries
curl http://localhost:3000/api/auth/status
```

### 2. **Enable Auth with API Keys**

```bash
# Enable auth with API keys
npm start -- --enable-auth --api-keys='[
  {"key":"admin-key-123","role":"admin","name":"Admin Key"},
  {"key":"readonly-key-456","role":"readonly","name":"Read Only Key"}
]'
```

Or using environment variables:

```bash
export ENABLE_AUTH=true
export API_KEYS='[
  {"key":"admin-key-123","role":"admin","name":"Admin Key"},
  {"key":"readonly-key-456","role":"readonly","name":"Read Only Key"}
]'
npm start
```

## 🔑 API Key Usage

### **Admin Access**

```bash
# Using Authorization header
curl -H "Authorization: Bearer admin-key-123" \
  http://localhost:3000/api/cache/entries

# Using X-API-Key header
curl -H "X-API-Key: admin-key-123" \
  http://localhost:3000/api/auth/test-admin
```

### **Read-Only Access**

```bash
# Read-only users can view but not modify
curl -H "Authorization: Bearer readonly-key-456" \
  http://localhost:3000/api/cache/entries

# This will fail (403 Forbidden)
curl -H "Authorization: Bearer readonly-key-456" \
  http://localhost:3000/api/auth/test-admin
```

## 🛡️ Protected Paths

By default, these paths require authentication when auth is enabled:

- `/api/cache*` - Cache management endpoints
- `/api/metrics*` - Metrics endpoints
- `/api/requests*` - Request log endpoints
- `/api/snapshots*` - Snapshot management endpoints

### **Customize Protected Paths**

```bash
# Custom protected paths
npm start -- --enable-auth \
  --auth-protected-paths="/api/cache*,/api/admin*,/api/sensitive*"
```

## 🎭 Role-Based Access

### **Roles Available**

- `admin` - Full access to all endpoints
- `readonly` - Read-only access to protected endpoints
- `user` - Default role for non-authenticated requests

### **Testing Different Roles**

```bash
# Check auth status (no auth required)
curl http://localhost:3000/api/auth/status

# Test read access (requires readonly or admin)
curl -H "Authorization: Bearer readonly-key-456" \
  http://localhost:3000/api/auth/test-protected

# Test admin access (requires admin only)
curl -H "Authorization: Bearer admin-key-123" \
  http://localhost:3000/api/auth/test-admin
```

## 🔄 Conditional Behavior

### **Auth Disabled** (Default)

- All endpoints accessible without authentication
- No API key validation
- All requests treated as `user` role

### **Auth Enabled**

- Protected paths require valid API key
- Role-based access control enforced
- Unprotected paths (like `/health`, `/proxy/*`) remain open

## 🧪 Testing the System

### **1. Start without auth**

```bash
npm start
curl http://localhost:3000/api/auth/status
# Returns: {"auth_enabled": false, "authenticated": false}
```

### **2. Start with auth enabled**

```bash
npm start -- --enable-auth --api-keys='[{"key":"test-123","role":"admin"}]'
curl http://localhost:3000/api/auth/status
# Returns: {"auth_enabled": true, "authenticated": false}

curl -H "Authorization: Bearer test-123" http://localhost:3000/api/auth/status
# Returns: {"auth_enabled": true, "authenticated": true, "role": "admin"}
```

### **3. Test protected endpoints**

```bash
# Without auth (should fail)
curl http://localhost:3000/api/cache/entries
# Returns: 401 Unauthorized

# With valid key (should work)
curl -H "Authorization: Bearer test-123" http://localhost:3000/api/cache/entries
# Returns: cache entries data
```

## 🔧 Configuration Options

### **CLI Arguments**

```bash
--enable-auth                    # Enable authentication
--api-keys='[{...}]'            # JSON array of API keys
--auth-protected-paths='...'     # Comma-separated protected paths
--jwt-secret='secret'           # JWT secret (future use)
```

### **Environment Variables**

```bash
ENABLE_AUTH=true
API_KEYS='[{"key":"...","role":"admin"}]'
AUTH_PROTECTED_PATHS='/api/cache*,/api/metrics*'
JWT_SECRET='your-jwt-secret'
JWT_ISSUER='proxy-stone'
JWT_EXPIRES_IN='24h'
```

## 🚦 Error Responses

### **401 Unauthorized**

```json
{
  "error": "Unauthorized",
  "message": "API key required. Provide via Authorization: Bearer <key> or X-API-Key header."
}
```

### **403 Forbidden**

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions. Required roles: admin"
}
```

## 🔮 Future Features (Phase 11+)

- JWT token support
- OAuth2 integration
- Web UI authentication
- Audit logging
- Rate limiting per API key

---

**💡 Pro Tip**: Start with auth disabled for development, then enable it for staging/production environments!
