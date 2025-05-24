import { FastifyReply } from 'fastify';
import { HttpResponse } from './http-client.js';

/**
 * Set response headers and status from the HTTP response
 */
export function setResponseHeaders(
  reply: FastifyReply,
  httpResponse: HttpResponse,
  method: string
): void {
  const { headers, status } = httpResponse;

  // Set response headers from target server
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      reply.header(key, value);
    }
  });

  // Add cache headers
  reply.header('X-Cache', 'MISS');
  reply.header('X-Cache-Method', method);

  // Set status code
  reply.status(status);
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(error: unknown): {
  error: string;
  message: string;
  timestamp: string;
} {
  return {
    error: 'Proxy Error',
    message: 'Failed to forward request to target server',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log successful response details
 */
export function logSuccessResponse(
  logger: any,
  targetUrl: string,
  method: string,
  status: number,
  headers: Record<string, string>,
  cached: boolean
): void {
  logger.info(
    {
      targetUrl,
      method,
      responseStatus: status,
      responseHeaders: headers,
      cached,
    },
    'Received response from target server'
  );
}

/**
 * Log error details
 */
export function logErrorResponse(
  logger: any,
  targetUrl: string,
  cacheKey: string,
  method: string,
  error: unknown
): void {
  logger.error(
    {
      targetUrl,
      cacheKey,
      method,
      error: error instanceof Error ? error.message : String(error),
    },
    'Error forwarding request to target server'
  );
}
