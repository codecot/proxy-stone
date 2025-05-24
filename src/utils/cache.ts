import { FastifyReply, FastifyInstance } from 'fastify';
import { ProcessedRequest } from './request.js';

export interface CacheHitResult {
  isHit: boolean;
  served?: boolean;
}

/**
 * Check cache and serve cached response if available
 */
export async function checkCacheAndServe(
  fastify: FastifyInstance,
  request: ProcessedRequest,
  reply: FastifyReply
): Promise<CacheHitResult> {
  const { method, targetUrl, headers, body } = request;

  // Generate cache key
  const cacheKey = fastify.cache.generateKey(method, targetUrl, headers, body);

  // Check cache with enhanced context
  const cached = await fastify.cache.get(cacheKey, method, targetUrl, headers);

  if (!cached) {
    return { isHit: false };
  }

  // Cache hit - serve cached response
  fastify.log.info(
    {
      cacheKey,
      targetUrl,
      method,
      cacheHit: true,
      ttl: cached.ttl,
      age: Math.floor((Date.now() - cached.createdAt) / 1000),
    },
    'Serving response from cache'
  );

  // Set cached headers
  Object.entries(cached.headers).forEach(([key, value]) => {
    reply.header(key, value);
  });

  // Add cache headers with enhanced information
  reply.header('X-Cache', 'HIT');
  reply.header('X-Cache-Method', method);
  reply.header('X-Cache-TTL', cached.ttl.toString());
  reply.header('X-Cache-Age', Math.floor((Date.now() - cached.createdAt) / 1000).toString());
  reply.status(cached.status);

  // Send cached data
  await reply.send(cached.data);

  return { isHit: true, served: true };
}

/**
 * Store successful response in cache with enhanced rule-based logic
 */
export async function storeInCache(
  fastify: FastifyInstance,
  request: ProcessedRequest,
  responseData: unknown,
  responseHeaders: Record<string, string>,
  status: number
): Promise<void> {
  const { method, targetUrl, headers, body } = request;

  // Generate cache key and store with enhanced context
  const cacheKey = fastify.cache.generateKey(method, targetUrl, headers, body);
  await fastify.cache.set(
    cacheKey,
    responseData,
    responseHeaders,
    status,
    method,
    targetUrl,
    headers
  );

  fastify.log.info(
    {
      cacheKey,
      targetUrl,
      method,
      responseStatus: status,
      cached: true,
    },
    'Cached successful response with rule-based TTL'
  );
}
