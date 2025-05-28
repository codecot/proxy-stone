/**
 * Example: How to create external storage plugins
 *
 * This file shows how to create storage plugins that can be distributed
 * as separate npm packages and loaded dynamically.
 */

import {
  StorageAdapter,
  StorageConfig,
  StorageType,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "@/database/types.js";
import {
  StoragePluginRegistry,
  StoragePlugin,
} from "@/database/storage-plugin-registry.js";

// Example 1: MongoDB Storage Plugin
// This would be in a separate package: @proxy-stone/storage-mongodb

interface MongoStorageConfig extends StorageConfig {
  connectionString: string;
  database: string;
  collection?: string;
}

class MongoStorageAdapter<T> implements StorageAdapter<T> {
  constructor(private config: MongoStorageConfig) {}

  async initialize(): Promise<void> {
    // Would use mongodb package here
    throw new Error("MongoDB package not installed. Run: npm install mongodb");
  }

  async close(): Promise<void> {}
  async save(key: string, data: T, options?: SaveOptions): Promise<void> {}
  async get(key: string): Promise<T | null> {
    return null;
  }
  async delete(key: string): Promise<boolean> {
    return false;
  }
  async exists(key: string): Promise<boolean> {
    return false;
  }
  async saveBatch(): Promise<void> {}
  async getBatch(): Promise<Array<T | null>> {
    return [];
  }
  async deleteBatch(): Promise<number> {
    return 0;
  }
  async find(): Promise<T[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
  async cleanup(): Promise<number> {
    return 0;
  }
  async getStats(): Promise<StorageStats> {
    return {
      totalItems: 0,
      activeItems: 0,
      expiredItems: 0,
      totalSize: 0,
      avgItemSize: 0,
      storageType: "mongodb" as any,
    };
  }
  getStorageType() {
    return "mongodb" as any;
  }
}

// MongoDB Plugin Definition
const mongoPlugin: StoragePlugin = {
  name: "MongoDB Storage",
  type: "mongodb" as any,
  description: "MongoDB storage adapter with TTL and indexing",
  dependencies: ["mongodb"],
  configSchema: {
    required: ["connectionString", "database"],
  },
  adapterClass: MongoStorageAdapter,
};

// Example 2: S3 Storage Plugin
// This would be in a separate package: @proxy-stone/storage-s3

interface S3StorageConfig extends StorageConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

class S3StorageAdapter<T> implements StorageAdapter<T> {
  constructor(private config: S3StorageConfig) {}

  async initialize(): Promise<void> {
    // Would use @aws-sdk/client-s3 here
    throw new Error(
      "AWS SDK not installed. Run: npm install @aws-sdk/client-s3"
    );
  }

  async close(): Promise<void> {}
  async save(key: string, data: T, options?: SaveOptions): Promise<void> {}
  async get(key: string): Promise<T | null> {
    return null;
  }
  async delete(key: string): Promise<boolean> {
    return false;
  }
  async exists(key: string): Promise<boolean> {
    return false;
  }
  async saveBatch(): Promise<void> {}
  async getBatch(): Promise<Array<T | null>> {
    return [];
  }
  async deleteBatch(): Promise<number> {
    return 0;
  }
  async find(): Promise<T[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
  async cleanup(): Promise<number> {
    return 0;
  }
  async getStats(): Promise<StorageStats> {
    return {
      totalItems: 0,
      activeItems: 0,
      expiredItems: 0,
      totalSize: 0,
      avgItemSize: 0,
      storageType: "s3" as any,
    };
  }
  getStorageType() {
    return "s3" as any;
  }
}

// S3 Plugin Definition
const s3Plugin: StoragePlugin = {
  name: "AWS S3 Storage",
  type: "s3" as any,
  description: "AWS S3 storage with compression and encryption",
  dependencies: ["@aws-sdk/client-s3"],
  configSchema: {
    required: ["bucket", "region"],
  },
  adapterClass: S3StorageAdapter,
};

// Example 3: Redis Storage Plugin
// This would be in a separate package: @proxy-stone/storage-redis

interface RedisStorageConfig extends StorageConfig {
  host: string;
  port: number;
  password?: string;
  keyPrefix?: string;
}

class RedisStorageAdapter<T> implements StorageAdapter<T> {
  constructor(private config: RedisStorageConfig) {}

  async initialize(): Promise<void> {
    // Would use ioredis here
    throw new Error("Redis package not installed. Run: npm install ioredis");
  }

  async close(): Promise<void> {}
  async save(key: string, data: T, options?: SaveOptions): Promise<void> {}
  async get(key: string): Promise<T | null> {
    return null;
  }
  async delete(key: string): Promise<boolean> {
    return false;
  }
  async exists(key: string): Promise<boolean> {
    return false;
  }
  async saveBatch(): Promise<void> {}
  async getBatch(): Promise<Array<T | null>> {
    return [];
  }
  async deleteBatch(): Promise<number> {
    return 0;
  }
  async find(): Promise<T[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
  async cleanup(): Promise<number> {
    return 0;
  }
  async getStats(): Promise<StorageStats> {
    return {
      totalItems: 0,
      activeItems: 0,
      expiredItems: 0,
      totalSize: 0,
      avgItemSize: 0,
      storageType: "redis" as any,
    };
  }
  getStorageType() {
    return "redis" as any;
  }
}

// Redis Plugin Definition
const redisPlugin: StoragePlugin = {
  name: "Redis Storage",
  type: "redis" as any,
  description: "Redis storage with TTL and pub/sub support",
  dependencies: ["ioredis"],
  configSchema: {
    required: ["host", "port"],
  },
  adapterClass: RedisStorageAdapter,
};

/**
 * Example: How to register external plugins
 */
export function registerExternalPlugins() {
  console.log("🔌 Registering external storage plugins...");

  try {
    StoragePluginRegistry.registerPlugin(mongoPlugin);
    console.log("✅ MongoDB plugin registered");
  } catch (error) {
    console.log("⚠️ MongoDB plugin failed:", (error as Error).message);
  }

  try {
    StoragePluginRegistry.registerPlugin(s3Plugin);
    console.log("✅ S3 plugin registered");
  } catch (error) {
    console.log("⚠️ S3 plugin failed:", (error as Error).message);
  }

  try {
    StoragePluginRegistry.registerPlugin(redisPlugin);
    console.log("✅ Redis plugin registered");
  } catch (error) {
    console.log("⚠️ Redis plugin failed:", (error as Error).message);
  }

  // Show available plugins
  const availablePlugins = StoragePluginRegistry.getAllPlugins();
  console.log("\n📦 Available storage plugins:");
  for (const plugin of availablePlugins) {
    console.log(`  - ${plugin.name}: ${plugin.description}`);
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      console.log(`    Dependencies: ${plugin.dependencies.join(", ")}`);
    }
  }
}

/**
 * Example: How to use external plugins
 */
export async function useExternalPlugin() {
  // Register plugins first
  registerExternalPlugins();

  // Try to use MongoDB plugin
  try {
    const mongoConfig = {
      type: "mongodb" as any,
      connectionString: "mongodb://localhost:27017",
      database: "proxy_stone",
      collection: "snapshots",
    };

    const adapter = await StoragePluginRegistry.createAdapter(
      "mongodb" as any,
      mongoConfig
    );
    console.log("✅ MongoDB adapter created successfully");

    // Would use the adapter here...
    await adapter.initialize();
  } catch (error) {
    console.log("❌ MongoDB adapter failed:", (error as Error).message);
  }
}

/**
 * Example: Package.json for external plugin
 */
export const examplePackageJson = {
  name: "@proxy-stone/storage-mongodb",
  version: "1.0.0",
  description: "MongoDB storage adapter plugin for Proxy Stone",
  main: "dist/index.js",
  types: "dist/index.d.ts",
  keywords: ["proxy-stone", "storage", "mongodb", "plugin"],
  peerDependencies: {
    "@proxy-stone/backend": "^1.0.0",
  },
  dependencies: {
    mongodb: "^6.0.0",
  },
  files: ["dist/"],
  scripts: {
    build: "tsc",
    prepublishOnly: "npm run build",
  },
};

/**
 * Example: How the external plugin would export itself
 */
export const examplePluginExport = `
// @proxy-stone/storage-mongodb/src/index.ts
import { StoragePluginRegistry } from '@proxy-stone/backend';
import { MongoStorageAdapter } from './mongo-adapter.js';

export const mongoPlugin = {
  name: "MongoDB Storage",
  type: "mongodb",
  description: "MongoDB storage adapter with TTL and indexing",
  dependencies: ["mongodb"],
  configSchema: {
    required: ["connectionString", "database"],
  },
  adapterClass: MongoStorageAdapter,
};

// Auto-register when imported
export default {
  async register(registry: typeof StoragePluginRegistry) {
    registry.registerPlugin(mongoPlugin);
  }
};

// Also export the adapter for direct use
export { MongoStorageAdapter };
`;

/**
 * Example: How to install and use external plugins
 */
export const usageInstructions = `
# Install external storage plugins
npm install @proxy-stone/storage-mongodb
npm install @proxy-stone/storage-s3
npm install @proxy-stone/storage-redis

# They will be auto-discovered and registered
# Or manually register them:

import { StoragePluginRegistry } from '@proxy-stone/backend';
import mongoPlugin from '@proxy-stone/storage-mongodb';
import s3Plugin from '@proxy-stone/storage-s3';

await mongoPlugin.register(StoragePluginRegistry);
await s3Plugin.register(StoragePluginRegistry);

# Then use them in your config:
const config = {
  type: 'mongodb',
  connectionString: 'mongodb://localhost:27017',
  database: 'proxy_stone',
  collection: 'snapshots'
};

const repository = await StorageFactory.createSnapshotStorage(config);
`;

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  registerExternalPlugins();
  useExternalPlugin();
}
