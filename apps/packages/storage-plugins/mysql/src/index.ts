import { StoragePlugin, StoragePluginRegistry } from "@proxy-stone/backend";
import { MySQLStorageAdapter, MySQLStorageConfig } from "./mysql-adapter.js";

export { MySQLStorageAdapter, MySQLStorageConfig };

export const mysqlPlugin: StoragePlugin = {
  name: "MySQL Storage",
  type: "mysql" as any,
  description:
    "MySQL database storage with connection pooling and JSON support",
  dependencies: ["mysql2"],
  configSchema: {
    required: ["host", "database"],
    properties: {
      host: { type: "string" },
      port: { type: "number", default: 3306 },
      user: { type: "string", default: "root" },
      password: { type: "string" },
      database: { type: "string" },
      connectionLimit: { type: "number", default: 10 },
      acquireTimeout: { type: "number", default: 60000 },
      timeout: { type: "number", default: 60000 },
      reconnect: { type: "boolean", default: true },
      tableName: { type: "string", default: "proxy_stone_snapshots" },
    },
  },
  adapterClass: MySQLStorageAdapter,
};

// Auto-register when imported
export default {
  async register(registry: typeof StoragePluginRegistry) {
    registry.registerPlugin(mysqlPlugin);
  },
};

// Export for manual registration
export function registerMySQLPlugin(): void {
  StoragePluginRegistry.registerPlugin(mysqlPlugin);
}
