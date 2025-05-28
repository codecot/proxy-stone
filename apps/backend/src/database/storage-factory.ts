import { StorageAdapter, StorageConfig, StorageType } from "./types.js";
import { SnapshotRepository } from "./repositories/snapshot-repository.js";
import { DatabaseFactory } from "./index.js";
import { StoragePluginRegistry } from "./storage-plugin-registry.js";
import {
  registerCoreStoragePlugins,
  getCoreStorageDefaults,
} from "./plugins/core-storage-plugins.js";

// Re-export types for convenience
export type { StorageAdapter, StorageConfig } from "./types.js";
export { StorageType } from "./types.js";
export { StoragePluginRegistry } from "./storage-plugin-registry.js";

export class StorageFactory {
  private static initialized = false;

  /**
   * Initialize the storage factory and register core plugins
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register core storage plugins
    await registerCoreStoragePlugins();

    // Auto-discover external plugins
    await StoragePluginRegistry.discoverPlugins("./plugins/storage");
    await StoragePluginRegistry.discoverPlugins(
      "./node_modules/@proxy-stone/storage-*"
    );

    this.initialized = true;
  }

  /**
   * Create a snapshot storage repository using the plugin system
   */
  static async createSnapshotStorage(
    config: StorageConfig
  ): Promise<SnapshotRepository> {
    await this.initialize();

    // For now, we only support SQL storage types in the core
    // External plugins can provide their own repository implementations
    if (!this.isSQLStorage(config.type)) {
      throw new Error(
        `Storage type '${config.type}' requires an external plugin. ` +
          `Core storage types: ${[StorageType.SQLITE, StorageType.MYSQL, StorageType.POSTGRESQL, StorageType.LOCAL_FILE].join(", ")}`
      );
    }

    return await this.createSQLSnapshotRepository(config);
  }

  /**
   * Create a storage adapter using the plugin system
   */
  static async createStorageAdapter<T = any>(
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    await this.initialize();

    return await StoragePluginRegistry.createAdapter<T>(config.type, config);
  }

  /**
   * Create SQL-based snapshot repository (existing implementation)
   */
  private static async createSQLSnapshotRepository(
    config: StorageConfig
  ): Promise<SnapshotRepository> {
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
    return new SnapshotRepository(dbAdapter);
  }

  /**
   * Check if storage type is SQL-based
   */
  private static isSQLStorage(type: StorageType): boolean {
    return [
      StorageType.SQLITE,
      StorageType.MYSQL,
      StorageType.POSTGRESQL,
    ].includes(type);
  }

  /**
   * Get default configuration for a storage type
   */
  static getDefaultConfig(storageType: StorageType): Partial<StorageConfig> {
    return getCoreStorageDefaults(storageType);
  }

  /**
   * Validate storage configuration
   */
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

      case StorageType.LOCAL_FILE:
        if (!config.directory) {
          throw new Error("Directory is required for local file storage");
        }
        break;

      case StorageType.REDIS:
        if (!config.host || !config.port) {
          throw new Error("Host and port are required for Redis storage");
        }
        break;

      case StorageType.MONGODB:
        if (!config.connectionString || !config.database || !config.collection) {
          throw new Error("Connection string, database, and collection are required for MongoDB storage");
        }
        break;

      case StorageType.S3:
        if (!config.bucket || !config.region) {
          throw new Error("Bucket and region are required for S3 storage");
        }
        break;

      default:
        throw new Error(
          `Validation not implemented for storage type: ${config.type}`
        );
    }
  }
}
