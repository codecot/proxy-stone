export enum DatabaseDialect {
  SQLITE = "sqlite",
  MYSQL = "mysql",
  POSTGRESQL = "postgresql",
}

export enum StorageType {
  // SQL Databases (core)
  SQLITE = "sqlite",
  MYSQL = "mysql",
  POSTGRESQL = "postgresql",
  // Local File Storage (no dependencies)
  LOCAL_FILE = "local_file",
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

export interface StorageConfig {
  type: StorageType;

  // SQL Database configs
  path?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  poolMin?: number;
  poolMax?: number;
  poolTimeout?: number;

  // File storage configs
  directory?: string; // Local file directory

  // Common options
  compression?: boolean;
  encryption?: boolean;
  ttl?: number; // Default TTL for storage
}

export interface DatabaseAdapter {
  // Connection management
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Query execution
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(
    sql: string,
    params?: any[]
  ): Promise<{ affectedRows: number; insertId?: number }>;

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

export interface StorageAdapter<T = any> {
  // Connection management
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Basic CRUD operations
  save(key: string, data: T, options?: SaveOptions): Promise<void>;
  get(key: string): Promise<T | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;

  // Batch operations
  saveBatch(
    items: Array<{ key: string; data: T; options?: SaveOptions }>
  ): Promise<void>;
  getBatch(keys: string[]): Promise<Array<T | null>>;
  deleteBatch(keys: string[]): Promise<number>;

  // Query operations
  find(filter: FilterOptions): Promise<T[]>;
  count(filter?: FilterOptions): Promise<number>;

  // Maintenance operations
  cleanup(options?: CleanupOptions): Promise<number>;
  getStats(): Promise<StorageStats>;

  // Storage-specific features
  getStorageType(): StorageType;
}

export interface SaveOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for categorization
  metadata?: Record<string, any>; // Additional metadata
  compression?: boolean;
  encryption?: boolean;
}

export interface FilterOptions {
  // Common filters
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;

  // Pagination
  limit?: number;
  offset?: number;
  cursor?: string; // For cursor-based pagination

  // Sorting
  sortBy?: string;
  sortOrder?: "asc" | "desc";

  // Custom filters (storage-specific)
  customFilters?: Record<string, any>;
}

export interface CleanupOptions {
  expiredOnly?: boolean;
  olderThan?: Date;
  tags?: string[];
  dryRun?: boolean;
}

export interface StorageStats {
  totalItems: number;
  activeItems: number;
  expiredItems: number;
  totalSize: number; // in bytes
  avgItemSize: number;
  oldestItem?: Date;
  newestItem?: Date;
  storageType: StorageType;
  customStats?: Record<string, any>; // Storage-specific stats
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
  type: "PRIMARY_KEY" | "FOREIGN_KEY" | "UNIQUE" | "CHECK";
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
