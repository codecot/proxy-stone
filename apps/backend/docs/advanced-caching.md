# Advanced Caching Guide (Phase 2)

Enhanced caching system with fine-grained TTL control, rule-based caching, and optimized cache behavior.

## Features Overview

### 🎯 Fine-Grained TTL Support

- Per-route TTL configuration
- Pattern-based TTL rules
- Method-specific caching policies
- Dynamic TTL based on response characteristics

### 🔑 Deterministic Cache Keys

- Normalized URL processing
- Header filtering and inclusion
- Consistent key generation
- Optional key hashing for long keys

### ⚡ Optimized Cache Operations

- LRU/FIFO eviction policies
- Background cleanup
- Cache statistics and monitoring
- Hit rate optimization

### 📋 Rule-Based Cache Behavior

- URL pattern matching
- Conditional caching
- Response size filtering
- Status code filtering

## Configuration

### Basic Setup

```bash
# Enable advanced caching with default rules
npm run dev -- \
  --enable-cache-warmup \
  --cache-max-size 20000 \
  --cache-cleanup-interval 300
```

### Environment Variables

```bash
# Advanced cache configuration
export CACHE_MAX_SIZE=20000
export CACHE_CLEANUP_INTERVAL=300
export ENABLE_CACHE_WARMUP=true
export CACHE_KEY_HEADERS="x-tenant-id,x-user-type"

# Custom cache rules (JSON format)
export CACHE_RULES='[
  {
    "pattern": "*/api/users/*",
    "methods": ["GET"],
    "ttl": 600,
    "conditions": {
      "statusCodes": [200, 201]
    }
  }
]'
```

## Cache Rules

### Rule Structure

```typescript
interface CacheRule {
  pattern: string; // URL pattern (glob syntax)
  methods?: string[]; // HTTP methods
  ttl?: number; // TTL in seconds
  enabled?: boolean; // Enable/disable caching
  conditions?: {
    headers?: Record<string, string>; // Required headers
    statusCodes?: number[]; // Cacheable status codes
    minSize?: number; // Minimum response size
    maxSize?: number; // Maximum response size
  };
}
```

### Default Rules

The system includes intelligent default rules:

```typescript
const defaultRules = [
  {
    pattern: '*/health*',
    methods: ['GET'],
    ttl: 30, // Health checks cached for 30 seconds
    enabled: true,
  },
  {
    pattern: '*/search*',
    methods: ['GET', 'POST'],
    ttl: 300, // Search results cached for 5 minutes
    enabled: true,
  },
  {
    pattern: '*/users/*',
    methods: ['GET'],
    ttl: 600, // User data cached for 10 minutes
    enabled: true,
  },
  {
    pattern: '*/config*',
    methods: ['GET'],
    ttl: 3600, // Configuration cached for 1 hour
    enabled: true,
  },
];
```

### Custom Rules Examples

#### E-commerce API Rules

```json
[
  {
    "pattern": "*/products/*",
    "methods": ["GET"],
    "ttl": 1800,
    "conditions": {
      "statusCodes": [200]
    }
  },
  {
    "pattern": "*/inventory/*",
    "methods": ["GET"],
    "ttl": 60,
    "conditions": {
      "headers": {
        "x-real-time": "false"
      }
    }
  },
  {
    "pattern": "*/cart/*",
    "methods": ["GET"],
    "ttl": 30,
    "enabled": true
  },
  {
    "pattern": "*/checkout/*",
    "methods": ["GET", "POST"],
    "enabled": false
  }
]
```

#### Content Management Rules

```json
[
  {
    "pattern": "*/articles/*",
    "methods": ["GET"],
    "ttl": 3600,
    "conditions": {
      "minSize": 1000,
      "statusCodes": [200]
    }
  },
  {
    "pattern": "*/media/*",
    "methods": ["GET"],
    "ttl": 86400,
    "conditions": {
      "maxSize": 1048576
    }
  }
]
```

#### Search API Rules

```json
[
  {
    "pattern": "*/search",
    "methods": ["POST"],
    "ttl": 900,
    "conditions": {
      "headers": {
        "content-type": "application/json"
      },
      "minSize": 100
    }
  },
  {
    "pattern": "*/autocomplete*",
    "methods": ["GET"],
    "ttl": 300,
    "enabled": true
  }
]
```

