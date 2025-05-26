import {
  ServiceDiscoveryManager,
  ServiceInstance,
  ServiceStatus,
  ClusterConfig,
  ServiceEvent
} from '@proxy-stone/service-discovery';
import { Logger } from '@proxy-stone/logger';
import { EventEmitter } from 'events';

export interface ServiceDiscoveryConfig {
  enabled: boolean;
  cluster: ClusterConfig;
  service: {
    name: string;
    host: string;
    port: number;
    version: string;
    tags?: string[];
    region?: string;
    zone?: string;
  };
}

export class ProxyStoneServiceDiscovery extends EventEmitter {
  private manager: ServiceDiscoveryManager | null = null;
  private logger: Logger;
  private config: ServiceDiscoveryConfig;
  private currentService: ServiceInstance | null = null;

  constructor(config: ServiceDiscoveryConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'ServiceDiscovery' });
  }

  /**
   * Initialize and start service discovery
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Service discovery is disabled');
      return;
    }

    try {
      this.logger.info('Starting service discovery...');

      // Create service discovery manager
      this.manager = new ServiceDiscoveryManager(this.config.cluster);

      // Set up event handlers
      this.setupEventHandlers();

      // Start the manager
      await this.manager.start();

      // Register this service instance
      this.currentService = await this.manager.registerService({
        name: this.config.service.name,
        host: this.config.service.host,
        port: this.config.service.port,
        version: this.config.service.version,
        tags: this.config.service.tags || ['proxy-stone', 'backend'],
        region: this.config.service.region,
        zone: this.config.service.zone,
        capabilities: ['proxy', 'cache', 'monitoring'],
        metadata: {
          startedAt: new Date().toISOString(),
          nodeVersion: process.version,
          platform: process.platform
        }
      });

      this.logger.info(`Service registered with ID: ${this.currentService.id}`);

      // Emit ready event
      this.emit('ready', this.currentService);

    } catch (error) {
      this.logger.error('Failed to start service discovery:', error);
      throw error;
    }
  }

  /**
   * Stop service discovery
   */
  async stop(): Promise<void> {
    if (!this.manager) {
      return;
    }

    try {
      this.logger.info('Stopping service discovery...');
      await this.manager.stop();
      this.manager = null;
      this.currentService = null;
      this.logger.info('Service discovery stopped');
    } catch (error) {
      this.logger.error('Error stopping service discovery:', error);
      throw error;
    }
  }

  /**
   * Get all available proxy-stone services
   */
  async getAvailableServices(): Promise<ServiceInstance[]> {
    if (!this.manager) {
      return [];
    }

    return await this.manager.getServicesByTag('proxy-stone');
  }

  /**
   * Get healthy proxy-stone services only
   */
  async getHealthyServices(): Promise<ServiceInstance[]> {
    if (!this.manager) {
      return [];
    }

    const allServices = await this.getAvailableServices();
    const healthyServices = await this.manager.getHealthyServices();
    
    // Return intersection of proxy-stone services and healthy services
    return allServices.filter(service => 
      healthyServices.some(healthy => healthy.id === service.id)
    );
  }

  /**
   * Get cluster topology information
   */
  async getClusterTopology() {
    if (!this.manager) {
      return null;
    }

    return await this.manager.getClusterTopology();
  }

  /**
   * Enable or disable a service
   */
  async setServiceEnabled(serviceId: string, enabled: boolean): Promise<void> {
    if (!this.manager) {
      throw new Error('Service discovery not initialized');
    }

    await this.manager.setServiceEnabled(serviceId, enabled);
    this.logger.info(`Service ${serviceId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get health status for a specific service
   */
  async getServiceHealth(serviceId: string) {
    if (!this.manager) {
      return null;
    }

    return await this.manager.getServiceHealth(serviceId);
  }

  /**
   * Get current service instance
   */
  getCurrentService(): ServiceInstance | null {
    return this.currentService;
  }

  /**
   * Check if this instance is the cluster leader
   */
  isLeader(): boolean {
    return this.manager?.isLeader() || false;
  }

  /**
   * Get service discovery manager (for advanced usage)
   */
  getManager(): ServiceDiscoveryManager | null {
    return this.manager;
  }

  private setupEventHandlers(): void {
    if (!this.manager) {
      return;
    }

    // Service joined the cluster
    this.manager.on('serviceJoined', (service: ServiceInstance) => {
      this.logger.info(`New service joined: ${service.name} (${service.id})`);
      this.emit('serviceJoined', service);
    });

    // Service left the cluster
    this.manager.on('serviceLeft', (serviceId: string) => {
      this.logger.info(`Service left: ${serviceId}`);
      this.emit('serviceLeft', serviceId);
    });

    // Service health changed
    this.manager.on('serviceHealthChanged', (serviceId: string, service?: ServiceInstance) => {
      this.logger.info(`Service health changed: ${serviceId}`);
      this.emit('serviceHealthChanged', serviceId, service);
    });

    // Leader elected
    this.manager.on('leaderElected', (leaderId: string) => {
      this.logger.info(`New leader elected: ${leaderId}`);
      this.emit('leaderElected', leaderId);
    });

    // Leader lost
    this.manager.on('leaderLost', (leaderId: string) => {
      this.logger.warn(`Leader lost: ${leaderId}`);
      this.emit('leaderLost', leaderId);
    });

    // Cluster topology changed
    this.manager.on('topologyChanged', () => {
      this.logger.debug('Cluster topology changed');
      this.emit('topologyChanged');
    });

    // Health status changed
    this.manager.on('healthChanged', (result) => {
      this.logger.debug(`Health changed for ${result.serviceId}: ${result.status}`);
      this.emit('healthChanged', result);
    });

    // Service discovery started
    this.manager.on('started', () => {
      this.logger.info('Service discovery manager started');
      this.emit('started');
    });

    // Service discovery stopped
    this.manager.on('stopped', () => {
      this.logger.info('Service discovery manager stopped');
      this.emit('stopped');
    });
  }
} 