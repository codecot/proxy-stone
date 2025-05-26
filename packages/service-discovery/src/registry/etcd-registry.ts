import { Etcd3 } from 'etcd3';
import { ServiceRegistry, ServiceInstance, ServiceEvent, ServiceDiscoveryEvent } from '../types.js';
import { Logger } from '@proxy-stone/logger';

export class EtcdServiceRegistry implements ServiceRegistry {
  private client: Etcd3;
  private logger: Logger;
  private namespace: string;
  private watchers: Map<string, any> = new Map();
  private eventCallbacks: ((event: ServiceEvent) => void)[] = [];

  constructor(endpoints: string[], namespace: string = 'proxy-stone') {
    this.client = new Etcd3({ hosts: endpoints });
    this.logger = new Logger('EtcdServiceRegistry');
    this.namespace = namespace;
  }

  private getServiceKey(serviceId: string): string {
    return `${this.namespace}/services/${serviceId}`;
  }

  private getServicesPrefix(): string {
    return `${this.namespace}/services/`;
  }

  async register(service: ServiceInstance): Promise<void> {
    try {
      const key = this.getServiceKey(service.id);
      const value = JSON.stringify({
        ...service,
        lastHeartbeat: Date.now(),
        registeredAt: service.registeredAt || Date.now()
      });

      // Register with TTL for automatic cleanup if service dies
      const lease = this.client.lease(60); // 60 seconds TTL
      await lease.put(key).value(value);

      // Start heartbeat to keep the lease alive
      this.startHeartbeat(service.id, lease);

      this.logger.info(`Service registered: ${service.id} at ${service.host}:${service.port}`);

      // Emit registration event
      this.emitEvent({
        type: ServiceDiscoveryEvent.SERVICE_REGISTERED,
        serviceId: service.id,
        service,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error(`Failed to register service ${service.id}:`, error);
      throw error;
    }
  }

  async deregister(serviceId: string): Promise<void> {
    try {
      const key = this.getServiceKey(serviceId);
      await this.client.delete().key(key);

      // Stop heartbeat
      this.stopHeartbeat(serviceId);

      this.logger.info(`Service deregistered: ${serviceId}`);

      // Emit deregistration event
      this.emitEvent({
        type: ServiceDiscoveryEvent.SERVICE_DEREGISTERED,
        serviceId,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error(`Failed to deregister service ${serviceId}:`, error);
      throw error;
    }
  }

  async getService(serviceId: string): Promise<ServiceInstance | null> {
    try {
      const key = this.getServiceKey(serviceId);
      const result = await this.client.get(key);
      
      if (!result) {
        return null;
      }

      return JSON.parse(result) as ServiceInstance;
    } catch (error) {
      this.logger.error(`Failed to get service ${serviceId}:`, error);
      return null;
    }
  }

  async getAllServices(): Promise<ServiceInstance[]> {
    try {
      const prefix = this.getServicesPrefix();
      const results = await this.client.getAll().prefix(prefix);
      
      return Object.values(results).map(value => JSON.parse(value) as ServiceInstance);
    } catch (error) {
      this.logger.error('Failed to get all services:', error);
      return [];
    }
  }

  async getServicesByTag(tag: string): Promise<ServiceInstance[]> {
    const allServices = await this.getAllServices();
    return allServices.filter(service => service.tags?.includes(tag));
  }

  async updateService(serviceId: string, updates: Partial<ServiceInstance>): Promise<void> {
    try {
      const currentService = await this.getService(serviceId);
      if (!currentService) {
        throw new Error(`Service ${serviceId} not found`);
      }

      const updatedService = {
        ...currentService,
        ...updates,
        lastHeartbeat: Date.now()
      };

      const key = this.getServiceKey(serviceId);
      await this.client.put(key).value(JSON.stringify(updatedService));

      this.logger.info(`Service updated: ${serviceId}`);

      // Emit update event if status changed
      if (updates.status && updates.status !== currentService.status) {
        this.emitEvent({
          type: ServiceDiscoveryEvent.SERVICE_HEALTH_CHANGED,
          serviceId,
          service: updatedService,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update service ${serviceId}:`, error);
      throw error;
    }
  }

  async watch(callback: (event: ServiceEvent) => void): Promise<void> {
    this.eventCallbacks.push(callback);

    // Watch for service changes
    const prefix = this.getServicesPrefix();
    const watcher = await this.client.watch().prefix(prefix).create();

    watcher.on('put', (res) => {
      try {
        const service = JSON.parse(res.value.toString()) as ServiceInstance;
        const event: ServiceEvent = {
          type: ServiceDiscoveryEvent.SERVICE_REGISTERED,
          serviceId: service.id,
          service,
          timestamp: Date.now()
        };
        this.emitEvent(event);
      } catch (error) {
        this.logger.error('Error processing watch put event:', error);
      }
    });

    watcher.on('delete', (res) => {
      try {
        const serviceId = res.key.toString().replace(prefix, '');
        const event: ServiceEvent = {
          type: ServiceDiscoveryEvent.SERVICE_DEREGISTERED,
          serviceId,
          timestamp: Date.now()
        };
        this.emitEvent(event);
      } catch (error) {
        this.logger.error('Error processing watch delete event:', error);
      }
    });

    this.watchers.set('services', watcher);
  }

  async close(): Promise<void> {
    // Stop all heartbeats
    for (const [serviceId] of this.watchers) {
      this.stopHeartbeat(serviceId);
    }

    // Close all watchers
    for (const [, watcher] of this.watchers) {
      await watcher.cancel();
    }
    this.watchers.clear();

    // Close etcd client
    this.client.close();
    this.logger.info('EtcdServiceRegistry closed');
  }

  private startHeartbeat(serviceId: string, lease: any): void {
    const interval = setInterval(async () => {
      try {
        await lease.keepAliveOnce();
        
        // Update last heartbeat timestamp
        const service = await this.getService(serviceId);
        if (service) {
          await this.updateService(serviceId, { lastHeartbeat: Date.now() });
        }
      } catch (error) {
        this.logger.error(`Heartbeat failed for service ${serviceId}:`, error);
        this.stopHeartbeat(serviceId);
      }
    }, 20000); // 20 seconds

    this.watchers.set(`heartbeat-${serviceId}`, interval);
  }

  private stopHeartbeat(serviceId: string): void {
    const heartbeatKey = `heartbeat-${serviceId}`;
    const interval = this.watchers.get(heartbeatKey);
    if (interval) {
      clearInterval(interval);
      this.watchers.delete(heartbeatKey);
    }
  }

  private emitEvent(event: ServiceEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in event callback:', error);
      }
    });
  }
} 