## Cache Key Configuration

### Key Options

```typescript
interface KeyOptions {
  includeHeaders?: string[]; // Headers to include in cache key
  excludeHeaders?: string[]; // Headers to exclude from cache key
  normalizeUrl?: boolean; // Normalize URLs for consistency
  hashLongKeys?: boolean; // Hash keys longer than maxKeyLength
  maxKeyLength?: number; // Maximum key length before hashing
}
```

### Default Key Configuration

```typescript
const defaultKeyOptions = {
  includeHeaders: ['authorization', 'x-user-id', 'x-tenant-id'],
  excludeHeaders: ['user-agent', 'accept-encoding', 'connection'],
  normalizeUrl: true,
  hashLongKeys: true,
  maxKeyLength: 200,
};
```

### Custom Key Headers

```bash
# Include additional headers in cache keys
npm run dev -- --cache-key-headers "x-tenant-id,x-user-type,x-version"
```

This creates user-specific and tenant-specific cache isolation:

```
# Without tenant header
GET:https://api.example.com/users:Bearer token123:

# With tenant header
GET:https://api.example.com/users:Bearer token123|x-tenant-id:acme:
```

## Cache Behavior Configuration

### Behavior Options

```typescript
interface CacheBehavior {
  warmupEnabled?: boolean; // Load cache on startup
  backgroundCleanup?: boolean; // Automatic cleanup
  cleanupInterval?: number; // Cleanup frequency (seconds)
  maxSize?: number; // Maximum cache entries
  evictionPolicy?: 'lru' | 'fifo'; // Eviction strategy
}
```

### Example Configurations

#### High-Performance Setup

```bash
npm run dev -- \
  --cache-max-size 50000 \
  --cache-cleanup-interval 300 \
  --enable-cache-warmup
```

#### Memory-Conscious Setup

```bash
npm run dev -- \
  --cache-max-size 5000 \
  --cache-cleanup-interval 120
```

## Cache Statistics

### Enhanced Statistics Endpoint

```bash
curl http://localhost:4000/cache/stats
```

**Response:**

```json
{
  "memory": {
    "size": 1245,
    "keys": ["GET:https://api.example.com/users:::", "..."],
    "hitRate": 0.78,
    "totalHits": 2340,
    "totalMisses": 658
  },
  "file": {
    "size": 890,
    "files": ["cache_file_1.json", "..."]
  },
  "config": {
    "defaultTTL": 300,
    "methods": ["GET", "POST"],
    "totalRules": 6,
    "keyOptions": {
      "includeHeaders": ["authorization", "x-user-id"],
      "normalizeUrl": true,
      "hashLongKeys": true
    },
    "behavior": {
      "maxSize": 10000,
      "evictionPolicy": "lru",
      "backgroundCleanup": true
    }
  },
  "rules": [
    {
      "pattern": "*/users/*",
      "methods": ["GET"],
      "ttl": 600,
      "enabled": true,
      "hasConditions": false
    }
  ]
}
```

### Cache Rules Endpoint

```bash
curl http://localhost:4000/cache/rules
```

View all configured cache rules and their settings.

### Test Cache Rule Matching

```bash
curl -X POST http://localhost:4000/cache/test-rule \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "url": "https://api.example.com/users/123",
    "headers": {"authorization": "Bearer token"}
  }'
```

**Response:**

```json
{
  "cacheKey": "GET:https://api.example.com/users/123:authorization:Bearer token:",
  "keyLength": 67,
  "isHashedKey": false,
  "testUrl": "https://api.example.com/users/123",
  "testMethod": "GET",
  "testHeaders": { "authorization": "Bearer token" }
}
```

## Cache Headers

Enhanced cache headers provide detailed information:

| Header        | Example | Description                    |
| ------------- | ------- | ------------------------------ |
| `X-Cache`     | `HIT`   | Cache hit or miss              |
| `X-Cache-TTL` | `600`   | TTL used for this entry        |
| `X-Cache-Age` | `45`    | Age of cached entry in seconds |

