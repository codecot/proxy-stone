# Configuration Guide

Complete reference for configuring the BFF/API Middleware service.

## Configuration Methods

The service supports three configuration methods in order of precedence:

1. **Command Line Arguments** (highest priority)
2. **Environment Variables** (medium priority)
3. **Default Values** (lowest priority)

## Available Options

| Option            | CLI Argument          | Environment Variable | Default               | Description                   |
| ----------------- | --------------------- | -------------------- | --------------------- | ----------------------------- |
| Port              | `--port`              | `PORT`               | `3000`                | Server listening port         |
| Host              | `--host`              | `HOST`               | `0.0.0.0`             | Server listening host         |
| API Prefix        | `--api-prefix`        | `API_PREFIX`         | `/api`                | Prefix for proxied routes     |
| Target URL        | `--target-url`        | `TARGET_URL`         | `https://httpbin.org` | Backend API server URL        |
| Cache TTL         | `--cache-ttl`         | `CACHE_TTL`          | `300`                 | Cache time-to-live in seconds |
| Cacheable Methods | `--cacheable-methods` | `CACHEABLE_METHODS`  | `GET,POST`            | HTTP methods to cache         |

## Command Line Arguments

### Basic Server Configuration

```bash
# Custom port and host
npm run dev -- --port 8080 --host 127.0.0.1

# Bind to all interfaces for Docker
npm run dev -- --host 0.0.0.0 --port 3000
```

### API Configuration

```bash
# Change target server
npm run dev -- --target-url https://api.example.com

# Custom API prefix
npm run dev -- --api-prefix /v1/api

# Multiple configuration
npm run dev -- \
  --port 4000 \
  --api-prefix /proxy \
  --target-url https://jsonplaceholder.typicode.com
```

### Cache Configuration

```bash
# Cache for 1 hour
npm run dev -- --cache-ttl 3600

# Only cache GET requests
npm run dev -- --cacheable-methods GET

# Cache multiple methods
npm run dev -- --cacheable-methods GET,POST,PUT,PATCH

# Disable caching (TTL = 0)
npm run dev -- --cache-ttl 0
```

### Complete Example

```bash
npm run dev -- \
  --port 8080 \
  --host 0.0.0.0 \
  --api-prefix /v2/proxy \
  --target-url https://api.github.com \
  --cache-ttl 600 \
  --cacheable-methods GET,POST
```

## Environment Variables

### Development (.env file)

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=4000
HOST=127.0.0.1

# API Configuration
API_PREFIX=/api/v1
TARGET_URL=https://api.example.com

# Cache Configuration
CACHE_TTL=300
CACHEABLE_METHODS=GET,POST,PUT

# Node Environment
NODE_ENV=development
```

### Production Environment

```bash
# Production settings
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0
export TARGET_URL=https://api.production.com
export API_PREFIX=/api
export CACHE_TTL=600
export CACHEABLE_METHODS=GET,POST

# Start the service
npm start
```

### Docker Environment

```dockerfile
# Dockerfile example
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TARGET_URL=https://api.backend.com
ENV CACHE_TTL=300
ENV CACHEABLE_METHODS=GET,POST
```

## Configuration Scenarios

### 1. Development Proxy

Proxy local development to production APIs:

```bash
# Option A: Command line
npm run dev -- \
  --target-url https://api.production.com \
  --cache-ttl 60 \
  --cacheable-methods GET

# Option B: Environment variables
export TARGET_URL=https://api.production.com
export CACHE_TTL=60
export CACHEABLE_METHODS=GET
npm run dev
```

### 2. API Aggregation

Set up multiple service instances:

**Users Service:**

```bash
npm run dev -- \
  --port 4001 \
  --api-prefix /users \
  --target-url https://users.api.com \
  --cache-ttl 600
```

**Orders Service:**

```bash
npm run dev -- \
  --port 4002 \
  --api-prefix /orders \
  --target-url https://orders.api.com \
  --cache-ttl 300
