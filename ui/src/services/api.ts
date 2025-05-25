import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/proxy';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
};
