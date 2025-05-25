import { FastifyInstance } from 'fastify';
import { requireAdmin, requireReadAccess } from '../plugins/auth.js';
import { Role } from '../types/index.js';

export async function authRoutes(fastify: FastifyInstance) {
  // GET /auth/status - Check authentication status (no auth required)
  fastify.get('/auth/status', async (request, reply) => {
    const authConfig = fastify.config.auth;

    return {
      auth_enabled: authConfig?.enabled || false,
      authenticated: request.auth?.authenticated || false,
      role: request.auth?.role || Role.USER,
      key_name: request.auth?.keyName,
      protected_paths: authConfig?.protectedPaths || [],
      jwt_enabled: !!authConfig?.jwt,
    };
  });

  // GET /auth/test-protected - Test endpoint that requires read access
  fastify.get(
    '/auth/test-protected',
    { preHandler: requireReadAccess() },
    async (request, reply) => {
      return {
        message: 'Access granted! You have read permissions.',
        auth: request.auth,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // GET /auth/test-admin - Test endpoint that requires admin access
  fastify.get('/auth/test-admin', { preHandler: requireAdmin() }, async (request, reply) => {
    return {
      message: 'Access granted! You have admin permissions.',
      auth: request.auth,
      timestamp: new Date().toISOString(),
    };
  });

  // GET /auth/keys - List API keys (admin only, without exposing actual keys)
  fastify.get('/auth/keys', { preHandler: requireAdmin() }, async (request, reply) => {
    const authConfig = fastify.config.auth;

    if (!authConfig?.enabled) {
      reply.status(503);
      return { error: 'Authentication not enabled' };
    }

    return {
      keys: authConfig.apiKeys.map((key) => ({
        name: key.name || 'Unnamed',
        role: key.role,
        enabled: key.enabled !== false,
        key_preview: key.key.substring(0, 8) + '...',
      })),
      total: authConfig.apiKeys.length,
    };
  });
}
