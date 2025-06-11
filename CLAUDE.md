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
- **Host**: Configurable via `--host` parameter (default: 0.0.0.0)
- **Dev Command**: `npm run dev -- --port 4401 --db-type postgresql --db-host localhost --db-port 5434 --db-name proxy_stone --db-user proxy_user --db-password proxy_pass`

## API Endpoint Routing
- **Direct Endpoints** (no proxy): 
  - `/health`, `/health/live`, `/health/ready` - Health checks
  - `/api/metrics` - Prometheus metrics
  - `/api/cache` - Cache management
  - `/api/auth` - Authentication
  - `/api/requests` - Request analytics
  - `/api/cluster` - Cluster management
- **Proxy Endpoints**: `/proxy/*` → forwards to target URL (default: https://httpbin.org)
- **API Prefix**: Configurable via `--api-prefix` (default: `/proxy`)

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
```bash
# Start PostgreSQL services
cd docker && docker-compose --profile postgres up -d postgres pgadmin

# Start backend with PostgreSQL
cd apps/backend && npm run dev:postgres  # Uses port 4401
# Or manually:
cd apps/backend && npm run dev -- --port 4401 --db-type postgresql --db-host localhost --db-port 5434 --db-name proxy_stone --db-user proxy_user --db-password proxy_pass

# Start UI
cd apps/ui && npm run dev  # Uses port 4400

# Check Docker services
cd docker && docker-compose ps
```

## UI Management Features
- **Dashboard & Overview**: Real-time system health, metrics, activity feed
- **Proxy Configuration**: Target URL management, endpoint mapping, load balancing
- **Cache Management**: Cache rules editor, statistics, invalidation, Redis integration
- **Authentication & Security**: API key management, user management, JWT configuration
- **Monitoring & Analytics**: Request analytics, performance metrics, log viewer
- **Database Management**: Connection settings, query interface, schema browser
- **Cluster Management**: Node discovery, load distribution, failover configuration
- **API Documentation Hub**: Interactive API explorer, OpenAPI viewer
- **Configuration Management**: Environment variables, feature flags, import/export
- **Development Tools**: Request debugger, performance profiler, mock server

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
- **Framework**: React + Vite
- **Default Port**: 4400
- **Backend API**: Connects to http://localhost:4401

## UI Feature List
- To be determined

## Memory Notes
- `save to memory` - Placeholder memory entry without specific details