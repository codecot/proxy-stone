# Service Discovery for Proxy-Stone

## 🌐 Overview

The Service Discovery feature enables Proxy-Stone to operate as a distributed system with automatic service registration, health monitoring, and cluster management. This allows multiple Proxy-Stone instances to discover each other, share load, and provide high availability.

## 🎯 Key Features

### ✅ **Auto-Discovery**
- Automatic registration of new proxy-backend instances
- Real-time discovery of services joining/leaving the network
- Support for multiple registry backends (etcd, Consul, Redis)

### ✅ **Health Monitoring**
- Continuous health checks with configurable intervals
- Automatic failover when services become unhealthy
- Grace period handling for temporary failures
- Detailed health metrics and status reporting

### ✅ **Cluster Management**
- Leader election for coordinated operations
- Service enable/disable functionality
- Cluster topology visualization
- Regional and zone-aware service distribution

### ✅ **Real-time Updates**
- WebSocket/SSE support for live cluster status
- Event-driven architecture for immediate notifications
- Pub/Sub messaging for distributed events

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Service Discovery Layer                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   etcd/     │  │   Redis     │  │  Control    │        │
│  │  Consul     │  │  Pub/Sub    │  │   Plane     │        │
│  │ (Registry)  │  │ (Events)    │  │ (Manager)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Proxy-Stone Instances                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Proxy-Stone │  │ Proxy-Stone │  │ Proxy-Stone │        │
│  │ Instance A  │  │ Instance B  │  │ Instance C  │        │
│  │ (Leader)    │  │ (Follower)  │  │ (Follower)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. **Enable Service Discovery**

Add to your Proxy-Stone configuration:

```typescript
// apps/backend/src/config.ts
export const serviceDiscoveryConfig = {
  enabled: true,
  cluster: {
    name: 'proxy-stone-cluster',
    leaderElection: {
      enabled: true,
      ttl: 30,
      renewInterval: 10
    },
    healthCheck: {
      interval: 30,
      timeout: 5,
      retries: 3,
      gracePeriod: 60
    },
    discovery: {
      registry: 'etcd',
      endpoints: ['http://localhost:2379'],
      namespace: 'proxy-stone'
    }
  },
  service: {
    name: 'proxy-stone',
    host: 'localhost',
    port: 3000,
    version: '1.0.0',
    tags: ['proxy-stone', 'backend'],
    region: 'us-east-1',
    zone: 'us-east-1a'
  }
};
```

### 2. **Start Infrastructure**

```bash
# Start etcd cluster and supporting services
docker-compose -f docker/service-discovery.yml up -d

# Or start individual components
docker run -d --name etcd \
  -p 2379:2379 \
  quay.io/coreos/etcd:v3.5.10 \
  /usr/local/bin/etcd \
  --listen-client-urls http://0.0.0.0:2379 \
  --advertise-client-urls http://localhost:2379
```

### 3. **Launch Multiple Instances**

```bash
# Instance 1
PORT=3001 SERVICE_HOST=localhost SERVICE_PORT=3001 npm run start

# Instance 2  
PORT=3002 SERVICE_HOST=localhost SERVICE_PORT=3002 npm run start

# Instance 3
PORT=3003 SERVICE_HOST=localhost SERVICE_PORT=3003 npm run start
```

## 📡 API Endpoints

### Service Discovery Status
```http
GET /service-discovery/status
```

**Response:**
```json
{
  "enabled": true,
  "currentService": {
    "id": "uuid-here",
    "name": "proxy-stone",
    "host": "localhost",
    "port": 3001,
    "status": "healthy",
    "role": "leader"
  },
  "isLeader": true,
  "status": "registered"
}
```

### List All Services
```http
GET /service-discovery/services
```

