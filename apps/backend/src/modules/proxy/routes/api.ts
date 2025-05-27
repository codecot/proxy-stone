import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  processRequest,
  WildcardRouteParams,
  extractBackendInfo,
  calculateRequestSize,
  calculateResponseSize,
} from "@/utils/request.js";
import { checkCacheAndServe, storeInCache } from "@/utils/cache.js";
import { forwardRequest } from "@/utils/http-client.js";
import {
  setResponseHeaders,
  createErrorResponse,
  createSpecificErrorResponse,
  createErrorContext,
  safeCreateErrorContext,
  logSuccessResponse,
  logErrorResponse,
  categorizeError,
  ErrorContext,
} from "@/utils/response.js";

export async function apiRoutes(fastify: FastifyInstance) {
  const apiRoutePath = `${fastify.config.apiPrefix}/*`;

  fastify.log.info(`Registering API routes under: ${apiRoutePath}`);
  fastify.log.info(`Target server: ${fastify.config.targetUrl}`);
  fastify.log.info(
    `Cacheable methods: ${fastify.config.cacheableMethods.join(", ")}`
  );

  // API route handler for all methods and paths under the configured apiPrefix
  fastify.all(
    apiRoutePath,
    async (
      request: FastifyRequest<{ Params: WildcardRouteParams }>,
      reply: FastifyReply
    ) => {
      const startTime = Date.now();
      let cacheHit = false;
      let statusCode = 200;
      let responseData: any = null;
      let responseHeaders: Record<string, string> = {};
      let processedRequest: any = null;
      let cacheKey: string = "";
      let errorContext: ErrorContext | null = null;

      try {
        // Step 1: Process incoming request (wrapped in try/catch)
        try {
          processedRequest = processRequest(request, fastify.config.targetUrl);
        } catch (error) {
          fastify.log.error("Failed to process incoming request:", error);
          throw new Error("Invalid request format or parameters");
        }

        // Step 2: Generate cache key (wrapped in try/catch)
        try {
          cacheKey = fastify.cache.generateKey(
            processedRequest.method,
            processedRequest.targetUrl,
            processedRequest.headers,
            processedRequest.body
          );
        } catch (error) {
          fastify.log.warn(
            "Failed to generate cache key, proceeding without caching:",
            error
          );
          cacheKey = "cache-key-generation-failed";
        }

        // Log the incoming request
        fastify.log.info(
          {
            method: processedRequest.method,
            originalUrl: request.url,
            targetUrl: processedRequest.targetUrl,
            cacheKey,
            cacheHit: false,
            cacheable: fastify.config.cacheableMethods.includes(
              processedRequest.method
            ),
            query: request.query,
            params: request.params,
            headers: processedRequest.headers,
            body: processedRequest.body,
            originalContentType: processedRequest.originalContentType,
          },
          "Forwarding request to target server"
        );

        // Step 3: Check cache first (wrapped in try/catch)
        try {
          const cacheResult = await checkCacheAndServe(
            fastify,
            processedRequest,
            reply
          );
          if (cacheResult.served) {
            cacheHit = true;
            statusCode = 200; // Assume cache hits are successful
            responseData = "CACHED_RESPONSE"; // Placeholder since response was already sent
            responseHeaders = { "X-Cache": "HIT" };

            // Get cache TTL safely
            let cacheTTL: number | undefined;
            try {
              cacheTTL = fastify.cache.getTTL(
                processedRequest.method,
                processedRequest.targetUrl,
                processedRequest.headers
              );
            } catch (error) {
              fastify.log.warn("Failed to get cache TTL:", error);
              cacheTTL = undefined;
            }

            // Log the request after cache hit (safe logging)
            await safeLogRequestToDatabase(
              fastify,
              request,
              processedRequest,
              statusCode,
              startTime,
              cacheHit,
              responseHeaders,
              responseData,
              cacheKey,
              undefined, // errorMessage
              cacheTTL
            );
            return; // Response already sent from cache
          }
        } catch (error) {
          fastify.log.warn(
            "Cache check failed, proceeding with direct request:",
            error
          );
          // Continue with direct request if cache fails
        }

        // Step 4: Forward request to target server (main error-prone operation)
        let httpResponse: any;
        try {
          httpResponse = await forwardRequest(processedRequest);
          statusCode = httpResponse.status;
          responseData = httpResponse.data;
          responseHeaders = httpResponse.headers;
        } catch (error) {
          // Categorize the error for better handling
          const errorType = categorizeError(error);
          errorContext = safeCreateErrorContext(
            error,
            request,
            processedRequest,
            cacheKey
          );

          // Log comprehensive error context
          if (errorContext) {
            logErrorResponse(fastify.log, errorContext, errorType);
          }

          // Create appropriate error response
          statusCode = 500;
          responseData = createSpecificErrorResponse(errorType, error, request);

          // Safe database logging for errors
          await safeLogRequestToDatabase(
            fastify,
            request,
            processedRequest,
            statusCode,
            startTime,
            cacheHit,
            {},
            responseData,
            cacheKey,
            error instanceof Error ? error.message : "Unknown error",
            undefined
          );

          // Return error response with appropriate status
          reply.status(
            errorType === "timeout" ? 504 : errorType === "network" ? 502 : 500
          );
          return responseData;
        }

        // Step 5: Set response headers (wrapped in try/catch)
        try {
          setResponseHeaders(reply, httpResponse, processedRequest.method);
        } catch (error) {
          fastify.log.warn("Failed to set response headers:", error);
          // Continue without headers if this fails
        }

        // Step 6: Store successful responses in cache (non-blocking)
        try {
          await storeInCache(
            fastify,
            processedRequest,
            httpResponse.data,
            httpResponse.headers,
            httpResponse.status
          );
        } catch (error) {
          fastify.log.warn("Failed to store response in cache:", error);
          // Don't fail the request if caching fails
        }

        // Step 7: Log successful response
        try {
          const wasCached =
            fastify.config.cacheableMethods.includes(processedRequest.method) &&
            httpResponse.status >= 200 &&
            httpResponse.status < 300;
          logSuccessResponse(
            fastify.log,
            processedRequest.targetUrl,
            processedRequest.method,
            httpResponse.status,
            httpResponse.headers,
            wasCached
          );
        } catch (error) {
          fastify.log.warn("Failed to log success response:", error);
          // Continue without success logging if this fails
        }

        // Step 8: Log to database (safe operation)
        try {
          const cacheTTL = fastify.cache.getTTL(
            processedRequest.method,
            processedRequest.targetUrl,
            processedRequest.headers,
            httpResponse.status
          );
          await safeLogRequestToDatabase(
            fastify,
            request,
            processedRequest,
            statusCode,
            startTime,
            cacheHit,
            responseHeaders,
            responseData,
            cacheKey,
            undefined, // errorMessage
            cacheTTL
          );
        } catch (error) {
          fastify.log.warn("Failed to log request to database:", error);
          // Never fail the main request due to logging issues
        }

        return httpResponse.data;
      } catch (error) {
        // Final catch-all error handler
        const errorType = categorizeError(error);

        // Create comprehensive error context if not already created
        if (!errorContext) {
          errorContext = safeCreateErrorContext(
            error,
            request,
            processedRequest,
            cacheKey
          );
        }

        // Log comprehensive error
        if (errorContext) {
          logErrorResponse(fastify.log, errorContext, errorType);
        }

        // Set appropriate status and response data
        statusCode =
          errorType === "timeout"
            ? 504
            : errorType === "network"
              ? 502
              : errorType === "validation"
                ? 400
                : errorType === "authentication"
                  ? 401
                  : 500;

        responseData = createSpecificErrorResponse(errorType, error, request);

        // Safe database logging for final catch errors
        await safeLogRequestToDatabase(
          fastify,
          request,
          processedRequest,
          statusCode,
          startTime,
          cacheHit,
          {},
          responseData,
          cacheKey,
          error instanceof Error ? error.message : "Unknown error",
          undefined
        );

        // Return error response
        reply.status(statusCode);
        return responseData;
      }
    }
  );
}

