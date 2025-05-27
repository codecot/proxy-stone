import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "logs/**",
      "*.cjs",
      "*.mjs",
      "coverage/**",
      ".nyc_output/**",
      "test-*.js",
      "verify-*.js",
      "check-*.js",
      "env-sync-*.js",
      "update-imports.js",
    ],
  },

  // Base configuration for all TypeScript files
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Relaxed TypeScript rules for backend complexity
      "@typescript-eslint/no-explicit-any": "off", // Too many legacy any types
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off", // Common in backend logic
      "@typescript-eslint/prefer-nullish-coalescing": "off", // Too many to fix at once
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/no-floating-promises": "warn", // Keep this for async safety
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": "warn", // Keep this for async safety
      
      // Disable unsafe rules for now - too many to fix
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off", 
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",

      // General rules
      "no-console": "off", // Allow console in backend
      "no-debugger": "error",
      "prefer-const": "warn",
      "no-var": "error",
      "object-shorthand": "warn",
      "prefer-arrow-callback": "warn",
      "prefer-template": "warn",
      "no-duplicate-imports": "error",

      // Node.js specific
      "no-process-exit": "warn",
      "no-path-concat": "error",
    },
  },

  // Configuration for test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Configuration for JavaScript files (if any)
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },

  // Prettier integration (must be last)
  prettier
);
