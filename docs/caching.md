# Caching Guide

Deep dive into the intelligent caching system of the BFF/API Middleware service.

## How Caching Works

The service implements an in-memory cache with TTL (Time-to-Live) expiration to reduce backend load and improve response times.

### Cache Architecture

```
Request → Cache Check → Cache Hit?
                        ├─ Yes: Return cached response (X-Cache: HIT)
                        └─ No: Forward to backend → Cache response → Return (X-Cache: MISS)
```

## Cache Key Generation

Cache keys uniquely identify requests and include:

```
{method}:{target_url}:{authorization_header}:{request_body}
```

### Key Components

1. **HTTP Method** - GET, POST, PUT, etc.
2. **Target URL** - Complete URL including query parameters
3. **Authorization Header** - Enables user-specific caching
4. **Request Body** - For POST/PUT requests with payload

### Examples

```bash
# GET request without auth
GET:https://api.example.com/users:::

# GET request with auth
GET:https://api.example.com/profile:Bearer abc123:

# POST request with body and auth
POST:https://api.example.com/search:Bearer abc123:{"query":"nodejs"}

# GET with query parameters
GET:https://api.example.com/posts?limit=10&offset=0:::
```

## Configuration

### Cache TTL (Time-to-Live)

Controls how long responses are cached:

```bash
# Cache for 5 minutes (default)
--cache-ttl 300

# Cache for 1 hour
--cache-ttl 3600

# Cache for 1 day
--cache-ttl 86400

# Disable caching
--cache-ttl 0
```

### Cacheable Methods

Configure which HTTP methods should be cached:

```bash
# Only cache GET requests (traditional)
--cacheable-methods GET

# Cache GET and POST (recommended for BFF)
--cacheable-methods GET,POST

# Cache multiple methods (be careful with side effects)
--cacheable-methods GET,POST,PUT,PATCH
```

## User-Specific Caching

The cache isolates responses per user using the `Authorization` header:

```bash
# User A's request
curl -H "Authorization: Bearer user-a-token" \
  http://localhost:4000/api/profile

# User B's request (separate cache entry)
curl -H "Authorization: Bearer user-b-token" \
  http://localhost:4000/api/profile
```

This ensures users never see each other's data, even for the same endpoint.

## Cache Management

### View Cache Statistics

```bash
curl http://localhost:4000/cache/stats
```

**Response:**

```json
{
  "size": 5,
  "keys": [
    "GET:https://api.example.com/users:::",
    "POST:https://api.example.com/search:Bearer token123:{\"query\":\"test\"}"
  ]
}
```

### Clear All Cache

```bash
curl -X DELETE http://localhost:4000/cache
```

### Clean Expired Entries

```bash
curl -X POST http://localhost:4000/cache/clean
```

**Response:**

```json
{
  "message": "Cleaned 3 expired cache entries"
}
```

## Cache Headers

Every response includes cache information:

| Header           | Value       | Description                   |
| ---------------- | ----------- | ----------------------------- |
| `X-Cache`        | `HIT`       | Response served from cache    |
| `X-Cache`        | `MISS`      | Response fetched from backend |
| `X-Cache-Method` | HTTP method | Method used for the request   |

### Example Response Headers

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: HIT
X-Cache-Method: GET
Date: Wed, 24 May 2023 10:00:00 GMT
```

## Caching Strategies

### 1. Reference Data (Long TTL)

For data that changes infrequently:

```bash
# Cache user roles, categories, configurations
npm run dev -- \
  --target-url https://api.example.com \
  --cache-ttl 3600 \
  --cacheable-methods GET
```

**Best for:**

- User permissions/roles
- Configuration data
- Category lists
- Static content

### 2. Dynamic Data (Medium TTL)

For data that changes regularly but can tolerate some staleness:

```bash
# Cache user profiles, product lists
npm run dev -- \
  --target-url https://api.example.com \
  --cache-ttl 300 \
  --cacheable-methods GET,POST
```

**Best for:**

- User profiles
- Product catalogs
- Search results
- Feed content

### 3. Real-time Data (Short TTL)

For data that needs to be relatively fresh:

```bash
# Cache notifications, live data
npm run dev -- \
  --target-url https://api.example.com \
  --cache-ttl 60 \
  --cacheable-methods GET
```

**Best for:**

- Notifications
- Live data feeds
- Recent activity
- Status information

### 4. Search Optimization

Cache expensive search operations:

```bash
# Cache search results including POST requests
npm run dev -- \
  --target-url https://search.api.com \
  --cache-ttl 600 \
  --cacheable-methods GET,POST \
  --api-prefix /search
