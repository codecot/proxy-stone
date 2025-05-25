# Development Guide

Complete guide for setting up the development environment and contributing to the BFF/API Middleware service.

## Development Setup

### Prerequisites

- **Node.js** 20+ (recommend using nvm/fnm)
- **npm** 8+ or **yarn** 3+
- **Git** for version control
- **curl** for testing (or any HTTP client)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd proxy-server-ts

# Install dependencies
npm install

# Start development server
npm run dev
```

The service will start on `http://localhost:4000` with hot reload enabled.

### Development Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts"
  }
}
```

## Project Structure

```
proxy-server-ts/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── config/
│   │   └── index.ts            # Configuration management
│   ├── plugins/
│   │   ├── cors.ts             # CORS plugin
│   │   └── formbody.ts         # Form body parser plugin
│   ├── routes/
│   │   ├── api.ts              # Main API proxy routes
│   │   └── health.ts           # Health check routes
│   ├── services/
│   │   └── cache.ts            # Cache service implementation
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   └── utils/                  # Utility modules (new)
│       ├── request.ts          # Request processing utilities
│       ├── cache.ts            # Cache operation utilities
│       ├── http-client.ts      # HTTP client utilities
│       └── response.ts         # Response handling utilities
├── docs/                       # Documentation
├── dist/                       # Built JavaScript (generated)
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── .gitignore
```

### Module Architecture

The codebase follows a modular architecture pattern:

#### Core Components

1. **Entry Point** (`src/index.ts`)

   - Application bootstrap
   - Plugin registration
   - Server startup

2. **Configuration** (`src/config/`)

   - CLI argument parsing
   - Environment variable handling
   - Default value management

3. **Plugins** (`src/plugins/`)

   - Fastify plugin extensions
   - CORS configuration
   - Body parsing

4. **Routes** (`src/routes/`)

   - API endpoint definitions
   - Route handlers
   - Request/response logic

5. **Services** (`src/services/`)

   - Business logic
   - Cache management
   - External service integrations

6. **Utils** (`src/utils/`)
   - Reusable utility functions
   - Request/response processing
   - HTTP client operations

## Code Style Guidelines

### TypeScript Standards

```typescript
// Use explicit types
interface ProcessedRequest {
  method: string;
  targetUrl: string;
  headers: Record<string, string>;
}

// Use async/await over promises
export async function processRequest(): Promise<ProcessedRequest> {
  // Implementation
}

// Use proper error handling
try {
  const result = await operationThatMightFail();
  return result;
} catch (error) {
  logger.error('Operation failed:', error);
  throw error;
}
```

### Naming Conventions

- **Files**: kebab-case (`http-client.ts`)
- **Functions**: camelCase (`processRequest`)
- **Classes**: PascalCase (`CacheService`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`)
- **Interfaces**: PascalCase (`ProcessedRequest`)

### Function Documentation

```typescript
/**
 * Process incoming request and extract necessary data
 * @param request - Fastify request object
 * @param targetBaseUrl - Base URL for the target server
 * @returns Processed request data
 */
export function processRequest(
  request: FastifyRequest<{ Params: WildcardRouteParams }>,
  targetBaseUrl: string
): ProcessedRequest {
  // Implementation
}
```

## Testing Strategy

### Unit Tests (TODO)

```bash
# Install testing dependencies
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Example Test Structure

```typescript
// tests/utils/request.test.ts
import { processRequest } from '../../src/utils/request';

describe('processRequest', () => {
  it('should process GET request correctly', () => {
    const mockRequest = {
      method: 'GET',
      url: '/api/users',
      headers: { 'content-type': 'application/json' },
      // ... other properties
    };

    const result = processRequest(mockRequest, 'https://api.example.com');

    expect(result.method).toBe('GET');
    expect(result.targetUrl).toBe('https://api.example.com/users');
  });
});
```

### Integration Tests

```bash
# Start test server
npm run dev -- --port 4001 --target-url https://httpbin.org

