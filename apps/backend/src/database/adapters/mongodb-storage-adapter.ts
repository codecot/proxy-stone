import { MongoClient, Db, Collection, Filter, Sort } from "mongodb";
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
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<MongoDocument<T>> | null = null;

  constructor(private config: MongoConfig) {
    this.client = new MongoClient(config.connectionString, {
      maxPoolSize: config.options?.maxPoolSize || 10,
      minPoolSize: config.options?.minPoolSize || 2,
      maxIdleTimeMS: config.options?.maxIdleTimeMS || 30000,
      serverSelectionTimeoutMS:
        config.options?.serverSelectionTimeoutMS || 5000,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.collection = this.db.collection<MongoDocument<T>>(
        this.config.collection
      );

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
        `Failed to initialize MongoDB storage: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  async close(): Promise<void> {
    await this.client.close();
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
    const documentMap = new Map(documents.map((doc) => [doc.key, doc.data]));

    return keys.map((key) => documentMap.get(key) || null);
  }

  async deleteBatch(keys: string[]): Promise<number> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const result = await this.collection.deleteMany({ key: { $in: keys } });
    return result.deletedCount;
  }

  async find(filter: FilterOptions): Promise<T[]> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const mongoFilter: Filter<MongoDocument<T>> = {};

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

    // Handle tags
    if (filter.tags && filter.tags.length > 0) {
      mongoFilter.tags = { $in: filter.tags };
    }

    // Handle custom filters
    if (filter.customFilters) {
      for (const [key, value] of Object.entries(filter.customFilters)) {
        if (key.startsWith("data.")) {
          mongoFilter[key as keyof MongoDocument<T>] = value;
        } else if (key.startsWith("metadata.")) {
          mongoFilter[key as keyof MongoDocument<T>] = value;
        } else {
          mongoFilter[key as keyof MongoDocument<T>] = value;
        }
      }
    }

    // Build sort criteria
    const sort: Sort = {};
    if (filter.sortBy) {
      sort[filter.sortBy] = filter.sortOrder === "desc" ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by creation date, newest first
    }

    let query = this.collection.find(mongoFilter).sort(sort);

    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    if (filter.offset) {
      query = query.skip(filter.offset);
    }

    const documents = await query.toArray();
    return documents.map((doc) => doc.data);
  }

  async count(filter?: FilterOptions): Promise<number> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    if (!filter) {
      return await this.collection.countDocuments();
    }

    const mongoFilter: Filter<MongoDocument<T>> = {};

    if (filter.expiresAfter) {
      mongoFilter.expiresAt = { $gt: filter.expiresAfter };
    }
    if (filter.expiresBefore) {
      mongoFilter.expiresAt = { $lt: filter.expiresBefore };
    }
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
    if (filter.tags && filter.tags.length > 0) {
      mongoFilter.tags = { $in: filter.tags };
    }

    if (filter.customFilters) {
      for (const [key, value] of Object.entries(filter.customFilters)) {
        mongoFilter[key as keyof MongoDocument<T>] = value;
      }
    }

    return await this.collection.countDocuments(mongoFilter);
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    if (!this.collection) throw new Error("MongoDB not initialized");

    const filter: Filter<MongoDocument<T>> = {};

    if (options?.expiredOnly) {
      filter.expiresAt = { $lt: new Date() };
    }

    if (options?.olderThan) {
      filter.createdAt = { $lt: options.olderThan };
    }

    if (options?.tags && options.tags.length > 0) {
      filter.tags = { $in: options.tags };
    }

    if (options?.dryRun) {
      return await this.collection.countDocuments(filter);
    }

    const result = await this.collection.deleteMany(filter);
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
        .then((result) => Math.round(result[0]?.avgAccess || 0)),
      this.collection
        .findOne({}, { sort: { createdAt: 1 } })
        .then((doc) => doc?.createdAt),
      this.collection
        .findOne({}, { sort: { createdAt: -1 } })
        .then((doc) => doc?.createdAt),
      this.collection.find({}).limit(1000).toArray(), // Sample for size calculation
    ]);

    // Estimate total size based on sample
    const avgDocSize =
      sampleDocs.length > 0
        ? sampleDocs.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0) /
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
