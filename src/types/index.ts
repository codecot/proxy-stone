import { FastifyInstance as OriginalFastifyInstance, FastifyRequest } from 'fastify';
import { CacheService } from '../services/cache.js';
import { RequestLoggerService } from '../services/request-logger.js';

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
  targetUrl: string;
  cacheTTL: number;
  cacheableMethods: string[];
  // File cache options
  enableFileCache: boolean;
  fileCacheDir: string;
  // Request logging options
  enableRequestLogging: boolean;
  requestLogDbPath: string;
}

// Extend FastifyInstance to include the decorated config property
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    cache: CacheService;
    requestLogger: RequestLoggerService;
  }
}

// Use the augmented FastifyInstance type
export type AppInstance = OriginalFastifyInstance;
