# @proxy-stone/storage-mysql

MySQL storage plugin for Proxy Stone proxy server.

## Installation

```bash
npm install @proxy-stone/storage-mysql
```

## Usage

### Auto-registration

The plugin will automatically register itself when imported:

```typescript
import "@proxy-stone/storage-mysql";
```

### Manual registration

```typescript
import { registerMySQLPlugin } from "@proxy-stone/storage-mysql";

registerMySQLPlugin();
```

### Configuration

```typescript
import { StorageFactory } from "@proxy-stone/backend";

const config = {
  type: "mysql",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "your-password",
  database: "proxy_stone",
  connectionLimit: 10,
  tableName: "proxy_stone_snapshots", // optional
};

const storage = await StorageFactory.createStorageAdapter(config);
```

## Configuration Options

| Option            | Type    | Required | Default                 | Description                       |
| ----------------- | ------- | -------- | ----------------------- | --------------------------------- |
| `host`            | string  | Yes      | -                       | MySQL server hostname             |
| `port`            | number  | No       | 3306                    | MySQL server port                 |
| `user`            | string  | No       | 'root'                  | MySQL username                    |
| `password`        | string  | No       | -                       | MySQL password                    |
| `database`        | string  | Yes      | -                       | Database name                     |
| `connectionLimit` | number  | No       | 10                      | Maximum connections in pool       |
| `acquireTimeout`  | number  | No       | 60000                   | Connection acquire timeout (ms)   |
| `timeout`         | number  | No       | 60000                   | Query timeout (ms)                |
| `reconnect`       | boolean | No       | true                    | Auto-reconnect on connection loss |
| `tableName`       | string  | No       | 'proxy_stone_snapshots' | Table name for storage            |
| `ssl`             | object  | No       | -                       | SSL configuration                 |

## Features

- ✅ Connection pooling
- ✅ JSON data storage
- ✅ TTL support with automatic expiration
- ✅ Metadata storage
- ✅ Pattern-based filtering
- ✅ Automatic table creation
- ✅ Connection management
- ✅ Storage statistics

## Requirements

- MySQL 5.7+ or MariaDB 10.2+
- Node.js 18+

## License

MIT
