import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const cacheStats = await fastify.cache.getStats();

    return {
      status: 'ok',
      cache: cacheStats,
    };
  });

  // Cache configuration debug endpoint
  fastify.get('/debug/config', async (request, reply) => {
    return {
      config: {
        enableFileCache: fastify.config.enableFileCache,
        fileCacheDir: fastify.config.fileCacheDir,
        cacheTTL: fastify.config.cacheTTL,
        cacheableMethods: fastify.config.cacheableMethods,
        enableRequestLogging: fastify.config.enableRequestLogging,
        requestLogDbPath: fastify.config.requestLogDbPath,
      },
      cache: await fastify.cache.getStats(),
    };
  });

  // Cache statistics endpoint
  fastify.get('/cache/stats', async (request, reply) => {
    return await fastify.cache.getStats();
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
