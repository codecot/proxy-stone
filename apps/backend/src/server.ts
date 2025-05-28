import fastify, { type FastifyRequest } from "fastify";
import { config } from "@/config/index.js";
import { corsPlugin } from "@/plugins/cors.js";
import { authPlugin } from "@/plugins/auth.js";
import { formBodyPlugin } from "@/plugins/formbody.js";
import { AppInstance } from "@/types/index.js";
import { DatabaseDialect } from "@/database/types.js";
import ajvFormats from "ajv-formats";
import ajvKeywords from "ajv-keywords";

// Import modules
import { apiRoutes } from "@/modules/proxy/index.js";
import {
  MetricsService,
  RequestLoggerService,
  healthRoutes,
  healthManagementRoutes,
  metricsRoutes,
} from "@/modules/monitoring/index.js";
import { CacheService } from "@/modules/cache/services/cache.js";
import { cacheRoutes } from "@/modules/cache/index.js";
import { AuthService, authRoutes } from "@/modules/auth/index.js";
import {
  RecoveryService,
  ErrorTrackerService,
  SnapshotManager,
} from "@/modules/recovery/index.js";
import { registerCluster } from "@/modules/cluster/index.js";
import { passwordManagerRoutes } from "@/modules/password-manager/routes/api.js";
import { requestRoutes } from "@/modules/proxy/routes/requests.js";

interface RateLimitContext {
  after: string;
  max: number;
  ttl: number;
}

