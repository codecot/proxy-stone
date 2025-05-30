import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Role } from "@/types/index.js";

// Extend FastifyRequest to include auth context
declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      role: Role;
      keyName?: string;
      sessionId?: string;
      authenticated: boolean;
    };
  }
}

export interface AuthPluginOptions {
  requiredRoles?: Role[];
  skipAuth?: boolean;
}

// Auth middleware function
export const authMiddleware = (options: AuthPluginOptions = {}) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { auth } = request.server.config;

    // Skip auth if disabled globally or for this specific route
    if (!auth?.enabled || options.skipAuth) {
      request.auth = {
        role: Role.USER,
        authenticated: false,
      };
      return;
    }

    // Check if current path requires auth
    const currentPath = request.url;
    const requiresAuth = auth.protectedPaths.some((pattern) => {
      // Simple glob pattern matching (supports * wildcard)
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(currentPath);
    });

    if (!requiresAuth) {
      request.auth = {
        role: Role.USER,
        authenticated: false,
      };
      return;
    }

    // Extract token from headers
    const token =
      request.headers.authorization?.replace('Bearer ', '') ||
      (request.headers['x-api-key'] as string) ||
      (request.headers['x-access-token'] as string);

    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message:
          'Token required. Provide via Authorization: Bearer <token> or X-Access-Token header.',
      });
    }

    const authService = (request.server as any).authService;
    if (!authService) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Authentication service not available.',
      });
    }

    // Verify JWT token
    const tokenPayload = authService.verifyToken(token);
    if (!tokenPayload) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token.',
      });
    }

    // Check role requirements
    if (options.requiredRoles && !options.requiredRoles.includes(tokenPayload.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Insufficient permissions. Required roles: ${options.requiredRoles.join(', ')}`,
      });
    }

    // Set auth context
    request.auth = {
      role: tokenPayload.role,
      sessionId: tokenPayload.userId || tokenPayload.apiKeyId,
      authenticated: true,
    };
  };
};

// Fastify plugin for auth
export const authPlugin = async (fastify: FastifyInstance) => {
  // Register auth decorator
  fastify.decorateRequest('auth', undefined);

  // Add helper method to check auth
  fastify.decorate('requireAuth', (options: AuthPluginOptions = {}) => {
    return authMiddleware(options);
  });

  // Add helper method to check if auth is enabled
  fastify.decorate('isAuthEnabled', () => {
    return fastify.config.auth?.enabled || false;
  });
};

// Helper function to create role-specific middleware
export const requireRole = (...roles: Role[]) => {
  return authMiddleware({ requiredRoles: roles });
};

// Helper function to create admin-only middleware
export const requireAdmin = () => {
  return authMiddleware({ requiredRoles: [Role.ADMIN] });
};

// Helper function to create read-only or admin middleware
export const requireReadAccess = () => {
  return authMiddleware({ requiredRoles: [Role.READ_ONLY, Role.ADMIN] });
};

// Extend FastifyInstance type
declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (
      options?: AuthPluginOptions
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    isAuthEnabled: () => boolean;
  }
}
