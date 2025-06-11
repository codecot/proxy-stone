import axios from 'axios';
import { backendConfigService } from './backendConfig';

// Create axios instance with dynamic base URL
export const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to set dynamic base URL
api.interceptors.request.use((config) => {
  const activeBackend = backendConfigService.getActiveBackend();
  if (activeBackend) {
    config.baseURL = `${activeBackend.url}/api`;
    console.log(`Using API base URL: ${config.baseURL}`);
  } else {
    config.baseURL = 'http://localhost:4401/api'; // fallback
    console.log(`Using fallback API base URL: ${config.baseURL}`);
  }
  return config;
});

export interface CacheEntry {
  key: string;
  data: unknown;
  headers: Record<string, string>;
  status: number;
  createdAt: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheRule {
  pattern: string;
  methods?: string[];
  ttl?: number;
  enabled?: boolean;
  conditions?: {
    headers?: Record<string, string>;
    statusCodes?: number[];
    minSize?: number;
    maxSize?: number;
  };
}

export interface CacheConfig {
  defaultTTL: number;
  methods: string[];
  rules: CacheRule[];
  keyOptions: {
    includeHeaders?: string[];
    excludeHeaders?: string[];
    normalizeUrl?: boolean;
    hashLongKeys?: boolean;
    maxKeyLength?: number;
  };
  behavior: {
    warmupEnabled?: boolean;
    backgroundCleanup?: boolean;
    cleanupInterval?: number;
    maxSize?: number;
    evictionPolicy?: 'lru' | 'fifo';
  };
}

export interface ClusterNode {
  nodeId: string;
  hostname: string;
  port: number;
  status: 'active' | 'inactive' | 'disabled';
  registeredAt: string;
  lastSeen: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ClusterHealth {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  disabledNodes: number;
  clusterStatus: 'healthy' | 'degraded' | 'critical';
  lastUpdated: string;
}

export interface NodeStatus {
  nodeId: string;
  status: 'active' | 'inactive' | 'disabled';
  uptime: number;
  requestCount: number;
  errorCount: number;
  cpuUsage?: number;
  memoryUsage?: number;
  lastHeartbeat: string;
}

export const apiService = {
  // Cache Management
  getCacheEntries: async (filters?: {
    method?: string;
    url?: string;
    backend_host?: string;
    manual?: boolean;
    expires_before?: string;
    expires_after?: string;
    created_before?: string;
    created_after?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get('/cache/entries', { params: filters });
    return response.data;
  },

  getCacheEntry: async (key: string) => {
    const response = await api.get(`/cache/entry/${encodeURIComponent(key)}`);
    return response.data;
  },

  updateCacheEntry: async (key: string, data: unknown, ttl?: number) => {
    const response = await api.put(`/cache/entry/${encodeURIComponent(key)}`, {
      data,
      ttl,
    });
    return response.data;
  },

  deleteCacheEntry: async (key: string) => {
    const response = await api.delete(`/cache/entry/${encodeURIComponent(key)}`);
    return response.data;
  },

  refreshCacheEntry: async (key: string, force?: boolean, ttl_override?: number) => {
    const response = await api.post(`/cache/entry/${encodeURIComponent(key)}/refresh`, {
      force,
      ttl_override,
    });
    return response.data;
  },

  // Cache Configuration
  getCacheConfig: async () => {
    const response = await api.get('/debug/config');
    return response.data;
  },

  getCacheRules: async () => {
    const response = await api.get('/cache/rules');
    return response.data;
  },

  updateCacheRule: async (rule: CacheRule) => {
    const response = await api.put('/cache/rules', rule);
    return response.data;
  },

  deleteCacheRule: async (pattern: string) => {
    const response = await api.delete(`/cache/rules/${encodeURIComponent(pattern)}`);
    return response.data;
  },

  // Cache Operations
  clearCache: async () => {
    const response = await api.delete('/cache');
    return response.data;
  },

  cleanExpiredCache: async () => {
    const response = await api.post('/cache/clean');
    return response.data;
  },

  // Health Monitoring
  getHealthStatus: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  getBackendStatus: async () => {
    const response = await api.get('/health/backend');
    return response.data;
  },

  // Cluster Management
  getClusterNodes: async (): Promise<ClusterNode[]> => {
    const response = await api.get('/cluster/nodes');
    return response.data;
  },

  getClusterNode: async (nodeId: string): Promise<ClusterNode> => {
    const response = await api.get(`/cluster/nodes/${encodeURIComponent(nodeId)}`);
    return response.data;
  },

  getClusterHealth: async (): Promise<ClusterHealth> => {
    const response = await api.get('/cluster/health');
    return response.data;
  },

  getClusterStatus: async (): Promise<NodeStatus> => {
    const response = await api.get('/cluster/status');
    return response.data;
  },

  registerClusterNode: async (nodeData: {
    hostname: string;
    port: number;
    version?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const response = await api.post('/cluster/register', nodeData);
    return response.data;
  },

  enableClusterNode: async (nodeId: string) => {
    const response = await api.patch(`/cluster/nodes/${encodeURIComponent(nodeId)}/enable`);
    return response.data;
  },

  disableClusterNode: async (nodeId: string) => {
    const response = await api.patch(`/cluster/nodes/${encodeURIComponent(nodeId)}/disable`);
    return response.data;
  },

  removeClusterNode: async (nodeId: string) => {
    const response = await api.delete(`/cluster/nodes/${encodeURIComponent(nodeId)}`);
    return response.data;
  },
};
