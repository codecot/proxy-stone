import { FastifyInstance as OriginalFastifyInstance, FastifyRequest } from 'fastify';

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
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
