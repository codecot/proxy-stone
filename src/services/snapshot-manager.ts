import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

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
  topUrls: Array<{ url: string; count: number; totalSize: number }>;
}

interface DbRow {
  id: number;
  cache_key: string;
  url: string;
  method: string;
  status_code: number;
  created_at: string;
  expires_at: string;
  manual_snapshot: number;
  backend_host: string;
  payload_hash: string | null;
  headers_hash: string | null;
  request_body: string | null;
  response_size: number | null;
  content_type: string | null;
  tags: string | null;
  description: string | null;
  last_accessed_at: string | null;
  access_count: number | null;
}

export class SnapshotManager {
  private db: sqlite3.Database | null = null;
  private enabled: boolean = false;
  private dbPath: string;

  constructor(enabled: boolean = true, dbPath: string = './logs/snapshots.db') {
    this.enabled = enabled;
    this.dbPath = dbPath;
  }

  /**
   * Initialize the snapshot metadata database
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Create database connection
      this.db = new sqlite3.Database(this.dbPath);

      // Promisify database methods
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

      // Create snapshots metadata table
      await run(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          url TEXT NOT NULL,
          method TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          manual_snapshot BOOLEAN DEFAULT FALSE,
          backend_host TEXT NOT NULL,
          payload_hash TEXT,
          headers_hash TEXT,
          request_body TEXT,
          response_size INTEGER,
          content_type TEXT,
          tags TEXT, -- JSON array of tags
          description TEXT,
          last_accessed_at DATETIME,
          access_count INTEGER DEFAULT 0
        )
      `);

      // Create indexes for better query performance
      await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_cache_key ON snapshots(cache_key)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_url ON snapshots(url)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_method ON snapshots(method)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_backend ON snapshots(backend_host)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_expires ON snapshots(expires_at)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_snapshots_manual ON snapshots(manual_snapshot)`);

      console.log('Snapshot metadata database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize snapshot metadata database:', error);
      throw error;
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
    if (!this.enabled || !this.db) return;

    try {
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

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

      await run(
        `
        INSERT OR REPLACE INTO snapshots (
          cache_key, url, method, status_code, created_at, expires_at,
          manual_snapshot, backend_host, payload_hash, headers_hash,
          request_body, response_size, content_type, tags, access_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
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
        ]
      );
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
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

      await run(
        `
        UPDATE snapshots 
        SET access_count = access_count + 1, last_accessed_at = ?
        WHERE cache_key = ?
      `,
        [new Date().toISOString(), cacheKey]
      );
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
      const get = promisify(this.db.all.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<DbRow[]>;

      let query = 'SELECT * FROM snapshots WHERE 1=1';
      const params: any[] = [];

      // Apply filters
      if (filters.method) {
        query += ' AND method = ?';
        params.push(filters.method.toUpperCase());
      }

      if (filters.url) {
        query += ' AND url LIKE ?';
        params.push(`%${filters.url}%`);
      }

      if (filters.backend_host) {
        query += ' AND backend_host = ?';
        params.push(filters.backend_host);
      }

      if (filters.manual !== undefined) {
        query += ' AND manual_snapshot = ?';
        params.push(filters.manual ? 1 : 0);
      }

      if (filters.expires_before) {
        query += ' AND expires_at < ?';
        params.push(filters.expires_before);
      }

      if (filters.expires_after) {
        query += ' AND expires_at > ?';
        params.push(filters.expires_after);
      }

      if (filters.created_before) {
        query += ' AND created_at < ?';
        params.push(filters.created_before);
      }

      if (filters.created_after) {
        query += ' AND created_at > ?';
        params.push(filters.created_after);
      }

      if (filters.tags && filters.tags.length > 0) {
        // Check if any of the specified tags exist in the tags JSON array
        const tagConditions = filters.tags.map(() => 'tags LIKE ?').join(' OR ');
        query += ` AND (${tagConditions})`;
        filters.tags.forEach((tag) => params.push(`%"${tag}"%`));
      }

      // Order by created_at DESC for most recent first
      query += ' ORDER BY created_at DESC';

      // Apply pagination
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const rows = await get(query, params);
      return rows.map(this.mapRowToSnapshot);
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
      const get = promisify(this.db.get.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<DbRow>;

      const row = await get('SELECT * FROM snapshots WHERE cache_key = ?', [cacheKey]);
      return row ? this.mapRowToSnapshot(row) : null;
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
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

      const updateFields: string[] = [];
      const params: any[] = [];

      if (updates.expires_at) {
        updateFields.push('expires_at = ?');
        params.push(updates.expires_at);
      }

      if (updates.manual_snapshot !== undefined) {
        updateFields.push('manual_snapshot = ?');
        params.push(updates.manual_snapshot ? 1 : 0);
      }

      if (updates.tags !== undefined) {
        updateFields.push('tags = ?');
        params.push(typeof updates.tags === 'string' ? updates.tags : JSON.stringify(updates.tags));
      }

      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        params.push(updates.description);
      }

      if (updateFields.length === 0) {
        return false;
      }

      params.push(cacheKey);

      const result = await run(
        `
        UPDATE snapshots 
        SET ${updateFields.join(', ')}
        WHERE cache_key = ?
      `,
        params
      );

      return result.changes !== undefined && result.changes > 0;
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
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

      const result = await run('DELETE FROM snapshots WHERE cache_key = ?', [cacheKey]);
      return result.changes !== undefined && result.changes > 0;
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
      const get = promisify(this.db.get.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<any>;

      const getAll = promisify(this.db.all.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<any[]>;

      // Basic counts
      const basicStats = await get(`
        SELECT 
          COUNT(*) as total_snapshots,
          SUM(CASE WHEN manual_snapshot = 1 THEN 1 ELSE 0 END) as manual_snapshots,
          SUM(CASE WHEN expires_at < datetime('now') THEN 1 ELSE 0 END) as expired_snapshots,
          AVG(CAST((julianday(expires_at) - julianday(created_at)) * 86400 AS INTEGER)) as avg_ttl,
          COALESCE(SUM(response_size), 0) as total_size
        FROM snapshots
      `);

      // Snapshots by backend
      const backendStats = await getAll(`
        SELECT backend_host, COUNT(*) as count
        FROM snapshots
        GROUP BY backend_host
        ORDER BY count DESC
      `);

      // Snapshots by method
      const methodStats = await getAll(`
        SELECT method, COUNT(*) as count
        FROM snapshots
        GROUP BY method
        ORDER BY count DESC
      `);

      // Snapshots by status
      const statusStats = await getAll(`
        SELECT status_code, COUNT(*) as count
        FROM snapshots
        GROUP BY status_code
        ORDER BY count DESC
      `);

      // Top URLs
      const topUrls = await getAll(`
        SELECT url, COUNT(*) as count, COALESCE(SUM(response_size), 0) as total_size
        FROM snapshots
        GROUP BY url
        ORDER BY count DESC
        LIMIT 10
      `);

      return {
        totalSnapshots: basicStats.total_snapshots || 0,
        manualSnapshots: basicStats.manual_snapshots || 0,
        expiredSnapshots: basicStats.expired_snapshots || 0,
        avgTTL: Math.round(basicStats.avg_ttl || 0),
        totalSize: basicStats.total_size || 0,
        snapshotsByBackend: backendStats.reduce((acc: any, row: any) => {
          acc[row.backend_host] = row.count;
          return acc;
        }, {}),
        snapshotsByMethod: methodStats.reduce((acc: any, row: any) => {
          acc[row.method] = row.count;
          return acc;
        }, {}),
        snapshotsByStatus: statusStats.reduce((acc: any, row: any) => {
          acc[row.status_code] = row.count;
          return acc;
        }, {}),
        topUrls: topUrls.map((row: any) => ({
          url: row.url,
          count: row.count,
          totalSize: row.total_size,
        })),
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
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

      const result = await run(`
        DELETE FROM snapshots 
        WHERE expires_at < datetime('now') AND manual_snapshot = 0
      `);

      return result.changes || 0;
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
      const close = promisify(this.db.close.bind(this.db)) as () => Promise<void>;
      await close();
      this.db = null;
    }
  }

  /**
   * Map database row to SnapshotMetadata
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
      manual_snapshot: Boolean(row.manual_snapshot),
      backend_host: row.backend_host,
      payload_hash: row.payload_hash || undefined,
      headers_hash: row.headers_hash || undefined,
      request_body: row.request_body || undefined,
      response_size: row.response_size || undefined,
      content_type: row.content_type || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      description: row.description || undefined,
      last_accessed_at: row.last_accessed_at || undefined,
      access_count: row.access_count || undefined,
    };
  }
}
