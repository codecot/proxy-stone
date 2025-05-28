import mysql from 'mysql2/promise';
import { DatabaseAdapter, DatabaseConfig, DatabaseDialect, TableSchema } from '@/database/types.js';
import { SQLGenerator } from '@/database/sql-generator.js';

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private connection: mysql.PoolConnection | null = null;
  private sqlGenerator: SQLGenerator;
  private inTransaction = false;

  constructor(private config: DatabaseConfig) {
    this.sqlGenerator = new SQLGenerator(DatabaseDialect.MYSQL);
  }

  async initialize(): Promise<void> {
    if (!this.config.host || !this.config.user || !this.config.database) {
      throw new Error('MySQL host, user, and database are required');
    }

    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port || 3306,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.poolMax || 10,
      queueLimit: 0,
    });

    // Test connection
    const connection = await this.pool.getConnection();
    await connection.release();
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.release();
      this.connection = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const connection = this.connection || this.pool;
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number }> {
    if (!this.pool) throw new Error('Database not initialized');

    const connection = this.connection || this.pool;
    const [result] = await connection.execute(sql, params);

    const resultInfo = result as mysql.ResultSetHeader;
    return {
      affectedRows: resultInfo.affectedRows || 0,
      insertId: resultInfo.insertId,
    };
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    if (!this.pool) throw new Error('Database not initialized');

    this.connection = await this.pool.getConnection();
    await this.connection.beginTransaction();
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction || !this.connection) {
      throw new Error('No transaction in progress');
    }

    await this.connection.commit();
    await this.connection.release();
    this.connection = null;
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction || !this.connection) {
      throw new Error('No transaction in progress');
    }

    await this.connection.rollback();
    await this.connection.release();
    this.connection = null;
    this.inTransaction = false;
  }

  async createTable(tableName: string, schema: TableSchema): Promise<void> {
    const createSQL = this.sqlGenerator.generateCreateTable(tableName, schema);
    await this.execute(createSQL);

    // Create indexes
    for (const [_index, indexDef] of schema.indexes.entries()) {
      const indexSQL = this.sqlGenerator.generateCreateIndex(tableName, indexDef);
      try {
        await this.execute(indexSQL);
      } catch (error) {
        // Ignore if index already exists (MySQL error code 1061)
        if (!(error instanceof Error) || !error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [this.config.database, tableName]
    );
    return result.length > 0;
  }

  getDialect(): DatabaseDialect {
    return DatabaseDialect.MYSQL;
  }

  formatPlaceholder(index: number): string {
    return '?';
  }

  // MySQL-specific helper methods
  async getEngineInfo(): Promise<{
    version: string;
    engine: string;
    charset: string;
    collation: string;
  }> {
    const [versionResult] = await this.query('SELECT VERSION() as version');
    const [engineResult] = await this.query(
      'SELECT ENGINE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? LIMIT 1',
      [this.config.database]
    );
    const [charsetResult] = await this.query(
      `SELECT DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [this.config.database]
    );

    return {
      version: versionResult?.version || 'unknown',
      engine: engineResult?.ENGINE || 'unknown',
      charset: charsetResult?.charset || 'unknown',
      collation: charsetResult?.collation || 'unknown',
    };
  }

  async getTableStats(tableName: string): Promise<{
    rows: number;
    dataSize: number;
    indexSize: number;
  }> {
    const [result] = await this.query(
      `SELECT TABLE_ROWS as rows, DATA_LENGTH as data_size, INDEX_LENGTH as index_size
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [this.config.database, tableName]
    );

    return {
      rows: result?.rows || 0,
      dataSize: result?.data_size || 0,
      indexSize: result?.index_size || 0,
    };
  }
}
