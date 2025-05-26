# @proxy-stone/storage-plugins

A collection of database-specific storage plugins for Proxy Stone proxy server.

## Available Plugins

### SQL Databases

- **[@proxy-stone/storage-mysql](./mysql)** - MySQL/MariaDB storage with connection pooling
- **[@proxy-stone/storage-postgresql](./postgresql)** - PostgreSQL storage with JSONB support
- **[@proxy-stone/storage-sqlite](./sqlite)** - SQLite storage for local development

### NoSQL Databases

- **[@proxy-stone/storage-mongodb](./mongodb)** - MongoDB storage with TTL indexes
- **[@proxy-stone/storage-redis](./redis)** - Redis storage for high-performance caching

### Cloud Storage

- **[@proxy-stone/storage-s3](./s3)** - AWS S3 compatible storage
- **[@proxy-stone/storage-azure-storage](./azure-storage)** - Azure Blob Storage
- **[@proxy-stone/storage-google-cloud](./google-cloud)** - Google Cloud Storage

## Quick Start

### Installation

Install the specific storage plugin you need:

```bash
# MySQL
npm install @proxy-stone/storage-mysql

# PostgreSQL
npm install @proxy-stone/storage-postgresql

# MongoDB
npm install @proxy-stone/storage-mongodb

# Redis
npm install @proxy-stone/storage-redis

# AWS S3
npm install @proxy-stone/storage-s3
```

### Usage

#### Auto-registration (Recommended)

Simply import the plugin and it will automatically register itself:

```typescript
import "@proxy-stone/storage-mysql";
import { StorageFactory } from "@proxy-stone/backend";

const config = {
  type: "mysql",
  host: "localhost",
  database: "proxy_stone",
  user: "root",
  password: "password",
};

const storage = await StorageFactory.createStorageAdapter(config);
```

#### Manual registration

```typescript
import { registerMySQLPlugin } from "@proxy-stone/storage-mysql";
import { StorageFactory } from "@proxy-stone/backend";

// Register the plugin
registerMySQLPlugin();

// Use it
const storage = await StorageFactory.createStorageAdapter(config);
```

## Configuration Examples

### MySQL

```typescript
const mysqlConfig = {
  type: "mysql",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "proxy_stone",
  connectionLimit: 10,
  tableName: "snapshots", // optional
};
```

### PostgreSQL

```typescript
const postgresConfig = {
  type: "postgresql",
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "password",
  database: "proxy_stone",
  schema: "public", // optional
  tableName: "snapshots", // optional
};
```

### MongoDB

```typescript
const mongoConfig = {
  type: "mongodb",
  connectionString: "mongodb://localhost:27017",
  database: "proxy_stone",
  collection: "snapshots", // optional
  maxPoolSize: 10,
};
```

### Redis

```typescript
const redisConfig = {
  type: "redis",
  host: "localhost",
  port: 6379,
  password: "password", // optional
  db: 0,
  keyPrefix: "proxy-stone:", // optional
};
```

### AWS S3

```typescript
const s3Config = {
  type: "s3",
  bucket: "my-proxy-stone-bucket",
  region: "us-east-1",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  keyPrefix: "snapshots/", // optional
};
```

## Features

All storage plugins support:

- ✅ **TTL Support** - Automatic expiration of stored data
- ✅ **Metadata Storage** - Store additional metadata with each entry
- ✅ **Pattern Filtering** - List entries with glob patterns
- ✅ **Cleanup Operations** - Remove expired or old entries
- ✅ **Storage Statistics** - Get storage usage information
- ✅ **Connection Management** - Proper connection pooling and cleanup

## Development

### Building All Plugins

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Cleaning Build Artifacts

```bash
npm run clean
```

## Plugin Architecture

Each storage plugin implements the `StorageAdapter<T>` interface:

```typescript
interface StorageAdapter<T> {
  save(id: string, data: T, options?: SaveOptions): Promise<void>;
  load(id: string): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
  list(options?: FilterOptions): Promise<string[]>;
  cleanup(options?: CleanupOptions): Promise<number>;
  getStats(): Promise<StorageStats>;
  close(): Promise<void>;
}
```

## Creating Custom Plugins

To create a custom storage plugin:

1. Implement the `StorageAdapter<T>` interface
2. Create a plugin definition with `StoragePlugin` interface
3. Register the plugin with `StoragePluginRegistry`

Example:

```typescript
import { StoragePlugin, StoragePluginRegistry } from "@proxy-stone/backend";

export const customPlugin: StoragePlugin = {
  name: "Custom Storage",
  type: "custom" as any,
  description: "Custom storage implementation",
  dependencies: ["custom-driver"],
  configSchema: {
    required: ["connectionString"],
    properties: {
      connectionString: { type: "string" },
    },
  },
  adapterClass: CustomStorageAdapter,
};

// Register the plugin
StoragePluginRegistry.registerPlugin(customPlugin);
```

## Requirements

- Node.js 18+
- @proxy-stone/backend ^1.0.0

## License

MIT
