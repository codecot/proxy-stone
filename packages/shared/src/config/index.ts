// Configuration utilities for Proxy Stone
import { z } from "zod";
import type {
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  ServerConfig,
} from "../types/index.js";

// Zod schemas for validation
export const DatabaseConfigSchema = z.object({
  type: z.enum(["sqlite", "mysql", "postgresql"]),
  host: z.string().optional(),
  port: z.number().min(1).max(65535).optional(),
  database: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
  filename: z.string().optional(),
});

export const RedisConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  password: z.string().optional(),
  db: z.number().min(0).max(15).optional(),
});

export const ServerConfigSchema = z.object({
  port: z.number().min(1).max(65535),
  host: z.string().min(1),
  cors: z
    .object({
      origin: z.union([z.string(), z.array(z.string())]),
      credentials: z.boolean().optional(),
    })
    .optional(),
  rateLimit: z
    .object({
      max: z.number().min(1),
      timeWindow: z.string(),
    })
    .optional(),
});

export const AppConfigSchema = z.object({
  server: ServerConfigSchema,
  proxy: z.object({
    target: z.string().url(),
    changeOrigin: z.boolean().optional(),
    pathRewrite: z.record(z.string()).optional(),
    timeout: z.number().min(1).optional(),
    retries: z.number().min(0).optional(),
  }),
  cache: z.object({
    enabled: z.boolean(),
    ttl: z.number().min(1),
    maxSize: z.number().min(1).optional(),
    keyPrefix: z.string().optional(),
  }),
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema.optional(),
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]),
    format: z.enum(["json", "pretty"]),
    file: z.string().optional(),
  }),
});

/**
 * Default configuration values
 */
export const defaultConfig: Partial<AppConfig> = {
  server: {
    port: 4000,
    host: "0.0.0.0",
    cors: {
      origin: "*",
      credentials: true,
    },
    rateLimit: {
      max: 100,
      timeWindow: "1 minute",
    },
  },
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    keyPrefix: "proxy-stone:",
  },
  logging: {
    level: "info",
    format: "json",
  },
};

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): AppConfig {
  return AppConfigSchema.parse(config);
}

/**
 * Merge configuration with defaults
 */
export function mergeWithDefaults(config: Partial<AppConfig>): AppConfig {
  const merged = {
    ...defaultConfig,
    ...config,
    server: {
      ...defaultConfig.server,
      ...config.server,
    },
    cache: {
      ...defaultConfig.cache,
      ...config.cache,
    },
    logging: {
      ...defaultConfig.logging,
      ...config.logging,
    },
  } as AppConfig;

  return validateConfig(merged);
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<AppConfig> {
  const env = process.env;

  // Use any to avoid TypeScript strict checking for partial config
  const config: any = {};

  // Server configuration
  if (env.PORT || env.HOST) {
    config.server = {};
    if (env.PORT) config.server.port = parseInt(env.PORT, 10);
    if (env.HOST) config.server.host = env.HOST;
  }

  // Proxy configuration
  if (env.PROXY_TARGET) {
    config.proxy = { target: env.PROXY_TARGET };
    if (env.PROXY_TIMEOUT)
      config.proxy.timeout = parseInt(env.PROXY_TIMEOUT, 10);
    if (env.PROXY_RETRIES)
      config.proxy.retries = parseInt(env.PROXY_RETRIES, 10);
  }

  // Database configuration
  config.database = {
    type: (env.DB_TYPE as "sqlite" | "mysql" | "postgresql") || "sqlite",
    database: env.DB_NAME || env.DB_DATABASE || "proxy_stone",
  };
  if (env.DB_HOST) config.database.host = env.DB_HOST;
  if (env.DB_PORT) config.database.port = parseInt(env.DB_PORT, 10);
  if (env.DB_USER || env.DB_USERNAME)
    config.database.username = env.DB_USER || env.DB_USERNAME;
  if (env.DB_PASS || env.DB_PASSWORD)
    config.database.password = env.DB_PASS || env.DB_PASSWORD;
  if (env.DB_FILENAME) config.database.filename = env.DB_FILENAME;

  // Redis configuration
  if (env.REDIS_HOST) {
    config.redis = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : 6379,
    };
    if (env.REDIS_PASSWORD) config.redis.password = env.REDIS_PASSWORD;
    if (env.REDIS_DB) config.redis.db = parseInt(env.REDIS_DB, 10);
  }

  // Cache configuration
  if (env.CACHE_ENABLED !== undefined || env.CACHE_TTL) {
    config.cache = {
      enabled: env.CACHE_ENABLED !== "false",
    };
    if (env.CACHE_TTL) config.cache.ttl = parseInt(env.CACHE_TTL, 10);
  }

  // Logging configuration
  if (env.LOG_LEVEL || env.LOG_FORMAT || env.LOG_FILE) {
    config.logging = {};
    if (env.LOG_LEVEL)
      config.logging.level = env.LOG_LEVEL as
        | "debug"
        | "info"
        | "warn"
        | "error";
    if (env.LOG_FORMAT)
      config.logging.format = env.LOG_FORMAT as "json" | "pretty";
    if (env.LOG_FILE) config.logging.file = env.LOG_FILE;
  }

  return config as Partial<AppConfig>;
}
