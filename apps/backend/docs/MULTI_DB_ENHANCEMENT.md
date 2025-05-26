# 🗄️ Multi-Database Support Implementation Plan

## 🎯 Overview

Enhance the proxy server to support MySQL, PostgreSQL, and SQLite with runtime database selection via configuration parameters.

## 📋 Configuration Parameters

### Command Line Arguments

```bash
# SQLite (default)
--db-type sqlite --db-path ./logs/data.db

# MySQL
--db-type mysql --db-host localhost --db-port 3306 --db-name proxy_cache --db-user username --db-password password

# PostgreSQL
--db-type postgresql --db-host localhost --db-port 5432 --db-name proxy_cache --db-user username --db-password password
```

### Environment Variables

```bash
# Database type
export DB_TYPE=postgresql  # sqlite, mysql, postgresql

# Connection details
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=proxy_cache
export DB_USER=proxy_user
export DB_PASSWORD=secure_password

# SQLite specific
export DB_PATH=./logs/data.db

# Connection pool settings
export DB_POOL_MIN=2
export DB_POOL_MAX=10
export DB_POOL_TIMEOUT=30000
```

## 🏗️ Database Abstraction Layer

### DatabaseAdapter Interface

```typescript
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

export enum DatabaseDialect {
  SQLITE = 'sqlite',
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
}

export interface TableSchema {
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  constraints?: ConstraintDefinition[];
}
```

### Database Factory

```typescript
export class DatabaseFactory {
  static async create(config: DatabaseConfig): Promise<DatabaseAdapter> {
    switch (config.type) {
      case DatabaseDialect.SQLITE:
        return new SQLiteAdapter(config);
      case DatabaseDialect.MYSQL:
        return new MySQLAdapter(config);
      case DatabaseDialect.POSTGRESQL:
        return new PostgreSQLAdapter(config);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }
}
```

## 🛠️ Database Adapter Implementations

### SQLite Adapter (Current Enhanced)

```typescript
export class SQLiteAdapter implements DatabaseAdapter {
  private db: sqlite3.Database | null = null;

  async initialize(): Promise<void> {
    const dbDir = path.dirname(this.config.path);
    await fs.mkdir(dbDir, { recursive: true });

    this.db = new sqlite3.Database(this.config.path);

    // Enable WAL mode for better concurrency
    await this.execute('PRAGMA journal_mode=WAL');
    await this.execute('PRAGMA foreign_keys=ON');
  }

  formatPlaceholder(index: number): string {
    return '?';
  }

  getDialect(): DatabaseDialect {
    return DatabaseDialect.SQLITE;
  }
}
```

### MySQL Adapter

```typescript
import mysql from 'mysql2/promise';

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool | null = null;

  async initialize(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.poolMax || 10,
      queueLimit: 0,
      acquireTimeout: this.config.poolTimeout || 30000,
      timezone: 'Z',
    });

    // Test connection
    const connection = await this.pool.getConnection();
    await connection.release();
  }

  formatPlaceholder(index: number): string {
    return '?';
  }

  getDialect(): DatabaseDialect {
    return DatabaseDialect.MYSQL;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool!.execute(sql, params);
    return rows as T[];
  }
}
```

### PostgreSQL Adapter

```typescript
import { Pool } from 'pg';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;

  async initialize(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      min: this.config.poolMin || 2,
      max: this.config.poolMax || 10,
      idleTimeoutMillis: this.config.poolTimeout || 30000,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  formatPlaceholder(index: number): string {
    return `$${index}`;
  }

  getDialect(): DatabaseDialect {
    return DatabaseDialect.POSTGRESQL;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.pool!.query(sql, params);
    return result.rows as T[];
  }
}
```

## 📊 Schema Management

### Cross-Database Schema Definitions

