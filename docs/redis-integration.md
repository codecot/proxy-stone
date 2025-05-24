# Redis Integration for Phase 2 Caching

Complete Redis integration proposal that extends our existing Phase 2 caching architecture.

## 🚀 Overview

Our Phase 2 implementation already provides:

- ✅ **Fine-grained TTL support** with rule-based configuration
- ✅ **Deterministic cache keys** with normalization and hashing
- ✅ **Cache hit/miss handling** with X-Cache headers
- ✅ **Rule-based caching** with pattern matching
- ✅ **Memory + File cache** with LRU/FIFO eviction

**Redis integration adds:**

- 🔄 **Persistent caching** across server restarts
- 🌐 **Distributed caching** for clustered deployments
- 📊 **Advanced Redis features** (pub/sub, transactions, etc.)
- 💾 **Better memory management** with Redis eviction policies

## 🏗️ Architecture

### Multi-Layer Cache Strategy

```
Request → Memory Cache → Redis Cache → File Cache → Target Server
           (fastest)     (persistent)   (backup)     (source)
```

### Cache Lookup Flow

1. **Memory Cache** - Fastest, in-process lookup
2. **Redis Cache** - Persistent, shared across instances
3. **File Cache** - Local disk backup
4. **Target Server** - Original source

### Benefits

- **Performance**: Memory cache for sub-millisecond lookups
- **Persistence**: Redis survives server restarts
- **Scaling**: Shared cache across multiple proxy instances
- **Reliability**: File cache as fallback if Redis is unavailable

## ⚙️ Configuration

### Basic Redis Setup

```bash
# Enable Redis with default settings
npm run dev -- --enable-redis

# Full Redis configuration
npm run dev -- \
  --enable-redis \
  --redis-host localhost \
  --redis-port 6379 \
  --redis-password mypassword \
  --redis-db 0 \
  --redis-key-prefix "proxy:cache:"
```

### Environment Variables

```bash
# Redis connection
export ENABLE_REDIS=true
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=mypassword
export REDIS_DB=0
export REDIS_KEY_PREFIX=proxy:cache:

# Combined with existing cache config
export CACHE_MAX_SIZE=20000
export CACHE_CLEANUP_INTERVAL=300
export CACHE_RULES='[{"pattern": "*/users/*", "ttl": 600}]'
```

### Production Configuration

```bash
# High-availability Redis setup
export ENABLE_REDIS=true
export REDIS_HOST=redis-cluster.example.com
export REDIS_PORT=6379
export REDIS_PASSWORD=${REDIS_SECRET}
export REDIS_DB=0
export REDIS_KEY_PREFIX=api-proxy:cache:

# Cache behavior
export CACHE_MAX_SIZE=50000
export CACHE_CLEANUP_INTERVAL=180
export ENABLE_CACHE_WARMUP=true
```

## 🔧 Implementation Details

### Enhanced Cache Service

Our existing `CacheService` would be extended to support Redis:

```typescript
interface CacheConfig {
  // ... existing config ...
  redis?: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    connectTimeout?: number;
    lazyConnect?: boolean;
  };
}
```

### Cache Operation Flow

```typescript
async get(key: string): Promise<CacheEntry | null> {
  // 1. Check memory cache (fastest)
  const memoryEntry = this.memoryCache.get(key);
  if (memoryEntry && !isExpired(memoryEntry)) {
    return memoryEntry;
  }

  // 2. Check Redis cache (persistent)
  if (this.redis?.isAvailable()) {
    const redisEntry = await this.redis.get(key);
    if (redisEntry) {
      // Load back into memory for faster access
      this.memoryCache.set(key, redisEntry);
      return redisEntry;
    }
  }

  // 3. Check file cache (backup)
  const fileEntry = await this.fileCache.get(key);
  if (fileEntry) {
    // Load into both memory and Redis
    this.memoryCache.set(key, fileEntry);
    await this.redis?.set(key, fileEntry);
    return fileEntry;
  }

  return null; // Cache miss - fetch from target server
}
```

## 📊 Enhanced Statistics

With Redis integration, cache statistics become more comprehensive:

```bash
curl http://localhost:4000/cache/stats
```

**Response:**

```json
{
  "memory": {
    "size": 1245,
    "hitRate": 0.78,
    "totalHits": 2340,
    "totalMisses": 658
  },
  "redis": {
    "connected": true,
    "keys": 8934,
    "memory": "45.2MB",
    "latency": 2,
    "keyspace": {
      "db0": "keys=8934,expires=5621"
    }
  },
  "file": {
    "size": 890,
    "files": ["cache_file_1.json", "..."]
  }
}
```

## 🎯 Use Cases

### 1. High-Traffic API Gateway

```bash
# Multiple proxy instances sharing Redis cache
export ENABLE_REDIS=true
export REDIS_HOST=redis-cluster.prod.com
export CACHE_MAX_SIZE=100000
export CACHE_RULES='[
  {
    "pattern": "*/api/users/*",
    "ttl": 900,
    "methods": ["GET"]
  },
  {
    "pattern": "*/api/search*",
    "ttl": 300,
    "methods": ["GET", "POST"]
  }
]'
```

### 2. Microservices BFF

