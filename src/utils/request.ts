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
