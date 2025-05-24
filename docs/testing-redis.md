# Testing Redis Integration

Complete testing guide for Phase 2 Redis integration features.

## 🚀 Quick Start

### 1. Start with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Services available:
# - Proxy Server: http://localhost:4000
# - Redis: localhost:6379
# - Redis Commander: http://localhost:8081
```

### 2. Test Basic Functionality

```bash
# Health check (should show Redis status)
curl http://localhost:4000/health

# Make a request to cache
curl http://localhost:4000/api/get

# Check cache statistics
curl http://localhost:4000/cache/stats
```

## 🧪 Test Scenarios

### 1. Cache Hit/Miss Testing

```bash
# First request (MISS)
curl -v http://localhost:4000/api/get
# Look for: X-Cache: MISS

# Second request (HIT from memory)
curl -v http://localhost:4000/api/get
# Look for: X-Cache: HIT

# Check cache stats
curl http://localhost:4000/cache/stats | jq '.memory.hitRate'
```

### 2. Redis Persistence Testing

```bash
# Make requests to populate cache
curl http://localhost:4000/api/users/123
curl http://localhost:4000/api/search?q=test

# Restart proxy service (Redis data persists)
docker-compose restart proxy

# Wait for startup and test cache
sleep 10
curl -v http://localhost:4000/api/users/123
# Should be HIT from Redis
```

### 3. Rule-Based TTL Testing

```bash
# Test user endpoint (600s TTL from docker-compose rules)
curl -v http://localhost:4000/api/users/456
# Check X-Cache-TTL header

# Test search endpoint (300s TTL)
curl -v http://localhost:4000/api/search?q=redis
# Check X-Cache-TTL header

# Verify rules are working
curl http://localhost:4000/cache/rules | jq '.rules'
```

### 4. Multi-Layer Cache Testing

```bash
# 1. Fresh request (populates all cache layers)
curl http://localhost:4000/api/profile/123

# 2. Clear memory cache only (Redis still has data)
curl -X DELETE http://localhost:4000/cache/memory

# 3. Request again (should hit Redis, reload to memory)
curl -v http://localhost:4000/api/profile/123
# Should still be fast (Redis hit)

# 4. Check cache statistics
curl http://localhost:4000/cache/stats
```

### 5. Cache Key Testing

```bash
# Test tenant-specific caching
curl -H "x-tenant-id: tenant1" http://localhost:4000/api/data
curl -H "x-tenant-id: tenant2" http://localhost:4000/api/data

# Verify separate cache entries
curl http://localhost:4000/cache/test-rule \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "url": "http://localhost:4000/api/data",
    "headers": {"x-tenant-id": "tenant1"}
  }'
```

## 📊 Monitoring & Debugging

### Redis Health Check

```bash
# Check Redis connection
curl http://localhost:4000/cache/redis/health

# Response should show:
{
  "status": "healthy",
  "latency": 2,
  "connected": true
}
```

### Cache Statistics

```bash
# Comprehensive cache stats
curl http://localhost:4000/cache/stats | jq '.'

# Expected structure:
{
  "memory": {
    "size": 5,
    "hitRate": 0.78,
    "totalHits": 12,
    "totalMisses": 3
  },
  "redis": {
    "connected": true,
    "keys": 15,
    "memory": "2.1MB"
  },
  "file": {
    "size": 8
  }
}
```

### Redis Commander UI

Visit http://localhost:8081 to:

- Browse cached keys
- View key expiration times
- Monitor Redis memory usage
- Manually inspect cache entries

## 🔧 Manual Redis Testing

### Direct Redis Commands

```bash
# Connect to Redis container
docker exec -it proxy-redis redis-cli

# List all cache keys
KEYS proxy:cache:*

# Get a specific cache entry
GET proxy:cache:GET:https://httpbin.org/get:::

# Check TTL of a key
TTL proxy:cache:GET:https://httpbin.org/users/123:::

# Monitor Redis commands in real-time
MONITOR
```

### Cache Operations

```bash
# Clear all cache
curl -X DELETE http://localhost:4000/cache

# Clear only Redis cache
curl -X DELETE http://localhost:4000/cache/redis

