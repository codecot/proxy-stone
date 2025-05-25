import fastify from 'fastify';
import { config } from './config/index.js';
import { corsPlugin } from './plugins/cors.js';
import { authPlugin } from './plugins/auth.js';
import { apiRoutes } from './routes/api.js';
import { healthRoutes } from './routes/health.js';
import { requestRoutes } from './routes/requests.js';
import { cacheRoutes } from './routes/cache.js';
import { authRoutes } from './routes/auth.js';
import { AppInstance } from './types/index.js';
import { formBodyPlugin } from './plugins/formbody.js';
import { CacheService } from './services/cache.js';
import { RequestLoggerService } from './services/request-logger.js';
import { SnapshotManager } from './services/snapshot-manager.js';
import { AuthService } from './services/auth-service.js';
import { MetricsService } from './services/metrics.js';
import { RecoveryService } from './services/recovery.js';
import { ErrorTrackerService } from './services/error-tracker.js';
import type { FastifyRequest } from 'fastify';
import ajvFormats from 'ajv-formats';
import ajvKeywords from 'ajv-keywords';

interface RateLimitContext {
  after: string;
  max: number;
  ttl: number;
}

const isProduction = process.env.NODE_ENV === 'production';

const app: AppInstance = fastify({
  logger: {
    level: 'info',
    ...(isProduction
      ? {}
      : {
          // Conditional pino-pretty configuration
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              colorize: true,
            },
          },
        }),
  },
  ajv: {
    customOptions: {
      removeAdditional: 'all',
      coerceTypes: true,
      useDefaults: true,
      allErrors: true,
    },
    plugins: [ajvFormats.default || ajvFormats, ajvKeywords.default || ajvKeywords],
  },
});

// Initialize cache service with file cache support
const cacheService = new CacheService(
  config.cache || {
    defaultTTL: config.cacheTTL,
    methods: config.cacheableMethods,
    rules: [],
    keyOptions: {
      includeHeaders: ['authorization'],
      excludeHeaders: ['user-agent', 'accept-encoding'],
      normalizeUrl: true,
      hashLongKeys: true,
      maxKeyLength: 200,
    },
    behavior: {
      warmupEnabled: true, // Enable cache warmup by default
      backgroundCleanup: true,
      cleanupInterval: 600,
      maxSize: 10000,
      evictionPolicy: 'lru',
    },
  },
  config.fileCacheDir,
  config.enableFileCache
);

// Initialize request logger service
const requestLoggerService = new RequestLoggerService(
  app,
  config.enableRequestLogging,
  config.requestLogDbPath
);

// Initialize snapshot manager service
const snapshotManager = new SnapshotManager(
  app,
  true, // Enable snapshot management
  config.snapshotDbPath // Use snapshot database path
);

// Initialize auth service
let authService: AuthService | null = null;
if (config.auth?.enabled && config.auth.jwt?.secret) {
  authService = new AuthService(
    config.auth.hashSalt,
    config.auth.jwt.secret,
    config.auth.jwt.expiresIn || '24h',
    config.auth.jwt.issuer || 'proxy-stone',
    config.auth.maxLoginAttempts,
    config.auth.lockoutDuration
  );
}

// Initialize metrics service
const metricsService = new MetricsService();

// Initialize recovery service
const recoveryService = new RecoveryService(app);