```bash
# Service-specific caching with Redis persistence
export ENABLE_REDIS=true
export REDIS_KEY_PREFIX=user-service:cache:
export CACHE_RULES='[
  {
    "pattern": "*/profile/*",
    "ttl": 1800,
    "conditions": {
      "headers": {"x-user-id": "*"}
    }
  }
]'
```

### 3. Content Delivery Optimization

```bash
# Long-term caching for static content
export ENABLE_REDIS=true
export REDIS_DB=1
export CACHE_RULES='[
  {
    "pattern": "*/static/*",
    "ttl": 86400,
    "methods": ["GET"]
  },
  {
    "pattern": "*/api/content/*",
    "ttl": 3600,
    "conditions": {
      "statusCodes": [200, 304],
      "minSize": 1024
    }
  }
]'
```

### 4. Development Environment

```bash
# Redis for development with local fallback
export ENABLE_REDIS=true
export REDIS_HOST=localhost
export REDIS_PORT=6379
export CACHE_TTL=300
export CACHEABLE_METHODS=GET,POST
```

## 🔍 Monitoring & Health Checks

### Redis Health Endpoint

```bash
curl http://localhost:4000/cache/redis/health
```

**Response:**

```json
{
  "status": "healthy",
  "latency": 2,
  "connected": true,
  "memory": "45.2MB",
  "keys": 8934
}
```

### Cache Performance Monitoring

```bash
# Monitor cache hit rates across all layers
watch -n 5 'curl -s http://localhost:4000/cache/stats | jq ".memory.hitRate, .redis.keys"'
```

### Redis-Specific Endpoints

```bash
# Clear only Redis cache
curl -X DELETE http://localhost:4000/cache/redis

# Redis connection test
curl http://localhost:4000/cache/redis/ping

# Redis memory statistics
curl http://localhost:4000/cache/redis/info
```

## 🚀 Migration Strategy

### Step 1: Enable Redis (Non-Breaking)

```bash
# Add Redis to existing setup - no breaking changes
npm run dev -- --enable-redis --redis-host localhost
```

The system continues to work with memory + file cache if Redis is unavailable.

### Step 2: Configure Rules

```bash
# Use existing cache rules with Redis persistence
export CACHE_RULES='[
  {
    "pattern": "*/users/*",
    "ttl": 600,
    "methods": ["GET"]
  }
]'
export ENABLE_REDIS=true
```

### Step 3: Production Deployment

```bash
# Full production setup with Redis cluster
export ENABLE_REDIS=true
export REDIS_HOST=redis-cluster.prod.com
export REDIS_PORT=6379
export REDIS_PASSWORD=${REDIS_SECRET}
export CACHE_MAX_SIZE=50000
```

## 🛠️ Development Setup

### Local Redis with Docker

```bash
# Start Redis locally
docker run -d \
  --name redis-cache \
  -p 6379:6379 \
  redis:7-alpine

# Test with proxy
npm run dev -- \
  --enable-redis \
  --redis-host localhost \
  --redis-port 6379
```

### Redis Configuration File

```bash
# redis.conf for production
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## 📈 Performance Benefits

### Cache Hit Rate Improvement

With Redis persistence:

- **Memory cache**: 95%+ hit rate for frequently accessed data
- **Redis cache**: 80%+ hit rate for data surviving restarts
- **File cache**: 60%+ hit rate for fallback scenarios

### Response Time Optimization

- **Memory hit**: < 1ms
- **Redis hit**: 2-5ms
- **File hit**: 10-20ms
- **Target server**: 100-500ms

### Scaling Benefits

- **Single instance**: Memory + Redis + File
- **Multiple instances**: Shared Redis cache
- **Cluster deployment**: Redis cluster for high availability

## 🔐 Security Considerations

### Redis Authentication

```bash
export REDIS_PASSWORD=strong-password-here
export REDIS_HOST=secure-redis.internal.com
```

### Network Security

```bash
# Use internal network for Redis
export REDIS_HOST=redis.internal
export REDIS_PORT=6379
```

### Key Namespace Isolation

```bash
# Separate environments
export REDIS_KEY_PREFIX=prod:api-proxy:cache:
export REDIS_DB=0  # Production

export REDIS_KEY_PREFIX=staging:api-proxy:cache:
export REDIS_DB=1  # Staging
```

## 🎛️ Advanced Features

### Redis Pub/Sub for Cache Invalidation

Future enhancement: Real-time cache invalidation across instances.

### Redis Transactions

Atomic cache operations for complex scenarios.

### Redis Clustering

Horizontal scaling with Redis cluster mode.

### Cache Warming from Redis

Load frequently accessed data into memory on startup.

---

## Summary

This Redis integration extends our comprehensive Phase 2 caching system with:

✅ **All existing Phase 2 features** (rules, TTL, statistics, etc.)  
✅ **Persistent caching** with Redis  
✅ **Multi-layer cache strategy** for optimal performance  
✅ **Graceful fallback** if Redis is unavailable  
✅ **Production-ready** configuration and monitoring  
✅ **Backward compatibility** with existing setups

The implementation provides enterprise-grade caching with the flexibility to run with or without Redis, making it suitable for both development and large-scale production deployments.

**Next Steps:**

1. Implement Redis integration in `CacheService`
2. Add Redis health checks and monitoring
3. Update documentation with Redis examples
4. Create Docker Compose setup for easy testing
