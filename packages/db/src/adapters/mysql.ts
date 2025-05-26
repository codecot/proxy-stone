import mysql from "mysql2/promise";
import type { DatabaseConfig } from "@proxy-stone/shared";
import type { Logger } from "@proxy-stone/logger";
import type { Database as DatabaseInterface } from "../index.js";

export class MySQLAdapter implements DatabaseInterface {
  private connection: mysql.Connection | null = null;
  private config: DatabaseConfig;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host || "localhost",
        port: this.config.port || 3306,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        charset: "utf8mb4",
        timezone: "+00:00",
        connectTimeout: 60000,
      });

      this.logger.info(
        `Connected to MySQL database: ${this.config.host}:${this.config.port}/${this.config.database}`
      );
    } catch (error) {
      this.logger.error("Failed to connect to MySQL database", { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      this.logger.info("Disconnected from MySQL database");
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.connection) {
      throw new Error("Database not connected");
    }

    try {
      const [rows] = await this.connection.execute(sql, params);
      return rows as T[];
    } catch (error) {
      this.logger.error("MySQL query failed", { sql, params, error });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.connection) {
      throw new Error("Database not connected");
    }

    try {
      await this.connection.execute(sql, params);
    } catch (error) {
      this.logger.error("MySQL execute failed", { sql, params, error });
      throw error;
    }
  }

  async transaction<T>(fn: (db: DatabaseInterface) => Promise<T>): Promise<T> {
    if (!this.connection) {
      throw new Error("Database not connected");
    }

    await this.connection.beginTransaction();

    try {
      const result = await fn(this);
      await this.connection.commit();
      return result;
    } catch (error) {
      await this.connection.rollback();
      this.logger.error("MySQL transaction failed", { error });
      throw error;
    }
  }
}
