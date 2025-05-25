import type { FastifyInstance } from 'fastify';
import { DatabaseError } from '../types/errors.js';
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
  backendHost: string;
  backendPath: string;
  statusCode: number;
  responseTime: number;
  dnsTiming?: number;
  connectTiming?: number;
  ttfbTiming?: number;
  processingTime?: number;
  requestHeaders: string; // JSON string
  responseHeaders: string; // JSON string
  requestBody?: string; // JSON string
  responseBody?: string; // JSON string (truncated if too large)
  queryParams?: string; // JSON string of query parameters
  routeParams?: string; // JSON string of route parameters
  cacheHit: boolean;
  cacheKey?: string; // Cache key for linking to cache files
  cacheTTL?: number; // Cache TTL used
  userAgent?: string;
  clientIp?: string;
  errorMessage?: string;
  requestSize?: number; // Request body size in bytes
  responseSize?: number; // Response body size in bytes
  contentType?: string; // Request content type
  responseContentType?: string; // Response content type
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
  backend_host: string | null;
  backend_path: string | null;
  status_code: number;
  response_time: number;
  dns_timing: number | null;
  connect_timing: number | null;
  ttfb_timing: number | null;
  processing_time: number | null;
  request_headers: string | null;
  response_headers: string | null;
  request_body: string | null;
  response_body: string | null;
  query_params: string | null;
  route_params: string | null;
  cache_hit: number;
  cache_key: string | null;
  cache_ttl: number | null;
  user_agent: string | null;
  client_ip: string | null;
  error_message: string | null;
  request_size: number | null;
  response_size: number | null;
  content_type: string | null;
  response_content_type: string | null;
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
  private app: FastifyInstance;
  private enabled: boolean;
  private dbPath: string;
  private db: any;
  private maxBodySize: number = 10000; // Max body size to store (10KB)

  constructor(app: FastifyInstance, enabled: boolean, dbPath: string) {
    this.app = app;
    this.enabled = enabled;
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          const sqlite3 = await import('sqlite3');
          const { open } = await import('sqlite');

          this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database,
          });

          await this.db.exec(`
            CREATE TABLE IF NOT EXISTS requests (
              id TEXT PRIMARY KEY,
              method TEXT,
              url TEXT,
              headers TEXT,
              body TEXT,
              query TEXT,
              params TEXT,
              timestamp TEXT,
              duration INTEGER,
              status INTEGER,
              error TEXT
            )
          `);
        },
        'database',
        { operation: 'request-logger-initialization' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(
        error,
        {
          operation: 'request-logger.initialize',
          context: { dbPath: this.dbPath },
        },
        ['critical']
      );
      throw new DatabaseError(
        'Failed to initialize request logger database',
        'DATABASE_INIT_ERROR',
        500,
        { dbPath: this.dbPath }
      );
    }
  }

  async logRequest(request: any, duration: number, error?: Error): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          const { id, method, url, headers, body, query, params } = request;

          await this.db.run(
            `INSERT INTO requests (
              id, method, url, headers, body, query, params,
              timestamp, duration, status, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              method,
              url,
              JSON.stringify(headers),
              JSON.stringify(body),
              JSON.stringify(query),
              JSON.stringify(params),
              new Date().toISOString(),
              duration,
              error ? 500 : 200,
              error ? error.message : null,
            ]
          );
        },
        'database',
        { operation: 'request-logger.log' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'request-logger.log',
        context: { requestId: request.id },
      });
      // Don't throw - logging failures shouldn't affect the main request flow
    }
  }

  async getStats(): Promise<any> {
    if (!this.enabled || !this.db) {
      return { enabled: false };
    }

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const total = await this.db.get('SELECT COUNT(*) as count FROM requests');
          const errors = await this.db.get(
            'SELECT COUNT(*) as count FROM requests WHERE error IS NOT NULL'
          );
          const avgDuration = await this.db.get('SELECT AVG(duration) as avg FROM requests');

          return {
            enabled: true,
            total: total.count,
            errors: errors.count,
            avgDuration: Math.round(avgDuration.avg || 0),
            errorRate: total.count > 0 ? (errors.count / total.count) * 100 : 0,
          };
        },
        'database',
        { operation: 'request-logger.stats' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'request-logger.stats',
      });
      throw new DatabaseError('Failed to get request logger stats', 'DATABASE_QUERY_ERROR', 500);
    }
  }

  async clearOldRequests(days: number): Promise<number> {
    if (!this.enabled || !this.db) return 0;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);

          const result = await this.db.run('DELETE FROM requests WHERE timestamp < ?', [
            cutoff.toISOString(),
          ]);

          return result.changes;
        },
        'database',
        { operation: 'request-logger.clear-old' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'request-logger.clear-old',
        context: { days },
      });
      throw new DatabaseError('Failed to clear old request logs', 'DATABASE_CLEANUP_ERROR', 500, {
        days,
      });
    }
  }

  async close(): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          await this.db.close();
        },
        'database',
        { operation: 'request-logger.close' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'request-logger.close',
      });
      // Don't throw - cleanup failures shouldn't affect shutdown
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
      // Enhanced backend tracking
      backendHost: row.backend_host || '',
      backendPath: row.backend_path || '',
      statusCode: row.status_code,
      responseTime: row.response_time,
      // Enhanced performance metrics
      dnsTiming: row.dns_timing || undefined,
      connectTiming: row.connect_timing || undefined,
      ttfbTiming: row.ttfb_timing || undefined,
      processingTime: row.processing_time || undefined,
      requestHeaders: row.request_headers || '{}',
      responseHeaders: row.response_headers || '{}',
      requestBody: row.request_body || undefined,
      responseBody: row.response_body || undefined,
      // Enhanced parameter tracking
      queryParams: row.query_params || undefined,
      routeParams: row.route_params || undefined,
      cacheHit: row.cache_hit === 1,
      cacheKey: row.cache_key || undefined,
      cacheTTL: row.cache_ttl || undefined,
      userAgent: row.user_agent || undefined,
      clientIp: row.client_ip || undefined,
      errorMessage: row.error_message || undefined,
      // Enhanced request context
      requestSize: row.request_size || undefined,
      responseSize: row.response_size || undefined,
      contentType: row.content_type || undefined,
      responseContentType: row.response_content_type || undefined,
    };
  }
}