```

**Benefits:**

- Reduces expensive search operations
- Improves response times for popular queries
- Handles complex search payloads in POST requests

## Use Case Examples

### E-commerce API

```bash
# Product catalog (changes daily)
npm run dev -- \
  --port 4001 \
  --api-prefix /products \
  --target-url https://catalog.api.com \
  --cache-ttl 3600 \
  --cacheable-methods GET

# User data (changes frequently)
npm run dev -- \
  --port 4002 \
  --api-prefix /users \
  --target-url https://users.api.com \
  --cache-ttl 300 \
  --cacheable-methods GET,POST

# Search (expensive operations)
npm run dev -- \
  --port 4003 \
  --api-prefix /search \
  --target-url https://search.api.com \
  --cache-ttl 600 \
  --cacheable-methods GET,POST
```

### Content Management

```bash
# Articles and content (updated hourly)
npm run dev -- \
  --cache-ttl 3600 \
  --cacheable-methods GET \
  --target-url https://cms.api.com
```

### Social Media API

```bash
# Timeline and posts (updated frequently)
npm run dev -- \
  --cache-ttl 120 \
  --cacheable-methods GET,POST \
  --target-url https://social.api.com
```

## Cache Performance

### Memory Usage

Monitor cache size to avoid memory issues:

```bash
# Check current cache size
curl http://localhost:4000/cache/stats

# Clean expired entries if needed
curl -X POST http://localhost:4000/cache/clean
```

### Hit Rate Optimization

Improve cache effectiveness:

1. **Choose appropriate TTL**

   - Too short: Poor hit rate
   - Too long: Stale data

2. **Consider request patterns**

   - Cache frequently accessed endpoints
   - Include POST requests for search/filtering

3. **Monitor cache headers**
   ```bash
   # Check cache hit rate
   curl -v http://localhost:4000/api/users | grep X-Cache
   ```

## Automatic Cleanup

The service automatically cleans expired entries:

- **Frequency**: Every 10 minutes
- **Process**: Removes entries past their TTL
- **Logging**: Reports number of cleaned entries

```log
[10:00:00] INFO: Cleaned 5 expired cache entries
```

## Cache Limitations

### Current Limitations

1. **In-Memory Only** - Cache doesn't persist across restarts
2. **Single Instance** - No distributed caching
3. **Global TTL** - Same TTL for all methods/endpoints
4. **No Cache-Control** - Doesn't respect HTTP cache headers

### Memory Considerations

- Each cache entry stores: data + headers + metadata
- Large responses consume more memory
- Consider TTL vs. memory trade-offs

```bash
# Lighter memory usage
--cache-ttl 300

# Heavier memory usage
--cache-ttl 3600
```

## Advanced Configuration

### Method-Specific Caching

Currently, all cacheable methods use the same TTL. For different requirements:

```bash
# Conservative approach
--cacheable-methods GET --cache-ttl 3600

# Aggressive approach
--cacheable-methods GET,POST,PUT --cache-ttl 300
```

### API-Specific Instances

Run multiple instances for different caching strategies:

```bash
# Fast-changing user data
npm run dev -- \
  --port 4001 \
  --api-prefix /api/user \
  --cache-ttl 60

# Slow-changing reference data
npm run dev -- \
  --port 4002 \
  --api-prefix /api/ref \
  --cache-ttl 3600
```

## Troubleshooting

### Cache Not Working

1. **Check TTL**

   ```bash
   # Ensure TTL > 0
   npm run dev -- --cache-ttl 300
   ```

2. **Verify Method**

   ```bash
   # Ensure method is cacheable
   npm run dev -- --cacheable-methods GET,POST
   ```

3. **Check Response Status**
   - Only 2xx responses are cached
   - 4xx/5xx responses are never cached

### Poor Hit Rate

1. **Request Variations**

   - Different query parameters create different cache keys
   - Authorization headers create user-specific entries

2. **TTL Too Short**
   ```bash
   # Increase TTL if data allows
   npm run dev -- --cache-ttl 600
   ```

### Memory Issues

1. **Monitor Cache Size**

   ```bash
   curl http://localhost:4000/cache/stats
   ```

2. **Reduce TTL**

   ```bash
   npm run dev -- --cache-ttl 300
   ```

3. **Clean Cache Manually**
   ```bash
   curl -X DELETE http://localhost:4000/cache
   ```

---

**Next:** Learn about production deployment in the [Deployment Guide](./deployment.md).
