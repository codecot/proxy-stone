import { FastifyInstance } from "fastify";
import { RequestLoggerService, LoggedRequest } from "@/modules/monitoring/services/request-logger.js";

interface ApiEndpoint {
  path: string;
  method: string;
  count: number;
  lastSeen: string;
  responseTypes: Set<string>;
  statusCodes: Set<number>;
  avgResponseTime: number;
  cacheHitRate: number;
  backendHost: string;
  sampleRequest?: LoggedRequest;
}

interface DynamicOpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
  };
}

export class DynamicOpenAPIService {
  private app: FastifyInstance;
  private requestLogger: RequestLoggerService;
  private cachedSpec: DynamicOpenAPISpec | null = null;
  private lastUpdate: number = 0;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(app: FastifyInstance) {
    this.app = app;
    this.requestLogger = (app as any).requestLogger;
  }

  /**
   * Generate OpenAPI specification from proxy request logs
   */
  async generateOpenAPISpec(): Promise<DynamicOpenAPISpec> {
    const now = Date.now();
    
    // Return cached spec if still valid
    if (this.cachedSpec && (now - this.lastUpdate) < this.cacheTimeout) {
      return this.cachedSpec;
    }

    const endpoints = await this.analyzeProxyEndpoints();
    const spec = this.buildOpenAPISpec(endpoints);
    
    this.cachedSpec = spec;
    this.lastUpdate = now;
    
    return spec;
  }

  /**
   * Analyze logged requests to discover API endpoints
   */
  private async analyzeProxyEndpoints(): Promise<Map<string, ApiEndpoint>> {
    const requests = await this.requestLogger.getRequests({ limit: 10000 });
    const endpoints = new Map<string, ApiEndpoint>();

    for (const request of requests) {
      if (!request.targetUrl || !request.backendPath) continue;
      
      // Skip internal proxy service URLs - only analyze external APIs
      if (this.isInternalServiceUrl(request.originalUrl)) continue;

      // Create unique key for method + path combination
      const key = `${request.method}:${request.backendPath}`;
      
      if (!endpoints.has(key)) {
        endpoints.set(key, {
          path: request.backendPath,
          method: request.method,
          count: 0,
          lastSeen: request.timestamp,
          responseTypes: new Set(),
          statusCodes: new Set(),
          avgResponseTime: 0,
          cacheHitRate: 0,
          backendHost: request.backendHost,
          sampleRequest: request,
        });
      }

      const endpoint = endpoints.get(key)!;
      endpoint.count++;
      endpoint.statusCodes.add(request.statusCode);
      
      // Track response content types
      if (request.responseContentType) {
        endpoint.responseTypes.add(request.responseContentType);
      }

      // Update average response time
      endpoint.avgResponseTime = 
        (endpoint.avgResponseTime * (endpoint.count - 1) + request.responseTime) / endpoint.count;

      // Calculate cache hit rate
      const cacheHits = Array.from(endpoints.values())
        .filter(e => e.path === endpoint.path && e.method === endpoint.method)
        .reduce((acc, e) => acc + (e.sampleRequest?.cacheHit ? 1 : 0), 0);
      endpoint.cacheHitRate = (cacheHits / endpoint.count) * 100;

      // Keep the most recent request as sample
      if (request.timestamp > endpoint.lastSeen) {
        endpoint.lastSeen = request.timestamp;
        endpoint.sampleRequest = request;
      }
    }

    return endpoints;
  }