// Initialize error tracker
const errorTracker = new ErrorTrackerService(app, {
  enabled: process.env.ERROR_TRACKING_ENABLED === 'true',
  service: (process.env.ERROR_TRACKING_SERVICE as 'sentry' | 'datadog' | 'custom') || 'sentry',
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Initialize services
await cacheService.initialize();
await requestLoggerService.initialize();
await snapshotManager.initialize();
metricsService.initialize(app);

// Decorate the app instance with services
app.decorate('config', config);
app.decorate('cache', cacheService);
app.decorate('requestLogger', requestLoggerService);
app.decorate('snapshotManager', snapshotManager);
app.decorate('metrics', metricsService);
if (authService) {
  app.decorate('authService', authService);
}
app.decorate('recovery', recoveryService);
app.decorate('errorTracker', errorTracker);

// Add metrics logging to request lifecycle
app.addHook('onRequest', (request, reply, done) => {
  const startTime = Date.now();
  request.metrics = { startTime };
  done();
});

app.addHook('onResponse', (request, reply, done) => {
  if (!request.metrics) {
    done();
    return;
  }
  const duration = (Date.now() - request.metrics.startTime) / 1000; // Convert to seconds
  metricsService.incrementRequest(request.method, request.url, reply.statusCode);
  metricsService.observeRequestDuration(request.method, request.url, duration);
  done();
});

app.addHook('onError', (request, reply, error, done) => {
  metricsService.incrementError(error.name || 'unknown', request.url);
  done();
});

// Log configuration
app.log.info(`Cache TTL: ${config.cacheTTL} seconds`);
app.log.info(`Cache warmup enabled: ${config.cache?.behavior?.warmupEnabled || false}`);
app.log.info(`File cache enabled: ${config.enableFileCache}`);
if (config.enableFileCache) {
  app.log.info(`File cache directory: ${config.fileCacheDir}`);
}
app.log.info(`Request logging enabled: ${config.enableRequestLogging}`);
if (config.enableRequestLogging) {
  app.log.info(`Request log database: ${config.requestLogDbPath}`);
}
app.log.info(`Snapshot management enabled: true`);
app.log.info(`Database type: ${config.database?.type || 'sqlite (legacy)'}`);
if (config.database?.type === 'sqlite' || !config.database) {
  app.log.info(`Database path: ${config.database?.path || config.snapshotDbPath}`);
} else {
  app.log.info(`Database host: ${config.database.host}:${config.database.port}`);
  app.log.info(`Database name: ${config.database.database}`);
}
app.log.info(`Authentication enabled: ${config.auth?.enabled || false}`);
if (config.auth?.enabled) {
  app.log.info(`User authentication enabled: ${config.auth.enableUserAuth || false}`);
  app.log.info(`API keys configured: ${config.auth.apiKeys.length}`);
  app.log.info(`Protected paths: ${config.auth.protectedPaths.join(', ')}`);
  app.log.info(`JWT support: ${config.auth.jwt ? 'enabled' : 'disabled'}`);
}

// Register plugins
await app.register(corsPlugin);
await app.register(import('@fastify/cookie'));

// Add rate limiting
await app.register(import('@fastify/rate-limit'), {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: (request: FastifyRequest, context: RateLimitContext) => {
    return {
      error: 'Rate Limit Exceeded',
      message: `Too many requests, please try again in ${context.after}`,
      timestamp: new Date().toISOString(),
      requestId: request.id,
      retryAfter: context.after,
    };
  },
});

// Add security headers
await app.register(import('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// Add compression
await app.register(import('@fastify/compress'), {
  global: true,
  threshold: 1024, // Only compress responses larger than 1KB
  encodings: ['gzip', 'deflate'],
  inflateIfDeflated: true,
  customTypes: /^text\/|\+json$|\+text$|\+xml$/,
  removeContentLengthHeader: false,
});

await app.register(authPlugin);
await formBodyPlugin(app);

// Register routes
await app.register(healthRoutes);
await app.register(apiRoutes);
await app.register(requestRoutes, { prefix: '/api' }); // Add request management routes
await app.register(cacheRoutes, { prefix: '/api' }); // Add cache management routes
await app.register(authRoutes, { prefix: '/api' }); // Add auth management routes

// Clean expired cache entries every 10 minutes
setInterval(
  async () => {
    const cleaned = await cacheService.cleanExpired();
    const totalCleaned = cleaned.memory + cleaned.file;
    if (totalCleaned > 0) {
      app.log.info(
        `Cleaned ${totalCleaned} expired cache entries (memory: ${cleaned.memory}, file: ${cleaned.file})`
      );
    }
  },
  10 * 60 * 1000
);

// Clean expired snapshots every 30 minutes
setInterval(
  async () => {
    const cleaned = await snapshotManager.cleanExpired();
    if (cleaned > 0) {
      app.log.info(`Cleaned ${cleaned} expired snapshot metadata entries`);
    }
  },
  30 * 60 * 1000 // 30 minutes
);

// Clean old request logs every 24 hours (older than 30 days)
if (config.enableRequestLogging) {
  setInterval(
    async () => {
      const cleared = await requestLoggerService.clearOldRequests(30);
      if (cleared > 0) {
        app.log.info(`Cleaned ${cleared} old request log entries`);
      }
    },
    24 * 60 * 60 * 1000 // 24 hours
  );
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  app.log.info('Shutting down gracefully...');
  cacheService.shutdown();
  await requestLoggerService.close();
  await snapshotManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('Shutting down gracefully...');
  cacheService.shutdown();
  await requestLoggerService.close();
  await snapshotManager.close();
  process.exit(0);
});

// Start server
try {
  await app.listen({ port: app.config.port, host: app.config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
