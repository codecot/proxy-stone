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

  // Get requests by backend host
  fastify.get(
    '/requests/by-backend/:host',
    async (request: FastifyRequest<{ Params: { host: string } }>, reply) => {
      const logger = getRequestLogger();
      const host = decodeURIComponent(request.params.host);

      // Since we don't have backend_host filter in RequestFilters, we'll get all and filter
      const allRequests = await logger.getRequests({ limit: 1000 });
      const filteredRequests = allRequests.filter((req) => req.backendHost === host);

      return {
        backendHost: host,
        requests: filteredRequests.slice(0, 100), // Limit to 100 for performance
        count: filteredRequests.length,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Get performance analytics
  fastify.get('/requests/analytics/performance', async (request, reply) => {
    const logger = getRequestLogger();
    const recentRequests = await logger.getRequests({ limit: 1000 });

    // Calculate performance metrics
    const responseTimes = recentRequests.map((r) => r.responseTime).filter((rt) => rt > 0);
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const medianResponseTime =
      responseTimes.length > 0
        ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)]
        : 0;

    const percentile95 =
      responseTimes.length > 0
        ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
        : 0;

    // Slowest endpoints
    const slowestRequests = recentRequests
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 10)
      .map((r) => ({
        targetUrl: r.targetUrl,
        responseTime: r.responseTime,
        timestamp: r.timestamp,
        method: r.method,
      }));

    // Performance by backend
    const backendPerformance: Record<string, { count: number; avgTime: number }> = {};
    recentRequests.forEach((req) => {
      if (req.backendHost) {
        if (!backendPerformance[req.backendHost]) {
          backendPerformance[req.backendHost] = { count: 0, avgTime: 0 };
        }
        backendPerformance[req.backendHost].count++;
        backendPerformance[req.backendHost].avgTime += req.responseTime;
      }
    });

    // Calculate averages
    Object.keys(backendPerformance).forEach((host) => {
      const data = backendPerformance[host];
      data.avgTime = Math.round(data.avgTime / data.count);
    });

    return {
      summary: {
        totalRequests: recentRequests.length,
        avgResponseTime: Math.round(avgResponseTime),
        medianResponseTime: Math.round(medianResponseTime),
        percentile95ResponseTime: Math.round(percentile95),
      },
      slowestRequests,
      backendPerformance,
      timestamp: new Date().toISOString(),
    };
  });

  // Get cache analytics
  fastify.get('/requests/analytics/cache', async (request, reply) => {
    const logger = getRequestLogger();
    const recentRequests = await logger.getRequests({ limit: 1000 });

    const cacheHits = recentRequests.filter((r) => r.cacheHit);
    const cacheMisses = recentRequests.filter((r) => !r.cacheHit);
    const hitRate =
      recentRequests.length > 0 ? (cacheHits.length / recentRequests.length) * 100 : 0;

    // Cache performance by TTL
    const ttlAnalysis: Record<string, { hits: number; misses: number; hitRate: number }> = {};
    recentRequests.forEach((req) => {
      const ttlKey = req.cacheTTL ? `${req.cacheTTL}s` : 'no-ttl';
      if (!ttlAnalysis[ttlKey]) {
        ttlAnalysis[ttlKey] = { hits: 0, misses: 0, hitRate: 0 };
      }
      if (req.cacheHit) {
        ttlAnalysis[ttlKey].hits++;
      } else {
        ttlAnalysis[ttlKey].misses++;
      }
    });

    // Calculate hit rates
    Object.keys(ttlAnalysis).forEach((ttl) => {
      const data = ttlAnalysis[ttl];
      const total = data.hits + data.misses;
      data.hitRate = total > 0 ? Math.round((data.hits / total) * 100) : 0;
    });

    // Most cached endpoints
    const cachedEndpoints: Record<string, number> = {};
    cacheHits.forEach((req) => {
      cachedEndpoints[req.targetUrl] = (cachedEndpoints[req.targetUrl] || 0) + 1;
    });

    const topCachedEndpoints = Object.entries(cachedEndpoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    return {
      summary: {
        totalRequests: recentRequests.length,
        cacheHits: cacheHits.length,
        cacheMisses: cacheMisses.length,
        hitRate: Math.round(hitRate * 100) / 100,
      },
      ttlAnalysis,
      topCachedEndpoints,
      cacheTimeSavings: {
        estimatedTimeSaved: cacheHits.reduce((total, req) => {
          // Estimate time saved (assume cache saves 90% of response time)
          return total + req.responseTime * 0.9;
        }, 0),
        requestsServedFromCache: cacheHits.length,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Get data size analytics
  fastify.get('/requests/analytics/data-size', async (request, reply) => {
    const logger = getRequestLogger();
    const recentRequests = await logger.getRequests({ limit: 1000 });

    const requestsWithSize = recentRequests.filter((r) => r.requestSize && r.responseSize);

    if (requestsWithSize.length === 0) {
      return {
        summary: { message: 'No size data available' },
        timestamp: new Date().toISOString(),
      };
    }

    const totalRequestSize = requestsWithSize.reduce((sum, r) => sum + (r.requestSize || 0), 0);
    const totalResponseSize = requestsWithSize.reduce((sum, r) => sum + (r.responseSize || 0), 0);
    const avgRequestSize = totalRequestSize / requestsWithSize.length;
    const avgResponseSize = totalResponseSize / requestsWithSize.length;

    // Largest requests/responses
    const largestRequests = requestsWithSize
      .sort((a, b) => (b.requestSize || 0) - (a.requestSize || 0))
      .slice(0, 10)
      .map((r) => ({
        url: r.targetUrl,
        method: r.method,
        requestSize: r.requestSize,
        responseSize: r.responseSize,
        timestamp: r.timestamp,
      }));

    const largestResponses = requestsWithSize
      .sort((a, b) => (b.responseSize || 0) - (a.responseSize || 0))
      .slice(0, 10)
      .map((r) => ({
        url: r.targetUrl,
        method: r.method,
        requestSize: r.requestSize,
        responseSize: r.responseSize,
        timestamp: r.timestamp,
      }));

    return {
      summary: {
        totalRequests: requestsWithSize.length,
        totalRequestSize: Math.round(totalRequestSize),
        totalResponseSize: Math.round(totalResponseSize),
        avgRequestSize: Math.round(avgRequestSize),
        avgResponseSize: Math.round(avgResponseSize),
        totalDataTransfer: Math.round(totalRequestSize + totalResponseSize),
      },
      largestRequests,
      largestResponses,
      sizeDistribution: {
        smallRequests: requestsWithSize.filter((r) => (r.requestSize || 0) < 1024).length,
        mediumRequests: requestsWithSize.filter(
          (r) => (r.requestSize || 0) >= 1024 && (r.requestSize || 0) < 10240
        ).length,
        largeRequests: requestsWithSize.filter((r) => (r.requestSize || 0) >= 10240).length,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Get error analytics
  fastify.get('/requests/analytics/errors', async (request, reply) => {
    const logger = getRequestLogger();
    const recentRequests = await logger.getRequests({ limit: 1000 });

    const errorRequests = recentRequests.filter((r) => r.statusCode >= 400);
    const serverErrors = errorRequests.filter((r) => r.statusCode >= 500);
    const clientErrors = errorRequests.filter((r) => r.statusCode >= 400 && r.statusCode < 500);

    // Error breakdown by status code
    const errorsByStatus: Record<number, number> = {};
    errorRequests.forEach((req) => {
      errorsByStatus[req.statusCode] = (errorsByStatus[req.statusCode] || 0) + 1;
    });

    // Error breakdown by backend
    const errorsByBackend: Record<string, number> = {};
    errorRequests.forEach((req) => {
      if (req.backendHost) {
        errorsByBackend[req.backendHost] = (errorsByBackend[req.backendHost] || 0) + 1;
      }
    });

    // Most problematic endpoints
    const errorsByEndpoint: Record<string, number> = {};
    errorRequests.forEach((req) => {
      errorsByEndpoint[req.targetUrl] = (errorsByEndpoint[req.targetUrl] || 0) + 1;
    });

    const topErrorEndpoints = Object.entries(errorsByEndpoint)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    // Recent errors with details
    const recentErrors = errorRequests.slice(0, 20).map((r) => ({
      url: r.targetUrl,
      method: r.method,
      statusCode: r.statusCode,
      errorMessage: r.errorMessage,
      timestamp: r.timestamp,
      responseTime: r.responseTime,
    }));

    return {
      summary: {
        totalRequests: recentRequests.length,
        totalErrors: errorRequests.length,
        errorRate:
          recentRequests.length > 0
            ? Math.round((errorRequests.length / recentRequests.length) * 100 * 100) / 100
            : 0,
        serverErrors: serverErrors.length,
        clientErrors: clientErrors.length,
      },
      errorsByStatus,
      errorsByBackend,
      topErrorEndpoints,
      recentErrors,
      timestamp: new Date().toISOString(),
    };
  });
}
