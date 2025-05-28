import {
  StorageAdapter,
  StorageType,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "../types.js";

export interface MongoConfig {
  connectionString: string;
  database: string;
  collection: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
  };
}

interface MongoDocument<T = any> {
  _id: string;
  key: string;
  data: T;
  createdAt: Date;
  expiresAt?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
  accessCount: number;
  lastAccessed?: Date;
}

export class MongoStorageAdapter<T = any> implements StorageAdapter<T> {
  private client: any = null;
  private db: any = null;
  private collection: any = null;

  constructor(private config: MongoConfig) {}

  async initialize(): Promise<void> {
    try {
      // Dynamic import of mongodb
      const mongodb = await import("mongodb");
      const MongoClient = mongodb.MongoClient;

      this.client = new MongoClient(this.config.connectionString, {
        maxPoolSize: this.config.options?.maxPoolSize || 10,
        minPoolSize: this.config.options?.minPoolSize || 2,
        maxIdleTimeMS: this.config.options?.maxIdleTimeMS || 30000,
        serverSelectionTimeoutMS:
          this.config.options?.serverSelectionTimeoutMS || 5000,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.collection = this.db.collection(this.config.collection);

      // Create indexes for better performance
      await this.collection.createIndex({ key: 1 }, { unique: true });
      await this.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
      );
      await this.collection.createIndex({ tags: 1 });
      await this.collection.createIndex({ createdAt: 1 });
      await this.collection.createIndex({ lastAccessed: 1 });
    } catch (error) {
      throw new Error(
        `Failed to initialize MongoDB storage: ${error instanceof Error ? error.message : error}. Make sure to install: npm install mongodb`
      );
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }

  async save(key: string, data: T, options?: SaveOptions): Promise<void> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const now = new Date();
    const document: MongoDocument<T> = {
      _id: key,
      key,
      data,
      createdAt: now,
      expiresAt: options?.ttl
        ? new Date(now.getTime() + options.ttl * 1000)
        : undefined,
      tags: options?.tags,
      metadata: options?.metadata,
      accessCount: 0,
    };

    await this.collection.replaceOne({ key }, document, { upsert: true });
  }

  async get(key: string): Promise<T | null> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const document = await this.collection.findOne({ key });

    if (!document) return null;

    // Check if expired (MongoDB TTL should handle this, but double-check)
    if (document.expiresAt && new Date() > document.expiresAt) {
      await this.delete(key);
      return null;
    }

    return document.data;
  }

