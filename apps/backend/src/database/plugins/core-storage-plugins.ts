import {
  StoragePluginRegistry,
  StoragePlugin,
} from "../storage-plugin-registry.js";
import { StorageType, StorageAdapter, StorageConfig } from "../types.js";
import { DatabaseFactory } from "../factory.js";

// Import external storage plugins
import { 
  registerExternalStoragePlugins, 
  getExternalStorageDefaults 
} from "./external-storage-plugins.js";

// Try to import external storage adapters (they may not be available)
let RedisStorageAdapter: any = null;
let MongoStorageAdapter: any = null;
let S3StorageAdapter: any = null;

// Dynamically import external adapters if dependencies are available
async function loadExternalAdapters() {
  try {
    // Check if ioredis is available first
    await import("ioredis");
    const redisModule = await import("../adapters/redis-storage-adapter.js");
    RedisStorageAdapter = redisModule.RedisStorageAdapter;
    console.log("✅ Redis storage adapter loaded");
  } catch (error) {
    console.debug("Redis adapter not available - ioredis package not installed");
  }

  try {
    // Check if mongodb is available first
    await import("mongodb");
    const mongoModule = await import("../adapters/mongodb-storage-adapter.js");
    MongoStorageAdapter = mongoModule.MongoStorageAdapter;
    console.log("✅ MongoDB storage adapter loaded");
  } catch (error) {
    console.debug("MongoDB adapter not available - mongodb package not installed");
  }

  try {
    // Check if AWS SDK is available first
    await import("@aws-sdk/client-s3");
    const s3Module = await import("../adapters/s3-storage-adapter.js");
    S3StorageAdapter = s3Module.S3StorageAdapter;
    console.log("✅ S3 storage adapter loaded");
  } catch (error) {
    console.debug("S3 adapter not available - @aws-sdk/client-s3 package not installed");
  }
}

// SQL Storage Adapter Wrapper
class SQLStorageAdapterWrapper<T> implements StorageAdapter<T> {
  constructor(private config: StorageConfig) {}

  async initialize(): Promise<void> {
    // SQL adapters are initialized through DatabaseFactory
  }

  async close(): Promise<void> {
    // Handled by SnapshotRepository
  }

  async save(key: string, data: T, options?: any): Promise<void> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async get(key: string): Promise<T | null> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async delete(key: string): Promise<boolean> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async exists(key: string): Promise<boolean> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async saveBatch(): Promise<void> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async getBatch(): Promise<Array<T | null>> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async deleteBatch(): Promise<number> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async find(): Promise<T[]> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async count(): Promise<number> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async cleanup(): Promise<number> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  async getStats(): Promise<any> {
    throw new Error(
      "SQL storage should use SnapshotRepository directly, not the generic adapter interface"
    );
  }

  getStorageType(): StorageType {
    return this.config.type;
  }
}

// Local File Storage Adapter
class LocalFileStorageAdapter<T> implements StorageAdapter<T> {
  constructor(private config: StorageConfig) {
    if (!config.directory) {
      throw new Error("Directory is required for local file storage");
    }
  }

