# Proxy Server TypeScript

A high-performance **Backend for Frontend (BFF)** proxy server built with **Fastify** and **TypeScript**. Designed as an API middleware layer that sits between your frontend applications and backend services, providing intelligent request forwarding, caching, logging, and **request management interface**.

## ✨ Key Features

### 🚀 **Core Functionality**

- **Request Forwarding**: Seamlessly proxy requests to target servers
- **Method Support**: Handle GET, POST, PUT, DELETE, PATCH operations
- **Header Preservation**: Maintain request/response headers including CORS
- **Body Forwarding**: Support JSON, form data, and raw body content

### ⚡ **Performance & Caching**

- **Hybrid Caching**: In-memory + file-based persistence
- **User-Specific Cache**: Authorization header-aware caching
- **Configurable TTL**: Flexible cache expiration settings
- **Method-Specific**: Configure which HTTP methods to cache
- **1 File Per Entry**: Individual JSON files for each cache entry

### 📊 **Request Logging & Management** (NEW!)

- **SQLite Database**: Lightweight, embedded database storage
- **Management Interface**: REST API for viewing/filtering requests
- **Advanced Filtering**: By method, status, URL, date range, cache hits
- **Real-time Statistics**: Cache hit rates, response times, top URLs
- **Auto Cleanup**: Automatic removal of old logs

### 🛠️ **Configuration & CLI**

- **Command Line Interface**: Full CLI configuration support
- **Environment Variables**: Docker-friendly configuration
- **Hot Reload**: Development mode with automatic restarts
- **Multiple Targets**: Easy switching between backend services

### 📊 **Monitoring & Debug**

- **Comprehensive Logging**: Request/response logging with Pino
- **Health Endpoints**: Built-in health checks and cache statistics
- **Cache Management**: Clear, clean, and monitor cache via API
- **Debug Endpoints**: Configuration and runtime introspection

### 🔒 **Production Ready**

- **TypeScript**: Full type safety and modern JavaScript features
- **Error Handling**: Graceful error responses and logging
- **CORS Support**: Cross-origin request handling
- **File Cache Persistence**: Survive service restarts

## 🎯 Use Cases

### **Frontend Development**

- **Local API Proxy**: Avoid CORS issues during development
- **API Mocking**: Cache responses for consistent testing
- **Multiple Environments**: Switch between dev/staging/prod APIs
- **Request Analysis**: Monitor and debug API calls

### **Microservices Architecture**

- **API Gateway**: Centralized entry point for multiple services
- **Response Caching**: Reduce load on backend services
- **Request Aggregation**: Combine multiple API calls
- **Traffic Analysis**: Monitor service usage patterns

### **Performance Optimization**

- **Response Caching**: Cache expensive API calls
- **Bandwidth Reduction**: Serve cached responses faster
- **Backend Protection**: Rate limiting through caching
- **Performance Monitoring**: Track response times and bottlenecks

## 🏗️ Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Fastify (high-performance web framework)
- **HTTP Client**: Axios for reliable request forwarding
- **Logging**: Pino with pretty printing in development
- **Caching**: Hybrid in-memory + file system storage
- **Database**: SQLite for request logging and management
- **Build**: TypeScript compiler with ES modules

## 📁 Documentation Structure

- **[Quick Start Guide](quick-start.md)** - Get running in 5 minutes
- **[API Reference](api-reference.md)** - Complete endpoint documentation
- **[Configuration Guide](configuration.md)** - All CLI and environment options
- **[File Cache Guide](file-cache.md)** - Persistent cache setup and usage
- **[Request Logging Guide](request-logging.md)** - SQLite logging and management interface (NEW!)
- **[Deployment Guide](deployment.md)** - Production deployment strategies
- **[Development Guide](development.md)** - Contributing and extending
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

## 🚀 Quick Start

### Full Feature Setup (Recommended)

```bash
# Clone and install
git clone <repository-url>
cd proxy-server-ts
npm install

# Run with all features enabled
npm run dev -- \
  --enable-file-cache \
  --enable-request-logging \
  --cache-ttl 300

# Test with target server
curl http://localhost:3000/api/get
```

### View Request Analytics

```bash
# See logged requests
curl http://localhost:3000/requests | jq

# Get statistics
curl http://localhost:3000/requests/stats | jq

# Monitor cache performance
curl http://localhost:3000/requests/cache-performance | jq
```

### Basic Usage

```bash
# Default setup (memory cache only)
npm run dev

# Custom configuration
npm run dev -- --target-url https://api.example.com --port 4000
```

## 📋 Feature Comparison

| Feature         | Memory Only     | + File Cache          | + Request Logging          | Full Stack          |
| --------------- | --------------- | --------------------- | -------------------------- | ------------------- |
| **Speed**       | Fastest         | Fast + Persistent     | Fast + Analytics           | Complete Solution   |
| **Persistence** | Lost on restart | Cache survives        | Cache + Logs survive       | Full persistence    |
| **Monitoring**  | Basic logs      | Basic logs            | Full analytics             | Complete monitoring |
| **Setup**       | Default         | `--enable-file-cache` | `--enable-request-logging` | All flags           |

## 🔧 Configuration Examples

### Development with Full Features

```bash
npm run dev -- \
  --enable-file-cache \
  --enable-request-logging \
  --file-cache-dir ./cache \
  --request-log-db ./logs/requests.db \
  --cache-ttl 300 \
  --target-url https://jsonplaceholder.typicode.com
```

### Production Environment

```bash
export ENABLE_FILE_CACHE=true
export ENABLE_REQUEST_LOGGING=true
export FILE_CACHE_DIR=/app/cache
export REQUEST_LOG_DB_PATH=/app/logs/requests.db
export CACHE_TTL=600
export TARGET_URL=https://api.production.com
npm start
```

### Docker Setup

```yaml
# docker-compose.yml
environment:
  - ENABLE_FILE_CACHE=true
  - ENABLE_REQUEST_LOGGING=true
  - FILE_CACHE_DIR=/app/cache
  - REQUEST_LOG_DB_PATH=/app/logs/requests.db
volumes:
  - ./cache:/app/cache
  - ./logs:/app/logs
```

## 📊 Quick Health Check

```bash
# Server status
curl http://localhost:3000/health

# Cache statistics
curl http://localhost:3000/cache/stats

# Configuration debug
curl http://localhost:3000/debug/config

# Request analytics (NEW!)
curl http://localhost:3000/requests/stats
```

## 🎛️ Management Interface Examples

```bash
# View all requests with filtering
curl "http://localhost:3000/requests?method=GET&limit=10"

# Find slow requests
curl "http://localhost:3000/requests" | jq '.requests[] | select(.responseTime > 1000)'

# Monitor cache hit rate
curl "http://localhost:3000/requests/cache-performance" | jq '.hitRate'

# Get error analysis
curl "http://localhost:3000/requests?status=500"

# Clean old logs
curl -X DELETE "http://localhost:3000/requests/old?days=7"
```

## 🤝 Contributing

1. **Read** the [Development Guide](development.md)
2. **Fork** the repository
3. **Create** a feature branch
4. **Add** tests for new features
5. **Submit** a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Ready to get started?** Check out the **[Quick Start Guide](quick-start.md)** for a 5-minute setup, or explore the **[Request Logging Guide](request-logging.md)** to analyze your API traffic!
