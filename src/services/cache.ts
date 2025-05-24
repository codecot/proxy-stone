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
   * Initialize the cache service (including Redis, file cache and background cleanup)
   */
  async initialize(): Promise<void> {
    await this.fileCache.initialize();

    // Initialize Redis if enabled
    if (this.config.redis?.enabled) {
      await this.initializeRedis();
    }

    // Start background cleanup if enabled
    if (this.config.behavior.backgroundCleanup) {
      this.startBackgroundCleanup();
    }

    // Load existing cache files into memory if warmup is enabled
    if (this.config.behavior.warmupEnabled) {
      await this.warmupCache();
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
    const interval = (this.config.behavior.cleanupInterval || 600) * 1000;

    this.cleanupTimer = setInterval(async () => {
      await this.cleanExpired();
    }, interval);
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
   * Generate enhanced cache key with normalization and optional hashing
   */
  generateKey(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown
  ): string {
    const normalizedUrl = this.normalizeUrl(url);
    const filteredHeaders = this.filterHeaders(headers);

    // Sort headers for consistency
    const sortedHeaders = Object.keys(filteredHeaders)
      .sort()
      .map((key) => `${key}:${filteredHeaders[key]}`)
      .join('|');

    const bodyString = body ? JSON.stringify(body) : '';
    const rawKey = `${method.toUpperCase()}:${normalizedUrl}:${sortedHeaders}:${bodyString}`;

    // Hash long keys if configured
    const maxLength = this.config.keyOptions.maxKeyLength || 200;
    if (this.config.keyOptions.hashLongKeys && rawKey.length > maxLength) {
      const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const prefix = rawKey.substring(0, 50); // Keep readable prefix
      return `${prefix}#${hash}`;
    }

    return rawKey;
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
   * Get cached data with enhanced multi-layer logic (Memory → Redis → File)
   */
  async get(
    key: string,
    method?: string,
    url?: string,
    headers?: Record<string, string>
  ): Promise<CacheEntry | null> {
    // Check if caching is enabled for this request
    if (method && url && headers && !this.isCachingEnabled(method, url, headers)) {
      return null;
    }

    // 1. Check memory cache first (fastest)
    const memoryEntry = this.cache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.updateAccessStats(memoryEntry);
      this.stats.hits++;
      return memoryEntry;
    }

    // Remove expired memory entry
    if (memoryEntry) {
      this.cache.delete(key);
    }

    // 2. Check Redis cache (persistent, shared across instances)
    if (this.isRedisAvailable()) {
      try {
        const redisData = await this.redis.get(key);
        if (redisData) {
          const redisEntry: CacheEntry = JSON.parse(redisData);

          // Check if expired (Redis TTL might have slight delays)
          if (!this.isExpired(redisEntry)) {
            // Load back into memory cache for faster access
            this.cache.set(key, redisEntry);
            this.evictIfNeeded();
            this.updateAccessStats(redisEntry);
            this.stats.hits++;
            return redisEntry;
          } else {
            // Remove expired Redis entry
            await this.redis.del(key);
          }
        }
      } catch (error) {
        console.error('Redis get error:', error);
        // Continue to file cache on Redis error
      }
    }

    // 3. Check file cache (backup)
    const fileEntry = await this.fileCache.get(key);
    if (fileEntry) {
      // Convert file entry to memory entry format
      const cacheEntry: CacheEntry = {
        data: fileEntry.data,
        headers: fileEntry.headers,
        status: fileEntry.status,
        createdAt: fileEntry.createdAt,
        ttl: fileEntry.ttl,
        accessCount: 1,
        lastAccessed: Date.now(),
      };

      // Load into both memory and Redis for faster access
      this.cache.set(key, cacheEntry);
      this.evictIfNeeded();

      // Store in Redis if available
      if (this.isRedisAvailable()) {
        try {
          const serialized = JSON.stringify(cacheEntry);
          await this.redis.setex(key, cacheEntry.ttl, serialized);
        } catch (error) {
          console.error('Redis warm-up set error:', error);
        }
      }

      this.stats.hits++;
      return cacheEntry;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store data in multi-layer cache (Memory + Redis + File) with rule-based TTL
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
    // Check if caching is enabled for this request
    if (
      method &&
      url &&
      requestHeaders &&
      !this.isCachingEnabled(method, url, requestHeaders, status)
    ) {
      return;
    }

    // Get TTL for this specific request
    const ttl =
      method && url && requestHeaders
        ? this.getTTLForRequest(method, url, requestHeaders, status)
        : this.config.defaultTTL;

    // Check size limits if specified in rules
    if (method && url && requestHeaders) {
      const rule = this.findMatchingRule(method, url, requestHeaders, status);
      if (rule?.conditions) {
        const dataSize = JSON.stringify(data).length;

        if (rule.conditions.minSize && dataSize < rule.conditions.minSize) {
          return; // Too small to cache
        }

        if (rule.conditions.maxSize && dataSize > rule.conditions.maxSize) {
          return; // Too large to cache
        }
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
    this.cache.set(key, entry);
    this.evictIfNeeded();

    // 2. Store in Redis cache (persistent, shared)
    if (this.isRedisAvailable()) {
      try {
        const serialized = JSON.stringify(entry);
        await this.redis.setex(key, ttl, serialized);
      } catch (error) {
        console.error('Redis set error:', error);
        // Continue to file cache even if Redis fails
      }
    }

    // 3. Store in file cache (backup)
    await this.fileCache.set(key, data, headers, status, ttl);
  }

  /**
   * Delete cache entry from all layers (Memory + Redis + File)
   */
  async delete(key: string): Promise<void> {
    // Remove from memory cache
    this.cache.delete(key);

    // Remove from Redis cache
    if (this.isRedisAvailable()) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }

    // Remove from file cache
    await this.fileCache.delete(key);
  }

  /**
   * Get enhanced cache statistics including Redis
   */
  async getStats(): Promise<CacheStats> {
    const memoryKeys = Array.from(this.cache.keys()).slice(0, 10);
    const fileStats = await this.fileCache.getStats();

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

    // Add Redis statistics if available
    if (this.isRedisAvailable()) {
      try {
        const info = await this.redis.info('memory');
        const keyspace = await this.redis.info('keyspace');

        // Count keys with our prefix
        const pattern = this.config.redis?.keyPrefix ? `${this.config.redis.keyPrefix}*` : '*';
        const keys = await this.redis.keys(pattern);

        // Parse memory usage
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const memory = memoryMatch ? memoryMatch[1].trim() : '0B';

        // Parse keyspace info
        const keyspaceInfo: Record<string, string> = {};
        keyspace.split('\r\n').forEach((line: string) => {
          if (line.startsWith('db')) {
            const [db, dbStats] = line.split(':');
            keyspaceInfo[db] = dbStats;
          }
        });

        // Measure Redis latency
        const start = Date.now();
        await this.redis.ping();
        const latency = Date.now() - start;

        stats.redis = {
          connected: true,
          keys: keys.length,
          memory,
          latency,
          keyspace: keyspaceInfo,
        };
      } catch (error) {
        console.error('Redis stats error:', error);
        stats.redis = {
          connected: false,
          keys: 0,
          memory: '0B',
          keyspace: {},
        };
      }
    } else if (this.config.redis?.enabled) {
      stats.redis = {
        connected: false,
        keys: 0,
        memory: '0B',
        keyspace: {},
      };
    }

    return stats;
  }

  /**
   * Clear all cache entries from all layers (Memory + Redis + File)
   */
  async clear(): Promise<{ memory: number; redis: number; file: number }> {
    const memorySize = this.cache.size;
    this.cache.clear();

    // Reset statistics
    this.stats.hits = 0;
    this.stats.misses = 0;

    let redisCleared = 0;
    if (this.isRedisAvailable()) {
      try {
        const pattern = this.config.redis?.keyPrefix ? `${this.config.redis.keyPrefix}*` : '*';
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
          // Remove prefix for deletion (ioredis adds it automatically)
          const keysToDelete = this.config.redis?.keyPrefix
            ? keys.map((key: string) => key.replace(this.config.redis!.keyPrefix!, ''))
            : keys;

          await this.redis.del(...keysToDelete);
          redisCleared = keys.length;
        }
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }

    const fileCleared = await this.fileCache.clear();

    return {
      memory: memorySize,
      redis: redisCleared,
      file: fileCleared,
    };
  }

  /**
   * Clean expired entries from all cache layers
   */
  async cleanExpired(): Promise<{ memory: number; redis: number; file: number }> {
    let memoryCleanedCount = 0;

    // Clean memory cache
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        memoryCleanedCount++;
      }
    }

    // Redis automatically handles TTL expiration, but we can clean manually if needed
    let redisCleanedCount = 0;
    if (this.isRedisAvailable()) {
      try {
        // Redis TTL handles expiration automatically, so this returns 0
        // but we keep the interface consistent
        redisCleanedCount = 0;
      } catch (error) {
        console.error('Redis clean error:', error);
      }
    }

    // Clean file cache
    const fileCleanedCount = await this.fileCache.cleanExpired();

    return {
      memory: memoryCleanedCount,
      redis: redisCleanedCount,
      file: fileCleanedCount,
    };
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
   * Shutdown the cache service including Redis connection
   */
  shutdown(): void {
    this.stopBackgroundCleanup();

    // Close Redis connection
    if (this.redis) {
      try {
        this.redis.quit();
        this.redis = null;
        this.redisConnected = false;
        console.log('Redis cache connection closed');
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      }
    }
  }
}
