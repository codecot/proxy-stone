import { MongoClient, Db, Collection, MongoClientOptions } from "mongodb";
import {
  StorageAdapter,
  StorageConfig,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "@proxy-stone/backend";

export interface MongoDBStorageConfig extends StorageConfig {
  connectionString: string;
  database: string;
  collection?: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  connectTimeoutMS?: number;
  ssl?: boolean;
  authSource?: string;
}

interface StorageDocument {
  _id: string;
  data: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export class MongoDBStorageAdapter<T> implements StorageAdapter<T> {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<StorageDocument>;
  private collectionName: string;

  constructor(private config: MongoDBStorageConfig) {
    this.collectionName = config.collection || "proxy_stone_snapshots";

    const options: MongoClientOptions = {
      maxPoolSize: config.maxPoolSize || 10,
      minPoolSize: config.minPoolSize || 2,
      maxIdleTimeMS: config.maxIdleTimeMS || 30000,
      serverSelectionTimeoutMS: config.serverSelectionTimeoutMS || 5000,
      socketTimeoutMS: config.socketTimeoutMS || 45000,
      connectTimeoutMS: config.connectTimeoutMS || 10000,
    };

    if (config.ssl !== undefined) {
      options.ssl = config.ssl;
    }

    if (config.authSource) {
      options.authSource = config.authSource;
    }

    this.client = new MongoClient(config.connectionString, options);
    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.collection = this.db.collection<StorageDocument>(
        this.collectionName
      );

      // Create indexes
      await this.createIndexes();
    } catch (error) {
      console.error("Failed to initialize MongoDB connection:", error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // TTL index for automatic expiration
      await this.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, sparse: true }
      );

      // Index for created_at for sorting
      await this.collection.createIndex({ createdAt: 1 });

      // Index for updated_at
      await this.collection.createIndex({ updatedAt: 1 });

      // Text index for pattern searching (optional)
      await this.collection.createIndex({ _id: "text" });
    } catch (error) {
      console.warn("Failed to create some indexes:", error);
    }
  }

  async save(id: string, data: T, options?: SaveOptions): Promise<void> {
    const now = new Date();
    const expiresAt = options?.ttl
      ? new Date(Date.now() + options.ttl * 1000)
      : undefined;

    const document: StorageDocument = {
      _id: id,
      data,
      metadata: options?.metadata || {},
      createdAt: now,
      updatedAt: now,
      ...(expiresAt && { expiresAt }),
    };

    await this.collection.replaceOne({ _id: id }, document, { upsert: true });
  }

  async load(id: string): Promise<T | null> {
    const document = await this.collection.findOne({
      _id: id,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    });

    return document ? document.data : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.collection.countDocuments(
      {
        _id: id,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      { limit: 1 }
    );
    return count > 0;
  }

  async list(options?: FilterOptions): Promise<string[]> {
    const filter: any = {
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    };

    if (options?.pattern) {
      // Convert glob pattern to regex
      const regexPattern = options.pattern
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      filter._id = { $regex: new RegExp(regexPattern, "i") };
    }

    const cursor = this.collection
      .find(filter, { projection: { _id: 1 } })
      .sort({ createdAt: -1 });

    if (options?.limit) {
      cursor.limit(options.limit);
    }

    if (options?.offset) {
      cursor.skip(options.offset);
    }

    const documents = await cursor.toArray();
    return documents.map((doc) => doc._id);
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    let deletedCount = 0;

    // MongoDB automatically handles TTL expiration, but we can manually clean up expired entries
    const expiredResult = await this.collection.deleteMany({
      expiresAt: { $lte: new Date() },
    });
    deletedCount += expiredResult.deletedCount;

    // Clean up old entries if maxAge is specified
    if (options?.maxAge) {
      const cutoffDate = new Date(Date.now() - options.maxAge * 1000);
      const oldResult = await this.collection.deleteMany({
        createdAt: { $lt: cutoffDate },
      });
      deletedCount += oldResult.deletedCount;
    }

    return deletedCount;
  }

  async getStats(): Promise<StorageStats> {
    const filter = {
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    };

    const totalItems = await this.collection.countDocuments(filter);

    // Get collection stats
    const stats = await this.db.command({ collStats: this.collectionName });
    const totalSize = stats.size || 0;

    return {
      totalItems,
      totalSize,
      lastCleanup: new Date(),
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
