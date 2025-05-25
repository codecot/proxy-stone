import crypto from 'crypto';
import {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseFactory,
  SQLGenerator,
  SNAPSHOTS_SCHEMA,
} from '../database/index.js';
import type { FastifyInstance } from 'fastify';
import { DatabaseError } from '../types/errors.js';

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
  private app: FastifyInstance;
  private enabled: boolean;
  private dbPath: string;
  private db: any;
  private sqlGenerator: SQLGenerator | null = null;

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
            CREATE TABLE IF NOT EXISTS snapshots (
              id TEXT PRIMARY KEY,
              url TEXT NOT NULL,
              data TEXT NOT NULL,
              headers TEXT NOT NULL,
              status INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              last_accessed TEXT,
              access_count INTEGER DEFAULT 0,
              tags TEXT
            )
          `);

          // Create indexes for better query performance
          await this.db.exec('CREATE INDEX IF NOT EXISTS idx_url ON snapshots(url)');
          await this.db.exec('CREATE INDEX IF NOT EXISTS idx_expires_at ON snapshots(expires_at)');
          await this.db.exec(
            'CREATE INDEX IF NOT EXISTS idx_last_accessed ON snapshots(last_accessed)'
          );
          await this.db.exec('CREATE INDEX IF NOT EXISTS idx_tags ON snapshots(tags)');
        },
        'database',
        { operation: 'snapshot-manager-initialization' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(
        error,
        {
          operation: 'snapshot-manager.initialize',
          context: { dbPath: this.dbPath },
        },
        ['critical']
      );
      throw new DatabaseError(
        'Failed to initialize snapshot manager database',
        'DATABASE_INIT_ERROR',
        500,
        { dbPath: this.dbPath }
      );
    }
  }

  async saveSnapshot(
    url: string,
    data: any,
    headers: Record<string, string>,
    status: number,
    ttl: number,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + ttl * 1000);

          await this.db.run(
            `INSERT INTO snapshots (
              id, url, data, headers, status, created_at, expires_at, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              url,
              JSON.stringify(data),
              JSON.stringify(headers),
              status,
              now.toISOString(),
              expiresAt.toISOString(),
              tags ? JSON.stringify(tags) : null,
            ]
          );
        },
        'database',
        { operation: 'snapshot-manager.save' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'snapshot-manager.save',
        context: { url, status },
      });
      throw new DatabaseError('Failed to save snapshot', 'DATABASE_SAVE_ERROR', 500, {
        url,
        status,
      });
    }
  }

  async getSnapshot(url: string): Promise<any> {
    if (!this.enabled || !this.db) return null;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const now = new Date().toISOString();

          const snapshot = await this.db.get(
            `SELECT * FROM snapshots 
             WHERE url = ? AND expires_at > ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [url, now]
          );

          if (snapshot) {
            // Update access stats
            await this.db.run(
              `UPDATE snapshots 
               SET last_accessed = ?, access_count = access_count + 1
               WHERE id = ?`,
              [now, snapshot.id]
            );

            return {
              data: JSON.parse(snapshot.data),
              headers: JSON.parse(snapshot.headers),
              status: snapshot.status,
              createdAt: snapshot.created_at,
              expiresAt: snapshot.expires_at,
              lastAccessed: snapshot.last_accessed,
              accessCount: snapshot.access_count,
              tags: snapshot.tags ? JSON.parse(snapshot.tags) : [],
            };
          }

          return null;
        },
        'database',
        { operation: 'snapshot-manager.get' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'snapshot-manager.get',
        context: { url },
      });
      throw new DatabaseError('Failed to get snapshot', 'DATABASE_QUERY_ERROR', 500, { url });
    }
  }

  async getStats(): Promise<any> {
    if (!this.enabled || !this.db) {
      return { enabled: false };
    }

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const total = await this.db.get('SELECT COUNT(*) as count FROM snapshots');
          const active = await this.db.get(
            'SELECT COUNT(*) as count FROM snapshots WHERE expires_at > datetime("now")'
          );
          const expired = await this.db.get(
            'SELECT COUNT(*) as count FROM snapshots WHERE expires_at <= datetime("now")'
          );
          const avgAccessCount = await this.db.get(
            'SELECT AVG(access_count) as avg FROM snapshots'
          );

          return {
            enabled: true,
            total: total.count,
            active: active.count,
            expired: expired.count,
            avgAccessCount: Math.round(avgAccessCount.avg || 0),
          };
        },
        'database',
        { operation: 'snapshot-manager.stats' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'snapshot-manager.stats',
      });
      throw new DatabaseError('Failed to get snapshot stats', 'DATABASE_QUERY_ERROR', 500);
    }
  }

  async cleanExpired(): Promise<number> {
    if (!this.enabled || !this.db) return 0;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const result = await this.db.run(
            'DELETE FROM snapshots WHERE expires_at <= datetime("now")'
          );
          return result.changes;
        },
        'database',
        { operation: 'snapshot-manager.clean-expired' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'snapshot-manager.clean-expired',
      });
      throw new DatabaseError('Failed to clean expired snapshots', 'DATABASE_CLEANUP_ERROR', 500);
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
        { operation: 'snapshot-manager.close' }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: 'snapshot-manager.close',
      });
      // Don't throw - cleanup failures shouldn't affect shutdown
    }
  }
}
