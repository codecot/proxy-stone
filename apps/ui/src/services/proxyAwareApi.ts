import axios from 'axios';

// Create a proxy-aware axios instance
export const proxyAwareApi = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

// This will be set by the ProxyContext
let currentProxyBaseUrl = 'http://localhost:4401/api';

export const setProxyBaseUrl = (baseUrl: string) => {
  currentProxyBaseUrl = baseUrl;
};

export const getProxyBaseUrl = () => currentProxyBaseUrl;

// Interceptor to use the current proxy's base URL
proxyAwareApi.interceptors.request.use((config) => {
  config.baseURL = currentProxyBaseUrl;
  console.log(`Making API request to: ${config.baseURL}${config.url}`);
  return config;
});

// Enhanced API service that works with selected proxy
export const proxyAwareApiService = {
  // Cache Management (proxy-specific)
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
    const response = await proxyAwareApi.get('/cache/entries', { params: filters });
    return response.data;
  },

  getCacheEntry: async (key: string) => {
    const response = await proxyAwareApi.get(`/cache/entry/${encodeURIComponent(key)}`);
    return response.data;
  },

  updateCacheEntry: async (key: string, data: unknown, ttl?: number) => {
    const response = await proxyAwareApi.put(`/cache/entry/${encodeURIComponent(key)}`, {
      data,
      ttl,
    });
    return response.data;
  },

  deleteCacheEntry: async (key: string) => {
    const response = await proxyAwareApi.delete(`/cache/entry/${encodeURIComponent(key)}`);
    return response.data;
  },

  refreshCacheEntry: async (key: string, force?: boolean, ttl_override?: number) => {
    const response = await proxyAwareApi.post(`/cache/entry/${encodeURIComponent(key)}/refresh`, {
      force,
      ttl_override,
    });
    return response.data;
  },

  // Cache Configuration
  getCacheConfig: async () => {
    const response = await proxyAwareApi.get('/debug/config');
    return response.data;
  },

  getCacheRules: async () => {
    const response = await proxyAwareApi.get('/cache/rules');
    return response.data;
  },

  updateCacheRule: async (rule: any) => {
    const response = await proxyAwareApi.put('/cache/rules', rule);
    return response.data;
  },

  deleteCacheRule: async (pattern: string) => {
    const response = await proxyAwareApi.delete(`/cache/rules/${encodeURIComponent(pattern)}`);
    return response.data;
  },

  // Cache Operations
  clearCache: async () => {
    const response = await proxyAwareApi.delete('/cache');
    return response.data;
  },

  cleanExpiredCache: async () => {
    const response = await proxyAwareApi.post('/cache/clean');
    return response.data;
  },

  // Health Monitoring (proxy-specific)
  getHealthStatus: async () => {
    const response = await proxyAwareApi.get('/health');
    return response.data;
  },

  // Metrics (proxy-specific)
  getMetrics: async () => {
    const response = await proxyAwareApi.get('/metrics');
    return response.data;
  },

  // Proxy-specific cluster information
  getProxyClusterStatus: async () => {
    const response = await proxyAwareApi.get('/cluster/status');
    return response.data;
  },

  // Proxy Control Operations
  setProxyOnline: async () => {
    const response = await proxyAwareApi.post('/cluster/enable-serving');
    return response.data;
  },

  setProxyOffline: async () => {
    const response = await proxyAwareApi.post('/cluster/disable-serving');
    return response.data;
  },

  getProxyServiceStatus: async () => {
    const response = await proxyAwareApi.get('/cluster/service-status');
    return response.data;
  },

  // Request Analytics (proxy-specific)
  getRequestAnalytics: async (filters?: {
    start_time?: string;
    end_time?: string;
    method?: string;
    status_code?: number;
    limit?: number;
    offset?: number;
  }) => {
    const response = await proxyAwareApi.get('/requests', { params: filters });
    return response.data;
  },

  // Snapshots (proxy-specific)
  createSnapshot: async (description?: string) => {
    const response = await proxyAwareApi.post('/snapshots', { description });
    return response.data;
  },

  getSnapshots: async () => {
    const response = await proxyAwareApi.get('/snapshots');
    return response.data;
  },

  restoreSnapshot: async (snapshotId: string) => {
    const response = await proxyAwareApi.post(`/snapshots/${snapshotId}/restore`);
    return response.data;
  },

  deleteSnapshot: async (snapshotId: string) => {
    const response = await proxyAwareApi.delete(`/snapshots/${snapshotId}`);
    return response.data;
  },

  // Proxy Configuration
  getProxyConfig: async () => {
    const response = await proxyAwareApi.get('/config');
    return response.data;
  },

  updateProxyConfig: async (config: any) => {
    const response = await proxyAwareApi.put('/config', config);
    return response.data;
  },
};