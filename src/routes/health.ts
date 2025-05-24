import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const cacheStats = await fastify.cache.getStats();

    return {
      status: 'ok',
      cache: cacheStats,
      config: {
        enableFileCache: fastify.config.enableFileCache,
        enableRequestLogging: fastify.config.enableRequestLogging,
      },
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

  // Enhanced cache statistics endpoint
  fastify.get('/cache/stats', async (request, reply) => {
    const stats = await fastify.cache.getStats();
    const config = fastify.cache.getConfig();

    return {
      ...stats,
      config: {
        defaultTTL: config.defaultTTL,
        methods: config.methods,
        totalRules: config.rules.length,
        keyOptions: config.keyOptions,
        behavior: config.behavior,
      },
      rules: config.rules.map((rule) => ({
        pattern: rule.pattern,
        methods: rule.methods,
        ttl: rule.ttl,
        enabled: rule.enabled,
        hasConditions: !!rule.conditions,
      })),
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
}
