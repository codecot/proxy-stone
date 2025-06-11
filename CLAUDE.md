# Proxy Stone Project Memory

## Database Configuration
- **Primary Database**: PostgreSQL
- **Docker Service**: `proxy-postgres` (postgres:16-alpine)
- **Connection**: localhost:5434
- **Database**: proxy_stone
- **User**: proxy_user  
- **Password**: proxy_pass
- **Management UI**: pgAdmin at http://localhost:5051 (admin@proxy-stone.dev / admin123)

## Backend Server
- **Framework**: Fastify with TypeScript
- **Default Port**: 4401 (configurable via `--port` parameter)
- **Host**: Configurable via `--host` parameter (default: 127.0.0.1)
- **Cluster Mode**: Coordinator (no --cluster-ip) or Worker (with --cluster-ip)
- **Dev Command**: `npm run dev -- --port 4401 --db-type postgresql --db-host localhost --db-port 5434 --db-name proxy_stone --db-user proxy_user --db-password proxy_pass`

## Cluster Architecture
- **Coordinator**: First backend instance (no --cluster-ip parameter)
- **Workers**: Additional backend instances (with --cluster-ip parameter)
- **Registration**: Workers auto-register with coordinator at startup
- **Heartbeat**: 30-second interval for health monitoring
- **Node Discovery**: Automatic discovery and failover
- **Load Balancing**: Distributed across available nodes

## API Endpoint Routing
- **Direct Endpoints** (no proxy): 
  - `/health`, `/health/live`, `/health/ready` - Health checks
  - `/api/metrics` - Prometheus metrics
  - `/api/cache` - Cache management
  - `/api/auth` - Authentication
  - `/api/requests` - Request analytics
  - `/api/cluster` - Cluster management and node registration
