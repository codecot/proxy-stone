import type { FastifyInstance } from "fastify";
import { DatabaseError } from "../../../types/errors.js";
import { StorageFactory } from "../../../database/storage-factory.js";
import {
  StorageAdapter,
  StorageConfig,
  StorageType,
} from "../../../database/types.js";

export interface LoggedRequest {
  id?: string; // Changed from number to string for better storage plugin compatibility
  timestamp: string;
  method: string;
  originalUrl: string;
  targetUrl: string;
  backendHost: string;
  backendPath: string;
  statusCode: number;
  responseTime: number;
  dnsTiming?: number;
  connectTiming?: number;
  ttfbTiming?: number;
  processingTime?: number;
  requestHeaders: string; // JSON string
  responseHeaders: string; // JSON string
  requestBody?: string; // JSON string
  responseBody?: string; // JSON string (truncated if too large)
  queryParams?: string; // JSON string of query parameters
  routeParams?: string; // JSON string of route parameters
  cacheHit: boolean;
  cacheKey?: string; // Cache key for linking to cache files
  cacheTTL?: number; // Cache TTL used
  userAgent?: string;
  clientIp?: string;
  errorMessage?: string;
  requestSize?: number; // Request body size in bytes
  responseSize?: number; // Response body size in bytes
  contentType?: string; // Request content type
  responseContentType?: string; // Response content type
  createdAt?: string; // ISO timestamp for creation
  updatedAt?: string; // ISO timestamp for last update
}

export interface RequestFilters {
  method?: string;
  statusCode?: number;
  dateFrom?: string;
  dateTo?: string;
  url?: string;
  cacheHit?: boolean;
  cacheKey?: string;
  limit?: number;
  offset?: number;
}

export interface RequestStats {
  totalRequests: number;
  cacheHitRate: number;
  avgResponseTime: number;
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  topUrls: Array<{ url: string; count: number }>;
  topCacheKeys: Array<{ cacheKey: string; count: number }>;
}

export class RequestLoggerService {
  private app: FastifyInstance;
  private enabled: boolean;
  private storageConfig: StorageConfig;
  private storage: StorageAdapter<LoggedRequest> | null = null;
  private maxBodySize: number = 10000; // Max body size to store (10KB)
  private requestCounter: number = 0; // For generating unique IDs

