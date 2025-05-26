import mysql from "mysql2/promise";
import {
  StorageAdapter,
  StorageConfig,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "@proxy-stone/backend";

export interface MySQLStorageConfig extends StorageConfig {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  connectionLimit?: number;
  acquireTimeout?: number;
  timeout?: number;
  reconnect?: boolean;
  ssl?: any;
  tableName?: string;
}

export class MySQLStorageAdapter<T> implements StorageAdapter<T> {
  private pool: mysql.Pool;
  private tableName: string;

  constructor(private config: MySQLStorageConfig) {
    this.tableName = config.tableName || "proxy_stone_snapshots";

    this.pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      user: config.user || "root",
      password: config.password,
      database: config.database,
      connectionLimit: config.connectionLimit || 10,
      acquireTimeout: config.acquireTimeout || 60000,
      timeout: config.timeout || 60000,
      reconnect: config.reconnect !== false,
      ssl: config.ssl,
    });

    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id VARCHAR(255) PRIMARY KEY,
          data JSON NOT NULL,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NULL,
          INDEX idx_created_at (created_at),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } finally {
      connection.release();
    }
  }

  async save(id: string, data: T, options?: SaveOptions): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      const expiresAt = options?.ttl
        ? new Date(Date.now() + options.ttl * 1000)
        : null;

      await connection.execute(
        `INSERT INTO ${this.tableName} (id, data, metadata, expires_at) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         data = VALUES(data), 
         metadata = VALUES(metadata), 
         expires_at = VALUES(expires_at),
         updated_at = CURRENT_TIMESTAMP`,
        [
          id,
          JSON.stringify(data),
          JSON.stringify(options?.metadata || {}),
          expiresAt,
        ]
      );
    } finally {
      connection.release();
    }
  }

  async load(id: string): Promise<T | null> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT data FROM ${this.tableName} 
         WHERE id = ? AND (expires_at IS NULL OR expires_at > NOW())`,
        [id]
      );

      const result = rows as any[];
      if (result.length === 0) {
        return null;
      }

      return JSON.parse(result[0].data);
    } finally {
      connection.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      const [result] = await connection.execute(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        [id]
      );

      return (result as any).affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  async exists(id: string): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 1 FROM ${this.tableName} 
         WHERE id = ? AND (expires_at IS NULL OR expires_at > NOW())`,
        [id]
      );

      return (rows as any[]).length > 0;
    } finally {
      connection.release();
    }
  }

  async list(options?: FilterOptions): Promise<string[]> {
    const connection = await this.pool.getConnection();
    try {
      let query = `SELECT id FROM ${this.tableName} WHERE (expires_at IS NULL OR expires_at > NOW())`;
      const params: any[] = [];

      if (options?.pattern) {
        query += " AND id LIKE ?";
        params.push(options.pattern.replace("*", "%"));
      }

      if (options?.limit) {
        query += " LIMIT ?";
        params.push(options.limit);
      }

      if (options?.offset) {
        query += " OFFSET ?";
        params.push(options.offset);
      }

      const [rows] = await connection.execute(query, params);
      return (rows as any[]).map((row) => row.id);
    } finally {
      connection.release();
    }
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    const connection = await this.pool.getConnection();
    try {
      let deletedCount = 0;

      // Clean up expired entries
      const [expiredResult] = await connection.execute(
        `DELETE FROM ${this.tableName} WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
      );
      deletedCount += (expiredResult as any).affectedRows;

      // Clean up old entries if maxAge is specified
      if (options?.maxAge) {
        const cutoffDate = new Date(Date.now() - options.maxAge * 1000);
        const [oldResult] = await connection.execute(
          `DELETE FROM ${this.tableName} WHERE created_at < ?`,
          [cutoffDate]
        );
        deletedCount += (oldResult as any).affectedRows;
      }

      return deletedCount;
    } finally {
      connection.release();
    }
  }

  async getStats(): Promise<StorageStats> {
    const connection = await this.pool.getConnection();
    try {
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM ${this.tableName} WHERE (expires_at IS NULL OR expires_at > NOW())`
      );

      const [sizeRows] = await connection.execute(
        `SELECT 
           ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
         FROM information_schema.tables 
         WHERE table_schema = ? AND table_name = ?`,
        [this.config.database, this.tableName]
      );

      const total = (countRows as any[])[0].total;
      const sizeInMB = (sizeRows as any[])[0]?.size_mb || 0;

      return {
        totalItems: total,
        totalSize: Math.round(sizeInMB * 1024 * 1024), // Convert back to bytes
        lastCleanup: new Date(),
      };
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
