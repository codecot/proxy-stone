# 🔐 Token-Based Authentication Guide

## 🎯 **Overview**

The proxy-stone authentication system now uses **JWT tokens** instead of sessions, providing a more scalable and API-friendly approach. This guide covers the complete token-based authentication workflow.

---

## 🚀 **Quick Start**

### **1. Enable Authentication**

```bash
# Required: Set JWT secret
export JWT_SECRET="your-super-secure-jwt-secret-here"

# Enable authentication
export ENABLE_AUTH=true

# Start the server
npm start
```

### **2. Login to Get Token**

```bash
# Login with username/password
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Response:
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "user": {
    "id": "user-id",
    "username": "admin",
    "role": "admin"
  }
}
```

### **3. Use Token for API Calls**

```bash
# Use the token in Authorization header
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3002/auth/test-protected

# Alternative: Use X-Access-Token header
curl -H "X-Access-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3002/auth/test-protected
```

---

## 🔧 **Configuration**

### **Environment Variables**

```bash
# Authentication
export ENABLE_AUTH=true              # Enable authentication
export ENABLE_USER_AUTH=true         # Enable username/password auth
export JWT_SECRET="your-jwt-secret"  # Required for JWT signing
export JWT_EXPIRES_IN="24h"          # Token expiration (default: 24h)
export JWT_ISSUER="proxy-stone"      # JWT issuer (default: proxy-stone)

# Security
export AUTH_SALT="your-salt"         # Salt for password hashing
export MAX_LOGIN_ATTEMPTS=5          # Max failed attempts (default: 5)
export LOCKOUT_DURATION=900          # Lockout duration in seconds (default: 15min)

# Protected paths
export AUTH_PROTECTED_PATHS="/api/cache*,/api/metrics*"
```

### **CLI Arguments**

```bash
npm start -- \
  --enable-auth \
  --jwt-secret "your-secret" \
  --jwt-expires-in "7d" \
  --auth-protected-paths "/api/cache*,/api/admin*"
```

---

## 🔑 **Authentication Methods**

### **1. Username/Password Authentication**

**Login:**

```bash
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }'
```

**Response:**

```json
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "user": {
    "id": "user-id",
    "username": "your-username",
    "role": "admin"
  }
}
```

### **2. API Key Authentication**

**Create API Key (Admin only):**

```bash
curl -X POST http://localhost:3002/auth/api-keys \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Service Key",
    "role": "readonly",
    "expiresInDays": 30
  }'
```

**Use API Key:**

```bash
# API keys can be used directly (they generate tokens internally)
curl -H "X-API-Key: <api-key>" \
  http://localhost:3002/auth/test-protected
```

---

## 🛡️ **Security Features**

### **JWT Token Security**

- **Signed with HMAC SHA256**: Prevents tampering
- **Configurable expiration**: Default 24 hours
- **Issuer validation**: Prevents token reuse across systems
- **Token revocation**: Blacklist for logout/security

### **Password Security**

- **PBKDF2 hashing**: 10,000 iterations with salt
- **Timing-safe comparison**: Prevents timing attacks
- **Secure salt**: Configurable per installation

### **Rate Limiting**

- **Failed attempt tracking**: Per IP/username
- **Automatic lockout**: After 5 failed attempts (configurable)
- **Lockout duration**: 15 minutes (configurable)
- **Automatic unlock**: After lockout period expires

---

## 📡 **API Endpoints**

### **Authentication Endpoints**

| Method | Endpoint       | Description                  | Auth Required |
| ------ | -------------- | ---------------------------- | ------------- |
| GET    | `/auth/status` | Check auth status            | No            |
| POST   | `/auth/login`  | Login with username/password | No            |
| POST   | `/auth/logout` | Logout and revoke token      | Yes           |

### **User Management (Admin Only)**

| Method | Endpoint      | Description     |
| ------ | ------------- | --------------- |
| POST   | `/auth/users` | Create new user |
| GET    | `/auth/users` | List all users  |

### **API Key Management (Admin Only)**

| Method | Endpoint         | Description        |
| ------ | ---------------- | ------------------ |
| POST   | `/auth/api-keys` | Create new API key |
| GET    | `/auth/api-keys` | List all API keys  |

