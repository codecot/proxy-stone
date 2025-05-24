import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';

export interface LoggedRequest {
  id?: number;
  timestamp: string;
  method: string;
  originalUrl: string;
  targetUrl: string;
  statusCode: number;
  responseTime: number;
  requestHeaders: string; // JSON string
  responseHeaders: string; // JSON string
  requestBody?: string; // JSON string
  responseBody?: string; // JSON string (truncated if too large)
  cacheHit: boolean;
  cacheKey?: string; // Cache key for linking to cache files
  userAgent?: string;
  clientIp?: string;
  errorMessage?: string;
}

export interface RequestFilters {
  method?: string;
  statusCode?: number;
  dateFrom?: string;
  dateTo?: string;
  url?: string;
  cacheHit?: boolean;
  cacheKey?: string;
  limit?: number;
  offset?: number;
}

export interface RequestStats {
  totalRequests: number;
  cacheHitRate: number;
  avgResponseTime: number;
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  topUrls: Array<{ url: string; count: number }>;
  topCacheKeys: Array<{ cacheKey: string; count: number }>;
}

interface DbRow {
  id: number;
  timestamp: string;
  method: string;
  original_url: string;
  target_url: string;
  status_code: number;
  response_time: number;
  request_headers: string | null;
  response_headers: string | null;
  request_body: string | null;
  response_body: string | null;
  cache_hit: number;
  cache_key: string | null;
  user_agent: string | null;
  client_ip: string | null;
  error_message: string | null;
  created_at: string;
}

interface StatsRow {
  total: number;
  cache_hit_rate: number;
  avg_response_time: number;
}

interface CountRow {
  method?: string;
  status_code?: number;
  url?: string;
  cache_key?: string;
  count: number;
}

export class RequestLoggerService {
  private db: sqlite3.Database | null = null;
  private enabled: boolean = false;
  private dbPath: string;
  private maxBodySize: number = 10000; // Max body size to store (10KB)

