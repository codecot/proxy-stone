import Database from "better-sqlite3";
import type { DatabaseConfig } from "@proxy-stone/shared";
import type { Logger } from "@proxy-stone/logger";
import type { Database as DatabaseInterface } from "../index.js";

export class SQLiteAdapter implements DatabaseInterface {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    try {
      const dbPath = this.config.filename || "./data/proxy-stone.db";
      this.db = new Database(dbPath);

      // Enable WAL mode for better concurrency
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("synchronous = NORMAL");
      this.db.pragma("cache_size = 1000");
      this.db.pragma("temp_store = memory");

      this.logger.info(`Connected to SQLite database: ${dbPath}`);
    } catch (error) {
      this.logger.error("Failed to connect to SQLite database", { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info("Disconnected from SQLite database");
    }
  }

  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.all(params) as T[];
      return result;
    } catch (error) {
      this.logger.error("SQLite query failed", { sql, params, error });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) {
      throw new Error("Database not connected");
    }

    try {
      const stmt = this.db.prepare(sql);
      stmt.run(params);
    } catch (error) {
      this.logger.error("SQLite execute failed", { sql, params, error });
      throw error;
    }
  }

  async transaction<T>(fn: (db: DatabaseInterface) => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error("Database not connected");
    }

    const transaction = this.db.transaction(() => {
      return fn(this);
    });

    try {
      return await transaction();
    } catch (error) {
      this.logger.error("SQLite transaction failed", { error });
      throw error;
    }
  }
}