export async function createServer(): Promise<AppInstance> {
  const isProduction = process.env.NODE_ENV === "production";

  const app: AppInstance = fastify({
    logger: {
      level: "info",
      ...(isProduction
        ? {}
        : {
            // Conditional pino-pretty configuration
            transport: {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
                colorize: true,
              },
            },
          }),
    },
    ajv: {
      customOptions: {
        removeAdditional: "all",
        coerceTypes: true,
        useDefaults: true,
        allErrors: true,
      },
      plugins: [
        ajvFormats.default ?? ajvFormats,
        ajvKeywords.default ?? ajvKeywords,
      ],
    },
  });

  // Initialize services
  const cacheService = new CacheService(
    config.cache ?? {
      enabled: true,
      defaultTTL: config.cacheTTL,
      maxSize: 10000,
      rules: [],
      keyOptions: {
        hashLongKeys: true,
        maxKeyLength: 200,
        includeHeaders: [],
      },
    },
    config.fileCacheDir,
    config.enableFileCache
  );

  const requestLoggerService = new RequestLoggerService(
    app,
    config.enableRequestLogging,
    config.requestLogStorage ?? {
      type: "sqlite" as any,
      path: config.requestLogDbPath,
    }
  );

  const snapshotManager = new SnapshotManager(
    app,
    true,
    config.database ?? {
      type: DatabaseDialect.SQLITE,
      path: "./logs/snapshots.db",
    }
  );

  let authService: AuthService | null = null;
  if (config.auth?.enabled && config.auth.jwt?.secret) {
    authService = new AuthService(
      config.auth.hashSalt,
      config.auth.jwt.secret,
      config.auth.jwt.expiresIn ?? "24h",
      config.auth.jwt.issuer ?? "proxy-stone",
      config.auth.maxLoginAttempts,
      config.auth.lockoutDuration
    );
  }

  const metricsService = new MetricsService();
  const recoveryService = new RecoveryService(app);
  const errorTracker = new ErrorTrackerService(app, {
    enabled: process.env.ERROR_TRACKING_ENABLED === "true",
    service:
      (process.env.ERROR_TRACKING_SERVICE as "sentry" | "datadog" | "custom") ||
      "sentry",
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });

  // Decorate the app instance with services
  app.decorate("config", config);
  app.decorate("cache", cacheService);
  app.decorate("requestLogger", requestLoggerService);
  app.decorate("snapshotManager", snapshotManager);
  app.decorate("metrics", metricsService);
  if (authService) {
    app.decorate("authService", authService);
  }
  app.decorate("recovery", recoveryService);
  app.decorate("errorTracker", errorTracker);

  // Initialize services
  await cacheService.initialize();
  await requestLoggerService.initialize();
  await snapshotManager.initialize();
  metricsService.initialize(app);

  // Add metrics hooks
  app.addHook("onRequest", (request, reply, done) => {
    const startTime = Date.now();
    request.metrics = { startTime };
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    if (!request.metrics) {
      done();
      return;
    }
    const duration = (Date.now() - request.metrics.startTime) / 1000;
    metricsService.incrementRequest(
      request.method,
      request.url,
      reply.statusCode
    );
    metricsService.observeRequestDuration(
      request.method,
      request.url,
      duration
    );
    done();
  });

  app.addHook("onError", (request, reply, error, done) => {
    metricsService.incrementError(error.name || "unknown", request.url);
    done();
  });

  // Log configuration
  app.log.info(`Cache TTL: ${config.cacheTTL} seconds`);
  app.log.info(`Cache enabled: ${config.cache?.enabled || true}`);
  app.log.info(`File cache enabled: ${config.enableFileCache}`);
  if (config.enableFileCache) {
    app.log.info(`File cache directory: ${config.fileCacheDir}`);
  }
  app.log.info(`Request logging enabled: ${config.enableRequestLogging}`);
  if (config.enableRequestLogging) {
    const storageConfig = config.requestLogStorage ?? {
      type: "sqlite" as any,
      path: config.requestLogDbPath,
    };
    app.log.info(`Request log storage type: ${storageConfig.type}`);
    if (storageConfig.type === "sqlite") {
      app.log.info(`Request log storage path: ${(storageConfig as any).path}`);
    } else if (storageConfig.type === "local_file") {
      app.log.info(
        `Request log storage directory: ${(storageConfig as any).directory}`
      );
    } else {
      app.log.info(
        `Request log storage host: ${(storageConfig as any).host}:${(storageConfig as any).port}`
      );
      app.log.info(
        `Request log storage database: ${(storageConfig as any).database}`
      );
    }
  }
  app.log.info(`Snapshot management enabled: true`);
  app.log.info(`Database type: ${config.database?.type || "sqlite (legacy)"}`);
  if (config.database?.type === "sqlite" || !config.database) {
    app.log.info(
      `Database path: ${config.database?.path || config.snapshotDbPath}`
    );
  } else {
    app.log.info(
      `Database host: ${config.database.host}:${config.database.port}`
    );
    app.log.info(`Database name: ${config.database.database}`);
  }
  app.log.info(`Authentication enabled: ${config.auth?.enabled || false}`);
  if (config.auth?.enabled) {
    app.log.info(
      `User authentication enabled: ${config.auth.enableUserAuth || false}`
    );
    app.log.info(`API keys configured: ${config.auth.apiKeys.length}`);
    app.log.info(`Protected paths: ${config.auth.protectedPaths.join(", ")}`);
    app.log.info(`JWT support: ${config.auth.jwt ? "enabled" : "disabled"}`);
  }

  // Register plugins
  await app.register(corsPlugin);
  await app.register(import("@fastify/cookie"));

  // Add rate limiting
  await app.register(import("@fastify/rate-limit"), {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (
      request: FastifyRequest,
      context: RateLimitContext
    ) => {
      return {
        error: "Rate Limit Exceeded",
        message: `Too many requests, please try again in ${context.after}`,
        timestamp: new Date().toISOString(),
        requestId: request.id,
        retryAfter: context.after,
      };
    },
  });

  // Add security headers
  await app.register(import("@fastify/helmet"), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  });

  // Add compression
  await app.register(import("@fastify/compress"), {
    global: true,
    threshold: 1024,
    encodings: ["gzip", "deflate"],
    inflateIfDeflated: true,
    customTypes: /^text\/|\+json$|\+text$|\+xml$/,
    removeContentLengthHeader: false,
  });

  await app.register(authPlugin);
  await formBodyPlugin(app);

  // Register routes from modules
  await app.register(healthRoutes); // Basic health endpoints (no prefix)
  await app.register(apiRoutes);
  await app.register(requestRoutes, { prefix: "/api" }); // Request analytics and logging routes
  await app.register(cacheRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(healthManagementRoutes, { prefix: "/api" });
  await app.register(metricsRoutes, { prefix: "/api" });
  await app.register(registerCluster, { prefix: "/api" });
  await app.register(
    async (fastify) => {
      await passwordManagerRoutes(fastify, config.database);
    },
    { prefix: "/api" }
  );

  // Setup cleanup intervals
  setupCleanupIntervals(
    app,
    cacheService,
    snapshotManager,
    requestLoggerService
  );

  // Setup graceful shutdown
  setupGracefulShutdown(
    app,
    cacheService,
    requestLoggerService,
    snapshotManager
  );

  return app;
}

function setupCleanupIntervals(
  app: AppInstance,
  cacheService: CacheService,
  snapshotManager: SnapshotManager,
  requestLoggerService: RequestLoggerService
) {
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
    30 * 60 * 1000
  );

  // Clean old request logs every 24 hours (older than 30 days)
  if (app.config.enableRequestLogging) {
    setInterval(
      async () => {
        const cleared = await requestLoggerService.clearOldRequests(30);
        if (cleared > 0) {
          app.log.info(`Cleaned ${cleared} old request log entries`);
        }
      },
      24 * 60 * 60 * 1000
    );
  }
}

function setupGracefulShutdown(
  app: AppInstance,
  cacheService: CacheService,
  requestLoggerService: RequestLoggerService,
  snapshotManager: SnapshotManager
) {
  const shutdown = async () => {
    app.log.info("Shutting down gracefully...");
    cacheService.shutdown();
    await requestLoggerService.close();
    await snapshotManager.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
