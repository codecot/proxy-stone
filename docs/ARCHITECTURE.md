# Proxy Stone Architecture

This document describes the architecture and design decisions of the Proxy Stone project.

## Overview

Proxy Stone is a high-performance HTTP proxy with caching, monitoring, and admin UI built as a modern monorepo. The architecture follows microservices principles with shared packages for common functionality.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Requests                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Load Balancer                            │
│                  (nginx/traefik)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Proxy Stone UI                             │
│                 (React + Vite)                             │
│                   Port: 3000                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ API Calls
┌─────────────────────▼───────────────────────────────────────┐
│               Proxy Stone Backend                          │
│                (Fastify + TypeScript)                      │
│                   Port: 4000                               │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Proxy     │  │   Cache     │  │  Monitoring │        │
│  │  Service    │  │  Service    │  │   Service   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Data Layer                                  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Database  │  │    Redis    │  │ File Cache  │        │
│  │ (SQLite/    │  │   Cache     │  │   System    │        │
│  │ MySQL/      │  │             │  │             │        │
│  │ PostgreSQL) │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

### Apps (`/apps`)

#### Backend (`/apps/backend`)

- **Technology**: Fastify + TypeScript
- **Purpose**: Main proxy service with caching and monitoring
- **Features**:
  - HTTP proxy with configurable targets
  - Multi-layer caching (Redis + File)
  - Request/response logging
  - Health monitoring
  - Metrics collection
  - Rate limiting
  - Error handling

#### UI (`/apps/ui`)

- **Technology**: React + Vite + Material-UI
- **Purpose**: Admin panel for proxy management
- **Features**:
  - Real-time monitoring dashboard
  - Cache management
  - Request analytics
  - Configuration management
  - Performance metrics

#### Future Apps

- **Control Plane**: Service discovery and configuration management
- **Monitoring**: Dedicated monitoring and alerting service

### Packages (`/packages`)

#### Shared (`/packages/shared`)

- **Purpose**: Common types, utilities, and configuration
- **Exports**:
  - TypeScript interfaces
  - Utility functions
  - Configuration schemas
  - Validation logic

#### Events (`/packages/events`)

- **Purpose**: Event contracts and schema validation
- **Features**:
  - Zod-based schema validation
  - Event factory functions
  - Type-safe event handling

#### Logger (`/packages/logger`)

- **Purpose**: Centralized logging
- **Features**:
  - Pino-based logging
  - Configurable output formats
  - Child logger support
  - Performance optimized

#### DB (`/packages/db`)

- **Purpose**: Database adapters and schema management
- **Features**:
  - Multi-database support (SQLite, MySQL, PostgreSQL)
  - Connection pooling
  - Schema migrations
  - Query abstraction

## Data Flow

### Request Processing

```
1. Client Request → Frontend UI (React)
2. UI → Backend API (Fastify)
3. Backend → Cache Check (Redis/File)
4. If Cache Miss → Target Server
5. Response → Cache Store
6. Response → Client
7. Metrics → Database
8. Events → Event System
```

### Cache Strategy

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Request   │───▶│    Redis    │───▶│ File Cache  │
│             │    │   (L1)      │    │    (L2)     │
└─────────────┘    └─────────────┘    └─────────────┘
                          │                   │
                          ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │   Memory    │    │   Target    │
                   │   (L0)      │    │   Server    │
                   └─────────────┘    └─────────────┘
```

## Design Principles

### 1. Modularity

- Clear separation of concerns
- Reusable packages
- Minimal coupling between components

### 2. Type Safety

- TypeScript throughout
- Shared type definitions
- Runtime validation with Zod

### 3. Performance

- Multi-layer caching
- Connection pooling
- Efficient serialization
- Lazy loading

### 4. Observability

- Comprehensive logging
- Metrics collection
- Health checks
- Error tracking

### 5. Scalability

- Horizontal scaling support
- Database abstraction
- Configurable backends
- Resource optimization

## Technology Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Fastify 5
- **Language**: TypeScript
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Jest (planned)

### Frontend

- **Framework**: React 19
- **Build Tool**: Vite
- **UI Library**: Material-UI
- **State Management**: React Query
- **Language**: TypeScript

### Data Storage

- **Databases**: SQLite, MySQL 8, PostgreSQL 16
- **Cache**: Redis 7
- **File System**: Local/NFS storage

### Infrastructure

- **Containerization**: Docker + Docker Compose
- **Build System**: Turborepo
- **CI/CD**: GitHub Actions
- **Package Manager**: npm workspaces

## Security Considerations

### Authentication & Authorization

- JWT-based authentication (planned)
- Role-based access control (planned)
- API key management (planned)

### Data Protection

- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

### Network Security

- Rate limiting
- Request size limits
- Timeout configurations
- Health check endpoints

## Performance Characteristics

### Caching

- **L0 (Memory)**: Sub-millisecond access
- **L1 (Redis)**: 1-5ms access
- **L2 (File)**: 10-50ms access
- **Cache Hit Ratio**: Target 80%+

### Throughput

- **Target**: 1000+ requests/second
- **Latency**: <100ms p95
- **Memory Usage**: <512MB base
- **CPU Usage**: <50% under load

## Deployment Patterns

### Development

- SQLite + Redis
- Local file cache
- Hot reloading
- Debug logging

### Staging

- MySQL/PostgreSQL + Redis
- Shared cache volumes
- Production-like configuration
- Structured logging

### Production

- Clustered database
- Redis cluster
- Load balancing
- Monitoring and alerting

## Future Enhancements

### Short Term

- Complete database adapters
- Add comprehensive testing
- Implement authentication
- Add API documentation

### Medium Term

- Service mesh integration
- Advanced monitoring
- Performance optimization
- Multi-region support

### Long Term

- Machine learning for cache optimization
- Advanced analytics
- Plugin system
- GraphQL support

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines and architecture decisions.