  /**
   * Build OpenAPI specification from discovered endpoints
   */
  private buildOpenAPISpec(endpoints: Map<string, ApiEndpoint>): DynamicOpenAPISpec {
    const paths: Record<string, any> = {};
    const schemas: Record<string, any> = {};

    // Group endpoints by path
    const pathGroups = new Map<string, ApiEndpoint[]>();
    for (const endpoint of endpoints.values()) {
      if (!pathGroups.has(endpoint.path)) {
        pathGroups.set(endpoint.path, []);
      }
      pathGroups.get(endpoint.path)!.push(endpoint);
    }

    // Build paths object
    for (const [path, pathEndpoints] of pathGroups) {
      const pathSpec: Record<string, any> = {};

      for (const endpoint of pathEndpoints) {
        const method = endpoint.method.toLowerCase();
        
        pathSpec[method] = {
          summary: `${endpoint.method} ${path}`,
          description: this.generateEndpointDescription(endpoint),
          tags: [this.getTagFromPath(path)],
          parameters: this.extractParameters(endpoint),
          responses: this.generateResponses(endpoint),
          "x-proxy-stats": {
            requestCount: endpoint.count,
            avgResponseTime: Math.round(endpoint.avgResponseTime),
            cacheHitRate: Math.round(endpoint.cacheHitRate * 100) / 100,
            lastSeen: endpoint.lastSeen,
            backendHost: endpoint.backendHost,
          },
        };

        // Add request body schema for methods that typically have bodies
        if (['post', 'put', 'patch'].includes(method)) {
          pathSpec[method].requestBody = this.generateRequestBody(endpoint);
        }
      }

      // Convert path parameters to OpenAPI format
      const openApiPath = this.convertToOpenAPIPath(path);
      paths[openApiPath] = pathSpec;
    }

    return {
      openapi: "3.0.0",
      info: {
        title: "External APIs - Proxied Documentation",
        description: "Auto-generated documentation for external APIs accessed through the proxy service. This documentation is built from real API usage patterns captured by analyzing proxy request logs.",
        version: "1.0.0",
      },
      servers: [
        {
          url: this.app.config.targetUrl,
          description: "Target server (via proxy)",
        },
        {
          url: `http://${this.app.config.host || 'localhost'}:${this.app.config.port}${this.app.config.apiPrefix}`,
          description: "Proxy server (current)",
        },
      ],
      paths,
      components: {
        schemas: {
          Error: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          ...schemas,
        },
      },
    };
  }

  /**
   * Generate endpoint description with proxy statistics
   */
  private generateEndpointDescription(endpoint: ApiEndpoint): string {
    const stats = [
      `Called ${endpoint.count} times`,
      `Avg response: ${Math.round(endpoint.avgResponseTime)}ms`,
      `Cache hit rate: ${Math.round(endpoint.cacheHitRate)}%`,
    ];

    return `Proxied endpoint. ${stats.join(", ")}`;
  }

