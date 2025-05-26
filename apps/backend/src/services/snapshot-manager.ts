import crypto from "crypto";
import {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseFactory,
  SQLGenerator,
  SNAPSHOTS_SCHEMA,
} from "../database/index.js";
import type { FastifyInstance } from "fastify";
import { DatabaseError } from "../types/errors.js";

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
  private dbConfig: DatabaseConfig;
  private db: DatabaseAdapter | null = null;
  private sqlGenerator: SQLGenerator | null = null;

  constructor(
    app: FastifyInstance,
    enabled: boolean,
    dbConfig: DatabaseConfig
  ) {
    this.app = app;
    this.enabled = enabled;
    this.dbConfig = dbConfig;
  }

  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          // Create database adapter
          this.db = await DatabaseFactory.create(this.dbConfig);
          await this.db.initialize();

          this.sqlGenerator = new SQLGenerator(this.db.getDialect());

          // Create tables if they don't exist
          await this.ensureTables();
        },
        "database",
        { operation: "snapshot-manager-initialization" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(
        error,
        {
          operation: "snapshot-manager.initialize",
          context: { dbConfig: this.dbConfig },
        },
        ["critical"]
      );
      throw new DatabaseError(
        "Failed to initialize snapshot manager database",
        "DATABASE_INIT_ERROR",
        500,
        { dbConfig: this.dbConfig }
      );
    }
  }

  private async ensureTables(): Promise<void> {
    if (!this.db || !this.sqlGenerator) return;

    if (!(await this.db.tableExists("snapshots"))) {
      const createSQL = this.sqlGenerator.generateCreateTable(
        "snapshots",
        SNAPSHOTS_SCHEMA
      );
      await this.db.execute(createSQL);

      // Create indexes
      for (const index of SNAPSHOTS_SCHEMA.indexes) {
        const indexSQL = this.sqlGenerator.generateCreateIndex(
          "snapshots",
          index
        );
        await this.db.execute(indexSQL);
      }
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
    if (!this.enabled || !this.db || !this.sqlGenerator) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + ttl * 1000);

          const columns = [
            "id",
            "url",
            "data",
            "headers",
            "status",
            "created_at",
            "expires_at",
            "tags",
          ];
          const values = [
            crypto.randomUUID(),
            url,
            JSON.stringify(data),
            JSON.stringify(headers),
            status,
            now.toISOString(),
            expiresAt.toISOString(),
            tags ? JSON.stringify(tags) : null,
          ];

          const sql = this.sqlGenerator!.generateInsertOrReplace(
            "snapshots",
            columns,
            values.length
          );
          await this.db!.execute(sql, values);
        },
        "database",
        { operation: "snapshot-manager.save" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "snapshot-manager.save",
        context: { url, status },
      });
      throw new DatabaseError(
        "Failed to save snapshot",
        "DATABASE_SAVE_ERROR",
        500,
        {
          url,
          status,
        }
      );
    }
  }

  async getSnapshot(url: string): Promise<any> {
    if (!this.enabled || !this.db || !this.sqlGenerator) return null;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const now = new Date().toISOString();

          const snapshots = await this.db!.query(
            `SELECT * FROM snapshots 
             WHERE url = ${this.sqlGenerator!.formatPlaceholder(1)} AND expires_at > ${this.sqlGenerator!.formatPlaceholder(2)}
             ORDER BY created_at DESC
             LIMIT 1`,
            [url, now]
          );

          if (snapshots.length > 0) {
            const snapshot = snapshots[0];

            // Update access stats
            await this.db!.execute(
              `UPDATE snapshots 
               SET last_accessed = ${this.sqlGenerator!.formatPlaceholder(1)}, access_count = access_count + 1
               WHERE id = ${this.sqlGenerator!.formatPlaceholder(2)}`,
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
        "database",
        { operation: "snapshot-manager.get" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "snapshot-manager.get",
        context: { url },
      });
      throw new DatabaseError(
        "Failed to get snapshot",
        "DATABASE_QUERY_ERROR",
        500,
        { url }
      );
    }
  }

  async getStats(): Promise<any> {
    if (!this.enabled || !this.db || !this.sqlGenerator) {
      return { enabled: false };
    }

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const totalResult = await this.db!.query(
            "SELECT COUNT(*) as count FROM snapshots"
          );
          const activeResult = await this.db!.query(
            "SELECT COUNT(*) as count FROM snapshots WHERE expires_at > CURRENT_TIMESTAMP"
          );
          const expiredResult = await this.db!.query(
            "SELECT COUNT(*) as count FROM snapshots WHERE expires_at <= CURRENT_TIMESTAMP"
          );
          const avgAccessCountResult = await this.db!.query(
            "SELECT AVG(access_count) as avg FROM snapshots"
          );

          return {
            enabled: true,
            total: totalResult[0]?.count || 0,
            active: activeResult[0]?.count || 0,
            expired: expiredResult[0]?.count || 0,
            avgAccessCount: Math.round(avgAccessCountResult[0]?.avg || 0),
          };
        },
        "database",
        { operation: "snapshot-manager.stats" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "snapshot-manager.stats",
      });
      throw new DatabaseError(
        "Failed to get snapshot stats",
        "DATABASE_QUERY_ERROR",
        500
      );
    }
  }

  async cleanExpired(): Promise<number> {
    if (!this.enabled || !this.db || !this.sqlGenerator) return 0;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const result = await this.db!.execute(
            "DELETE FROM snapshots WHERE expires_at <= CURRENT_TIMESTAMP"
          );
          return result.affectedRows;
        },
        "database",
        { operation: "snapshot-manager.clean-expired" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "snapshot-manager.clean-expired",
      });
      throw new DatabaseError(
        "Failed to clean expired snapshots",
        "DATABASE_CLEANUP_ERROR",
        500
      );
    }
  }

  async close(): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          await this.db!.close();
        },
        "database",
        { operation: "snapshot-manager.close" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "snapshot-manager.close",
      });
      // Don't throw - cleanup failures shouldn't affect shutdown
    }
  }
}
