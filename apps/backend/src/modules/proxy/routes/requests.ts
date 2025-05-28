import { FastifyInstance, FastifyRequest } from "fastify";
import {
  RequestLoggerService,
  RequestFilters,
} from "@/modules/monitoring/services/request-logger.js";
import { createErrorResponse } from "@/utils/response.js";

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

/**
 * Safe wrapper for request logger operations that never throws
 */
async function safeLoggerOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  logger: any,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`${operationName} failed:`, error);
    return fallback;
  }
}

export async function requestRoutes(fastify: FastifyInstance) {
  // Get the request logger service from app context
  const getRequestLogger = (): RequestLoggerService => {
    // Type assertion since we'll add this to the app context
    return (fastify as any).requestLogger as RequestLoggerService;
  };

  // Error handler for route-level errors
  const handleRouteError = (error: unknown, reply: any, operation: string) => {
    fastify.log.error(`Request logging route error [${operation}]:`, error);
    reply.status(500);
    return createErrorResponse(error);
  };

  // Get all requests with optional filtering
  fastify.get(
    "/requests",
    async (request: FastifyRequest<{ Querystring: RequestsQuery }>, reply) => {
      try {
        const logger = getRequestLogger();

        const filters: RequestFilters = {};

        // Safe parameter parsing
        try {
          if (request.query.method) {
            filters.method = request.query.method.toUpperCase();
          }

          if (request.query.status) {
            const statusCode = parseInt(request.query.status);
            if (!isNaN(statusCode)) {
              filters.statusCode = statusCode;
            }
          }

          if (request.query.url) {
            filters.url = request.query.url;
          }

          if (request.query.cacheHit) {
            filters.cacheHit = request.query.cacheHit === "true";
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
            const limit = parseInt(request.query.limit);
            filters.limit =
              !isNaN(limit) && limit > 0 ? Math.min(limit, 1000) : 50; // Cap at 1000
          } else {
            filters.limit = 50; // Default limit
          }

          if (request.query.offset) {
            const offset = parseInt(request.query.offset);
            filters.offset = !isNaN(offset) && offset >= 0 ? offset : 0;
          }
        } catch (error) {
          fastify.log.warn("Failed to parse query parameters:", error);
          // Continue with default filters
        }

        const requests = await safeLoggerOperation(
          () => logger.getRequests(filters),
          [],
          fastify.log,
          "getRequests"
        );

        return {
          requests,
          pagination: {
            limit: filters.limit,
            offset: filters.offset || 0,
            count: requests.length,
          },
          filters,
        };
      } catch (error) {
        return handleRouteError(error, reply, "get-requests");
      }
    }
  );

  // Get request statistics
  fastify.get("/requests/stats", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const stats = await safeLoggerOperation(
        () => logger.getStats(),
        {
          totalRequests: 0,
          cacheHitRate: 0,
          avgResponseTime: 0,
          requestsByMethod: {},
          requestsByStatus: {},
          topUrls: [],
          topCacheKeys: [],
        },
        fastify.log,
        "getStats"
      );

      return {
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleRouteError(error, reply, "get-stats");
    }
  });

  // Get a specific request by ID
  fastify.get(
    "/requests/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const logger = getRequestLogger();
        const id = request.params.id;

        if (!id || id.trim().length === 0) {
          reply.status(400);
          return { error: "Invalid request ID" };
        }

        // Get requests with a filter for the specific ID
        const requests = await safeLoggerOperation(
          () => logger.getRequests({ limit: 1000 }), // Get more to find the specific ID
          [],
          fastify.log,
          "getRequestById"
        );

        const specificRequest = requests.find((req) => req.id === id);

        if (!specificRequest) {
          reply.status(404);
          return { error: "Request not found" };
        }

        return { request: specificRequest };
      } catch (error) {
        return handleRouteError(error, reply, "get-request-by-id");
      }
    }
  );

  // Clear old requests
  fastify.delete(
    "/requests/old",
    async (request: FastifyRequest<{ Querystring: ClearQuery }>, reply) => {
      try {
        const logger = getRequestLogger();
        let days = 30;

        try {
          if (request.query.days) {
            const parsedDays = parseInt(request.query.days, 10);
            if (!isNaN(parsedDays) && parsedDays >= 1 && parsedDays <= 365) {
              days = parsedDays;
            }
          }
        } catch (error) {
          fastify.log.warn("Invalid days parameter, using default:", error);
        }

        const cleared = await safeLoggerOperation(
          () => logger.clearOldRequests(days),
          0,
          fastify.log,
          "clearOldRequests"
        );

        return {
          message: `Cleared ${cleared} requests older than ${days} days`,
          cleared,
          days,
        };
      } catch (error) {
        return handleRouteError(error, reply, "clear-old-requests");
      }
    }
  );

  // Clear all requests
  fastify.delete("/requests/all", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const cleared = await safeLoggerOperation(
        () => logger.clearAllRequests(),
        0,
        fastify.log,
        "clearAllRequests"
      );

      return {
        message: `Cleared all ${cleared} requests`,
        cleared,
      };
    } catch (error) {
      return handleRouteError(error, reply, "clear-all-requests");
    }
  });

  // Get recent requests (last 100)
  fastify.get("/requests/recent", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const requests = await safeLoggerOperation(
        () => logger.getRequests({ limit: 100 }),
        [],
        fastify.log,
        "getRecentRequests"
      );

      return {
        requests,
        count: requests.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleRouteError(error, reply, "get-recent-requests");
    }
  });

  // Get requests by method
  fastify.get(
    "/requests/by-method/:method",
    async (request: FastifyRequest<{ Params: { method: string } }>, reply) => {
      try {
        const logger = getRequestLogger();
        const method = request.params.method.toUpperCase();

        // Validate HTTP method
        const validMethods = [
          "GET",
          "POST",
          "PUT",
          "DELETE",
          "PATCH",
          "HEAD",
          "OPTIONS",
        ];
        if (!validMethods.includes(method)) {
          reply.status(400);
          return { error: "Invalid HTTP method" };
        }

        const requests = await safeLoggerOperation(
          () => logger.getRequests({ method, limit: 100 }),
          [],
          fastify.log,
          "getRequestsByMethod"
        );

        return {
          method,
          requests,
          count: requests.length,
        };
      } catch (error) {
        return handleRouteError(error, reply, "get-requests-by-method");
      }
    }
  );

  // Get requests by status code
  fastify.get(
    "/requests/by-status/:status",
    async (request: FastifyRequest<{ Params: { status: string } }>, reply) => {
      try {
        const logger = getRequestLogger();
        const statusCode = parseInt(request.params.status, 10);

        if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
          reply.status(400);
          return { error: "Invalid status code" };
        }

        const requests = await safeLoggerOperation(
          () => logger.getRequests({ statusCode, limit: 100 }),
          [],
          fastify.log,
          "getRequestsByStatus"
        );

        return {
          statusCode,
          requests,
          count: requests.length,
        };
      } catch (error) {
        return handleRouteError(error, reply, "get-requests-by-status");
      }
    }
  );

  // Get cache hit vs miss statistics
  fastify.get("/requests/cache-performance", async (request, reply) => {
    try {
      const logger = getRequestLogger();

      const [cacheHits, cacheMisses] = await Promise.all([
        safeLoggerOperation(
          () => logger.getRequests({ cacheHit: true, limit: 1000 }),
          [],
          fastify.log,
          "getCacheHits"
        ),
        safeLoggerOperation(
          () => logger.getRequests({ cacheHit: false, limit: 1000 }),
          [],
          fastify.log,
          "getCacheMisses"
        ),
      ]);

      const totalRequests = cacheHits.length + cacheMisses.length;
      const hitRate =
        totalRequests > 0 ? (cacheHits.length / totalRequests) * 100 : 0;

      return {
        cacheHits: {
          count: cacheHits.length,
          requests: cacheHits.slice(0, 10), // Show recent 10
        },
        cacheMisses: {
          count: cacheMisses.length,
          requests: cacheMisses.slice(0, 10), // Show recent 10
        },
        hitRate: Math.round(hitRate * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleRouteError(error, reply, "get-cache-performance");
    }
  });

  // Get requests by cache key
  fastify.get(
    "/requests/by-cache-key/:cacheKey",
    async (
      request: FastifyRequest<{ Params: { cacheKey: string } }>,
      reply
    ) => {
      try {
        const logger = getRequestLogger();
        const cacheKey = request.params.cacheKey;

        if (!cacheKey || cacheKey.trim().length === 0) {
          reply.status(400);
          return { error: "Invalid cache key" };
        }

        const requests = await safeLoggerOperation(
          () => logger.getRequests({ cacheKey, limit: 100 }),
          [],
          fastify.log,
          "getRequestsByCacheKey"
        );

        return {
          cacheKey,
          requests,
          count: requests.length,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return handleRouteError(error, reply, "get-requests-by-cache-key");
      }
    }
  );

  // Get cache file info for a request
  fastify.get(
    "/requests/:id/cache-file",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const logger = getRequestLogger();
        const id = parseInt(request.params.id);

        if (isNaN(id) || id <= 0) {
          reply.status(400);
          return { error: "Invalid request ID" };
        }

        const cacheKey = await safeLoggerOperation(
          () => logger.getCacheFileForRequest(id.toString()),
          null,
          fastify.log,
          "getCacheFileForRequest"
        );

        if (!cacheKey) {
          reply.status(404);
          return { error: "Cache key not found for this request" };
        }

        return {
          requestId: id,
          cacheKey,
          cacheFileName: `cache_${cacheKey.replace(/[^a-zA-Z0-9]/g, "_")}.json`, // Simplified filename
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return handleRouteError(error, reply, "get-cache-file-for-request");
      }
    }
  );

  // Get requests by backend host
  fastify.get(
    "/requests/by-backend/:host",
    async (request: FastifyRequest<{ Params: { host: string } }>, reply) => {
      try {
        const logger = getRequestLogger();
        let host: string;

        try {
          host = decodeURIComponent(request.params.host);
        } catch (error) {
          reply.status(400);
          return { error: "Invalid backend host parameter" };
        }

        if (!host || host.trim().length === 0) {
          reply.status(400);
          return { error: "Backend host cannot be empty" };
        }

        // Get requests and filter by backend host
        const allRequests = await safeLoggerOperation(
          () => logger.getRequests({ limit: 1000 }),
          [],
          fastify.log,
          "getRequestsByBackend"
        );

        const filteredRequests = allRequests.filter(
          (req) => req.backendHost === host
        );

        return {
          backendHost: host,
          requests: filteredRequests.slice(0, 100), // Limit to 100 for performance
          count: filteredRequests.length,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return handleRouteError(error, reply, "get-requests-by-backend");
      }
    }
  );

  // Get performance analytics
  fastify.get("/requests/analytics/performance", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const recentRequests = await safeLoggerOperation(
        () => logger.getRequests({ limit: 1000 }),
        [],
        fastify.log,
        "getPerformanceAnalytics"
      );

      // Safe performance metrics calculation
      let responseTimes: number[] = [];
      let avgResponseTime = 0;
      let medianResponseTime = 0;
      let percentile95 = 0;
      let slowestRequests: any[] = [];
      const backendPerformance: Record<
        string,
        { count: number; avgTime: number }
      > = {};

      try {
        // Calculate performance metrics
        responseTimes = recentRequests
          .map((r) => r.responseTime)
          .filter((rt) => rt > 0);
        avgResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        medianResponseTime =
          responseTimes.length > 0
            ? responseTimes.sort((a, b) => a - b)[
                Math.floor(responseTimes.length / 2)
              ]
            : 0;

        percentile95 =
          responseTimes.length > 0
            ? responseTimes.sort((a, b) => a - b)[
                Math.floor(responseTimes.length * 0.95)
              ]
            : 0;

        // Slowest endpoints
        slowestRequests = recentRequests
          .sort((a, b) => b.responseTime - a.responseTime)
          .slice(0, 10)
          .map((r) => ({
            targetUrl: r.targetUrl,
            responseTime: r.responseTime,
            timestamp: r.timestamp,
            method: r.method,
          }));

        // Performance by backend
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
          data.avgTime =
            data.count > 0 ? Math.round(data.avgTime / data.count) : 0;
        });
      } catch (error) {
        fastify.log.warn("Error calculating performance metrics:", error);
        // Continue with default values
      }

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
    } catch (error) {
      return handleRouteError(error, reply, "get-performance-analytics");
    }
  });

  // Get cache analytics
  fastify.get("/requests/analytics/cache", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const recentRequests = await safeLoggerOperation(
        () => logger.getRequests({ limit: 1000 }),
        [],
        fastify.log,
        "getCacheAnalytics"
      );

      // Safe cache analytics calculation
      let cacheHits: any[] = [];
      let cacheMisses: any[] = [];
      let hitRate = 0;
      const ttlAnalysis: Record<
        string,
        { hits: number; misses: number; hitRate: number }
      > = {};
      let topCachedEndpoints: any[] = [];
      let estimatedTimeSaved = 0;

      try {
        cacheHits = recentRequests.filter((r) => r.cacheHit);
        cacheMisses = recentRequests.filter((r) => !r.cacheHit);
        hitRate =
          recentRequests.length > 0
            ? (cacheHits.length / recentRequests.length) * 100
            : 0;

        // Cache performance by TTL
        recentRequests.forEach((req) => {
          const ttlKey = req.cacheTTL ? `${req.cacheTTL}s` : "no-ttl";
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
          cachedEndpoints[req.targetUrl] =
            (cachedEndpoints[req.targetUrl] || 0) + 1;
        });

        topCachedEndpoints = Object.entries(cachedEndpoints)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([url, count]) => ({ url, count }));

        // Calculate estimated time saved
        estimatedTimeSaved = cacheHits.reduce((total, req) => {
          // Estimate time saved (assume cache saves 90% of response time)
          return total + req.responseTime * 0.9;
        }, 0);
      } catch (error) {
        fastify.log.warn("Error calculating cache analytics:", error);
        // Continue with default values
      }

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
          estimatedTimeSaved: Math.round(estimatedTimeSaved),
          requestsServedFromCache: cacheHits.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleRouteError(error, reply, "get-cache-analytics");
    }
  });

  // Get data size analytics
  fastify.get("/requests/analytics/data-size", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const recentRequests = await safeLoggerOperation(
        () => logger.getRequests({ limit: 1000 }),
        [],
        fastify.log,
        "getDataSizeAnalytics"
      );

      // Safe data size analytics calculation
      let requestsWithSize: any[] = [];
      let totalRequestSize = 0;
      let totalResponseSize = 0;
      let avgRequestSize = 0;
      let avgResponseSize = 0;
      let largestRequests: any[] = [];
      let largestResponses: any[] = [];
      let sizeDistribution = {
        smallRequests: 0,
        mediumRequests: 0,
        largeRequests: 0,
      };

      try {
        requestsWithSize = recentRequests.filter(
          (r) => r.requestSize && r.responseSize
        );

        if (requestsWithSize.length === 0) {
          return {
            summary: { message: "No size data available" },
            timestamp: new Date().toISOString(),
          };
        }

        totalRequestSize = requestsWithSize.reduce(
          (sum, r) => sum + (r.requestSize || 0),
          0
        );
        totalResponseSize = requestsWithSize.reduce(
          (sum, r) => sum + (r.responseSize || 0),
          0
        );
        avgRequestSize = totalRequestSize / requestsWithSize.length;
        avgResponseSize = totalResponseSize / requestsWithSize.length;

        // Largest requests/responses
        largestRequests = requestsWithSize
          .sort((a, b) => (b.requestSize || 0) - (a.requestSize || 0))
          .slice(0, 10)
          .map((r) => ({
            url: r.targetUrl,
            method: r.method,
            requestSize: r.requestSize,
            responseSize: r.responseSize,
            timestamp: r.timestamp,
          }));

        largestResponses = requestsWithSize
          .sort((a, b) => (b.responseSize || 0) - (a.responseSize || 0))
          .slice(0, 10)
          .map((r) => ({
            url: r.targetUrl,
            method: r.method,
            requestSize: r.requestSize,
            responseSize: r.responseSize,
            timestamp: r.timestamp,
          }));

        // Size distribution
        sizeDistribution = {
          smallRequests: requestsWithSize.filter(
            (r) => (r.requestSize || 0) < 1024
          ).length,
          mediumRequests: requestsWithSize.filter(
            (r) => (r.requestSize || 0) >= 1024 && (r.requestSize || 0) < 10240
          ).length,
          largeRequests: requestsWithSize.filter(
            (r) => (r.requestSize || 0) >= 10240
          ).length,
        };
      } catch (error) {
        fastify.log.warn("Error calculating data size analytics:", error);
        // Continue with default values
      }

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
        sizeDistribution,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleRouteError(error, reply, "get-data-size-analytics");
    }
  });

  // Get error analytics
  fastify.get("/requests/analytics/errors", async (request, reply) => {
    try {
      const logger = getRequestLogger();
      const recentRequests = await safeLoggerOperation(
        () => logger.getRequests({ limit: 1000 }),
        [],
        fastify.log,
        "getErrorAnalytics"
      );

      // Safe error analytics calculation
      let errorRequests: any[] = [];
      let serverErrors: any[] = [];
      let clientErrors: any[] = [];
      const errorsByStatus: Record<number, number> = {};
      const errorsByBackend: Record<string, number> = {};
      let topErrorEndpoints: any[] = [];
      let recentErrors: any[] = [];

      try {
        errorRequests = recentRequests.filter((r) => r.statusCode >= 400);
        serverErrors = errorRequests.filter((r) => r.statusCode >= 500);
        clientErrors = errorRequests.filter(
          (r) => r.statusCode >= 400 && r.statusCode < 500
        );

        // Error breakdown by status code
        errorRequests.forEach((req) => {
          errorsByStatus[req.statusCode] =
            (errorsByStatus[req.statusCode] || 0) + 1;
        });

        // Error breakdown by backend
        errorRequests.forEach((req) => {
          if (req.backendHost) {
            errorsByBackend[req.backendHost] =
              (errorsByBackend[req.backendHost] || 0) + 1;
          }
        });

        // Most problematic endpoints
        const errorsByEndpoint: Record<string, number> = {};
        errorRequests.forEach((req) => {
          errorsByEndpoint[req.targetUrl] =
            (errorsByEndpoint[req.targetUrl] || 0) + 1;
        });

        topErrorEndpoints = Object.entries(errorsByEndpoint)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([url, count]) => ({ url, count }));

        // Recent errors with details
        recentErrors = errorRequests.slice(0, 20).map((r) => ({
          url: r.targetUrl,
          method: r.method,
          statusCode: r.statusCode,
          errorMessage: r.errorMessage,
          timestamp: r.timestamp,
          responseTime: r.responseTime,
        }));
      } catch (error) {
        fastify.log.warn("Error calculating error analytics:", error);
        // Continue with default values
      }

      return {
        summary: {
          totalRequests: recentRequests.length,
          totalErrors: errorRequests.length,
          errorRate:
            recentRequests.length > 0
              ? Math.round(
                  (errorRequests.length / recentRequests.length) * 100 * 100
                ) / 100
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
    } catch (error) {
      return handleRouteError(error, reply, "get-error-analytics");
    }
  });
}
