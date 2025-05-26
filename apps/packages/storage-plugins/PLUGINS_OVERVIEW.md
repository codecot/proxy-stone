# Storage Plugins Overview

This document provides an overview of all the database-specific storage plugins created for Proxy Stone.

## ✅ Completed Plugins

### 1. MySQL Storage Plugin (`@proxy-stone/storage-mysql`)

- **Location**: `./mysql/`
- **Dependencies**: `mysql2`
- **Features**:
  - Connection pooling
  - JSON data storage
  - TTL support with automatic expiration
  - Automatic table creation
  - Storage statistics

### 2. PostgreSQL Storage Plugin (`@proxy-stone/storage-postgresql`)

- **Location**: `./postgresql/`
- **Dependencies**: `pg`
- **Features**:
  - JSONB support for efficient JSON queries
  - Advanced indexing (GIN indexes)
  - Schema support
  - Automatic triggers for updated_at
  - Connection pooling

### 3. MongoDB Storage Plugin (`@proxy-stone/storage-mongodb`)

- **Location**: `./mongodb/`
- **Dependencies**: `mongodb`
- **Features**:
  - Native JSON document storage
  - TTL indexes for automatic expiration
  - Text search capabilities
  - Flexible schema
  - Connection pooling

### 4. Redis Storage Plugin (`@proxy-stone/storage-redis`)

- **Location**: `./redis/`
- **Dependencies**: `ioredis`
- **Features**:
  - High-performance in-memory storage
  - Native TTL support
  - Pattern-based key operations
  - Sentinel support for high availability
  - Memory usage statistics

### 5. AWS S3 Storage Plugin (`@proxy-stone/storage-s3`)

- **Location**: `./s3/`
- **Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`
- **Features**:
  - Cloud object storage
  - Server-side encryption support
  - Storage class configuration
  - S3-compatible endpoints
  - Metadata storage in object headers

### 6. SQLite Storage Plugin (`@proxy-stone/storage-sqlite`)

- **Location**: `./sqlite/`
- **Dependencies**: `sqlite`, `sqlite3`
- **Features**:
  - Local file-based storage
  - Zero-configuration setup
  - Perfect for development
  - ACID compliance
  - Lightweight

## 🚧 Planned Plugins (Not Yet Implemented)

### 7. Azure Blob Storage Plugin (`@proxy-stone/storage-azure-storage`)

- **Location**: `./azure-storage/`
- **Dependencies**: `@azure/storage-blob`
- **Features**:
  - Azure cloud storage
  - Hot/Cool/Archive tiers
  - Encryption at rest
  - Geo-redundancy options

### 8. Google Cloud Storage Plugin (`@proxy-stone/storage-google-cloud`)

- **Location**: `./google-cloud/`
- **Dependencies**: `@google-cloud/storage`
- **Features**:
  - Google Cloud object storage
  - Multi-regional storage
  - Lifecycle management
  - IAM integration

## Plugin Architecture

All plugins follow a consistent architecture:

```
plugin-name/
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
├── README.md            # Plugin-specific documentation
└── src/
    ├── index.ts         # Main export and plugin registration
    └── adapter.ts       # Storage adapter implementation
```

## Common Interface

All storage adapters implement the `StorageAdapter<T>` interface:

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

## Plugin Registration

Each plugin supports both auto-registration and manual registration:

### Auto-registration

```typescript
import "@proxy-stone/storage-mysql";
// Plugin automatically registers itself
```

### Manual registration

```typescript
import { registerMySQLPlugin } from "@proxy-stone/storage-mysql";
registerMySQLPlugin();
```

## Configuration Schema

Each plugin defines a configuration schema for validation:

```typescript
export const pluginConfig: StoragePlugin = {
  name: "Plugin Name",
  type: "plugin-type",
  description: "Plugin description",
  dependencies: ["required-npm-packages"],
  configSchema: {
    required: ["requiredField"],
    properties: {
      requiredField: { type: "string" },
      optionalField: { type: "number", default: 100 },
    },
  },
  adapterClass: PluginStorageAdapter,
};
```

## Development Workflow

1. **Install dependencies**: `npm install`
2. **Build all plugins**: `npm run build`
3. **Development mode**: `npm run dev`
4. **Clean builds**: `npm run clean`

## Testing Strategy

Each plugin should include:

- Unit tests for adapter methods
- Integration tests with actual database
- Performance benchmarks
- Error handling tests

## Deployment

Plugins can be:

- Published individually to npm
- Bundled with the main application
- Loaded dynamically at runtime

## Performance Considerations

### SQL Databases (MySQL, PostgreSQL, SQLite)

- Use connection pooling
- Optimize indexes for query patterns
- Consider read replicas for high load

### NoSQL Databases (MongoDB, Redis)

- Configure appropriate indexes
- Monitor memory usage
- Use clustering for scalability

### Cloud Storage (S3, Azure, GCP)

- Implement retry logic
- Use appropriate storage classes
- Consider regional placement

## Security Considerations

- Encrypt sensitive configuration
- Use IAM roles where possible
- Implement proper access controls
- Audit storage access patterns

## Monitoring and Observability

All plugins provide:

- Storage statistics via `getStats()`
- Error logging and metrics
- Performance monitoring hooks
- Health check endpoints
