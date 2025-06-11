import {
  ServerConfig,
  CacheConfig,
  CacheRule,
  AuthConfig,
  ApiKey,
} from "@/types/index.js";
import {
  DatabaseConfig,
  DatabaseDialect,
  DatabaseFactory,
  StorageConfig,
} from "@/database/index.js";

// Helper function to parse command line arguments (gets the LAST occurrence to allow overriding)
const getArgValue = (argName: string): string | undefined => {
  const argName_ = `--${argName}`;
  let lastValue: string | undefined = undefined;

  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === argName_ && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
      lastValue = process.argv[i + 1];
    }
  }

  return lastValue;
};

// Helper function to check if a boolean flag is present
const getBooleanFlag = (argName: string): boolean => {
  return process.argv.includes(`--${argName}`);
};

// Helper function to create database configuration
const createDatabaseConfig = (): DatabaseConfig => {
  let dbType = (getArgValue("db-type") ||
    process.env.DB_TYPE ||
    "sqlite") as DatabaseDialect;

  // Validate database type early and fallback to SQLite if invalid
  if (!Object.values(DatabaseDialect).includes(dbType)) {
    console.warn(`Invalid database type '${dbType}', falling back to SQLite`);
    dbType = DatabaseDialect.SQLITE;
  }

  // Get default configuration for the database type
  const defaults = DatabaseFactory.getDefaultConfig(dbType);

  const config: DatabaseConfig = {
    type: dbType,
    // SQLite specific
    path: getArgValue("db-path") || process.env.DB_PATH || defaults.path,
    // MySQL/PostgreSQL specific
    host: getArgValue("db-host") || process.env.DB_HOST || defaults.host,
    port:
      Number(getArgValue("db-port") || process.env.DB_PORT) || defaults.port,
    user: getArgValue("db-user") || process.env.DB_USER,
    password: getArgValue("db-password") || process.env.DB_PASSWORD,
    database: getArgValue("db-name") || process.env.DB_NAME,
    // Connection pool settings
    poolMin:
      Number(getArgValue("db-pool-min") || process.env.DB_POOL_MIN) ||
      defaults.poolMin,
    poolMax:
      Number(getArgValue("db-pool-max") || process.env.DB_POOL_MAX) ||
      defaults.poolMax,
    poolTimeout:
      Number(getArgValue("db-pool-timeout") || process.env.DB_POOL_TIMEOUT) ||
      defaults.poolTimeout,
  };

  // Validate configuration
  try {
    DatabaseFactory.validateConfig(config);
  } catch (error) {
    console.warn(
      `Database configuration validation failed: ${error instanceof Error ? error.message : error}`
    );
    console.warn("Falling back to SQLite with default configuration");

    // Fallback to SQLite
    const sqliteDefaults = DatabaseFactory.getDefaultConfig(
      DatabaseDialect.SQLITE
    );
    return {
      type: DatabaseDialect.SQLITE,
      path: sqliteDefaults.path || "./logs/snapshots.db",
    };
  }

  return config;
};

// Helper function to parse cache rules from JSON string
const parseCacheRules = (rulesJson?: string): CacheRule[] => {
  if (!rulesJson) return [];

  try {
    const rules = JSON.parse(rulesJson);
    return Array.isArray(rules) ? rules : [];
  } catch (error) {
    console.warn("Invalid cache rules JSON, using defaults:", error);
    return [];
  }
};

// Helper function to create default cache configuration
const createDefaultCacheConfig = (
  defaultTTL: number,
  cacheableMethods: string[],
  customRules: CacheRule[] = []
): CacheConfig => {
  return {
    enabled: true,
    defaultTTL,
    maxSize: 10000,
    methods: cacheableMethods,
    rules: [
      // Default rules for common patterns (fixed regex patterns)
      {
        pattern: ".*/health.*",
        methods: ["GET"],
        ttl: 30, // Health endpoints cached for 30 seconds
        enabled: true,
      },
      {
        pattern: ".*/search.*",
        methods: ["GET", "POST"],
        ttl: 300, // Search results cached for 5 minutes
        enabled: true,
      },
      {
        pattern: ".*/users/.*",
        methods: ["GET"],
        ttl: 600, // User data cached for 10 minutes
        enabled: true,
      },
      {
        pattern: ".*/config.*",
        methods: ["GET"],
        ttl: 3600, // Configuration data cached for 1 hour
        enabled: true,
      },
      ...customRules, // Custom rules take precedence
    ],
    keyOptions: {
      hashLongKeys: true,
      maxKeyLength: 200,
      includeHeaders: ["authorization", "x-user-id", "x-tenant-id"],
    },
    behavior: {
      warmupEnabled: false,
      backgroundCleanup: true,
      cleanupInterval: 600,
      maxSize: 10000,
      evictionPolicy: "lru",
    },
    redis: {
      enabled: false,
      host: "localhost",
      port: 6379,
      db: 0,
      prefix: "proxy:cache:",
    },
  };
};