/**
 * Safe database logging function that never throws errors
 */
async function safeLogRequestToDatabase(
  fastify: FastifyInstance,
  request: FastifyRequest,
  processedRequest: any,
  statusCode: number,
  startTime: number,
  cacheHit: boolean,
  responseHeaders: Record<string, string>,
  responseData: any,
  cacheKey?: string,
  errorMessage?: string,
  cacheTTL?: number
): Promise<void> {
  // Early return if logging is disabled
  if (!fastify.config.enableRequestLogging) return;

  try {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Safe backend information extraction
    let backendHost = "";
    let backendPath = "";
    try {
      if (processedRequest?.targetUrl) {
        const backendInfo = extractBackendInfo(processedRequest.targetUrl);
        backendHost = backendInfo.backendHost;
        backendPath = backendInfo.backendPath;
      }
    } catch (error) {
      fastify.log.warn("Failed to extract backend info for logging:", error);
    }

    // Safe size calculations
    let requestSize = 0;
    let responseSize = 0;
    try {
      if (processedRequest?.body && processedRequest?.headers) {
        requestSize = calculateRequestSize(
          processedRequest.body,
          processedRequest.headers
        );
      }
      if (responseData && responseHeaders) {
        responseSize = calculateResponseSize(responseData, responseHeaders);
      }
    } catch (error) {
      fastify.log.warn(
        "Failed to calculate request/response sizes for logging:",
        error
      );
    }

    // Safe parameter extraction
    let queryParams: Record<string, any> = {};
    let routeParams: Record<string, any> = {};
    try {
      queryParams = (request.query as Record<string, any>) || {};
      routeParams = (request.params as Record<string, any>) || {};
    } catch (error) {
      fastify.log.warn("Failed to extract parameters for logging:", error);
    }

    // Performance metrics (simplified)
    const processingTime = responseTime;

    // Attempt to log to database with comprehensive error handling
    const logRequest = {
      id: request.id,
      method: processedRequest?.method || request.method,
      url: request.url,
      headers: processedRequest?.headers || {},
      body: processedRequest?.body,
      query: queryParams,
      params: routeParams,
    };

    // Create LoggedRequest object for the new API
    const loggedRequest = {
      timestamp: new Date().toISOString(),
      method: processedRequest?.method || request.method,
      originalUrl: request.url,
      targetUrl: processedRequest?.targetUrl || request.url,
      backendHost,
      backendPath,
      statusCode,
      responseTime,
      requestHeaders: JSON.stringify(processedRequest?.headers || {}),
      responseHeaders: JSON.stringify(responseHeaders),
      requestBody: processedRequest?.body
        ? JSON.stringify(processedRequest.body)
        : undefined,
      responseBody: responseData ? JSON.stringify(responseData) : undefined,
      queryParams:
        Object.keys(queryParams).length > 0
          ? JSON.stringify(queryParams)
          : undefined,
      routeParams:
        Object.keys(routeParams).length > 0
          ? JSON.stringify(routeParams)
          : undefined,
      cacheHit,
      cacheKey,
      cacheTTL,
      userAgent: request.headers["user-agent"],
      clientIp: request.ip,
      errorMessage,
      requestSize,
      responseSize,
      contentType: processedRequest?.headers?.["content-type"],
      responseContentType: responseHeaders["content-type"],
    };

    await fastify.requestLogger.logRequest(loggedRequest);
  } catch (error) {
    // Absolutely critical: Never let logging errors break the main request
    // Only log the logging error itself
    try {
      fastify.log.error("Database logging failed completely:", {
        error: error instanceof Error ? error.message : String(error),
        requestUrl: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      // If even error logging fails, there's nothing more we can do
      // This should never happen but prevents any possibility of request failure
      console.error("Critical: Both request logging and error logging failed");
    }
  }
}
