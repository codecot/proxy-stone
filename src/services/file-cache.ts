import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { minimatch } from 'minimatch';

export interface FileCacheEntry {
  data: unknown;
  headers: Record<string, string>;
  status: number;
  createdAt: number;
  ttl: number;
  accessCount?: number;
  lastAccessed?: number;
}

interface PriorityOptions {
  patterns?: Array<{ pattern: string; priority: number }>;
  byLastAccess?: boolean;
  maxEntries?: number;
}

export class FileCacheService {
  private cacheDir: string;
  private enabled: boolean;

  constructor(cacheDir: string = './cache', enabled: boolean = false) {
    this.cacheDir = cacheDir;
    this.enabled = enabled;
  }

  /**
   * Safe wrapper for file operations that never throws
   */
  private async safeFileOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    operationName: string,
    context?: any
  ): Promise<T> {
    if (!this.enabled) {
      return fallback;
    }

    try {
      return await operation();
    } catch (error) {
      console.error(`File cache ${operationName} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        context,
        cacheDir: this.cacheDir,
        timestamp: new Date().toISOString(),
      });
      return fallback;
    }
  }

  /**
   * Initialize file cache directory with comprehensive error handling
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    await this.safeFileOperation(
      async () => {
        await fs.mkdir(this.cacheDir, { recursive: true });

        // Test write permissions
        const testFile = path.join(this.cacheDir, '.test-write');
        try {
          await fs.writeFile(testFile, 'test', 'utf8');
          await fs.unlink(testFile);
        } catch (error) {
          console.error('File cache directory is not writable:', error);
          this.enabled = false;
          throw error;
        }
      },
      undefined,
      'initialization'
    );
  }

  /**
   * Generate a safe filename from cache key with error handling
   */
  private generateFileName(cacheKey: string): string {
    try {
      // Create a hash for very long keys to avoid filesystem limits
      const hash = crypto.createHash('sha256').update(cacheKey).digest('hex');

      // Also create a readable prefix (first 50 chars, sanitized)
      const prefix = cacheKey.substring(0, 50).replace(/[^a-zA-Z0-9-_]/g, '_');

      return `${prefix}_${hash.substring(0, 16)}.json`;
    } catch (error) {
      console.warn('Failed to generate filename, using fallback:', error);
      // Fallback to simple hash
      try {
        const fallbackHash = crypto.createHash('md5').update(cacheKey).digest('hex');
        return `fallback_${fallbackHash}.json`;
      } catch (fallbackError) {
        console.error('Fallback filename generation failed:', fallbackError);
        // Last resort: timestamp-based filename
        return `emergency_${Date.now()}_${Math.random().toString(36).substring(2)}.json`;
      }
    }
  }

  /**
   * Get full file path for cache key with error handling
   */
  private getFilePath(cacheKey: string): string {
    try {
      const fileName = this.generateFileName(cacheKey);
      return path.join(this.cacheDir, fileName);
    } catch (error) {
      console.error('Failed to generate file path:', error);
      // Return a safe fallback path
      const safeKey = cacheKey.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      return path.join(this.cacheDir, `fallback_${safeKey}_${Date.now()}.json`);
    }
  }

  /**
   * Check if cache entry is expired with error handling
   */
  private isExpired(entry: FileCacheEntry): boolean {
    try {
      const now = Date.now();
      const expiresAt = entry.createdAt + entry.ttl * 1000;
      return now > expiresAt;
    } catch (error) {
      console.warn('Failed to check expiry, treating as expired:', error);
      return true; // Treat as expired if we can't determine
    }
  }

  /**
   * Save cache entry to file with comprehensive error handling
   */
  async set(
    cacheKey: string,
    data: unknown,
    headers: Record<string, string>,
    status: number,
    ttl: number
  ): Promise<void> {
    await this.safeFileOperation(
      async () => {
        const entry: FileCacheEntry = {
          data,
          headers,
          status,
          createdAt: Date.now(),
          ttl,
        };

        const filePath = this.getFilePath(cacheKey);

        // Ensure directory exists
        try {
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
        } catch (error) {
          console.warn('Failed to ensure directory exists:', error);
          // Continue anyway, might still work
        }

        // Serialize data safely
        let serializedData: string;
        try {
          serializedData = JSON.stringify(entry, null, 2);
        } catch (serializationError) {
          console.error('Failed to serialize cache entry:', serializationError);
          // Try without pretty printing
          try {
            serializedData = JSON.stringify(entry);
          } catch (fallbackError) {
            console.error(
              'Failed to serialize cache entry even without formatting:',
              fallbackError
            );
            throw fallbackError;
          }
        }

        // Write to temporary file first, then rename for atomic operation
        const tempPath = `${filePath}.tmp`;
        try {
          await fs.writeFile(tempPath, serializedData, 'utf8');
          await fs.rename(tempPath, filePath);
        } catch (error) {
          // Clean up temp file if it exists
          try {
            await fs.unlink(tempPath);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          throw error;
        }
      },
      undefined,
      'set',
      { cacheKey, status, ttl }
    );
  }

  /**
   * Get cache entry from file with comprehensive error handling
   */
  async get(cacheKey: string): Promise<FileCacheEntry | null> {
    return this.safeFileOperation(
      async () => {
        const filePath = this.getFilePath(cacheKey);

        let fileContent: string;
        try {
          fileContent = await fs.readFile(filePath, 'utf8');
        } catch (error) {
          // File doesn't exist or can't be read
          return null;
        }

        let entry: FileCacheEntry;
        try {
          entry = JSON.parse(fileContent);
        } catch (parseError) {
          console.warn('Failed to parse cache file, removing corrupted file:', parseError);
          // Remove corrupted file
          try {
            await fs.unlink(filePath);
          } catch (unlinkError) {
            console.warn('Failed to remove corrupted cache file:', unlinkError);
          }
          return null;
        }

        // Validate entry structure
        if (
          !entry ||
          typeof entry !== 'object' ||
          typeof entry.createdAt !== 'number' ||
          typeof entry.ttl !== 'number'
        ) {
          console.warn('Invalid cache entry structure, removing file');
          try {
            await fs.unlink(filePath);
          } catch (unlinkError) {
            console.warn('Failed to remove invalid cache file:', unlinkError);
          }
          return null;
        }

        // Check if expired
        if (this.isExpired(entry)) {
          // Delete expired file
          await this.safeFileOperation(() => this.delete(cacheKey), undefined, 'delete-expired', {
            cacheKey,
          });
          return null;
        }

        return entry;
      },
      null,
      'get',
      { cacheKey }
    );
  }

  /**
   * Delete cache entry file with comprehensive error handling
   */
  async delete(cacheKey: string): Promise<void> {
    await this.safeFileOperation(
      async () => {
        const filePath = this.getFilePath(cacheKey);
        await fs.unlink(filePath);
      },
      undefined,
      'delete',
      { cacheKey }
    );
  }

  /**
   * Get all cache files with comprehensive error handling
   */
  async getAllFiles(): Promise<string[]> {
    return this.safeFileOperation(
      async () => {
        const files = await fs.readdir(this.cacheDir);
        return files.filter((file) => file.endsWith('.json') && !file.endsWith('.tmp'));
      },
      [],
      'get-all-files'
    );
  }

  /**
   * Get cache statistics with comprehensive error handling
   */
  async getStats(): Promise<{ size: number; files: string[] }> {
    return this.safeFileOperation(
      async () => {
        const files = await this.getAllFiles();
        return {
          size: files.length,
          files: files.slice(0, 10), // Return first 10 for preview
        };
      },
      { size: 0, files: [] },
      'get-stats'
    );
  }

  /**
   * Clean expired cache files with comprehensive error handling
   */
  async cleanExpired(): Promise<number> {
    return this.safeFileOperation(
      async () => {
        const files = await this.getAllFiles();
        let cleaned = 0;

        for (const file of files) {
          await this.safeFileOperation(
            async () => {
              const filePath = path.join(this.cacheDir, file);

              let fileContent: string;
              try {
                fileContent = await fs.readFile(filePath, 'utf8');
              } catch (error) {
                // File might have been deleted or is unreadable, skip
                return;
              }

              let entry: FileCacheEntry;
              try {
                entry = JSON.parse(fileContent);
              } catch (parseError) {
                // File is corrupted, delete it
                try {
                  await fs.unlink(filePath);
                  cleaned++;
                } catch (deleteError) {
                  console.warn('Failed to delete corrupted cache file:', deleteError);
                }
                return;
              }

              // Check if expired
              if (this.isExpired(entry)) {
                try {
                  await fs.unlink(filePath);
                  cleaned++;
                } catch (deleteError) {
                  console.warn('Failed to delete expired cache file:', deleteError);
                }
              }
            },
            undefined,
            'clean-file',
            { file }
          );
        }

        return cleaned;
      },
      0,
      'clean-expired'
    );
  }

  /**
   * Clear all cache files with comprehensive error handling
   */
  async clear(): Promise<number> {
    return this.safeFileOperation(
      async () => {
        const files = await this.getAllFiles();
        let cleared = 0;

        for (const file of files) {
          await this.safeFileOperation(
            async () => {
              const filePath = path.join(this.cacheDir, file);
              await fs.unlink(filePath);
              cleared++;
            },
            undefined,
            'clear-file',
            { file }
          );
        }

        return cleared;
      },
      0,
      'clear'
    );
  }

  /**
   * Load cache entries into memory cache with comprehensive error handling
   */
  async loadIntoMemoryCache(
    memoryCache: Map<string, FileCacheEntry>,
    options: { priority?: PriorityOptions } = {}
  ): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    try {
      const files = await fs.readdir(this.cacheDir);
      let loadedCount = 0;
      const entries: Array<[string, FileCacheEntry]> = [];

      // Load all entries first
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const data = await fs.readFile(path.join(this.cacheDir, file), 'utf-8');
          const entry = JSON.parse(data) as FileCacheEntry;
          const key = file.replace('.json', '');

          // Convert to memory cache format
          const cacheEntry: FileCacheEntry = {
            data: entry.data,
            headers: entry.headers,
            status: entry.status,
            createdAt: entry.createdAt,
            ttl: entry.ttl,
            accessCount: entry.accessCount || 0,
            lastAccessed: entry.lastAccessed || entry.createdAt,
          };

          entries.push([key, cacheEntry]);
        } catch (error) {
          console.warn(`Failed to load cache file ${file}:`, error);
        }
      }

      // Apply priority sorting if specified
      const priority = options.priority;
      if (priority) {
        entries.sort(([, a], [, b]) => {
          // Sort by pattern priority first
          if (priority.patterns) {
            const aPriority = this.getPatternPriority(a, priority.patterns);
            const bPriority = this.getPatternPriority(b, priority.patterns);
            if (aPriority !== bPriority) {
              return bPriority - aPriority;
            }
          }

          // Then by last access time if specified
          if (priority.byLastAccess) {
            const aTime = a.lastAccessed || a.createdAt;
            const bTime = b.lastAccessed || b.createdAt;
            return bTime - aTime;
          }

          return 0;
        });

        // Apply max entries limit if specified
        if (priority.maxEntries) {
          entries.splice(priority.maxEntries);
        }
      }

      // Load entries into memory cache
      for (const [key, entry] of entries) {
        if (!this.isExpired(entry)) {
          memoryCache.set(key, entry);
          loadedCount++;
        }
      }

      return loadedCount;
    } catch (error) {
      console.error('Failed to load cache files:', error);
      return 0;
    }
  }

  private getPatternPriority(
    entry: FileCacheEntry,
    patterns: Array<{ pattern: string; priority: number }>
  ): number {
    const url = entry.headers['x-original-url'] || '';
    for (const { pattern, priority } of patterns) {
      if (minimatch(url, pattern)) {
        return priority;
      }
    }
    return 0;
  }
}
