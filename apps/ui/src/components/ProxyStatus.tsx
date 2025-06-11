import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Storage as ProxyIcon,
  CheckCircle as ConnectedIcon,
  Error as DisconnectedIcon,
  Star as CoordinatorIcon,
  Work as WorkerIcon,
  SwapHoriz as SwitchIcon,
} from '@mui/icons-material';
import { useProxy } from '@/contexts/ProxyContext';
import ProxySelector from './ProxySelector';

export default function ProxyStatus() {
  const { 
    selectedProxy, 
    connectionStatus, 
    connectionError,
    isCoordinator 
  } = useProxy();
  
  const [selectorOpen, setSelectorOpen] = useState(false);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <ConnectedIcon color="success" />;
      case 'connecting':
        return <CircularProgress size={16} />;
      case 'error':
      case 'disconnected':
        return <DisconnectedIcon color="error" />;
      default:
        return <ProxyIcon color="disabled" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'info';
      case 'error':
      case 'disconnected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getRoleIcon = () => {
    if (!selectedProxy) return null;
    return isCoordinator ? <CoordinatorIcon /> : <WorkerIcon />;
  };

  const getDisplayName = () => {
    if (!selectedProxy) return 'No Proxy Selected';
    
    // Extract hostname and port for compact display
    try {
      const url = new URL(selectedProxy.url);
      return `${url.hostname}:${url.port}`;
    } catch {
      return selectedProxy.name;
    }
  };

  const getTooltipText = () => {
    if (!selectedProxy) return 'Click to select a proxy backend';
    
    let text = `${selectedProxy.name}\n${selectedProxy.url}\nRole: ${selectedProxy.clusterRole || 'unknown'}\nStatus: ${connectionStatus}`;
    
    if (connectionError) {
      text += `\nError: ${connectionError}`;
    }
    
    return text;
  };

  return (
    <>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          cursor: 'pointer',
          p: 1,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
        onClick={() => setSelectorOpen(true)}
        title={getTooltipText()}
      >
        {/* Status indicator */}
        {getStatusIcon()}
        
        {/* Proxy info */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getRoleIcon()}
            <Typography 
              variant="body2" 
              color={selectedProxy ? 'text.primary' : 'text.secondary'}
              noWrap
              sx={{ fontSize: '0.875rem' }}
            >
              {getDisplayName()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={connectionStatus}
              size="small"
              color={getStatusColor() as any}
              sx={{ 
                height: 16, 
                fontSize: '0.6rem',
                '& .MuiChip-label': { px: 0.5 }
              }}
            />
            {selectedProxy?.clusterRole && (
              <Chip
                label={selectedProxy.clusterRole}
                size="small"
                variant="outlined"
                color={isCoordinator ? 'primary' : 'secondary'}
                sx={{ 
                  height: 16, 
                  fontSize: '0.6rem',
                  '& .MuiChip-label': { px: 0.5 }
                }}
              />
            )}
          </Box>
        </Box>
        
        {/* Switch indicator */}
        <SwitchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      </Box>

      <ProxySelector 
        open={selectorOpen} 
        onClose={() => setSelectorOpen(false)} 
      />
    </>
  );
}