// Helper function to parse API keys from JSON string
const parseApiKeys = (apiKeysJson?: string): ApiKey[] => {
  if (!apiKeysJson) return [];

  try {
    const keys = JSON.parse(apiKeysJson);
    return Array.isArray(keys) ? keys : [];
  } catch (error) {
    console.warn("Invalid API keys JSON, using defaults:", error);
    return [];
  }
};

// Helper function to create default auth configuration
const createDefaultAuthConfig = (): AuthConfig => {
  return {
    enabled: false, // Disabled by default
    apiKeys: [], // No default API keys
    users: [], // No default users
    enableUserAuth: false, // User auth disabled by default
    sessionTTL: 86400, // 24 hours (legacy, not used with JWT)
    hashSalt: process.env.AUTH_SALT || "default-salt-change-in-production",
    maxLoginAttempts: 5,
    lockoutDuration: 900, // 15 minutes
    protectedPaths: [
      "/api/cache*",
      "/api/metrics*",
      "/api/requests*",
      "/api/snapshots*",
    ], // Default protected paths
  };
};

// Helper function to create request logging storage configuration
const createRequestLogStorageConfig = (): StorageConfig => {
  const cliRequestLogStorageType = getArgValue("request-log-storage-type");
  const cliRequestLogStorageHost = getArgValue("request-log-storage-host");
  const cliRequestLogStoragePort = getArgValue("request-log-storage-port");
  const cliRequestLogStorageDatabase = getArgValue(
    "request-log-storage-database"
  );
  const cliRequestLogStorageUser = getArgValue("request-log-storage-user");
  const cliRequestLogStoragePassword = getArgValue(
    "request-log-storage-password"
  );

  const storageType =
    cliRequestLogStorageType ||
    process.env.REQUEST_LOG_STORAGE_TYPE ||
    "sqlite";

  switch (storageType.toLowerCase()) {
    case "sqlite":
      return {
        type: "sqlite" as any,
        path:
          cliRequestLogDbPath ||
          process.env.REQUEST_LOG_DB_PATH ||
          "./logs/requests.db",
      };

    case "mysql":
      return {
        type: "mysql" as any,
        host:
          cliRequestLogStorageHost ||
          process.env.REQUEST_LOG_STORAGE_HOST ||
          "localhost",
        port:
          Number(
            cliRequestLogStoragePort || process.env.REQUEST_LOG_STORAGE_PORT
          ) || 3306,
        database:
          cliRequestLogStorageDatabase ||
          process.env.REQUEST_LOG_STORAGE_DATABASE ||
          "proxy_stone_logs",
        user:
          cliRequestLogStorageUser ||
          process.env.REQUEST_LOG_STORAGE_USER ||
          "root",
        password:
          cliRequestLogStoragePassword ||
          process.env.REQUEST_LOG_STORAGE_PASSWORD,
        poolMin: 1,
        poolMax: 10,
      };

    case "postgresql":
      return {
        type: "postgresql" as any,
        host:
          cliRequestLogStorageHost ||
          process.env.REQUEST_LOG_STORAGE_HOST ||
          "localhost",
        port:
          Number(
            cliRequestLogStoragePort || process.env.REQUEST_LOG_STORAGE_PORT
          ) || 5432,
        database:
          cliRequestLogStorageDatabase ||
          process.env.REQUEST_LOG_STORAGE_DATABASE ||
          "proxy_stone_logs",
        user:
          cliRequestLogStorageUser ||
          process.env.REQUEST_LOG_STORAGE_USER ||
          "postgres",
        password:
          cliRequestLogStoragePassword ||
          process.env.REQUEST_LOG_STORAGE_PASSWORD,
        poolMin: 1,
        poolMax: 10,
      };

    case "local_file":
      return {
        type: "local_file" as any,
        directory:
          cliRequestLogDbPath?.replace(".db", "_files") ||
          process.env.REQUEST_LOG_STORAGE_DIR ||
          "./logs/requests_files",
      };

    default:
      console.warn(
        `Unknown request log storage type: ${storageType}, falling back to SQLite`
      );
      return {
        type: "sqlite" as any,
        path:
          cliRequestLogDbPath ||
          process.env.REQUEST_LOG_DB_PATH ||
          "./logs/requests.db",
      };
  }
};

