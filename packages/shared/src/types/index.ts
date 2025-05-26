// Common types for Proxy Stone

export interface ProxyConfig {
  target: string;
  changeOrigin?: boolean;
  pathRewrite?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize?: number;
  keyPrefix?: string;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'mysql' | 'postgresql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filename?: string; // for SQLite
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
  file?: string;
}

export interface AppConfig {
  server: ServerConfig;
  proxy: ProxyConfig;
  cache: CacheConfig;
  database: DatabaseConfig;
  redis?: RedisConfig;
  logging: LogConfig;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis?: 'connected' | 'disconnected' | 'error';
    proxy: 'active' | 'inactive' | 'error';
  };
}

// Metrics types
export interface ProxyMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  uptime: number;
} 