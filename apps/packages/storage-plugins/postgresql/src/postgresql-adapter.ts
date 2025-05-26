import { Pool, PoolConfig } from "pg";
import {
  StorageAdapter,
  StorageConfig,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "@proxy-stone/backend";

export interface PostgreSQLStorageConfig extends StorageConfig {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: any;
  tableName?: string;
  schema?: string;
}

export class PostgreSQLStorageAdapter<T> implements StorageAdapter<T> {
  private pool: Pool;
  private tableName: string;
  private schema: string;
  private fullTableName: string;

  constructor(private config: PostgreSQLStorageConfig) {
    this.schema = config.schema || "public";
    this.tableName = config.tableName || "proxy_stone_snapshots";
    this.fullTableName = `${this.schema}.${this.tableName}`;

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port || 5432,
      user: config.user || "postgres",
      password: config.password,
      database: config.database,
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      ssl: config.ssl,
    };

    this.pool = new Pool(poolConfig);
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create schema if it doesn't exist
      if (this.schema !== "public") {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
      }

      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.fullTableName} (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NULL
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at 
        ON ${this.fullTableName} (created_at)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at 
        ON ${this.fullTableName} (expires_at) 
        WHERE expires_at IS NOT NULL
      `);

      // Create GIN index for JSONB data
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_data_gin 
        ON ${this.fullTableName} USING GIN (data)
      `);

      // Create trigger for updated_at
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS update_${this.tableName}_updated_at 
        ON ${this.fullTableName}
      `);

      await client.query(`
        CREATE TRIGGER update_${this.tableName}_updated_at 
        BEFORE UPDATE ON ${this.fullTableName} 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
    } finally {
      client.release();
    }
  }

  async save(id: string, data: T, options?: SaveOptions): Promise<void> {
    const client = await this.pool.connect();
    try {
      const expiresAt = options?.ttl
        ? new Date(Date.now() + options.ttl * 1000)
        : null;

      await client.query(
        `INSERT INTO ${this.fullTableName} (id, data, metadata, expires_at) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (id) DO UPDATE SET 
         data = EXCLUDED.data, 
         metadata = EXCLUDED.metadata, 
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
        [
          id,
          JSON.stringify(data),
          JSON.stringify(options?.metadata || {}),
          expiresAt,
        ]
      );
    } finally {
      client.release();
    }
  }

  async load(id: string): Promise<T | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT data FROM ${this.fullTableName} 
         WHERE id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return JSON.parse(result.rows[0].data);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM ${this.fullTableName} WHERE id = $1`,
        [id]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  async exists(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT 1 FROM ${this.fullTableName} 
         WHERE id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id]
      );

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async list(options?: FilterOptions): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      let query = `SELECT id FROM ${this.fullTableName} WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;
      const params: any[] = [];
      let paramCount = 0;

      if (options?.pattern) {
        paramCount++;
        query += ` AND id LIKE $${paramCount}`;
        params.push(options.pattern.replace("*", "%"));
      }

      query += " ORDER BY created_at DESC";

      if (options?.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(options.limit);
      }

      if (options?.offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(options.offset);
      }

      const result = await client.query(query, params);
      return result.rows.map((row) => row.id);
    } finally {
      client.release();
    }
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    const client = await this.pool.connect();
    try {
      let deletedCount = 0;

      // Clean up expired entries
      const expiredResult = await client.query(
        `DELETE FROM ${this.fullTableName} WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP`
      );
      deletedCount += expiredResult.rowCount || 0;

      // Clean up old entries if maxAge is specified
      if (options?.maxAge) {
        const cutoffDate = new Date(Date.now() - options.maxAge * 1000);
        const oldResult = await client.query(
          `DELETE FROM ${this.fullTableName} WHERE created_at < $1`,
          [cutoffDate]
        );
        deletedCount += oldResult.rowCount || 0;
      }

      return deletedCount;
    } finally {
      client.release();
    }
  }

  async getStats(): Promise<StorageStats> {
    const client = await this.pool.connect();
    try {
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM ${this.fullTableName} WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`
      );

      const sizeResult = await client.query(
        `SELECT pg_total_relation_size($1) as size_bytes`,
        [this.fullTableName]
      );

      const total = parseInt(countResult.rows[0].total);
      const sizeBytes = parseInt(sizeResult.rows[0].size_bytes || "0");

      return {
        totalItems: total,
        totalSize: sizeBytes,
        lastCleanup: new Date(),
      };
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
