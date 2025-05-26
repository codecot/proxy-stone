import { StorageAdapter, StorageConfig, StorageType } from "./types.js";

export interface StorageAdapterConstructor<T = any> {
  new (config: any): StorageAdapter<T>;
}

export interface StoragePlugin {
  name: string;
  type: StorageType;
  description: string;
  dependencies?: string[]; // Required npm packages
  configSchema?: any; // JSON schema for config validation
  adapterClass: StorageAdapterConstructor;
}

export class StoragePluginRegistry {
  private static plugins = new Map<StorageType, StoragePlugin>();

  /**
   * Register a storage adapter plugin
   */
  static registerPlugin(plugin: StoragePlugin): void {
    if (this.plugins.has(plugin.type)) {
      throw new Error(
        `Storage plugin for type '${plugin.type}' is already registered`
      );
    }

    this.plugins.set(plugin.type, plugin);
    console.log(
      `📦 Registered storage plugin: ${plugin.name} (${plugin.type})`
    );
  }

  /**
   * Get a registered plugin by storage type
   */
  static getPlugin(type: StorageType): StoragePlugin | undefined {
    return this.plugins.get(type);
  }

  /**
   * Check if a storage type is supported
   */
  static isSupported(type: StorageType): boolean {
    return this.plugins.has(type);
  }

  /**
   * Get all registered plugins
   */
  static getAllPlugins(): StoragePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get available storage types
   */
  static getAvailableTypes(): StorageType[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Create a storage adapter instance using a registered plugin
   */
  static async createAdapter<T = any>(
    type: StorageType,
    config: StorageConfig
  ): Promise<StorageAdapter<T>> {
    const plugin = this.getPlugin(type);

    if (!plugin) {
      throw new Error(
        `No storage plugin registered for type '${type}'. ` +
          `Available types: ${this.getAvailableTypes().join(", ")}`
      );
    }

    // Check dependencies
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      await this.checkDependencies(plugin);
    }

    // Validate config if schema is provided
    if (plugin.configSchema) {
      this.validateConfig(config, plugin.configSchema);
    }

    try {
      const adapter = new plugin.adapterClass(config);
      return adapter;
    } catch (error) {
      throw new Error(
        `Failed to create storage adapter for '${type}': ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Check if required dependencies are available
   */
  private static async checkDependencies(plugin: StoragePlugin): Promise<void> {
    const missingDeps: string[] = [];

    for (const dep of plugin.dependencies || []) {
      try {
        await import(dep);
      } catch (error) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      throw new Error(
        `Missing dependencies for ${plugin.name}: ${missingDeps.join(", ")}. ` +
          `Install with: npm install ${missingDeps.join(" ")}`
      );
    }
  }

  /**
   * Validate configuration against plugin schema
   */
  private static validateConfig(config: StorageConfig, schema: any): void {
    // Simple validation - in practice you might want to use a proper JSON schema validator
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in config)) {
          throw new Error(`Required configuration field '${field}' is missing`);
        }
      }
    }
  }

  /**
   * Auto-discover and register plugins from a directory
   */
  static async discoverPlugins(pluginDir: string): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const files = await fs.readdir(pluginDir);

      for (const file of files) {
        if (
          file.endsWith("-storage-plugin.js") ||
          file.endsWith("-storage-plugin.ts")
        ) {
          try {
            const pluginPath = path.join(pluginDir, file);
            const pluginModule = await import(pluginPath);

            if (
              pluginModule.default &&
              typeof pluginModule.default.register === "function"
            ) {
              await pluginModule.default.register(this);
            }
          } catch (error) {
            console.warn(`Failed to load storage plugin ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Plugin directory doesn't exist or can't be read - that's fine
      console.debug(`Plugin discovery failed for ${pluginDir}:`, error);
    }
  }
}
