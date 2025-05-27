export enum NodeStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DISABLED = "disabled",
  UNHEALTHY = "unhealthy",
}

export enum NodeRole {
  DEFAULT = "default",
  READ_ONLY = "read-only",
  MONITOR_ONLY = "monitor-only",
  DISABLED = "disabled",
}

export interface NodeCapabilities {
  proxy?: boolean;
  cache?: boolean;
  monitoring?: boolean;
  logging?: boolean;
  [key: string]: boolean | undefined;
}

export interface ClusterNode {
  id: string;
  url: string;
  clusterId?: string;
  tags: string[];
  capabilities: NodeCapabilities;
  status: NodeStatus;
  role: NodeRole;
  lastSeen: string;
  createdAt: string;
  metadata?: Record<string, any>;
  version?: string;
  region?: string;
  zone?: string;
}

export interface NodeRegistrationRequest {
  id?: string; // Optional, will be generated if not provided
  url: string;
  clusterId?: string;
  tags?: string[];
  capabilities?: NodeCapabilities;
  role?: NodeRole;
  metadata?: Record<string, any>;
  version?: string;
  region?: string;
  zone?: string;
}

export interface NodeHeartbeatRequest {
  status?: NodeStatus;
  metadata?: Record<string, any>;
  capabilities?: NodeCapabilities;
}

export interface NodeHealthStatus {
  nodeId: string;
  status: NodeStatus;
  lastSeen: string;
  uptime?: number;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: number;
  activeConnections?: number;
  requestsPerSecond?: number;
  errorRate?: number;
}

export interface ClusterHealthResponse {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  disabledNodes: number;
  unhealthyNodes: number;
  nodes: NodeHealthStatus[];
  lastUpdated: string;
}

export interface ClusterConfig {
  enabled: boolean;
  nodeId?: string; // Current node ID
  clusterId?: string; // Cluster this node belongs to
  heartbeatInterval: number; // Heartbeat interval in seconds
  nodeTimeout: number; // Node timeout in seconds (when to mark as inactive)
  healthCheckInterval: number; // Health check interval in seconds
  storage: {
    type: "redis" | "sqlite";
    // Redis configuration
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
      keyPrefix?: string;
    };
    // SQLite configuration
    sqlite?: {
      path: string;
    };
  };
  autoRegister: boolean; // Auto-register this node on startup
  defaultCapabilities: NodeCapabilities;
  defaultRole: NodeRole;
  tags: string[];
  metadata?: Record<string, any>;
}
