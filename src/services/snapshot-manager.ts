import crypto from 'crypto';
import {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseFactory,
  SQLGenerator,
  SNAPSHOTS_SCHEMA,
} from '../database/index.js';

export interface SnapshotMetadata {
  id?: number;
  cache_key: string;
  url: string;
  method: string;
  status_code: number;
  created_at: string;
  expires_at: string;
  manual_snapshot: boolean;
  backend_host: string;
  payload_hash?: string;
  headers_hash?: string;
  request_body?: string;
  response_size?: number;
  content_type?: string;
  tags?: string; // JSON array of tags
  description?: string;
  last_accessed_at?: string;
  access_count?: number;
}

export interface SnapshotFilters {
  method?: string;
  url?: string;
  backend_host?: string;
  manual?: boolean;
  expires_before?: string;
  expires_after?: string;
  created_before?: string;
  created_after?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SnapshotStats {
  totalSnapshots: number;
  manualSnapshots: number;
  expiredSnapshots: number;
  avgTTL: number;
  snapshotsByBackend: Record<string, number>;
  snapshotsByMethod: Record<string, number>;
  snapshotsByStatus: Record<string, number>;
  totalSize: number;
  topUrls: Array<{
    url: string;
    count: number;
    total_size: number;
  }>;
}

type DbRow = Record<string, any>;

export class SnapshotManager {
  private db: DatabaseAdapter | null = null;
  private sqlGenerator: SQLGenerator | null = null;
  private enabled: boolean = false;

  constructor(
    enabled: boolean = true,
    private dbConfig?: DatabaseConfig,
    private legacyDbPath?: string // For backwards compatibility
  ) {
    this.enabled = enabled;
  }

  /**
   * Initialize the snapshot metadata database
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      // Use new database configuration if available, otherwise fall back to legacy path
      let config = this.dbConfig;
      if (!config && this.legacyDbPath) {
        config = {
          type: 'sqlite' as any,
          path: this.legacyDbPath,
        };
      }

      if (!config) {
        throw new Error('Database configuration is required');
      }

      // Create database adapter
      this.db = await DatabaseFactory.create(config);
      await this.db.initialize();

      this.sqlGenerator = new SQLGenerator(this.db.getDialect());

      // Create tables if they don't exist
      await this.ensureTables();

      console.log(`Snapshot manager initialized with ${config.type} database`);
    } catch (error) {
      console.error('Failed to initialize snapshot manager:', error);
      this.enabled = false;
    }
  }

  private async ensureTables(): Promise<void> {
    if (!this.db) return;

    if (!(await this.db.tableExists('snapshots'))) {
      await this.db.createTable('snapshots', SNAPSHOTS_SCHEMA);
      console.log('Created snapshots table with indexes');
    }
  }

  /**
   * Record snapshot metadata when cache entry is created
   */
  async recordSnapshot(
    cacheKey: string,
    url: string,
    method: string,
    statusCode: number,
    ttlSeconds: number,
    backendHost: string,
    responseData?: unknown,
    responseHeaders?: Record<string, string>,
    requestBody?: unknown,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled || !this.db || !this.sqlGenerator) return;

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

      // Generate payload hash for change detection
      const payloadHash = responseData
        ? crypto.createHash('sha256').update(JSON.stringify(responseData)).digest('hex')
        : null;

      // Generate headers hash
      const headersHash = responseHeaders
        ? crypto.createHash('sha256').update(JSON.stringify(responseHeaders)).digest('hex')
        : null;

      // Calculate response size
      const responseSize = responseData
        ? Buffer.byteLength(JSON.stringify(responseData), 'utf8')
        : null;

      // Extract content type
      const contentType = responseHeaders?.['content-type'] || null;

      const sql = this.sqlGenerator.generateInsertOrReplace(
        'snapshots',
        [
          'cache_key',
          'url',
          'method',
          'status_code',
          'created_at',
          'expires_at',
          'manual_snapshot',
          'backend_host',
          'payload_hash',
          'headers_hash',
          'request_body',
          'response_size',
          'content_type',
          'tags',
          'access_count',
        ],
        15
      );

