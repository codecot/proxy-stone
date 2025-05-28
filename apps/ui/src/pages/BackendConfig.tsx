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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import {
  backendConfigService,
  type BackendInstance,
  type BackendConfig,
} from '@/services/backendConfig';

interface AddBackendDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (backend: Omit<BackendInstance, 'id' | 'status'>) => void;
  editingBackend?: BackendInstance;
}

function AddBackendDialog({ open, onClose, onAdd, editingBackend }: AddBackendDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'single' | 'cluster'>('single');
  const [environment, setEnvironment] = useState('');
  const [region, setRegion] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    responseTime?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (editingBackend) {
      setName(editingBackend.name);
      setUrl(editingBackend.url);
      setType(editingBackend.type);
      setEnvironment(editingBackend.metadata?.environment || '');
      setRegion(editingBackend.metadata?.region || '');
    } else {
      setName('');
      setUrl('');
      setType('single');
      setEnvironment('');
      setRegion('');
    }
    setTestResult(null);
  }, [editingBackend, open]);

  const handleTestConnection = async () => {
    if (!url) return;

    setTesting(true);
    try {
      const result = await backendConfigService.testConnection(url);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = () => {
    if (!name || !url) return;

    const backend: Omit<BackendInstance, 'id' | 'status'> = {
      name,
      url: url.replace(/\/$/, ''), // Remove trailing slash
      type,
      metadata: {
        environment: environment || undefined,
        region: region || undefined,
      },
    };

    onAdd(backend);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingBackend ? 'Edit Backend' : 'Add New Backend'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              label="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              fullWidth
              required
              placeholder="http://localhost:4000"
            />
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={!url || testing}
              startIcon={testing ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              Test
            </Button>
          </Box>

          {testResult && (
            <Alert
              severity={testResult.success ? 'success' : 'error'}
              icon={testResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
            >
              {testResult.success
                ? `Connection successful (${testResult.responseTime}ms)`
                : `Connection failed: ${testResult.error}`}
            </Alert>
          )}

          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as 'single' | 'cluster')}
              label="Type"
            >
              <MenuItem value="single">Single Instance</MenuItem>
              <MenuItem value="cluster">Cluster Node</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            fullWidth
            placeholder="development, staging, production"
          />

          <TextField
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            fullWidth
            placeholder="us-east-1, eu-west-1, etc."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name || !url}>
          {editingBackend ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BackendConfig() {
  const [config, setConfig] = useState<BackendConfig>(backendConfigService.getConfig());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBackend, setEditingBackend] = useState<BackendInstance | undefined>();

  useEffect(() => {
    const unsubscribe = backendConfigService.subscribe(setConfig);
    return unsubscribe;
  }, []);

  const handleAddBackend = (backend: Omit<BackendInstance, 'id' | 'status'>) => {
    if (editingBackend) {
      backendConfigService.updateBackend(editingBackend.id, backend);
      setEditingBackend(undefined);
    } else {
      backendConfigService.addBackend(backend);
    }
  };

  const handleEditBackend = (backend: BackendInstance) => {
    setEditingBackend(backend);
    setDialogOpen(true);
  };

  const handleDeleteBackend = (backendId: string) => {
    if (window.confirm('Are you sure you want to delete this backend?')) {
      try {
        backendConfigService.removeBackend(backendId);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete backend');
      }
    }
  };

  const handleSetActive = (backendId: string) => {
    backendConfigService.setActiveBackend(backendId);
  };

  const handleModeChange = (mode: 'single' | 'cluster') => {
    backendConfigService.setMode(mode);
  };

  const handleAutoSwitchChange = (autoSwitch: boolean) => {
    backendConfigService.setAutoSwitch(autoSwitch);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon color="success" />;
      case 'offline':
        return <ErrorIcon color="error" />;
      default:
        return <HelpIcon color="disabled" />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Backend Configuration</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingBackend(undefined);
            setDialogOpen(true);
          }}
        >
          Add Backend
        </Button>
      </Box>

      {/* Configuration Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Global Settings
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Mode</InputLabel>
              <Select
                value={config.mode}
                onChange={(e) => handleModeChange(e.target.value as 'single' | 'cluster')}
                label="Mode"
              >
                <MenuItem value="single">Single Instance</MenuItem>
                <MenuItem value="cluster">Cluster/Multi-Node</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.autoSwitch}
                  onChange={(e) => handleAutoSwitchChange(e.target.checked)}
                  disabled={config.mode === 'single'}
                />
              }
              label="Auto-switch on failure (cluster mode only)"
            />
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Single Instance:</strong> Connect to one backend at a time. Suitable for
            development or simple deployments.
            <br />
            <strong>Cluster Mode:</strong> Manage multiple backend instances with automatic failover
            capabilities.
          </Typography>
        </Alert>
      </Paper>

      {/* Backend Instances */}
      <Typography variant="h6" gutterBottom>
        Backend Instances
      </Typography>

      <Grid container spacing={2}>
        {config.backends.map((backend) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={backend.id}>
            <Card
              sx={{
                border: backend.id === config.activeBackendId ? 2 : 1,
                borderColor: backend.id === config.activeBackendId ? 'primary.main' : 'divider',
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" component="div">
                    {backend.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(backend.status)}
                    <Chip
                      label={backend.status}
                      color={getStatusColor(backend.status) as 'success' | 'error' | 'default'}
                      size="small"
                    />
                  </Box>
                </Box>

                <Typography color="text.secondary" gutterBottom>
                  {backend.url}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip label={backend.type} size="small" variant="outlined" />
                  {backend.metadata?.environment && (
                    <Chip label={backend.metadata.environment} size="small" variant="outlined" />
                  )}
                  {backend.metadata?.region && (
                    <Chip label={backend.metadata.region} size="small" variant="outlined" />
                  )}
                </Box>

                {backend.responseTime && (
                  <Typography variant="body2" color="text.secondary">
                    Response Time: {backend.responseTime}ms
                  </Typography>
                )}

                {backend.lastCheck && (
                  <Typography variant="body2" color="text.secondary">
                    Last Check: {new Date(backend.lastCheck).toLocaleString()}
                  </Typography>
                )}

                {backend.id === config.activeBackendId && (
                  <Chip label="Active" color="primary" size="small" sx={{ mt: 1 }} />
                )}
              </CardContent>

              <CardActions>
                {backend.id !== config.activeBackendId && (
                  <Button
                    size="small"
                    onClick={() => handleSetActive(backend.id)}
                    disabled={backend.status === 'offline'}
                  >
                    Set Active
                  </Button>
                )}
                <IconButton size="small" onClick={() => handleEditBackend(backend)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteBackend(backend.id)}
                  disabled={config.backends.length <= 1}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <AddBackendDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingBackend(undefined);
        }}
        onAdd={handleAddBackend}
        editingBackend={editingBackend}
      />
    </Box>
  );
}
