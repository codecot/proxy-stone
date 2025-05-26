# Quick Start Guide

Get the BFF/API Middleware service running in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd proxy-server-ts
npm install
```

2. **Start the development server:**

```bash
npm run dev
```

The service will start on `http://localhost:4000` by default.

## Basic Usage

### 1. Health Check

```bash
curl http://localhost:4000/health
```

**Response:**

```json
{
  "status": "ok",
  "cache": {
    "size": 0,
    "keys": []
  }
}
```

### 2. Make API Requests

By default, the service forwards requests to `https://httpbin.org`:

```bash
# GET request
curl http://localhost:4000/proxy/get

# POST request with JSON
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":"123"}' \
  http://localhost:4000/proxy/post

# POST request with form data
curl -X POST \
  -d "key1=value1&key2=value2" \
  http://localhost:4000/proxy/post
```

### 3. Observe Caching

Make the same GET request twice to see caching in action:

```bash
# First request (cache miss)
curl -v http://localhost:4000/proxy/get
# Look for: X-Cache: MISS

# Second request (cache hit)
curl -v http://localhost:4000/proxy/get
# Look for: X-Cache: HIT
```

## Configuration Examples

### Change Target Server

```bash
# Proxy to JSONPlaceholder API
npm run dev -- --target-url https://jsonplaceholder.typicode.com

# Test it
curl http://localhost:4000/proxy/users
curl http://localhost:4000/proxy/posts/1
```

### Custom Port and Host

```bash
npm run dev -- --port 8080 --host 0.0.0.0
```

### Custom API Prefix

```bash
npm run dev -- --api-prefix /v1/api

# Requests now go to:
curl http://localhost:4000/v1/api/users
```

### Cache Configuration

```bash
# Cache for 10 minutes, include PUT requests
npm run dev -- --cache-ttl 600 --cacheable-methods GET,POST,PUT
```

## Environment Variables

You can also use environment variables:

```bash
export PORT=8080
export HOST=0.0.0.0
export TARGET_URL=https://api.github.com
export API_PREFIX=/github
export CACHE_TTL=300
export CACHEABLE_METHODS=GET,POST

npm run dev
```

## Production Build

```bash
# Build the project
npm run build

# Start in production mode
npm start -- --port 3000 --target-url https://api.production.com
```

## Cache Management

### View Cache Stats

```bash
curl http://localhost:4000/api/cache/stats
```

### Clear Cache

```bash
curl -X DELETE http://localhost:4000/api/cache
```

### Clean Expired Entries

```bash
curl -X POST http://localhost:4000/api/cache/clean
```

## Common Use Cases

### 1. Development Proxy

```bash
# Proxy to production API during development
npm run dev -- --target-url https://api.production.com
```

### 2. API Aggregation

```bash
# Set up multiple instances for different services
npm run dev -- --port 4001 --api-prefix /users --target-url https://users.api.com
npm run dev -- --port 4002 --api-prefix /orders --target-url https://orders.api.com
```

### 3. Search API Caching

```bash
# Cache POST requests for search APIs
npm run dev -- \
  --target-url https://search.api.com \
  --cacheable-methods GET,POST \
  --cache-ttl 300
```

## Next Steps

- **[Configuration Guide](./configuration.md)** - Detailed configuration options
- **[API Reference](./api-reference.md)** - All available endpoints
- **[Caching Guide](./caching.md)** - Advanced caching strategies
- **[Deployment Guide](./deployment.md)** - Production deployment

## Troubleshooting

### Service Won't Start

- Check if the port is already in use
- Verify Node.js version (18+ required)
- Run `npm install` to ensure dependencies are installed

### No Cache Headers

- Ensure you're making GET or POST requests (or configured cacheable methods)
- Check that the target server is responding with 2xx status codes
- Verify cache TTL is not 0

### Target Server Connection Issues

- Verify the target URL is accessible
- Check firewall/network settings
- Review logs for detailed error messages

---

**Ready to dive deeper?** Check out the [Configuration Guide](./configuration.md) for advanced setup options.
