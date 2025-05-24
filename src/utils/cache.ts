import { FastifyReply, FastifyInstance } from 'fastify';
import { ProcessedRequest } from './request.js';

export interface CacheHitResult {
  isHit: boolean;
  served?: boolean;
  error?: string;
}

/**
 * Check cache and serve cached response if available with comprehensive error handling
 */
export async function checkCacheAndServe(
  fastify: FastifyInstance,
  request: ProcessedRequest,
  reply: FastifyReply
): Promise<CacheHitResult> {
  const { method, targetUrl, headers, body } = request;

  try {
    // Generate cache key safely
    let cacheKey: string;
    try {
      cacheKey = fastify.cache.generateKey(method, targetUrl, headers, body);
    } catch (error) {
      fastify.log.warn('Failed to generate cache key during cache check:', error);
      return { isHit: false, error: 'cache-key-generation-failed' };
    }

    // Check cache with enhanced context and error handling
    let cached: any;
    try {
      cached = await fastify.cache.get(cacheKey, method, targetUrl, headers);
    } catch (error) {
      fastify.log.warn('Cache retrieval failed:', error);
      return { isHit: false, error: 'cache-retrieval-failed' };
    }

    if (!cached) {
      return { isHit: false };
    }

    // Cache hit - attempt to serve cached response
    try {
      // Log cache hit
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

      // Set cached headers safely
      try {
        Object.entries(cached.headers || {}).forEach(([key, value]) => {
          if (value) {
            reply.header(key, value);
          }
        });
      } catch (error) {
        fastify.log.warn('Failed to set cached headers:', error);
        // Continue without headers
      }

      // Add cache headers with enhanced information
      try {
        reply.header('X-Cache', 'HIT');
        reply.header('X-Cache-Method', method);
        reply.header('X-Cache-TTL', (cached.ttl || 0).toString());
        reply.header('X-Cache-Age', Math.floor((Date.now() - cached.createdAt) / 1000).toString());
        reply.status(cached.status || 200);
      } catch (error) {
        fastify.log.warn('Failed to set cache headers:', error);
        // Continue with basic status
        reply.status(200);
      }

      // Send cached data
      await reply.send(cached.data);

      return { isHit: true, served: true };
    } catch (error) {
      fastify.log.error('Failed to serve cached response:', error);
      return { isHit: true, served: false, error: 'cache-serve-failed' };
    }
  } catch (error) {
    // Top-level cache operation failure
    fastify.log.error('Cache check operation failed completely:', error);
    return { isHit: false, error: 'cache-operation-failed' };
  }
}

/**
 * Store successful response in cache with comprehensive error handling
 */
export async function storeInCache(
  fastify: FastifyInstance,
  request: ProcessedRequest,
  responseData: unknown,
  responseHeaders: Record<string, string>,
  status: number
): Promise<{ success: boolean; error?: string }> {
  const { method, targetUrl, headers, body } = request;

  try {
    // Generate cache key safely
    let cacheKey: string;
    try {
      cacheKey = fastify.cache.generateKey(method, targetUrl, headers, body);
    } catch (error) {
      fastify.log.warn('Failed to generate cache key during cache store:', error);
      return { success: false, error: 'cache-key-generation-failed' };
    }

    // Store in cache with comprehensive error handling
    try {
      await fastify.cache.set(
        cacheKey,
        responseData,
        responseHeaders,
        status,
        method,
        targetUrl,
        headers
      );
    } catch (error) {
      fastify.log.warn('Failed to store response in cache:', error);
      return { success: false, error: 'cache-store-failed' };
    }

    // Log successful caching
    try {
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
    } catch (error) {
      fastify.log.warn('Failed to log cache success:', error);
      // Don't fail cache operation due to logging
    }

    return { success: true };
  } catch (error) {
    // Top-level cache store failure
    fastify.log.error('Cache store operation failed completely:', error);
    return { success: false, error: 'cache-operation-failed' };
  }
}
