# Contributing to Proxy Stone

Thank you for your interest in contributing to Proxy Stone! This guide will help you get started with contributing to our monorepo.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for testing)
- Git

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/proxy-stone.git
   cd proxy-stone
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build All Packages**

   ```bash
   npm run build
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
proxy-stone/
├── apps/
│   ├── backend/                # Fastify proxy service
│   └── ui/                     # React admin panel
├── packages/
│   ├── shared/                 # Common types, utils, config
│   ├── events/                 # Event contracts, schema validators
│   ├── logger/                 # Centralized logging
│   └── db/                     # Database adapters
├── docker/                     # Docker configurations
└── docs/                       # Documentation
```

## 🛠️ Development Workflow

### Making Changes

1. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**

   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**

   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

4. **Build and Verify**
   ```bash
   npm run build
   ```

### Working with Packages

#### Adding Dependencies

```bash
# Add to specific package
cd packages/shared
npm install new-dependency

# Add to workspace root
npm install -w @proxy-stone/shared new-dependency
```

#### Creating New Packages

1. Create directory under `packages/` or `apps/`
2. Add `package.json` with `@proxy-stone/` namespace
3. Create `tsconfig.json` extending base config
4. Add to workspace in root `package.json`

#### Package Dependencies

Use workspace references for internal packages:

```json
{
  "dependencies": {
    "@proxy-stone/shared": "*",
    "@proxy-stone/logger": "*"
  }
}
```

## 🧪 Testing

### Running Tests

```bash
# All packages
npm run test

# Specific package
cd packages/shared
npm run test

# With coverage
npm run test -- --coverage
```

### Docker Testing

```bash
# Test different database configurations
npm run docker:sqlite
npm run docker:mysql
npm run docker:postgresql

# Check status
npm run docker:status
```

## 📝 Code Style

### TypeScript

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use proper JSDoc comments for public APIs

### Formatting

- Prettier for code formatting
- ESLint for code quality
- Run `npm run lint:fix` before committing

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`)
- **Directories**: kebab-case (`user-management/`)
- **Variables/Functions**: camelCase (`getUserData`)
- **Classes**: PascalCase (`UserService`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)

## 📋 Pull Request Process

### Before Submitting

1. **Ensure all checks pass**

   ```bash
   npm run lint
   npm run type-check
   npm run test
   npm run build
   ```

2. **Update documentation**

   - Update README if needed
   - Add JSDoc comments
   - Update CHANGELOG.md

3. **Test thoroughly**
   - Test your changes locally
   - Test with different database configurations
   - Verify UI changes work correctly

### PR Guidelines

1. **Clear Title and Description**

   - Use descriptive titles
   - Explain what and why
   - Reference related issues

2. **Small, Focused Changes**

   - One feature/fix per PR
   - Keep changes manageable
   - Split large changes into multiple PRs

3. **Documentation**
   - Update relevant documentation
   - Add code comments where needed
   - Include examples if applicable

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues
2. Try latest version
3. Test with minimal reproduction

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Environment:**

- OS: [e.g. Ubuntu 20.04]
- Node.js version: [e.g. 18.17.0]
- Package version: [e.g. 1.0.0]
- Database: [e.g. PostgreSQL 16]

**Additional context**
Any other context about the problem.
```

## 💡 Feature Requests

### Before Requesting

1. Check if feature already exists
2. Search existing feature requests
3. Consider if it fits project scope

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions you've considered.

**Additional context**
Any other context or screenshots.
```

## 🏗️ Architecture Guidelines

### Package Design

- **Single Responsibility**: Each package should have a clear purpose
- **Minimal Dependencies**: Avoid unnecessary dependencies
- **Clear APIs**: Export clean, well-documented interfaces
- **Type Safety**: Use TypeScript effectively

### Database Adapters

When adding new database adapters:

1. Implement the `Database` interface
2. Add to the factory function
3. Include Docker configuration
4. Add tests and documentation

### Event System

When adding new events:

1. Define schema in `packages/events`
2. Add factory functions
3. Update type exports
4. Document event structure

## 🔒 Security

### Reporting Security Issues

Please report security vulnerabilities to: security@proxy-stone.dev

**Do not** create public issues for security vulnerabilities.

### Security Guidelines

- Validate all inputs
- Use parameterized queries
- Sanitize user data
- Follow OWASP guidelines

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Community

- **Discussions**: [GitHub Discussions](https://github.com/your-username/proxy-stone/discussions)
- **Issues**: [GitHub Issues](https://github.com/your-username/proxy-stone/issues)
- **Email**: support@proxy-stone.dev

## 📚 Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [React Documentation](https://react.dev/)

Thank you for contributing to Proxy Stone! 🎉
