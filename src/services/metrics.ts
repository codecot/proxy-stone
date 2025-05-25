import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import type { FastifyInstance } from 'fastify';

export class MetricsService {
  private registry: Registry;
  private requestCounter: Counter;
  private requestDuration: Histogram;
  private errorCounter: Counter;
  private cacheHitCounter: Counter;
  private cacheMissCounter: Counter;
  private activeConnections: Gauge;
  private memoryUsage: Gauge;
  private cpuUsage: Gauge;

  constructor() {
    this.registry = new Registry();

    // Request metrics
    this.requestCounter = new Counter({
      name: 'proxy_requests_total',
      help: 'Total number of requests processed',
      labelNames: ['method', 'path', 'status_code'],
    });

    this.requestDuration = new Histogram({
      name: 'proxy_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    this.errorCounter = new Counter({
      name: 'proxy_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'path'],
    });

    // Cache metrics
    this.cacheHitCounter = new Counter({
      name: 'proxy_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['path'],
    });

    this.cacheMissCounter = new Counter({
      name: 'proxy_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['path'],
    });

    // System metrics
    this.activeConnections = new Gauge({
      name: 'proxy_active_connections',
      help: 'Number of active connections',
    });

    this.memoryUsage = new Gauge({
      name: 'proxy_memory_usage_bytes',
      help: 'Memory usage in bytes',
    });

    this.cpuUsage = new Gauge({
      name: 'proxy_cpu_usage_percent',
      help: 'CPU usage percentage',
    });

    // Register all metrics
    this.registry.registerMetric(this.requestCounter);
    this.registry.registerMetric(this.requestDuration);
    this.registry.registerMetric(this.errorCounter);
    this.registry.registerMetric(this.cacheHitCounter);
    this.registry.registerMetric(this.cacheMissCounter);
    this.registry.registerMetric(this.activeConnections);
    this.registry.registerMetric(this.memoryUsage);
    this.registry.registerMetric(this.cpuUsage);
  }

  // Request tracking methods
  incrementRequest(method: string, path: string, statusCode: number) {
    this.requestCounter.inc({ method, path, status_code: statusCode.toString() });
  }

  observeRequestDuration(method: string, path: string, duration: number) {
    this.requestDuration.observe({ method, path }, duration);
  }

  incrementError(type: string, path: string) {
    this.errorCounter.inc({ type, path });
  }

  // Cache tracking methods
  incrementCacheHit(path: string) {
    this.cacheHitCounter.inc({ path });
  }

  incrementCacheMiss(path: string) {
    this.cacheMissCounter.inc({ path });
  }

  // System metrics methods
  updateActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  updateMemoryUsage(bytes: number) {
    this.memoryUsage.set(bytes);
  }

  updateCpuUsage(percent: number) {
    this.cpuUsage.set(percent);
  }

  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Initialize metrics collection
  initialize(app: FastifyInstance) {
    // Update system metrics every 5 seconds
    setInterval(() => {
      const usage = process.memoryUsage();
      this.updateMemoryUsage(usage.heapUsed);

      // Note: CPU usage requires more complex calculation
      // This is a simplified version
      const cpuUsage = process.cpuUsage();
      const totalCpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage
      this.updateCpuUsage(totalCpuUsage);
    }, 5000);

    // Add metrics endpoint
    app.get('/metrics', async (request, reply) => {
      try {
        const metrics = await this.getMetrics();
        reply.header('Content-Type', this.registry.contentType);
        return metrics;
      } catch (error) {
        app.log.error('Error getting metrics:', error);
        reply.status(500);
        return { error: 'Failed to get metrics' };
      }
    });
  }
}
