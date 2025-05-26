import { StorageAdapter, StorageConfig, StorageType } from "./types.js";
import { SnapshotRepository } from "./repositories/snapshot-repository.js";
import {
  GenericSnapshotRepository,
  SnapshotDocument,
} from "./repositories/generic-snapshot-repository.js";
import { DatabaseAdapter, DatabaseFactory } from "./index.js";

// Re-export types for convenience
export type { StorageAdapter, StorageConfig } from "./types.js";
export { StorageType } from "./types.js";

// Import storage adapters (these would need the actual dependencies installed)
// import { S3StorageAdapter } from './adapters/s3-storage-adapter.js';
// import { MongoStorageAdapter } from './adapters/mongodb-storage-adapter.js';

export class StorageFactory {
  static async createSnapshotStorage(
    config: StorageConfig
  ): Promise<GenericSnapshotRepository> {
    const storageAdapter =
      await this.createStorageAdapter<SnapshotDocument>(config);
    return new GenericSnapshotRepository(storageAdapter);
  }

  static async createStorageAdapter<T = any>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    switch (config.type) {
      case StorageType.SQLITE:
      case StorageType.MYSQL:
      case StorageType.POSTGRESQL:
        return await this.createSQLStorageAdapter<T>(config);

      case StorageType.MONGODB:
        return await this.createMongoStorageAdapter<T>(config);

      case StorageType.REDIS:
        return await this.createRedisStorageAdapter<T>(config);

      case StorageType.S3:
        return await this.createS3StorageAdapter<T>(config);

      case StorageType.LOCAL_FILE:
        return await this.createLocalFileStorageAdapter<T>(config);

      case StorageType.AZURE_BLOB:
        return await this.createAzureBlobStorageAdapter<T>(config);

      case StorageType.GCS:
        return await this.createGCSStorageAdapter<T>(config);

      case StorageType.DYNAMODB:
        return await this.createDynamoDBStorageAdapter<T>(config);

      default:
        throw new Error(`Unsupported storage type: ${config.type}`);
    }
  }

  private static async createSQLStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    // Create a wrapper that adapts DatabaseAdapter to StorageAdapter interface
    const dbAdapter = await DatabaseFactory.create({
      type: config.type as any, // Convert StorageType to DatabaseDialect
      path: config.path,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      poolMin: config.poolMin,
      poolMax: config.poolMax,
      poolTimeout: config.poolTimeout,
    });

    await dbAdapter.initialize();
    return new SQLStorageAdapterWrapper<T>(dbAdapter);
  }

  private static async createMongoStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    if (!config.connectionString) {
      throw new Error("MongoDB connection string is required");
    }
    if (!config.database) {
      throw new Error("MongoDB database name is required");
    }

    // This would require the mongodb package to be installed
    throw new Error(
      "MongoDB adapter requires mongodb package. Install with: npm install mongodb"
    );

    // Uncomment when mongodb is available:
    // const { MongoStorageAdapter } = await import('./adapters/mongodb-storage-adapter.js');
    // const adapter = new MongoStorageAdapter<T>({
    //   connectionString: config.connectionString,
    //   database: config.database,
    //   collection: config.collection || 'snapshots',
    // });
    // await adapter.initialize();
    // return adapter;
  }

  private static async createRedisStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    throw new Error(
      "Redis adapter not implemented yet. Would require ioredis package."
    );
  }

  private static async createS3StorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    if (!config.bucket) {
      throw new Error("S3 bucket name is required");
    }
    if (!config.region) {
      throw new Error("S3 region is required");
    }

    // This would require the @aws-sdk/client-s3 package to be installed
    throw new Error(
      "S3 adapter requires @aws-sdk/client-s3 package. Install with: npm install @aws-sdk/client-s3"
    );

    // Uncomment when AWS SDK is available:
    // const { S3StorageAdapter } = await import('./adapters/s3-storage-adapter.js');
    // const adapter = new S3StorageAdapter<T>({
    //   bucket: config.bucket,
    //   region: config.region,
    //   accessKeyId: config.accessKeyId,
    //   secretAccessKey: config.secretAccessKey,
    //   endpoint: config.endpoint,
    //   keyPrefix: config.keyPrefix,
    //   compression: config.compression,
    //   encryption: config.encryption,
    // });
    // await adapter.initialize();
    // return adapter;
  }

  private static async createLocalFileStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    const directory = config.directory || "./storage";
    return new LocalFileStorageAdapter<T>(directory);
  }

  private static async createAzureBlobStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    throw new Error(
      "Azure Blob adapter not implemented yet. Would require @azure/storage-blob package."
    );
  }

  private static async createGCSStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    throw new Error(
      "Google Cloud Storage adapter not implemented yet. Would require @google-cloud/storage package."
    );
  }

  private static async createDynamoDBStorageAdapter<T>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    throw new Error(
      "DynamoDB adapter not implemented yet. Would require @aws-sdk/client-dynamodb package."
    );
  }

  static getDefaultConfig(storageType: StorageType): Partial<StorageConfig> {
    switch (storageType) {
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

      case StorageType.MONGODB:
        return {
          type: StorageType.MONGODB,
          connectionString: "mongodb://localhost:27017",
          database: "proxy_stone",
          collection: "snapshots",
        };

      case StorageType.REDIS:
        return {
          type: StorageType.REDIS,
          host: "localhost",
          port: 6379,
          keyPrefix: "snapshots:",
        };

      case StorageType.S3:
        return {
          type: StorageType.S3,
          region: "us-east-1",
          keyPrefix: "snapshots/",
        };

      case StorageType.LOCAL_FILE:
        return {
          type: StorageType.LOCAL_FILE,
          directory: "./storage/snapshots",
        };

      default:
        throw new Error(
          `No default config available for storage type: ${storageType}`
        );
    }
  }

  static validateConfig(config: StorageConfig): void {
    if (!config.type) {
      throw new Error("Storage type is required");
    }

    switch (config.type) {
      case StorageType.SQLITE:
        if (!config.path) {
          throw new Error("SQLite path is required");
        }
        break;

      case StorageType.MYSQL:
      case StorageType.POSTGRESQL:
        if (!config.host || !config.database) {
          throw new Error("Host and database are required for SQL databases");
        }
        break;

      case StorageType.MONGODB:
        if (!config.connectionString || !config.database) {
          throw new Error(
            "Connection string and database are required for MongoDB"
          );
        }
        break;

      case StorageType.S3:
        if (!config.bucket || !config.region) {
          throw new Error("Bucket and region are required for S3");
        }
        break;

      case StorageType.LOCAL_FILE:
        if (!config.directory) {
          throw new Error("Directory is required for local file storage");
        }
        break;

      default:
        throw new Error(
          `Validation not implemented for storage type: ${config.type}`
        );
    }
  }
}

