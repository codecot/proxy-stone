import { FastifyInstance } from 'fastify';
import { requireAdmin, requireReadAccess } from '../plugins/auth.js';
import { Role } from '../types/index.js';

interface LoginRequest {
  username: string;
  password: string;
}

interface CreateUserRequest {
  username: string;
  password: string;
  role: Role;
}

interface CreateApiKeyRequest {
  name: string;
  role: Role;
  expiresInDays?: number;
}

export async function authRoutes(fastify: FastifyInstance) {
  // GET /auth/status - Check authentication status (no auth required)
  fastify.get("/auth/status", async (request, reply) => {
    const authConfig = fastify.config.auth;

    return {
      auth_enabled: authConfig?.enabled ?? false,
      user_auth_enabled: authConfig?.enableUserAuth ?? false,
      authenticated: request.auth?.authenticated ?? false,
      role: request.auth?.role ?? Role.USER,
      user_id: request.auth?.sessionId,
      protected_paths: authConfig?.protectedPaths ?? [],
      jwt_enabled: !!authConfig?.jwt,
    };
  });

  // POST /auth/login - Login with username/password
  fastify.post<{ Body: LoginRequest }>(
    "/auth/login",
    async (request, reply) => {
      const authConfig = fastify.config.auth;
      const authService = (fastify as any).authService;

      if (!authConfig?.enabled || !authConfig.enableUserAuth) {
        reply.status(503);
        return { error: "User authentication not enabled" };
      }

      const body = request.body as LoginRequest;
      const username = body.username ?? "";
      const password = body.password ?? "";

      if (!username || !password) {
        reply.status(400);
        return { error: "Username and password required" };
      }

      try {
        const result = authService.authenticateUser(
          username,
          password,
          authConfig.users,
          request.ip
        );

        if (!result) {
          reply.status(401);
          return { error: "Invalid credentials" };
        }

        const user = result.user as {
          id: string;
          username: string;
          role: Role;
        };
        return {
          message: "Login successful",
          access_token: result.token,
          token_type: "Bearer",
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
        };
      } catch (error) {
        reply.status(429); // Too Many Requests
        return {
          error:
            error instanceof Error ? error.message : "Authentication failed",
          retry_after: `${Math.ceil(authConfig.lockoutDuration / 60)} minutes`,
        };
      }
    }
  );

  // POST /auth/logout - Logout and revoke token
  fastify.post("/auth/logout", async (request, reply) => {
    const authService = (fastify as any).authService;
    const token =
      request.headers.authorization?.replace("Bearer ", "") ??
      (request.headers["x-access-token"] as string);

    if (token) {
      authService.revokeToken(token);
    }

    return { message: "Logged out successfully" };
  });

  // GET /auth/test-protected - Test endpoint that requires read access
  fastify.get(
    "/auth/test-protected",
    { preHandler: requireReadAccess() },
    async (request, reply) => {
      return {
        message: "Access granted! You have read permissions.",
        auth: request.auth,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // GET /auth/test-admin - Test endpoint that requires admin access
  fastify.get(
    "/auth/test-admin",
    { preHandler: requireAdmin() },
    async (request, reply) => {
      return {
        message: "Access granted! You have admin permissions.",
        auth: request.auth,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // POST /auth/users - Create new user (admin only)
  fastify.post<{ Body: CreateUserRequest }>(
    "/auth/users",
    { preHandler: requireAdmin() },
    async (request, reply) => {
      const authService = (fastify as any).authService;
      const authConfig = fastify.config.auth;

      if (!authConfig?.enableUserAuth) {
        reply.status(503);
        return { error: "User authentication not enabled" };
      }

      const { username, password, role } = request.body;

      if (!username || !password || !role) {
        reply.status(400);
        return { error: "Username, password, and role required" };
      }

      // Check if user already exists
      const existingUser = authConfig.users.find(
        (u) => u.username === username
      );
      if (existingUser) {
        reply.status(409);
        return { error: "Username already exists" };
      }

      const newUser = authService.createUser(username, password, role);

      // Add to config (in production, this would be stored in database)
      authConfig.users.push(newUser);

      return {
        message: "User created successfully",
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          enabled: newUser.enabled,
          createdAt: newUser.createdAt,
        },
      };
    }
  );

  // POST /auth/api-keys - Create new API key (admin only)
  fastify.post<{ Body: CreateApiKeyRequest }>(
    "/auth/api-keys",
    { preHandler: requireAdmin() },
    async (request, reply) => {
      const authService = (fastify as any).authService;
      const authConfig = fastify.config.auth;

      const { name, role, expiresInDays } = request.body;

      if (!name || !role) {
        reply.status(400);
        return { error: "Name and role required" };
      }

      const { apiKey, plainKey } = authService.createApiKey(
        name,
        role,
        expiresInDays
      );

      // Add to config (in production, this would be stored in database)
      authConfig!.apiKeys.push(apiKey);

      return {
        message: "API key created successfully",
        api_key: plainKey, // Only shown once!
        key_info: {
          id: apiKey.id,
          name: apiKey.name,
          role: apiKey.role,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
        warning: "Save this API key now. It will not be shown again.",
      };
    }
  );

  // GET /auth/api-keys - List API keys (admin only, without exposing actual keys)
  fastify.get(
    "/auth/api-keys",
    { preHandler: requireAdmin() },
    async (request, reply) => {
      const authConfig = fastify.config.auth;

      if (!authConfig?.enabled) {
        reply.status(503);
        return { error: "Authentication not enabled" };
      }

      return {
        keys: authConfig.apiKeys.map((key) => ({
          id: key.id,
          name: key.name || "Unnamed",
          role: key.role,
          enabled: key.enabled !== false,
          createdAt: key.createdAt,
          lastUsed: key.lastUsed,
          expiresAt: key.expiresAt,
          key_preview: `${key.keyHash.substring(0, 8)}...`,
        })),
        total: authConfig.apiKeys.length,
      };
    }
  );

  // GET /auth/users - List users (admin only)
  fastify.get('/auth/users', { preHandler: requireAdmin() }, async (request, reply) => {
    const authConfig = fastify.config.auth;

    if (!authConfig?.enableUserAuth) {
      reply.status(503);
      return { error: 'User authentication not enabled' };
    }

    return {
      users: authConfig.users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        enabled: user.enabled,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      })),
      total: authConfig.users.length,
    };
  });

  // GET /auth/stats - Get authentication statistics (admin only)
  fastify.get('/auth/stats', { preHandler: requireAdmin() }, async (request, reply) => {
    const authService = (fastify as any).authService;

    return {
      stats: authService.getAuthStats(),
      message: 'Authentication statistics retrieved',
    };
  });
}