  async delete(key: string): Promise<boolean> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const result = await this.collection.deleteOne({ key });
    return result.deletedCount > 0;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const count = await this.collection.countDocuments({ key }, { limit: 1 });
    return count > 0;
  }

  async saveBatch(
    items: Array<{ key: string; data: T; options?: SaveOptions }>
  ): Promise<void> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const now = new Date();
    const operations = items.map((item) => ({
      replaceOne: {
        filter: { key: item.key },
        replacement: {
          _id: item.key,
          key: item.key,
          data: item.data,
          createdAt: now,
          expiresAt: item.options?.ttl
            ? new Date(now.getTime() + item.options.ttl * 1000)
            : undefined,
          tags: item.options?.tags,
          metadata: item.options?.metadata,
          accessCount: 0,
        } as MongoDocument<T>,
        upsert: true,
      },
    }));

    await this.collection.bulkWrite(operations);
  }

  async getBatch(keys: string[]): Promise<Array<T | null>> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const documents = await this.collection
      .find({ key: { $in: keys } })
      .toArray();
    const documentMap = new Map<string, T>();
    
    for (const doc of documents) {
      documentMap.set(doc.key, doc.data);
    }

    return keys.map((key) => documentMap.get(key) || null);
  }

  async deleteBatch(keys: string[]): Promise<number> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const result = await this.collection.deleteMany({ key: { $in: keys } });
    return result.deletedCount;
  }

  async find(filter: FilterOptions): Promise<T[]> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const mongoFilter: any = {};

    // Handle expiration filters
    if (filter.expiresAfter) {
      mongoFilter.expiresAt = { $gt: filter.expiresAfter };
    }
    if (filter.expiresBefore) {
      mongoFilter.expiresAt = { $lt: filter.expiresBefore };
    }

    // Handle date filters
    if (filter.createdAfter) {
      mongoFilter.createdAt = {
        ...mongoFilter.createdAt,
        $gt: filter.createdAfter,
      };
    }
    if (filter.createdBefore) {
      mongoFilter.createdAt = {
        ...mongoFilter.createdAt,
        $lt: filter.createdBefore,
      };
    }

    // Handle tags filter
    if (filter.tags && filter.tags.length > 0) {
      mongoFilter.tags = { $in: filter.tags };
    }

    let query = this.collection.find(mongoFilter);

    // Apply sorting
    if (filter.sortBy) {
      const sortOrder = filter.sortOrder === "desc" ? -1 : 1;
      query = query.sort({ [filter.sortBy]: sortOrder });
    }

    // Apply pagination
    if (filter.offset) {
      query = query.skip(filter.offset);
    }
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const documents = await query.toArray();
    return documents.map((doc: any) => doc.data);
  }

  async count(filter?: FilterOptions): Promise<number> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const mongoFilter: any = {};

    if (filter?.tags && filter.tags.length > 0) {
      mongoFilter.tags = { $in: filter.tags };
    }

    if (filter?.createdAfter) {
      mongoFilter.createdAt = {
        ...mongoFilter.createdAt,
        $gt: filter.createdAfter,
      };
    }

    if (filter?.createdBefore) {
      mongoFilter.createdAt = {
        ...mongoFilter.createdAt,
        $lt: filter.createdBefore,
      };
    }

    return await this.collection.countDocuments(mongoFilter);
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const now = new Date();
    let deleteFilter: any = {};

    if (options?.expiredOnly) {
      deleteFilter.expiresAt = { $lt: now };
    }

    if (options?.olderThan) {
      deleteFilter.createdAt = { $lt: options.olderThan };
    }

    if (options?.tags && options.tags.length > 0) {
      deleteFilter.tags = { $in: options.tags };
    }

    if (options?.dryRun) {
      return await this.collection.countDocuments(deleteFilter);
    }

    const result = await this.collection.deleteMany(deleteFilter);
    return result.deletedCount;
  }

  async getStats(): Promise<StorageStats> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const now = new Date();

    const [
      totalItems,
      activeItems,
      expiredItems,
      avgAccessCount,
      oldestItem,
      newestItem,
      sampleDocs,
    ] = await Promise.all([
      this.collection.countDocuments(),
      this.collection.countDocuments({
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
      }),
      this.collection.countDocuments({ expiresAt: { $lt: now } }),
      this.collection
        .aggregate([
          { $group: { _id: null, avgAccess: { $avg: "$accessCount" } } },
        ])
        .toArray()
        .then((result: any[]) => Math.round(result[0]?.avgAccess || 0)),
      this.collection
        .findOne({}, { sort: { createdAt: 1 } })
        .then((doc: any) => doc?.createdAt),
      this.collection
        .findOne({}, { sort: { createdAt: -1 } })
        .then((doc: any) => doc?.createdAt),
      this.collection.find({}).limit(1000).toArray(), // Sample for size calculation
    ]);

    // Estimate total size based on sample
    const avgDocSize =
      sampleDocs.length > 0
        ? sampleDocs.reduce((sum: number, doc: any) => sum + JSON.stringify(doc).length, 0) /
          sampleDocs.length
        : 0;
    const estimatedTotalSize = Math.round(avgDocSize * totalItems);

    return {
      totalItems,
      activeItems,
      expiredItems,
      totalSize: estimatedTotalSize,
      avgItemSize: Math.round(avgDocSize),
      oldestItem,
      newestItem,
      storageType: StorageType.MONGODB,
      customStats: {
        database: this.config.database,
        collection: this.config.collection,
        avgAccessCount,
      },
    };
  }

  getStorageType(): StorageType {
    return StorageType.MONGODB;
  }

  // MongoDB-specific helper methods
  async updateAccessStats(key: string): Promise<void> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    await this.collection.updateOne(
      { key },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessed: new Date() },
      }
    );
  }

  async createIndex(
    indexSpec: Record<string, 1 | -1>,
    options?: { unique?: boolean; sparse?: boolean }
  ): Promise<void> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    await this.collection.createIndex(indexSpec, options);
  }

  async getCollectionStats(): Promise<any> {
    if (!this.db) throw new Error("MongoDB not initialized");

    return await this.db.stats();
  }
}
