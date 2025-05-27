// Database adapters and schema management for Proxy Stone
import type { DatabaseConfig } from "@proxy-stone/shared";
import type { Logger } from "@proxy-stone/logger";

// Base database interface
export interface Database {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
}

// Database factory
export async function createDatabase(
  config: DatabaseConfig,
  logger: Logger
): Promise<Database> {
  switch (config.type) {
    case "sqlite": {
      const { SQLiteAdapter } = await import("./adapters/sqlite.js");
      return new SQLiteAdapter(config, logger);
    }
    case "mysql": {
      const { MySQLAdapter } = await import("./adapters/mysql.js");
      return new MySQLAdapter(config, logger);
    }
    case "postgresql": {
      const { PostgreSQLAdapter } = await import("./adapters/postgresql.js");
      return new PostgreSQLAdapter(config, logger);
    }
    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}

// Schema management
export interface SchemaManager {
  createTables(): Promise<void>;
  dropTables(): Promise<void>;
  migrate(version: string): Promise<void>;
  getCurrentVersion(): Promise<string | null>;
}

export function createSchemaManager(db: Database): SchemaManager {
  return {
    async createTables() {
      // Create proxy requests table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS proxy_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          method VARCHAR(10) NOT NULL,
          url TEXT NOT NULL,
          headers TEXT,
          status_code INTEGER,
          duration INTEGER,
          cached BOOLEAN DEFAULT FALSE,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create cache entries table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS cache_entries (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          ttl INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME
        )
      `);

      // Create health checks table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS health_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          status VARCHAR(20) NOT NULL,
          services TEXT,
          uptime INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create schema version table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version VARCHAR(50) PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },

    async dropTables() {
      await db.execute("DROP TABLE IF EXISTS proxy_requests");
      await db.execute("DROP TABLE IF EXISTS cache_entries");
      await db.execute("DROP TABLE IF EXISTS health_checks");
      await db.execute("DROP TABLE IF EXISTS schema_version");
    },

    async migrate(version: string) {
      // Simple migration system - can be expanded
      await db.execute(
        "INSERT OR REPLACE INTO schema_version (version) VALUES (?)",
        [version]
      );
    },

    async getCurrentVersion() {
      const result = await db.query<{ version: string }>(
        "SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1"
      );
      return result.length > 0 ? result[0].version : null;
    },
  };
}

// Export types
export type { DatabaseConfig };
