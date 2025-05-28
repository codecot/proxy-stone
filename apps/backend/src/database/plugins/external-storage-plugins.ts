import {
  StoragePluginRegistry,
  StoragePlugin,
} from "../storage-plugin-registry.js";
import { StorageType, StorageAdapter, StorageConfig } from "../types.js";

// Placeholder adapters for external storage types that require optional dependencies
class PlaceholderStorageAdapter<T = any> implements StorageAdapter<T> {
  constructor(private config: StorageConfig, private storageType: StorageType) {}

  async initialize(): Promise<void> {
    throw new Error(`${this.storageType} storage requires additional dependencies. Please install the required packages.`);
  }

  async close(): Promise<void> {}
  async save(key: string, data: T, options?: any): Promise<void> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async get(key: string): Promise<T | null> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async delete(key: string): Promise<boolean> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async exists(key: string): Promise<boolean> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async saveBatch(): Promise<void> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async getBatch(): Promise<Array<T | null>> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async deleteBatch(): Promise<number> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async find(): Promise<T[]> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async count(): Promise<number> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async cleanup(): Promise<number> {
    throw new Error(`${this.storageType} storage not available`);
  }
  async getStats(): Promise<any> {
    throw new Error(`${this.storageType} storage not available`);
  }
  getStorageType(): StorageType {
    return this.storageType;
  }
}

// Create placeholder adapter classes for each external storage type
class DynamoDBPlaceholderAdapter<T> extends PlaceholderStorageAdapter<T> {
  constructor(config: StorageConfig) {
    super(config, StorageType.DYNAMODB);
  }
}

class AzureBlobPlaceholderAdapter<T> extends PlaceholderStorageAdapter<T> {
  constructor(config: StorageConfig) {
    super(config, StorageType.AZURE_BLOB);
  }
}

class GCSPlaceholderAdapter<T> extends PlaceholderStorageAdapter<T> {
  constructor(config: StorageConfig) {
    super(config, StorageType.GCS);
  }
}

// External storage plugins (placeholders for missing dependencies)
const externalPlugins: StoragePlugin[] = [
  {
    name: "DynamoDB Storage",
    type: StorageType.DYNAMODB,
    description: "DynamoDB storage with TTL and indexing (requires @aws-sdk/client-dynamodb)",
    dependencies: ["@aws-sdk/client-dynamodb", "@aws-sdk/util-dynamodb"],
    configSchema: {
      required: ["table", "region"],
    },
    adapterClass: DynamoDBPlaceholderAdapter,
  },
  {
    name: "Azure Blob Storage",
    type: StorageType.AZURE_BLOB,
    description: "Azure Blob storage with compression and encryption (requires @azure/storage-blob)",
    dependencies: ["@azure/storage-blob"],
    configSchema: {
      required: ["connectionString", "containerName"],
    },
    adapterClass: AzureBlobPlaceholderAdapter,
  },
  {
    name: "Google Cloud Storage",
    type: StorageType.GCS,
    description: "Google Cloud Storage with compression and encryption (requires @google-cloud/storage)",
    dependencies: ["@google-cloud/storage"],
    configSchema: {
      required: ["bucket"],
    },
    adapterClass: GCSPlaceholderAdapter,
  },
];

/**
 * Register external storage plugins (with placeholders for missing dependencies)
 */
export function registerExternalStoragePlugins(): void {
  for (const plugin of externalPlugins) {
    try {
      StoragePluginRegistry.registerPlugin(plugin);
    } catch (error) {
      console.warn(`Failed to register external plugin ${plugin.name}:`, error);
    }
  }
}

/**
 * Get default configuration for external storage types
 */
export function getExternalStorageDefaults(
  type: StorageType
): Partial<StorageConfig> {
  switch (type) {
    case StorageType.DYNAMODB:
      return {
        type: StorageType.DYNAMODB,
        table: "proxy_stone_snapshots",
        region: "us-east-1",
        keyPrefix: "snapshots:",
      };

    case StorageType.AZURE_BLOB:
      return {
        type: StorageType.AZURE_BLOB,
        connectionString: "DefaultEndpointsProtocol=https;AccountName=...",
        // containerName: "snapshots",
        keyPrefix: "snapshots/",
      };

    case StorageType.GCS:
      return {
        type: StorageType.GCS,
        bucket: "proxy-stone-snapshots",
        keyPrefix: "snapshots/",
      };

    default:
      throw new Error(`No default config available for external storage type: ${type}`);
  }
} 