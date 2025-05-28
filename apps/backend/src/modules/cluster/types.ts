export enum NodeStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
  MAINTENANCE = "maintenance",
  ERROR = "error",
  INACTIVE = "inactive",
  UNHEALTHY = "unhealthy",
}

export enum NodeRole {
  MASTER = "master",
  WORKER = "worker",
  BACKUP = "backup",
  DEFAULT = "default",
  READ_ONLY = "read_only",
  ADMIN = "admin",
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
  id?: string;
  url: string;
  clusterId?: string;
  tags?: string[];
  capabilities?: Record<string, boolean>;
  role?: NodeRole;
  metadata?: Record<string, any>;
  version?: string;
  region?: string;
  zone?: string;
}

export interface NodeHeartbeatRequest {
  status?: NodeStatus;
  metadata?: Record<string, any>;
  capabilities?: Record<string, boolean>;
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
  clusterId?: string;
  heartbeatInterval?: number;
  nodeTimeout?: number;
  healthCheckInterval?: number;
  autoRegister?: boolean;
  defaultRole?: NodeRole;
  tags?: string[];
  defaultCapabilities?: NodeCapabilities;
  maxNodes?: number;
  nodeId?: string;
  metadata?: Record<string, any>;
  storage?: {
    type: "memory" | "file" | "database" | "redis";
    path?: string;
    tableName?: string;
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
      keyPrefix?: string;
    };
  };
}
