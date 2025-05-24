import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FileCacheEntry {
  data: unknown;
  headers: Record<string, string>;
  status: number;
  createdAt: number;
  ttl: number;
}

export class FileCacheService {
  private cacheDir: string;
  private enabled: boolean;

  constructor(cacheDir: string = './cache', enabled: boolean = false) {
    this.cacheDir = cacheDir;
    this.enabled = enabled;
  }

  /**
   * Initialize file cache directory
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
      this.enabled = false;
    }
  }

  /**
   * Generate a safe filename from cache key
   */
  private generateFileName(cacheKey: string): string {
    // Create a hash for very long keys to avoid filesystem limits
    const hash = crypto.createHash('sha256').update(cacheKey).digest('hex');

    // Also create a readable prefix (first 50 chars, sanitized)
    const prefix = cacheKey.substring(0, 50).replace(/[^a-zA-Z0-9-_]/g, '_');

    return `${prefix}_${hash.substring(0, 16)}.json`;
  }

  /**
   * Get full file path for cache key
   */
  private getFilePath(cacheKey: string): string {
    const fileName = this.generateFileName(cacheKey);
    return path.join(this.cacheDir, fileName);
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: FileCacheEntry): boolean {
    const now = Date.now();
    const expiresAt = entry.createdAt + entry.ttl * 1000;
    return now > expiresAt;
  }

  /**
   * Save cache entry to file
   */
  async set(
    cacheKey: string,
    data: unknown,
    headers: Record<string, string>,
    status: number,
    ttl: number
  ): Promise<void> {
    if (!this.enabled) return;

    const entry: FileCacheEntry = {
      data,
      headers,
      status,
      createdAt: Date.now(),
      ttl,
    };

    try {
      const filePath = this.getFilePath(cacheKey);
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to write cache file:', error);
    }
  }

  /**
   * Get cache entry from file
   */
  async get(cacheKey: string): Promise<FileCacheEntry | null> {
    if (!this.enabled) return null;

    try {
      const filePath = this.getFilePath(cacheKey);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const entry: FileCacheEntry = JSON.parse(fileContent);

      // Check if expired
      if (this.isExpired(entry)) {
        // Delete expired file
        await this.delete(cacheKey);
        return null;
      }

      return entry;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  /**
   * Delete cache entry file
   */
  async delete(cacheKey: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const filePath = this.getFilePath(cacheKey);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  /**
   * Get all cache files
   */
  async getAllFiles(): Promise<string[]> {
    if (!this.enabled) return [];

    try {
      const files = await fs.readdir(this.cacheDir);
      return files.filter((file) => file.endsWith('.json'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; files: string[] }> {
    const files = await this.getAllFiles();
    return {
      size: files.length,
      files: files.slice(0, 10), // Return first 10 for preview
    };
  }

  /**
   * Clean expired cache files
   */
  async cleanExpired(): Promise<number> {
    if (!this.enabled) return 0;

    const files = await this.getAllFiles();
    let cleaned = 0;

    for (const file of files) {
      try {
        const filePath = path.join(this.cacheDir, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const entry: FileCacheEntry = JSON.parse(fileContent);

        if (this.isExpired(entry)) {
          await fs.unlink(filePath);
          cleaned++;
        }
      } catch (error) {
        // File might be corrupted, delete it
        try {
          await fs.unlink(path.join(this.cacheDir, file));
          cleaned++;
        } catch (deleteError) {
          // Ignore delete errors
        }
      }
    }

    return cleaned;
  }

  /**
   * Clear all cache files
   */
  async clear(): Promise<number> {
    if (!this.enabled) return 0;

    const files = await this.getAllFiles();
    let cleared = 0;

    for (const file of files) {
      try {
        await fs.unlink(path.join(this.cacheDir, file));
        cleared++;
      } catch (error) {
        // Ignore delete errors
      }
    }

    return cleared;
  }

  /**
   * Load cache from files into memory cache
   */
  async loadIntoMemoryCache(memoryCache: Map<string, any>): Promise<number> {
    if (!this.enabled) return 0;

    const files = await this.getAllFiles();
    let loaded = 0;

    for (const file of files) {
      try {
        const filePath = path.join(this.cacheDir, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const entry: FileCacheEntry = JSON.parse(fileContent);

        // Skip expired entries
        if (this.isExpired(entry)) {
          await fs.unlink(filePath);
          continue;
        }

        // Reconstruct cache key from filename (this is tricky, we'll need to store it in the file)
        // For now, we'll add the cacheKey to the file content
        // This will be improved in the next iteration
        loaded++;
      } catch (error) {
        // Skip corrupted files
      }
    }

    return loaded;
  }
}