```typescript
export const SNAPSHOTS_SCHEMA: TableSchema = {
  columns: [
    { name: 'id', type: 'SERIAL', primaryKey: true },
    { name: 'cache_key', type: 'VARCHAR(255)', unique: true, notNull: true },
    { name: 'url', type: 'TEXT', notNull: true },
    { name: 'method', type: 'VARCHAR(10)', notNull: true },
    { name: 'status_code', type: 'INTEGER', notNull: true },
    { name: 'created_at', type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'expires_at', type: 'TIMESTAMP', notNull: true },
    { name: 'manual_snapshot', type: 'BOOLEAN', defaultValue: false },
    { name: 'backend_host', type: 'VARCHAR(255)', notNull: true },
    { name: 'payload_hash', type: 'VARCHAR(64)' },
    { name: 'headers_hash', type: 'VARCHAR(64)' },
    { name: 'request_body', type: 'TEXT' },
    { name: 'response_size', type: 'INTEGER' },
    { name: 'content_type', type: 'VARCHAR(255)' },
    { name: 'tags', type: 'JSON' }, // TEXT for SQLite
    { name: 'description', type: 'TEXT' },
    { name: 'last_accessed_at', type: 'TIMESTAMP' },
    { name: 'access_count', type: 'INTEGER', defaultValue: 0 },
  ],
  indexes: [
    { name: 'idx_snapshots_cache_key', columns: ['cache_key'] },
    { name: 'idx_snapshots_url', columns: ['url'] },
    { name: 'idx_snapshots_method', columns: ['method'] },
    { name: 'idx_snapshots_backend', columns: ['backend_host'] },
    { name: 'idx_snapshots_expires', columns: ['expires_at'] },
    { name: 'idx_snapshots_manual', columns: ['manual_snapshot'] },
  ],
};
```

### Database-Specific SQL Generation

```typescript
export class SQLGenerator {
  constructor(private dialect: DatabaseDialect) {}

  generateCreateTable(tableName: string, schema: TableSchema): string {
    const columns = schema.columns.map((col) => this.formatColumn(col)).join(',\n  ');
    const constraints = this.generateConstraints(schema.columns);

    return `CREATE TABLE ${tableName} (\n  ${columns}${constraints}\n)`;
  }

  private formatColumn(column: ColumnDefinition): string {
    const parts = [column.name];

    // Handle database-specific types
    switch (this.dialect) {
      case DatabaseDialect.SQLITE:
        parts.push(this.mapToSQLiteType(column.type));
        break;
      case DatabaseDialect.MYSQL:
        parts.push(this.mapToMySQLType(column.type));
        break;
      case DatabaseDialect.POSTGRESQL:
        parts.push(this.mapToPostgreSQLType(column.type));
        break;
    }

    if (column.primaryKey) parts.push('PRIMARY KEY');
    if (column.notNull) parts.push('NOT NULL');
    if (column.unique) parts.push('UNIQUE');
    if (column.defaultValue) parts.push(`DEFAULT ${column.defaultValue}`);

    return parts.join(' ');
  }

  private mapToPostgreSQLType(type: string): string {
    const typeMap: Record<string, string> = {
      SERIAL: 'SERIAL',
      'VARCHAR(255)': 'VARCHAR(255)',
      TEXT: 'TEXT',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      TIMESTAMP: 'TIMESTAMP WITH TIME ZONE',
      JSON: 'JSONB',
    };
    return typeMap[type] || type;
  }

  private mapToMySQLType(type: string): string {
    const typeMap: Record<string, string> = {
      SERIAL: 'INT AUTO_INCREMENT',
      'VARCHAR(255)': 'VARCHAR(255)',
      TEXT: 'TEXT',
      INTEGER: 'INT',
      BOOLEAN: 'BOOLEAN',
      TIMESTAMP: 'TIMESTAMP',
      JSON: 'JSON',
    };
    return typeMap[type] || type;
  }
}
```

## 🔧 Service Integration

### Enhanced SnapshotManager