  async initialize(): Promise<void> {
    const fs = await import("fs/promises");
    try {
      await fs.mkdir(this.config.directory!, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create storage directory: ${error}`);
    }
  }

  async close(): Promise<void> {
    // No cleanup needed for file storage
  }

  async save(key: string, data: T, options?: any): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const filePath = path.join(
      this.config.directory!,
      `${this.sanitizeKey(key)}.json`
    );
    const document = {
      key,
      data,
      createdAt: new Date().toISOString(),
      expiresAt: options?.ttl
        ? new Date(Date.now() + options.ttl * 1000).toISOString()
        : null,
      tags: options?.tags,
      metadata: options?.metadata,
    };

    await fs.writeFile(filePath, JSON.stringify(document, null, 2));
  }

  async get(key: string): Promise<T | null> {
    const fs = await import("fs/promises");
    const path = await import("path");

    try {
      const filePath = path.join(
        this.config.directory!,
        `${this.sanitizeKey(key)}.json`
      );
      const content = await fs.readFile(filePath, "utf-8");
      const document = JSON.parse(content);

      // Check expiration
      if (document.expiresAt && new Date() > new Date(document.expiresAt)) {
        await this.delete(key);
        return null;
      }

      return document.data;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    const fs = await import("fs/promises");
    const path = await import("path");

    try {
      const filePath = path.join(
        this.config.directory!,
        `${this.sanitizeKey(key)}.json`
      );
      await fs.unlink(filePath);
      return true;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fs = await import("fs/promises");
    const path = await import("path");

    try {
      const filePath = path.join(
        this.config.directory!,
        `${this.sanitizeKey(key)}.json`
      );
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async saveBatch(
    items: Array<{ key: string; data: T; options?: any }>
  ): Promise<void> {
    const promises = items.map((item) =>
      this.save(item.key, item.data, item.options)
    );
    await Promise.all(promises);
  }

  async getBatch(keys: string[]): Promise<Array<T | null>> {
    const promises = keys.map((key) => this.get(key));
    return await Promise.all(promises);
  }

  async deleteBatch(keys: string[]): Promise<number> {
    const promises = keys.map((key) => this.delete(key));
    const results = await Promise.all(promises);
    return results.filter(Boolean).length;
  }

  async find(filter: any): Promise<T[]> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const files = await fs.readdir(this.config.directory!);
    const results: T[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.config.directory!, file);
        const content = await fs.readFile(filePath, "utf-8");
        const document = JSON.parse(content);

        if (this.matchesFilter(document, filter)) {
          results.push(document.data);
        }
      } catch (error) {
        continue; // Skip corrupted files
      }
    }

    return results;
  }

  async count(filter?: any): Promise<number> {
    const items = await this.find(filter || {});
    return items.length;
  }

  async cleanup(options?: any): Promise<number> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const files = await fs.readdir(this.config.directory!);
    let deleted = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.config.directory!, file);
        const content = await fs.readFile(filePath, "utf-8");
        const document = JSON.parse(content);

        let shouldDelete = false;

        if (options?.expiredOnly && document.expiresAt) {
          if (new Date() > new Date(document.expiresAt)) {
            shouldDelete = true;
          }
        } else if (!options?.expiredOnly) {
          shouldDelete = true;
        }

        if (shouldDelete && !options?.dryRun) {
          await fs.unlink(filePath);
          deleted++;
        }
      } catch (error) {
        continue; // Skip corrupted files
      }
    }

    return deleted;
  }

  async getStats(): Promise<any> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const files = await fs.readdir(this.config.directory!);
    let totalItems = 0;
    let totalSize = 0;
    let activeItems = 0;
    let expiredItems = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.config.directory!, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf-8");
        const document = JSON.parse(content);

        totalItems++;
        totalSize += stats.size;

        if (document.expiresAt && new Date() > new Date(document.expiresAt)) {
          expiredItems++;
        } else {
          activeItems++;
        }
      } catch (error) {
        continue; // Skip corrupted files
      }
    }

    return {
      totalItems,
      activeItems,
      expiredItems,
      totalSize,
      avgItemSize: totalItems > 0 ? Math.round(totalSize / totalItems) : 0,
      storageType: StorageType.LOCAL_FILE,
    };
  }

  getStorageType(): StorageType {
    return StorageType.LOCAL_FILE;
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[<>:"/\\|?*]/g, "_");
  }

  private matchesFilter(document: any, filter: any): boolean {
    if (filter.expiresAfter && document.expiresAt) {
      if (new Date(document.expiresAt) <= filter.expiresAfter) {
        return false;
      }
    }
    return true;
  }
}

// Core storage plugins
const corePlugins: StoragePlugin[] = [
  {
    name: "SQLite Storage",
    type: StorageType.SQLITE,
    description: "SQLite database storage (built-in)",
    dependencies: [], // No external dependencies
    configSchema: {
      required: ["path"],
    },
    adapterClass: SQLStorageAdapterWrapper,
  },
  {
    name: "MySQL Storage",
    type: StorageType.MYSQL,
    description: "MySQL database storage (built-in)",
    dependencies: [], // mysql2 is already a dependency
    configSchema: {
      required: ["host", "database"],
    },
    adapterClass: SQLStorageAdapterWrapper,
  },
  {
    name: "PostgreSQL Storage",
    type: StorageType.POSTGRESQL,
    description: "PostgreSQL database storage (built-in)",
    dependencies: [], // pg is already a dependency
    configSchema: {
      required: ["host", "database"],
    },
    adapterClass: SQLStorageAdapterWrapper,
  },
  {
    name: "Local File Storage",
    type: StorageType.LOCAL_FILE,
    description: "Local file system storage (built-in)",
    dependencies: [], // No external dependencies
    configSchema: {
      required: ["directory"],
    },
    adapterClass: LocalFileStorageAdapter,
  },
];

/**
 * Register all core storage plugins
 */
export async function registerCoreStoragePlugins(): Promise<void> {
  // Load external adapters first
  await loadExternalAdapters();

  // Create dynamic plugins for external storage types if adapters are available
  const dynamicPlugins: StoragePlugin[] = [];

  if (RedisStorageAdapter) {
    dynamicPlugins.push({
      name: "Redis Storage",
      type: StorageType.REDIS,
      description: "Redis storage with TTL and pub/sub support",
      dependencies: ["ioredis"],
      configSchema: {
        required: ["host", "port"],
      },
      adapterClass: RedisStorageAdapter,
    });
  }

  if (MongoStorageAdapter) {
    dynamicPlugins.push({
      name: "MongoDB Storage",
      type: StorageType.MONGODB,
      description: "MongoDB storage with TTL and indexing",
      dependencies: ["mongodb"],
      configSchema: {
        required: ["connectionString", "database", "collection"],
      },
      adapterClass: MongoStorageAdapter,
    });
  }

  if (S3StorageAdapter) {
    dynamicPlugins.push({
      name: "AWS S3 Storage",
      type: StorageType.S3,
      description: "AWS S3 storage with compression and encryption",
      dependencies: ["@aws-sdk/client-s3"],
      configSchema: {
        required: ["bucket", "region"],
      },
      adapterClass: S3StorageAdapter,
    });
  }

  // Register core plugins
  const allPlugins = [...corePlugins, ...dynamicPlugins];
  
  for (const plugin of allPlugins) {
    try {
      StoragePluginRegistry.registerPlugin(plugin);
    } catch (error) {
      console.warn(`Failed to register core plugin ${plugin.name}:`, error);
    }
  }

  // Register external placeholder plugins for missing dependencies
  registerExternalStoragePlugins();
}

/**
 * Get default configuration for core storage types
 */
export function getCoreStorageDefaults(
  type: StorageType
): Partial<StorageConfig> {
  switch (type) {
    case StorageType.SQLITE:
      return {
        type: StorageType.SQLITE,
        path: "./storage/snapshots.db",
      };

    case StorageType.MYSQL:
      return {
        type: StorageType.MYSQL,
        host: "localhost",
        port: 3306,
        database: "proxy_stone",
        poolMin: 2,
        poolMax: 10,
      };

    case StorageType.POSTGRESQL:
      return {
        type: StorageType.POSTGRESQL,
        host: "localhost",
        port: 5432,
        database: "proxy_stone",
        poolMin: 2,
        poolMax: 10,
      };

    case StorageType.LOCAL_FILE:
      return {
        type: StorageType.LOCAL_FILE,
        directory: "./storage/snapshots",
      };

    case StorageType.REDIS:
      return {
        type: StorageType.REDIS,
        host: "localhost",
        port: 6379,
        keyPrefix: "snapshots:",
        ttl: 3600, // Default TTL in seconds
      };

    case StorageType.MONGODB:
      return {
        type: StorageType.MONGODB,
        connectionString: "mongodb://localhost:27017",
        database: "proxy_stone",
        collection: "snapshots",
      };

    case StorageType.S3:
      return {
        type: StorageType.S3,
        bucket: "proxy-stone-snapshots",
        region: "us-east-1",
        keyPrefix: "snapshots/",
        compression: true,
        encryption: true,
      };

    // Try external storage defaults
    case StorageType.DYNAMODB:
    case StorageType.AZURE_BLOB:
    case StorageType.GCS:
      try {
        return getExternalStorageDefaults(type);
      } catch (error) {
        throw new Error(`No default config available for storage type: ${type}`);
      }

    default:
      throw new Error(`No default config available for storage type: ${type}`);
  }
}
