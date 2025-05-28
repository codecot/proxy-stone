# Path Alias Setup with @ Symbol

This project uses the `@` symbol as an alias to the `src` directory root for cleaner import statements.

## Configuration

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@/modules/*": ["./modules/*"],
      "@/utils/*": ["./utils/*"],
      "@/types/*": ["./types/*"],
      "@/config/*": ["./config/*"],
      "@/database/*": ["./database/*"],
      "@/plugins/*": ["./plugins/*"]
    }
  }
}
```

### Runtime Support
- **Development**: `tsx` with `--tsconfig` flag for path resolution
- **Production**: TypeScript compilation resolves paths at build time

## Usage Examples

### Before (Relative Imports)
```typescript
import { config } from "../../../config/index.js";
import { CacheService } from "../../cache/services/cache.js";
import { createErrorResponse } from "../../../utils/response.js";
```

### After (@ Alias)
```typescript
import { config } from "@/config/index.js";
import { CacheService } from "@/modules/cache/services/cache.js";
import { createErrorResponse } from "@/utils/response.js";
```

## Available Aliases

- `@/*` - Root src directory
- `@/modules/*` - Module directory
- `@/utils/*` - Utility functions
- `@/types/*` - Type definitions
- `@/config/*` - Configuration files
- `@/database/*` - Database related files
- `@/plugins/*` - Fastify plugins

## Migration

### Automatic Migration
Run the migration script to update all existing imports:
```bash
npm run update-imports
```

### Manual Migration
Replace relative imports with @ aliases:
- `../../../utils/` → `@/utils/`
- `../../modules/` → `@/modules/`
- `../types/` → `@/types/`
- etc.

## Benefits

1. **Cleaner Code**: No more `../../../` chains
2. **Refactor Safe**: Moving files doesn't break imports
3. **IDE Support**: Better autocomplete and navigation
4. **Consistency**: Uniform import style across the project
5. **Readability**: Clear indication of import source

## IDE Setup

### VS Code
The TypeScript configuration automatically provides IntelliSense support.

### WebStorm/IntelliJ
Path mapping is automatically detected from `tsconfig.json`.

## Build Process

The TypeScript compiler resolves all @ aliases during compilation, so the built JavaScript uses standard relative paths.

## Troubleshooting

### Import Resolution Issues
1. Ensure `tsx` is using the correct tsconfig: `tsx --tsconfig ./tsconfig.json`
2. Check that `baseUrl` and `paths` are correctly configured
3. Verify file extensions (`.js` for ES modules)

### Development vs Production
- Development: `tsx` handles path resolution
- Production: TypeScript compiler resolves paths during build 