  constructor(enabled: boolean = false, dbPath: string = './logs/requests.db') {
    this.enabled = enabled;
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database and create tables
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

      // Create requests table
      await run(`
        CREATE TABLE IF NOT EXISTS requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          method TEXT NOT NULL,
          original_url TEXT NOT NULL,
          target_url TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_time REAL NOT NULL,
          request_headers TEXT,
          response_headers TEXT,
          request_body TEXT,
          response_body TEXT,
          cache_hit BOOLEAN DEFAULT FALSE,
          cache_key TEXT,
          user_agent TEXT,
          client_ip TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add cache_key column if it doesn't exist (migration)
      try {
        await run('ALTER TABLE requests ADD COLUMN cache_key TEXT');
      } catch (error) {
        // Column already exists, ignore error
      }

      // Create indexes for better query performance
      await run('CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp)');
      await run('CREATE INDEX IF NOT EXISTS idx_method ON requests(method)');
      await run('CREATE INDEX IF NOT EXISTS idx_status_code ON requests(status_code)');
      await run('CREATE INDEX IF NOT EXISTS idx_target_url ON requests(target_url)');
      await run('CREATE INDEX IF NOT EXISTS idx_cache_key ON requests(cache_key)');
      await run('CREATE INDEX IF NOT EXISTS idx_cache_hit ON requests(cache_hit)');

      console.log('Request logger database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize request logger database:', error);
      this.enabled = false;
    }
  }

  /**
   * Log a request/response
   */
  async logRequest(data: {
    method: string;
    originalUrl: string;
    targetUrl: string;
    statusCode: number;
    responseTime: number;
    requestHeaders: Record<string, any>;
    responseHeaders: Record<string, any>;
    requestBody?: any;
    responseBody?: any;
    cacheHit: boolean;
    cacheKey?: string;
    userAgent?: string;
    clientIp?: string;
    errorMessage?: string;
  }): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;

      // Truncate large bodies
      const requestBodyStr = this.truncateBody(data.requestBody);
      const responseBodyStr = this.truncateBody(data.responseBody);

      await run(
        `
        INSERT INTO requests (
          method, original_url, target_url, status_code, response_time,
          request_headers, response_headers, request_body, response_body,
          cache_hit, cache_key, user_agent, client_ip, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          data.method,
          data.originalUrl,
          data.targetUrl,
          data.statusCode,
          data.responseTime,
          JSON.stringify(data.requestHeaders),
          JSON.stringify(data.responseHeaders),
          requestBodyStr,
          responseBodyStr,
          data.cacheHit ? 1 : 0,
          data.cacheKey,
          data.userAgent,
          data.clientIp,
          data.errorMessage,
        ]
      );
    } catch (error) {
      console.error('Failed to log request:', error);
    }
  }

  /**
   * Get requests with optional filtering
   */
  async getRequests(filters: RequestFilters = {}): Promise<LoggedRequest[]> {
    if (!this.enabled || !this.db) return [];

    try {
      const all = promisify(this.db.all.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<DbRow[]>;

      let query = 'SELECT * FROM requests WHERE 1=1';
      const params: any[] = [];

      // Add filters
      if (filters.method) {
        query += ' AND method = ?';
        params.push(filters.method);
      }

      if (filters.statusCode) {
        query += ' AND status_code = ?';
        params.push(filters.statusCode);
      }

      if (filters.dateFrom) {
        query += ' AND timestamp >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        query += ' AND timestamp <= ?';
        params.push(filters.dateTo);
      }

      if (filters.url) {
        query += ' AND (original_url LIKE ? OR target_url LIKE ?)';
        params.push(`%${filters.url}%`, `%${filters.url}%`);
      }

      if (filters.cacheHit !== undefined) {
        query += ' AND cache_hit = ?';
        params.push(filters.cacheHit ? 1 : 0);
      }

      if (filters.cacheKey) {
        query += ' AND cache_key = ?';
        params.push(filters.cacheKey);
      }

      // Order by newest first
      query += ' ORDER BY timestamp DESC';

      // Add pagination
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const rows = await all(query, params);

      return rows.map(this.mapRowToRequest);
    } catch (error) {
      console.error('Failed to get requests:', error);
      return [];
    }
  }

  /**
   * Get request statistics
   */
  async getStats(): Promise<RequestStats> {
    if (!this.enabled || !this.db) {
      return {
        totalRequests: 0,
        cacheHitRate: 0,
        avgResponseTime: 0,
        requestsByMethod: {},
        requestsByStatus: {},
        topUrls: [],
        topCacheKeys: [],
      };
    }

    try {
      const get = promisify(this.db.get.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<StatsRow>;
      const all = promisify(this.db.all.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<CountRow[]>;

      // Total requests and cache hit rate
      const totalStats = await get(`
        SELECT 
          COUNT(*) as total,
          AVG(CASE WHEN cache_hit = 1 THEN 1.0 ELSE 0.0 END) * 100 as cache_hit_rate,
          AVG(response_time) as avg_response_time
        FROM requests
      `);

      // Requests by method
      const methodStats = await all(`
        SELECT method, COUNT(*) as count 
        FROM requests 
        GROUP BY method 
        ORDER BY count DESC
      `);

      // Requests by status code
      const statusStats = await all(`
        SELECT status_code, COUNT(*) as count 
        FROM requests 
        GROUP BY status_code 
        ORDER BY count DESC
      `);

      // Top URLs
      const urlStats = await all(`
        SELECT target_url as url, COUNT(*) as count 
        FROM requests 
        GROUP BY target_url 
        ORDER BY count DESC 
        LIMIT 10
      `);

      // Top cache keys (most frequently used)
      const cacheKeyStats = await all(`
        SELECT cache_key, COUNT(*) as count 
        FROM requests 
        WHERE cache_key IS NOT NULL
        GROUP BY cache_key 
        ORDER BY count DESC 
        LIMIT 10
      `);

      return {
        totalRequests: totalStats?.total || 0,
        cacheHitRate: Math.round((totalStats?.cache_hit_rate || 0) * 100) / 100,
        avgResponseTime: Math.round((totalStats?.avg_response_time || 0) * 100) / 100,
        requestsByMethod: methodStats.reduce((acc: Record<string, number>, row: CountRow) => {
          if (row.method) {
            acc[row.method] = row.count;
          }
          return acc;
        }, {}),
        requestsByStatus: statusStats.reduce((acc: Record<string, number>, row: CountRow) => {
          if (row.status_code) {
            acc[row.status_code] = row.count;
          }
          return acc;
        }, {}),
        topUrls: urlStats.map((row) => ({ url: row.url || '', count: row.count })),
        topCacheKeys: cacheKeyStats.map((row) => ({
          cacheKey: row.cache_key || '',
          count: row.count,
        })),
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalRequests: 0,
        cacheHitRate: 0,
        avgResponseTime: 0,
        requestsByMethod: {},
        requestsByStatus: {},
        topUrls: [],
        topCacheKeys: [],
      };
    }
  }

  /**
   * Find cache file for a given request ID
   */
  async getCacheFileForRequest(requestId: number): Promise<string | null> {
    if (!this.enabled || !this.db) return null;

    try {
      const get = promisify(this.db.get.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<DbRow>;

      const request = await get('SELECT cache_key FROM requests WHERE id = ?', [requestId]);
      return request?.cache_key || null;
    } catch (error) {
      console.error('Failed to get cache key for request:', error);
      return null;
    }
  }

  /**
   * Clear old requests (older than specified days)
   */
  async clearOldRequests(olderThanDays: number = 30): Promise<number> {
    if (!this.enabled || !this.db) return 0;

    try {
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await run('DELETE FROM requests WHERE timestamp < ?', [
        cutoffDate.toISOString(),
      ]);

      return result.changes || 0;
    } catch (error) {
      console.error('Failed to clear old requests:', error);
      return 0;
    }
  }

  /**
   * Clear all requests
   */
  async clearAllRequests(): Promise<number> {
    if (!this.enabled || !this.db) return 0;

    try {
      const run = promisify(this.db.run.bind(this.db)) as (
        sql: string,
        params?: any[]
      ) => Promise<sqlite3.RunResult>;
      const result = await run('DELETE FROM requests');
      return result.changes || 0;
    } catch (error) {
      console.error('Failed to clear all requests:', error);
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
   * Private helper to truncate large body content
   */
  private truncateBody(body: any): string | null {
    if (!body) return null;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    if (bodyStr.length > this.maxBodySize) {
      return bodyStr.substring(0, this.maxBodySize) + '... [TRUNCATED]';
    }

    return bodyStr;
  }

  /**
   * Private helper to map database row to LoggedRequest
   */
  private mapRowToRequest(row: DbRow): LoggedRequest {
    return {
      id: row.id,
      timestamp: row.timestamp,
      method: row.method,
      originalUrl: row.original_url,
      targetUrl: row.target_url,
      statusCode: row.status_code,
      responseTime: row.response_time,
      requestHeaders: row.request_headers || '{}',
      responseHeaders: row.response_headers || '{}',
      requestBody: row.request_body || undefined,
      responseBody: row.response_body || undefined,
      cacheHit: row.cache_hit === 1,
      cacheKey: row.cache_key || undefined,
      userAgent: row.user_agent || undefined,
      clientIp: row.client_ip || undefined,
      errorMessage: row.error_message || undefined,
    };
  }
}