// Wrapper to adapt DatabaseAdapter to StorageAdapter interface
class SQLStorageAdapterWrapper<T> implements StorageAdapter<T> {
  constructor(private dbAdapter: DatabaseAdapter) {}

  async initialize(): Promise<void> {
    // Already initialized in factory
  }

  async close(): Promise<void> {
    await this.dbAdapter.close();
  }

  async save(key: string, data: T, options?: any): Promise<void> {
    // This is a simplified implementation
    // In practice, you'd want to create a proper table schema and use the existing SnapshotRepository
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async get(key: string): Promise<T | null> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async delete(key: string): Promise<boolean> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async exists(key: string): Promise<boolean> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async saveBatch(
    items: Array<{ key: string; data: T; options?: any }>
  ): Promise<void> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async getBatch(keys: string[]): Promise<Array<T | null>> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async deleteBatch(keys: string[]): Promise<number> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async find(filter: any): Promise<T[]> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async count(filter?: any): Promise<number> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async cleanup(options?: any): Promise<number> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  async getStats(): Promise<any> {
    throw new Error(
      "SQL storage through generic adapter not fully implemented. Use SnapshotRepository instead."
    );
  }

  getStorageType(): StorageType {
    const dialect = this.dbAdapter.getDialect();
    return dialect as any; // Convert DatabaseDialect to StorageType
  }
}

// Simple local file storage adapter implementation
class LocalFileStorageAdapter<T> implements StorageAdapter<T> {
  constructor(private directory: string) {}

  async initialize(): Promise<void> {
    const fs = await import("fs/promises");
    try {
      await fs.mkdir(this.directory, { recursive: true });
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

    const filePath = path.join(this.directory, `${this.sanitizeKey(key)}.json`);
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
        this.directory,
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
        this.directory,
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
        this.directory,
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

    const files = await fs.readdir(this.directory);
    const results: T[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.directory, file);
        const content = await fs.readFile(filePath, "utf-8");
        const document = JSON.parse(content);

        // Apply basic filtering (simplified)
        if (this.matchesFilter(document, filter)) {
          results.push(document.data);
        }
      } catch (error) {
        // Skip corrupted files
        continue;
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

    const files = await fs.readdir(this.directory);
    let deleted = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.directory, file);
        const content = await fs.readFile(filePath, "utf-8");
        const document = JSON.parse(content);

        let shouldDelete = false;

        if (options?.expiredOnly && document.expiresAt) {
          if (new Date() > new Date(document.expiresAt)) {
            shouldDelete = true;
          }
        }

        if (!options?.expiredOnly) {
          shouldDelete = true;
        }

        if (shouldDelete && !options?.dryRun) {
          await fs.unlink(filePath);
          deleted++;
        }
      } catch (error) {
        // Skip corrupted files
        continue;
      }
    }

    return deleted;
  }

  async getStats(): Promise<any> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const files = await fs.readdir(this.directory);
    let totalItems = 0;
    let totalSize = 0;
    let activeItems = 0;
    let expiredItems = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(this.directory, file);
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
        // Skip corrupted files
        continue;
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
    // Replace invalid filename characters
    return key.replace(/[<>:"/\\|?*]/g, "_");
  }

  private matchesFilter(document: any, filter: any): boolean {
    // Simplified filter matching
    if (filter.expiresAfter && document.expiresAt) {
      if (new Date(document.expiresAt) <= filter.expiresAfter) {
        return false;
      }
    }

    return true;
  }
}
