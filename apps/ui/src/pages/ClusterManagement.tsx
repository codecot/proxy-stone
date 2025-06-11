import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  HelpOutline as HelpIcon,
  PlayArrow as EnableIcon,
  Stop as DisableIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, type ClusterNode, type ClusterHealth } from '@/services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cluster-tabpanel-${index}`}
      aria-labelledby={`cluster-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface RegisterNodeDialogProps {
  open: boolean;
  onClose: () => void;
}

function RegisterNodeDialog({ open, onClose }: RegisterNodeDialogProps) {
  const [url, setUrl] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [role, setRole] = useState('worker');
  const [tags, setTags] = useState('');
  const [region, setRegion] = useState('');
  const [zone, setZone] = useState('');

  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (nodeData: any) => apiService.registerClusterNode(nodeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusterNodes'] });
      queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
      onClose();
      // Reset form
      setUrl('');
      setClusterId('');
      setRole('worker');
      setTags('');
      setRegion('');
      setZone('');
    },
  });

  const handleSubmit = () => {
    if (!url) return;

    const nodeData = {
      url: url.replace(/\/$/, ''), // Remove trailing slash
      clusterId: clusterId || 'default-cluster',
      role,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      metadata: {
        region: region || undefined,
        zone: zone || undefined,
        registeredVia: 'ui',
        registeredAt: new Date().toISOString(),
      },
    };

    registerMutation.mutate(nodeData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Register New Proxy Node</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Node URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            fullWidth
            required
            placeholder="http://localhost:4401"
            helperText="URL of the proxy node to register"
          />

          <TextField
            label="Cluster ID"
            value={clusterId}
            onChange={(e) => setClusterId(e.target.value)}
            fullWidth
            placeholder="default-cluster"
            helperText="Cluster identifier (optional)"
          />

          <TextField
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            placeholder="worker"
            helperText="Node role (worker, leader, etc.)"
          />

          <TextField
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            fullWidth
            placeholder="production, us-east-1"
            helperText="Comma-separated tags"
          />

          <TextField
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            fullWidth
            placeholder="us-east-1"
          />

          <TextField
            label="Zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            fullWidth
            placeholder="us-east-1a"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!url || registerMutation.isPending}
          startIcon={registerMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          Register
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ClusterManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Queries
  const { data: clusterNodes, isLoading: nodesLoading, refetch: refetchNodes } = useQuery({
    queryKey: ['clusterNodes'],
    queryFn: apiService.getClusterNodes,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: clusterHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['clusterHealth'],
    queryFn: apiService.getClusterHealth,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: clusterStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['clusterStatus'],
    queryFn: apiService.getClusterStatus,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Mutations
  const enableNodeMutation = useMutation({
    mutationFn: (nodeId: string) => apiService.enableClusterNode(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusterNodes'] });
      queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
    },
  });

  const disableNodeMutation = useMutation({
    mutationFn: (nodeId: string) => apiService.disableClusterNode(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusterNodes'] });
      queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
    },
  });

  const removeNodeMutation = useMutation({
    mutationFn: (nodeId: string) => apiService.removeClusterNode(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusterNodes'] });
      queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'online':
        return 'success';
      case 'inactive':
      case 'offline':
        return 'error';
      case 'disabled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'online':
        return <CheckCircleIcon color="success" />;
      case 'inactive':
      case 'offline':
        return <ErrorIcon color="error" />;
      case 'disabled':
        return <WarningIcon color="warning" />;
      default:
        return <HelpIcon color="disabled" />;
    }
  };

  const handleEnableNode = (nodeId: string) => {
    enableNodeMutation.mutate(nodeId);
  };

  const handleDisableNode = (nodeId: string) => {
    disableNodeMutation.mutate(nodeId);
  };

  const handleRemoveNode = (nodeId: string) => {
    if (window.confirm('Are you sure you want to remove this node from the cluster?')) {
      removeNodeMutation.mutate(nodeId);
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    try {
      return new Date(lastSeen).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Cluster Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              refetchNodes();
              queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
              queryClient.invalidateQueries({ queryKey: ['clusterStatus'] });
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setRegisterDialogOpen(true)}
          >
            Register Node
          </Button>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" />
          <Tab label="Nodes" />
          <Tab label="Health" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Overview Tab */}
        <Grid container spacing={3}>
          {/* Cluster Status */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Node Status
                </Typography>
                {statusLoading ? (
                  <CircularProgress size={24} />
                ) : clusterStatus ? (
                  <Box>
                    <Typography>Node ID: {clusterStatus.status?.nodeId || 'Unknown'}</Typography>
                    <Typography>
                      Status: <Chip 
                        label={clusterStatus.status?.status || 'Unknown'} 
                        color={getStatusColor(clusterStatus.status?.status || '')}
                        size="small" 
                      />
                    </Typography>
                    <Typography>Uptime: {formatUptime(clusterStatus.status?.uptime || 0)}</Typography>
                    <Typography>
                      Memory: {clusterStatus.status?.memoryUsage?.percentage?.toFixed(1) || 0}%
                    </Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">No status available</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Cluster Health */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cluster Health
                </Typography>
                {healthLoading ? (
                  <CircularProgress size={24} />
                ) : clusterHealth ? (
                  <Box>
                    <Typography>Total Nodes: {clusterHealth.health?.totalNodes || 0}</Typography>
                    <Typography>Active Nodes: {clusterHealth.health?.activeNodes || 0}</Typography>
                    <Typography>Inactive Nodes: {clusterHealth.health?.inactiveNodes || 0}</Typography>
                    <Typography>Disabled Nodes: {clusterHealth.health?.disabledNodes || 0}</Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">No health data available</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Nodes Tab */}
        {nodesLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : clusterNodes?.nodes?.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Node ID</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clusterNodes.nodes.map((node: ClusterNode) => (
                  <TableRow key={node.id}>
                    <TableCell>{node.id}</TableCell>
                    <TableCell>{node.url}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(node.status)}
                        <Chip
                          label={node.status}
                          color={getStatusColor(node.status) as any}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{node.role}</TableCell>
                    <TableCell>{formatLastSeen(node.lastSeen)}</TableCell>
                    <TableCell>
                      {node.tags?.map((tag) => (
                        <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {node.status !== 'active' && (
                          <IconButton
                            size="small"
                            onClick={() => handleEnableNode(node.id)}
                            disabled={enableNodeMutation.isPending}
                            title="Enable Node"
                          >
                            <EnableIcon />
                          </IconButton>
                        )}
                        {node.status === 'active' && (
                          <IconButton
                            size="small"
                            onClick={() => handleDisableNode(node.id)}
                            disabled={disableNodeMutation.isPending}
                            title="Disable Node"
                          >
                            <DisableIcon />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveNode(node.id)}
                          disabled={removeNodeMutation.isPending}
                          title="Remove Node"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            No cluster nodes registered yet. Click "Register Node" to add proxy instances to the cluster.
          </Alert>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Health Tab */}
        {healthLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : clusterHealth?.health?.nodes?.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Node ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell>Uptime</TableCell>
                  <TableCell>Memory Usage</TableCell>
                  <TableCell>CPU Usage</TableCell>
                  <TableCell>Connections</TableCell>
                  <TableCell>RPS</TableCell>
                  <TableCell>Error Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clusterHealth.health.nodes.map((node: any) => (
                  <TableRow key={node.nodeId}>
                    <TableCell>{node.nodeId}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(node.status)}
                        <Chip
                          label={node.status}
                          color={getStatusColor(node.status) as any}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{formatLastSeen(node.lastSeen)}</TableCell>
                    <TableCell>{formatUptime(node.uptime)}</TableCell>
                    <TableCell>{node.memoryUsage?.percentage?.toFixed(1) || 0}%</TableCell>
                    <TableCell>{node.cpuUsage?.toFixed(1) || 0}%</TableCell>
                    <TableCell>{node.activeConnections || 0}</TableCell>
                    <TableCell>{node.requestsPerSecond?.toFixed(1) || 0}</TableCell>
                    <TableCell>{node.errorRate?.toFixed(2) || 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            No health data available for cluster nodes.
          </Alert>
        )}
      </TabPanel>

      <RegisterNodeDialog
        open={registerDialogOpen}
        onClose={() => setRegisterDialogOpen(false)}
      />
    </Box>
  );
}