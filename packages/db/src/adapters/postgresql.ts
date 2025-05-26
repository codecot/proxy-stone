import { Client } from "pg";
import type { DatabaseConfig } from "@proxy-stone/shared";
import type { Logger } from "@proxy-stone/logger";
import type { Database as DatabaseInterface } from "../index.js";

export class PostgreSQLAdapter implements DatabaseInterface {
  private client: Client | null = null;
  private config: DatabaseConfig;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        host: this.config.host || "localhost",
        port: this.config.port || 5432,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        connectionTimeoutMillis: 60000,
        query_timeout: 60000,
        statement_timeout: 60000,
      });

      await this.client.connect();
      this.logger.info(
        `Connected to PostgreSQL database: ${this.config.host}:${this.config.port}/${this.config.database}`
      );
    } catch (error) {
      this.logger.error("Failed to connect to PostgreSQL database", { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.logger.info("Disconnected from PostgreSQL database");
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.client) {
      throw new Error("Database not connected");
    }

    try {
      const result = await this.client.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      this.logger.error("PostgreSQL query failed", { sql, params, error });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.client) {
      throw new Error("Database not connected");
    }

    try {
      await this.client.query(sql, params);
    } catch (error) {
      this.logger.error("PostgreSQL execute failed", { sql, params, error });
      throw error;
    }
  }

  async transaction<T>(fn: (db: DatabaseInterface) => Promise<T>): Promise<T> {
    if (!this.client) {
      throw new Error("Database not connected");
    }

    await this.client.query("BEGIN");

    try {
      const result = await fn(this);
      await this.client.query("COMMIT");
      return result;
    } catch (error) {
      await this.client.query("ROLLBACK");
      this.logger.error("PostgreSQL transaction failed", { error });
      throw error;
    }
  }
}
