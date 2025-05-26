import { FastifyInstance, FastifyRequest } from 'fastify';
import { SnapshotFilters } from '../services/snapshot-manager.js';
import { forwardRequest } from '../utils/http-client.js';
import { processRequest } from '../utils/request.js';
import { createErrorResponse } from '../utils/response.js';
import { requireReadAccess, requireAdmin } from '../plugins/auth.js';

interface CacheKeyParams {
  key: string;
}

interface SnapshotQuery {
  method?: string;
  url?: string;
  backend_host?: string;
  manual?: string;
  expires_before?: string;
  expires_after?: string;
  created_before?: string;
  created_after?: string;
  tags?: string; // Comma-separated tags
  limit?: string;
  offset?: string;
}

interface RefreshBody {
  force?: boolean;
  ttl_override?: number;
  tags?: string[];
}

interface UpdateSnapshotBody {
  expires_at?: string;
  manual_snapshot?: boolean;
  tags?: string[];
  description?: string;
  ttl_extension_hours?: number;
}

interface TTLRuleBody {
  pattern: string;
  ttl_seconds: number;
  method?: string;
  enabled?: boolean;
  description?: string;
}

interface TTLRuleParams {
  id: string;
}

interface FreezeToggleBody {
  enabled: boolean;
  endpoints?: string[];
  global?: boolean;
}

// Global freeze mode state (in production, this would be stored in database/Redis)
let globalFreezeMode = false;
let frozenEndpoints: Set<string> = new Set();

