import { FastifyInstance } from "fastify";
import { DynamicOpenAPIService } from "@/services/dynamic-openapi.js";

export async function dynamicDocsRoutes(fastify: FastifyInstance) {
  const dynamicOpenAPI = new DynamicOpenAPIService(fastify);

  // Get dynamic OpenAPI spec based on proxy logs
  fastify.get("/docs/dynamic/json", {
    schema: {
      tags: ["documentation"],
      summary: "Get dynamic OpenAPI specification",
      description: "Generate OpenAPI documentation based on actual proxied API requests",
      responses: {
        200: {
          description: "Dynamic OpenAPI specification",
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "OpenAPI 3.0 specification generated from proxy logs",
              },
            },
          },
        },
        500: {
          description: "Error generating specification",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const spec = await dynamicOpenAPI.generateOpenAPISpec();
      
      // Update servers with actual request information
      const actualHost = request.headers.host || 'localhost';
      const protocol = request.headers['x-forwarded-proto'] || (request.socket.encrypted ? 'https' : 'http');
      const actualUrl = `${protocol}://${actualHost}`;
      
      spec.servers = [
        {
          url: fastify.config.targetUrl,
          description: "Target server (via proxy)",
        },
        {
          url: `${actualUrl}${fastify.config.apiPrefix}`,
          description: "Proxy server (current)",
        },
      ];
      
      reply.header('Content-Type', 'application/json');
      return spec;
    } catch (error) {
      fastify.log.error("Error generating dynamic OpenAPI spec:", error);
      reply.status(500);
      return {
        error: "Failed to generate dynamic documentation",
        message: "Unable to analyze proxy logs for API discovery",
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Get dynamic documentation as HTML (Swagger UI)
  fastify.get("/docs/dynamic", {
    schema: {
      tags: ["documentation"],
      summary: "View dynamic API documentation",
      description: "Interactive Swagger UI for APIs discovered through proxy logs",
      responses: {
        200: {
          description: "HTML page with Swagger UI",
          content: {
            "text/html": {
              schema: { type: "string" },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Generate HTML page with Swagger UI pointing to our dynamic spec
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dynamic API Documentation - Proxy Stone</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    .swagger-ui .topbar { display: none; }
    .dynamic-docs-header {
      background: #1f2937;
      color: white;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .stats-banner {
      background: #059669;
      color: white;
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="dynamic-docs-header">
    <h1>🌐 External APIs Documentation</h1>
    <p>Auto-generated documentation for <strong>external APIs</strong> accessed through the proxy service.</p>
    <small>📋 For internal proxy management API, see <a href="/docs/internal" style="color: #60a5fa;">/docs/internal</a></small>
  </div>
  
  <div class="stats-banner">
    <span id="stats-info">Loading API statistics...</span>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      // Initialize Swagger UI
      const ui = SwaggerUIBundle({
        url: '/docs/dynamic/json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        filter: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        onComplete: function() {
          // Update stats banner after spec loads
          fetch('/docs/dynamic/json')
            .then(res => res.json())
            .then(spec => {
              const pathCount = Object.keys(spec.paths || {}).length;
              const endpointCount = Object.values(spec.paths || {})
                .reduce((count, path) => count + Object.keys(path).length, 0);
              
              document.getElementById('stats-info').innerHTML = 
                \`📊 Discovered \${endpointCount} endpoints across \${pathCount} paths from proxy logs\`;
            })
            .catch(() => {
              document.getElementById('stats-info').innerHTML = 
                '⚠️ Unable to load API statistics';
            });
        }
      });

      window.ui = ui;
    };
  </script>
</body>
</html>
    `;

    reply.header('Content-Type', 'text/html');
    return html;
  });

  // Refresh dynamic documentation cache
  fastify.post("/docs/dynamic/refresh", {
    schema: {
      tags: ["documentation"],
      summary: "Refresh dynamic documentation cache",
      description: "Force regeneration of dynamic OpenAPI specification from latest proxy logs",
      responses: {
        200: {
          description: "Cache refreshed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                  endpointsDiscovered: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Clear cache and regenerate
      dynamicOpenAPI.clearCache();
      const spec = await dynamicOpenAPI.generateOpenAPISpec();
      
      const endpointsDiscovered = Object.values(spec.paths || {})
        .reduce((count, path) => count + Object.keys(path).length, 0);

      return {
        message: "Dynamic documentation cache refreshed",
        timestamp: new Date().toISOString(),
        endpointsDiscovered,
      };
    } catch (error) {
      fastify.log.error("Error refreshing dynamic docs cache:", error);
      reply.status(500);
      return {
        error: "Failed to refresh documentation cache",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Get statistics about discovered APIs
  fastify.get("/docs/dynamic/stats", {
    schema: {
      tags: ["documentation"],
      summary: "Get API discovery statistics",
      description: "Statistics about APIs discovered through proxy request analysis",
      responses: {
        200: {
          description: "API discovery statistics",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  totalRequests: { type: "number" },
                  uniqueEndpoints: { type: "number" },
                  uniquePaths: { type: "number" },
                  backendHosts: { type: "array", items: { type: "string" } },
                  mostUsedEndpoints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        method: { type: "string" },
                        path: { type: "string" },
                        count: { type: "number" },
                        avgResponseTime: { type: "number" },
                      },
                    },
                  },
                  contentTypes: { type: "array", items: { type: "string" } },
                  statusCodeDistribution: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const requestLogger = (fastify as any).requestLogger;
      const requests = await requestLogger.getRequests({ limit: 10000 });
      
      const uniqueEndpoints = new Set<string>();
      const uniquePaths = new Set<string>();
      const backendHosts = new Set<string>();
      const contentTypes = new Set<string>();
      const statusCodes: Record<number, number> = {};
      const endpointCounts: Record<string, { count: number; totalTime: number; method: string; path: string }> = {};

      // Helper function to check if URL is internal
      const isInternalServiceUrl = (url: string): boolean => {
        const internalPaths = ['/api/', '/health', '/metrics', '/docs/', '/cache/', '/auth/', '/cluster/'];
        return internalPaths.some(path => url.startsWith(path));
      };

      for (const request of requests) {
        if (!request.targetUrl || !request.backendPath) continue;
        
        // Skip internal service URLs - only count external APIs
        if (isInternalServiceUrl(request.originalUrl)) continue;

        const endpointKey = `${request.method}:${request.backendPath}`;
        uniqueEndpoints.add(endpointKey);
        uniquePaths.add(request.backendPath);
        
        if (request.backendHost) {
          backendHosts.add(request.backendHost);
        }
        
        if (request.responseContentType) {
          contentTypes.add(request.responseContentType);
        }

        // Status code distribution
        statusCodes[request.statusCode] = (statusCodes[request.statusCode] || 0) + 1;

        // Endpoint usage counts
        if (!endpointCounts[endpointKey]) {
          endpointCounts[endpointKey] = {
            count: 0,
            totalTime: 0,
            method: request.method,
            path: request.backendPath,
          };
        }
        endpointCounts[endpointKey].count++;
        endpointCounts[endpointKey].totalTime += request.responseTime;
      }

      // Get top 10 most used endpoints
      const mostUsedEndpoints = Object.values(endpointCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(endpoint => ({
          method: endpoint.method,
          path: endpoint.path,
          count: endpoint.count,
          avgResponseTime: Math.round(endpoint.totalTime / endpoint.count),
        }));

      return {
        totalRequests: requests.length,
        uniqueEndpoints: uniqueEndpoints.size,
        uniquePaths: uniquePaths.size,
        backendHosts: Array.from(backendHosts),
        mostUsedEndpoints,
        contentTypes: Array.from(contentTypes),
        statusCodeDistribution: statusCodes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error("Error getting dynamic docs stats:", error);
      reply.status(500);
      return {
        error: "Failed to get API discovery statistics",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  });
}