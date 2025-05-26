export enum DatabaseDialect {
  SQLITE = 'sqlite',
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
}

export interface DatabaseConfig {
  type: DatabaseDialect;
  // SQLite specific
  path?: string;
  // MySQL/PostgreSQL specific
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  // Connection pool settings
  poolMin?: number;
  poolMax?: number;
  poolTimeout?: number;
}

export interface DatabaseAdapter {
  // Connection management
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Query execution
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number }>;

  // Transaction support
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;

  // Schema management
  createTable(tableName: string, schema: TableSchema): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;

  // Database-specific features
  getDialect(): DatabaseDialect;
  formatPlaceholder(index: number): string; // ?, $1, etc.
}

export interface ColumnDefinition {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  notNull?: boolean;
  defaultValue?: string | number | boolean;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface ConstraintDefinition {
  name: string;
  type: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  references?: {
    table: string;
    columns: string[];
  };
  expression?: string; // For CHECK constraints
}

export interface TableSchema {
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  constraints?: ConstraintDefinition[];
}

export interface QueryResult {
  affectedRows: number;
  insertId?: number;
}

export interface TransactionContext {
  inTransaction: boolean;
}
