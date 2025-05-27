import { DatabaseAdapter } from "../../database/types.js";
import { CLUSTER_NODES_SCHEMA } from "../../database/schemas.js";
import { ClusterNode, NodeStatus, NodeRole } from "./types.js";

export class ClusterRepository {
  private db: DatabaseAdapter;
  private tableName = "cluster_nodes";

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    // Create table if it doesn't exist
    const tableExists = await this.db.tableExists(this.tableName);
    if (!tableExists) {
      await this.db.createTable(this.tableName, CLUSTER_NODES_SCHEMA);
    }
  }

  async saveNode(node: ClusterNode): Promise<void> {
    const dialect = this.db.getDialect();

    // Handle JSON serialization for different databases
    const tagsValue = JSON.stringify(node.tags);
    const capabilitiesValue = JSON.stringify(node.capabilities);
    const metadataValue = JSON.stringify(node.metadata || {});

    // Use database-specific UPSERT syntax
    let sql: string;
    if (dialect === "sqlite") {
      sql = `
        INSERT OR REPLACE INTO ${this.tableName} 
        (id, url, cluster_id, tags, capabilities, status, role, last_seen, created_at, metadata, version, region, zone)
        VALUES (${this.getPlaceholders(13)})
      `;
    } else if (dialect === "mysql") {
      sql = `
        INSERT INTO ${this.tableName} 
        (id, url, cluster_id, tags, capabilities, status, role, last_seen, created_at, metadata, version, region, zone)
        VALUES (${this.getPlaceholders(13)})
        ON DUPLICATE KEY UPDATE
        url = VALUES(url), cluster_id = VALUES(cluster_id), tags = VALUES(tags),
        capabilities = VALUES(capabilities), status = VALUES(status), role = VALUES(role),
        last_seen = VALUES(last_seen), metadata = VALUES(metadata), version = VALUES(version),
        region = VALUES(region), zone = VALUES(zone)
      `;
    } else {
      // PostgreSQL
      sql = `
        INSERT INTO ${this.tableName} 
        (id, url, cluster_id, tags, capabilities, status, role, last_seen, created_at, metadata, version, region, zone)
        VALUES (${this.getPlaceholders(13)})
        ON CONFLICT (id) DO UPDATE SET
        url = EXCLUDED.url, cluster_id = EXCLUDED.cluster_id, tags = EXCLUDED.tags,
        capabilities = EXCLUDED.capabilities, status = EXCLUDED.status, role = EXCLUDED.role,
        last_seen = EXCLUDED.last_seen, metadata = EXCLUDED.metadata, version = EXCLUDED.version,
        region = EXCLUDED.region, zone = EXCLUDED.zone
      `;
    }

    await this.db.execute(sql, [
      node.id,
      node.url,
      node.clusterId,
      tagsValue,
      capabilitiesValue,
      node.status,
      node.role,
      node.lastSeen,
      node.createdAt,
      metadataValue,
      node.version,
      node.region,
      node.zone,
    ]);
  }

  async getNode(nodeId: string): Promise<ClusterNode | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ${this.db.formatPlaceholder(1)}`;
    const rows = await this.db.query<any>(sql, [nodeId]);

    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToNode(rows[0]);
  }

  async getAllNodes(): Promise<ClusterNode[]> {
    const sql = `SELECT * FROM ${this.tableName} ORDER BY created_at`;
    const rows = await this.db.query<any>(sql);

    return rows.map((row) => this.mapRowToNode(row));
  }

  async getNodesByCluster(clusterId: string): Promise<ClusterNode[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE cluster_id = ${this.db.formatPlaceholder(1)} ORDER BY created_at`;
    const rows = await this.db.query<any>(sql, [clusterId]);

    return rows.map((row) => this.mapRowToNode(row));
  }

  async getNodesByStatus(status: NodeStatus): Promise<ClusterNode[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = ${this.db.formatPlaceholder(1)} ORDER BY created_at`;
    const rows = await this.db.query<any>(sql, [status]);

    return rows.map((row) => this.mapRowToNode(row));
  }

  async updateNodeStatus(
    nodeId: string,
    status: NodeStatus,
    lastSeen: string
  ): Promise<void> {
    const sql = `
      UPDATE ${this.tableName} 
      SET status = ${this.db.formatPlaceholder(1)}, last_seen = ${this.db.formatPlaceholder(2)}
      WHERE id = ${this.db.formatPlaceholder(3)}
    `;

    await this.db.execute(sql, [status, lastSeen, nodeId]);
  }

  async updateNodeHeartbeat(
    nodeId: string,
    status: NodeStatus,
    lastSeen: string,
    metadata: Record<string, any>,
    capabilities: Record<string, any>
  ): Promise<void> {
    const metadataValue = JSON.stringify(metadata);
    const capabilitiesValue = JSON.stringify(capabilities);

    const sql = `
      UPDATE ${this.tableName} 
      SET status = ${this.db.formatPlaceholder(1)}, 
          last_seen = ${this.db.formatPlaceholder(2)}, 
          metadata = ${this.db.formatPlaceholder(3)}, 
          capabilities = ${this.db.formatPlaceholder(4)}
      WHERE id = ${this.db.formatPlaceholder(5)}
    `;

    await this.db.execute(sql, [
      status,
      lastSeen,
      metadataValue,
      capabilitiesValue,
      nodeId,
    ]);
  }

  async removeNode(nodeId: string): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ${this.db.formatPlaceholder(1)}`;
    await this.db.execute(sql, [nodeId]);
  }

  async getNodeCount(): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const rows = await this.db.query<{ count: number }>(sql);
    return rows[0]?.count || 0;
  }

  async getNodeCountByStatus(): Promise<Record<NodeStatus, number>> {
    const sql = `
      SELECT status, COUNT(*) as count 
      FROM ${this.tableName} 
      GROUP BY status
    `;
    const rows = await this.db.query<{ status: NodeStatus; count: number }>(
      sql
    );

    const counts: Record<NodeStatus, number> = {
      [NodeStatus.ACTIVE]: 0,
      [NodeStatus.INACTIVE]: 0,
      [NodeStatus.DISABLED]: 0,
      [NodeStatus.UNHEALTHY]: 0,
    };

    for (const row of rows) {
      counts[row.status] = row.count;
    }

    return counts;
  }

  async cleanupInactiveNodes(olderThan: string): Promise<number> {
    const sql = `
      DELETE FROM ${this.tableName} 
      WHERE status = ${this.db.formatPlaceholder(1)} 
      AND last_seen < ${this.db.formatPlaceholder(2)}
    `;

    const result = await this.db.execute(sql, [NodeStatus.INACTIVE, olderThan]);
    return result.affectedRows;
  }

  private mapRowToNode(row: any): ClusterNode {
    return {
      id: row.id,
      url: row.url,
      clusterId: row.cluster_id,
      tags: this.parseJSON(row.tags, []),
      capabilities: this.parseJSON(row.capabilities, {}),
      status: row.status as NodeStatus,
      role: row.role as NodeRole,
      lastSeen: row.last_seen,
      createdAt: row.created_at,
      metadata: this.parseJSON(row.metadata, {}),
      version: row.version,
      region: row.region,
      zone: row.zone,
    };
  }

  private parseJSON<T>(value: string | null | undefined, defaultValue: T): T {
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  private getPlaceholders(count: number): string {
    const placeholders = [];
    for (let i = 1; i <= count; i++) {
      placeholders.push(this.db.formatPlaceholder(i));
    }
    return placeholders.join(", ");
  }
}
