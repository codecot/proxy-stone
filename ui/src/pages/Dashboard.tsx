import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';

interface BackendStatus {
  host: string;
  status: string;
  responseTime?: number;
  lastCheck: number;
}

export default function Dashboard() {
  const { data: healthStatus, isLoading: healthLoading } = useQuery({
    queryKey: ['healthStatus'],
    queryFn: apiService.getHealthStatus,
  });

  const { data: backendStatus, isLoading: backendLoading } = useQuery({
    queryKey: ['backendStatus'],
    queryFn: apiService.getBackendStatus,
  });

  const { data: cacheConfig, isLoading: cacheConfigLoading } = useQuery({
    queryKey: ['cacheConfig'],
    queryFn: apiService.getCacheConfig,
  });

  if (healthLoading || backendLoading || cacheConfigLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Box display="flex" flexDirection="column" gap={3}>
        {/* Top Row */}
        <Box display="flex" gap={3} flexWrap="wrap">
          {/* System Health */}
          <Box flex="1" minWidth="300px">
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              <Typography>Status: {healthStatus?.status || 'Unknown'}</Typography>
              <Typography>Version: {healthStatus?.version || 'N/A'}</Typography>
              <Typography>
                Uptime:{' '}
                {healthStatus?.uptime
                  ? `${Math.floor(healthStatus.uptime / 3600)}h ${Math.floor((healthStatus.uptime % 3600) / 60)}m`
                  : 'N/A'}
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
            </Paper>
          </Box>
        </Box>

        {/* Backend Status */}
        <Box>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Backend Status
            </Typography>
            {backendStatus?.backends?.map((backend: BackendStatus) => (
              <Box key={backend.host} sx={{ mb: 2 }}>
                <Typography variant="subtitle1">{backend.host}</Typography>
                <Typography>Status: {backend.status}</Typography>
                <Typography>Response Time: {backend.responseTime || 'N/A'}ms</Typography>
                <Typography>Last Check: {new Date(backend.lastCheck).toLocaleString()}</Typography>
              </Box>
            ))}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