# Clear only memory cache
curl -X DELETE http://localhost:4000/cache/memory

# Clean expired entries
curl -X POST http://localhost:4000/cache/clean
```

## 🚨 Error Testing

### Redis Connection Failure

```bash
# Stop Redis
docker-compose stop redis

# Proxy should continue working with memory + file cache
curl http://localhost:4000/api/get
# Should work but show Redis as disconnected

# Check health (Redis should show as unhealthy)
curl http://localhost:4000/health

# Restart Redis
docker-compose start redis
# Connection should recover automatically
```

### Memory Pressure Testing

```bash
# Configure small cache size for testing
export CACHE_MAX_SIZE=5

# Make many requests to trigger eviction
for i in {1..10}; do
  curl http://localhost:4000/api/test$i
done

# Check if LRU eviction worked
curl http://localhost:4000/cache/stats
```

## 📈 Performance Testing

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test cache performance
ab -n 1000 -c 10 http://localhost:4000/api/get

# With cache warmup:
# - First run: Mix of hits/misses
# - Second run: Mostly cache hits (faster)
```

### Latency Measurement

```bash
# Measure response times
for i in {1..5}; do
  time curl -s http://localhost:4000/api/users/123 > /dev/null
done

# First request: Higher latency (cache miss)
# Subsequent: Lower latency (cache hit)
```

## 🔒 Security Testing

### Authentication Cache Isolation

```bash
# User 1 requests
curl -H "Authorization: Bearer user1-token" \
  http://localhost:4000/api/profile

# User 2 requests
curl -H "Authorization: Bearer user2-token" \
  http://localhost:4000/api/profile

# Verify separate cache entries in Redis Commander
# Keys should include authorization header in cache key
```

### Cache Key Inspection

```bash
# Test cache key generation
curl http://localhost:4000/cache/test-rule \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "url": "https://api.example.com/sensitive/data",
    "headers": {
      "authorization": "Bearer secret-token",
      "x-tenant-id": "acme"
    }
  }'

# Verify sensitive data is properly included in cache key
```

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**

   ```bash
   # Check Redis is running
   docker-compose ps redis

   # Check logs
   docker-compose logs redis
   ```

2. **Cache Not Working**

   ```bash
   # Verify cache configuration
   curl http://localhost:4000/debug/config | jq '.config.cache'

   # Check if method is cacheable
   curl http://localhost:4000/cache/rules
   ```

3. **High Memory Usage**

   ```bash
   # Check cache size
   curl http://localhost:4000/cache/stats | jq '.memory.size'

   # Manually clean cache
   curl -X POST http://localhost:4000/cache/clean
   ```

### Debug Logs

```bash
# Enable debug logging and restart
export LOG_LEVEL=debug
docker-compose restart proxy

# Watch logs for cache operations
docker-compose logs -f proxy | grep -i cache
```

## 📝 Test Checklist

### Basic Functionality

- [ ] Service starts successfully
- [ ] Redis connects properly
- [ ] Health endpoint shows cache status
- [ ] Basic proxy functionality works

### Cache Features

- [ ] Cache hits and misses work
- [ ] X-Cache headers are set correctly
- [ ] TTL values are respected
- [ ] Cache statistics are accurate

### Rule-Based Caching

- [ ] URL patterns match correctly
- [ ] Method-specific caching works
- [ ] TTL rules are applied properly
- [ ] Cache conditions work (headers, status codes)

### Multi-Layer Cache

- [ ] Memory cache is fastest
- [ ] Redis persistence across restarts
- [ ] File cache as fallback
- [ ] Graceful Redis failure handling

### Production Readiness

- [ ] Performance under load
- [ ] Memory management (eviction)
- [ ] Security (cache isolation)
- [ ] Monitoring and alerting

---

## Summary

This testing guide covers:

✅ **All Phase 2 features** with Redis integration  
✅ **Multi-layer cache testing** (Memory → Redis → File)  
✅ **Rule-based caching** validation  
✅ **Performance and load testing**  
✅ **Security and isolation** verification  
✅ **Production scenarios** and troubleshooting

Run these tests to ensure your Redis integration is working correctly and provides the expected performance benefits.
