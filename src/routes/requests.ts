import { FastifyInstance, FastifyRequest } from 'fastify';
import { RequestLoggerService, RequestFilters } from '../services/request-logger.js';

interface RequestsQuery {
  method?: string;
  status?: string;
  url?: string;
  cacheHit?: string;
  cacheKey?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: string;
  offset?: string;
}

interface ClearQuery {
  days?: string;
}

export async function requestRoutes(fastify: FastifyInstance) {
  // Get the request logger service from app context
  const getRequestLogger = (): RequestLoggerService => {
    // Type assertion since we'll add this to the app context
    return (fastify as any).requestLogger as RequestLoggerService;
  };

  // Get all requests with optional filtering
  fastify.get(
    '/requests',
    async (request: FastifyRequest<{ Querystring: RequestsQuery }>, reply) => {
      const logger = getRequestLogger();

      const filters: RequestFilters = {};

      // Parse query parameters
      if (request.query.method) {
        filters.method = request.query.method.toUpperCase();
      }

      if (request.query.status) {
        filters.statusCode = parseInt(request.query.status);
      }

      if (request.query.url) {
        filters.url = request.query.url;
      }

      if (request.query.cacheHit) {
        filters.cacheHit = request.query.cacheHit === 'true';
      }

      if (request.query.cacheKey) {
        filters.cacheKey = request.query.cacheKey;
      }

      if (request.query.dateFrom) {
        filters.dateFrom = request.query.dateFrom;
      }

      if (request.query.dateTo) {
        filters.dateTo = request.query.dateTo;
      }

      if (request.query.limit) {
        filters.limit = parseInt(request.query.limit);
      } else {
        filters.limit = 50; // Default limit
      }

      if (request.query.offset) {
        filters.offset = parseInt(request.query.offset);
      }

      const requests = await logger.getRequests(filters);

      return {
        requests,
        pagination: {
          limit: filters.limit,
          offset: filters.offset || 0,
          count: requests.length,
        },
        filters,
      };
    }
  );

  // Get request statistics
  fastify.get('/requests/stats', async (request, reply) => {
    const logger = getRequestLogger();
    const stats = await logger.getStats();

    return {
      stats,
      timestamp: new Date().toISOString(),
    };
  });

  // Get a specific request by ID
  fastify.get(
    '/requests/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const logger = getRequestLogger();
      const id = parseInt(request.params.id);

      if (isNaN(id)) {
        reply.status(400);
        return { error: 'Invalid request ID' };
      }

      // Get requests with a filter for the specific ID (we'll need to modify the service for this)
      const requests = await logger.getRequests({ limit: 1, offset: 0 });
      const specificRequest = requests.find((req) => req.id === id);

      if (!specificRequest) {
        reply.status(404);
        return { error: 'Request not found' };
      }

      return { request: specificRequest };
    }
  );

  // Clear old requests
  fastify.delete(
    '/requests/old',
    async (request: FastifyRequest<{ Querystring: ClearQuery }>, reply) => {
      const logger = getRequestLogger();
      const days = request.query.days ? parseInt(request.query.days, 10) : 30;

      if (isNaN(days) || days < 1) {
        reply.status(400);
        return { error: 'Invalid days parameter' };
      }

      const cleared = await logger.clearOldRequests(days);

      return {
        message: `Cleared ${cleared} requests older than ${days} days`,
        cleared,
        days,
      };
    }
  );

  // Clear all requests
  fastify.delete('/requests/all', async (request, reply) => {
    const logger = getRequestLogger();
    const cleared = await logger.clearAllRequests();

    return {
      message: `Cleared all ${cleared} requests`,
      cleared,
    };
  });

  // Get recent requests (last 100)
  fastify.get('/requests/recent', async (request, reply) => {
    const logger = getRequestLogger();
    const requests = await logger.getRequests({ limit: 100 });

    return {
      requests,
      count: requests.length,
      timestamp: new Date().toISOString(),
    };
  });

  // Get requests by method
  fastify.get(
    '/requests/by-method/:method',
    async (request: FastifyRequest<{ Params: { method: string } }>, reply) => {
      const logger = getRequestLogger();
      const method = request.params.method.toUpperCase();

      const requests = await logger.getRequests({
        method,
        limit: 100,
      });

      return {
        method,
        requests,
        count: requests.length,
      };
    }
  );

  // Get requests by status code
  fastify.get(
    '/requests/by-status/:status',
    async (request: FastifyRequest<{ Params: { status: string } }>, reply) => {
      const logger = getRequestLogger();
      const statusCode = parseInt(request.params.status, 10);

      if (isNaN(statusCode)) {
        reply.status(400);
        return { error: 'Invalid status code' };
      }

      const requests = await logger.getRequests({
        statusCode,
        limit: 100,
      });

      return {
        statusCode,
        requests,
        count: requests.length,
      };
    }
  );

  // Get cache hit vs miss statistics
  fastify.get('/requests/cache-performance', async (request, reply) => {
    const logger = getRequestLogger();

    const cacheHits = await logger.getRequests({ cacheHit: true, limit: 1000 });
    const cacheMisses = await logger.getRequests({ cacheHit: false, limit: 1000 });

    return {
      cacheHits: {
        count: cacheHits.length,
        requests: cacheHits.slice(0, 10), // Show recent 10
      },
      cacheMisses: {
        count: cacheMisses.length,
        requests: cacheMisses.slice(0, 10), // Show recent 10
      },
      hitRate: (cacheHits.length / (cacheHits.length + cacheMisses.length)) * 100,
      timestamp: new Date().toISOString(),
    };
  });

  // Get requests by cache key
  fastify.get(
    '/requests/by-cache-key/:cacheKey',
    async (request: FastifyRequest<{ Params: { cacheKey: string } }>, reply) => {
      const logger = getRequestLogger();
      const cacheKey = request.params.cacheKey;

      const requests = await logger.getRequests({
        cacheKey,
        limit: 100,
      });

      return {
        cacheKey,
        requests,
        count: requests.length,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Get cache file info for a request
  fastify.get(
    '/requests/:id/cache-file',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const logger = getRequestLogger();
      const id = parseInt(request.params.id);

      if (isNaN(id)) {
        reply.status(400);
        return { error: 'Invalid request ID' };
      }

      const cacheKey = await logger.getCacheFileForRequest(id);

      if (!cacheKey) {
        reply.status(404);
        return { error: 'Cache key not found for this request' };
      }

      return {
        requestId: id,
        cacheKey,
        cacheFileName: `cache_${cacheKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`, // Simplified filename
        timestamp: new Date().toISOString(),
      };
    }
  );
}