**Response:**
```json
{
  "services": [
    {
      "id": "uuid-1",
      "name": "proxy-stone",
      "host": "localhost",
      "port": 3001,
      "status": "healthy",
      "role": "leader",
      "health": {
        "status": "healthy",
        "responseTime": 45,
        "lastCheck": 1640995200000
      },
      "isHealthy": true
    }
  ],
  "total": 3,
  "healthy": 2,
  "unhealthy": 1
}
```

### Cluster Topology
```http
GET /service-discovery/topology
```

**Response:**
```json
{
  "totalServices": 3,
  "healthyServices": 2,
  "unhealthyServices": 1,
  "servicesByRegion": {
    "us-east-1": 2,
    "us-west-2": 1
  },
  "servicesByStatus": {
    "healthy": 2,
    "unhealthy": 1,
    "starting": 0,
    "draining": 0,
    "stopped": 0
  },
  "leader": {
    "id": "uuid-1",
    "name": "proxy-stone",
    "role": "leader"
  }
}
```

### Enable/Disable Services
```http
POST /service-discovery/services/{serviceId}/enable
POST /service-discovery/services/{serviceId}/disable
```

### Real-time Events
```http
GET /service-discovery/events
```

**Server-Sent Events Stream:**
```
data: {"type":"serviceJoined","service":{...},"timestamp":1640995200000}

data: {"type":"serviceHealthChanged","serviceId":"uuid-1","timestamp":1640995200000}

data: {"type":"leaderElected","leaderId":"uuid-2","timestamp":1640995200000}
```

## 🔧 Configuration Options

### Registry Backends

#### **etcd (Recommended)**
```typescript
{
  registry: 'etcd',
  endpoints: [
    'http://etcd1:2379',
    'http://etcd2:2379', 
    'http://etcd3:2379'
  ],
  namespace: 'proxy-stone'
}
```

#### **Consul** (Coming Soon)
```typescript
{
  registry: 'consul',
  endpoints: ['http://consul:8500'],
  namespace: 'proxy-stone'
}
```

#### **Redis** (Coming Soon)
```typescript
{
  registry: 'redis',
  endpoints: ['redis://redis:6379'],
  namespace: 'proxy-stone'
}
```

### Health Check Configuration
```typescript
{
  interval: 30,        // Check every 30 seconds
  timeout: 5,          // 5 second timeout
  retries: 3,          // Retry 3 times before marking unhealthy
  gracePeriod: 60      // 60 second grace period before marking as failed
}
```

### Leader Election
```typescript
{
  enabled: true,
  ttl: 30,            // Leader lease TTL in seconds
  renewInterval: 10   // Renew lease every 10 seconds
}
```

## 🎛️ Management Operations

### Programmatic Usage

```typescript
import { ProxyStoneServiceDiscovery } from './services/service-discovery-integration';

const serviceDiscovery = new ProxyStoneServiceDiscovery(config, logger);

// Start service discovery
await serviceDiscovery.start();

// Get available services
const services = await serviceDiscovery.getAvailableServices();

// Get only healthy services
const healthyServices = await serviceDiscovery.getHealthyServices();

// Enable/disable a service
await serviceDiscovery.setServiceEnabled('service-id', false);

// Get cluster topology
const topology = await serviceDiscovery.getClusterTopology();

// Listen for events
serviceDiscovery.on('serviceJoined', (service) => {
  console.log('New service joined:', service.name);
});

serviceDiscovery.on('serviceLeft', (serviceId) => {
  console.log('Service left:', serviceId);
});

serviceDiscovery.on('leaderElected', (leaderId) => {
  console.log('New leader elected:', leaderId);
});
```

### CLI Commands

```bash
# Check cluster status
curl http://localhost:3001/service-discovery/status

# List all services
curl http://localhost:3001/service-discovery/services

# Get cluster topology
curl http://localhost:3001/service-discovery/topology

# Disable a service
curl -X POST http://localhost:3001/service-discovery/services/{id}/disable

# Enable a service
curl -X POST http://localhost:3001/service-discovery/services/{id}/enable
```

## 🐳 Docker Deployment

