import { DatabaseAdapter, DatabaseConfig, DatabaseDialect } from './types.js';
import { SQLiteAdapter } from './adapters/sqlite-adapter.js';
import { MySQLAdapter } from './adapters/mysql-adapter.js';
import { PostgreSQLAdapter } from './adapters/postgresql-adapter.js';

export class DatabaseFactory {
  static async create(config: DatabaseConfig): Promise<DatabaseAdapter> {
    // Validate database type
    if (!config.type || !Object.values(DatabaseDialect).includes(config.type as DatabaseDialect)) {
      console.warn(`Invalid database type '${config.type}', falling back to SQLite`);
      config.type = DatabaseDialect.SQLITE;
      config.path = config.path || './logs/snapshots.db';
    }

    switch (config.type) {
      case DatabaseDialect.SQLITE:
        return new SQLiteAdapter(config);
      case DatabaseDialect.MYSQL:
        return new MySQLAdapter(config);
      case DatabaseDialect.POSTGRESQL:
        return new PostgreSQLAdapter(config);
      default:
        // This should never happen after the validation above, but just in case
        console.warn(`Unsupported database type: ${config.type}, falling back to SQLite`);
        return new SQLiteAdapter({
          ...config,
          type: DatabaseDialect.SQLITE,
          path: './logs/snapshots.db',
        });
    }
  }

  static validateConfig(config: DatabaseConfig): void {
    switch (config.type) {
      case DatabaseDialect.SQLITE:
        if (!config.path) {
          throw new Error('SQLite database path is required');
        }
        break;
      case DatabaseDialect.MYSQL:
      case DatabaseDialect.POSTGRESQL:
        if (!config.host || !config.user || !config.database) {
          throw new Error(`${config.type} requires host, user, and database configuration`);
        }
        break;
      default:
        throw new Error(`Unknown database type: ${config.type}`);
    }
  }

  static getDefaultConfig(type: DatabaseDialect): Partial<DatabaseConfig> {
    switch (type) {
      case DatabaseDialect.SQLITE:
        return {
          type,
          path: './logs/snapshots.db',
        };
      case DatabaseDialect.MYSQL:
        return {
          type,
          host: 'localhost',
          port: 3306,
          poolMin: 2,
          poolMax: 10,
          poolTimeout: 30000,
        };
      case DatabaseDialect.POSTGRESQL:
        return {
          type,
          host: 'localhost',
          port: 5432,
          poolMin: 2,
          poolMax: 10,
          poolTimeout: 30000,
        };
      default:
        throw new Error(`Unknown database type: ${type}`);
    }
  }
}
