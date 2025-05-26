import crypto from "crypto";
import {
  StorageAdapter,
  StorageType,
  SaveOptions,
  FilterOptions,
} from "../types.js";

export interface SnapshotDocument {
  id: string;
  url: string;
  data: any;
  headers: Record<string, string>;
  status: number;
  createdAt: Date;
  expiresAt: Date;
  tags?: string[];
  lastAccessed?: Date;
  accessCount: number;
  metadata?: {
    method?: string;
    backendHost?: string;
    requestSize?: number;
    responseSize?: number;
    contentType?: string;
    userAgent?: string;
    clientIp?: string;
  };
}

export interface SnapshotInput {
  url: string;
  data: any;
  headers: Record<string, string>;
  status: number;
  ttl: number;
  tags?: string[];
  metadata?: SnapshotDocument["metadata"];
}

export interface SnapshotQuery {
  url?: string;
  status?: number;
  tags?: string[];
  method?: string;
  backendHost?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "lastAccessed" | "accessCount";
  sortOrder?: "asc" | "desc";
}

export interface SnapshotStats {
  total: number;
  active: number;
  expired: number;
  avgAccessCount: number;
  totalSize: number;
  topUrls: Array<{
    url: string;
    count: number;
    avgAccessCount: number;
  }>;
  tagDistribution: Record<string, number>;
  statusDistribution: Record<number, number>;
}

export class GenericSnapshotRepository {
  constructor(private storage: StorageAdapter<SnapshotDocument>) {}

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  async saveSnapshot(input: SnapshotInput): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.ttl * 1000);
    const id = crypto.randomUUID();

    const snapshot: SnapshotDocument = {
      id,
      url: input.url,
      data: input.data,
      headers: input.headers,
      status: input.status,
      createdAt: now,
      expiresAt,
      tags: input.tags,
      accessCount: 0,
      metadata: input.metadata,
    };

    const saveOptions: SaveOptions = {
      ttl: input.ttl,
      tags: input.tags,
      metadata: {
        url: input.url,
        status: input.status,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    };

    // Use URL as key for easy retrieval, but store ID for uniqueness
    const key = this.generateKey(input.url, input.headers, input.data);
    await this.storage.save(key, snapshot, saveOptions);

    return id;
  }

  async getActiveSnapshot(
    url: string,
    headers?: Record<string, string>,
    data?: any
  ): Promise<SnapshotDocument | null> {
    const key = this.generateKey(url, headers, data);
    const snapshot = await this.storage.get(key);

    if (!snapshot) return null;

    // Check if expired
    if (new Date() > snapshot.expiresAt) {
      // Optionally clean up expired snapshot
      await this.storage.delete(key);
      return null;
    }

    return snapshot;
  }

  async updateAccessStats(
    url: string,
    headers?: Record<string, string>,
    data?: any
  ): Promise<void> {
    const key = this.generateKey(url, headers, data);
    const snapshot = await this.storage.get(key);

    if (snapshot) {
      snapshot.lastAccessed = new Date();
      snapshot.accessCount += 1;

      await this.storage.save(key, snapshot, {
        ttl: Math.max(
          0,
          Math.floor((snapshot.expiresAt.getTime() - Date.now()) / 1000)
        ),
        tags: snapshot.tags,
      });
    }
  }

  async findSnapshots(query: SnapshotQuery): Promise<SnapshotDocument[]> {
    const filter: FilterOptions = {
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder || "desc",
    };

    if (query.activeOnly) {
      filter.expiresAfter = new Date();
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = query.tags;
    }

    // Add custom filters for storage-specific queries
    filter.customFilters = {};

    if (query.url) {
      filter.customFilters.url = query.url;
    }

    if (query.status) {
      filter.customFilters.status = query.status;
    }

    if (query.method) {
      filter.customFilters["metadata.method"] = query.method;
    }

    if (query.backendHost) {
      filter.customFilters["metadata.backendHost"] = query.backendHost;
    }

    return await this.storage.find(filter);
  }

  async getStats(): Promise<SnapshotStats> {
    const storageStats = await this.storage.getStats();
    const allSnapshots = await this.storage.find({ limit: 10000 }); // Get a large sample

    const now = new Date();
    const activeSnapshots = allSnapshots.filter((s) => s.expiresAt > now);
    const expiredSnapshots = allSnapshots.filter((s) => s.expiresAt <= now);

    // Calculate URL distribution
    const urlCounts = new Map<string, { count: number; totalAccess: number }>();
    const tagCounts = new Map<string, number>();
    const statusCounts = new Map<number, number>();

    for (const snapshot of allSnapshots) {
      // URL stats
      const urlKey = snapshot.url;
      const existing = urlCounts.get(urlKey) || { count: 0, totalAccess: 0 };
      urlCounts.set(urlKey, {
        count: existing.count + 1,
        totalAccess: existing.totalAccess + snapshot.accessCount,
      });

      // Tag stats
      if (snapshot.tags) {
        for (const tag of snapshot.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // Status stats
      statusCounts.set(
        snapshot.status,
        (statusCounts.get(snapshot.status) || 0) + 1
      );
    }

    const topUrls = Array.from(urlCounts.entries())
      .map(([url, stats]) => ({
        url,
        count: stats.count,
        avgAccessCount:
          stats.count > 0 ? Math.round(stats.totalAccess / stats.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const avgAccessCount =
      allSnapshots.length > 0
        ? Math.round(
            allSnapshots.reduce((sum, s) => sum + s.accessCount, 0) /
              allSnapshots.length
          )
        : 0;

    return {
      total: storageStats.totalItems,
      active: activeSnapshots.length,
      expired: expiredSnapshots.length,
      avgAccessCount,
      totalSize: storageStats.totalSize,
      topUrls,
      tagDistribution: Object.fromEntries(tagCounts),
      statusDistribution: Object.fromEntries(statusCounts),
    };
  }

  async cleanExpiredSnapshots(): Promise<number> {
    return await this.storage.cleanup({ expiredOnly: true });
  }

  async deleteSnapshot(
    url: string,
    headers?: Record<string, string>,
    data?: any
  ): Promise<boolean> {
    const key = this.generateKey(url, headers, data);
    return await this.storage.delete(key);
  }

  async close(): Promise<void> {
    await this.storage.close();
  }

  private generateKey(
    url: string,
    headers?: Record<string, string>,
    data?: any
  ): string {
    // Create a deterministic key based on URL, relevant headers, and data
    const relevantHeaders = headers ? this.extractRelevantHeaders(headers) : {};
    const keyData = {
      url,
      headers: relevantHeaders,
      data: data ? this.hashData(data) : null,
    };

    const keyString = JSON.stringify(keyData);
    return `snapshot:${crypto.createHash("sha256").update(keyString).digest("hex")}`;
  }

  private extractRelevantHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    // Only include headers that affect the response
    const relevantHeaderNames = [
      "authorization",
      "x-user-id",
      "x-tenant-id",
      "accept",
      "content-type",
    ];

    const relevant: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (relevantHeaderNames.includes(key.toLowerCase())) {
        relevant[key.toLowerCase()] = value;
      }
    }

    return relevant;
  }

  private hashData(data: any): string {
    if (!data) return "";
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    return crypto.createHash("md5").update(dataString).digest("hex");
  }
}
