// Main exports for @proxy-stone/service-discovery
export * from './types.js';
export * from './registry/etcd-registry.js';
export * from './health/health-monitor.js';
export * from './cluster/service-discovery-manager.js';

// Re-export commonly used types and enums
export {
  ServiceStatus,
  ServiceRole,
  ServiceDiscoveryEvent,
  type ServiceInstance,
  type ClusterConfig,
  type ServiceEvent,
  type HealthCheckResult,
  type ServiceRegistry,
  type HealthMonitor,
  type LeaderElection
} from './types.js';

// Main manager class
export { ServiceDiscoveryManager } from './cluster/service-discovery-manager.js'; 