import crypto from "crypto";
import { DatabaseAdapter, DatabaseDialect } from "../types.js";
import { SQLGenerator } from "../sql-generator.js";

export interface SnapshotRecord {
  id: string;
  url: string;
  data: string; // JSON string
  headers: string; // JSON string
  status: number;
  created_at: string;
  expires_at: string;
  tags?: string; // JSON string
  last_accessed?: string;
  access_count: number;
}

export interface SnapshotData {
  url: string;
  data: any;
  headers: Record<string, string>;
  status: number;
  ttl: number;
  tags?: string[];
}

export interface SnapshotStats {
  total: number;
  active: number;
  expired: number;
  avgAccessCount: number;
}

export class SnapshotRepository {
  private sqlGenerator: SQLGenerator;

  constructor(private db: DatabaseAdapter) {
    this.sqlGenerator = new SQLGenerator(db.getDialect());
  }

  async saveSnapshot(snapshotData: SnapshotData): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + snapshotData.ttl * 1000);

    const columns = [
      "id",
      "url",
      "data",
      "headers",
      "status",
      "created_at",
      "expires_at",
      "tags",
      "access_count",
    ];

    const values = [
      crypto.randomUUID(),
      snapshotData.url,
      JSON.stringify(snapshotData.data),
      JSON.stringify(snapshotData.headers),
      snapshotData.status,
      now.toISOString(),
      expiresAt.toISOString(),
      snapshotData.tags ? JSON.stringify(snapshotData.tags) : null,
      0, // initial access count
    ];

    const sql = this.sqlGenerator.generateInsertOrReplace(
      "snapshots",
      columns,
      values.length
    );
    await this.db.execute(sql, values);
  }

  async findActiveSnapshot(url: string): Promise<SnapshotRecord | null> {
    const now = new Date().toISOString();

    const sql = `SELECT * FROM snapshots 
                 WHERE url = ${this.sqlGenerator.formatPlaceholder(1)} 
                 AND expires_at > ${this.sqlGenerator.formatPlaceholder(2)}
                 ORDER BY created_at DESC
                 LIMIT 1`;

    const results = await this.db.query<SnapshotRecord>(sql, [url, now]);
    return results.length > 0 ? results[0] : null;
  }

  async updateAccessStats(id: string): Promise<void> {
    const now = new Date().toISOString();

    const sql = `UPDATE snapshots 
                 SET last_accessed = ${this.sqlGenerator.formatPlaceholder(1)}, 
                     access_count = access_count + 1
                 WHERE id = ${this.sqlGenerator.formatPlaceholder(2)}`;

    await this.db.execute(sql, [now, id]);
  }

  async getStats(): Promise<SnapshotStats> {
    const queries = {
      total: "SELECT COUNT(*) as count FROM snapshots",
      active: this.getActiveSnapshotsQuery(),
      expired: this.getExpiredSnapshotsQuery(),
      avgAccess: "SELECT AVG(access_count) as avg FROM snapshots",
    };

    const [totalResult, activeResult, expiredResult, avgAccessResult] =
      await Promise.all([
        this.db.query(queries.total),
        this.db.query(queries.active),
        this.db.query(queries.expired),
        this.db.query(queries.avgAccess),
      ]);

    return {
      total: totalResult[0]?.count || 0,
      active: activeResult[0]?.count || 0,
      expired: expiredResult[0]?.count || 0,
      avgAccessCount: Math.round(avgAccessResult[0]?.avg || 0),
    };
  }

  async cleanExpiredSnapshots(): Promise<number> {
    const sql = this.getDeleteExpiredQuery();
    const result = await this.db.execute(sql);
    return result.affectedRows;
  }

  async findSnapshotsByFilters(filters: {
    url?: string;
    status?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<SnapshotRecord[]> {
    let sql = "SELECT * FROM snapshots WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.url) {
      sql += ` AND url LIKE ${this.sqlGenerator.formatPlaceholder(paramIndex)}`;
      params.push(`%${filters.url}%`);
      paramIndex++;
    }

    if (filters.status) {
      sql += ` AND status = ${this.sqlGenerator.formatPlaceholder(paramIndex)}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      // This is a simplified tag search - in production you might want a more sophisticated approach
      const tagConditions = filters.tags.map((tag) => {
        const condition = `tags LIKE ${this.sqlGenerator.formatPlaceholder(paramIndex)}`;
        params.push(`%"${tag}"%`);
        paramIndex++;
        return condition;
      });
      sql += ` AND (${tagConditions.join(" OR ")})`;
    }

    sql += " ORDER BY created_at DESC";

    if (filters.limit) {
      sql += ` LIMIT ${filters.limit}`;
    }

    if (filters.offset) {
      sql += ` OFFSET ${filters.offset}`;
    }

    return await this.db.query<SnapshotRecord>(sql, params);
  }

  private getActiveSnapshotsQuery(): string {
    const dialect = this.db.getDialect();

    switch (dialect) {
      case DatabaseDialect.POSTGRESQL:
        return "SELECT COUNT(*) as count FROM snapshots WHERE expires_at > NOW()";
      case DatabaseDialect.MYSQL:
        return "SELECT COUNT(*) as count FROM snapshots WHERE expires_at > NOW()";
      case DatabaseDialect.SQLITE:
      default:
        return "SELECT COUNT(*) as count FROM snapshots WHERE expires_at > datetime('now')";
    }
  }

  private getExpiredSnapshotsQuery(): string {
    const dialect = this.db.getDialect();

    switch (dialect) {
      case DatabaseDialect.POSTGRESQL:
        return "SELECT COUNT(*) as count FROM snapshots WHERE expires_at <= NOW()";
      case DatabaseDialect.MYSQL:
        return "SELECT COUNT(*) as count FROM snapshots WHERE expires_at <= NOW()";
      case DatabaseDialect.SQLITE:
      default:
        return "SELECT COUNT(*) as count FROM snapshots WHERE expires_at <= datetime('now')";
    }
  }

  private getDeleteExpiredQuery(): string {
    const dialect = this.db.getDialect();

    switch (dialect) {
      case DatabaseDialect.POSTGRESQL:
        return "DELETE FROM snapshots WHERE expires_at <= NOW()";
      case DatabaseDialect.MYSQL:
        return "DELETE FROM snapshots WHERE expires_at <= NOW()";
      case DatabaseDialect.SQLITE:
      default:
        return "DELETE FROM snapshots WHERE expires_at <= datetime('now')";
    }
  }
}
