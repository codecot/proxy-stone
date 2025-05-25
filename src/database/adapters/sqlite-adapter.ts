import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { DatabaseAdapter, DatabaseConfig, DatabaseDialect, TableSchema } from '../types.js';
import { SQLGenerator } from '../sql-generator.js';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: sqlite3.Database | null = null;
  private sqlGenerator: SQLGenerator;
  private inTransaction = false;

  constructor(private config: DatabaseConfig) {
    this.sqlGenerator = new SQLGenerator(DatabaseDialect.SQLITE);
  }

  async initialize(): Promise<void> {
    if (!this.config.path) {
      throw new Error('SQLite database path is required');
    }

    // Ensure directory exists
    const dbDir = path.dirname(this.config.path);
    await fs.mkdir(dbDir, { recursive: true });

    this.db = new sqlite3.Database(this.config.path);

    // Enable WAL mode for better concurrency
    await this.execute('PRAGMA journal_mode=WAL');
    await this.execute('PRAGMA foreign_keys=ON');
    await this.execute('PRAGMA busy_timeout=30000');
  }

  async close(): Promise<void> {
    if (this.db) {
      const close = promisify(this.db.close.bind(this.db));
      await close();
      this.db = null;
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');

    const all = promisify(this.db.all.bind(this.db)) as (
      sql: string,
      params?: any[]
    ) => Promise<T[]>;

    return await all(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number }> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db)) as (
      sql: string,
      params?: any[]
    ) => Promise<sqlite3.RunResult>;

    const result = await run(sql, params);
    return {
      affectedRows: result?.changes ?? 0,
      insertId: result?.lastID,
    };
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    await this.execute('BEGIN TRANSACTION');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.execute('COMMIT');
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.execute('ROLLBACK');
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
        // Ignore if index already exists
        if (!(error instanceof Error) || !error.message?.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return result.length > 0;
  }

  getDialect(): DatabaseDialect {
    return DatabaseDialect.SQLITE;
  }

  formatPlaceholder(index: number): string {
    return '?';
  }

  // SQLite-specific helper methods
  async enableWAL(): Promise<void> {
    await this.execute('PRAGMA journal_mode=WAL');
  }

  async vacuum(): Promise<void> {
    await this.execute('VACUUM');
  }

  async getStats(): Promise<{
    pageCount: number;
    pageSize: number;
    databaseSize: number;
    freePageCount: number;
  }> {
    const [pageCountResult] = await this.query('PRAGMA page_count');
    const [pageSizeResult] = await this.query('PRAGMA page_size');
    const [freePageCountResult] = await this.query('PRAGMA freelist_count');

    return {
      pageCount: pageCountResult?.page_count || 0,
      pageSize: pageSizeResult?.page_size || 0,
      databaseSize: (pageCountResult?.page_count || 0) * (pageSizeResult?.page_size || 0),
      freePageCount: freePageCountResult?.freelist_count || 0,
    };
  }
}
