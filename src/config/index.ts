import { ServerConfig, CacheConfig, CacheRule } from '../types/index.js';
import { DatabaseConfig, DatabaseDialect, DatabaseFactory } from '../database/index.js';

// Helper function to parse command line arguments (gets the LAST occurrence to allow overriding)
const getArgValue = (argName: string): string | undefined => {
  const argName_ = `--${argName}`;
  let lastValue: string | undefined = undefined;

  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === argName_ && !process.argv[i + 1].startsWith('--')) {
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
  let dbType = (getArgValue('db-type') || process.env.DB_TYPE || 'sqlite') as DatabaseDialect;

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
    path: getArgValue('db-path') || process.env.DB_PATH || defaults.path,
    // MySQL/PostgreSQL specific
    host: getArgValue('db-host') || process.env.DB_HOST || defaults.host,
    port: Number(getArgValue('db-port') || process.env.DB_PORT) || defaults.port,
    user: getArgValue('db-user') || process.env.DB_USER,
    password: getArgValue('db-password') || process.env.DB_PASSWORD,
    database: getArgValue('db-name') || process.env.DB_NAME,
    // Connection pool settings
    poolMin: Number(getArgValue('db-pool-min') || process.env.DB_POOL_MIN) || defaults.poolMin,
    poolMax: Number(getArgValue('db-pool-max') || process.env.DB_POOL_MAX) || defaults.poolMax,
    poolTimeout:
      Number(getArgValue('db-pool-timeout') || process.env.DB_POOL_TIMEOUT) || defaults.poolTimeout,
  };

  // Validate configuration
  try {
    DatabaseFactory.validateConfig(config);
  } catch (error) {
    console.warn(
      `Database configuration validation failed: ${error instanceof Error ? error.message : error}`
    );
    console.warn('Falling back to SQLite with default configuration');

    // Fallback to SQLite
    const sqliteDefaults = DatabaseFactory.getDefaultConfig(DatabaseDialect.SQLITE);
    return {
      type: DatabaseDialect.SQLITE,
      path: sqliteDefaults.path || './logs/snapshots.db',
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
    console.warn('Invalid cache rules JSON, using defaults:', error);
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
    defaultTTL,
    methods: cacheableMethods,
    rules: [
      // Default rules for common patterns
      {
        pattern: '*/health*',
        methods: ['GET'],
        ttl: 30, // Health endpoints cached for 30 seconds
        enabled: true,
      },
      {
        pattern: '*/search*',
        methods: ['GET', 'POST'],
        ttl: 300, // Search results cached for 5 minutes
        enabled: true,
      },
      {
        pattern: '*/users/*',
        methods: ['GET'],
        ttl: 600, // User data cached for 10 minutes
        enabled: true,
      },
      {
        pattern: '*/config*',
        methods: ['GET'],
        ttl: 3600, // Configuration data cached for 1 hour
        enabled: true,
      },
      ...customRules, // Custom rules take precedence
    ],
    keyOptions: {
      includeHeaders: ['authorization', 'x-user-id', 'x-tenant-id'],
      excludeHeaders: ['user-agent', 'accept-encoding', 'connection'],
      normalizeUrl: true,
      hashLongKeys: true,
      maxKeyLength: 200,
    },
    behavior: {
      warmupEnabled: false,
      backgroundCleanup: true,
      cleanupInterval: 600, // Clean every 10 minutes
      maxSize: 10000, // Maximum 10k cache entries
      evictionPolicy: 'lru',
    },
  };
};

const cliPort = getArgValue('port');
const cliHost = getArgValue('host');
const cliApiPrefix = getArgValue('api-prefix');
const cliTargetUrl = getArgValue('target-url');
const cliCacheTTL = getArgValue('cache-ttl');
const cliCacheableMethods = getArgValue('cacheable-methods');
const cliFileCacheDir = getArgValue('file-cache-dir');
const cliEnableFileCache = getBooleanFlag('enable-file-cache');
const cliRequestLogDbPath = getArgValue('request-log-db');
const cliEnableRequestLogging = getBooleanFlag('enable-request-logging');
const cliSnapshotDbPath = getArgValue('snapshot-db');

