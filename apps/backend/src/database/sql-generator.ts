import { DatabaseDialect, TableSchema, ColumnDefinition, IndexDefinition } from './types.js';

export class SQLGenerator {
  constructor(private dialect: DatabaseDialect) {}

  generateCreateTable(tableName: string, schema: TableSchema): string {
    const columns = schema.columns.map((col) => this.formatColumn(col)).join(',\n  ');
    const constraints = this.generateConstraints(schema.columns);

    return `CREATE TABLE ${this.escapeIdentifier(tableName)} (\n  ${columns}${constraints}\n)`;
  }

  generateCreateIndex(tableName: string, index: IndexDefinition): string {
    const indexType = index.unique ? 'UNIQUE INDEX' : 'INDEX';
    const columns = index.columns.map((col) => this.escapeIdentifier(col)).join(', ');

    return `CREATE ${indexType} ${this.escapeIdentifier(index.name)} ON ${this.escapeIdentifier(tableName)} (${columns})`;
  }

  generateInsertOrReplace(tableName: string, columns: string[], placeholderCount: number): string {
    const columnList = columns.map((col) => this.escapeIdentifier(col)).join(', ');
    const placeholders = this.generatePlaceholders(placeholderCount);

    switch (this.dialect) {
      case DatabaseDialect.SQLITE:
        return `INSERT OR REPLACE INTO ${this.escapeIdentifier(tableName)} (${columnList}) VALUES (${placeholders})`;
      case DatabaseDialect.MYSQL:
        return `REPLACE INTO ${this.escapeIdentifier(tableName)} (${columnList}) VALUES (${placeholders})`;
      case DatabaseDialect.POSTGRESQL: {
        // For PostgreSQL, we'll need to handle this with ON CONFLICT
        const conflictColumn = columns[0]; // Assume first column is the unique key
        const updateSet = columns
          .slice(1)
          .map((col) => `${this.escapeIdentifier(col)} = EXCLUDED.${this.escapeIdentifier(col)}`)
          .join(', ');
        return `INSERT INTO ${this.escapeIdentifier(tableName)} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${this.escapeIdentifier(conflictColumn)}) DO UPDATE SET ${updateSet}`;
      }
      default:
        throw new Error(`Unsupported dialect for INSERT OR REPLACE: ${this.dialect}`);
    }
  }

  generatePlaceholders(count: number): string {
    return Array.from({ length: count }, (_, i) => this.formatPlaceholder(i + 1)).join(', ');
  }

  formatPlaceholder(index: number): string {
    switch (this.dialect) {
      case DatabaseDialect.SQLITE:
      case DatabaseDialect.MYSQL:
        return '?';
      case DatabaseDialect.POSTGRESQL:
        return `$${index}`;
      default:
        throw new Error(`Unsupported dialect: ${this.dialect}`);
    }
  }

  escapeIdentifier(identifier: string): string {
    switch (this.dialect) {
      case DatabaseDialect.SQLITE:
      case DatabaseDialect.POSTGRESQL:
        return `"${identifier}"`;
      case DatabaseDialect.MYSQL:
        return `\`${identifier}\``;
      default:
        return identifier;
    }
  }

  private formatColumn(column: ColumnDefinition): string {
    const parts = [this.escapeIdentifier(column.name)];

    // Handle database-specific types
    parts.push(this.mapDataType(column.type));

    if (column.primaryKey) parts.push('PRIMARY KEY');
    if (column.notNull) parts.push('NOT NULL');
    if (column.unique) parts.push('UNIQUE');
    if (column.defaultValue !== undefined) {
      if (
        typeof column.defaultValue === 'string' &&
        column.defaultValue.toUpperCase() === 'CURRENT_TIMESTAMP'
      ) {
        parts.push(`DEFAULT ${this.getCurrentTimestampFunction()}`);
      } else if (typeof column.defaultValue === 'string') {
        parts.push(`DEFAULT '${column.defaultValue}'`);
      } else {
        parts.push(`DEFAULT ${column.defaultValue}`);
      }
    }

    return parts.join(' ');
  }

  private mapDataType(type: string): string {
    switch (this.dialect) {
      case DatabaseDialect.SQLITE:
        return this.mapToSQLiteType(type);
      case DatabaseDialect.MYSQL:
        return this.mapToMySQLType(type);
      case DatabaseDialect.POSTGRESQL:
        return this.mapToPostgreSQLType(type);
      default:
        return type;
    }
  }

  private mapToSQLiteType(type: string): string {
    const typeMap: Record<string, string> = {
      SERIAL: 'INTEGER',
      'VARCHAR(255)': 'TEXT',
      'VARCHAR(64)': 'TEXT',
      'VARCHAR(10)': 'TEXT',
      TEXT: 'TEXT',
      INTEGER: 'INTEGER',
      BOOLEAN: 'INTEGER',
      TIMESTAMP: 'DATETIME',
      JSON: 'TEXT',
    };
    return typeMap[type] || type;
  }

  private mapToMySQLType(type: string): string {
    const typeMap: Record<string, string> = {
      SERIAL: 'INT AUTO_INCREMENT',
      'VARCHAR(255)': 'VARCHAR(255)',
      'VARCHAR(64)': 'VARCHAR(64)',
      'VARCHAR(10)': 'VARCHAR(10)',
      TEXT: 'TEXT',
      INTEGER: 'INT',
      BOOLEAN: 'BOOLEAN',
      TIMESTAMP: 'TIMESTAMP',
      JSON: 'JSON',
    };
    return typeMap[type] || type;
  }

  private mapToPostgreSQLType(type: string): string {
    const typeMap: Record<string, string> = {
      SERIAL: 'SERIAL',
      'VARCHAR(255)': 'VARCHAR(255)',
      'VARCHAR(64)': 'VARCHAR(64)',
      'VARCHAR(10)': 'VARCHAR(10)',
      TEXT: 'TEXT',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      TIMESTAMP: 'TIMESTAMP WITH TIME ZONE',
      JSON: 'JSONB',
    };
    return typeMap[type] || type;
  }

  private getCurrentTimestampFunction(): string {
    switch (this.dialect) {
      case DatabaseDialect.SQLITE:
        return 'CURRENT_TIMESTAMP';
      case DatabaseDialect.MYSQL:
        return 'CURRENT_TIMESTAMP';
      case DatabaseDialect.POSTGRESQL:
        return 'CURRENT_TIMESTAMP';
      default:
        return 'CURRENT_TIMESTAMP';
    }
  }

  private generateConstraints(columns: ColumnDefinition[]): string {
    // For now, we handle constraints via column definitions
    // This could be extended for more complex constraints
    return '';
  }
}