      await this.db.execute(sql, [
        cacheKey,
        url,
        method,
        statusCode,
        now.toISOString(),
        expiresAt.toISOString(),
        false, // Not manual by default
        backendHost,
        payloadHash,
        headersHash,
        requestBody ? JSON.stringify(requestBody) : null,
        responseSize,
        contentType,
        tags ? JSON.stringify(tags) : null,
        0, // Initial access count
      ]);
    } catch (error) {
      console.error('Failed to record snapshot metadata:', error);
      // Don't throw - metadata recording should not break cache operations
    }
  }

  /**
   * Update access statistics for a snapshot
   */
  async updateAccess(cacheKey: string): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      const sql = `
        UPDATE ${this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots'} 
        SET access_count = access_count + 1, last_accessed_at = ${this.db.formatPlaceholder(1)}
        WHERE cache_key = ${this.db.formatPlaceholder(2)}
      `;

      await this.db.execute(sql, [new Date().toISOString(), cacheKey]);
    } catch (error) {
      console.error('Failed to update snapshot access:', error);
    }
  }

  /**
   * Get all snapshots with optional filtering
   */
  async getSnapshots(filters: SnapshotFilters = {}): Promise<SnapshotMetadata[]> {
    if (!this.enabled || !this.db) return [];

    try {
      let query = `SELECT * FROM ${this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots'} WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.method) {
        query += ` AND method = ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.method.toUpperCase());
      }

      if (filters.url) {
        query += ` AND url LIKE ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(`%${filters.url}%`);
      }

      if (filters.backend_host) {
        query += ` AND backend_host = ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.backend_host);
      }

      if (filters.manual !== undefined) {
        query += ` AND manual_snapshot = ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.manual);
      }

      if (filters.expires_before) {
        query += ` AND expires_at < ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.expires_before);
      }

      if (filters.expires_after) {
        query += ` AND expires_at > ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.expires_after);
      }

      if (filters.created_before) {
        query += ` AND created_at < ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.created_before);
      }

      if (filters.created_after) {
        query += ` AND created_at > ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.created_after);
      }

      if (filters.tags && filters.tags.length > 0) {
        // Check if any of the specified tags exist in the tags JSON array
        const tagConditions = filters.tags
          .map(() => `tags LIKE ${this.db!.formatPlaceholder(paramIndex++)}`)
          .join(' OR ');
        query += ` AND (${tagConditions})`;
        filters.tags.forEach((tag) => params.push(`%"${tag}"%`));
      }

      // Order by created_at DESC for most recent first
      query += ' ORDER BY created_at DESC';

      // Apply pagination
      if (filters.limit) {
        query += ` LIMIT ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ` OFFSET ${this.db.formatPlaceholder(paramIndex++)}`;
        params.push(filters.offset);
      }

      const rows = await this.db.query<DbRow>(query, params);
      return rows.map((row) => this.mapRowToSnapshot(row));
    } catch (error) {
      console.error('Failed to get snapshots:', error);
      return [];
    }
  }

  /**
   * Get snapshot by cache key
   */
  async getSnapshotByCacheKey(cacheKey: string): Promise<SnapshotMetadata | null> {
    if (!this.enabled || !this.db) return null;

    try {
      const query = `SELECT * FROM ${this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots'} WHERE cache_key = ${this.db.formatPlaceholder(1)}`;
      const rows = await this.db.query<DbRow>(query, [cacheKey]);
      return rows.length > 0 ? this.mapRowToSnapshot(rows[0]) : null;
    } catch (error) {
      console.error('Failed to get snapshot by cache key:', error);
      return null;
    }
  }

  /**
   * Update snapshot metadata
   */
  async updateSnapshot(
    cacheKey: string,
    updates: Partial<
      Pick<SnapshotMetadata, 'expires_at' | 'manual_snapshot' | 'tags' | 'description'>
    >
  ): Promise<boolean> {
    if (!this.enabled || !this.db) return false;

    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.expires_at) {
        updateFields.push(`expires_at = ${this.db.formatPlaceholder(paramIndex++)}`);
        params.push(updates.expires_at);
      }

      if (updates.manual_snapshot !== undefined) {
        updateFields.push(`manual_snapshot = ${this.db.formatPlaceholder(paramIndex++)}`);
        params.push(updates.manual_snapshot);
      }

      if (updates.tags !== undefined) {
        updateFields.push(`tags = ${this.db.formatPlaceholder(paramIndex++)}`);
        params.push(typeof updates.tags === 'string' ? updates.tags : JSON.stringify(updates.tags));
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = ${this.db.formatPlaceholder(paramIndex++)}`);
        params.push(updates.description);
      }

      if (updateFields.length === 0) {
        return false;
      }

      params.push(cacheKey);

      const query = `
        UPDATE ${this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots'} 
        SET ${updateFields.join(', ')}
        WHERE cache_key = ${this.db.formatPlaceholder(paramIndex)}
      `;

      const result = await this.db.execute(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Failed to update snapshot:', error);
      return false;
    }
  }

  /**
   * Delete snapshot metadata
   */
  async deleteSnapshot(cacheKey: string): Promise<boolean> {
    if (!this.enabled || !this.db) return false;

    try {
      const query = `DELETE FROM ${this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots'} WHERE cache_key = ${this.db.formatPlaceholder(1)}`;
      const result = await this.db.execute(query, [cacheKey]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      return false;
    }
  }

  /**
   * Get snapshot statistics
   */
  async getStats(): Promise<SnapshotStats> {
    if (!this.enabled || !this.db) {
      return {
        totalSnapshots: 0,
        manualSnapshots: 0,
        expiredSnapshots: 0,
        avgTTL: 0,
        snapshotsByBackend: {},
        snapshotsByMethod: {},
        snapshotsByStatus: {},
        totalSize: 0,
        topUrls: [],
      };
    }

    try {
      const tableName = this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots';
      const currentTimestamp =
        this.db.getDialect() === 'sqlite' ? "datetime('now')" : 'CURRENT_TIMESTAMP';

      // Basic counts
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total_snapshots,
          SUM(CASE WHEN manual_snapshot = ${this.db.getDialect() === 'sqlite' ? '1' : 'true'} THEN 1 ELSE 0 END) as manual_snapshots,
          SUM(CASE WHEN expires_at < ${currentTimestamp} THEN 1 ELSE 0 END) as expired_snapshots,
          AVG(CASE WHEN expires_at > created_at THEN 
            CASE 
              WHEN ${this.db.getDialect() === 'sqlite' ? `(julianday(expires_at) - julianday(created_at)) * 86400` : `EXTRACT(EPOCH FROM (expires_at - created_at))`}
              ELSE 0 
            END
            ELSE 0 
          END) as avg_ttl,
          COALESCE(SUM(response_size), 0) as total_size
        FROM ${tableName}
      `;

      const [basicStats] = await this.db.query(basicStatsQuery);

      // Snapshots by backend
      const backendStats = await this.db.query(`
        SELECT backend_host, COUNT(*) as count
        FROM ${tableName}
        GROUP BY backend_host
        ORDER BY count DESC
      `);

      // Snapshots by method
      const methodStats = await this.db.query(`
        SELECT method, COUNT(*) as count
        FROM ${tableName}
        GROUP BY method
        ORDER BY count DESC
      `);

      // Snapshots by status
      const statusStats = await this.db.query(`
        SELECT status_code, COUNT(*) as count
        FROM ${tableName}
        GROUP BY status_code
        ORDER BY count DESC
      `);

      // Top URLs
      const topUrls = await this.db.query(`
        SELECT url, COUNT(*) as count, COALESCE(SUM(response_size), 0) as total_size
        FROM ${tableName}
        GROUP BY url
        ORDER BY count DESC
        LIMIT 10
      `);

      return {
        totalSnapshots: basicStats?.total_snapshots || 0,
        manualSnapshots: basicStats?.manual_snapshots || 0,
        expiredSnapshots: basicStats?.expired_snapshots || 0,
        avgTTL: Math.round(basicStats?.avg_ttl || 0),
        snapshotsByBackend: this.arrayToObject(backendStats, 'backend_host', 'count'),
        snapshotsByMethod: this.arrayToObject(methodStats, 'method', 'count'),
        snapshotsByStatus: this.arrayToObject(statusStats, 'status_code', 'count'),
        totalSize: basicStats?.total_size || 0,
        topUrls: topUrls || [],
      };
    } catch (error) {
      console.error('Failed to get snapshot stats:', error);
      return {
        totalSnapshots: 0,
        manualSnapshots: 0,
        expiredSnapshots: 0,
        avgTTL: 0,
        snapshotsByBackend: {},
        snapshotsByMethod: {},
        snapshotsByStatus: {},
        totalSize: 0,
        topUrls: [],
      };
    }
  }

  /**
   * Clean up expired snapshots
   */
  async cleanExpired(): Promise<number> {
    if (!this.enabled || !this.db) return 0;

    try {
      const tableName = this.db.getDialect() === 'postgresql' ? '"snapshots"' : 'snapshots';
      const currentTimestamp =
        this.db.getDialect() === 'sqlite' ? "datetime('now')" : 'CURRENT_TIMESTAMP';
      const manualSnapshotCondition =
        this.db.getDialect() === 'sqlite' ? 'manual_snapshot = 0' : 'manual_snapshot = false';

      const query = `
        DELETE FROM ${tableName} 
        WHERE expires_at < ${currentTimestamp} AND ${manualSnapshotCondition}
      `;

      const result = await this.db.execute(query);
      return result.affectedRows || 0;
    } catch (error) {
      console.error('Failed to clean expired snapshots:', error);
      return 0;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Convert database row to snapshot metadata
   */
  private mapRowToSnapshot(row: DbRow): SnapshotMetadata {
    return {
      id: row.id,
      cache_key: row.cache_key,
      url: row.url,
      method: row.method,
      status_code: row.status_code,
      created_at: row.created_at,
      expires_at: row.expires_at,
      manual_snapshot: !!row.manual_snapshot,
      backend_host: row.backend_host,
      payload_hash: row.payload_hash,
      headers_hash: row.headers_hash,
      request_body: row.request_body,
      response_size: row.response_size,
      content_type: row.content_type,
      tags: row.tags,
      description: row.description,
      last_accessed_at: row.last_accessed_at,
      access_count: row.access_count || 0,
    };
  }

  /**
   * Convert array to object for stats
   */
  private arrayToObject(arr: any[], keyField: string, valueField: string): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of arr) {
      result[item[keyField]] = item[valueField];
    }
    return result;
  }
}
