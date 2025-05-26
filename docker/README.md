# Docker Development Environments for Proxy Stone

This directory contains flexible Docker Compose configurations for different development scenarios and database backends.

## 🏗️ Architecture Overview

The Docker setup is organized with:

- **Base configuration** (`docker-compose.yml`) - Infrastructure services (Redis, databases, UIs)
- **Development scenarios** - Override files for different development workflows
- **Database overrides** - Modular database configurations
- **Environment files** - Configuration templates for local development

## 🚀 Quick Start

### Interactive Launcher (Recommended)

```bash
# From project root
npm run docker:launcher

# Or directly
cd docker && ./scripts/launcher.sh
```

### Direct Commands

```bash
# Backend development (backend runs locally)
npm run docker:dev-backend

# UI development (UI runs locally)
npm run docker:dev-ui

# Full containerized (everything in Docker)
npm run docker:dev-full

# Legacy shortcuts (full containerized)
npm run docker:sqlite
npm run docker:mysql
npm run docker:postgresql
```

## 🛠️ Development Scenarios

### 1. Backend Development

**Use case**: Developing the Fastify backend with hot reload

```bash
./scripts/dev-backend.sh [--sqlite|--mysql|--postgres]
```

**What runs where**:

- ✅ **Backend**: Runs locally (`npm run dev`)
- 🐳 **UI**: Runs in Docker (production build)
- 🐳 **Infrastructure**: Redis, database, admin UIs in Docker

**Setup**:

1. Copy environment: `cp docker/env.backend-dev apps/backend/.env`
2. Update database config if needed
3. Start backend: `cd apps/backend && npm run dev`

### 2. UI Development

**Use case**: Developing the React UI with hot reload

```bash
./scripts/dev-ui.sh [--sqlite|--mysql|--postgres]
```

**What runs where**:

- 🐳 **Backend**: Runs in Docker
- ✅ **UI**: Runs locally (`npm run dev`)
- 🐳 **Infrastructure**: Redis, database, admin UIs in Docker

**Setup**:

1. Copy environment: `cp docker/env.ui-dev apps/ui/.env`
2. Start UI: `cd apps/ui && npm run dev`

### 3. Full Containerized

**Use case**: Testing, production-like environment, or when you don't want to run anything locally

```bash
./scripts/dev-full.sh [--sqlite|--mysql|--postgres]
```

**What runs where**:

- 🐳 **Backend**: Runs in Docker
- 🐳 **UI**: Runs in Docker
- 🐳 **Infrastructure**: Redis, database, admin UIs in Docker

### 4. Infrastructure Only

**Use case**: Running both backend and UI locally for full development control

```bash
# Via launcher option 4, or manually:
docker compose up -d redis redis-commander
# Add --profile mysql or --profile postgres for databases
```

**Setup**:

1. Copy environments:
   ```bash
   cp docker/env.backend-dev apps/backend/.env
   cp docker/env.ui-dev apps/ui/.env
   ```
2. Start services:
   ```bash
   cd apps/backend && npm run dev
   cd apps/ui && npm run dev
   ```

## 🗄️ Database Options

### SQLite (Default)

- **Best for**: Development, testing, simple deployments
- **No container needed**: File-based database
- **Data location**: `./logs/snapshots.db`

### MySQL

- **Best for**: Production, MySQL compatibility
- **Container**: MySQL 8.0
- **Admin UI**: Adminer at http://localhost:8080
- **Connection**: `localhost:3306`
- **Credentials**: `proxy_user` / `proxy_pass`

### PostgreSQL

- **Best for**: Production, advanced features
- **Container**: PostgreSQL 16
- **Admin UI**: pgAdmin at http://localhost:5050
- **Connection**: `localhost:5432`
- **Credentials**: `proxy_user` / `proxy_pass`

## 📊 Service Ports

| Service         | Port | Description                   |
| --------------- | ---- | ----------------------------- |
| UI              | 3000 | React admin panel             |
| Backend API     | 4000 | Fastify proxy service         |
| Redis           | 6379 | Cache store                   |
| Redis Commander | 8081 | Redis web UI                  |
| MySQL           | 3306 | Database (MySQL profile)      |
| Adminer         | 8080 | Database web UI (MySQL)       |
| PostgreSQL      | 5432 | Database (PostgreSQL profile) |
| pgAdmin         | 5050 | Database web UI (PostgreSQL)  |

## 🔧 Configuration Files

### Docker Compose Files

- `docker-compose.yml` - Base infrastructure services
- `docker-compose.backend-dev.yml` - Backend development override
- `docker-compose.ui-dev.yml` - UI development override
- `docker-compose.full.yml` - Full containerized override
- `docker-compose.mysql.override.yml` - MySQL database configuration
- `docker-compose.postgres.override.yml` - PostgreSQL database configuration

### Environment Templates

- `env.backend-dev` - Template for backend local development
- `env.ui-dev` - Template for UI local development

### Database Initialization

- `init/mysql/01-init.sql` - MySQL schema and initial data
- `init/postgres/01-init.sql` - PostgreSQL schema and initial data

## 🛠️ Manual Usage

### Combining Configurations

You can manually combine configurations:

```bash
# UI development with PostgreSQL
docker compose \
  -f docker-compose.yml \
  -f docker-compose.ui-dev.yml \
  -f docker-compose.postgres.override.yml \
  --profile postgres \
  up -d

# Backend development with MySQL
docker compose \
  -f docker-compose.yml \
  -f docker-compose.backend-dev.yml \
  -f docker-compose.mysql.override.yml \
  --profile mysql \
  up -d
```

### Environment Variables

For local development, copy and modify environment files:

```bash
# Backend development
cp docker/env.backend-dev apps/backend/.env
# Edit apps/backend/.env as needed

# UI development
cp docker/env.ui-dev apps/ui/.env
# Edit apps/ui/.env as needed
```

## 🔍 Monitoring and Debugging

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f redis
```

### Check Status

```bash
npm run docker:status
# or
docker compose ps
```

### Health Checks

- **Backend**: http://localhost:4000/health
- **UI**: http://localhost:3000
- **Redis**: Automatic health checks
- **Databases**: Automatic health checks

## 🧹 Cleanup

```bash
# Stop all services
npm run docker:stop

# Stop and remove volumes (⚠️ DATA LOSS)
npm run docker:clean

# Manual cleanup
docker compose down -v
```

## 🔄 Migration from Old Setup

The new setup replaces the old database-specific compose files:

| Old Command                 | New Command                          |
| --------------------------- | ------------------------------------ |
| `npm run docker:sqlite`     | `npm run docker:dev-full --sqlite`   |
| `npm run docker:mysql`      | `npm run docker:dev-full --mysql`    |
| `npm run docker:postgresql` | `npm run docker:dev-full --postgres` |

The old commands still work as aliases to the full containerized setup.

## 🤝 Contributing

When adding new services or configurations:

1. Update the base `docker-compose.yml` for infrastructure
2. Create override files for specific scenarios
3. Update scripts in `scripts/` directory
4. Document changes in this README
