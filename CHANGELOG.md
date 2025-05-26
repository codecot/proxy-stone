# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Monorepo structure with Turborepo
- Shared packages architecture
- Cross-platform Docker configurations
- Comprehensive documentation

### Changed

- Reorganized project structure into apps and packages
- Updated Docker configurations for new structure
- Improved development workflow

## [1.0.0] - 2024-05-26

### Added

- **Monorepo Architecture**

  - Turborepo configuration for efficient builds
  - Workspace management with npm workspaces
  - Shared TypeScript configuration

- **Shared Packages**

  - `@proxy-stone/shared` - Common types, utilities, and configuration
  - `@proxy-stone/events` - Event contracts with Zod validation
  - `@proxy-stone/logger` - Centralized logging with Pino
  - `@proxy-stone/db` - Database adapters for SQLite, MySQL, PostgreSQL

- **Applications**

  - `@proxy-stone/backend` - Fastify-based proxy service
  - `@proxy-stone/ui` - React admin panel with Material-UI

- **Docker Infrastructure**

  - Multiple database configurations (SQLite, MySQL, PostgreSQL)
  - Redis caching with Redis Commander UI
  - Cross-platform scripts (Linux, macOS, Windows)
  - Health checks and proper service dependencies

- **Development Tools**

  - VS Code workspace configuration
  - GitHub Actions CI/CD pipeline
  - ESLint and Prettier configuration
  - TypeScript strict mode

- **Documentation**
  - Comprehensive README with quick start guide
  - Docker configuration documentation
  - Contributing guidelines
  - API documentation structure

### Changed

- **Project Structure**: Migrated from separate repositories to monorepo
- **Build System**: Implemented Turborepo for efficient builds and caching
- **Package Management**: Unified dependency management with workspaces
- **Docker Setup**: Reorganized Docker files into dedicated directory

### Technical Details

- **Node.js**: 18+ required
- **TypeScript**: Strict configuration with shared base
- **Package Manager**: npm with workspaces
- **Build Tool**: Turborepo
- **Databases**: SQLite, MySQL 8, PostgreSQL 16
- **Cache**: Redis 7 with file backup
- **Frontend**: React 19 with Vite
- **Backend**: Fastify 5 with TypeScript

### Migration Notes

- Old `proxy-stone-backend/` → `apps/backend/`
- Old `proxy-stone-ui/` → `apps/ui/`
- Docker files moved to `docker/` directory
- Scripts moved to `docker/scripts/`

## [0.x.x] - Previous Versions

Previous versions were maintained as separate repositories:

- Backend: Fastify-based proxy server
- UI: React-based admin interface
- Docker: Basic containerization

---

## Release Process

1. Update version in `package.json`
2. Update this CHANGELOG.md
3. Create release tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will handle the release

## Version Schema

- **Major** (X.0.0): Breaking changes, major new features
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes, small improvements
