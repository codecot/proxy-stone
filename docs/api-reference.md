# API Reference

Complete reference for all available endpoints in the BFF/API Middleware service.

## Base URL

By default, the service runs on:

- **Development**: `http://localhost:4000`
- **Production**: Configured via `--port` and `--host`

## Endpoint Types

The service provides two types of endpoints:

1. **Service Management Endpoints** (`/api/*`) - For managing the proxy service itself
2. **Proxy Endpoints** (`/proxy/*`) - For forwarding requests to target servers

## Service Management Endpoints

These endpoints manage the proxy service itself and are protected by authentication when enabled.

### Health Check

Get service status and cache information.

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "cache": {
    "size": 5,
    "keys": [
      "GET:https://api.example.com/users:::",
      "POST:https://api.example.com/search::{\"query\":\"test\"}"
    ]
  }
}
```

**Example:**

```bash
curl http://localhost:4000/health
```

### Cache Statistics

Get detailed cache statistics.

**Endpoint:** `GET /api/cache/stats`

**Response:**

```json
{
  "size": 3,
  "keys": [
    "GET:https://httpbin.org/get:::",
    "POST:https://httpbin.org/post::{\"test\":\"value\"}",
    "GET:https://httpbin.org/uuid:::"
  ]
}
```

**Example:**

```bash
curl http://localhost:4000/api/cache/stats
```

### Clear Cache

Clear all cached entries.

**Endpoint:** `DELETE /api/cache`

**Response:**

```json
{
  "message": "Cache cleared successfully"
}
```

**Example:**

```bash
curl -X DELETE http://localhost:4000/api/cache
```

### Clean Expired Entries

Remove expired cache entries manually.

**Endpoint:** `POST /api/cache/clean`

**Response:**

```json
{
  "message": "Cleaned 2 expired cache entries"
}
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/cache/clean
```

## Proxy Endpoints

### API Forwarding

Forward requests to the configured target server.

**Endpoint:** `ANY {apiPrefix}/*`

**Default API Prefix:** `/proxy`

**Supported Methods:** GET, POST, PUT, DELETE, PATCH, HEAD

**Headers Added:**

- `X-Cache`: `HIT` or `MISS`
- `X-Cache-Method`: HTTP method used
- Plus all headers from target server

#### GET Request

**Example:**

```bash
curl http://localhost:4000/proxy/get
```

**Response Headers:**

```
X-Cache: MISS
X-Cache-Method: GET
Content-Type: application/json
```

#### POST Request with JSON

**Example:**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":"123"}' \
  http://localhost:4000/proxy/post
```

#### POST Request with Form Data

**Example:**

```bash
curl -X POST \
  -d "key1=value1&key2=value2" \
  http://localhost:4000/proxy/post
```

#### PUT Request

**Example:**

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{"id":1,"name":"updated"}' \
  http://localhost:4000/proxy/users/1
```

#### DELETE Request

**Example:**

```bash
curl -X DELETE http://localhost:4000/proxy/users/1
```

### Query Parameters

Query parameters are forwarded to the target server:

**Example:**

```bash
curl "http://localhost:4000/proxy/search?q=nodejs&limit=10"
```

This forwards to: `{targetUrl}/search?q=nodejs&limit=10`

### Authentication

Authorization headers are forwarded and included in cache keys:

**Example:**

```bash
curl -H "Authorization: Bearer your-token" \
  http://localhost:4000/proxy/user/profile
```

Different users get separate cache entries based on their authorization token.

## Response Format

### Successful Proxy Response

The service forwards the exact response from the target server with additional headers:

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: HIT
X-Cache-Method: GET
Date: Wed, 24 May 2023 10:00:00 GMT

{
  "data": "response from target server"
}
```

### Error Response

When the service cannot forward the request:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Proxy Error",
  "message": "Failed to forward request to target server",
  "timestamp": "2023-05-24T10:00:00.000Z"
}
```

## Cache Behavior

### Cache Key Generation

Cache keys are generated using:

```
{method}:{target_url}:{authorization_header}:{request_body}
```

**Examples:**

- `GET:https://api.example.com/users:::`
- `POST:https://api.example.com/search:Bearer token123:{"query":"test"}`
- `GET:https://api.example.com/profile:Bearer user456:`

### Cache Headers

| Header           | Value       | Description                         |
| ---------------- | ----------- | ----------------------------------- |
| `X-Cache`        | `HIT`       | Response served from cache          |
| `X-Cache`        | `MISS`      | Response fetched from target server |
| `X-Cache-Method` | HTTP method | Method used for the request         |

### Cacheable Conditions

Requests are cached when:

1. HTTP method is in `cacheableMethods` configuration (default: GET, POST)
2. Response status code is 2xx (200-299)
3. Cache TTL is greater than 0

### Cache Expiration

- Entries expire based on TTL (default: 300 seconds)
- Expired entries are automatically cleaned every 10 minutes
- Manual cleanup available via `POST /cache/clean`

## Configuration Examples

### Custom API Prefix

```bash
npm run dev -- --api-prefix /v1/api

# Requests now go to:
curl http://localhost:4000/v1/api/users
```

### Different Target Server

```bash
npm run dev -- --target-url https://jsonplaceholder.typicode.com

# Test with:
curl http://localhost:4000/proxy/users/1
curl http://localhost:4000/proxy/posts
```

### Custom Cacheable Methods

```bash
npm run dev -- --cacheable-methods GET,POST,PUT

# PUT requests are now cached:
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{"name":"updated"}' \
  http://localhost:4000/proxy/users/1
```

## Error Handling

### Common HTTP Status Codes

| Status  | Description            | Cause                                |
| ------- | ---------------------- | ------------------------------------ |
| 200-299 | Success                | Request forwarded successfully       |
| 415     | Unsupported Media Type | Missing formbody plugin registration |
| 500     | Internal Server Error  | Network error, invalid target URL    |
| 503     | Service Unavailable    | Target server unreachable            |

### Debugging with Logs

Enable verbose logging to debug issues:

```bash
# Development with detailed logs
NODE_ENV=development npm run dev

# Check logs for:
# - Request forwarding details
# - Cache hit/miss information
# - Error messages with full context
```

## Rate Limiting Considerations

The service itself doesn't implement rate limiting, but cache can help:

- **Cache hits** don't count toward target server rate limits
- **Cache misses** do count toward target server rate limits
- Configure appropriate TTL to balance freshness vs. rate limit protection

## Security Notes

### Headers Forwarded

**Automatically forwarded:**

- `Authorization`
- `Content-Type`
- `Accept`
- `User-Agent`
- Custom headers

**Automatically excluded:**

- `Host` (replaced with target host)
- `Content-Length` (recalculated)
- `Content-Encoding` (from responses)
- `Transfer-Encoding` (from responses)

### Authentication Proxy

The service can act as an authentication proxy:

```bash
# Add authentication header for all requests
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:4000/proxy/protected-endpoint
```

## Example Workflows

### 1. API Development

```bash
# Proxy to production API during development
npm run dev -- --target-url https://api.production.com

# Make authenticated requests
curl -H "Authorization: Bearer dev-token" \
  http://localhost:4000/proxy/user/profile
```

### 2. API Testing

```bash
# Cache responses for consistent testing
npm run dev -- --cache-ttl 3600

# First request populates cache
curl http://localhost:4000/proxy/test-data

# Subsequent requests use cached data
curl http://localhost:4000/proxy/test-data  # X-Cache: HIT
```

### 3. Load Testing

```bash
# Use cache to reduce backend load during tests
npm run dev -- \
  --cacheable-methods GET,POST \
  --cache-ttl 300

# Run load tests against the proxy instead of backend
```

---

**Next:** Learn about caching strategies in the [Caching Guide](./caching.md).
