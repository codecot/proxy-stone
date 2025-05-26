# @proxy-stone/shared

Common types, utilities, and configuration for Proxy Stone.

## Overview

This package provides shared functionality used across all Proxy Stone applications and packages:

- **Types**: TypeScript interfaces and type definitions
- **Utilities**: Common helper functions
- **Configuration**: Configuration management and validation

## Installation

```bash
npm install @proxy-stone/shared
```

## Usage

### Types

```typescript
import type {
  AppConfig,
  ProxyConfig,
  DatabaseConfig,
  ApiResponse,
  HealthStatus,
} from "@proxy-stone/shared";

// Use in your application
const config: AppConfig = {
  server: { port: 4000, host: "0.0.0.0" },
  proxy: { target: "https://api.example.com" },
  database: { type: "sqlite", database: "app.db" },
  cache: { enabled: true, ttl: 300 },
  logging: { level: "info", format: "json" },
};
```

### Utilities

```typescript
import {
  sleep,
  retry,
  generateId,
  formatBytes,
  formatDuration,
  deepMerge,
  isValidUrl,
} from "@proxy-stone/shared";

// Sleep for 1 second
await sleep(1000);

// Retry with exponential backoff
const result = await retry(() => fetch("/api/data"), {
  retries: 3,
  delay: 1000,
  backoff: 2,
});

// Generate random ID
const id = generateId(12); // "aBc123XyZ789"

// Format bytes
const size = formatBytes(1024); // "1 KB"

// Format duration
const time = formatDuration(5000); // "5.0s"

// Deep merge objects
const merged = deepMerge(target, source);

// Validate URL
const valid = isValidUrl("https://example.com"); // true
```

### Configuration

```typescript
import {
  validateConfig,
  mergeWithDefaults,
  loadConfigFromEnv,
  defaultConfig,
} from "@proxy-stone/shared";

// Load configuration from environment
const envConfig = loadConfigFromEnv();

// Merge with defaults
const config = mergeWithDefaults(envConfig);

// Validate configuration
const validConfig = validateConfig(config);
```

## API Reference

### Types

#### `AppConfig`

Main application configuration interface.

#### `ProxyConfig`

Proxy server configuration.

#### `DatabaseConfig`

Database connection configuration.

#### `RedisConfig`

Redis cache configuration.

#### `ServerConfig`

HTTP server configuration.

#### `LogConfig`

Logging configuration.

#### `ApiResponse<T>`

Standard API response format.

#### `HealthStatus`

Health check response format.

#### `ProxyMetrics`

Proxy performance metrics.

### Utilities

#### `sleep(ms: number): Promise<void>`

Sleep for specified milliseconds.

#### `retry<T>(fn: () => Promise<T>, options?): Promise<T>`

Retry function with exponential backoff.

#### `generateId(length?: number): string`

Generate random alphanumeric string.

#### `formatBytes(bytes: number, decimals?: number): string`

Format bytes to human readable string.

#### `formatDuration(ms: number): string`

Format milliseconds to human readable duration.

#### `deepMerge<T>(target: T, source: Partial<T>): T`

Deep merge two objects.

#### `isValidUrl(url: string): boolean`

Validate URL format.

#### `sanitizeFilename(filename: string): string`

Sanitize string for use as filename.

### Configuration

#### `validateConfig(config: unknown): AppConfig`

Validate configuration object using Zod schemas.

#### `mergeWithDefaults(config: Partial<AppConfig>): AppConfig`

Merge partial configuration with defaults.

#### `loadConfigFromEnv(): Partial<AppConfig>`

Load configuration from environment variables.

#### `defaultConfig: Partial<AppConfig>`

Default configuration values.

## Environment Variables

The configuration loader supports these environment variables:

```bash
# Server
PORT=4000
HOST=0.0.0.0

# Proxy
PROXY_TARGET=https://api.example.com
PROXY_TIMEOUT=30000
PROXY_RETRIES=3

# Database
DB_TYPE=sqlite|mysql|postgresql
DB_HOST=localhost
DB_PORT=3306|5432
DB_NAME=proxy_stone
DB_USER=username
DB_PASS=password
DB_FILENAME=app.db  # SQLite only

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
REDIS_DB=0

# Cache
CACHE_ENABLED=true
CACHE_TTL=300

# Logging
LOG_LEVEL=debug|info|warn|error
LOG_FORMAT=json|pretty
LOG_FILE=/path/to/log/file
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run type-check

# Lint
npm run lint
```

## License

MIT
