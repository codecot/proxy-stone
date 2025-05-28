import { StorageType, StorageConfig } from "../database/types.js";
import { StoragePluginRegistry } from "../database/storage-plugin-registry.js";

// Placeholder for any core storage plugins you might want to register.
// For now, this will be minimal.

export function registerCoreStoragePlugins(): void {
  // Example: Registering a hypothetical LocalFileStorageAdapter
  // if (StoragePluginRegistry.getAdapterFactory(StorageType.LOCAL_FILE)) {
  //   console.log('LocalFileStorageAdapter already registered or overridden.');
  // } else {
  //   StoragePluginRegistry.registerAdapterFactory(StorageType.LOCAL_FILE, async (config) => {
  //     // Replace with actual LocalFileStorageAdapter instantiation
  //     console.log('Creating LocalFileStorageAdapter with config:', config);
  //     return {} as any; // Placeholder
  //   });
  //   console.log('Registered LocalFileStorageAdapter (core)');
  // }

  // Similarly, you could register adapters for SQLite, MySQL, PostgreSQL if they aren't handled elsewhere
  // or if you want to provide a default/core implementation here.
  console.log("Core storage plugins registration initiated.");
}

export function getCoreStorageDefaults(
  storageType: StorageType
): Partial<StorageConfig> {
  switch (storageType) {
    case StorageType.SQLITE:
      return {
        path: "./proxy_stone_storage.sqlite",
      };
    case StorageType.LOCAL_FILE:
      return {
        directory: "./proxy_stone_files",
      };
    // Add defaults for other core storage types if needed
    default:
      return {};
  }
}
