import { ServerConfig } from '../types/index.js';

// Helper function to parse command line arguments
const getArgValue = (argName: string): string | undefined => {
  const argIndex = process.argv.findIndex((arg) => arg === `--${argName}`);
  // Check if the flag exists and there is a value after it,
  // and that the value is not another flag itself.
  if (
    argIndex > -1 &&
    process.argv.length > argIndex + 1 &&
    !process.argv[argIndex + 1].startsWith('--')
  ) {
    return process.argv[argIndex + 1];
  }
  return undefined;
};

// Helper function to check if a boolean flag is present
const getBooleanFlag = (argName: string): boolean => {
  return process.argv.includes(`--${argName}`);
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

export const config: ServerConfig = {
  port: Number(cliPort || process.env.PORT) || 3000,
  host: cliHost || process.env.HOST || '0.0.0.0',
  apiPrefix: cliApiPrefix || process.env.API_PREFIX || '/api',
  targetUrl: cliTargetUrl || process.env.TARGET_URL || 'https://httpbin.org',
  cacheTTL: Number(cliCacheTTL || process.env.CACHE_TTL) || 300, // 5 minutes default
  cacheableMethods: (cliCacheableMethods || process.env.CACHEABLE_METHODS || 'GET,POST')
    .split(',')
    .map((method) => method.trim().toUpperCase()),
  // File cache configuration
  enableFileCache: cliEnableFileCache || process.env.ENABLE_FILE_CACHE === 'true',
  fileCacheDir: cliFileCacheDir || process.env.FILE_CACHE_DIR || './cache',
  // Request logging configuration
  enableRequestLogging: cliEnableRequestLogging || process.env.ENABLE_REQUEST_LOGGING === 'true',
  requestLogDbPath: cliRequestLogDbPath || process.env.REQUEST_LOG_DB_PATH || './logs/requests.db',
};