export async function cacheRoutes(fastify: FastifyInstance) {
  const getSnapshotManager = () => (fastify as any).snapshotManager;
  const getCacheService = () => fastify.cache;

  // Error handler for cache route errors
  const handleCacheError = (error: unknown, reply: any, operation: string) => {
    fastify.log.error(`Cache management error [${operation}]:`, error);
    reply.status(500);
    return createErrorResponse(error);
  };

  // ========================================
  // SNAPSHOT MANAGEMENT API
  // ========================================

  // GET /cache/entries - List all active cache entries
  fastify.get<{ Querystring: SnapshotQuery }>(
    '/cache/entries',
    { preHandler: requireReadAccess() },
    async (request, reply) => {
      try {
        const snapshotManager = getSnapshotManager();

        if (!snapshotManager) {
          reply.status(503);
          return { error: 'Snapshot management not available' };
        }

        const filters: SnapshotFilters = {};

        // Parse query parameters
        if (request.query.method) {
          filters.method = request.query.method.toUpperCase();
        }

        if (request.query.url) {
          filters.url = request.query.url;
        }

        if (request.query.backend_host) {
          filters.backend_host = request.query.backend_host;
        }

        if (request.query.manual) {
          filters.manual = request.query.manual === 'true';
        }

        if (request.query.expires_before) {
          filters.expires_before = request.query.expires_before;
        }

        if (request.query.expires_after) {
          filters.expires_after = request.query.expires_after;
        }

        if (request.query.created_before) {
          filters.created_before = request.query.created_before;
        }

        if (request.query.created_after) {
          filters.created_after = request.query.created_after;
        }

        if (request.query.tags) {
          filters.tags = request.query.tags.split(',').map((tag) => tag.trim());
        }

        if (request.query.limit) {
          const limit = parseInt(request.query.limit);
          filters.limit = !isNaN(limit) && limit > 0 ? Math.min(limit, 1000) : 50;
        } else {
          filters.limit = 50;
        }

        if (request.query.offset) {
          const offset = parseInt(request.query.offset);
          filters.offset = !isNaN(offset) && offset >= 0 ? offset : 0;
        }

        const snapshots = await snapshotManager.getSnapshots(filters);
        const stats = await snapshotManager.getStats();

        return {
          snapshots,
          pagination: {
            limit: filters.limit,
            offset: filters.offset || 0,
            count: snapshots.length,
          },
          stats: {
            totalSnapshots: stats.totalSnapshots,
            manualSnapshots: stats.manualSnapshots,
            expiredSnapshots: stats.expiredSnapshots,
          },
          filters,
        };
      } catch (error) {
        return handleCacheError(error, reply, 'get-cache-entries');
      }
    }
  );

  // GET /cache/entry/:key - Return cached response + metadata
  fastify.get<{ Params: CacheKeyParams }>(
    '/cache/entry/:key',
    { preHandler: requireReadAccess() },
    async (request, reply) => {
      try {
        const cacheKey = decodeURIComponent(request.params.key);
        const snapshotManager = getSnapshotManager();
        const cacheService = getCacheService();

        // Get snapshot metadata
        const metadata = snapshotManager
          ? await snapshotManager.getSnapshotByCacheKey(cacheKey)
          : null;

        if (!metadata) {
          reply.status(404);
          return { error: 'Cache entry not found' };
        }

        // Get cached data
        const cachedData = await cacheService.get(cacheKey);

        if (!cachedData) {
          reply.status(404);
          return { error: 'Cache data not found (may have expired)' };
        }

        // Update access statistics
        if (snapshotManager) {
          await snapshotManager.updateAccess(cacheKey);
        }

        return {
          metadata,
          cached_data: {
            data: cachedData.data,
            headers: cachedData.headers,
            status: cachedData.status,
            created_at: new Date(cachedData.createdAt).toISOString(),
            ttl: cachedData.ttl,
            access_count: cachedData.accessCount,
            last_accessed: new Date(cachedData.lastAccessed).toISOString(),
          },
          cache_info: {
            is_expired: Date.now() > cachedData.createdAt + cachedData.ttl * 1000,
            time_remaining: Math.max(
              0,
              Math.floor((cachedData.createdAt + cachedData.ttl * 1000 - Date.now()) / 1000)
            ),
            size_bytes: Buffer.byteLength(JSON.stringify(cachedData.data), 'utf8'),
          },
        };
      } catch (error) {
        return handleCacheError(error, reply, 'get-cache-entry');
      }
    }
  );

  // POST /cache/entry/:key/refresh - Re-fetch from backend and update snapshot
  fastify.post(
    '/cache/entry/:key/refresh',
    async (request: FastifyRequest<{ Params: CacheKeyParams; Body: RefreshBody }>, reply) => {
      try {
        const cacheKey = decodeURIComponent(request.params.key);
        const { force = false, ttl_override, tags } = request.body || {};

        const snapshotManager = getSnapshotManager();
        const cacheService = getCacheService();

        // Get snapshot metadata to reconstruct the request
        const metadata = snapshotManager
          ? await snapshotManager.getSnapshotByCacheKey(cacheKey)
          : null;

        if (!metadata) {
          reply.status(404);
          return { error: 'Cache entry not found' };
        }

        // Check if refresh is needed (unless forced)
        if (!force) {
          const now = new Date();
          const expiresAt = new Date(metadata.expires_at);
          if (now < expiresAt) {
            return {
              message: 'Cache entry is still valid. Use force=true to refresh anyway.',
              metadata,
              time_remaining: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
            };
          }
        }

        // Reconstruct the request for forwarding
        const mockRequest = {
          method: metadata.method,
          url: metadata.url,
          headers: {
            'user-agent': 'proxy-stone-refresh',
            'x-refresh-request': 'true',
          },
          body: metadata.request_body ? JSON.parse(metadata.request_body) : undefined,
        } as any;

        try {
          // Process the request
          const processedRequest = processRequest(mockRequest, metadata.url);

          // Forward to backend
          const httpResponse = await forwardRequest(processedRequest);

          // Calculate TTL
          const ttl =
            ttl_override ||
            fastify.cache.getTTL(
              processedRequest.method,
              processedRequest.targetUrl,
              processedRequest.headers,
              httpResponse.status
            );

          // Update cache
          await cacheService.set(
            cacheKey,
            httpResponse.data,
            httpResponse.headers,
            httpResponse.status,
            processedRequest.method,
            processedRequest.targetUrl,
            processedRequest.headers
          );

          // Update snapshot metadata
          if (snapshotManager) {
            await snapshotManager.recordSnapshot(
              cacheKey,
              metadata.url,
              metadata.method,
              httpResponse.status,
              ttl,
              metadata.backend_host,
              httpResponse.data,
              httpResponse.headers,
              metadata.request_body ? JSON.parse(metadata.request_body) : undefined,
              tags || (metadata.tags ? JSON.parse(metadata.tags as string) : undefined)
            );
          }

          return {
            message: 'Cache entry refreshed successfully',
            refresh_info: {
              previous_status: metadata.status_code,
              new_status: httpResponse.status,
              refresh_time: new Date().toISOString(),
              ttl_seconds: ttl,
              forced: force,
            },
            metadata: snapshotManager
              ? await snapshotManager.getSnapshotByCacheKey(cacheKey)
              : null,
          };
        } catch (refreshError) {
          fastify.log.error('Failed to refresh cache entry:', refreshError);
          reply.status(502);
          return {
            error: 'Failed to refresh cache entry from backend',
            details: refreshError instanceof Error ? refreshError.message : String(refreshError),
            metadata,
          };
        }
      } catch (error) {
        return handleCacheError(error, reply, 'refresh-cache-entry');
      }
    }
  );

  // PATCH /cache/entry/:key - Extend TTL or mark as manual snapshot
  fastify.patch(
    '/cache/entry/:key',
    async (
      request: FastifyRequest<{ Params: CacheKeyParams; Body: UpdateSnapshotBody }>,
      reply
    ) => {
      try {
        const cacheKey = decodeURIComponent(request.params.key);
        const updates = request.body || {};

        const snapshotManager = getSnapshotManager();

        if (!snapshotManager) {
          reply.status(503);
          return { error: 'Snapshot management not available' };
        }

        // Handle TTL extension
        if (updates.ttl_extension_hours) {
          const metadata = await snapshotManager.getSnapshotByCacheKey(cacheKey);
          if (metadata) {
            const currentExpiry = new Date(metadata.expires_at);
            const newExpiry = new Date(
              currentExpiry.getTime() + updates.ttl_extension_hours * 60 * 60 * 1000
            );
            updates.expires_at = newExpiry.toISOString();
          }
        }

        const success = await snapshotManager.updateSnapshot(cacheKey, updates);

        if (!success) {
          reply.status(404);
          return { error: 'Cache entry not found or update failed' };
        }

        const updatedMetadata = await snapshotManager.getSnapshotByCacheKey(cacheKey);

        return {
          message: 'Cache entry updated successfully',
          updates_applied: updates,
          metadata: updatedMetadata,
        };
      } catch (error) {
        return handleCacheError(error, reply, 'update-cache-entry');
      }
    }
  );

  // DELETE /cache/entry/:key - Purge cache entry manually
  fastify.delete(
    '/cache/entry/:key',
    async (request: FastifyRequest<{ Params: CacheKeyParams }>, reply) => {
      try {
        const cacheKey = decodeURIComponent(request.params.key);
        const snapshotManager = getSnapshotManager();
        const cacheService = getCacheService();

        // Get metadata before deletion for response
        const metadata = snapshotManager
          ? await snapshotManager.getSnapshotByCacheKey(cacheKey)
          : null;

        // Delete from cache service (all layers)
        await cacheService.delete(cacheKey);

        // Delete snapshot metadata
        const metadataDeleted = snapshotManager
          ? await snapshotManager.deleteSnapshot(cacheKey)
          : false;

        return {
          message: 'Cache entry deleted successfully',
          deleted_metadata: metadata,
          cache_deleted: true,
          metadata_deleted: metadataDeleted,
        };
      } catch (error) {
        return handleCacheError(error, reply, 'delete-cache-entry');
      }
    }
  );

  // ========================================
  // CACHE STATISTICS & UTILITIES
  // ========================================

  // GET /cache/stats - Get comprehensive cache statistics
  fastify.get('/cache/stats', async (request, reply) => {
    try {
      const snapshotManager = getSnapshotManager();
      const cacheService = getCacheService();

      const [cacheStats, snapshotStats] = await Promise.all([
        cacheService.getStats(),
        snapshotManager ? snapshotManager.getStats() : null,
      ]);

      return {
        cache_service: cacheStats,
        snapshots: snapshotStats,
        freeze_mode: {
          global: globalFreezeMode,
          frozen_endpoints: Array.from(frozenEndpoints),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleCacheError(error, reply, 'get-cache-stats');
    }
  });

  // POST /cache/cleanup - Clean expired entries
  fastify.post('/cache/cleanup', async (request, reply) => {
    try {
      const snapshotManager = getSnapshotManager();
      const cacheService = getCacheService();

      const [cacheCleanup, snapshotCleanup] = await Promise.all([
        cacheService.cleanExpired(),
        snapshotManager ? snapshotManager.cleanExpired() : 0,
      ]);

      return {
        message: 'Cache cleanup completed',
        cleaned: {
          cache_entries: cacheCleanup,
          snapshot_metadata: snapshotCleanup,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleCacheError(error, reply, 'cache-cleanup');
    }
  });

  // DELETE /cache/clear - Clear all cache entries
  fastify.delete('/cache/clear', async (request, reply) => {
    try {
      const snapshotManager = getSnapshotManager();
      const cacheService = getCacheService();

      // Get stats before clearing
      const statsBefore = await cacheService.getStats();

      // Clear cache service
      const cacheCleared = await cacheService.clear();

      // Clear snapshot metadata (non-manual snapshots only)
      let snapshotCleared = 0;
      if (snapshotManager) {
        // This would need a method to clear non-manual snapshots
        // For now, we'll clean expired ones
        snapshotCleared = await snapshotManager.cleanExpired();
      }

      return {
        message: 'Cache cleared successfully',
        cleared: {
          cache_entries: cacheCleared,
          snapshot_metadata: snapshotCleared,
        },
        stats_before: statsBefore,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleCacheError(error, reply, 'clear-cache');
    }
  });

  // ========================================
  // TTL CONTROL & FREEZE MODE
  // ========================================

  // POST /cache/freeze - Toggle freeze mode
  fastify.post(
    '/cache/freeze',
    async (request: FastifyRequest<{ Body: FreezeToggleBody }>, reply) => {
      try {
        const { enabled, endpoints = [], global = false } = request.body || {};

        if (global) {
          globalFreezeMode = enabled;
          if (!enabled) {
            frozenEndpoints.clear();
          }
        } else if (endpoints.length > 0) {
          if (enabled) {
            endpoints.forEach((endpoint) => frozenEndpoints.add(endpoint));
          } else {
            endpoints.forEach((endpoint) => frozenEndpoints.delete(endpoint));
          }
        }

        return {
          message: `Freeze mode ${enabled ? 'enabled' : 'disabled'}`,
          freeze_state: {
            global: globalFreezeMode,
            frozen_endpoints: Array.from(frozenEndpoints),
            affected_endpoints: global ? 'all' : endpoints,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return handleCacheError(error, reply, 'toggle-freeze-mode');
      }
    }
  );

  // GET /cache/freeze/status - Get freeze mode status
  fastify.get('/cache/freeze/status', async (request, reply) => {
    try {
      return {
        freeze_mode: {
          global: globalFreezeMode,
          frozen_endpoints: Array.from(frozenEndpoints),
          total_frozen_endpoints: frozenEndpoints.size,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return handleCacheError(error, reply, 'get-freeze-status');
    }
  });

  // Helper function to check if an endpoint is frozen
  fastify.decorate('isEndpointFrozen', (url: string): boolean => {
    if (globalFreezeMode) return true;
    return (
      frozenEndpoints.has(url) ||
      Array.from(frozenEndpoints).some((pattern) => {
        // Simple pattern matching - could be enhanced with regex
        return url.includes(pattern);
      })
    );
  });

  // ========================================
  // SNAPSHOT SEARCH & FILTERING
  // ========================================

  // GET /cache/search - Advanced snapshot search
  fastify.get(
    '/cache/search',
    async (request: FastifyRequest<{ Querystring: SnapshotQuery & { q?: string } }>, reply) => {
      try {
        const snapshotManager = getSnapshotManager();

        if (!snapshotManager) {
          reply.status(503);
          return { error: 'Snapshot management not available' };
        }

        const filters: SnapshotFilters = {};
        const searchQuery = request.query.q;

        // If there's a search query, apply it to URL field
        if (searchQuery) {
          filters.url = searchQuery;
        }

        // Apply other filters similar to /cache/entries
        if (request.query.method) filters.method = request.query.method.toUpperCase();
        if (request.query.backend_host) filters.backend_host = request.query.backend_host;
        if (request.query.manual) filters.manual = request.query.manual === 'true';
        if (request.query.expires_before) filters.expires_before = request.query.expires_before;
        if (request.query.expires_after) filters.expires_after = request.query.expires_after;
        if (request.query.tags)
          filters.tags = request.query.tags.split(',').map((tag) => tag.trim());

        const limit = request.query.limit
          ? Math.min(parseInt(request.query.limit) || 50, 1000)
          : 50;
        const offset = request.query.offset ? Math.max(parseInt(request.query.offset) || 0, 0) : 0;

        filters.limit = limit;
        filters.offset = offset;

        const snapshots = await snapshotManager.getSnapshots(filters);

        return {
          search_results: snapshots,
          search_query: searchQuery,
          filters,
          pagination: {
            limit,
            offset,
            count: snapshots.length,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return handleCacheError(error, reply, 'search-snapshots');
      }
    }
  );

  // Invalidate cache by pattern
  fastify.post('/cache/invalidate/pattern', async (request, reply) => {
    const { pattern } = request.body as { pattern: string };
    if (!pattern) {
      reply.status(400);
      return { error: 'Pattern is required' };
    }

    const invalidated = await fastify.cache.invalidateByPattern(pattern);
    return {
      message: `Invalidated cache entries matching pattern: ${pattern}`,
      invalidated,
    };
  });

  // Invalidate cache by age
  fastify.post('/cache/invalidate/age', async (request, reply) => {
    const { ageInSeconds } = request.body as { ageInSeconds: number };
    if (!ageInSeconds || ageInSeconds <= 0) {
      reply.status(400);
      return { error: 'Valid ageInSeconds is required' };
    }

    const invalidated = await fastify.cache.invalidateOlderThan(ageInSeconds);
    return {
      message: `Invalidated cache entries older than ${ageInSeconds} seconds`,
      invalidated,
    };
  });

  // Invalidate cache by tags
  fastify.post('/cache/invalidate/tags', async (request, reply) => {
    const { tags } = request.body as { tags: string[] };
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      reply.status(400);
      return { error: 'Valid tags array is required' };
    }

    const invalidated = await fastify.cache.invalidateByTags(tags);
    return {
      message: `Invalidated cache entries with tags: ${tags.join(', ')}`,
      invalidated,
    };
  });
}