### **Testing Endpoints**

| Method | Endpoint               | Description       | Required Role   |
| ------ | ---------------------- | ----------------- | --------------- |
| GET    | `/auth/test-protected` | Test read access  | readonly, admin |
| GET    | `/auth/test-admin`     | Test admin access | admin           |
| GET    | `/auth/stats`          | Auth statistics   | admin           |

---

## 🧪 **Testing**

### **Run Test Script**

```bash
# Make sure server is running with auth enabled
ENABLE_AUTH=true JWT_SECRET=test-secret npm start

# In another terminal, run the test
node test-token-auth.js
```

### **Manual Testing**

```bash
# 1. Check status
curl http://localhost:3002/auth/status

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.access_token')

# 3. Use token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/auth/test-protected

# 4. Logout
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/auth/logout
```

---

## 🔄 **Token Lifecycle**

### **1. Token Generation**

- User logs in with username/password
- Server validates credentials
- JWT token generated with user info and expiration
- Token returned to client

### **2. Token Usage**

- Client includes token in `Authorization: Bearer <token>` header
- Server validates token signature and expiration
- Server extracts user info from token payload
- Request processed with user context

### **3. Token Revocation**

- Client calls logout endpoint with token
- Server adds token to revocation blacklist
- Token becomes invalid for future requests
- Client should discard the token

### **4. Token Expiration**

- Tokens automatically expire after configured time
- Expired tokens are rejected by server
- Client must login again to get new token

---

## 🚨 **Security Best Practices**

### **JWT Secret Management**

```bash
# ✅ Good: Use strong, random secret
export JWT_SECRET=$(openssl rand -hex 32)

# ❌ Bad: Weak or default secrets
export JWT_SECRET="secret123"
```

### **Token Storage (Client-Side)**

```javascript
// ✅ Good: Store in memory or secure storage
const token = response.data.access_token;
localStorage.setItem('auth_token', token); // For web apps

// ❌ Bad: Log tokens or store insecurely
console.log('Token:', token); // Never log tokens!
```

### **Token Transmission**

```bash
# ✅ Good: Always use HTTPS in production
curl -H "Authorization: Bearer <token>" https://api.example.com/

# ❌ Bad: HTTP in production exposes tokens
curl -H "Authorization: Bearer <token>" http://api.example.com/
```

---

## 🔮 **Advanced Features**

### **Custom Token Claims**

The JWT payload includes:

```json
{
  "userId": "user-id",
  "role": "admin",
  "type": "user",
  "iat": 1640995200,
  "exp": 1641081600,
  "iss": "proxy-stone",
  "sub": "user-id"
}
```

### **Token Introspection**

```bash
# Decode token (for debugging - don't expose secrets!)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | \
  cut -d. -f2 | base64 -d | jq
```

### **Multiple Token Headers**

The system accepts tokens from multiple headers:

- `Authorization: Bearer <token>` (standard)
- `X-Access-Token: <token>` (alternative)
- `X-API-Key: <key>` (for API keys)

---

## 🐛 **Troubleshooting**

### **Common Issues**

**"Authentication service not available"**

```bash
# Ensure JWT_SECRET is set
export JWT_SECRET="your-secret"
```

**"Invalid or expired token"**

```bash
# Check token expiration
# Login again to get new token
```

**"Account temporarily locked"**

```bash
# Wait for lockout period to expire (default: 15 minutes)
# Or restart server to clear lockout state
```

### **Debug Mode**

```bash
# Enable debug logging
DEBUG=auth* npm start
```

---

## 📈 **Migration from Session-Based**

### **Key Changes**

1. **No more session cookies** → Use JWT tokens
2. **No session storage** → Stateless authentication
3. **Token in headers** → Not in cookies
4. **Manual token management** → Client responsibility

### **Client Code Updates**

```javascript
// Old session-based approach
fetch('/api/protected', {
  credentials: 'include', // Cookies sent automatically
});

// New token-based approach
fetch('/api/protected', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

---

**🎉 You're now ready to use secure, scalable token-based authentication!**
