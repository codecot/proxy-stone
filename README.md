# Proxy Stone 🪨

A high-performance **Backend for Frontend (BFF)** proxy server built with **Fastify** and **TypeScript**. Designed as an API middleware layer that sits between your frontend applications and backend services, providing intelligent request forwarding, caching, logging, and **multi-database support**.

## ✨ Key Features

- 🚀 **High-Performance Proxy**: Built on Fastify for maximum throughput
- ⚡ **Hybrid Caching**: In-memory + file-based persistence with configurable TTL
- 🗄️ **Multi-Database Support**: Choose between SQLite, PostgreSQL, or MySQL
- 🛡️ **Graceful Degradation**: Continues working even when database is unavailable
- 📊 **Request Analytics**: Comprehensive logging and management interface
- 🐳 **Docker Ready**: Pre-configured containers for PostgreSQL and MySQL
- 🔧 **Flexible Configuration**: CLI arguments, environment variables, or config files
- 🎯 **Production Ready**: TypeScript, comprehensive error handling, monitoring

## 🚀 Quick Start

### Basic Setup (SQLite)

```bash
# Clone and install
git clone <repository-url>
cd proxy-stone
npm install

# Start with default SQLite database
npm run dev

# Test the proxy
curl http://localhost:3000/api/get
```

### PostgreSQL Setup

```bash
# Start PostgreSQL with Docker
npm run docker:pg

# Run with PostgreSQL
npm run dev -- \
  --db-type postgresql \
  --db-host localhost \
  --db-port 5432 \
  --db-name proxydb \
  --db-user devuser \
  --db-password devpass
```

### MySQL Setup

```bash
# Start MySQL with Docker
npm run docker:mysql

# Run with MySQL
npm run dev -- \
  --db-type mysql \
  --db-host localhost \
  --db-port 3306 \
  --db-name proxydb \
  --db-user devuser \
  --db-password devpass
```

## 🗄️ Database Support

| Database       | Use Case                | Setup      | Performance | Scalability |
| -------------- | ----------------------- | ---------- | ----------- | ----------- |
| **SQLite**     | Development, Small Apps | ⭐ Minimal | ⭐⭐⭐      | ⭐          |
| **PostgreSQL** | Production, Enterprise  | ⭐⭐⭐     | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐  |
| **MySQL**      | Web Applications, Cloud | ⭐⭐       | ⭐⭐⭐⭐    | ⭐⭐⭐⭐    |

### Graceful Degradation

If the database is unavailable, Proxy Stone automatically:

- ✅ Continues serving proxy requests
- ✅ Maintains in-memory and file caching
- ⚠️ Disables snapshot management with helpful error messages
- 🔧 Provides clear recovery instructions

## 📊 Quick Health Check

```bash
# Server status
curl http://localhost:3000/health

# Cache statistics
curl http://localhost:3000/cache/stats

# Request analytics
curl http://localhost:3000/requests/stats

# Database status
curl http://localhost:3000/debug/config | jq .database
```

## 🎯 Use Cases

- **Frontend Development**: Avoid CORS issues, cache API responses
- **Microservices Gateway**: Centralized entry point with caching
- **API Optimization**: Cache expensive operations, reduce backend load
- **Development Proxy**: Switch between dev/staging/prod environments
- **Request Analytics**: Monitor API usage patterns and performance

## 📁 Documentation

**📖 [Complete Documentation](docs/README.md)** - Full feature guide and examples

### Quick Links

- **[Quick Start Guide](docs/quick-start.md)** - Get running in 5 minutes
- **[Multi-Database Guide](docs/multi-database.md)** - PostgreSQL, MySQL, SQLite setup
- **[Configuration Guide](docs/configuration.md)** - All CLI and environment options
- **[API Reference](docs/api-reference.md)** - Complete endpoint documentation
- **[Deployment Guide](docs/deployment.md)** - Production deployment strategies

## 🔧 Configuration Examples

### Development with Full Features

```bash
npm run dev -- \
  --enable-file-cache \
  --db-type postgresql \
  --cache-ttl 300 \
  --target-url https://api.example.com
```

### Production Environment

```bash
export NODE_ENV=production
export DB_TYPE=postgresql
export DB_HOST=postgres-cluster.com
export DB_NAME=proxy_production
export CACHE_TTL=600
npm start
```

### Docker Compose

```yaml
services:
  proxy-stone:
    build: .
    environment:
      - DB_TYPE=postgresql
      - DB_HOST=postgres
      - ENABLE_FILE_CACHE=true
    depends_on:
      - postgres
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test database configurations
node test-failure-scenarios.js

# Test specific database
npm run docker:pg
npm run dev -- --db-type postgresql --port 4001
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

See [Development Guide](docs/development.md) for detailed instructions.

## 📄 License

MIT License - see LICENSE file for details.

---

**Ready to get started?** Check out the **[Complete Documentation](docs/README.md)** or jump to the **[Quick Start Guide](docs/quick-start.md)**!