# Run integration tests
curl http://localhost:4001/health
curl http://localhost:4001/proxy/get
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
npm run dev  # Start development server

# Test changes
curl http://localhost:4000/proxy/test

# Check code quality
npm run lint
npm run format:check

# Fix issues
npm run lint:fix
npm run format
```

### 2. Code Quality Checks

```bash
# TypeScript compilation
npm run build

# Linting
npm run lint

# Formatting
npm run format:check

# Fix all issues
npm run lint:fix && npm run format
```

### 3. Git Workflow

```bash
# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/new-feature

# Create pull request
# (via GitHub/GitLab interface)
```

## Adding New Features

### 1. Adding a New Utility Module

```typescript
// src/utils/new-util.ts
export function newUtilityFunction(param: string): string {
  // Implementation
  return processedParam;
}
```

### 2. Adding a New Route

```typescript
// src/routes/new-route.ts
import { FastifyInstance } from 'fastify';

export async function newRoutes(fastify: FastifyInstance) {
  fastify.get('/new-endpoint', async (request, reply) => {
    return { message: 'Hello from new endpoint' };
  });
}
```

```typescript
// src/index.ts - Register the route
import { newRoutes } from './routes/new-route.js';

// Register routes
await app.register(newRoutes);
```

### 3. Adding Configuration Options

```typescript
// src/types/index.ts - Add to ServerConfig interface
export interface ServerConfig {
  // ... existing properties
  newOption: string;
}
```

```typescript
// src/config/index.ts - Add parsing logic
const cliNewOption = getArgValue('new-option');

export const config: ServerConfig = {
  // ... existing config
  newOption: cliNewOption || process.env.NEW_OPTION || 'default-value',
};
```

## Debugging

### Development Debugging

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Specific module debugging
DEBUG=proxy-server:* npm run dev

# TypeScript debugging with tsx
npm run dev  # Automatic reload on changes
```

### VS Code Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Proxy Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "runtimeExecutable": "tsx",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true
    }
  ]
}
```

### Request/Response Debugging

```typescript
// Add debugging to utils
import debug from 'debug';
const log = debug('proxy-server:request');

export function processRequest(/* params */): ProcessedRequest {
  log('Processing request:', request.method, request.url);
  // ... implementation
  log('Processed request:', result);
  return result;
}
```

## Performance Profiling

### Memory Usage

```bash
# Monitor memory usage
node --inspect dist/index.js

# Chrome DevTools profiling
# Open chrome://inspect
# Click "inspect" on your Node.js process
```

### Request Profiling

```typescript
// Add timing to route handlers
fastify.addHook('onRequest', async (request) => {
  request.startTime = Date.now();
});

fastify.addHook('onSend', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  fastify.log.info(`${request.method} ${request.url} - ${duration}ms`);
});
```

## Contributing Guidelines

### Before Contributing

1. **Read the documentation** thoroughly
2. **Check existing issues** and pull requests
3. **Follow the code style** guidelines
4. **Write tests** for new features
5. **Update documentation** as needed

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

### Commit Message Format

```bash
# Format: type(scope): description
feat(cache): add TTL configuration per method
fix(routes): handle malformed request bodies
docs(api): update endpoint documentation
refactor(utils): extract request processing logic
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Code Review Checklist

### For Reviewers

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Error handling is appropriate
- [ ] TypeScript types are correct

### For Contributors

- [ ] Code compiles without errors
- [ ] Linting passes
- [ ] Formatting is correct
- [ ] All new code has appropriate logging
- [ ] Configuration changes are documented
- [ ] Breaking changes are noted

## IDE Setup

### VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "eslint.format.enable": true
}
```

## Release Process

### Version Management

```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)
npm version minor

# Major release (breaking changes)
npm version major
```

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Version number bumped
- [ ] Changelog updated
- [ ] Build artifacts created
- [ ] Docker image built
- [ ] Release notes written

---

**Congratulations!** You're now ready to contribute to the BFF/API Middleware service. Start with the [Quick Start Guide](./quick-start.md) to get familiar with the codebase.