// Advanced cache configuration
const cliCacheRules = getArgValue('cache-rules');
const cliCacheMaxSize = getArgValue('cache-max-size');
const cliCacheCleanupInterval = getArgValue('cache-cleanup-interval');
const cliCacheKeyHeaders = getArgValue('cache-key-headers');
const cliEnableCacheWarmup = getBooleanFlag('enable-cache-warmup');

// Redis configuration
const cliRedisEnabled = getBooleanFlag('enable-redis');
const cliRedisHost = getArgValue('redis-host');
const cliRedisPort = getArgValue('redis-port');
const cliRedisPassword = getArgValue('redis-password');
const cliRedisDb = getArgValue('redis-db');
const cliRedisKeyPrefix = getArgValue('redis-key-prefix');

// Database configuration
const databaseConfig = createDatabaseConfig();

const defaultTTL = Number(cliCacheTTL || process.env.CACHE_TTL) || 300;
const cacheableMethods = (cliCacheableMethods || process.env.CACHEABLE_METHODS || 'GET,POST')
  .split(',')
  .map((method) => method.trim().toUpperCase());

// Parse custom cache rules
const customRules = parseCacheRules(cliCacheRules || process.env.CACHE_RULES);

// Parse additional cache key headers
const additionalKeyHeaders = (cliCacheKeyHeaders || process.env.CACHE_KEY_HEADERS || '')
  .split(',')
  .map((header) => header.trim().toLowerCase())
  .filter(Boolean);

export const config: ServerConfig = {
  port: Number(cliPort || process.env.PORT) || 3000,
  host: cliHost || process.env.HOST || '0.0.0.0',
  apiPrefix: cliApiPrefix || process.env.API_PREFIX || '/api',
  targetUrl: cliTargetUrl || process.env.TARGET_URL || 'https://httpbin.org',
  cacheTTL: defaultTTL, // Legacy support
  cacheableMethods: cacheableMethods, // Legacy support
  // Advanced cache configuration
  cache: {
    ...createDefaultCacheConfig(defaultTTL, cacheableMethods, customRules),
    keyOptions: {
      ...createDefaultCacheConfig(defaultTTL, cacheableMethods).keyOptions,
      includeHeaders: [
        ...createDefaultCacheConfig(defaultTTL, cacheableMethods).keyOptions.includeHeaders!,
        ...additionalKeyHeaders,
      ],
    },
    behavior: {
      ...createDefaultCacheConfig(defaultTTL, cacheableMethods).behavior,
      maxSize: Number(cliCacheMaxSize || process.env.CACHE_MAX_SIZE) || 10000,
      cleanupInterval: Number(cliCacheCleanupInterval || process.env.CACHE_CLEANUP_INTERVAL) || 600,
      warmupEnabled: cliEnableCacheWarmup || process.env.ENABLE_CACHE_WARMUP === 'true',
    },
    // Redis configuration
    redis: {
      enabled: cliRedisEnabled || process.env.ENABLE_REDIS === 'true',
      host: cliRedisHost || process.env.REDIS_HOST || 'localhost',
      port: Number(cliRedisPort || process.env.REDIS_PORT) || 6379,
      password: cliRedisPassword || process.env.REDIS_PASSWORD,
      db: Number(cliRedisDb || process.env.REDIS_DB) || 0,
      keyPrefix: cliRedisKeyPrefix || process.env.REDIS_KEY_PREFIX || 'proxy:cache:',
      connectTimeout: 10000,
      lazyConnect: true,
    },
  },
  // File cache configuration
  enableFileCache: cliEnableFileCache || process.env.ENABLE_FILE_CACHE === 'true',
  fileCacheDir: cliFileCacheDir || process.env.FILE_CACHE_DIR || './cache',
  // Request logging configuration
  enableRequestLogging: cliEnableRequestLogging || process.env.ENABLE_REQUEST_LOGGING === 'true',
  requestLogDbPath: cliRequestLogDbPath || process.env.REQUEST_LOG_DB_PATH || './logs/requests.db',
  // Snapshot management configuration (legacy)
  snapshotDbPath: cliSnapshotDbPath || process.env.SNAPSHOT_DB_PATH || './logs/snapshots.db',
  // Multi-database configuration
  database: databaseConfig,
};
