import { FastifyInstance as OriginalFastifyInstance, FastifyRequest } from 'fastify';

// Utility function to safely convert Fastify headers to a serializable format
export function normalizeHeaders(
  headers: FastifyRequest['headers']
): Record<string, string | string[]> {
  const normalized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body: unknown;
  query: FastifyRequest['query'];
  params: FastifyRequest['params'];
}

export interface ApiResponse extends ApiRequest {
  timestamp: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  apiPrefix: string;
}

// Extend FastifyInstance to include the decorated config property
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
  }
}

// Use the augmented FastifyInstance type
export type AppInstance = OriginalFastifyInstance;
