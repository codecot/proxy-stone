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

  // Check if this method is cacheable
  const isCacheable = fastify.config.cacheableMethods.includes(method);

  if (!isCacheable) {
    return { isHit: false };
  }

  // Generate cache key
  const cacheKey = fastify.cache.generateKey(method, targetUrl, headers, body);

  // Check cache (now async)
  const cached = await fastify.cache.get(cacheKey);

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
    },
    'Serving response from cache'
  );

  // Set cached headers
  Object.entries(cached.headers).forEach(([key, value]) => {
    reply.header(key, value);
  });

  // Add cache headers
  reply.header('X-Cache', 'HIT');
  reply.header('X-Cache-Method', method);
  reply.status(cached.status);

  // Send cached data
  await reply.send(cached.data);

  return { isHit: true, served: true };
}

/**
 * Store successful response in cache
 */
export async function storeInCache(
  fastify: FastifyInstance,
  request: ProcessedRequest,
  responseData: unknown,
  responseHeaders: Record<string, string>,
  status: number
): Promise<void> {
  const { method, targetUrl, headers, body } = request;

  // Check if this method is cacheable and response is successful
  const isCacheable = fastify.config.cacheableMethods.includes(method);
  const isSuccess = status >= 200 && status < 300;

  if (!isCacheable || !isSuccess) {
    return;
  }

  // Generate cache key and store (now async)
  const cacheKey = fastify.cache.generateKey(method, targetUrl, headers, body);
  await fastify.cache.set(cacheKey, responseData, responseHeaders, status);

  fastify.log.info(
    {
      cacheKey,
      targetUrl,
      method,
      responseStatus: status,
    },
    'Cached successful response'
  );
}
