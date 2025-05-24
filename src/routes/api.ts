import { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiResponse } from '../types/index.js';

// Define a generic type for params for our wildcard route
interface WildcardRouteParams {
  '*': string;
}

export async function apiRoutes(fastify: FastifyInstance) {
  const apiRoutePath = `${fastify.config.apiPrefix}/*`;

  fastify.log.info(`Registering API routes under: ${apiRoutePath}`);

  // API route handler for all methods and paths under the configured apiPrefix
  fastify.all(
    apiRoutePath,
    async (request: FastifyRequest<{ Params: WildcardRouteParams }>, reply) => {
      const method = request.method;
      const url = request.url; // This is the full path with query string
      const headers = request.headers;
      const body = request.body;
      const query = request.query; // Parsed query string object
      const params = request.params; // Parsed path parameters object (will contain a '*' property)

      fastify.log.info(
        {
          method,
          url,
          query,
          params,
          headers,
          body,
        },
        'API Request received'
      );

      const response: ApiResponse = {
        method,
        url, // Full URL as requested
        headers: headers as Record<string, string>,
        body,
        query,
        params,
        timestamp: new Date().toISOString(),
      };

      return response;
    }
  );
}