```

**Inventory Service:**

```bash
npm run dev -- \
  --port 4003 \
  --api-prefix /inventory \
  --target-url https://inventory.api.com \
  --cache-ttl 120
```

### 3. Search API Optimization

Cache expensive search operations:

```bash
npm run dev -- \
  --target-url https://search.elasticsearch.com \
  --cacheable-methods GET,POST \
  --cache-ttl 900 \
  --api-prefix /search
```

### 4. A/B Testing Setup

Route to different backend versions:

**Version A:**

```bash
npm run dev -- \
  --port 4000 \
  --api-prefix /api/v1 \
  --target-url https://api-v1.example.com
```

**Version B:**

```bash
npm run dev -- \
  --port 4001 \
  --api-prefix /api/v2 \
  --target-url https://api-v2.example.com
```

## Configuration Validation

The service validates configuration on startup:

### Valid Examples

```bash
✅ --port 3000                    # Valid port number
✅ --host 0.0.0.0                 # Valid IP address
✅ --cache-ttl 300                # Valid positive number
✅ --cacheable-methods GET,POST   # Valid HTTP methods
✅ --target-url https://api.com   # Valid URL
```

### Invalid Examples

```bash
❌ --port 99999                   # Port out of range
❌ --cache-ttl -1                 # Negative TTL
❌ --cacheable-methods INVALID    # Invalid HTTP method
❌ --target-url not-a-url         # Invalid URL format
```

## Advanced Configuration

### Custom Cache Strategy

You can modify cache behavior by HTTP method:

```bash
# Cache GET requests for 1 hour, POST for 5 minutes
npm run dev -- \
  --cacheable-methods GET,POST \
  --cache-ttl 3600  # Default TTL for all methods
```

Note: Currently, TTL is global. Per-method TTL can be implemented as a future enhancement.

### Headers and Authentication

The service automatically forwards most headers, including:

- `Authorization` (included in cache key for user-specific caching)
- `Content-Type`
- `Accept`
- Custom headers

Excluded headers (automatically removed):

- `Host` (replaced with target host)
- `Content-Length` (recalculated)

### Logging Configuration

Logging is controlled by `NODE_ENV`:

```bash
# Development (pretty logs)
NODE_ENV=development npm run dev

# Production (JSON logs)
NODE_ENV=production npm start
```

## Configuration Best Practices

### 1. Security

```bash
# Don't expose on all interfaces in production without proper security
❌ --host 0.0.0.0  # In production without firewall
✅ --host 127.0.0.1  # Local only
✅ --host 0.0.0.0   # With proper firewall/reverse proxy
```

### 2. Performance

```bash
# Cache frequently accessed, stable data longer
--cache-ttl 3600    # 1 hour for reference data
--cache-ttl 300     # 5 minutes for dynamic data
--cache-ttl 60      # 1 minute for real-time data
```

### 3. Methods to Cache

```bash
# Conservative (traditional proxy)
--cacheable-methods GET

# BFF/API Gateway (recommended)
--cacheable-methods GET,POST

# Aggressive (be careful with side effects)
--cacheable-methods GET,POST,PUT,PATCH
```

### 4. Resource Limits

Consider memory usage for caching:

```bash
# Light caching
--cache-ttl 60      # Short TTL, less memory usage

# Heavy caching
--cache-ttl 3600    # Long TTL, more memory usage
```

## Troubleshooting Configuration

### Common Issues

1. **Port Already in Use**

   ```bash
   # Check what's using the port
   lsof -i :4000
   # Use a different port
   npm run dev -- --port 4001
   ```

2. **Invalid Target URL**

   ```bash
   # Ensure URL is accessible
   curl https://api.example.com/health
   ```

3. **Cache Not Working**
   ```bash
   # Check cacheable methods include your request method
   npm run dev -- --cacheable-methods GET,POST
   # Verify TTL is not 0
   npm run dev -- --cache-ttl 300
   ```

---

**Next:** Learn about available endpoints in the [API Reference](./api-reference.md).
