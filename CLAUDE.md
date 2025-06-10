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
- **Default Port**: Configurable via `--port` parameter
- **Host**: Configurable via `--host` parameter (default: 0.0.0.0)
- **Dev Command**: `npm run dev -- --port 3000 --db-type postgresql --db-host localhost --db-port 5434 --db-name proxy_stone --db-user proxy_user --db-password proxy_pass`

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
cd apps/backend && npm run dev -- --port 3000 --db-type postgresql --db-host localhost --db-port 5434 --db-name proxy_stone --db-user proxy_user --db-password proxy_pass

# Check Docker services
cd docker && docker-compose ps
```