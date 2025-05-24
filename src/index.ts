import fastify from 'fastify';
import { config } from './config/index.js';
import { corsPlugin } from './plugins/cors.js';
import { apiRoutes } from './routes/api.js';
import { healthRoutes } from './routes/health.js';
import { requestRoutes } from './routes/requests.js';
import { AppInstance } from './types/index.js';
import { formBodyPlugin } from './plugins/formbody.js';
import { CacheService } from './services/cache.js';
import { RequestLoggerService } from './services/request-logger.js';

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
      warmupEnabled: false,
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
  config.enableRequestLogging,
  config.requestLogDbPath
);

// Initialize services
await cacheService.initialize();
await requestLoggerService.initialize();

// Decorate the app instance with the config, cache, and request logger
app.decorate('config', config);
app.decorate('cache', cacheService);
app.decorate('requestLogger', requestLoggerService);

// Log configuration
app.log.info(`Cache TTL: ${config.cacheTTL} seconds`);
app.log.info(`File cache enabled: ${config.enableFileCache}`);
if (config.enableFileCache) {
  app.log.info(`File cache directory: ${config.fileCacheDir}`);
}
app.log.info(`Request logging enabled: ${config.enableRequestLogging}`);
if (config.enableRequestLogging) {
  app.log.info(`Request log database: ${config.requestLogDbPath}`);
}

// Register plugins
await app.register(corsPlugin);
await formBodyPlugin(app);

// Register routes
await app.register(healthRoutes);
await app.register(apiRoutes);
await app.register(requestRoutes); // Add request management routes

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
  await requestLoggerService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('Shutting down gracefully...');
  await requestLoggerService.close();
  process.exit(0);
});

// Start server
try {
  await app.listen({ port: app.config.port, host: app.config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