- **Proxy Endpoints**: `/proxy/*` → forwards to target URL (default: https://httpbin.org)
- **API Prefix**: Configurable via `--api-prefix` (default: `/proxy`)

## Cluster API Endpoints
- **POST** `/api/cluster/register` - Node self-registration
- **POST** `/api/cluster/heartbeat/{nodeId}` - Heartbeat updates
- **GET** `/api/cluster/nodes` - List all cluster nodes
- **GET** `/api/cluster/status` - Current node status
- **GET** `/api/cluster/health` - Cluster health overview
- **POST** `/api/cluster/enable-serving` - Enable proxy serving
- **POST** `/api/cluster/disable-serving` - Disable proxy serving (maintenance mode)
- **GET** `/api/cluster/service-status` - Service status information

## Docker Services
- **PostgreSQL**: Port 5434, profile `postgres`
- **pgAdmin**: Port 5051, profile `postgres`  
- **Redis**: Port 6379
- **Redis Commander**: Port 8081

## Key File Locations
- **Server Config**: `apps/backend/src/config/index.ts`
- **Main Server**: `apps/backend/src/server.ts`
- **Docker Compose**: `docker/docker-compose.yml`
- **PostgreSQL Override**: `docker/docker-compose.postgres.override.yml`

## Common Commands

### **Quick Start (One Command)**
```bash
# Install dependencies first (if not done)
npm install

# Start PostgreSQL services
cd docker && docker-compose --profile postgres up -d postgres pgadmin

# Option 1: Single backend + UI
npm run web  # Starts coordinator (4401) + UI (4400)

# Option 2: Full cluster (3 backends + UI)
npm run web:cluster  # Starts coordinator + 2 workers + UI
```

### **Manual Setup (Multiple Terminals)**
```bash
# Start PostgreSQL services
cd docker && docker-compose --profile postgres up -d postgres pgadmin

# Start cluster coordinator (first backend)
cd apps/backend && npm run dev:postgres  # Uses port 4401, becomes coordinator

# Start worker nodes (additional backends)
cd apps/backend && ./start-backend.sh --port 4402 --cluster-ip localhost:4401
cd apps/backend && ./start-backend.sh --port 4403 --cluster-ip localhost:4401

# Start UI (automatically discovers and connects to coordinator)
cd apps/ui && npm run dev  # Uses port 4400, auto-discovers backends

# Manual backend startup
cd apps/backend && npm run dev -- --port 4401 --db-type postgresql --db-host localhost --db-port 5434 --db-name proxy_stone --db-user proxy_user --db-password proxy_pass

# Check Docker services
cd docker && docker-compose ps
```

### **Available Web Commands**
```bash
npm run web            # Backend (4401) + UI (4400)
npm run web:cluster    # Full cluster: Coordinator + 2 Workers + UI
npm run web:backend    # Just the backend (coordinator)
npm run web:ui         # Just the UI
```

## UI Management Features
- **Multi-Proxy Management**: Table-based proxy selector, connection status, role identification
- **Smart Backend Discovery**: Automatic discovery of coordinator and worker nodes
- **Proxy-Aware Interface**: All operations route to selected proxy backend
- **Dashboard & Overview**: Real-time system health, metrics, activity feed per proxy
- **Proxy Configuration**: Target URL management, endpoint mapping, load balancing
- **Cache Management**: Cache rules editor, statistics, invalidation, Redis integration
- **Authentication & Security**: API key management, user management, JWT configuration
- **Monitoring & Analytics**: Request analytics, performance metrics, log viewer
- **Database Management**: Connection settings, query interface, schema browser
- **Cluster Management**: Node discovery, load distribution, failover configuration
- **API Documentation Hub**: Interactive API explorer, OpenAPI viewer
- **Configuration Management**: Environment variables, feature flags, import/export
- **Development Tools**: Request debugger, performance profiler, mock server
- **Node Control**: Enable/disable serving, maintenance mode, health monitoring

## Development Principles
- Always use descriptive names

## Commit Message Guidelines
- Start with a verb in imperative mood (e.g., "Add", "Update", "Fix", "Refactor")
- Use concise, clear language
- Provide context for the change
- Separate subject from body with a blank line
- Use the body to explain "why" and additional details
- Example: 
  ```
  Add user authentication middleware

  - Implement JWT-based authentication
  - Protect sensitive routes
  - Enhance security for API endpoints
  ```

## UI Server
- **Framework**: React + Vite + Material-UI
- **Default Port**: 4400
- **Smart Discovery**: Auto-discovers backends at ports 4401-4405
- **Backend Selection**: Table interface for proxy selection
- **Connection Management**: Real-time status monitoring and failover
- **Proxy-Aware API**: Routes all calls to selected proxy backend
- **Context Management**: React Context for proxy state management

## UI Components
- **ProxySelector**: Table-based proxy selection with status indicators
- **ProxyContext**: React context for managing selected proxy state
- **Smart Discovery**: Automatic backend detection and health monitoring
- **Proxy-Aware Pages**: Dashboard, Cache Management, Monitoring, Configuration
- **Connection Status**: Real-time connection monitoring with error handling
- **Role Indicators**: Visual distinction between coordinator and worker nodes
- **Multi-Proxy Dashboard**: Shows cluster overview and individual proxy details

## Technical Implementation
- **Cluster Service**: Enhanced service with coordinator/worker architecture
- **Node Registration**: Automatic registration with heartbeat mechanism
- **Service Discovery**: Smart UI discovery with coordinator preference
- **API Routing**: Proxy-aware API service for backend communication
- **State Management**: React Context API for proxy selection
- **Error Handling**: Connection monitoring and automatic failover
- **Dependencies**: axios for HTTP requests, Material-UI for components

## Startup Sequence
1. Start PostgreSQL services (docker-compose)
2. Start coordinator backend (first instance, no --cluster-ip)
3. Start worker backends (additional instances with --cluster-ip)
4. Start UI (auto-discovers and connects to coordinator)
5. Select proxy in UI table to manage specific backend

## Memory Notes
- Multi-proxy cluster architecture implemented with coordinator/worker pattern
- Smart UI discovery with table-based proxy management
- Proxy-aware API routing for backend communication
- Real-time health monitoring and automatic failover