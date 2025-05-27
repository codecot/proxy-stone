import {
  FastifyInstance as OriginalFastifyInstance,
  FastifyRequest,
} from "fastify";
import { CacheService } from "../modules/cache/services/cache.js";
import { RequestLoggerService } from "../modules/monitoring/services/request-logger.js";
import { SnapshotManager } from "../modules/recovery/services/snapshot-manager.js";
import { DatabaseConfig, StorageConfig } from "../database/types.js";
import type { FastifyRequest as BaseFastifyRequest } from "fastify";
import type { MetricsService } from "../modules/monitoring/services/metrics.js";
import type { RecoveryService } from "../modules/recovery/services/recovery.js";
import type { ErrorTrackerService } from "../modules/recovery/services/error-tracker.js";

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  query: FastifyRequest["query"];
  params: FastifyRequest["params"];
}

export interface ApiResponse extends ApiRequest {
  timestamp: string;
}

// Cache rule for fine-grained TTL and behavior control
export interface CacheRule {
  pattern: string; // URL pattern (glob or regex)
  methods?: string[]; // Specific methods for this rule
  ttl?: number; // TTL in seconds for this rule
  enabled?: boolean; // Whether caching is enabled for this rule
  conditions?: {
    headers?: Record<string, string>; // Required headers
    statusCodes?: number[]; // Only cache these status codes
    minSize?: number; // Minimum response size to cache
    maxSize?: number; // Maximum response size to cache
  };
}

// Cache configuration with advanced features
export interface CacheConfig {
  defaultTTL: number; // Default TTL for all cached items
  methods: string[]; // Default cacheable methods
  rules: CacheRule[]; // Fine-grained cache rules
  keyOptions: {
    includeHeaders?: string[]; // Additional headers to include in cache key
    excludeHeaders?: string[]; // Headers to exclude from cache key
    normalizeUrl?: boolean; // Normalize URL for consistent keys
    hashLongKeys?: boolean; // Hash keys longer than specified length
    maxKeyLength?: number; // Maximum cache key length before hashing
  };
  behavior: {
    warmupEnabled?: boolean; // Enable cache warming on startup
    backgroundCleanup?: boolean; // Enable background cleanup of expired entries
    cleanupInterval?: number; // Cleanup interval in seconds
    maxSize?: number; // Maximum number of cache entries
    evictionPolicy?: "lru" | "fifo"; // Cache eviction policy when maxSize reached
  };
  // Redis configuration
  redis?: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    connectTimeout?: number;
    lazyConnect?: boolean;
  };
}

// Auth configuration types
export enum Role {
  ADMIN = "admin",
  READ_ONLY = "readonly",
  USER = "user",
}

export interface ApiKey {
  id: string; // Unique identifier
  keyHash: string; // Hashed API key (never store plain text)
  role: Role;
  name?: string;
  enabled?: boolean;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string; // Optional expiration
}

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Hashed password
  role: Role;
  enabled: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  sessionId: string;
  userId?: string;
  apiKeyId?: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  ipAddress?: string;
}

export interface AuthConfig {
  enabled: boolean;
  // API Key authentication
  apiKeys: ApiKey[];
  // User/password authentication
  users: User[];
  enableUserAuth: boolean;
  // Session management
  sessionTTL: number; // Session TTL in seconds
  // Security settings
  hashSalt: string; // Salt for hashing
  maxLoginAttempts: number;
  lockoutDuration: number; // In seconds
  // Protected paths
  protectedPaths: string[];
  // JWT settings (optional)
  jwt?: {
    secret: string;
    issuer?: string;
    expiresIn?: string;
  };
}

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
}

// Extend FastifyInstance to include the decorated config property
declare module "fastify" {
  interface FastifyInstance {
    config: ServerConfig;
    cache: CacheService;
    requestLogger: RequestLoggerService;
    snapshotManager: SnapshotManager;
    metrics: MetricsService;
    recovery: RecoveryService;
    errorTracker: ErrorTrackerService;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    metrics?: {
      startTime: number;
    };
  }
}

// Use the augmented FastifyInstance type
export type AppInstance = OriginalFastifyInstance;
