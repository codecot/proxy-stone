import { Box, Typography, Paper, CircularProgress, Chip, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { proxyAwareApiService } from '@/services/proxyAwareApi';
import { backendConfigService } from '@/services/backendConfig';
import { useProxy } from '@/contexts/ProxyContext';

interface BackendStatus {
  host: string;
  status: string;
  responseTime?: number;
  lastCheck: number;
}

export default function Dashboard() {
  const { selectedProxy, connectionStatus, isCoordinator } = useProxy();

  // Use proxy-aware API to get data from the selected proxy
  const { data: healthStatus, isLoading: healthLoading } = useQuery({
    queryKey: ['proxyHealthStatus', selectedProxy?.id],
    queryFn: proxyAwareApiService.getHealthStatus,
    enabled: !!selectedProxy && connectionStatus === 'connected',
  });

  const { data: cacheConfig, isLoading: cacheConfigLoading } = useQuery({
    queryKey: ['proxyCacheConfig', selectedProxy?.id],
    queryFn: proxyAwareApiService.getCacheConfig,
    enabled: !!selectedProxy && connectionStatus === 'connected',
  });

  const { data: clusterStatus, isLoading: clusterLoading } = useQuery({
    queryKey: ['proxyClusterStatus', selectedProxy?.id],
    queryFn: proxyAwareApiService.getProxyClusterStatus,
    enabled: !!selectedProxy && connectionStatus === 'connected',
  });

  // Get current backend configuration
  const backendConfig = backendConfigService.getConfig();
  const activeBackend = backendConfigService.getActiveBackend();

  // Show loading state
  if (healthLoading || cacheConfigLoading || clusterLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  // Show connection status if not connected
  if (!selectedProxy || connectionStatus !== 'connected') {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="warning">
          {!selectedProxy 
            ? 'No proxy selected. Click the proxy selector in the header to choose a proxy backend to manage.'
            : `Not connected to proxy (${connectionStatus}). Please check the proxy status or select a different proxy.`
          }
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Connected to:
          </Typography>
          <Chip 
            label={selectedProxy.name}
            color={isCoordinator ? 'primary' : 'secondary'}
            size="small"
          />
          {isCoordinator && (
            <Chip label="Coordinator" color="primary" size="small" variant="outlined" />
          )}
        </Box>
      </Box>

      <Box display="flex" flexDirection="column" gap={3}>
        {/* Top Row */}
        <Box display="flex" gap={3} flexWrap="wrap">
          {/* Proxy Health */}
          <Box flex="1" minWidth="300px">
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Proxy Health
              </Typography>
              <Typography>Status: {healthStatus?.status || 'Unknown'}</Typography>
              <Typography>Version: {healthStatus?.version || 'N/A'}</Typography>
              <Typography>
                Uptime:{' '}
                {healthStatus?.uptime
                  ? `${Math.floor(healthStatus.uptime / 3600)}h ${Math.floor((healthStatus.uptime % 3600) / 60)}m`
                  : 'N/A'}
              </Typography>
              <Typography>URL: {selectedProxy.url}</Typography>
            </Paper>
          </Box>

          {/* Cluster Information */}
          <Box flex="1" minWidth="300px">
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Cluster Information
              </Typography>
              <Typography>
                Role: <Chip label={selectedProxy.clusterRole || 'unknown'} size="small" color={isCoordinator ? 'primary' : 'secondary'} />
              </Typography>
              <Typography>Cluster ID: {selectedProxy.clusterId || 'N/A'}</Typography>
              <Typography>Node ID: {selectedProxy.nodeId?.substring(0, 8) || 'N/A'}...</Typography>
              <Typography>
                Service Mode: <Chip label={clusterStatus?.serviceStatus?.mode || 'unknown'} size="small" />
              </Typography>
            </Paper>
          </Box>

          {/* Cache Configuration */}
          <Box flex="1" minWidth="300px">
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Cache Configuration
              </Typography>
              <Typography>Default TTL: {cacheConfig?.defaultTTL || 'N/A'} seconds</Typography>
              <Typography>Methods: {cacheConfig?.methods?.join(', ') || 'N/A'}</Typography>
              <Typography>Rules: {cacheConfig?.rules?.length || 0} active rules</Typography>
              <Typography>Max Size: {cacheConfig?.maxSize || 'N/A'} entries</Typography>
            </Paper>
          </Box>
        </Box>

        {/* Proxy-Specific Information */}
        <Box>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Proxy Details
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Connection</Typography>
                <Typography>Response Time: {selectedProxy.responseTime || 'N/A'}ms</Typography>
                <Typography>Last Check: {selectedProxy.lastCheck ? new Date(selectedProxy.lastCheck).toLocaleString() : 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Type</Typography>
                <Typography>Type: {selectedProxy.type}</Typography>
                <Typography>Environment: {selectedProxy.metadata?.environment || 'N/A'}</Typography>
              </Box>
              {selectedProxy.metadata?.autoDiscovered && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Discovery</Typography>
                  <Typography>Auto-discovered: Yes</Typography>
                  <Typography>Discovered at: {selectedProxy.metadata.discoveredAt ? new Date(selectedProxy.metadata.discoveredAt).toLocaleString() : 'N/A'}</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