### Example Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: HIT
X-Cache-Method: GET
X-Cache-TTL: 600
X-Cache-Age: 45
```

## Use Cases & Examples

### 1. Multi-Tenant SaaS Application

```bash
# Configure tenant-specific caching
export CACHE_KEY_HEADERS="x-tenant-id"
export CACHE_RULES='[
  {
    "pattern": "*/tenant/*/users*",
    "methods": ["GET"],
    "ttl": 900,
    "conditions": {
      "headers": {"x-tenant-id": "*"}
    }
  }
]'
```

### 2. API Gateway with Service-Specific TTLs

```bash
export CACHE_RULES='[
  {
    "pattern": "*/auth/*",
    "enabled": false
  },
  {
    "pattern": "*/users/*",
    "ttl": 600,
    "methods": ["GET"]
  },
  {
    "pattern": "*/analytics/*",
    "ttl": 3600,
    "methods": ["GET", "POST"]
  },
  {
    "pattern": "*/real-time/*",
    "ttl": 10,
    "methods": ["GET"]
  }
]'
```

### 3. Content Delivery Optimization

```bash
export CACHE_RULES='[
  {
    "pattern": "*/static/*",
    "ttl": 86400,
    "methods": ["GET"],
    "conditions": {
      "statusCodes": [200, 304]
    }
  },
  {
    "pattern": "*/api/content/*",
    "ttl": 1800,
    "methods": ["GET"],
    "conditions": {
      "minSize": 500,
      "maxSize": 104857600
    }
  }
]'
```

### 4. Search API Optimization

```bash
export CACHE_RULES='[
  {
    "pattern": "*/search*",
    "ttl": 300,
    "methods": ["GET", "POST"],
    "conditions": {
      "statusCodes": [200],
      "minSize": 50
    }
  },
  {
    "pattern": "*/suggest*",
    "ttl": 600,
    "methods": ["GET"]
  }
]'
```

## Performance Optimization

### Cache Hit Rate Optimization

1. **Tune TTL Values**

   ```bash
   # Monitor hit rates and adjust TTL
   curl http://localhost:4000/cache/stats
   ```

2. **Optimize Key Inclusion**

   ```bash
   # Include only necessary headers in cache keys
   --cache-key-headers "authorization,x-tenant-id"
   ```

3. **Use Appropriate Cache Size**
   ```bash
   # Balance memory usage vs hit rate
   --cache-max-size 20000
   ```

### Memory Management

1. **LRU Eviction** (recommended for most use cases)

   ```bash
   # Default - keeps frequently accessed items
   --cache-max-size 10000
   ```

2. **FIFO Eviction** (for time-sensitive data)
   ```bash
   # Evicts oldest entries first
   # Configure via advanced cache configuration
   ```

### Background Cleanup

```bash
# Automatic cleanup every 5 minutes
--cache-cleanup-interval 300
```

Manual cleanup:

```bash
curl -X POST http://localhost:4000/cache/clean
```

## Debugging & Troubleshooting

### Debug Cache Configuration

```bash
curl http://localhost:4000/debug/config
```

### Monitor Cache Performance

```bash
# Watch cache statistics
watch -n 5 'curl -s http://localhost:4000/cache/stats | jq ".memory.hitRate"'
```

### Test Cache Rules

```bash
# Test if a URL matches cache rules
curl -X POST http://localhost:4000/cache/test-rule \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "url": "https://api.example.com/special/endpoint",
    "headers": {"authorization": "Bearer test"}
  }'
```

### Common Issues

1. **Low Hit Rate**

   - Check if URLs are normalized consistently
   - Verify cache key headers are appropriate
   - Ensure TTL values are not too low

2. **Memory Usage**

   - Reduce `maxSize` setting
   - Enable more aggressive cleanup
   - Check for very large response caching

3. **Cache Misses**
   - Verify cache rules are matching intended patterns
   - Check if headers are included correctly in cache keys
   - Ensure TTL is sufficient for your use case

## Migration from Phase 1

The Phase 2 implementation is fully backward compatible. Legacy configuration still works:

```bash
# Legacy (still works)
--cache-ttl 300
--cacheable-methods GET,POST

# Enhanced (new features)
--cache-rules '[{"pattern": "*/users/*", "ttl": 600}]'
--cache-key-headers "x-tenant-id"
```

To migrate to Phase 2 features:

1. **Replace global TTL with rules**
2. **Configure key headers for multi-tenancy**
3. **Set up cache size limits**
4. **Enable background cleanup**

---

**Next:** Explore [API Reference](./api-reference.md) for complete endpoint documentation.
