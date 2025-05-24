import crypto from 'crypto';
import { FileCacheService, FileCacheEntry } from './file-cache.js';
import { CacheConfig, CacheRule } from '../types/index.js';
import { minimatch } from 'minimatch';

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
  file: {
    size: number;
    files: string[];
  };
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private fileCache: FileCacheService;
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
   * Initialize the cache service (including file cache and background cleanup)
   */
  async initialize(): Promise<void> {
    await this.fileCache.initialize();

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
   * Get cached data with enhanced logic
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

    // Check memory cache first (fastest)
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

    // Check file cache
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

      // Load back into memory cache for faster access
      this.cache.set(key, cacheEntry);
      this.evictIfNeeded();
      this.stats.hits++;
      return cacheEntry;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store data in cache with rule-based TTL
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

    // Store in memory cache
    this.cache.set(key, entry);
    this.evictIfNeeded();

    // Store in file cache
    await this.fileCache.set(key, data, headers, status, ttl);
  }

  /**
   * Delete cache entry from both memory and file
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await this.fileCache.delete(key);
  }

  /**
   * Get enhanced cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const memoryKeys = Array.from(this.cache.keys()).slice(0, 10);
    const fileStats = await this.fileCache.getStats();

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      memory: {
        size: this.cache.size,
        keys: memoryKeys,
        hitRate: Math.round(hitRate * 100) / 100,
        totalHits: this.stats.hits,
        totalMisses: this.stats.misses,
      },
      file: fileStats,
    };
  }

  /**
   * Clean expired entries from both memory and file cache
   */
  async cleanExpired(): Promise<{ memory: number; file: number }> {
    let memoryCleanedCount = 0;

    // Clean memory cache
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        memoryCleanedCount++;
      }
    }

    // Clean file cache
    const fileCleanedCount = await this.fileCache.cleanExpired();

    return {
      memory: memoryCleanedCount,
      file: fileCleanedCount,
    };
  }

  /**
   * Clear all cache entries from both memory and file
   */
  async clear(): Promise<{ memory: number; file: number }> {
    const memorySize = this.cache.size;
    this.cache.clear();

    // Reset statistics
    this.stats.hits = 0;
    this.stats.misses = 0;

    const fileCleared = await this.fileCache.clear();

    return {
      memory: memorySize,
      file: fileCleared,
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
   * Shutdown the cache service
   */
  shutdown(): void {
    this.stopBackgroundCleanup();
  }
}
