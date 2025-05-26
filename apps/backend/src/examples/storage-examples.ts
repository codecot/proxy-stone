import {
  StorageFactory,
  StorageType,
  StorageConfig,
} from "../database/storage-factory.js";
import { GenericSnapshotRepository } from "../database/repositories/generic-snapshot-repository.js";

// Example configurations for different storage types
export const storageExamples = {
  // 1. SQLite (current default)
  sqlite: {
    type: StorageType.SQLITE,
    path: "./storage/snapshots.db",
  } as StorageConfig,

  // 2. PostgreSQL
  postgresql: {
    type: StorageType.POSTGRESQL,
    host: "localhost",
    port: 5432,
    user: "devuser",
    password: "devpass",
    database: "proxy_stone",
  } as StorageConfig,

  // 3. MongoDB (requires: npm install mongodb)
  mongodb: {
    type: StorageType.MONGODB,
    connectionString: "mongodb://localhost:27017",
    database: "proxy_stone",
    collection: "snapshots",
  } as StorageConfig,

  // 4. Local File Storage (no dependencies)
  localFile: {
    type: StorageType.LOCAL_FILE,
    directory: "./storage/snapshots",
    compression: true,
  } as StorageConfig,

  // 5. AWS S3 (requires: npm install @aws-sdk/client-s3)
  s3: {
    type: StorageType.S3,
    bucket: "my-proxy-snapshots",
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    keyPrefix: "snapshots/",
    compression: true,
    encryption: true,
  } as StorageConfig,

  // 6. Redis (requires: npm install ioredis)
  redis: {
    type: StorageType.REDIS,
    host: "localhost",
    port: 6379,
    keyPrefix: "snapshots:",
    ttl: 3600, // Default TTL in seconds
  } as StorageConfig,
};

// Example usage functions
export class StorageExamples {
  // Example 1: Using Local File Storage
  static async useLocalFileStorage() {
    console.log("📁 Using Local File Storage...");

    const config = storageExamples.localFile;
    const repository = await StorageFactory.createSnapshotStorage(config);

    await repository.initialize();

    // Save a snapshot
    const snapshotId = await repository.saveSnapshot({
      url: "https://api.example.com/users",
      data: { users: [{ id: 1, name: "John" }] },
      headers: { "content-type": "application/json" },
      status: 200,
      ttl: 3600, // 1 hour
      tags: ["users", "api"],
      metadata: {
        method: "GET",
        backendHost: "api.example.com",
        responseSize: 1024,
      },
    });

    console.log(`✅ Saved snapshot: ${snapshotId}`);

    // Retrieve the snapshot
    const snapshot = await repository.getActiveSnapshot(
      "https://api.example.com/users"
    );
    console.log("📄 Retrieved snapshot:", snapshot?.data);

    // Get stats
    const stats = await repository.getStats();
    console.log("📊 Storage stats:", stats);

    await repository.close();
  }

  // Example 2: Using S3 Storage (when AWS SDK is available)
  static async useS3Storage() {
    console.log("☁️ Using S3 Storage...");

    try {
      const config = storageExamples.s3;
      const repository = await StorageFactory.createSnapshotStorage(config);

      await repository.initialize();

      // Save multiple snapshots
      const snapshots = [
        {
          url: "https://api.example.com/products",
          data: { products: [{ id: 1, name: "Widget" }] },
          headers: { "content-type": "application/json" },
          status: 200,
          ttl: 7200, // 2 hours
          tags: ["products", "catalog"],
        },
        {
          url: "https://api.example.com/orders",
          data: { orders: [{ id: 1, total: 99.99 }] },
          headers: { "content-type": "application/json" },
          status: 200,
          ttl: 1800, // 30 minutes
          tags: ["orders", "transactions"],
        },
      ];

      for (const snapshot of snapshots) {
        const id = await repository.saveSnapshot(snapshot);
        console.log(`✅ Saved S3 snapshot: ${id}`);
      }

      // Find snapshots by tags
      const productSnapshots = await repository.findSnapshots({
        tags: ["products"],
        activeOnly: true,
        limit: 10,
      });

      console.log(`📦 Found ${productSnapshots.length} product snapshots`);

      await repository.close();
    } catch (error) {
      console.log("⚠️ S3 not available:", (error as Error).message);
    }
  }

  // Example 3: Using MongoDB Storage (when MongoDB driver is available)
  static async useMongoStorage() {
    console.log("🍃 Using MongoDB Storage...");

    try {
      const config = storageExamples.mongodb;
      const repository = await StorageFactory.createSnapshotStorage(config);

      await repository.initialize();

      // Save with rich metadata
      const snapshotId = await repository.saveSnapshot({
        url: "https://api.example.com/analytics",
        data: {
          metrics: {
            pageViews: 1000,
            uniqueVisitors: 250,
            bounceRate: 0.35,
          },
        },
        headers: { "content-type": "application/json" },
        status: 200,
        ttl: 300, // 5 minutes (analytics data changes frequently)
        tags: ["analytics", "metrics", "dashboard"],
        metadata: {
          method: "GET",
          backendHost: "analytics.example.com",
          responseSize: 2048,
          contentType: "application/json",
          userAgent: "ProxyStone/1.0",
          clientIp: "192.168.1.100",
        },
      });

      console.log(`✅ Saved MongoDB snapshot: ${snapshotId}`);

      // Complex query with filters
      const recentAnalytics = await repository.findSnapshots({
        tags: ["analytics"],
        activeOnly: true,
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 5,
      });

      console.log(
        `📈 Found ${recentAnalytics.length} recent analytics snapshots`
      );

      // Get comprehensive stats
      const stats = await repository.getStats();
      console.log("📊 MongoDB stats:", {
        total: stats.total,
        active: stats.active,
        topUrls: stats.topUrls.slice(0, 3),
        tagDistribution: stats.tagDistribution,
      });

      await repository.close();
    } catch (error) {
      console.log("⚠️ MongoDB not available:", (error as Error).message);
    }
  }

