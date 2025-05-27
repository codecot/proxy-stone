import { TableSchema } from "./types.js";

export const SNAPSHOTS_SCHEMA: TableSchema = {
  columns: [
    { name: "id", type: "SERIAL", primaryKey: true },
    { name: "cache_key", type: "VARCHAR(255)", unique: true, notNull: true },
    { name: "url", type: "TEXT", notNull: true },
    { name: "method", type: "VARCHAR(10)", notNull: true },
    { name: "status_code", type: "INTEGER", notNull: true },
    {
      name: "created_at",
      type: "TIMESTAMP",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    { name: "expires_at", type: "TIMESTAMP", notNull: true },
    { name: "manual_snapshot", type: "BOOLEAN", defaultValue: false },
    { name: "backend_host", type: "VARCHAR(255)", notNull: true },
    { name: "payload_hash", type: "VARCHAR(64)" },
    { name: "headers_hash", type: "VARCHAR(64)" },
    { name: "request_body", type: "TEXT" },
    { name: "response_size", type: "INTEGER" },
    { name: "content_type", type: "VARCHAR(255)" },
    { name: "tags", type: "JSON" }, // Will be mapped to TEXT for SQLite
    { name: "description", type: "TEXT" },
    { name: "last_accessed_at", type: "TIMESTAMP" },
    { name: "access_count", type: "INTEGER", defaultValue: 0 },
  ],
  indexes: [
    { name: "idx_snapshots_cache_key", columns: ["cache_key"] },
    { name: "idx_snapshots_url", columns: ["url"] },
    { name: "idx_snapshots_method", columns: ["method"] },
    { name: "idx_snapshots_backend", columns: ["backend_host"] },
    { name: "idx_snapshots_expires", columns: ["expires_at"] },
    { name: "idx_snapshots_manual", columns: ["manual_snapshot"] },
    { name: "idx_snapshots_created", columns: ["created_at"] },
    { name: "idx_snapshots_accessed", columns: ["last_accessed_at"] },
  ],
};

export const CLUSTER_NODES_SCHEMA: TableSchema = {
  columns: [
    { name: "id", type: "VARCHAR(255)", primaryKey: true },
    { name: "url", type: "TEXT", notNull: true },
    { name: "cluster_id", type: "VARCHAR(255)" },
    { name: "tags", type: "JSON" }, // Will be mapped to TEXT for SQLite
    { name: "capabilities", type: "JSON" }, // Will be mapped to TEXT for SQLite
    { name: "status", type: "VARCHAR(50)", notNull: true },
    { name: "role", type: "VARCHAR(50)", notNull: true },
    { name: "last_seen", type: "TIMESTAMP", notNull: true },
    { name: "created_at", type: "TIMESTAMP", notNull: true },
    { name: "metadata", type: "JSON" }, // Will be mapped to TEXT for SQLite
    { name: "version", type: "VARCHAR(100)" },
    { name: "region", type: "VARCHAR(100)" },
    { name: "zone", type: "VARCHAR(100)" },
  ],
  indexes: [
    { name: "idx_cluster_nodes_status", columns: ["status"] },
    { name: "idx_cluster_nodes_cluster_id", columns: ["cluster_id"] },
    { name: "idx_cluster_nodes_last_seen", columns: ["last_seen"] },
    { name: "idx_cluster_nodes_role", columns: ["role"] },
    { name: "idx_cluster_nodes_created", columns: ["created_at"] },
  ],
};
