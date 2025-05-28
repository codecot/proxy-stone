import {
  StorageAdapter,
  StorageType,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "../types.js";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  lazyConnect?: boolean;
}

interface RedisDocument<T = any> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  accessCount: number;
  lastAccessed?: number;
}

export class RedisStorageAdapter<T = any> implements StorageAdapter<T> {
  private redis: any = null;
  private connected = false;

  constructor(private config: RedisConfig) {}

  async initialize(): Promise<void> {
    try {
      // Dynamic import of ioredis
      const IORedis = await import("ioredis");
      const Redis = IORedis.default;

      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix || "",
        connectTimeout: this.config.connectTimeout || 10000,
        lazyConnect: this.config.lazyConnect !== false,
        maxRetriesPerRequest: 3,
      });

      // Test connection
      await this.redis.ping();
      this.connected = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Redis storage: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
    }
  }

  async save(key: string, data: T, options?: SaveOptions): Promise<void> {
    if (!this.connected) throw new Error("Redis not initialized");

    const now = Date.now();
    const document: RedisDocument<T> = {
      key,
      data,
      createdAt: now,
      expiresAt: options?.ttl ? now + options.ttl * 1000 : undefined,
      tags: options?.tags,
      metadata: options?.metadata,
      accessCount: 0,
    };

    const serialized = JSON.stringify(document);
    const fullKey = this.getFullKey(key);

    if (options?.ttl) {
      await this.redis.setex(fullKey, options.ttl, serialized);
    } else {
      await this.redis.set(fullKey, serialized);
    }

    // Store tags for filtering if provided
    if (options?.tags) {
      for (const tag of options.tags) {
        await this.redis.sadd(`${this.config.keyPrefix}tags:${tag}`, key);
      }
    }
  }

  async get(key: string): Promise<T | null> {
    if (!this.connected) throw new Error("Redis not initialized");

    const fullKey = this.getFullKey(key);
    const serialized = await this.redis.get(fullKey);

    if (!serialized) return null;

    try {
      const document: RedisDocument<T> = JSON.parse(serialized);

      // Check if expired (Redis TTL should handle this, but double-check)
      if (document.expiresAt && Date.now() > document.expiresAt) {
        await this.delete(key);
        return null;
      }

      // Update access stats
      document.accessCount++;
      document.lastAccessed = Date.now();
      await this.redis.set(fullKey, JSON.stringify(document));

      return document.data;
    } catch (error) {
      // Invalid JSON, remove the key
      await this.delete(key);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.connected) throw new Error("Redis not initialized");

    const fullKey = this.getFullKey(key);
    
    // Get document to clean up tags
    const serialized = await this.redis.get(fullKey);
    if (serialized) {
      try {
        const document: RedisDocument<T> = JSON.parse(serialized);
        if (document.tags) {
          for (const tag of document.tags) {
            await this.redis.srem(`${this.config.keyPrefix}tags:${tag}`, key);
          }
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }

    const result = await this.redis.del(fullKey);
    return result > 0;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) throw new Error("Redis not initialized");

    const fullKey = this.getFullKey(key);
    const result = await this.redis.exists(fullKey);
    return result > 0;
  }

  async saveBatch(
    items: Array<{ key: string; data: T; options?: SaveOptions }>
  ): Promise<void> {
    if (!this.connected) throw new Error("Redis not initialized");

    const pipeline = this.redis.pipeline();
    const now = Date.now();

    for (const item of items) {
      const document: RedisDocument<T> = {
        key: item.key,
        data: item.data,
        createdAt: now,
        expiresAt: item.options?.ttl ? now + item.options.ttl * 1000 : undefined,
        tags: item.options?.tags,
        metadata: item.options?.metadata,
        accessCount: 0,
      };

      const serialized = JSON.stringify(document);
      const fullKey = this.getFullKey(item.key);

      if (item.options?.ttl) {
        pipeline.setex(fullKey, item.options.ttl, serialized);
      } else {
        pipeline.set(fullKey, serialized);
      }

      // Add tags
      if (item.options?.tags) {
        for (const tag of item.options.tags) {
          pipeline.sadd(`${this.config.keyPrefix}tags:${tag}`, item.key);
        }
      }
    }

    await pipeline.exec();
  }

  async getBatch(keys: string[]): Promise<Array<T | null>> {
    if (!this.connected) throw new Error("Redis not initialized");

    const fullKeys = keys.map(key => this.getFullKey(key));
    const results = await this.redis.mget(...fullKeys);

    return results.map((serialized: string | null, index: number) => {
      if (!serialized) return null;

      try {
        const document: RedisDocument<T> = JSON.parse(serialized);

        // Check if expired
        if (document.expiresAt && Date.now() > document.expiresAt) {
          // Clean up expired item
          this.delete(keys[index]).catch(() => {}); // Fire and forget
          return null;
        }

        return document.data;
      } catch (error) {
        // Invalid JSON, clean up
        this.delete(keys[index]).catch(() => {}); // Fire and forget
        return null;
      }
    });
  }

  async deleteBatch(keys: string[]): Promise<number> {
    if (!this.connected) throw new Error("Redis not initialized");

    // Clean up tags first
    const pipeline = this.redis.pipeline();
    
    for (const key of keys) {
      const fullKey = this.getFullKey(key);
      const serialized = await this.redis.get(fullKey);
      
      if (serialized) {
        try {
          const document: RedisDocument<T> = JSON.parse(serialized);
          if (document.tags) {
            for (const tag of document.tags) {
              pipeline.srem(`${this.config.keyPrefix}tags:${tag}`, key);
            }
          }
        } catch (error) {
          // Ignore JSON parse errors
        }
      }
    }

    await pipeline.exec();

    // Delete the keys
    const fullKeys = keys.map(key => this.getFullKey(key));
    const result = await this.redis.del(...fullKeys);
    return result;
  }

  async find(filter: FilterOptions): Promise<T[]> {
    if (!this.connected) throw new Error("Redis not initialized");

    let keys: string[] = [];

    // If tags filter is provided, use tag sets
    if (filter.tags && filter.tags.length > 0) {
      const tagKeys = filter.tags.map(tag => `${this.config.keyPrefix}tags:${tag}`);
      
      if (tagKeys.length === 1) {
        keys = await this.redis.smembers(tagKeys[0]);
      } else {
        // Intersection of multiple tag sets
        keys = await this.redis.sinter(...tagKeys);
      }
    } else {
      // Scan all keys with our prefix
      const pattern = `${this.getFullKey("*")}`;
      const scanResult = await this.scanKeys(pattern);
      keys = scanResult.map(fullKey => this.stripPrefix(fullKey));
    }

    // Apply pagination
    if (filter.offset) {
      keys = keys.slice(filter.offset);
    }
    if (filter.limit) {
      keys = keys.slice(0, filter.limit);
    }

    // Get the data
    const results = await this.getBatch(keys);
    return results.filter((item): item is T => item !== null);
  }

  async count(filter?: FilterOptions): Promise<number> {
    if (!this.connected) throw new Error("Redis not initialized");

    if (filter?.tags && filter.tags.length > 0) {
      const tagKeys = filter.tags.map(tag => `${this.config.keyPrefix}tags:${tag}`);
      
      if (tagKeys.length === 1) {
        return await this.redis.scard(tagKeys[0]);
      } else {
        // Count intersection
        const tempKey = `${this.config.keyPrefix}temp:count:${Date.now()}`;
        await this.redis.sinterstore(tempKey, ...tagKeys);
        const count = await this.redis.scard(tempKey);
        await this.redis.del(tempKey);
        return count;
      }
    } else {
      // Count all keys with our prefix
      const pattern = `${this.getFullKey("*")}`;
      const keys = await this.scanKeys(pattern);
      return keys.length;
    }
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    if (!this.connected) throw new Error("Redis not initialized");

    let deleted = 0;
    const pattern = `${this.getFullKey("*")}`;
    const keys = await this.scanKeys(pattern);

    for (const fullKey of keys) {
      const serialized = await this.redis.get(fullKey);
      if (!serialized) continue;

      try {
        const document: RedisDocument<T> = JSON.parse(serialized);
        let shouldDelete = false;

        if (options?.expiredOnly && document.expiresAt) {
          if (Date.now() > document.expiresAt) {
            shouldDelete = true;
          }
        } else if (!options?.expiredOnly) {
          shouldDelete = true;
        }

        if (shouldDelete && !options?.dryRun) {
          const key = this.stripPrefix(fullKey);
          await this.delete(key);
          deleted++;
        }
      } catch (error) {
        // Invalid JSON, delete it
        if (!options?.dryRun) {
          await this.redis.del(fullKey);
          deleted++;
        }
      }
    }

    return deleted;
  }

  async getStats(): Promise<StorageStats> {
    if (!this.connected) throw new Error("Redis not initialized");

    const pattern = `${this.getFullKey("*")}`;
    const keys = await this.scanKeys(pattern);
    
    let totalItems = 0;
    let activeItems = 0;
    let expiredItems = 0;
    let totalSize = 0;
    let oldestItem: Date | undefined;
    let newestItem: Date | undefined;

    const now = Date.now();

    for (const fullKey of keys) {
      const serialized = await this.redis.get(fullKey);
      if (!serialized) continue;

      try {
        const document: RedisDocument<T> = JSON.parse(serialized);
        totalItems++;
        totalSize += serialized.length;

        const createdAt = new Date(document.createdAt);
        if (!oldestItem || createdAt < oldestItem) {
          oldestItem = createdAt;
        }
        if (!newestItem || createdAt > newestItem) {
          newestItem = createdAt;
        }

        if (document.expiresAt && now > document.expiresAt) {
          expiredItems++;
        } else {
          activeItems++;
        }
      } catch (error) {
        // Invalid JSON
        totalItems++;
        totalSize += serialized.length;
      }
    }

    return {
      totalItems,
      activeItems,
      expiredItems,
      totalSize,
      avgItemSize: totalItems > 0 ? Math.round(totalSize / totalItems) : 0,
      oldestItem,
      newestItem,
      storageType: StorageType.REDIS,
      customStats: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix || "",
      },
    };
  }

  getStorageType(): StorageType {
    return StorageType.REDIS;
  }

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix || ""}${key}`;
  }

  private stripPrefix(fullKey: string): string {
    const prefix = this.config.keyPrefix || "";
    return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";

    do {
      const result = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 1000);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    return keys;
  }

  // Redis-specific helper methods
  async flushDatabase(): Promise<void> {
    if (!this.connected) throw new Error("Redis not initialized");
    await this.redis.flushdb();
  }

  async getRedisInfo(): Promise<any> {
    if (!this.connected) throw new Error("Redis not initialized");
    return await this.redis.info();
  }
} 