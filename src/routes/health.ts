import type { FastifyInstance } from 'fastify';
import { HealthService } from '../services/health.js';

export async function healthRoutes(fastify: FastifyInstance) {
  const healthService = new HealthService(fastify);

  // Basic health check
  fastify.get('/health', async (request, reply) => {
    const status = await healthService.getHealthStatus();
    reply.status(status.status === 'ok' ? 200 : 503);
    return status;
  });

  // Detailed health check with metrics
  fastify.get('/health/detailed', async (request, reply) => {
    const status = await healthService.getHealthStatus();
    reply.status(status.status === 'ok' ? 200 : 503);
    return {
      ...status,
      metrics: {
        ...status.metrics,
        prometheus: await fastify.metrics?.getMetrics(),
      },
    };
  });

  // Liveness probe for Kubernetes
  fastify.get('/health/live', async (request, reply) => {
    const status = await healthService.getHealthStatus();
    reply.status(status.status === 'ok' ? 200 : 503);
    return { status: status.status };
  });

  // Readiness probe for Kubernetes
  fastify.get('/health/ready', async (request, reply) => {
    const status = await healthService.getHealthStatus();
    const isReady =
      status.status === 'ok' &&
      Object.values(status.services).every((service) => service.status === 'ok');
    reply.status(isReady ? 200 : 503);
    return {
      status: isReady ? 'ready' : 'not ready',
      services: status.services,
    };
  });

  // Cache configuration debug endpoint
  fastify.get('/debug/config', async (request, reply) => {
    const cacheConfig = fastify.cache.getConfig();

    return {
      config: {
        enableFileCache: fastify.config.enableFileCache,
        fileCacheDir: fastify.config.fileCacheDir,
        cacheTTL: fastify.config.cacheTTL, // Legacy
        cacheableMethods: fastify.config.cacheableMethods, // Legacy
        enableRequestLogging: fastify.config.enableRequestLogging,
        requestLogDbPath: fastify.config.requestLogDbPath,
        // Enhanced cache configuration
        cache: cacheConfig,
      },
      cache: await fastify.cache.getStats(),
    };
  });

  // Cache rules endpoint
  fastify.get('/cache/rules', async (request, reply) => {
    const config = fastify.cache.getConfig();
    return {
      rules: config.rules,
      keyOptions: config.keyOptions,
      behavior: config.behavior,
    };
  });

  // Test cache rule matching endpoint
  fastify.post('/cache/test-rule', async (request, reply) => {
    const { method = 'GET', url = '', headers = {} } = request.body as any;
    const cacheKey = fastify.cache.generateKey(method, url, headers);

    return {
      cacheKey,
      keyLength: cacheKey.length,
      isHashedKey: cacheKey.includes('#'),
      testUrl: url,
      testMethod: method,
      testHeaders: headers,
    };
  });

  // Clear cache endpoint
  fastify.delete('/cache', async (request, reply) => {
    const cleared = await fastify.cache.clear();

    return {
      message: 'Cache cleared successfully',
      cleared,
    };
  });

  // Clean expired cache entries endpoint
  fastify.post('/cache/clean', async (request, reply) => {
    const cleaned = await fastify.cache.cleanExpired();
    const totalCleaned = cleaned.memory + cleaned.file;

    return {
      message: `Cleaned ${totalCleaned} expired cache entries`,
      cleaned,
    };
  });

  // Redis health endpoint
  fastify.get('/cache/redis/health', async (request, reply) => {
    const redisConfig = fastify.cache.getConfig().redis;

    if (!redisConfig?.enabled) {
      return {
        status: 'disabled',
        message: 'Redis cache is not enabled',
      };
    }

    try {
      const stats = await fastify.cache.getStats();
      const redisStats = stats.redis;

      if (redisStats?.connected) {
        return {
          status: 'healthy',
          latency: redisStats.latency,
          connected: true,
          memory: redisStats.memory,
          keys: redisStats.keys,
          config: {
            host: redisConfig.host,
            port: redisConfig.port,
            db: redisConfig.db,
            keyPrefix: redisConfig.keyPrefix,
          },
        };
      } else {
        return {
          status: 'unhealthy',
          connected: false,
          error: 'Redis connection not available',
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  });

  // Redis ping endpoint
  fastify.get('/cache/redis/ping', async (request, reply) => {
    const redisConfig = fastify.cache.getConfig().redis;

    if (!redisConfig?.enabled) {
      reply.status(503);
      return {
        success: false,
        message: 'Redis cache is not enabled',
      };
    }

    try {
      const stats = await fastify.cache.getStats();
      const redisStats = stats.redis;

      if (redisStats?.connected && redisStats.latency !== undefined) {
        return {
          success: true,
          latency: redisStats.latency,
          timestamp: new Date().toISOString(),
        };
      } else {
        reply.status(503);
        return {
          success: false,
          message: 'Redis connection not available',
        };
      }
    } catch (error) {
      reply.status(503);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Redis ping failed',
      };
    }
  });

  // Clear Redis cache only
  fastify.delete('/cache/redis', async (request, reply) => {
    const redisConfig = fastify.cache.getConfig().redis;

    if (!redisConfig?.enabled) {
      reply.status(503);
      return {
        success: false,
        message: 'Redis cache is not enabled',
      };
    }

    try {
      const cleared = await fastify.cache.clear();

      return {
        success: true,
        message: `Cleared ${cleared.redis} Redis cache entries`,
        cleared: {
          redis: cleared.redis,
        },
      };
    } catch (error) {
      reply.status(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear Redis cache',
      };
    }
  });
}
