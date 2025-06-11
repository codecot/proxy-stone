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
}

export interface BackendConfig {
  activeBackendId: string;
  backends: BackendInstance[];
  mode: 'single' | 'cluster';
  autoSwitch: boolean;
  healthCheckInterval: number;
}

const STORAGE_KEY = 'proxy-stone-backend-config';

class BackendConfigService {
  private config: BackendConfig;
  private listeners: ((config: BackendConfig) => void)[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.startHealthChecks();
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
    return {
      activeBackendId: 'default',
      backends: [
        {
          id: 'default',
          name: 'Local Development',
          url: 'http://localhost:4401',
          type: 'single',
          status: 'unknown',
          metadata: {
            environment: 'development',
          },
        },
      ],
      mode: 'single',
      autoSwitch: false,
      healthCheckInterval: 30000, // 30 seconds
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

      const response = await fetch(`${backend.url}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        this.updateBackend(backend.id, {
          status: 'online',
          responseTime,
          lastCheck: Date.now(),
        });
      } else {
        this.updateBackend(backend.id, {
          status: 'offline',
          lastCheck: Date.now(),
        });
      }
    } catch {
      this.updateBackend(backend.id, {
        status: 'offline',
        lastCheck: Date.now(),
      });
    }
  }

  private startHealthChecks(): void {
    const checkAllBackends = async () => {
      const promises = this.config.backends.map((backend) => this.checkBackendHealth(backend));
      await Promise.allSettled(promises);

      // Auto-switch logic
      if (this.config.autoSwitch && this.config.mode === 'cluster') {
        const activeBackend = this.getActiveBackend();
        if (activeBackend?.status === 'offline') {
          const onlineBackend = this.config.backends.find((b) => b.status === 'online');
          if (onlineBackend) {
            this.setActiveBackend(onlineBackend.id);
          }
        }
      }
    };

    // Initial check
    checkAllBackends();

    // Periodic checks
    setInterval(checkAllBackends, this.config.healthCheckInterval);
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
