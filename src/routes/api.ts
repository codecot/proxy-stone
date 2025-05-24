import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  processRequest,
  WildcardRouteParams,
  extractBackendInfo,
  calculateRequestSize,
  calculateResponseSize,
} from '../utils/request.js';
import { checkCacheAndServe, storeInCache } from '../utils/cache.js';
import { forwardRequest } from '../utils/http-client.js';
import {
  setResponseHeaders,
  createErrorResponse,
  logSuccessResponse,
  logErrorResponse,
} from '../utils/response.js';

export async function apiRoutes(fastify: FastifyInstance) {
  const apiRoutePath = `${fastify.config.apiPrefix}/*`;

  fastify.log.info(`Registering API routes under: ${apiRoutePath}`);
  fastify.log.info(`Target server: ${fastify.config.targetUrl}`);
  fastify.log.info(`Cacheable methods: ${fastify.config.cacheableMethods.join(', ')}`);

  // API route handler for all methods and paths under the configured apiPrefix
  fastify.all(
    apiRoutePath,
    async (request: FastifyRequest<{ Params: WildcardRouteParams }>, reply: FastifyReply) => {
      const startTime = Date.now();
      let cacheHit = false;
      let statusCode = 200;
      let responseData: any = null;
      let responseHeaders: Record<string, string> = {};

      // Process the incoming request first to get all details
      const processedRequest = processRequest(request, fastify.config.targetUrl);

      // Generate cache key for logging and caching (available for all branches)
      const cacheKey = fastify.cache.generateKey(
        processedRequest.method,
        processedRequest.targetUrl,
        processedRequest.headers,
        processedRequest.body
      );

      try {
        // Log the incoming request
        fastify.log.info(
          {
            method: processedRequest.method,
            originalUrl: request.url,
            targetUrl: processedRequest.targetUrl,
            cacheKey,
            cacheHit: false,
            cacheable: fastify.config.cacheableMethods.includes(processedRequest.method),
            query: request.query,
            params: request.params,
            headers: processedRequest.headers,
            body: processedRequest.body,
            originalContentType: processedRequest.originalContentType,
          },
          'Forwarding request to target server'
        );

        // Check cache first and serve if available
        const cacheResult = await checkCacheAndServe(fastify, processedRequest, reply);
        if (cacheResult.served) {
          cacheHit = true;
          // For cache hits, we need to get response details for logging
          statusCode = 200; // Assume cache hits are successful
          responseData = 'CACHED_RESPONSE'; // Placeholder since response was already sent
          responseHeaders = { 'X-Cache': 'HIT' };

          // Get cache TTL
          const cacheTTL = fastify.cache.getTTL(
            processedRequest.method,
            processedRequest.targetUrl,
            processedRequest.headers
          );

          // Log the request after cache hit
          await logRequestToDatabase(
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

        // Forward request to target server
        const httpResponse = await forwardRequest(processedRequest);
        statusCode = httpResponse.status;
        responseData = httpResponse.data;
        responseHeaders = httpResponse.headers;

        // Set response headers and status
        setResponseHeaders(reply, httpResponse, processedRequest.method);

        // Store successful responses in cache (now async)
        await storeInCache(
          fastify,
          processedRequest,
          httpResponse.data,
          httpResponse.headers,
          httpResponse.status
        );

        // Log successful response
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

        // Log the request to database
        const cacheTTL = fastify.cache.getTTL(
          processedRequest.method,
          processedRequest.targetUrl,
          processedRequest.headers,
          httpResponse.status
        );
        await logRequestToDatabase(
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

        return httpResponse.data;
      } catch (error) {
        statusCode = 500;
        responseData = createErrorResponse(error);

        // Log error
        logErrorResponse(
          fastify.log,
          `${fastify.config.targetUrl}/${request.params['*']}`,
          cacheKey,
          request.method.toUpperCase(),
          error
        );

        // Log the error to database
        await logRequestToDatabase(
          fastify,
          request,
          processedRequest,
          statusCode,
          startTime,
          cacheHit,
          {},
          responseData,
          cacheKey,
          error instanceof Error ? error.message : 'Unknown error',
          undefined // cacheTTL not applicable for errors
        );

        // Return error response
        reply.status(500);
        return responseData;
      }
    }
  );
}

/**
 * Helper function to log request details to the database
 */
async function logRequestToDatabase(
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
  if (!fastify.config.enableRequestLogging) return;

  try {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Extract backend information
    const { backendHost, backendPath } = extractBackendInfo(processedRequest.targetUrl);

    // Calculate request and response sizes
    const requestSize = calculateRequestSize(processedRequest.body, processedRequest.headers);
    const responseSize = calculateResponseSize(responseData, responseHeaders);

    // Extract query and route parameters
    const queryParams = request.query as Record<string, any>;
    const routeParams = request.params as Record<string, any>;

    // Performance metrics (simplified - in a real implementation you'd measure these)
    const processingTime = responseTime; // Basic processing time

    await fastify.requestLogger.logRequest({
      method: processedRequest.method,
      originalUrl: request.url,
      targetUrl: processedRequest.targetUrl,
      // Enhanced backend tracking
      backendHost,
      backendPath,
      statusCode,
      responseTime,
      // Enhanced performance metrics
      processingTime,
      // Note: DNS, connect, and TTFB timing would require more advanced HTTP client instrumentation
      requestHeaders: processedRequest.headers || {},
      responseHeaders: responseHeaders || {},
      requestBody: processedRequest.body,
      responseBody: responseData,
      // Enhanced parameter tracking
      queryParams,
      routeParams,
      cacheHit,
      cacheKey,
      cacheTTL,
      userAgent: request.headers['user-agent'],
      clientIp: request.ip || request.socket?.remoteAddress,
      errorMessage,
      // Enhanced request context
      requestSize,
      responseSize,
      contentType: processedRequest.originalContentType,
      responseContentType: responseHeaders['content-type'],
    });
  } catch (error) {
    // Don't let logging errors break the main request
    fastify.log.error('Failed to log request to database:', error);
  }
}
