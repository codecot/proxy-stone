export interface BackendInstance {
  id: string;
  name: string;
  url: string;
  type: 'single' | 'cluster';
  status: 'online' | 'offline' | 'unknown';
  responseTime?: number;
  lastCheck?: number;
  metadata?: {
    version?: string;
    region?: string;
    environment?: string;
    [key: string]: unknown;
  };
  clusterRole?: 'coordinator' | 'worker' | 'unknown';
  clusterId?: string;
  nodeId?: string;
}

export interface BackendConfig {
  activeBackendId: string;
  backends: BackendInstance[];
  mode: 'single' | 'cluster';
  autoSwitch: boolean;
  healthCheckInterval: number;
  discoveryEnabled: boolean;
  discoveryUrls: string[];
  preferCoordinator: boolean;
}

const STORAGE_KEY = 'proxy-stone-backend-config';

class BackendConfigService {
  private config: BackendConfig;
  private listeners: ((config: BackendConfig) => void)[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.startDiscoveryAndHealthChecks();
  }

  private loadConfig(): BackendConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...this.getDefaultConfig(),
          ...parsed,
        };
      }
    } catch (error) {
      console.warn('Failed to load backend config from localStorage:', error);
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): BackendConfig {
    // Get discovery URLs from environment or use common defaults
    const discoveryUrls = import.meta.env.VITE_DISCOVERY_URLS?.split(',') || [
      'http://localhost:4401',
      'http://localhost:4402', 
      'http://localhost:4403',
      'http://localhost:4404',
      'http://localhost:4405',
    ];

    return {
      activeBackendId: 'discovered',
      backends: [
        {
          id: 'discovered',
          name: 'Auto-discovered Backend',
          url: 'http://localhost:4401', // Will be updated by discovery
          type: 'cluster',
          status: 'unknown',
          clusterRole: 'unknown',
          metadata: {
            environment: 'development',
            autoDiscovered: true,
          },
        },
      ],
      mode: 'cluster',
      autoSwitch: true,
      healthCheckInterval: 30000, // 30 seconds
      discoveryEnabled: true,
      discoveryUrls,
      preferCoordinator: true, // Prefer coordinator over workers
    };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save backend config to localStorage:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.config));
  }

  public getConfig(): BackendConfig {
    return { ...this.config };
  }

  public getActiveBackend(): BackendInstance | undefined {
    return this.config.backends.find((b) => b.id === this.config.activeBackendId);
  }

  public setActiveBackend(backendId: string): void {
    if (this.config.backends.find((b) => b.id === backendId)) {
      this.config.activeBackendId = backendId;
      this.saveConfig();
      this.notifyListeners();
    }
  }

  public addBackend(backend: Omit<BackendInstance, 'id' | 'status'>): void {
    const newBackend: BackendInstance = {
      ...backend,
      id: `backend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'unknown',
    };
    this.config.backends.push(newBackend);
    this.saveConfig();
    this.notifyListeners();
  }

  public updateBackend(backendId: string, updates: Partial<BackendInstance>): void {
    const index = this.config.backends.findIndex((b) => b.id === backendId);
    if (index !== -1) {
      this.config.backends[index] = { ...this.config.backends[index], ...updates };
      this.saveConfig();
      this.notifyListeners();
    }
  }

  public removeBackend(backendId: string): void {
    if (this.config.backends.length <= 1) {
      throw new Error('Cannot remove the last backend');
    }

    this.config.backends = this.config.backends.filter((b) => b.id !== backendId);

    // If we removed the active backend, switch to the first available
    if (this.config.activeBackendId === backendId) {
      this.config.activeBackendId = this.config.backends[0].id;
    }

    this.saveConfig();
    this.notifyListeners();
  }

  public setMode(mode: 'single' | 'cluster'): void {
    this.config.mode = mode;
    this.saveConfig();
    this.notifyListeners();
  }

  public setAutoSwitch(autoSwitch: boolean): void {
    this.config.autoSwitch = autoSwitch;
    this.saveConfig();
    this.notifyListeners();
  }

  public subscribe(listener: (config: BackendConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private async checkBackendHealth(backend: BackendInstance): Promise<void> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Check both health and cluster status
      const [healthResponse, clusterResponse] = await Promise.allSettled([
        fetch(`${backend.url}/api/health`, {
          method: 'GET',
          signal: controller.signal,
        }),
        fetch(`${backend.url}/api/cluster/status`, {
          method: 'GET',
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      let clusterInfo: any = {};

      // Parse cluster status if available
      if (clusterResponse.status === 'fulfilled' && clusterResponse.value.ok) {
        try {
          const clusterData = await clusterResponse.value.json();
          if (clusterData.success) {
            clusterInfo = {
              clusterRole: clusterData.config?.defaultRole === 'coordinator' || 
                          clusterData.status?.coordinator ? 'coordinator' : 'worker',
              clusterId: clusterData.config?.clusterId,
              nodeId: clusterData.status?.nodeId,
            };
          }
        } catch (error) {
          console.warn('Failed to parse cluster status:', error);
        }
      }

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        this.updateBackend(backend.id, {
          status: 'online',
          responseTime,
          lastCheck: Date.now(),
          ...clusterInfo,
        });
      } else {
        this.updateBackend(backend.id, {
          status: 'offline',
          lastCheck: Date.now(),
          ...clusterInfo,
        });
      }
    } catch {
      this.updateBackend(backend.id, {
        status: 'offline',
        lastCheck: Date.now(),
      });
    }
  }

  private startDiscoveryAndHealthChecks(): void {
    // Initial discovery
    if (this.config.discoveryEnabled) {
      this.performDiscovery();
    }

    const checkAllBackends = async () => {
      const promises = this.config.backends.map((backend) => this.checkBackendHealth(backend));
      await Promise.allSettled(promises);

      // Auto-switch logic with coordinator preference
      if (this.config.autoSwitch) {
        await this.performAutoSwitch();
      }
    };

    // Initial health check
    setTimeout(() => checkAllBackends(), 1000); // Delay to allow discovery

    // Periodic checks
    setInterval(checkAllBackends, this.config.healthCheckInterval);

    // Periodic discovery (less frequent)
    if (this.config.discoveryEnabled) {
      setInterval(() => this.performDiscovery(), this.config.healthCheckInterval * 3); // Every 90 seconds
    }
  }

  private async performDiscovery(): Promise<void> {
    console.log('🔍 Performing backend discovery...');
    
    const discoveredBackends = new Map<string, BackendInstance>();
    const discoveryPromises = this.config.discoveryUrls.map(url => this.discoverBackend(url));
    
    const results = await Promise.allSettled(discoveryPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        discoveredBackends.set(result.value.id, result.value);
      }
    });

    if (discoveredBackends.size > 0) {
      // Update backends list with discovered backends
      const newBackends = Array.from(discoveredBackends.values());
      this.config.backends = newBackends;

      // Find the best backend to connect to
      const coordinator = newBackends.find(b => b.clusterRole === 'coordinator' && b.status === 'online');
      const anyOnline = newBackends.find(b => b.status === 'online');
      
      if (coordinator && this.config.preferCoordinator) {
        console.log(`✅ Found coordinator: ${coordinator.url}`);
        this.config.activeBackendId = coordinator.id;
      } else if (anyOnline) {
        console.log(`✅ Connected to backend: ${anyOnline.url} (${anyOnline.clusterRole || 'unknown'})`);
        this.config.activeBackendId = anyOnline.id;
      }

      this.saveConfig();
      this.notifyListeners();
    } else {
      console.warn('❌ No backends discovered');
    }
  }

  private async discoverBackend(url: string): Promise<BackendInstance | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const [healthResponse, clusterResponse] = await Promise.allSettled([
        fetch(`${url}/api/health`, {
          method: 'GET',
          signal: controller.signal,
        }),
        fetch(`${url}/api/cluster/status`, {
          method: 'GET',
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        let clusterInfo: any = {
          clusterRole: 'unknown',
          clusterId: 'unknown',
          nodeId: 'unknown',
        };

        // Parse cluster information
        if (clusterResponse.status === 'fulfilled' && clusterResponse.value.ok) {
          try {
            const clusterData = await clusterResponse.value.json();
            if (clusterData.success) {
              clusterInfo = {
                clusterRole: clusterData.config?.defaultRole === 'coordinator' || 
                            clusterData.status?.coordinator ? 'coordinator' : 'worker',
                clusterId: clusterData.config?.clusterId || 'unknown',
                nodeId: clusterData.status?.nodeId || 'unknown',
              };
            }
          } catch (error) {
            console.warn(`Failed to parse cluster status for ${url}:`, error);
          }
        }

        const backend: BackendInstance = {
          id: `discovered-${clusterInfo.nodeId || Date.now()}`,
          name: `${clusterInfo.clusterRole === 'coordinator' ? 'Coordinator' : 'Worker'} (${url})`,
          url,
          type: 'cluster',
          status: 'online',
          lastCheck: Date.now(),
          ...clusterInfo,
          metadata: {
            environment: 'discovered',
            autoDiscovered: true,
            discoveredAt: new Date().toISOString(),
          },
        };

        console.log(`🔍 Discovered: ${url} (${clusterInfo.clusterRole})`);
        return backend;
      }
    } catch (error) {
      // Silent fail for discovery - this is expected when backends are down
    }
    
    return null;
  }

  private async performAutoSwitch(): Promise<void> {
    if (!this.config.autoSwitch) return;

    const activeBackend = this.getActiveBackend();
    
    // If current backend is offline or we prefer coordinator
    if (activeBackend?.status === 'offline' || 
        (this.config.preferCoordinator && activeBackend?.clusterRole !== 'coordinator')) {
      
      // Find the best alternative
      let bestBackend: BackendInstance | undefined;
      
      if (this.config.preferCoordinator) {
        // First, try to find an online coordinator
        bestBackend = this.config.backends.find(b => 
          b.clusterRole === 'coordinator' && b.status === 'online'
        );
      }
      
      // If no coordinator found, use any online backend
      if (!bestBackend) {
        bestBackend = this.config.backends.find(b => b.status === 'online');
      }
      
      if (bestBackend && bestBackend.id !== this.config.activeBackendId) {
        console.log(`🔄 Auto-switching to: ${bestBackend.url} (${bestBackend.clusterRole})`);
        this.setActiveBackend(bestBackend.id);
      }
    }
  }

  public async triggerDiscovery(): Promise<void> {
    if (this.config.discoveryEnabled) {
      await this.performDiscovery();
    }
  }

  public async testConnection(
    url: string
  ): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

export const backendConfigService = new BackendConfigService();
