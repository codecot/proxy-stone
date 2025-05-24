import crypto from 'crypto';
import { FileCacheService, FileCacheEntry } from './file-cache.js';

export interface CacheEntry {
  data: unknown;
  headers: Record<string, string>;
  status: number;
  createdAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number;
  private fileCache: FileCacheService;

  constructor(ttl: number = 300, fileCacheDir?: string, enableFileCache: boolean = false) {
    this.ttl = ttl;
    this.fileCache = new FileCacheService(fileCacheDir, enableFileCache);
  }

  /**
   * Initialize the cache service (including file cache)
   */
  async initialize(): Promise<void> {
    await this.fileCache.initialize();
    // Note: We could load existing cache files into memory here if needed
  }

  /**
   * Generate a cache key from request details
   */
  generateKey(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown
  ): string {
    // Include authorization header for user-specific caching
    const authHeader = headers.authorization || '';

    // Convert body to string for key generation
    const bodyString = body ? JSON.stringify(body) : '';

    return `${method}:${url}:${authHeader}:${bodyString}`;
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    const expiresAt = entry.createdAt + this.ttl * 1000;
    return now > expiresAt;
  }

  /**
   * Get cached data - checks memory first, then file cache
   */
  async get(key: string): Promise<CacheEntry | null> {
    // Check memory cache first (fastest)
    const memoryEntry = this.cache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
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
      };

      // Load back into memory cache for faster access
      this.cache.set(key, cacheEntry);
      return cacheEntry;
    }

    return null;
  }

  /**
   * Store data in cache - saves to both memory and file
   */
  async set(
    key: string,
    data: unknown,
    headers: Record<string, string>,
    status: number
  ): Promise<void> {
    const entry: CacheEntry = {
      data,
      headers,
      status,
      createdAt: Date.now(),
    };

    // Store in memory cache
    this.cache.set(key, entry);

    // Store in file cache
    await this.fileCache.set(key, data, headers, status, this.ttl);
  }

  /**
   * Delete cache entry from both memory and file
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await this.fileCache.delete(key);
  }

  /**
   * Get cache statistics from both memory and file cache
   */
  async getStats(): Promise<{
    memory: { size: number; keys: string[] };
    file: { size: number; files: string[] };
  }> {
    const memoryKeys = Array.from(this.cache.keys()).slice(0, 10);
    const fileStats = await this.fileCache.getStats();

    return {
      memory: {
        size: this.cache.size,
        keys: memoryKeys,
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
}
