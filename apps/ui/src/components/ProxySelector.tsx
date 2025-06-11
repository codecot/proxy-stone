import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Storage as ProxyIcon,
  CheckCircle as OnlineIcon,
  Error as OfflineIcon,
  Star as CoordinatorIcon,
  Work as WorkerIcon,
  Refresh as RefreshIcon,
  HelpOutline as UnknownIcon,
  RadioButtonChecked as SelectedIcon,
  RadioButtonUnchecked as UnselectedIcon,
} from '@mui/icons-material';
import { useProxy } from '@/contexts/ProxyContext';
import type { BackendInstance } from '@/services/backendConfig';

interface ProxySelectorProps {
  open: boolean;
  onClose: () => void;
}

export default function ProxySelector({ open, onClose }: ProxySelectorProps) {
  const { 
    selectedProxy, 
    availableProxies, 
    selectProxy, 
    refreshProxies,
    connectionStatus 
  } = useProxy();
  
  const [refreshing, setRefreshing] = useState(false);

  const handleSelectProxy = (proxy: BackendInstance) => {
    selectProxy(proxy);
    onClose();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      refreshProxies();
      // Wait a bit for discovery to complete
      setTimeout(() => setRefreshing(false), 2000);
    } catch (error) {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <OnlineIcon color="success" />;
      case 'offline':
        return <OfflineIcon color="error" />;
      default:
        return <UnknownIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'coordinator':
        return <CoordinatorIcon color="primary" />;
      case 'worker':
        return <WorkerIcon color="secondary" />;
      default:
        return <UnknownIcon color="disabled" />;
    }
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'coordinator':
        return 'primary';
      case 'worker':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatLastSeen = (lastCheck?: number) => {
    if (!lastCheck) return 'Never';
    const now = Date.now();
    const diff = now - lastCheck;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ProxyIcon />
            <Typography variant="h6">Select Proxy Backend</Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
            size="small"
          >
            {refreshing ? 'Discovering...' : 'Refresh'}
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {availableProxies.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No proxy backends discovered yet. Make sure proxy instances are running and try refreshing.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select a proxy backend to manage. The UI will connect to the selected proxy and show its specific data.
            </Typography>
            
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Select</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Cluster</TableCell>
                    <TableCell>Response Time</TableCell>
                    <TableCell>Last Seen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableProxies.map((proxy) => (
                    <TableRow 
                      key={proxy.id}
                      hover
                      onClick={() => handleSelectProxy(proxy)}
                      sx={{ 
                        cursor: 'pointer',
                        backgroundColor: selectedProxy?.id === proxy.id ? 'action.selected' : 'inherit',
                      }}
                    >
                      <TableCell>
                        <IconButton size="small" color="primary">
                          {selectedProxy?.id === proxy.id ? 
                            <SelectedIcon color="primary" /> : 
                            <UnselectedIcon />
                          }
                        </IconButton>
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getRoleIcon(proxy.clusterRole)}
                          <Typography variant="body2" fontWeight={selectedProxy?.id === proxy.id ? 'bold' : 'normal'}>
                            {proxy.name}
                          </Typography>
                          {selectedProxy?.id === proxy.id && (
                            <Chip label="Current" size="small" color="primary" />
                          )}
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {proxy.url}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getRoleIcon(proxy.clusterRole)}
                          <Chip
                            label={proxy.clusterRole || 'unknown'}
                            size="small"
                            color={getRoleColor(proxy.clusterRole) as any}
                            variant="outlined"
                          />
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getStatusIcon(proxy.status)}
                          <Chip
                            label={proxy.status}
                            size="small"
                            color={getStatusColor(proxy.status) as any}
                          />
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {proxy.clusterId || 'unknown'}
                        </Typography>
                        {proxy.nodeId && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {proxy.nodeId.substring(0, 8)}...
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {proxy.responseTime ? `${proxy.responseTime}ms` : '-'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {formatLastSeen(proxy.lastCheck)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {selectedProxy && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Currently selected:</strong> {selectedProxy.name} ({selectedProxy.url})
                  <br />
                  <strong>Connection status:</strong> {connectionStatus}
                  {selectedProxy.clusterRole === 'coordinator' && (
                    <>
                      <br />
                      <strong>Note:</strong> You're connected to the cluster coordinator. This gives you access to full cluster management features.
                    </>
                  )}
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          {selectedProxy ? 'Close' : 'Cancel'}
        </Button>
        {selectedProxy && (
          <Button 
            variant="contained" 
            onClick={() => {
              // Keep current selection and close
              onClose();
            }}
          >
            Use {selectedProxy.name}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}