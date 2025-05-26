import { v4 as uuidv4 } from 'uuid';
import { ServiceRegistry } from '../types.js';
import { ServiceHealthMonitor } from '../health/health-monitor.js';
import { EtcdServiceRegistry } from '../registry/etcd-registry.js';
import {
  ServiceInstance,
  ServiceStatus,
  ServiceRole,
  ClusterConfig,
  ServiceEvent,
  ServiceDiscoveryEvent,
  HealthCheckResult
} from '../types.js';
import { createLogger, Logger } from '@proxy-stone/logger';
import { EventEmitter } from 'events';

export class ServiceDiscoveryManager extends EventEmitter {
  private logger: Logger;
  private registry: ServiceRegistry;
  private healthMonitor: ServiceHealthMonitor;
  private config: ClusterConfig;
  private currentService: ServiceInstance | null = null;
  private isRunning: boolean = false;

  constructor(config: ClusterConfig) {
    super();
    this.logger = createLogger({ level: 'info', format: 'pretty' });
    this.config = config;

    // Initialize registry based on configuration
    this.registry = this.createRegistry();
    
    // Initialize health monitor
    this.healthMonitor = new ServiceHealthMonitor(config.healthCheck);

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the service discovery manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Service discovery manager is already running');
      return;
    }

    try {
      this.logger.info('Starting service discovery manager...');

      // Start watching for service changes
      await this.registry.watch((event) => {
        this.handleServiceEvent(event);
      });

      // Start health monitoring for existing services
      const existingServices = await this.registry.getAllServices();
      await this.healthMonitor.startMonitoring(existingServices);

      this.isRunning = true;
      this.logger.info('Service discovery manager started successfully');

      // Emit started event
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start service discovery manager:', error);
      throw error;
    }
  }

  /**
   * Stop the service discovery manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.info('Stopping service discovery manager...');

      // Deregister current service if registered
      if (this.currentService) {
        await this.deregisterService(this.currentService.id);
      }

      // Stop health monitoring
      await this.healthMonitor.stopMonitoring();

      // Close registry
      await this.registry.close();

      this.isRunning = false;
      this.logger.info('Service discovery manager stopped');

      // Emit stopped event
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping service discovery manager:', error);
      throw error;
    }
  }

  /**
   * Register a new service instance
   */
  async registerService(serviceConfig: {
    name: string;
    host: string;
    port: number;
    version: string;
    healthCheckUrl?: string;
    metadata?: Record<string, any>;
    tags?: string[];
    capabilities?: string[];
    region?: string;
    zone?: string;
  }): Promise<ServiceInstance> {
    try {
      const service: ServiceInstance = {
        id: uuidv4(),
        name: serviceConfig.name,
        host: serviceConfig.host,
        port: serviceConfig.port,
        version: serviceConfig.version,
        status: ServiceStatus.STARTING,
        role: ServiceRole.FOLLOWER, // Will be updated by leader election
        healthCheckUrl: serviceConfig.healthCheckUrl || `http://${serviceConfig.host}:${serviceConfig.port}/health`,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
        metadata: serviceConfig.metadata,
        tags: serviceConfig.tags,
        capabilities: serviceConfig.capabilities,
        region: serviceConfig.region,
        zone: serviceConfig.zone
      };

      // Register with the registry
      await this.registry.register(service);

      // Add to health monitoring
      this.healthMonitor.addService(service);

      // Store as current service if this is our own registration
      this.currentService = service;

      this.logger.info(`Service registered: ${service.id} (${service.name})`);

      // Emit registration event
      this.emit('serviceRegistered', service);

      return service;

    } catch (error) {
      this.logger.error('Failed to register service:', error);
      throw error;
    }
  }

  /**
   * Deregister a service instance
   */
  async deregisterService(serviceId: string): Promise<void> {
    try {
      await this.registry.deregister(serviceId);
      this.healthMonitor.removeService(serviceId);

      if (this.currentService?.id === serviceId) {
        this.currentService = null;
      }

      this.logger.info(`Service deregistered: ${serviceId}`);

      // Emit deregistration event
      this.emit('serviceDeregistered', serviceId);

    } catch (error) {
      this.logger.error(`Failed to deregister service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<ServiceInstance[]> {
    return await this.registry.getAllServices();
  }

  /**
   * Get services by tag
   */
  async getServicesByTag(tag: string): Promise<ServiceInstance[]> {
    return await this.registry.getServicesByTag(tag);
  }

  /**
   * Get healthy services only
   */
  async getHealthyServices(): Promise<ServiceInstance[]> {
    return this.healthMonitor.getServicesByStatus(ServiceStatus.HEALTHY);
  }

  /**
   * Get service by ID
   */
  async getService(serviceId: string): Promise<ServiceInstance | null> {
    return await this.registry.getService(serviceId);
  }

  /**
   * Update service status
   */
  async updateServiceStatus(serviceId: string, status: ServiceStatus): Promise<void> {
    try {
      await this.registry.updateService(serviceId, { status });
      this.logger.info(`Service status updated: ${serviceId} -> ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update service status for ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Enable/disable a service
   */
  async setServiceEnabled(serviceId: string, enabled: boolean): Promise<void> {
    const status = enabled ? ServiceStatus.HEALTHY : ServiceStatus.DRAINING;
    await this.updateServiceStatus(serviceId, status);
  }

  /**
   * Get health status for a service
   */
  async getServiceHealth(serviceId: string): Promise<HealthCheckResult | null> {
    return await this.healthMonitor.getHealthStatus(serviceId);
  }

  /**
   * Get health status for all services
   */
  getAllServiceHealth(): Map<string, HealthCheckResult> {
    return this.healthMonitor.getAllHealthStatuses();
  }

  /**
   * Get cluster topology information
   */
  async getClusterTopology(): Promise<{
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    servicesByRegion: Record<string, number>;
    servicesByStatus: Record<ServiceStatus, number>;
    leader: ServiceInstance | null;
  }> {
    const allServices = await this.getAllServices();
    const healthStatuses = this.getAllServiceHealth();

    const topology = {
      totalServices: allServices.length,
      healthyServices: 0,
      unhealthyServices: 0,
      servicesByRegion: {} as Record<string, number>,
      servicesByStatus: {} as Record<ServiceStatus, number>,
      leader: null as ServiceInstance | null
    };

    // Initialize status counters
    Object.values(ServiceStatus).forEach(status => {
      topology.servicesByStatus[status] = 0;
    });

    for (const service of allServices) {
      // Count by region
      const region = service.region || 'unknown';
      topology.servicesByRegion[region] = (topology.servicesByRegion[region] || 0) + 1;

      // Count by status
      const healthResult = healthStatuses.get(service.id);
      const status = healthResult?.status || service.status;
      topology.servicesByStatus[status]++;

      if (status === ServiceStatus.HEALTHY) {
        topology.healthyServices++;
      } else if (status === ServiceStatus.UNHEALTHY || status === ServiceStatus.STOPPED) {
        topology.unhealthyServices++;
      }

      // Find leader
      if (service.role === ServiceRole.LEADER) {
        topology.leader = service;
      }
    }

    return topology;
  }

  /**
   * Get current service instance (if registered by this manager)
   */
  getCurrentService(): ServiceInstance | null {
    return this.currentService;
  }

  /**
   * Check if this instance is the cluster leader
   */
  isLeader(): boolean {
    return this.currentService?.role === ServiceRole.LEADER;
  }

  private createRegistry(): ServiceRegistry {
    switch (this.config.discovery.registry) {
      case 'etcd':
        return new EtcdServiceRegistry(this.config.discovery.endpoints, this.config.discovery.namespace);
      case 'consul':
        // TODO: Implement Consul registry
        throw new Error('Consul registry not yet implemented');
      case 'redis':
        // TODO: Implement Redis registry
        throw new Error('Redis registry not yet implemented');
      default:
        throw new Error(`Unsupported registry type: ${this.config.discovery.registry}`);
    }
  }

  private setupEventHandlers(): void {
    // Handle health changes
    this.healthMonitor.onHealthChange((result) => {
      this.handleHealthChange(result);
    });
  }

  private async handleServiceEvent(event: ServiceEvent): Promise<void> {
    try {
      this.logger.debug(`Service event received: ${event.type} for ${event.serviceId}`);

      switch (event.type) {
        case ServiceDiscoveryEvent.SERVICE_REGISTERED:
          if (event.service) {
            this.healthMonitor.addService(event.service);
            this.emit('serviceJoined', event.service);
          }
          break;

        case ServiceDiscoveryEvent.SERVICE_DEREGISTERED:
          this.healthMonitor.removeService(event.serviceId);
          this.emit('serviceLeft', event.serviceId);
          break;

        case ServiceDiscoveryEvent.SERVICE_HEALTH_CHANGED:
          this.emit('serviceHealthChanged', event.serviceId, event.service);
          break;

        case ServiceDiscoveryEvent.LEADER_ELECTED:
          this.emit('leaderElected', event.serviceId);
          break;

        case ServiceDiscoveryEvent.LEADER_LOST:
          this.emit('leaderLost', event.serviceId);
          break;

        case ServiceDiscoveryEvent.CLUSTER_TOPOLOGY_CHANGED:
          this.emit('topologyChanged');
          break;
      }

      // Forward all events
      this.emit('serviceEvent', event);

    } catch (error) {
      this.logger.error('Error handling service event:', error);
    }
  }

  private async handleHealthChange(result: HealthCheckResult): Promise<void> {
    try {
      // Update service status in registry
      await this.registry.updateService(result.serviceId, { 
        status: result.status,
        lastHeartbeat: Date.now()
      });

      this.emit('healthChanged', result);

    } catch (error) {
      this.logger.error(`Error handling health change for ${result.serviceId}:`, error);
    }
  }
} 