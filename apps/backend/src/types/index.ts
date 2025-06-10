import { FastifyInstance } from "fastify";
import { CacheService } from "@/services/cache.js";
import { RequestLoggerService } from "@/modules/monitoring/services/request-logger.js";
import { SnapshotManager } from "@/modules/recovery/services/snapshot-manager.js";
import { MetricsService } from "@/modules/monitoring/services/metrics.js";
import { AuthService } from "@/modules/auth/services/auth-service.js";
import { RecoveryService } from "@/modules/recovery/services/recovery.js";
import { ErrorTrackerService } from "@/modules/recovery/services/error-tracker.js";
import { DatabaseConfig, StorageConfig } from "@/database/types.js";
import { ClusterConfig } from "@/modules/cluster/types.js";

export interface ServerConfig {
  port: number;
  host: string;
  apiPrefix: string;
  targetUrl: string;
  // Legacy single TTL (kept for backwards compatibility)
  cacheTTL: number;
  cacheableMethods: string[];
  // Advanced cache configuration
  cache?: CacheConfig;
  // File cache options
  enableFileCache: boolean;
  fileCacheDir: string;
  // Request logging options
  enableRequestLogging: boolean;
  requestLogDbPath: string;
  requestLogStorage?: StorageConfig;
  // Snapshot management options (legacy)
  snapshotDbPath: string;
  // Multi-database configuration
  database?: DatabaseConfig;
  // Auth configuration
  auth?: AuthConfig;
  // Cluster configuration
  cluster?: ClusterConfig;
}

export interface ApiRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  error?: string;
  backendHost?: string;
  backendPath?: string;
  targetUrl?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface ApiResponse {
  id: string;
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
  responseTime: number;
  error?: string;
  size?: number;
  cached?: boolean;
  cacheHit?: boolean;
  cacheTTL?: number;
}

export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxSize: number;
  methods: string[];
  keyOptions: {
    hashLongKeys: boolean;
    maxKeyLength: number;
    includeHeaders: string[];
    excludeHeaders?: string[];
    normalizeUrl?: boolean;
  };
  rules: CacheRule[];
  behavior: {
    warmupEnabled?: boolean;
    backgroundCleanup?: boolean;
    cleanupInterval?: number;
    maxSize?: number;
    evictionPolicy?: "lru" | "fifo";
  };
  redis?: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db?: number;
    tls?: boolean;
    prefix?: string;
    keyPrefix?: string;
    connectTimeout?: number;
    lazyConnect?: boolean;
  };
}

export interface CacheRule {
  pattern: string;
  methods: string[];
  ttl: number;
  enabled: boolean;
  conditions?: {
    headers?: Record<string, string>;
    statusCodes?: number[];
    minSize?: number;
    maxSize?: number;
  };
}

export interface AuthConfig {
  enabled: boolean;
  apiKeys: ApiKey[];
  users: User[];
  enableUserAuth: boolean;
  sessionTTL: number;
  hashSalt: string;
  maxLoginAttempts: number;
  lockoutDuration: number;
  protectedPaths: string[];
  jwt?: {
    secret: string;
    expiresIn: string;
    issuer: string;
  };
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  expiresAt?: string;
  enabled: boolean;
  role: Role;
  keyHash: string;
  createdAt: string;
  lastUsed?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  passwordHash: string;
  permissions: string[];
  isActive: boolean;
  enabled: boolean;
  role: Role;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  userId: string;
  role: Role;
  token: string;
  expiresAt: number;
}

export enum Role {
  ADMIN = "admin",
  USER = "user",
  READ_ONLY = "read_only",
  // GUEST = "guest",
}

declare module "fastify" {
  interface FastifyInstance {
    config: ServerConfig;
    cache: CacheService;
    requestLogger: RequestLoggerService;
    snapshotManager: SnapshotManager;
    metrics: MetricsService;
    authService?: AuthService;
    recovery: RecoveryService;
    errorTracker: ErrorTrackerService;
    cluster?: any; // Generic cluster service interface
  }
  interface FastifyRequest {
    metrics?: {
      startTime: number;
    };
  }
}

export type AppInstance = FastifyInstance;
