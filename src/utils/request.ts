import { FastifyRequest } from 'fastify';

export interface ProcessedRequest {
  method: string;
  targetUrl: string;
  headers: Record<string, string>;
  body: unknown;
  originalContentType?: string;
}

export interface WildcardRouteParams {
  '*': string;
}

/**
 * Extract backend host and path information from target URL
 */
export function extractBackendInfo(targetUrl: string): {
  backendHost: string;
  backendPath: string;
} {
  try {
    const url = new URL(targetUrl);
    const backendHost = `${url.protocol}//${url.host}`;
    const backendPath = `${url.pathname}${url.search}${url.hash}`;

    return {
      backendHost,
      backendPath,
    };
  } catch (error) {
    // Fallback for invalid URLs
    return {
      backendHost: targetUrl.split('/').slice(0, 3).join('/') || targetUrl,
      backendPath: targetUrl.split('/').slice(3).join('/') || '/',
    };
  }
}

/**
 * Calculate request/response sizes in bytes
 */
export function calculateRequestSize(body: unknown, headers: Record<string, string>): number {
  let size = 0;

  // Calculate body size
  if (body) {
    if (typeof body === 'string') {
      size += Buffer.byteLength(body, 'utf8');
    } else {
      size += Buffer.byteLength(JSON.stringify(body), 'utf8');
    }
  }

  // Calculate headers size (approximate)
  Object.entries(headers).forEach(([key, value]) => {
    size += Buffer.byteLength(`${key}: ${value}\r\n`, 'utf8');
  });

  return size;
}

/**
 * Calculate response size in bytes
 */
export function calculateResponseSize(data: unknown, headers: Record<string, string>): number {
  let size = 0;

  // Calculate data size
  if (data) {
    if (typeof data === 'string') {
      size += Buffer.byteLength(data, 'utf8');
    } else {
      size += Buffer.byteLength(JSON.stringify(data), 'utf8');
    }
  }

  // Calculate headers size (approximate)
  Object.entries(headers).forEach(([key, value]) => {
    size += Buffer.byteLength(`${key}: ${value}\r\n`, 'utf8');
  });

  return size;
}

/**
 * Build the target URL from the request parameters
 */
export function buildTargetUrl(
  baseUrl: string,
  targetPath: string,
  query: FastifyRequest['query']
): string {
  const queryString = new URLSearchParams(query as Record<string, string>).toString();
  return `${baseUrl}/${targetPath}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Convert Fastify headers to a string-based format for cache keys and fetch API
 */
export function normalizeHeaders(headers: FastifyRequest['headers']): Record<string, string> {
  const stringHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      stringHeaders[key] = value;
    } else if (Array.isArray(value)) {
      stringHeaders[key] = value.join(', ');
    }
  });
  return stringHeaders;
}

/**
 * Remove headers that shouldn't be forwarded to the target server
 */
export function filterForwardedHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered = { ...headers };
  delete filtered.host;
  delete filtered['content-length'];
  return filtered;
}

/**
 * Process incoming request and extract all necessary data
 */
export function processRequest(
  request: FastifyRequest<{ Params: WildcardRouteParams }>,
  targetBaseUrl: string
): ProcessedRequest {
  const method = request.method.toUpperCase();
  const headers = { ...request.headers };
  const body = request.body;
  const query = request.query;
  const params = request.params;

  // Extract the path after the API prefix
  const targetPath = params['*'];

  // Build target URL
  const targetUrl = buildTargetUrl(targetBaseUrl, targetPath, query);

  // Get original content type before modifying headers
  const originalContentType = headers['content-type'] as string | undefined;

  // Normalize headers for consistency
  const normalizedHeaders = normalizeHeaders(headers);

  return {
    method,
    targetUrl,
    headers: normalizedHeaders,
    body,
    originalContentType,
  };
}
