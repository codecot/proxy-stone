# Proxy Stone

A high-performance HTTP proxy with caching, monitoring, and admin UI built as a modern monorepo.

## 🏗️ Architecture

This project is organized as a monorepo with the following structure:

```
proxy-stone/
├── apps/
│   ├── backend/                # Fastify proxy service
│   ├── ui/                     # React admin panel
│   ├── control-plane/          # (future) Control plane microservice
│   └── monitoring/             # (future) Monitoring service
│
├── packages/
│   ├── shared/                 # Shared types, utils, config
│   ├── events/                 # Event contracts, schema validators
│   ├── logger/                 # Common logger (Pino wrapper)
│   └── db/                     # Database adapters
│
├── docker/                     # Docker compose profiles, scripts
├── .github/                    # GitHub workflows for CI/CD
├── .vscode/                    # Workspace settings
├── package.json                # Root workspace config
├── turbo.json                  # Turborepo configuration
└── tsconfig.base.json          # Shared TypeScript config
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose (for containerized deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/proxy-stone.git
cd proxy-stone

# Install dependencies for all packages
npm install

# Build all packages
npm run build
```

### Development

```bash
# Start all services in development mode
npm run dev

# Start specific services
cd apps/backend && npm run dev
cd apps/ui && npm run dev
```

### Docker Deployment

The project supports multiple database configurations:

```bash
# SQLite + Redis (lightweight)
npm run docker:sqlite

# MySQL + Redis + Adminer
npm run docker:mysql

# PostgreSQL + Redis + pgAdmin
npm run docker:postgresql

# Interactive launcher
npm run docker:launcher

# Stop all services
npm run docker:stop

# Clean up (including volumes)
npm run docker:clean
```

## 📦 Packages

### Apps

- **`@proxy-stone/backend`** - Main proxy server built with Fastify
- **`@proxy-stone/ui`** - React admin panel with Material-UI

### Shared Packages

- **`@proxy-stone/shared`** - Common types, utilities, and configuration
- **`@proxy-stone/events`** - Event contracts and schema validation
- **`@proxy-stone/logger`** - Centralized logging with Pino
- **`@proxy-stone/db`** - Database adapters for SQLite, MySQL, PostgreSQL

## 🛠️ Development

### Scripts

```bash
# Development
npm run dev              # Start all services in dev mode
npm run build            # Build all packages
npm run test             # Run tests across all packages
npm run lint             # Lint all packages
npm run type-check       # TypeScript type checking
npm run clean            # Clean build artifacts

# Docker operations
npm run docker:sqlite    # Start with SQLite
npm run docker:mysql     # Start with MySQL
npm run docker:postgresql # Start with PostgreSQL
npm run docker:stop      # Stop all containers
npm run docker:status    # Check container status
npm run docker:launcher  # Interactive menu
```

### Adding New Packages

1. Create a new directory under `packages/` or `apps/`
2. Add a `package.json` with the `@proxy-stone/` namespace
3. Create a `tsconfig.json` extending the base config
4. Add the package to the workspace paths in the root `package.json`

### Workspace Dependencies

Use workspace references for internal packages:

```json
{
  "dependencies": {
    "@proxy-stone/shared": "workspace:*",
    "@proxy-stone/logger": "workspace:*"
  }
}
```

## 🐳 Docker

### Services

| Service         | Port | Description                  |
| --------------- | ---- | ---------------------------- |
| Proxy Backend   | 4000 | Main proxy service           |
| UI              | 3000 | React admin panel            |
| Redis           | 6379 | Cache store                  |
| Redis Commander | 8081 | Redis web UI                 |
| MySQL           | 3306 | Database (MySQL config)      |
| Adminer         | 8080 | Database web UI (MySQL)      |
| PostgreSQL      | 5432 | Database (PostgreSQL config) |
| pgAdmin         | 5050 | Database web UI (PostgreSQL) |

### Configuration Files

- `docker/docker-compose.sqlite.yml` - SQLite + Redis
- `docker/docker-compose.mysql.yml` - MySQL + Redis + Adminer
- `docker/docker-compose.postgresql.yml` - PostgreSQL + Redis + pgAdmin

For detailed Docker configuration documentation, see [`docker/README.md`](docker/README.md).

### Scripts

Cross-platform scripts are available in `docker/scripts/`:

- **Linux/macOS**: `.sh` scripts
- **Windows**: `.bat` and `.ps1` scripts

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=4000
HOST=0.0.0.0

# Database
DB_TYPE=sqlite|mysql|postgresql
DB_HOST=localhost
DB_PORT=3306|5432
DB_NAME=proxy_stone
DB_USER=username
DB_PASS=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# Proxy
PROXY_TARGET=https://httpbin.org
PROXY_TIMEOUT=30000
PROXY_RETRIES=3

# Cache
CACHE_ENABLED=true
CACHE_TTL=300
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
cd packages/shared && npm run test
cd apps/backend && npm run test
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Run linting: `npm run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- 📧 Email: support@proxy-stone.dev
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/proxy-stone/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/proxy-stone/discussions)
