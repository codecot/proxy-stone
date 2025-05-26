import { z } from 'zod';

// Service instance status
export enum ServiceStatus {
  STARTING = 'starting',
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DRAINING = 'draining',
  STOPPED = 'stopped'
}

// Service roles in cluster
export enum ServiceRole {
  LEADER = 'leader',
  FOLLOWER = 'follower',
  CANDIDATE = 'candidate'
}

// Service instance schema
export const ServiceInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string(),
  port: z.number(),
  version: z.string(),
  status: z.nativeEnum(ServiceStatus),
  role: z.nativeEnum(ServiceRole),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  healthCheckUrl: z.string(),
  lastHeartbeat: z.number(),
  registeredAt: z.number(),
  capabilities: z.array(z.string()).optional(),
  region: z.string().optional(),
  zone: z.string().optional()
});

export type ServiceInstance = z.infer<typeof ServiceInstanceSchema>;

// Cluster configuration
export const ClusterConfigSchema = z.object({
  name: z.string(),
  leaderElection: z.object({
    enabled: z.boolean(),
    ttl: z.number().default(30),
    renewInterval: z.number().default(10)
  }),
  healthCheck: z.object({
    interval: z.number().default(30),
    timeout: z.number().default(5),
    retries: z.number().default(3),
    gracePeriod: z.number().default(60)
  }),
  discovery: z.object({
    registry: z.enum(['etcd', 'consul', 'redis']),
    endpoints: z.array(z.string()),
    namespace: z.string().default('proxy-stone')
  })
});

export type ClusterConfig = z.infer<typeof ClusterConfigSchema>;

// Service discovery events
export enum ServiceDiscoveryEvent {
  SERVICE_REGISTERED = 'service_registered',
  SERVICE_DEREGISTERED = 'service_deregistered',
  SERVICE_HEALTH_CHANGED = 'service_health_changed',
  LEADER_ELECTED = 'leader_elected',
  LEADER_LOST = 'leader_lost',
  CLUSTER_TOPOLOGY_CHANGED = 'cluster_topology_changed'
}

export const ServiceEventSchema = z.object({
  type: z.nativeEnum(ServiceDiscoveryEvent),
  serviceId: z.string(),
  service: ServiceInstanceSchema.optional(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional()
});

export type ServiceEvent = z.infer<typeof ServiceEventSchema>;

// Health check result
export const HealthCheckResultSchema = z.object({
  serviceId: z.string(),
  status: z.nativeEnum(ServiceStatus),
  responseTime: z.number(),
  error: z.string().optional(),
  timestamp: z.number(),
  details: z.record(z.any()).optional()
});

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

// Service registry interface
export interface ServiceRegistry {
  register(service: ServiceInstance): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  getService(serviceId: string): Promise<ServiceInstance | null>;
  getAllServices(): Promise<ServiceInstance[]>;
  getServicesByTag(tag: string): Promise<ServiceInstance[]>;
  updateService(serviceId: string, updates: Partial<ServiceInstance>): Promise<void>;
  watch(callback: (event: ServiceEvent) => void): Promise<void>;
  close(): Promise<void>;
}

// Health monitor interface
export interface HealthMonitor {
  startMonitoring(services: ServiceInstance[]): Promise<void>;
  stopMonitoring(): Promise<void>;
  checkHealth(service: ServiceInstance): Promise<HealthCheckResult>;
  getHealthStatus(serviceId: string): Promise<HealthCheckResult | null>;
  onHealthChange(callback: (result: HealthCheckResult) => void): void;
}

// Leader election interface
export interface LeaderElection {
  start(): Promise<void>;
  stop(): Promise<void>;
  isLeader(): boolean;
  getLeader(): Promise<string | null>;
  onLeaderChange(callback: (leaderId: string | null) => void): void;
} 