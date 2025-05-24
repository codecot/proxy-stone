import { FastifyReply, FastifyRequest } from 'fastify';
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
 * Enhanced error context for comprehensive logging
 */
export interface ErrorContext {
  request: {
    method: string;
    originalUrl: string;
    targetUrl: string;
    cacheKey?: string;
    backendHost?: string;
    backendPath?: string;
    userAgent?: string;
    clientIp?: string;
    headers: Record<string, any>;
    query: Record<string, any>;
    params: Record<string, any>;
    body?: any;
  };
  error: {
    message: string;
    stack?: string;
    code?: string;
    type: string;
    statusCode?: number;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Create enhanced error context for comprehensive logging
 */
export function createErrorContext(
  error: unknown,
  request: FastifyRequest,
  processedRequest?: any,
  cacheKey?: string
): ErrorContext {
  const errorInfo =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
          type: error.constructor.name,
          statusCode: (error as any).statusCode || (error as any).status,
        }
      : {
          message: String(error),
          stack: undefined,
          code: undefined,
          type: 'UnknownError',
          statusCode: undefined,
        };

  return {
    request: {
      method: request.method,
      originalUrl: request.url,
      targetUrl: processedRequest?.targetUrl || 'unknown',
      cacheKey,
      backendHost: processedRequest?.backendHost,
      backendPath: processedRequest?.backendPath,
      userAgent: request.headers['user-agent'],
      clientIp: request.ip || request.socket?.remoteAddress,
      headers: request.headers,
      query: request.query as Record<string, any>,
      params: request.params as Record<string, any>,
      body: request.body,
    },
    error: errorInfo,
    timestamp: new Date().toISOString(),
    requestId: request.id,
  };
}

/**
 * Create a standardized error response with dev mode support
 */
export function createErrorResponse(
  error: unknown,
  request?: FastifyRequest,
  isDevelopment: boolean = process.env.NODE_ENV === 'development'
): {
  error: string;
  message: string;
  timestamp: string;
  requestId?: string;
  details?: any;
} {
  const baseResponse = {
    error: 'Proxy Error',
    message: 'Failed to forward request to target server',
    timestamp: new Date().toISOString(),
    requestId: request?.id,
  };

  // Check for X-Debug-Error header to expose full error details
  const debugMode = request?.headers['x-debug-error'] === 'true' && isDevelopment;

  if (debugMode) {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
            statusCode: (error as any).statusCode || (error as any).status,
          }
        : {
            message: String(error),
            type: typeof error,
          };

    return {
      ...baseResponse,
      details: {
        error: errorDetails,
        environment: 'development',
        debugMode: true,
      },
    };
  }

  // In production or without debug header, return sanitized error
  return baseResponse;
}

/**
 * Enhanced error response for specific error types
 */
export function createSpecificErrorResponse(
  errorType: 'timeout' | 'network' | 'cache' | 'validation' | 'authentication' | 'unknown',
  error: unknown,
  request?: FastifyRequest
): {
  error: string;
  message: string;
  timestamp: string;
  type: string;
  requestId?: string;
  retryable?: boolean;
} {
  const errorMessages = {
    timeout: 'Request timeout - the target server took too long to respond',
    network: 'Network error - unable to reach the target server',
    cache: 'Cache operation failed - served from backup',
    validation: 'Invalid request - please check your request parameters',
    authentication: 'Authentication failed - please check your credentials',
    unknown: 'An unexpected error occurred while processing your request',
  };

  const retryableErrors = ['timeout', 'network', 'cache'];

  return {
    error: 'Proxy Error',
    message: errorMessages[errorType],
    timestamp: new Date().toISOString(),
    type: errorType,
    requestId: request?.id,
    retryable: retryableErrors.includes(errorType),
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
 * Enhanced error logging with comprehensive context
 */
export function logErrorResponse(
  logger: any,
  errorContext: ErrorContext,
  errorType?: string
): void {
  logger.error(
    {
      ...errorContext,
      errorType: errorType || 'unknown',
    },
    'Error forwarding request to target server'
  );
}

/**
 * Categorize error types for better handling
 */
export function categorizeError(
  error: unknown
): 'timeout' | 'network' | 'cache' | 'validation' | 'authentication' | 'unknown' {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const status = (error as any).statusCode || (error as any).status;

    // Network/timeout errors
    if (
      message.includes('timeout') ||
      message.includes('aborted') ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED'
    ) {
      return 'timeout';
    }

    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('enotfound') ||
      message.includes('econnrefused') ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ENETUNREACH'
    ) {
      return 'network';
    }

    // Authentication errors
    if (status === 401 || status === 403 || message.includes('auth')) {
      return 'authentication';
    }

    // Validation errors
    if (status === 400 || status === 422 || message.includes('validation')) {
      return 'validation';
    }

    // Cache errors
    if (message.includes('cache')) {
      return 'cache';
    }
  }

  return 'unknown';
}