### Complete Cluster Setup
```bash
# Start the complete service discovery cluster
docker-compose -f docker/service-discovery.yml up -d

# Scale proxy-stone instances
docker-compose -f docker/service-discovery.yml up -d --scale proxy-stone-1=3

# View logs
docker-compose -f docker/service-discovery.yml logs -f proxy-stone-1
```

### Environment Variables
```bash
# Service Discovery
SERVICE_DISCOVERY_ENABLED=true
SERVICE_DISCOVERY_REGISTRY=etcd
SERVICE_DISCOVERY_ENDPOINTS=http://etcd1:2379,http://etcd2:2379,http://etcd3:2379
SERVICE_DISCOVERY_NAMESPACE=proxy-stone

# Service Configuration
SERVICE_NAME=proxy-stone
SERVICE_HOST=proxy-stone-1
SERVICE_PORT=3001
SERVICE_VERSION=1.0.0
SERVICE_REGION=us-east-1
SERVICE_ZONE=us-east-1a
```

## 📊 Monitoring & Observability

### Metrics Exposed
- Service registration/deregistration events
- Health check success/failure rates
- Leader election events
- Cluster topology changes
- Response times for health checks

### Grafana Dashboards
- Cluster overview with service status
- Health check metrics and trends
- Leader election history
- Regional service distribution
- Real-time service topology

### Prometheus Metrics
```
# Service discovery metrics
proxy_stone_services_total{status="healthy|unhealthy"}
proxy_stone_health_check_duration_seconds
proxy_stone_leader_elections_total
proxy_stone_service_registrations_total
proxy_stone_cluster_size
```

## 🔒 Security Considerations

### Authentication & Authorization
- mTLS for service-to-service communication
- API key authentication for management endpoints
- Role-based access control for service operations

### Network Security
- Private networks for service discovery traffic
- Firewall rules for etcd/Consul access
- Encrypted communication between services

### Data Protection
- Secure storage of service metadata
- Encryption of sensitive configuration data
- Audit logging for all service operations

## 🚨 Troubleshooting

### Common Issues

#### **Services Not Discovering Each Other**
```bash
# Check etcd connectivity
etcdctl --endpoints=http://localhost:2379 endpoint health

# Verify service registration
etcdctl --endpoints=http://localhost:2379 get --prefix proxy-stone/services/

# Check network connectivity
docker network ls
docker network inspect proxy-stone-discovery
```

#### **Health Checks Failing**
```bash
# Test health endpoint directly
curl http://localhost:3001/health

# Check health check configuration
curl http://localhost:3001/service-discovery/services/{id}/health

# Review health monitor logs
docker logs proxy-stone-instance-1 | grep HealthMonitor
```

#### **Leader Election Issues**
```bash
# Check current leader
curl http://localhost:3001/service-discovery/topology

# Review leader election logs
docker logs proxy-stone-instance-1 | grep "leader"

# Verify etcd cluster health
etcdctl --endpoints=http://localhost:2379 endpoint status --cluster
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=proxy-stone:service-discovery npm run start

# Or via environment
LOG_LEVEL=debug npm run start
```

## 🔮 Future Enhancements

### Short Term
- [ ] Consul registry implementation
- [ ] Redis registry implementation  
- [ ] Advanced load balancing strategies
- [ ] Service mesh integration

### Medium Term
- [ ] Multi-region service discovery
- [ ] Advanced health check types (TCP, gRPC)
- [ ] Service dependency management
- [ ] Automatic scaling based on load

### Long Term
- [ ] Machine learning for predictive scaling
- [ ] Advanced analytics and insights
- [ ] Integration with Kubernetes service discovery
- [ ] Cross-cloud service discovery

## 📚 References

- [etcd Documentation](https://etcd.io/docs/)
- [Consul Service Discovery](https://www.consul.io/docs/discovery)
- [Microservices Patterns](https://microservices.io/patterns/service-registry.html)
- [Distributed Systems Concepts](https://en.wikipedia.org/wiki/Distributed_computing) 