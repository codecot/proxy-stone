import {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseDialect,
} from "../../../database/types.js";
import { DatabaseFactory } from "../../../database/factory.js";
import { CredentialsRepository } from "./repository.js";

export class PasswordManagerDatabaseService {
  private db: DatabaseAdapter | null = null;
  private repository: CredentialsRepository | null = null;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this.config = config || this.getDefaultPasswordManagerConfig();
  }

  private getDefaultPasswordManagerConfig(): DatabaseConfig {
    // Default password manager specific configuration
    // Uses separate database/path from main application database
    return {
      type: DatabaseDialect.SQLITE,
      path: "./storage/password-manager.db",
    };
  }

  private getPasswordManagerConfig(baseConfig: DatabaseConfig): DatabaseConfig {
    // Create password manager specific configuration based on main app config
    switch (baseConfig.type) {
      case DatabaseDialect.SQLITE:
        return {
          ...baseConfig,
          path:
            baseConfig.path?.replace("snapshots.db", "password-manager.db") ||
            "./storage/password-manager.db",
        };

      case DatabaseDialect.MYSQL:
        return {
          ...baseConfig,
          database: baseConfig.database
            ? `${baseConfig.database}_passwords`
            : "proxy_stone_passwords",
        };

      case DatabaseDialect.POSTGRESQL:
        return {
          ...baseConfig,
          database: baseConfig.database
            ? `${baseConfig.database}_passwords`
            : "proxy_stone_passwords",
        };

      default:
        // Fallback to SQLite
        return this.getDefaultPasswordManagerConfig();
    }
  }

  // Static method to create service with main app database configuration
  static createWithAppConfig(
    appDatabaseConfig: DatabaseConfig
  ): PasswordManagerDatabaseService {
    const service = new PasswordManagerDatabaseService();
    service.config = service.getPasswordManagerConfig(appDatabaseConfig);
    return service;
  }

  async initialize(): Promise<void> {
    try {
      // Create database adapter
      this.db = await DatabaseFactory.create(this.config);
      await this.db.initialize();

      // Initialize repository
      this.repository = new CredentialsRepository(this.db);
      await this.repository.initialize();

      console.log(
        `Password manager database initialized with ${this.config.type} at ${this.config.path || this.config.host}`
      );

      // Log configuration details for different database types
      if (this.config.type === DatabaseDialect.SQLITE) {
        console.log(`  📁 Database file: ${this.config.path}`);
      } else {
        console.log(
          `  🌐 Database: ${this.config.database} at ${this.config.host}:${this.config.port}`
        );
      }
    } catch (error) {
      console.error("Failed to initialize password manager database:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.repository = null;
    }
  }

  getRepository(): CredentialsRepository {
    if (!this.repository) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.repository;
  }

  getDatabase(): DatabaseAdapter {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  getConfig(): DatabaseConfig {
    return this.config;
  }

  isInitialized(): boolean {
    return this.db !== null && this.repository !== null;
  }
}
