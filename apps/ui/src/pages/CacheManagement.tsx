import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { apiService } from '../services/api';
import type { CacheEntry, CacheRule } from '../services/api';

interface ExtendedCacheEntry extends CacheEntry {
  method?: string;
  url?: string;
}

export default function CacheManagement() {
  const [selectedEntry, setSelectedEntry] = useState<ExtendedCacheEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    method: '',
    url: '',
    backend_host: '',
    limit: 50,
    offset: 0,
  });

  const queryClient = useQueryClient();

  const { data: cacheEntries, isLoading } = useQuery({
    queryKey: ['cacheEntries', filters],
    queryFn: () => apiService.getCacheEntries(filters),
  });

  const { data: cacheRules } = useQuery({
    queryKey: ['cacheRules'],
    queryFn: apiService.getCacheRules,
  });

  const refreshMutation = useMutation({
    mutationFn: ({ key, force }: { key: string; force?: boolean }) =>
      apiService.refreshCacheEntry(key, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cacheEntries'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => apiService.deleteCacheEntry(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cacheEntries'] });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ key, data, ttl }: { key: string; data: unknown; ttl?: number }) =>
      apiService.updateCacheEntry(key, data, ttl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cacheEntries'] });
      setEditDialogOpen(false);
    },
  });

  const handleEditEntry = (entry: ExtendedCacheEntry) => {
    setSelectedEntry(entry);
    setEditDialogOpen(true);
  };

  const handleSaveEntry = (data: unknown, ttl?: number) => {
    if (selectedEntry) {
      updateEntryMutation.mutate({ key: selectedEntry.key, data, ttl });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cache Management
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <Box flex="1" minWidth="200px">
            <TextField
              fullWidth
              label="Method"
              value={filters.method}
              onChange={(e) => setFilters({ ...filters, method: e.target.value })}
            />
          </Box>
          <Box flex="1" minWidth="200px">
            <TextField
              fullWidth
              label="URL"
              value={filters.url}
              onChange={(e) => setFilters({ ...filters, url: e.target.value })}
            />
          </Box>
          <Box flex="1" minWidth="200px">
            <TextField
              fullWidth
              label="Backend Host"
              value={filters.backend_host}
              onChange={(e) => setFilters({ ...filters, backend_host: e.target.value })}
            />
          </Box>
          <Box flex="1" minWidth="200px">
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                /* TODO: Implement add rule dialog */
              }}
            >
              Add Cache Rule
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Cache Entries Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>TTL</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Accessed</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : (
              cacheEntries?.entries?.map((entry: ExtendedCacheEntry) => (
                <TableRow key={entry.key}>
                  <TableCell>
                    <Tooltip title={entry.key}>
                      <Typography noWrap sx={{ maxWidth: 200 }}>
                        {entry.key}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{entry.method || 'N/A'}</TableCell>
                  <TableCell>
                    <Tooltip title={entry.url || 'N/A'}>
                      <Typography noWrap sx={{ maxWidth: 200 }}>
                        {entry.url || 'N/A'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={entry.status}
                      color={entry.status < 400 ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{entry.ttl}s</TableCell>
                  <TableCell>{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>{formatDate(entry.lastAccessed)}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => refreshMutation.mutate({ key: entry.key, force: true })}
                    >
                      <RefreshIcon />
                    </IconButton>
                    <IconButton onClick={() => handleEditEntry(entry)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => deleteMutation.mutate(entry.key)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Entry Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Cache Entry</DialogTitle>
        <DialogContent>
          {selectedEntry && (
            <Box sx={{ mt: 2 }}>
              <Editor
                height="400px"
                defaultLanguage="json"
                value={JSON.stringify(selectedEntry.data, null, 2)}
                onChange={(value) => {
                  if (value) {
                    try {
                      const data = JSON.parse(value);
                      handleSaveEntry(data, selectedEntry.ttl);
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedEntry) {
                handleSaveEntry(selectedEntry.data, selectedEntry.ttl);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cache Rules */}
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Cache Rules
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pattern</TableCell>
              <TableCell>Methods</TableCell>
              <TableCell>TTL</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cacheRules?.rules?.map((rule: CacheRule) => (
              <TableRow key={rule.pattern}>
                <TableCell>{rule.pattern}</TableCell>
                <TableCell>{rule.methods?.join(', ')}</TableCell>
                <TableCell>{rule.ttl}s</TableCell>
                <TableCell>
                  <Chip
                    label={rule.enabled ? 'Enabled' : 'Disabled'}
                    color={rule.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => {
                      /* TODO: Implement edit rule dialog */
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => apiService.deleteCacheRule(rule.pattern)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
