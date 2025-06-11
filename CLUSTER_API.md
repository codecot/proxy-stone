# Cluster Management API

This document describes the API endpoints for managing Proxy Stone clusters.

## Overview

Proxy Stone supports distributed deployments with a coordinator/worker architecture. The cluster API provides endpoints for node registration, health monitoring, and service management.

## Base URLs

- **Coordinator**: `http://localhost:4401/api`
- **Worker 1**: `http://localhost:4402/api`
- **Worker 2**: `http://localhost:4403/api`
- **UI**: `http://localhost:4400`

## Authentication

Currently, cluster APIs do not require authentication. This may change in future versions.

## Node Registration

### Register Node
Register a new worker node with the coordinator.

**Endpoint**: `POST /cluster/register`

**Request Body**:
```json
{
  "id": "a51c132e-4b71-409c-bf6d-98b5bbc2d2a9",
  "url": "http://127.0.0.1:4402",
  "clusterId": "default-cluster",
  "role": "worker",
  "capabilities": {},
  "tags": [],
  "metadata": {
    "autoRegistered": true,
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "startTime": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response**:
```json
{
  "success": true,
  "node": {
    "id": "a51c132e-4b71-409c-bf6d-98b5bbc2d2a9",
    "url": "http://127.0.0.1:4402",
    "clusterId": "default-cluster",
    "status": "active",
    "role": "worker",
    "lastSeen": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Health Monitoring

### Send Heartbeat
Send a heartbeat to maintain node health status.

**Endpoint**: `POST /cluster/heartbeat/{nodeId}`

**Request Body**:
```json
{
  "status": "active",
  "metadata": {
    "load": 0.45,
    "memory": 0.68,
    "connections": 142
  }
}
```

**Response**:
```json
{
  "success": true,
  "acknowledged": true,
  "timestamp": "2024-01-15T10:31:00.000Z"
}
```

## Cluster Information

### Get All Nodes
Retrieve information about all nodes in the cluster.

**Endpoint**: `GET /cluster/nodes`

**Response**:
```json
{
  "success": true,
  "nodes": [
    {
      "id": "9b59c458-coordinator-id",
      "url": "http://127.0.0.1:4401",
      "clusterId": "default-cluster",
      "status": "active",
      "role": "coordinator",
      "lastSeen": "2024-01-15T10:31:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "a51c132e-4b71-409c-bf6d-98b5bbc2d2a9",
      "url": "http://127.0.0.1:4402",
      "clusterId": "default-cluster",
      "status": "active",
      "role": "worker",
      "lastSeen": "2024-01-15T10:31:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 2
}
```

### Get Cluster Status
Get the current node's cluster status and configuration.

**Endpoint**: `GET /cluster/status`

**Response**:
```json
{
  "success": true,
  "status": {
    "id": "9b59c458-coordinator-id",
    "url": "http://127.0.0.1:4401",
    "clusterId": "default-cluster",
    "status": "active",
    "role": "coordinator",
    "lastSeen": "2024-01-15T10:31:00.000Z"
  },
  "config": {
    "enabled": true,
    "clusterId": "default-cluster",
    "coordinatorUrl": null,
    "heartbeatInterval": 30,
    "nodeTimeout": 60
  },
  "serviceStatus": {
    "mode": "serving",
    "enabled": true,
    "startTime": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Cluster Health
Get overall cluster health information.

**Endpoint**: `GET /cluster/health`

**Response**:
```json
{
  "success": true,
  "health": {
    "totalNodes": 3,
    "activeNodes": 3,
    "inactiveNodes": 0,
    "coordinatorHealthy": true,
    "lastUpdate": "2024-01-15T10:31:00.000Z",
    "nodes": [
      {
        "id": "coordinator-id",
        "status": "active",
        "role": "coordinator",
        "responseTime": 5.2
      },
      {
        "id": "worker-1-id",
        "status": "active", 
        "role": "worker",
        "responseTime": 3.8
      }
    ]
  }
}
```

## Service Management

### Enable Serving
Enable the proxy serving functionality on the current node.

**Endpoint**: `POST /cluster/enable-serving`

**Response**:
```json
{
  "success": true,
  "message": "Cluster serving enabled",
  "status": {
    "mode": "serving",
    "enabled": true,
    "changedAt": "2024-01-15T10:32:00.000Z"
  }
}
```

### Disable Serving (Maintenance Mode)
Disable the proxy serving functionality (maintenance mode).

**Endpoint**: `POST /cluster/disable-serving`

**Response**:
```json
{
  "success": true,
  "message": "Cluster serving disabled (maintenance mode)",
  "status": {
    "mode": "maintenance",
    "enabled": false,
    "changedAt": "2024-01-15T10:33:00.000Z"
  }
}
```

### Get Service Status
Get the current service status of the node.

**Endpoint**: `GET /cluster/service-status`

**Response**:
```json
{
  "success": true,
  "status": {
    "mode": "serving",
    "enabled": true,
    "startTime": "2024-01-15T10:30:00.000Z"
  },
  "nodeStatus": {
    "id": "node-id",
    "status": "active",
    "role": "coordinator",
    "lastSeen": "2024-01-15T10:33:00.000Z"
  }
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

- `503 Service Unavailable` - Cluster service is not enabled
- `404 Not Found` - Node or resource not found
- `400 Bad Request` - Invalid request parameters
- `500 Internal Server Error` - Server-side error

## UI Integration

The Proxy Stone UI automatically discovers cluster backends and provides a management interface:

1. **Auto-Discovery**: Scans ports 4401-4405 for available backends
2. **Proxy Selection**: Table showing all discovered proxies with status
3. **Real-Time Monitoring**: Connection status and health indicators
4. **Proxy-Aware Operations**: Routes all API calls to selected backend

## Examples

### Starting a Cluster

```bash
# Start coordinator
npm run web:coordinator  # Port 4401

# Start workers (in separate terminals)
npm run web:worker1      # Port 4402 (connects to 4401)
npm run web:worker2      # Port 4403 (connects to 4401)

# Start UI
npm run web:ui           # Port 4400 (discovers all backends)
```

### Checking Cluster Status

```bash
# Get all nodes from coordinator
curl http://localhost:4401/api/cluster/nodes

# Check specific node status
curl http://localhost:4402/api/cluster/status

# Check cluster health
curl http://localhost:4401/api/cluster/health
```

### Service Management

```bash
# Put node in maintenance mode
curl -X POST http://localhost:4402/api/cluster/disable-serving

# Re-enable serving
curl -X POST http://localhost:4402/api/cluster/enable-serving

# Check service status
curl http://localhost:4402/api/cluster/service-status
```