const cliPort = getArgValue("port");
const cliHost = getArgValue("host");
const cliApiPrefix = getArgValue("api-prefix");
const cliTargetUrl = getArgValue("target-url");
const cliCacheTTL = getArgValue("cache-ttl");
const cliCacheableMethods = getArgValue("cacheable-methods");
const cliFileCacheDir = getArgValue("file-cache-dir");
const cliEnableFileCache = getBooleanFlag("enable-file-cache");
const cliRequestLogDbPath = getArgValue("request-log-db");
const cliEnableRequestLogging = getBooleanFlag("enable-request-logging");
const cliSnapshotDbPath = getArgValue("snapshot-db");

// Advanced cache configuration
const cliCacheRules = getArgValue("cache-rules");
const cliCacheMaxSize = getArgValue("cache-max-size");
const cliCacheCleanupInterval = getArgValue("cache-cleanup-interval");
const cliCacheKeyHeaders = getArgValue("cache-key-headers");
const cliEnableCacheWarmup = getBooleanFlag("enable-cache-warmup");

// Redis configuration
const cliRedisEnabled = getBooleanFlag("enable-redis");
const cliRedisHost = getArgValue("redis-host");
const cliRedisPort = getArgValue("redis-port");
const cliRedisPassword = getArgValue("redis-password");
const cliRedisDb = getArgValue("redis-db");
const cliRedisKeyPrefix = getArgValue("redis-key-prefix");

// Auth configuration
const cliAuthEnabled = getBooleanFlag("enable-auth");
const cliUserAuthEnabled = getBooleanFlag("enable-user-auth");
const cliApiKeys = getArgValue("api-keys");
const cliJwtSecret = getArgValue("jwt-secret");
const cliAuthProtectedPaths = getArgValue("auth-protected-paths");

// Cluster configuration
const cliClusterEnabled = getBooleanFlag("enable-cluster");
const cliClusterIp = getArgValue("cluster-ip");
const cliClusterPort = getArgValue("cluster-port");
const cliClusterId = getArgValue("cluster-id");
const cliNodeId = getArgValue("node-id");
const cliClusterHeartbeat = getArgValue("cluster-heartbeat");
const cliClusterTimeout = getArgValue("cluster-timeout");

// Database configuration
const databaseConfig = createDatabaseConfig();

const defaultTTL = Number(cliCacheTTL || process.env.CACHE_TTL) || 300;
const cacheableMethods = (
  cliCacheableMethods ||
  process.env.CACHEABLE_METHODS ||
  "GET,POST"
)
  .split(",")
  .map((method) => method.trim().toUpperCase());

// Parse custom cache rules
const customRules = parseCacheRules(cliCacheRules || process.env.CACHE_RULES);

// Parse additional cache key headers
const additionalKeyHeaders = (
  cliCacheKeyHeaders ||
  process.env.CACHE_KEY_HEADERS ||
  ""
)
  .split(",")
  .map((header) => header.trim().toLowerCase())
  .filter(Boolean);

// Parse API keys
const apiKeys = parseApiKeys(cliApiKeys || process.env.API_KEYS);

// Parse protected paths
const protectedPaths = (
  cliAuthProtectedPaths ||
  process.env.AUTH_PROTECTED_PATHS ||
  ""
)
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

