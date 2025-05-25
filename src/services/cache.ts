import crypto from 'crypto';
import { FileCacheService, FileCacheEntry } from './file-cache.js';
import { CacheConfig, CacheRule } from '../types/index.js';
import { minimatch } from 'minimatch';

// Redis integration (conditional import)
let Redis: any = null;
let redisImported = false;

async function getRedis() {
  if (!redisImported) {
    try {
      const IORedis = await import('ioredis');
      Redis = IORedis.default;
      redisImported = true;
    } catch (error) {
      console.warn(
        'Redis not available:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      redisImported = true; // Don't try again
    }
  }
  return Redis;
}

export interface CacheEntry {
  data: unknown;
  headers: Record<string, string>;
  status: number;
  createdAt: number;
  ttl: number; // Individual TTL for this entry
  accessCount: number; // For LRU eviction
  lastAccessed: number; // For LRU eviction
}

export interface CacheStats {
  memory: {
    size: number;
    keys: string[];
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  };
  redis?: {
    connected: boolean;
    keys: number;
    memory: string;
    latency?: number;
    keyspace: Record<string, string>;
  };
  file: {
    size: number;
    files: string[];
  };
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private fileCache: FileCacheService;
  private redis: any = null;
  private redisConnected: boolean = false;
  private cleanupTimer?: NodeJS.Timeout;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(config: CacheConfig, fileCacheDir?: string, enableFileCache: boolean = false) {
    this.config = config;
    this.fileCache = new FileCacheService(fileCacheDir, enableFileCache);
  }

  /**
   * Safe wrapper for cache operations that never throws
   */
  private async safeCacheOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    operationName: string,
    context?: any
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`Cache ${operationName} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        context,
        timestamp: new Date().toISOString(),
      });
      return fallback;
    }
  }

  /**
   * Safe wrapper for Redis operations that never throws
   */
  private async safeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    operationName: string,
    key?: string
  ): Promise<T> {
    if (!this.isRedisAvailable()) {
      return fallback;
    }

    try {
      return await operation();
    } catch (error) {
      console.error(`Redis ${operationName} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        key,
        timestamp: new Date().toISOString(),
      });
      // Mark Redis as temporarily unavailable on connection errors
      if (
        error instanceof Error &&
        (error.message.includes('connection') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED'))
      ) {
        this.redisConnected = false;
      }
      return fallback;
    }
  }

  /**
   * Initialize the cache service (including Redis, file cache and background cleanup)
   */
  async initialize(): Promise<void> {
    // Initialize file cache with error handling
    await this.safeCacheOperation(
      () => this.fileCache.initialize(),
      undefined,
      'file-cache-initialization'
    );

    // Initialize Redis if enabled
    if (this.config.redis?.enabled) {
      await this.safeCacheOperation(
        () => this.initializeRedis(),
        undefined,
        'redis-initialization'
      );
    }

    // Start background cleanup if enabled
    if (this.config.behavior.backgroundCleanup) {
      try {
        this.startBackgroundCleanup();
      } catch (error) {
        console.error('Failed to start background cleanup:', error);
      }
    }

    // Load existing cache files into memory if warmup is enabled
    if (this.config.behavior.warmupEnabled) {
      await this.safeCacheOperation(() => this.warmupCache(), undefined, 'cache-warmup');
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.redis?.enabled) {
      return;
    }

    const RedisClass = await getRedis();
    if (!RedisClass) {
      console.warn('Redis client not available, continuing without Redis cache');
      return;
    }

    try {
      this.redis = new RedisClass({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db || 0,
        keyPrefix: this.config.redis.keyPrefix || 'cache:',
        connectTimeout: this.config.redis.connectTimeout || 10000,
        lazyConnect: this.config.redis.lazyConnect !== false,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        maxLoadingTimeout: 5000,
      });

      // Event handlers
      this.redis.on('connect', () => {
        console.log('Redis cache connected');
        this.redisConnected = true;
      });

      this.redis.on('error', (error: Error) => {
        console.error('Redis cache error:', error.message);
        this.redisConnected = false;
      });

      this.redis.on('close', () => {
        console.log('Redis cache connection closed');
        this.redisConnected = false;
      });

      this.redis.on('reconnecting', () => {
        console.log('Redis cache reconnecting...');
      });

      // Test connection
      await this.redis.ping();
      console.log('Redis cache initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Redis cache:', error);
      this.redis = null;
      this.redisConnected = false;
    }
  }

  /**
   * Check if Redis is available
   */
  private isRedisAvailable(): boolean {
    return this.config.redis?.enabled === true && this.redisConnected && this.redis !== null;
  }

  /**
   * Start background cleanup timer
   */
  private startBackgroundCleanup(): void {
    try {
      const interval = (this.config.behavior.cleanupInterval || 600) * 1000;

      this.cleanupTimer = setInterval(async () => {
        await this.safeCacheOperation(
          () => this.cleanExpired(),
          { memory: 0, redis: 0, file: 0 },
          'background-cleanup'
        );
      }, interval);
    } catch (error) {
      console.error('Failed to setup background cleanup timer:', error);
    }
  }

  /**
   * Stop background cleanup timer
   */
  stopBackgroundCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Warm up cache by loading existing file cache entries
   */
  private async warmupCache(): Promise<void> {
    // Implementation depends on file cache service
    // For now, we'll skip this but it could load frequently accessed entries
    console.log('Cache warmup completed');
  }

  /**
   * Find matching cache rule for a given request
   */
  private findMatchingRule(
    method: string,
    url: string,
    headers: Record<string, string>,
    status?: number
  ): CacheRule | null {
    for (const rule of this.config.rules) {
      // Check if method matches (if specified)
      if (rule.methods && !rule.methods.includes(method.toUpperCase())) {
        continue;
      }

      // Check if URL pattern matches
      if (!minimatch(url, rule.pattern, { nocase: true })) {
        continue;
      }

      // Check conditions if specified
      if (rule.conditions) {
        // Check required headers
        if (rule.conditions.headers) {
          const hasRequiredHeaders = Object.entries(rule.conditions.headers).every(
            ([key, value]) => headers[key.toLowerCase()] === value
          );
          if (!hasRequiredHeaders) continue;
        }

        // Check status codes (only applicable when storing)
        if (status && rule.conditions.statusCodes) {
          if (!rule.conditions.statusCodes.includes(status)) {
            continue;
          }
        }
      }

      return rule;
    }

    return null;
  }

  /**
   * Get TTL for a specific request based on rules (public method)
   */
  getTTL(method: string, url: string, headers: Record<string, string>, status?: number): number {
    return this.getTTLForRequest(method, url, headers, status);
  }

  /**
   * Get TTL for a specific request based on rules
   */
  private getTTLForRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    status?: number
  ): number {
    const rule = this.findMatchingRule(method, url, headers, status);

    if (rule && rule.ttl !== undefined) {
      return rule.ttl;
    }

    return this.config.defaultTTL;
  }

  /**
   * Check if caching is enabled for a specific request
   */
  private isCachingEnabled(
    method: string,
    url: string,
    headers: Record<string, string>,
    status?: number
  ): boolean {
    const rule = this.findMatchingRule(method, url, headers, status);

    if (rule) {
      return rule.enabled !== false; // Default to true if not specified
    }

    // Fallback to default cacheable methods
    return this.config.methods.includes(method.toUpperCase());
  }

  /**
   * Normalize URL for consistent cache keys
   */
  private normalizeUrl(url: string): string {
    if (!this.config.keyOptions.normalizeUrl) {
      return url;
    }

    try {
      const urlObj = new URL(url);

      // Sort query parameters for consistency
      const searchParams = new URLSearchParams(urlObj.search);
      const sortedParams = new URLSearchParams();
      Array.from(searchParams.keys())
        .sort()
        .forEach((key) => {
          sortedParams.append(key, searchParams.get(key) || '');
        });

      urlObj.search = sortedParams.toString();
      return urlObj.toString();
    } catch {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Filter headers for cache key generation
   */
  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const { includeHeaders = [], excludeHeaders = [] } = this.config.keyOptions;
    const filtered: Record<string, string> = {};

    // If includeHeaders is specified, only include those
    if (includeHeaders.length > 0) {
      includeHeaders.forEach((header) => {
        const key = header.toLowerCase();
        if (headers[key]) {
          filtered[key] = headers[key];
        }
      });
      return filtered;
    }

    // Otherwise, include all except excluded ones
    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (!excludeHeaders.includes(lowerKey)) {
        filtered[lowerKey] = value;
      }
    });

    return filtered;
  }

  /**
   * Generate cache key with comprehensive error handling
   */
  generateKey(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown
  ): string {
    try {
      // Normalize URL safely
      let normalizedUrl: string;
      try {
        normalizedUrl = this.config.keyOptions.normalizeUrl ? this.normalizeUrl(url) : url;
      } catch (error) {
        console.warn('URL normalization failed, using original URL:', error);
        normalizedUrl = url;
      }

      // Filter headers safely
      let filteredHeaders: Record<string, string>;
      try {
        filteredHeaders = this.filterHeaders(headers);
      } catch (error) {
        console.warn('Header filtering failed, using original headers:', error);
        filteredHeaders = headers;
      }

      // Create base key components
      const keyComponents = [method.toUpperCase(), normalizedUrl];

      // Add filtered headers to key
      try {
        const headerString = Object.keys(filteredHeaders)
          .sort()
          .map((key) => `${key}:${filteredHeaders[key]}`)
          .join('|');
        if (headerString) {
          keyComponents.push(headerString);
        }
      } catch (error) {
        console.warn('Header serialization failed for cache key:', error);
      }

      // Add body hash if present
      if (body !== undefined && body !== null) {
        try {
          const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
          const bodyHash = crypto
            .createHash('sha256')
            .update(bodyString)
            .digest('hex')
            .substring(0, 16);
          keyComponents.push(`body:${bodyHash}`);
        } catch (error) {
          console.warn('Body hashing failed for cache key:', error);
          // Continue without body in key
        }
      }

      // Join components
      const key = keyComponents.join('::');

      // Hash long keys if configured
      if (
        this.config.keyOptions.hashLongKeys &&
        this.config.keyOptions.maxKeyLength &&
        key.length > this.config.keyOptions.maxKeyLength
      ) {
        try {
          const hash = crypto.createHash('sha256').update(key).digest('hex');
          return `hashed::${hash}`;
        } catch (error) {
          console.warn('Key hashing failed, using truncated key:', error);
          return key.substring(0, this.config.keyOptions.maxKeyLength);
        }
      }

      return key;
    } catch (error) {
      console.error('Cache key generation failed completely:', error);
      // Return a fallback key based on method and URL only
      try {
        const fallbackKey = `${method}::${url}`;
        return crypto.createHash('sha256').update(fallbackKey).digest('hex');
      } catch (fallbackError) {
        console.error('Fallback key generation failed:', fallbackError);
        // Last resort: use timestamp-based key
        return `fallback::${Date.now()}::${Math.random()}`;
      }
    }
  }

  /**
   * Check if a cache entry is expired based on its individual TTL
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    const expiresAt = entry.createdAt + entry.ttl * 1000;
    return now > expiresAt;
  }

  /**
   * Update access statistics for LRU eviction
   */
  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  /**
   * Evict entries if cache size exceeds maximum
   */
  private evictIfNeeded(): void {
    const maxSize = this.config.behavior.maxSize || 10000;

    if (this.cache.size <= maxSize) {
      return;
    }

    const entriesToEvict = this.cache.size - maxSize + 1; // Evict one extra for buffer
    const policy = this.config.behavior.evictionPolicy || 'lru';

    if (policy === 'lru') {
      // Sort by lastAccessed (oldest first)
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.lastAccessed - b.lastAccessed
      );

      for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    } else if (policy === 'fifo') {
      // Sort by createdAt (oldest first)
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.createdAt - b.createdAt
      );

      for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Get cache entry with comprehensive error handling
   */
  async get(
    key: string,
    method?: string,
    url?: string,
    headers?: Record<string, string>
  ): Promise<CacheEntry | null> {
    return this.safeCacheOperation(
      async () => {
        // Check if caching is enabled for this request
        if (method && url && headers) {
          try {
            if (!this.isCachingEnabled(method, url, headers)) {
              return null;
            }
          } catch (error) {
            console.warn('Cache enablement check failed, proceeding with cache lookup:', error);
          }
        }

        // 1. Check memory cache first (fastest)
        try {
          const memoryEntry = this.cache.get(key);
          if (memoryEntry) {
            try {
              if (!this.isExpired(memoryEntry)) {
                this.updateAccessStats(memoryEntry);
                this.stats.hits++;
                return memoryEntry;
              } else {
                // Remove expired memory entry
                this.cache.delete(key);
              }
            } catch (error) {
              console.warn('Memory cache entry validation failed:', error);
              // Remove potentially corrupted entry
              this.cache.delete(key);
            }
          }
        } catch (error) {
          console.warn('Memory cache lookup failed:', error);
        }

        // 2. Check Redis cache (persistent, shared across instances)
        const redisEntry = await this.safeRedisOperation(
          async () => {
            const redisData = await this.redis.get(key);
            if (redisData) {
              try {
                const entry: CacheEntry = JSON.parse(redisData);

                // Check if expired (Redis TTL might have slight delays)
                if (!this.isExpired(entry)) {
                  // Load back into memory cache for faster access
                  try {
                    this.cache.set(key, entry);
                    this.evictIfNeeded();
                    this.updateAccessStats(entry);
                    this.stats.hits++;
                    return entry;
                  } catch (error) {
                    console.warn('Failed to load Redis entry into memory cache:', error);
                    // Still return the entry even if memory caching fails
                    this.stats.hits++;
                    return entry;
                  }
                } else {
                  // Remove expired Redis entry
                  await this.safeRedisOperation(
                    () => this.redis.del(key),
                    undefined,
                    'delete-expired',
                    key
                  );
                }
              } catch (parseError) {
                console.warn('Failed to parse Redis cache entry:', parseError);
                // Remove corrupted Redis entry
                await this.safeRedisOperation(
                  () => this.redis.del(key),
                  undefined,
                  'delete-corrupted',
                  key
                );
              }
            }
            return null;
          },
          null,
          'get',
          key
        );

        if (redisEntry) {
          return redisEntry;
        }

        // 3. Check file cache (backup)
        const fileEntry = await this.safeCacheOperation(
          async () => {
            const entry = await this.fileCache.get(key);
            if (entry) {
              try {
                // Convert file entry to memory entry format
                const cacheEntry: CacheEntry = {
                  data: entry.data,
                  headers: entry.headers,
                  status: entry.status,
                  createdAt: entry.createdAt,
                  ttl: entry.ttl,
                  accessCount: 1,
                  lastAccessed: Date.now(),
                };

                // Load into memory cache for faster access
                try {
                  this.cache.set(key, cacheEntry);
                  this.evictIfNeeded();
                } catch (error) {
                  console.warn('Failed to load file cache entry into memory:', error);
                }

                // Store in Redis if available
                await this.safeRedisOperation(
                  async () => {
                    const serialized = JSON.stringify(cacheEntry);
                    await this.redis.setex(key, cacheEntry.ttl, serialized);
                  },
                  undefined,
                  'warm-up-set',
                  key
                );

                this.stats.hits++;
                return cacheEntry;
              } catch (error) {
                console.warn('Failed to process file cache entry:', error);
                return null;
              }
            }
            return null;
          },
          null,
          'file-cache-get',
          { key }
        );

        if (fileEntry) {
          return fileEntry;
        }

        this.stats.misses++;
        return null;
      },
      null,
      'get-operation',
      { key, method, url }
    );
  }

  /**
   * Store data in multi-layer cache with comprehensive error handling
   */
  async set(
    key: string,
    data: unknown,
    headers: Record<string, string>,
    status: number,
    method?: string,
    url?: string,
    requestHeaders?: Record<string, string>
  ): Promise<void> {
    await this.safeCacheOperation(
      async () => {
        // Check if caching is enabled for this request
        if (method && url && requestHeaders) {
          try {
            if (!this.isCachingEnabled(method, url, requestHeaders, status)) {
              return;
            }
          } catch (error) {
            console.warn('Cache enablement check failed, proceeding with caching:', error);
          }
        }

        // Get TTL for this specific request
        let ttl: number;
        try {
          ttl =
            method && url && requestHeaders
              ? this.getTTLForRequest(method, url, requestHeaders, status)
              : this.config.defaultTTL;
        } catch (error) {
          console.warn('TTL calculation failed, using default TTL:', error);
          ttl = this.config.defaultTTL;
        }

        // Check size limits if specified in rules
        if (method && url && requestHeaders) {
          try {
            const rule = this.findMatchingRule(method, url, requestHeaders, status);
            if (rule?.conditions) {
              try {
                const dataSize = JSON.stringify(data).length;

                if (rule.conditions.minSize && dataSize < rule.conditions.minSize) {
                  return; // Too small to cache
                }

                if (rule.conditions.maxSize && dataSize > rule.conditions.maxSize) {
                  return; // Too large to cache
                }
              } catch (sizeError) {
                console.warn('Size check failed, proceeding with caching:', sizeError);
              }
            }
          } catch (error) {
            console.warn('Rule matching failed, proceeding with caching:', error);
          }
        }

        const entry: CacheEntry = {
          data,
          headers,
          status,
          createdAt: Date.now(),
          ttl,
          accessCount: 0,
          lastAccessed: Date.now(),
        };

        // 1. Store in memory cache (fastest access)
        try {
          this.cache.set(key, entry);
          this.evictIfNeeded();
        } catch (error) {
          console.warn('Memory cache storage failed:', error);
        }

        // 2. Store in Redis cache (persistent, shared)
        await this.safeRedisOperation(
          async () => {
            const serialized = JSON.stringify(entry);
            await this.redis.setex(key, ttl, serialized);
          },
          undefined,
          'set',
          key
        );

        // 3. Store in file cache (backup)
        await this.safeCacheOperation(
          () => this.fileCache.set(key, data, headers, status, ttl),
          undefined,
          'file-cache-set',
          { key, status }
        );
      },
      undefined,
      'set-operation',
      { key, method, url, status }
    );
  }

  /**
   * Delete cache entry from all layers with comprehensive error handling
   */
  async delete(key: string): Promise<void> {
    await this.safeCacheOperation(
      async () => {
        // Remove from memory cache
        try {
          this.cache.delete(key);
        } catch (error) {
          console.warn('Memory cache deletion failed:', error);
        }

        // Remove from Redis cache
        await this.safeRedisOperation(() => this.redis.del(key), undefined, 'delete', key);

        // Remove from file cache
        await this.safeCacheOperation(
          () => this.fileCache.delete(key),
          undefined,
          'file-cache-delete',
          { key }
        );
      },
      undefined,
      'delete-operation',
      { key }
    );
  }

  /**
   * Get enhanced cache statistics with comprehensive error handling
   */
  async getStats(): Promise<CacheStats> {
    return this.safeCacheOperation(
      async () => {
        let memoryKeys: string[] = [];
        try {
          memoryKeys = Array.from(this.cache.keys()).slice(0, 10);
        } catch (error) {
          console.warn('Failed to get memory cache keys:', error);
        }

        let fileStats = { size: 0, files: [] as string[] };
        try {
          fileStats = await this.fileCache.getStats();
        } catch (error) {
          console.warn('Failed to get file cache stats:', error);
        }

        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

        const stats: CacheStats = {
          memory: {
            size: this.cache.size,
            keys: memoryKeys,
            hitRate: Math.round(hitRate * 100) / 100,
            totalHits: this.stats.hits,
            totalMisses: this.stats.misses,
          },
          file: fileStats,
        };

        // Add Redis stats if available
        if (this.isRedisAvailable()) {
          const redisStats = await this.safeRedisOperation(
            async () => {
              const info = await this.redis.info('memory');
              const keyspace = await this.redis.info('keyspace');
              const dbsize = await this.redis.dbsize();

              return {
                connected: this.redisConnected,
                keys: dbsize,
                memory:
                  info
                    .split('\n')
                    .find((line: string) => line.startsWith('used_memory_human:'))
                    ?.split(':')[1]
                    ?.trim() || 'unknown',
                keyspace: keyspace
                  .split('\n')
                  .reduce((acc: Record<string, string>, line: string) => {
                    if (line.includes(':')) {
                      const [key, value] = line.split(':');
                      acc[key] = value;
                    }
                    return acc;
                  }, {}),
              };
            },
            {
              connected: false,
              keys: 0,
              memory: 'unavailable',
              keyspace: {},
            },
            'stats'
          );

          stats.redis = redisStats;
        }

        return stats;
      },
      {
        memory: {
          size: 0,
          keys: [],
          hitRate: 0,
          totalHits: 0,
          totalMisses: 0,
        },
        file: {
          size: 0,
          files: [],
        },
      },
      'get-stats'
    );
  }

  /**
   * Clear all cache layers with comprehensive error handling
   */
  async clear(): Promise<{ memory: number; redis: number; file: number }> {
    return this.safeCacheOperation(
      async () => {
        let memoryCleared = 0;
        let redisCleared = 0;
        let fileCleared = 0;

        // Clear memory cache
        try {
          memoryCleared = this.cache.size;
          this.cache.clear();
        } catch (error) {
          console.warn('Memory cache clear failed:', error);
        }

        // Clear Redis cache
        redisCleared = await this.safeRedisOperation(
          async () => {
            const keys = await this.redis.keys('*');
            if (keys.length > 0) {
              await this.redis.del(...keys);
              return keys.length;
            }
            return 0;
          },
          0,
          'clear'
        );

        // Clear file cache
        fileCleared = await this.safeCacheOperation(
          () => this.fileCache.clear(),
          0,
          'file-cache-clear'
        );

        return {
          memory: memoryCleared,
          redis: redisCleared,
          file: fileCleared,
        };
      },
      { memory: 0, redis: 0, file: 0 },
      'clear-operation'
    );
  }

  /**
   * Clean expired entries from all cache layers with comprehensive error handling
   */
  async cleanExpired(): Promise<{ memory: number; redis: number; file: number }> {
    return this.safeCacheOperation(
      async () => {
        let memoryCleaned = 0;
        let redisCleaned = 0;
        let fileCleaned = 0;

        // Clean memory cache
        try {
          const now = Date.now();
          for (const [key, entry] of this.cache.entries()) {
            try {
              if (this.isExpired(entry)) {
                this.cache.delete(key);
                memoryCleaned++;
              }
            } catch (error) {
              console.warn(`Failed to check expiry for memory cache key ${key}:`, error);
              // Remove potentially corrupted entry
              this.cache.delete(key);
              memoryCleaned++;
            }
          }
        } catch (error) {
          console.warn('Memory cache cleanup failed:', error);
        }

        // Clean Redis cache (Redis handles TTL automatically, but we can clean manually expired entries)
        redisCleaned = await this.safeRedisOperation(
          async () => {
            // Redis automatically handles TTL, so we don't need manual cleanup
            // But we can check for any keys that might have slipped through
            return 0;
          },
          0,
          'clean-expired'
        );

        // Clean file cache
        fileCleaned = await this.safeCacheOperation(
          () => this.fileCache.cleanExpired(),
          0,
          'file-cache-clean-expired'
        );

        return {
          memory: memoryCleaned,
          redis: redisCleaned,
          file: fileCleaned,
        };
      },
      { memory: 0, redis: 0, file: 0 },
      'clean-expired-operation'
    );
  }

  /**
   * Get current cache size (memory only for performance)
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache keys (memory only for performance)
   */
  get keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Shutdown cache service with comprehensive cleanup
   */
  shutdown(): void {
    try {
      this.stopBackgroundCleanup();
    } catch (error) {
      console.error('Failed to stop background cleanup:', error);
    }

    if (this.redis) {
      try {
        this.redis.disconnect();
        this.redis = null;
        this.redisConnected = false;
      } catch (error) {
        console.error('Failed to disconnect Redis:', error);
      }
    }
  }
}
