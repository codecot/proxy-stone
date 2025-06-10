import type { FastifyInstance } from 'fastify';
import type { CacheService } from "@/services/cache.js";
import type { RequestLoggerService } from '@/modules/monitoring/services/request-logger.js';
import type { SnapshotManager } from '@/modules/recovery/services/snapshot-manager.js';
import type { MetricsService } from '@/modules/monitoring/services/metrics.js';

export class HealthService {
  private app: FastifyInstance;
  private cache: CacheService;
  private requestLogger: RequestLoggerService;
  private snapshotManager: SnapshotManager;
  private metrics: MetricsService;

  constructor(app: FastifyInstance) {
    this.app = app;
    this.cache = app.cache;
    this.requestLogger = app.requestLogger;
    this.snapshotManager = app.snapshotManager;
    this.metrics = app.metrics!;
  }

  async getHealthStatus() {
    const startTime = Date.now();
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        cache: await this.checkCacheHealth(),
        database: await this.checkDatabaseHealth(),
        requestLogger: await this.checkRequestLoggerHealth(),
        snapshotManager: await this.checkSnapshotManagerHealth(),
      },
      metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        activeConnections: this.app.server.connections || 0,
      },
      responseTime: Date.now() - startTime,
    };

    // Check if any service is unhealthy
    const unhealthyServices = Object.entries(status.services)
      .filter(([_, service]) => service.status !== 'ok')
      .map(([name]) => name);

    if (unhealthyServices.length > 0) {
      status.status = 'degraded';
    }

    return status;
  }

  private async checkCacheHealth() {
    try {
      const stats = await this.cache.getStats();
      return {
        status: 'ok',
        stats: {
          hits: stats.memory.totalHits || 0,
          misses: stats.memory.totalMisses || 0,
          hitRate: stats.memory.hitRate || 0,
          size: stats.memory.size || 0,
          memoryUsage: stats.memory.size || 0,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkDatabaseHealth() {
    try {
      // Check if we can perform a simple database operation
      const stats = await this.snapshotManager.getStats();
      return {
        status: 'ok',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRequestLoggerHealth() {
    try {
      // Check if request logger is initialized and working
      const stats = await this.requestLogger.getStats();
      return {
        status: 'ok',
        enabled: true,
        stats,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkSnapshotManagerHealth() {
    try {
      const stats = await this.snapshotManager.getStats();
      return {
        status: 'ok',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
