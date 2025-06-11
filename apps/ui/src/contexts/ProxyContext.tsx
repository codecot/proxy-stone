import React, { createContext, useContext, useState, useEffect } from 'react';
import { backendConfigService, type BackendInstance } from '@/services/backendConfig';
import { setProxyBaseUrl } from '@/services/proxyAwareApi';

export interface ProxyContextType {
  // Currently selected proxy for management
  selectedProxy: BackendInstance | null;
  
  // All available proxies
  availableProxies: BackendInstance[];
  
  // Functions to manage proxy selection
  selectProxy: (proxy: BackendInstance | null) => void;
  
  // Function to refresh proxy list
  refreshProxies: () => void;
  
  // Connection status to selected proxy
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  // Error message if connection fails
  connectionError?: string;
  
  // Get API base URL for selected proxy
  getApiBaseUrl: () => string;
  
  // Check if we're connected to coordinator vs worker
  isCoordinator: boolean;
}

const ProxyContext = createContext<ProxyContextType | undefined>(undefined);

export function useProxy() {
  const context = useContext(ProxyContext);
  if (context === undefined) {
    throw new Error('useProxy must be used within a ProxyProvider');
  }
  return context;
}

interface ProxyProviderProps {
  children: React.ReactNode;
}

export function ProxyProvider({ children }: ProxyProviderProps) {
  const [selectedProxy, setSelectedProxy] = useState<BackendInstance | null>(null);
  const [availableProxies, setAvailableProxies] = useState<BackendInstance[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | undefined>();

  // Subscribe to backend config changes
  useEffect(() => {
    const updateProxies = (config: any) => {
      setAvailableProxies(config.backends || []);
      
      // Auto-select active backend if no proxy is selected
      if (!selectedProxy && config.backends && config.backends.length > 0) {
        const activeBackend = config.backends.find((b: BackendInstance) => b.id === config.activeBackendId);
        if (activeBackend) {
          setSelectedProxy(activeBackend);
        }
      }
      
      // Update selected proxy if it changed
      if (selectedProxy) {
        const updatedProxy = config.backends?.find((b: BackendInstance) => b.id === selectedProxy.id);
        if (updatedProxy) {
          setSelectedProxy(updatedProxy);
        }
      }
    };

    const unsubscribe = backendConfigService.subscribe(updateProxies);
    
    // Initial load
    const config = backendConfigService.getConfig();
    updateProxies(config);

    return unsubscribe;
  }, [selectedProxy]);

  // Test connection to selected proxy
  useEffect(() => {
    if (!selectedProxy) {
      setConnectionStatus('disconnected');
      return;
    }

    const testConnection = async () => {
      setConnectionStatus('connecting');
      setConnectionError(undefined);

      try {
        const result = await backendConfigService.testConnection(selectedProxy.url);
        if (result.success) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('error');
          setConnectionError(result.error || 'Connection failed');
        }
      } catch (error) {
        setConnectionStatus('error');
        setConnectionError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    testConnection();
    
    // Test connection periodically
    const interval = setInterval(testConnection, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [selectedProxy]);

  const selectProxy = (proxy: BackendInstance | null) => {
    setSelectedProxy(proxy);
    if (proxy) {
      // Also update the backend config service to use this proxy
      backendConfigService.setActiveBackend(proxy.id);
      
      // Update the proxy-aware API to use this proxy's base URL
      setProxyBaseUrl(`${proxy.url}/api`);
    }
  };

  const refreshProxies = () => {
    // Trigger discovery to refresh proxy list
    backendConfigService.triggerDiscovery();
  };

  const getApiBaseUrl = (): string => {
    if (!selectedProxy) {
      return 'http://localhost:4401'; // Fallback
    }
    return `${selectedProxy.url}/api`;
  };

  const isCoordinator = selectedProxy?.clusterRole === 'coordinator';

  const contextValue: ProxyContextType = {
    selectedProxy,
    availableProxies,
    selectProxy,
    refreshProxies,
    connectionStatus,
    connectionError,
    getApiBaseUrl,
    isCoordinator,
  };

  return (
    <ProxyContext.Provider value={contextValue}>
      {children}
    </ProxyContext.Provider>
  );
}