```typescript
export class SnapshotManager {
  private db: DatabaseAdapter;
  private sqlGenerator: SQLGenerator;

  constructor(
    private enabled: boolean = true,
    private dbConfig: DatabaseConfig
  ) {}

  async initialize(): Promise<void> {
    if (!this.enabled) return;

    // Create database adapter
    this.db = await DatabaseFactory.create(this.dbConfig);
    await this.db.initialize();

    this.sqlGenerator = new SQLGenerator(this.db.getDialect());

    // Create tables if they don't exist
    await this.ensureTables();

    console.log(`Snapshot manager initialized with ${this.dbConfig.type} database`);
  }

  private async ensureTables(): Promise<void> {
    if (!(await this.db.tableExists('snapshots'))) {
      const createSQL = this.sqlGenerator.generateCreateTable('snapshots', SNAPSHOTS_SCHEMA);
      await this.db.execute(createSQL);

      // Create indexes
      for (const index of SNAPSHOTS_SCHEMA.indexes) {
        const indexSQL = this.sqlGenerator.generateCreateIndex('snapshots', index);
        await this.db.execute(indexSQL);
      }
    }
  }

  async recordSnapshot(/* ... parameters ... */): Promise<void> {
    if (!this.enabled || !this.db) return;

    const placeholders = this.generatePlaceholders(15);
    const sql = `
      INSERT OR REPLACE INTO snapshots (
        cache_key, url, method, status_code, created_at, expires_at,
        manual_snapshot, backend_host, payload_hash, headers_hash,
        request_body, response_size, content_type, tags, access_count
      ) VALUES (${placeholders})
    `;

    // Handle database-specific syntax
    const finalSQL = this.adaptSQL(sql);

    await this.db.execute(finalSQL, [
      cacheKey,
      url,
      method,
      statusCode,
      now.toISOString(),
      expiresAt.toISOString(),
      false,
      backendHost,
      payloadHash,
      headersHash,
      requestBody ? JSON.stringify(requestBody) : null,
      responseSize,
      contentType,
      tags ? JSON.stringify(tags) : null,
      0,
    ]);
  }

  private generatePlaceholders(count: number): string {
    return Array.from({ length: count }, (_, i) => this.db.formatPlaceholder(i + 1)).join(', ');
  }

  private adaptSQL(sql: string): string {
    switch (this.db.getDialect()) {
      case DatabaseDialect.MYSQL:
        return sql.replace('INSERT OR REPLACE', 'REPLACE');
      case DatabaseDialect.POSTGRESQL:
        return sql.replace('INSERT OR REPLACE', 'INSERT ... ON CONFLICT (cache_key) DO UPDATE SET');
      default:
        return sql;
    }
  }
}
```

## 📦 Package Dependencies

### Additional Dependencies Needed

```json
{
  "dependencies": {
    "mysql2": "^3.6.0",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "@types/pg": "^8.10.2"
  }
}
```

## 🚀 Usage Examples

### SQLite (Current)

```bash
npm run dev -- --db-type sqlite --db-path ./logs/data.db
```

### MySQL Production Setup

```bash
npm run dev -- \
  --db-type mysql \
  --db-host db.example.com \
  --db-port 3306 \
  --db-name proxy_cache \
  --db-user proxy_user \
  --db-password secure_password \
  --db-pool-max 20
```

### PostgreSQL with Environment Variables

```bash
export DB_TYPE=postgresql
export DB_HOST=postgres.example.com
export DB_PORT=5432
export DB_NAME=proxy_cache
export DB_USER=proxy_user
export DB_PASSWORD=secure_password
export DB_POOL_MIN=5
export DB_POOL_MAX=25

npm run start
```

## 🏭 Production Benefits

### Scalability

- **Connection pooling** for high-concurrency scenarios
- **Horizontal scaling** with external database servers
- **Replication support** for read/write splitting

### Reliability

- **ACID transactions** for data consistency
- **Backup and recovery** with enterprise database tools
- **High availability** with database clustering

### Performance

- **Optimized queries** with database-specific features
- **Advanced indexing** capabilities
- **Query optimization** tools

### Integration

- **Existing infrastructure** compatibility
- **Monitoring tools** integration
- **Security features** (SSL, encryption, access control)

## 🧪 Migration Strategy

### Phase 1: Core Infrastructure

1. Implement database abstraction layer
2. Create SQLite adapter (enhanced current)
3. Add configuration system

### Phase 2: MySQL Support

1. Implement MySQL adapter
2. Add connection pooling
3. Test with existing functionality

### Phase 3: PostgreSQL Support

1. Implement PostgreSQL adapter
2. Add advanced features (JSONB, arrays)
3. Performance optimization

### Phase 4: Migration Tools

1. Database migration utilities
2. Data export/import tools
3. Schema versioning system

## 🔧 Implementation Effort

### Estimated Timeline

- **Week 1-2**: Database abstraction layer and factory
- **Week 3**: MySQL adapter implementation
- **Week 4**: PostgreSQL adapter implementation
- **Week 5**: Testing and optimization
- **Week 6**: Documentation and migration tools

### Complexity Level: **Medium-High**

- Database abstraction requires careful design
- SQL dialect differences need handling
- Connection pooling and error handling
- Migration utilities for existing data

## 🎯 Immediate Next Steps

1. **Design database configuration schema**
2. **Implement DatabaseAdapter interface**
3. **Create SQLite adapter as reference**
4. **Add MySQL support with mysql2**
5. **Extend to PostgreSQL with pg**
6. **Create migration utilities**

This enhancement would significantly improve the proxy server's enterprise readiness and deployment flexibility!
