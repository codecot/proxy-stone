import { StoragePlugin, StoragePluginRegistry } from "@proxy-stone/backend";
import {
  PostgreSQLStorageAdapter,
  PostgreSQLStorageConfig,
} from "./postgresql-adapter.js";

export { PostgreSQLStorageAdapter, PostgreSQLStorageConfig };

export const postgresqlPlugin: StoragePlugin = {
  name: "PostgreSQL Storage",
  type: "postgresql" as any,
  description:
    "PostgreSQL database storage with JSONB support and advanced indexing",
  dependencies: ["pg"],
  configSchema: {
    required: ["host", "database"],
    properties: {
      host: { type: "string" },
      port: { type: "number", default: 5432 },
      user: { type: "string", default: "postgres" },
      password: { type: "string" },
      database: { type: "string" },
      max: { type: "number", default: 10 },
      idleTimeoutMillis: { type: "number", default: 30000 },
      connectionTimeoutMillis: { type: "number", default: 2000 },
      tableName: { type: "string", default: "proxy_stone_snapshots" },
      schema: { type: "string", default: "public" },
    },
  },
  adapterClass: PostgreSQLStorageAdapter,
};

// Auto-register when imported
export default {
  async register(registry: typeof StoragePluginRegistry) {
    registry.registerPlugin(postgresqlPlugin);
  },
};

// Export for manual registration
export function registerPostgreSQLPlugin(): void {
  StoragePluginRegistry.registerPlugin(postgresqlPlugin);
}
