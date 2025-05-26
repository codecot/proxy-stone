import axios, { AxiosError } from 'axios';
import { HealthMonitor, ServiceInstance, HealthCheckResult, ServiceStatus } from '../types.js';
import { Logger } from '@proxy-stone/logger';
import * as cron from 'node-cron';

export class ServiceHealthMonitor implements HealthMonitor {
  private logger: Logger;
  private services: Map<string, ServiceInstance> = new Map();
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private healthCallbacks: ((result: HealthCheckResult) => void)[] = [];
  private monitoringTask: cron.ScheduledTask | null = null;
  private config: {
    interval: number;
    timeout: number;
    retries: number;
    gracePeriod: number;
  };

  constructor(config: {
    interval?: number;
    timeout?: number;
    retries?: number;
    gracePeriod?: number;
  } = {}) {
    this.logger = new Logger('ServiceHealthMonitor');
    this.config = {
      interval: config.interval || 30,
      timeout: config.timeout || 5,
      retries: config.retries || 3,
      gracePeriod: config.gracePeriod || 60
    };
  }

  async startMonitoring(services: ServiceInstance[]): Promise<void> {
    // Update services map
    for (const service of services) {
      this.services.set(service.id, service);
    }

    // Stop existing monitoring
    if (this.monitoringTask) {
      this.monitoringTask.stop();
    }

    // Start periodic health checks
    const cronExpression = `*/${this.config.interval} * * * * *`; // Every N seconds
    this.monitoringTask = cron.schedule(cronExpression, async () => {
      await this.performHealthChecks();
    }, {
      scheduled: false
    });

    this.monitoringTask.start();
    this.logger.info(`Health monitoring started for ${services.length} services`);

    // Perform initial health check
    await this.performHealthChecks();
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringTask) {
      this.monitoringTask.stop();
      this.monitoringTask = null;
    }
    this.services.clear();
    this.healthResults.clear();
    this.logger.info('Health monitoring stopped');
  }

  async checkHealth(service: ServiceInstance): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt < this.config.retries) {
      try {
        const response = await axios.get(service.healthCheckUrl, {
          timeout: this.config.timeout * 1000,
          headers: {
            'User-Agent': 'proxy-stone-health-monitor',
            'Accept': 'application/json'
          }
        });

        const responseTime = Date.now() - startTime;
        const result: HealthCheckResult = {
          serviceId: service.id,
          status: this.determineStatusFromResponse(response.status, response.data),
          responseTime,
          timestamp: Date.now(),
          details: {
            httpStatus: response.status,
            responseData: response.data,
            attempt: attempt + 1
          }
        };

        this.healthResults.set(service.id, result);
        return result;

      } catch (error) {
        attempt++;
        const axiosError = error as AxiosError;
        lastError = axiosError.message || 'Unknown error';
        
        if (attempt < this.config.retries) {
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // All retries failed
    const responseTime = Date.now() - startTime;
    const result: HealthCheckResult = {
      serviceId: service.id,
      status: ServiceStatus.UNHEALTHY,
      responseTime,
      error: lastError,
      timestamp: Date.now(),
      details: {
        attempts: this.config.retries,
        lastError
      }
    };

    this.healthResults.set(service.id, result);
    return result;
  }

  async getHealthStatus(serviceId: string): Promise<HealthCheckResult | null> {
    return this.healthResults.get(serviceId) || null;
  }

  onHealthChange(callback: (result: HealthCheckResult) => void): void {
    this.healthCallbacks.push(callback);
  }

  // Add or update a service for monitoring
  addService(service: ServiceInstance): void {
    this.services.set(service.id, service);
    this.logger.info(`Added service to monitoring: ${service.id}`);
  }

  // Remove a service from monitoring
  removeService(serviceId: string): void {
    this.services.delete(serviceId);
    this.healthResults.delete(serviceId);
    this.logger.info(`Removed service from monitoring: ${serviceId}`);
  }

  // Get all current health statuses
  getAllHealthStatuses(): Map<string, HealthCheckResult> {
    return new Map(this.healthResults);
  }

  // Get services by health status
  getServicesByStatus(status: ServiceStatus): ServiceInstance[] {
    const result: ServiceInstance[] = [];
    for (const [serviceId, healthResult] of this.healthResults) {
      if (healthResult.status === status) {
        const service = this.services.get(serviceId);
        if (service) {
          result.push(service);
        }
      }
    }
    return result;
  }

  private async performHealthChecks(): Promise<void> {
    const services = Array.from(this.services.values());
    const promises = services.map(service => this.checkServiceHealth(service));
    
    await Promise.allSettled(promises);
  }

  private async checkServiceHealth(service: ServiceInstance): Promise<void> {
    try {
      const previousResult = this.healthResults.get(service.id);
      const currentResult = await this.checkHealth(service);

      // Check if status changed
      if (!previousResult || previousResult.status !== currentResult.status) {
        this.logger.info(
          `Health status changed for ${service.id}: ${previousResult?.status || 'unknown'} -> ${currentResult.status}`
        );

        // Notify callbacks
        this.healthCallbacks.forEach(callback => {
          try {
            callback(currentResult);
          } catch (error) {
            this.logger.error('Error in health change callback:', error);
          }
        });
      }

      // Handle grace period for unhealthy services
      if (currentResult.status === ServiceStatus.UNHEALTHY && previousResult?.status === ServiceStatus.HEALTHY) {
        this.handleUnhealthyService(service, currentResult);
      }

    } catch (error) {
      this.logger.error(`Error checking health for service ${service.id}:`, error);
    }
  }

  private handleUnhealthyService(service: ServiceInstance, result: HealthCheckResult): void {
    // Start grace period timer
    setTimeout(() => {
      const currentResult = this.healthResults.get(service.id);
      if (currentResult && currentResult.status === ServiceStatus.UNHEALTHY) {
        this.logger.warn(
          `Service ${service.id} has been unhealthy for ${this.config.gracePeriod} seconds, marking as failed`
        );
        
        // Update status to stopped after grace period
        const updatedResult: HealthCheckResult = {
          ...currentResult,
          status: ServiceStatus.STOPPED,
          timestamp: Date.now(),
          details: {
            ...currentResult.details,
            gracePeriodExpired: true
          }
        };

        this.healthResults.set(service.id, updatedResult);
        
        // Notify callbacks
        this.healthCallbacks.forEach(callback => {
          try {
            callback(updatedResult);
          } catch (error) {
            this.logger.error('Error in health change callback:', error);
          }
        });
      }
    }, this.config.gracePeriod * 1000);
  }

  private determineStatusFromResponse(httpStatus: number, responseData: any): ServiceStatus {
    if (httpStatus >= 200 && httpStatus < 300) {
      // Check if response includes specific health status
      if (responseData && typeof responseData === 'object') {
        if (responseData.status === 'healthy' || responseData.health === 'ok') {
          return ServiceStatus.HEALTHY;
        }
        if (responseData.status === 'draining') {
          return ServiceStatus.DRAINING;
        }
        if (responseData.status === 'starting') {
          return ServiceStatus.STARTING;
        }
      }
      return ServiceStatus.HEALTHY;
    }

    if (httpStatus >= 500) {
      return ServiceStatus.UNHEALTHY;
    }

    // 4xx errors might indicate configuration issues
    return ServiceStatus.UNHEALTHY;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 