  /**
   * Extract path and query parameters from sample requests
   */
  private extractParameters(endpoint: ApiEndpoint): any[] {
    const parameters: any[] = [];
    
    if (!endpoint.sampleRequest) return parameters;

    // Extract path parameters
    const pathParams = this.extractPathParameters(endpoint.path);
    for (const param of pathParams) {
      parameters.push({
        name: param,
        in: "path",
        required: true,
        schema: { type: "string" },
        description: `Path parameter (inferred from ${endpoint.count} requests)`,
      });
    }

    // Extract query parameters from sample request
    try {
      const queryParams = endpoint.sampleRequest.queryParams 
        ? JSON.parse(endpoint.sampleRequest.queryParams) 
        : {};
      
      for (const [name, value] of Object.entries(queryParams)) {
        parameters.push({
          name,
          in: "query",
          required: false,
          schema: { type: typeof value },
          description: "Query parameter (from logged requests)",
          example: value,
        });
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }

    return parameters;
  }

  /**
   * Generate response schemas based on observed status codes
   */
  private generateResponses(endpoint: ApiEndpoint): Record<string, any> {
    const responses: Record<string, any> = {};

    for (const statusCode of endpoint.statusCodes) {
      const description = this.getStatusDescription(statusCode);
      
      responses[statusCode.toString()] = {
        description,
        content: this.generateResponseContent(endpoint, statusCode),
      };
    }

    // Always add error responses
    if (!responses["500"]) {
      responses["500"] = {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      };
    }

    return responses;
  }

  /**
   * Generate response content based on observed content types
   */
  private generateResponseContent(endpoint: ApiEndpoint, statusCode: number): Record<string, any> {
    const content: Record<string, any> = {};

    // Use observed content types or default to JSON
    const contentTypes = endpoint.responseTypes.size > 0 
      ? Array.from(endpoint.responseTypes)
      : ["application/json"];

    for (const contentType of contentTypes) {
      content[contentType] = {
        schema: {
          type: "object",
          description: `Response from ${endpoint.backendHost} (${endpoint.count} samples)`,
        },
      };

      // Add example from sample request if available
      if (endpoint.sampleRequest?.responseBody && statusCode === endpoint.sampleRequest.statusCode) {
        try {
          const responseBody = JSON.parse(endpoint.sampleRequest.responseBody);
          content[contentType].example = responseBody;
        } catch (error) {
          // Use raw response if not JSON
          content[contentType].example = endpoint.sampleRequest.responseBody;
        }
      }
    }

    return content;
  }

  /**
   * Generate request body schema for endpoints that accept bodies
   */
  private generateRequestBody(endpoint: ApiEndpoint): any {
    if (!endpoint.sampleRequest?.requestBody) {
      return {
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      };
    }

    try {
      const requestBody = JSON.parse(endpoint.sampleRequest.requestBody);
      return {
        content: {
          "application/json": {
            schema: { type: "object" },
            example: requestBody,
          },
        },
      };
    } catch (error) {
      return {
        content: {
          "text/plain": {
            schema: { type: "string" },
            example: endpoint.sampleRequest.requestBody,
          },
        },
      };
    }
  }

  /**
   * Convert path to OpenAPI format with parameters
   */
  private convertToOpenAPIPath(path: string): string {
    // Convert /users/123/posts/456 style to /users/{id}/posts/{postId}
    return path.replace(/\/\d+/g, (match, offset, str) => {
      // Simple heuristic: if it's a number, make it a parameter
      const parts = str.substring(0, offset).split('/');
      const paramName = parts[parts.length - 1] + 'Id';
      return `/{${paramName}}`;
    });
  }

  /**
   * Extract path parameters from a path string
   */
  private extractPathParameters(path: string): string[] {
    const params: string[] = [];
    const openApiPath = this.convertToOpenAPIPath(path);
    const matches = openApiPath.match(/\{([^}]+)\}/g);
    
    if (matches) {
      for (const match of matches) {
        params.push(match.slice(1, -1)); // Remove { and }
      }
    }
    
    return params;
  }

  /**
   * Get appropriate tag for grouping endpoints
   */
  private getTagFromPath(path: string): string {
    const parts = path.split('/').filter(p => p && !p.match(/^\d+$/));
    return parts[0] || 'default';
  }

  /**
   * Get human-readable description for HTTP status codes
   */
  private getStatusDescription(statusCode: number): string {
    const descriptions: Record<number, string> = {
      200: "Success",
      201: "Created",
      204: "No Content",
      400: "Bad Request",
      401: "Unauthorized", 
      403: "Forbidden",
      404: "Not Found",
      409: "Conflict",
      422: "Unprocessable Entity",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
    };

    return descriptions[statusCode] || `HTTP ${statusCode}`;
  }

  /**
   * Check if a URL is an internal service endpoint (not a proxied external API)
   */
  private isInternalServiceUrl(url: string): boolean {
    const internalPaths = [
      '/api/',           // Internal API endpoints
      '/health',         // Health endpoints
      '/metrics',        // Metrics endpoints
      '/docs/',          // Documentation endpoints
      '/cache/',         // Cache management (if direct)
      '/auth/',          // Auth endpoints (if direct)
      '/cluster/',       // Cluster endpoints (if direct)
    ];

    return internalPaths.some(path => url.startsWith(path));
  }

  /**
   * Clear the cached specification (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedSpec = null;
    this.lastUpdate = 0;
  }
}