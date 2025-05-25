import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter, DatabaseConfig, DatabaseDialect, TableSchema } from '../types.js';
import { SQLGenerator } from '../sql-generator.js';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private client: PoolClient | null = null;
  private sqlGenerator: SQLGenerator;
  private inTransaction = false;

  constructor(private config: DatabaseConfig) {
    this.sqlGenerator = new SQLGenerator(DatabaseDialect.POSTGRESQL);
  }

  async initialize(): Promise<void> {
    if (!this.config.host || !this.config.user || !this.config.database) {
      throw new Error('PostgreSQL host, user, and database are required');
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port || 5432,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      min: this.config.poolMin || 2,
      max: this.config.poolMax || 10,
      idleTimeoutMillis: this.config.poolTimeout || 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const client = this.client || this.pool;
    const result = await client.query(sql, params);
    return result.rows as T[];
  }

  async execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number }> {
    if (!this.pool) throw new Error('Database not initialized');

    const client = this.client || this.pool;
    const result = await client.query(sql, params);

    return {
      affectedRows: result.rowCount || 0,
      // PostgreSQL doesn't have a direct insertId, but we can return the first row if it contains an id
      insertId: result.rows.length > 0 && result.rows[0].id ? result.rows[0].id : undefined,
    };
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    if (!this.pool) throw new Error('Database not initialized');

    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction || !this.client) {
      throw new Error('No transaction in progress');
    }

    await this.client.query('COMMIT');
    this.client.release();
    this.client = null;
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction || !this.client) {
      throw new Error('No transaction in progress');
    }

    await this.client.query('ROLLBACK');
    this.client.release();
    this.client = null;
    this.inTransaction = false;
  }

  async createTable(tableName: string, schema: TableSchema): Promise<void> {
    const createSQL = this.sqlGenerator.generateCreateTable(tableName, schema);
    await this.execute(createSQL);

    // Create indexes
    for (const index of schema.indexes) {
      const indexSQL = this.sqlGenerator.generateCreateIndex(tableName, index);
      try {
        await this.execute(indexSQL);
      } catch (error) {
        // Ignore if index already exists (PostgreSQL error code 42P07)
        if (!(error instanceof Error) || !error.message?.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    return result.length > 0;
  }

  getDialect(): DatabaseDialect {
    return DatabaseDialect.POSTGRESQL;
  }

  formatPlaceholder(index: number): string {
    return `$${index}`;
  }

  // PostgreSQL-specific helper methods
  async getVersion(): Promise<string> {
    const [result] = await this.query('SELECT version()');
    return result?.version || 'unknown';
  }

  async getTableStats(tableName: string): Promise<{
    rows: number;
    size: number;
    indexes: number;
  }> {
    const [statsResult] = await this.query(
      `SELECT 
         schemaname,
         tablename,
         attname,
         n_distinct,
         correlation
       FROM pg_stats 
       WHERE tablename = $1 
       LIMIT 1`,
      [tableName]
    );

    const [sizeResult] = await this.query(
      `SELECT 
         pg_total_relation_size($1) as total_size,
         pg_relation_size($1) as table_size,
         pg_indexes_size($1) as indexes_size`,
      [tableName]
    );

    const [rowCountResult] = await this.query(
      `SELECT reltuples::bigint as estimate FROM pg_class WHERE relname = $1`,
      [tableName]
    );

    return {
      rows: rowCountResult?.estimate || 0,
      size: sizeResult?.table_size || 0,
      indexes: sizeResult?.indexes_size || 0,
    };
  }

  async vacuum(tableName?: string): Promise<void> {
    const sql = tableName ? `VACUUM ${tableName}` : 'VACUUM';
    await this.execute(sql);
  }

  async analyze(tableName?: string): Promise<void> {
    const sql = tableName ? `ANALYZE ${tableName}` : 'ANALYZE';
    await this.execute(sql);
  }
}
