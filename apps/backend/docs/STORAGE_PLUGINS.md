# Storage Plugin System

The Proxy Stone backend uses a plugin-based architecture for storage adapters, keeping the core lean while allowing extensibility through external packages.

## Core Storage Types

The following storage types are built into the core:

- **SQLite** (`sqlite`) - File-based SQL database (default)
- **MySQL** (`mysql`) - MySQL database
- **PostgreSQL** (`postgresql`) - PostgreSQL database
- **Local File** (`local_file`) - JSON files on local filesystem

## External Storage Plugins

Additional storage types can be added through external npm packages:

- **MongoDB** - `@proxy-stone/storage-mongodb`
- **Redis** - `@proxy-stone/storage-redis`
- **AWS S3** - `@proxy-stone/storage-s3`
- **Azure Blob** - `@proxy-stone/storage-azure`
- **Google Cloud Storage** - `@proxy-stone/storage-gcs`
- **DynamoDB** - `@proxy-stone/storage-dynamodb`

## Using External Plugins

### Installation

```bash
# Install the plugin you need
npm install @proxy-stone/storage-mongodb
npm install @proxy-stone/storage-s3
npm install @proxy-stone/storage-redis
```

### Configuration

```typescript
import { StorageFactory, StorageType } from "@proxy-stone/backend";

// MongoDB example
const mongoConfig = {
  type: "mongodb",
  connectionString: "mongodb://localhost:27017",
  database: "proxy_stone",
  collection: "snapshots",
};

// S3 example
const s3Config = {
  type: "s3",
  bucket: "my-snapshots",
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

// Create repository
const repository = await StorageFactory.createSnapshotStorage(mongoConfig);
```

### Auto-Discovery

Plugins are automatically discovered from:

- `./plugins/storage/` directory
- `./node_modules/@proxy-stone/storage-*` packages

## Creating Custom Storage Plugins

### Plugin Structure

```typescript
import { StorageAdapter, StoragePlugin } from "@proxy-stone/backend";

// 1. Implement the StorageAdapter interface
class MyStorageAdapter<T> implements StorageAdapter<T> {
  constructor(private config: MyStorageConfig) {}

  async initialize(): Promise<void> {
    // Initialize your storage connection
  }

  async save(key: string, data: T, options?: SaveOptions): Promise<void> {
    // Save data to your storage
  }

  async get(key: string): Promise<T | null> {
    // Retrieve data from your storage
  }

  // ... implement all required methods
}

// 2. Define the plugin
export const myStoragePlugin: StoragePlugin = {
  name: "My Storage",
  type: "my_storage",
  description: "Custom storage adapter",
  dependencies: ["my-storage-package"],
  configSchema: {
    required: ["connectionString"],
  },
  adapterClass: MyStorageAdapter,
};

// 3. Export registration function
export default {
  async register(registry: StoragePluginRegistry) {
    registry.registerPlugin(myStoragePlugin);
  },
};
```

### Package.json

```json
{
  "name": "@proxy-stone/storage-my-storage",
  "version": "1.0.0",
  "description": "My custom storage adapter for Proxy Stone",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["proxy-stone", "storage", "plugin"],
  "peerDependencies": {
    "@proxy-stone/backend": "^1.0.0"
  },
  "dependencies": {
    "my-storage-package": "^1.0.0"
  }
}
```

### Required Methods

Your storage adapter must implement all methods in the `StorageAdapter<T>` interface:

#### Connection Management

- `initialize(): Promise<void>` - Initialize storage connection
- `close(): Promise<void>` - Close storage connection

#### Basic CRUD Operations

- `save(key: string, data: T, options?: SaveOptions): Promise<void>`
- `get(key: string): Promise<T | null>`
- `delete(key: string): Promise<boolean>`
- `exists(key: string): Promise<boolean>`

#### Batch Operations

- `saveBatch(items: Array<{key: string, data: T, options?: SaveOptions}>): Promise<void>`
- `getBatch(keys: string[]): Promise<Array<T | null>>`
- `deleteBatch(keys: string[]): Promise<number>`

#### Query Operations

- `find(filter: FilterOptions): Promise<T[]>`
- `count(filter?: FilterOptions): Promise<number>`

#### Maintenance Operations

- `cleanup(options?: CleanupOptions): Promise<number>`
- `getStats(): Promise<StorageStats>`

#### Storage Information

- `getStorageType(): StorageType`

### Configuration Schema

Define a JSON schema for your configuration:

```typescript
const configSchema = {
  required: ["connectionString", "database"],
  properties: {
    connectionString: { type: "string" },
    database: { type: "string" },
    collection: { type: "string", default: "snapshots" },
    timeout: { type: "number", default: 5000 },
  },
};
```

### Dependencies

List required npm packages in the `dependencies` array:

```typescript
const plugin: StoragePlugin = {
  // ...
  dependencies: ["mongodb", "@aws-sdk/client-s3"],
  // ...
};
```

The plugin system will check if these packages are available before creating adapters.

## Plugin Registry

### Manual Registration

```typescript
import { StoragePluginRegistry } from "@proxy-stone/backend";
import myPlugin from "@proxy-stone/storage-my-storage";

// Register manually
await myPlugin.register(StoragePluginRegistry);

// Check available plugins
const plugins = StoragePluginRegistry.getAllPlugins();
console.log(
  "Available storage types:",
  StoragePluginRegistry.getAvailableTypes()
);
```

### Plugin Discovery

The system automatically discovers plugins in:

1. **Local plugins directory**: `./plugins/storage/*-storage-plugin.{js,ts}`
2. **Node modules**: `./node_modules/@proxy-stone/storage-*`

### Plugin Validation

The registry validates:

- ✅ Required dependencies are installed
- ✅ Configuration matches schema
- ✅ No duplicate plugin types
- ✅ Adapter class implements StorageAdapter interface

## Best Practices

### Error Handling

- Always wrap storage operations in try-catch blocks
- Provide meaningful error messages
- Handle connection failures gracefully

### Performance

- Implement batch operations efficiently
- Use connection pooling where appropriate
- Cache frequently accessed data

### TTL Support

- Respect the `ttl` option in SaveOptions
- Implement automatic expiration where possible
- Clean up expired data in `cleanup()` method

### Filtering

- Support common filter options (tags, dates, etc.)
- Implement pagination for large result sets
- Optimize queries for your storage backend

### Testing

- Test with various data types and sizes
- Test connection failures and recovery
- Test TTL and expiration behavior
- Test batch operations

## Examples

See `src/examples/external-storage-plugin-example.ts` for complete examples of:

- MongoDB storage plugin
- S3 storage plugin
- Redis storage plugin
- Plugin registration and usage

## Migration

To migrate between storage types:

```typescript
// Source storage
const sourceRepo = await StorageFactory.createSnapshotStorage(sqliteConfig);

// Destination storage
const destRepo = await StorageFactory.createSnapshotStorage(mongoConfig);

// Migrate data (implement your own migration logic)
const snapshots = await sourceRepo.findSnapshots({ limit: 1000 });
for (const snapshot of snapshots) {
  await destRepo.saveSnapshot(snapshot);
}
```
