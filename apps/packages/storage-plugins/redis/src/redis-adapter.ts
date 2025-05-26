import Redis, { RedisOptions } from "ioredis";
import {
  StorageAdapter,
  StorageConfig,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "@proxy-stone/backend";

export interface RedisStorageConfig extends StorageConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  family?: 4 | 6;
  keepAlive?: number;
  connectionName?: string;
  sentinels?: Array<{ host: string; port: number }>;
  name?: string;
}

interface RedisStorageData {
  data: any;
  metadata: any;
  createdAt: number;
  expiresAt?: number;
}

export class RedisStorageAdapter<T> implements StorageAdapter<T> {
  private client: Redis;
  private keyPrefix: string;

  constructor(private config: RedisStorageConfig) {
    this.keyPrefix = config.keyPrefix || "proxy-stone:";

    const options: RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      enableReadyCheck: config.enableReadyCheck !== false,
      lazyConnect: config.lazyConnect || false,
      family: config.family || 4,
      keepAlive: config.keepAlive || 30000,
      connectionName: config.connectionName,
    };

    if (config.sentinels && config.name) {
      options.sentinels = config.sentinels;
      options.name = config.name;
    }

    this.client = new Redis(options);

    this.client.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    this.client.on("connect", () => {
      console.log("Connected to Redis");
    });
  }

  private getKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  async save(id: string, data: T, options?: SaveOptions): Promise<void> {
    const key = this.getKey(id);
    const now = Date.now();
    const expiresAt = options?.ttl ? now + options.ttl * 1000 : undefined;

    const storageData: RedisStorageData = {
      data,
      metadata: options?.metadata || {},
      createdAt: now,
      ...(expiresAt && { expiresAt }),
    };

    const serializedData = JSON.stringify(storageData);

    if (options?.ttl) {
      // Set with TTL
      await this.client.setex(key, options.ttl, serializedData);
    } else {
      // Set without TTL
      await this.client.set(key, serializedData);
    }
  }

  async load(id: string): Promise<T | null> {
    const key = this.getKey(id);
    const result = await this.client.get(key);

    if (!result) {
      return null;
    }

    try {
      const storageData: RedisStorageData = JSON.parse(result);

      // Check if manually expired (in case TTL wasn't set)
      if (storageData.expiresAt && storageData.expiresAt <= Date.now()) {
        await this.delete(id);
        return null;
      }

      return storageData.data;
    } catch (error) {
      console.error("Failed to parse Redis data:", error);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    const key = this.getKey(id);
    const result = await this.client.del(key);
    return result > 0;
  }

  async exists(id: string): Promise<boolean> {
    const key = this.getKey(id);
    const result = await this.client.exists(key);
    return result === 1;
  }

  async list(options?: FilterOptions): Promise<string[]> {
    const pattern = options?.pattern
      ? `${this.keyPrefix}${options.pattern}`
      : `${this.keyPrefix}*`;

    const keys = await this.client.keys(pattern);

    let ids = keys.map((key) => key.replace(this.keyPrefix, ""));

    // Apply offset and limit
    if (options?.offset) {
      ids = ids.slice(options.offset);
    }

    if (options?.limit) {
      ids = ids.slice(0, options.limit);
    }

    return ids;
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    let deletedCount = 0;

    if (options?.maxAge) {
      const cutoffTime = Date.now() - options.maxAge * 1000;
      const allKeys = await this.client.keys(`${this.keyPrefix}*`);

      for (const key of allKeys) {
        try {
          const result = await this.client.get(key);
          if (result) {
            const storageData: RedisStorageData = JSON.parse(result);
            if (storageData.createdAt < cutoffTime) {
              await this.client.del(key);
              deletedCount++;
            }
          }
        } catch (error) {
          // Skip invalid data
          console.warn(`Failed to cleanup key ${key}:`, error);
        }
      }
    }

    return deletedCount;
  }

  async getStats(): Promise<StorageStats> {
    const keys = await this.client.keys(`${this.keyPrefix}*`);
    const totalItems = keys.length;

    // Get memory usage for all keys (approximate)
    let totalSize = 0;
    for (const key of keys.slice(0, 100)) {
      // Sample first 100 keys to avoid performance issues
      try {
        const memory = await this.client.memory("usage", key);
        totalSize += memory || 0;
      } catch (error) {
        // Memory command might not be available in all Redis versions
        break;
      }
    }

    // If memory command failed, estimate based on data length
    if (totalSize === 0 && keys.length > 0) {
      const sampleKeys = keys.slice(0, 10);
      let sampleSize = 0;

      for (const key of sampleKeys) {
        const value = await this.client.get(key);
        if (value) {
          sampleSize += Buffer.byteLength(value, "utf8");
        }
      }

      if (sampleKeys.length > 0) {
        const avgSize = sampleSize / sampleKeys.length;
        totalSize = Math.round(avgSize * totalItems);
      }
    }

    return {
      totalItems,
      totalSize,
      lastCleanup: new Date(),
    };
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