  constructor(
    app: FastifyInstance,
    enabled: boolean,
    storageConfig: StorageConfig
  ) {
    this.app = app;
    this.enabled = enabled;
    this.storageConfig = storageConfig;
  }

  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          // Initialize storage using the plugin system
          this.storage =
            await StorageFactory.createStorageAdapter<LoggedRequest>(
              this.storageConfig
            );
          await this.storage.initialize();
        },
        "database",
        { operation: "request-logger-initialization" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(
        error,
        {
          operation: "request-logger.initialize",
          context: { storageConfig: this.storageConfig },
        },
        ["critical"]
      );
      throw new DatabaseError(
        "Failed to initialize request logger storage",
        "STORAGE_INIT_ERROR",
        500,
        { storageConfig: this.storageConfig }
      );
    }
  }

  async logRequest(loggedRequest: LoggedRequest): Promise<void> {
    if (!this.enabled || !this.storage) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          // Generate unique ID if not provided
          const id = loggedRequest.id || this.generateRequestId();

          // Prepare the request data
          const requestData: LoggedRequest = {
            ...loggedRequest,
            id,
            requestBody: this.truncateBody(loggedRequest.requestBody),
            responseBody: this.truncateBody(loggedRequest.responseBody),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Save to storage
          await this.storage!.save(id, requestData, {
            ttl: this.getTTLForRequest(requestData),
            metadata: {
              method: requestData.method,
              statusCode: requestData.statusCode,
              cacheHit: requestData.cacheHit,
              timestamp: requestData.timestamp,
            },
          });
        },
        "database",
        { operation: "request-logger.log" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.log",
        context: { requestId: loggedRequest.id },
      });
      // Don't throw - logging failures shouldn't affect the main request flow
    }
  }

  async getStats(): Promise<any> {
    if (!this.enabled || !this.storage) {
      return { enabled: false };
    }

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          // Get storage stats
          const storageStats = await this.storage!.getStats();

          // Get all requests for detailed stats calculation
          const allRequests = await this.storage!.find({});

          const errorRequests = allRequests.filter((req) => req.errorMessage);
          const avgDuration =
            allRequests.length > 0
              ? allRequests.reduce((sum, req) => sum + req.responseTime, 0) /
                allRequests.length
              : 0;

          return {
            enabled: true,
            total: storageStats.totalItems,
            errors: errorRequests.length,
            avgDuration: Math.round(avgDuration),
            errorRate:
              allRequests.length > 0
                ? (errorRequests.length / allRequests.length) * 100
                : 0,
            storageType: this.storage!.getStorageType(),
            storageStats,
          };
        },
        "database",
        { operation: "request-logger.stats" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.stats",
      });
      throw new DatabaseError(
        "Failed to get request logger stats",
        "STORAGE_QUERY_ERROR",
        500
      );
    }
  }

  async clearOldRequests(days: number): Promise<number> {
    if (!this.enabled || !this.storage) return 0;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffISO = cutoff.toISOString();

          // Get all requests and filter by date
          const allRequests = await this.storage!.find({});
          const oldRequests = allRequests.filter(
            (req) => req.timestamp < cutoffISO
          );

          // Delete old requests
          const keysToDelete = oldRequests.map((req) => req.id!);
          const deletedCount = await this.storage!.deleteBatch(keysToDelete);

          return deletedCount;
        },
        "database",
        { operation: "request-logger.clear-old" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.clear-old",
        context: { days },
      });
      throw new DatabaseError(
        "Failed to clear old request logs",
        "STORAGE_CLEANUP_ERROR",
        500,
        { days }
      );
    }
  }

  async getRequests(filters?: RequestFilters): Promise<LoggedRequest[]> {
    if (!this.enabled || !this.storage) return [];

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          // Get all requests first
          let requests = await this.storage!.find({});

          // Apply filters
          if (filters) {
            requests = this.applyFilters(requests, filters);
          }

          // Sort by timestamp (newest first)
          requests.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          // Apply pagination
          if (filters?.offset) {
            requests = requests.slice(filters.offset);
          }
          if (filters?.limit) {
            requests = requests.slice(0, filters.limit);
          }

          return requests;
        },
        "database",
        { operation: "request-logger.get-requests" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.get-requests",
        context: { filters },
      });
      throw new DatabaseError(
        "Failed to get request logs",
        "STORAGE_QUERY_ERROR",
        500
      );
    }
  }

  async clearAllRequests(): Promise<number> {
    if (!this.enabled || !this.storage) return 0;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          // Get all request keys
          const allRequests = await this.storage!.find({});
          const keys = allRequests.map((req) => req.id!);

          // Delete all requests
          return await this.storage!.deleteBatch(keys);
        },
        "database",
        { operation: "request-logger.clear-all" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.clear-all",
      });
      throw new DatabaseError(
        "Failed to clear all request logs",
        "STORAGE_CLEANUP_ERROR",
        500
      );
    }
  }

  async getCacheFileForRequest(id: string): Promise<string | null> {
    if (!this.enabled || !this.storage) return null;

    try {
      return await this.app?.recovery.withRetry(
        async () => {
          const request = await this.storage!.get(id);
          return request?.cacheKey || null;
        },
        "database",
        { operation: "request-logger.get-cache-file" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.get-cache-file",
        context: { id },
      });
      throw new DatabaseError(
        "Failed to get cache file for request",
        "STORAGE_QUERY_ERROR",
        500
      );
    }
  }

  async close(): Promise<void> {
    if (!this.enabled || !this.storage) return;

    try {
      await this.app?.recovery.withRetry(
        async () => {
          await this.storage!.close();
        },
        "database",
        { operation: "request-logger.close" }
      );
    } catch (error) {
      this.app?.errorTracker.trackError(error, {
        operation: "request-logger.close",
      });
      // Don't throw - cleanup failures shouldn't affect shutdown
    }
  }

  /**
   * Private helper to truncate large body content
   */
  private truncateBody(body: any): string | undefined {
    if (!body) return undefined;

    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);

    if (bodyStr.length > this.maxBodySize) {
      return bodyStr.substring(0, this.maxBodySize) + "... [TRUNCATED]";
    }

    return bodyStr;
  }

  /**
   * Private helper to generate unique request IDs
   */
  private generateRequestId(): string {
    this.requestCounter++;
    return `req_${Date.now()}_${this.requestCounter}`;
  }

  /**
   * Private helper to get TTL for request storage
   */
  private getTTLForRequest(request: LoggedRequest): number | undefined {
    // Keep error requests longer (7 days)
    if (request.errorMessage || request.statusCode >= 400) {
      return 7 * 24 * 60 * 60; // 7 days in seconds
    }

    // Keep successful requests for 30 days by default
    return 30 * 24 * 60 * 60; // 30 days in seconds
  }

  /**
   * Private helper to apply filters to requests
   */
  private applyFilters(
    requests: LoggedRequest[],
    filters: RequestFilters
  ): LoggedRequest[] {
    return requests.filter((request) => {
      if (filters.method && request.method !== filters.method.toUpperCase()) {
        return false;
      }

      if (filters.statusCode && request.statusCode !== filters.statusCode) {
        return false;
      }

      if (filters.dateFrom && request.timestamp < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && request.timestamp > filters.dateTo) {
        return false;
      }

      if (filters.url && !request.originalUrl.includes(filters.url)) {
        return false;
      }

      if (
        filters.cacheHit !== undefined &&
        request.cacheHit !== filters.cacheHit
      ) {
        return false;
      }

      if (filters.cacheKey && request.cacheKey !== filters.cacheKey) {
        return false;
      }

      return true;
    });
  }
}
