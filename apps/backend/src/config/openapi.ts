import { FastifyDynamicSwaggerOptions } from "@fastify/swagger";

export function createOpenApiConfig(host: string, port: number): FastifyDynamicSwaggerOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const serverUrl = `http://${host}:${port}`;
  
  return {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "Proxy Stone - Internal Service API",
      description: "Internal management API for the proxy service (health, metrics, cache, auth, cluster management)",
      version: "1.0.0",
      contact: {
        name: "Proxy Stone Team",
        url: "https://github.com/codecot/proxy-stone",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: serverUrl,
        description: `${isProduction ? 'Production' : 'Development'} server (current)`,
      },
    ],
    tags: [
      {
        name: "general",
        description: "General service endpoints and landing pages",
      },
      {
        name: "health",
        description: "Health and status monitoring endpoints",
      },
      {
        name: "cache",
        description: "Cache management and monitoring endpoints",
      },
      {
        name: "metrics",
        description: "Performance metrics and monitoring endpoints",
      },
      {
        name: "auth",
        description: "Authentication and authorization endpoints",
      },
      {
        name: "cluster",
        description: "Cluster management and node discovery endpoints",
      },
      {
        name: "documentation",
        description: "Dynamic API documentation based on proxy logs",
      },
    ],
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
          },
        },
        HealthStatus: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "degraded", "unhealthy"] },
            timestamp: { type: "string", format: "date-time" },
            uptime: { type: "number" },
            services: { type: "object" },
            metrics: { type: "object" },
            responseTime: { type: "number" },
          },
        },
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  hideUntagged: true,
  };
}

export function createSwaggerUiConfig(host: string, port: number) {
  const serverUrl = `http://${host}:${port}`;
  
  return {
  routePrefix: "/docs/internal",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false, // Disable deep linking to reduce JS complexity
    defaultModelsExpandDepth: 1, // Reduce from 2 to 1
    defaultModelExpandDepth: 1, // Reduce from 2 to 1
    displayRequestDuration: true,
    filter: true,
    showExtensions: false,
    showCommonExtensions: false,
    tryItOutEnabled: true,
  },
  uiHooks: {
    onRequest: function (request: any, reply: any, next: any) {
      // Add cache headers for static assets
      if (request.url.includes('/docs/static/')) {
        reply.header('Cache-Control', 'public, max-age=86400'); // 24 hours
        reply.header('ETag', '"static-assets"');
      }
      next();
    },
    preHandler: function (request: any, reply: any, next: any) {
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header: string) => header,
  transformSpecification: (swaggerObject: any, request: any, reply: any) => {
    // Update servers with actual request host/port and simplify the spec
    const actualHost = request.headers.host || 'localhost:4008';
    const protocol = request.headers['x-forwarded-proto'] || (request.socket?.encrypted ? 'https' : 'http');
    const actualUrl = `${protocol}://${actualHost}`;
    
    // Debug logging
    console.log('OpenAPI Transform Debug:', {
      host: request.headers.host,
      protocol,
      actualUrl,
      allHeaders: Object.keys(request.headers)
    });
    
    return {
      ...swaggerObject,
      info: {
        ...swaggerObject.info,
        description: "High-performance HTTP proxy service with caching and monitoring",
      },
      servers: [
        {
          url: actualUrl,
          description: `${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'} server (current)`,
        }
      ]
    };
  },
  transformSpecificationClone: false, // Disable cloning for better performance
  };
}