  // Example 4: Storage Migration
  static async migrateStorage() {
    console.log("🔄 Migrating from SQLite to Local File Storage...");

    // Source: SQLite
    const sourceConfig = storageExamples.sqlite;
    const sourceRepo = await StorageFactory.createSnapshotStorage(sourceConfig);
    await sourceRepo.initialize();

    // Destination: Local File
    const destConfig = storageExamples.localFile;
    const destRepo = await StorageFactory.createSnapshotStorage(destConfig);
    await destRepo.initialize();

    try {
      // Get all snapshots from source
      const allSnapshots = await sourceRepo.findSnapshots({
        activeOnly: false, // Include expired ones too
        limit: 1000,
      });

      console.log(`📦 Found ${allSnapshots.length} snapshots to migrate`);

      // Migrate each snapshot
      let migrated = 0;
      for (const snapshot of allSnapshots) {
        try {
          await destRepo.saveSnapshot({
            url: snapshot.url,
            data: snapshot.data,
            headers: snapshot.headers,
            status: snapshot.status,
            ttl: Math.max(
              300,
              Math.floor((snapshot.expiresAt.getTime() - Date.now()) / 1000)
            ),
            tags: snapshot.tags,
            metadata: snapshot.metadata,
          });
          migrated++;
        } catch (error) {
          console.warn(
            `⚠️ Failed to migrate snapshot for ${snapshot.url}:`,
            error
          );
        }
      }

      console.log(
        `✅ Successfully migrated ${migrated}/${allSnapshots.length} snapshots`
      );

      // Compare stats
      const sourceStats = await sourceRepo.getStats();
      const destStats = await destRepo.getStats();

      console.log("📊 Migration comparison:", {
        source: { total: sourceStats.total, active: sourceStats.active },
        destination: { total: destStats.total, active: destStats.active },
      });
    } finally {
      await sourceRepo.close();
      await destRepo.close();
    }
  }

  // Example 5: Performance Comparison
  static async compareStoragePerformance() {
    console.log("⚡ Comparing storage performance...");

    const testData = {
      url: "https://api.example.com/test",
      data: { test: "data", timestamp: Date.now() },
      headers: { "content-type": "application/json" },
      status: 200,
      ttl: 3600,
      tags: ["performance", "test"],
    };

    const storageTypes = [
      { name: "Local File", config: storageExamples.localFile },
      { name: "SQLite", config: storageExamples.sqlite },
    ];

    for (const { name, config } of storageTypes) {
      console.log(`\n🧪 Testing ${name}...`);

      try {
        const repository = await StorageFactory.createSnapshotStorage(config);
        await repository.initialize();

        // Write performance
        const writeStart = Date.now();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
          await repository.saveSnapshot({
            ...testData,
            url: `${testData.url}/${i}`,
          });
        }

        const writeTime = Date.now() - writeStart;
        console.log(
          `✍️ Write: ${iterations} operations in ${writeTime}ms (${(writeTime / iterations).toFixed(2)}ms avg)`
        );

        // Read performance
        const readStart = Date.now();

        for (let i = 0; i < iterations; i++) {
          await repository.getActiveSnapshot(`${testData.url}/${i}`);
        }

        const readTime = Date.now() - readStart;
        console.log(
          `📖 Read: ${iterations} operations in ${readTime}ms (${(readTime / iterations).toFixed(2)}ms avg)`
        );

        // Stats
        const stats = await repository.getStats();
        console.log(
          `📊 Final stats: ${stats.total} total, ${stats.totalSize} bytes`
        );

        await repository.close();
      } catch (error) {
        console.log(`❌ ${name} test failed:`, (error as Error).message);
      }
    }
  }
}

// Example configuration helper
export function createStorageConfig(
  type: StorageType,
  overrides: Partial<StorageConfig> = {}
): StorageConfig {
  const defaults = StorageFactory.getDefaultConfig(type);
  return { ...defaults, ...overrides } as StorageConfig;
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  async function runExamples() {
    console.log("🚀 Running Storage Examples...\n");

    try {
      await StorageExamples.useLocalFileStorage();
      console.log("\n" + "=".repeat(50) + "\n");

      await StorageExamples.useS3Storage();
      console.log("\n" + "=".repeat(50) + "\n");

      await StorageExamples.useMongoStorage();
      console.log("\n" + "=".repeat(50) + "\n");

      await StorageExamples.compareStoragePerformance();
    } catch (error) {
      console.error("❌ Example failed:", error);
    }
  }

  runExamples();
}