export const config: ServerConfig = {
  port: Number(cliPort || process.env.PORT) || 3000,
  host: cliHost || process.env.HOST || "0.0.0.0",
  apiPrefix: cliApiPrefix || process.env.API_PREFIX || "/proxy",
  targetUrl: cliTargetUrl || process.env.TARGET_URL || "https://httpbin.org",
  cacheTTL: defaultTTL, // Legacy support
  cacheableMethods, // Legacy support
  // Advanced cache configuration
  cache: {
    ...createDefaultCacheConfig(defaultTTL, cacheableMethods, customRules),
    maxSize: Number(cliCacheMaxSize || process.env.CACHE_MAX_SIZE) || 10000,
    keyOptions: {
      ...createDefaultCacheConfig(defaultTTL, cacheableMethods).keyOptions,
      includeHeaders: [
        ...createDefaultCacheConfig(defaultTTL, cacheableMethods).keyOptions
          .includeHeaders!,
        ...additionalKeyHeaders,
      ],
    },
    behavior: {
      ...createDefaultCacheConfig(defaultTTL, cacheableMethods).behavior,
      warmupEnabled:
        cliEnableCacheWarmup || process.env.ENABLE_CACHE_WARMUP === "true",
      cleanupInterval:
        Number(cliCacheCleanupInterval || process.env.CACHE_CLEANUP_INTERVAL) ||
        600,
    },
    // Redis configuration
    redis: {
      enabled: cliRedisEnabled || process.env.ENABLE_REDIS === "true",
      host: cliRedisHost || process.env.REDIS_HOST || "localhost",
      port: Number(cliRedisPort || process.env.REDIS_PORT) || 6379,
      password: cliRedisPassword || process.env.REDIS_PASSWORD,
      db: Number(cliRedisDb || process.env.REDIS_DB) || 0,
      prefix:
        cliRedisKeyPrefix || process.env.REDIS_KEY_PREFIX || "proxy:cache:",
    },
  },
  // File cache configuration
  enableFileCache:
    cliEnableFileCache || process.env.ENABLE_FILE_CACHE === "true",
  fileCacheDir: cliFileCacheDir || process.env.FILE_CACHE_DIR || "./cache",
  // Request logging configuration
  enableRequestLogging:
    cliEnableRequestLogging || process.env.ENABLE_REQUEST_LOGGING === "true",
  requestLogDbPath:
    cliRequestLogDbPath ||
    process.env.REQUEST_LOG_DB_PATH ||
    "./logs/requests.db",
  requestLogStorage: createRequestLogStorageConfig(),
  // Snapshot management configuration (legacy)
  snapshotDbPath:
    cliSnapshotDbPath || process.env.SNAPSHOT_DB_PATH || "./logs/snapshots.db",
  // Multi-database configuration
  database: databaseConfig,
  // Auth configuration
  auth: (() => {
    const authEnabled = cliAuthEnabled || process.env.ENABLE_AUTH === "true";
    const userAuthEnabled =
      cliUserAuthEnabled || process.env.ENABLE_USER_AUTH === "true";
    const jwtSecret = cliJwtSecret || process.env.JWT_SECRET;

    // If auth is enabled but no JWT secret is provided, warn and disable auth
    if (authEnabled && !jwtSecret) {
      console.warn(
        "⚠️  Authentication enabled but no JWT_SECRET provided. Auth will be disabled."
      );
      console.warn(
        "   Set JWT_SECRET environment variable or --jwt-secret CLI argument."
      );
      return {
        ...createDefaultAuthConfig(),
        enabled: false,
      };
    }

    const config = {
      ...createDefaultAuthConfig(),
      enabled: authEnabled,
      enableUserAuth: userAuthEnabled, // Enable user auth separately
      apiKeys: apiKeys.length > 0 ? apiKeys : createDefaultAuthConfig().apiKeys,
      protectedPaths:
        protectedPaths.length > 0
          ? protectedPaths
          : createDefaultAuthConfig().protectedPaths,
      jwt: jwtSecret
        ? {
            secret: jwtSecret,
            issuer: process.env.JWT_ISSUER || "proxy-stone",
            expiresIn: process.env.JWT_EXPIRES_IN || "24h",
          }
        : undefined,
    };

    return config;
  })(),
  // Cluster configuration
  cluster: {
    enabled: cliClusterEnabled || process.env.ENABLE_CLUSTER !== "false", // Default enabled
    clusterId: cliClusterId || process.env.CLUSTER_ID || "default-cluster",
    nodeId: cliNodeId || process.env.NODE_ID, // Auto-generated if not provided
    coordinatorUrl: cliClusterIp ? 
      `http://${cliClusterIp}${cliClusterPort ? `:${cliClusterPort}` : ''}` : 
      process.env.CLUSTER_COORDINATOR_URL,
    heartbeatInterval: Number(cliClusterHeartbeat || process.env.CLUSTER_HEARTBEAT_INTERVAL) || 30,
    nodeTimeout: Number(cliClusterTimeout || process.env.CLUSTER_NODE_TIMEOUT) || 60,
    healthCheckInterval: 10,
    autoRegister: true,
    defaultRole: "worker" as const,
    tags: [],
    storage: { type: "memory" as const },
  },
};
