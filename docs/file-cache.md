# File Cache Documentation

The proxy server supports **hybrid caching** with both in-memory and file-based persistence. This allows cache to survive service restarts and handle larger datasets.

## Features

- **1 file per cache entry** as requested
- **Hybrid system**: Fast in-memory access + persistent file storage
- **Automatic TTL handling**: Expired files are automatically cleaned
- **Safe filenames**: Uses sanitized prefixes + SHA256 hashes
- **JSON format**: Human-readable cache files

## How to Enable File Cache

### Method 1: CLI Arguments (Recommended)

```bash
npm run dev -- --enable-file-cache --file-cache-dir ./cache --cache-ttl 60
```

### Method 2: Environment Variables

```bash
export ENABLE_FILE_CACHE=true
export FILE_CACHE_DIR=./cache
export CACHE_TTL=60
npm run dev
```

### Method 3: Production with Docker

```bash
# In docker-compose.yml or Dockerfile
ENV ENABLE_FILE_CACHE=true
ENV FILE_CACHE_DIR=/app/cache
ENV CACHE_TTL=300
```

## Configuration Options

| CLI Argument              | Environment Variable | Default   | Description             |
| ------------------------- | -------------------- | --------- | ----------------------- |
| `--enable-file-cache`     | `ENABLE_FILE_CACHE`  | `false`   | Enable file-based cache |
| `--file-cache-dir <path>` | `FILE_CACHE_DIR`     | `./cache` | Cache directory path    |
| `--cache-ttl <seconds>`   | `CACHE_TTL`          | `300`     | Cache TTL in seconds    |

## File Structure

When enabled, cache files are stored as:

```
cache/
├── GET_https___httpbin_org_get___5f8a882ad0af67db.json
├── POST_https___api_example_com_users___a1b2c3d4e5f67890.json
└── GET_https___api_service_com_data_user123___9876543210abcdef.json
```

### File Naming Convention

Files use this pattern: `{PREFIX}_{HASH}.json`

- **PREFIX**: First 50 chars of cache key (sanitized)
- **HASH**: SHA256 hash (first 16 chars) for uniqueness

### File Content Structure

```json
{
  "data": {
    /* Cached response data */
  },
  "headers": {
    /* Response headers */
  },
  "status": 200,
  "createdAt": 1748066691207,
  "ttl": 60
}
```

## Usage Examples

### Basic Development Setup

```bash
# Enable file cache with 5-minute TTL
npm run dev -- --enable-file-cache --cache-ttl 300
```

### Custom Cache Directory

```bash
# Use a custom cache location
npm run dev -- --enable-file-cache --file-cache-dir /tmp/my-cache
```

### Full Configuration

```bash
npm run dev -- \
  --enable-file-cache \
  --file-cache-dir ./cache \
  --cache-ttl 600 \
  --port 4000 \
  --target-url https://api.example.com \
  --cacheable-methods GET,POST
```

## Testing File Cache

### 1. Start Server with File Cache

```bash
npm run dev -- --enable-file-cache --cache-ttl 60
```

### 2. Make Cacheable Requests

```bash
# First request (cache miss)
curl http://localhost:3000/api/get

# Second request (cache hit from memory)
curl http://localhost:3000/api/get
```

### 3. Check Cache Status

```bash
# View cache statistics
curl http://localhost:3000/cache/stats | jq

# View configuration
curl http://localhost:3000/debug/config | jq
```

### 4. Verify Files Created

```bash
# List cache files
ls -la cache/

# View cache file content
cat cache/*.json | jq
```

### 5. Restart Server (Test Persistence)

```bash
# Stop server, then restart
npm run dev -- --enable-file-cache --cache-ttl 60

# Cache should load from files
curl http://localhost:3000/cache/stats | jq
```

## API Endpoints

### Cache Statistics

```bash
GET /cache/stats
```

### Debug Configuration

```bash
GET /debug/config
```

### Clear Cache

```bash
DELETE /cache
```

### Clean Expired Entries

```bash
POST /cache/clean
```

## Performance Notes

### Memory vs File Cache

- **Memory**: Fastest access (microseconds)
- **File**: Persistent but slower (milliseconds)
- **Hybrid**: Best of both worlds

### Cache Hierarchy

1. **Check memory cache** (fastest)
2. **If not found, check file cache**
3. **If found in file, load into memory**
4. **All writes go to both memory and file**

## Production Considerations

### Disk Space Management

```bash
# Monitor cache directory size
du -sh cache/

# Clean expired entries
curl -X POST http://localhost:3000/cache/clean
```

### Backup and Restore

```bash
# Backup cache
tar -czf cache-backup.tar.gz cache/

# Restore cache
tar -xzf cache-backup.tar.gz
```

### Docker Volume Mounting

```yaml
# docker-compose.yml
volumes:
  - ./cache:/app/cache
```

## Troubleshooting

### File Cache Not Working

1. Check if enabled: `curl /debug/config`
2. Verify directory permissions: `ls -la cache/`
3. Check server logs for errors

### Cache Files Not Loading

1. Ensure file format is valid JSON
2. Check TTL hasn't expired
3. Verify file permissions

### Performance Issues

1. Monitor cache directory size
2. Adjust TTL based on usage patterns
3. Consider cache cleanup frequency

## Security Notes

- Cache files may contain sensitive data
- Ensure proper directory permissions
- Consider encryption for sensitive environments
- Add `cache/` to `.gitignore` (already included)

## Advanced Usage

### Custom Cache Cleanup

```bash
# Manual cleanup of expired files
find cache/ -name "*.json" -mtime +1 -delete

# Scheduled cleanup (cron)
0 */6 * * * find /app/cache -name "*.json" -mtime +1 -delete
```

### Cache Monitoring

```bash
# Watch cache directory changes
watch -n 1 'ls -la cache/ | wc -l'

# Monitor cache hit rates
watch -n 5 'curl -s localhost:3000/cache/stats | jq ".memory.size, .file.size"'
```
