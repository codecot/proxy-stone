import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  StorageAdapter,
  StorageType,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "../types.js";
import { Readable } from "stream";

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For S3-compatible services
  keyPrefix?: string;
  compression?: boolean;
  encryption?: boolean;
}

export class S3StorageAdapter<T = any> implements StorageAdapter<T> {
  private s3Client: S3Client;
  private bucket: string;
  private keyPrefix: string;

  constructor(private config: S3Config) {
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix || "";

    this.s3Client = new S3Client({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
      endpoint: config.endpoint,
    });
  }

  async initialize(): Promise<void> {
    // Test connection by listing objects
    try {
      await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1,
        })
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize S3 storage: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  async close(): Promise<void> {
    // S3 client doesn't need explicit closing
  }

  async save(key: string, data: T, options?: SaveOptions): Promise<void> {
    const fullKey = this.getFullKey(key);

    const metadata: Record<string, string> = {
      "content-type": "application/json",
      "created-at": new Date().toISOString(),
    };

    if (options?.ttl) {
      const expiresAt = new Date(Date.now() + options.ttl * 1000);
      metadata["expires-at"] = expiresAt.toISOString();
    }

    if (options?.tags) {
      metadata["tags"] = JSON.stringify(options.tags);
    }

    if (options?.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        metadata[`custom-${k}`] = typeof v === "string" ? v : JSON.stringify(v);
      }
    }

    let body = JSON.stringify(data);

    if (this.config.compression || options?.compression) {
      // Could add compression here using zlib
      metadata["compression"] = "gzip";
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        Body: body,
        Metadata: metadata,
        ServerSideEncryption:
          this.config.encryption || options?.encryption ? "AES256" : undefined,
      })
    );
  }

  async get(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: fullKey,
        })
      );

      if (!response.Body) return null;

      // Check if expired
      const expiresAt = response.Metadata?.["expires-at"];
      if (expiresAt && new Date() > new Date(expiresAt)) {
        // Clean up expired object
        await this.delete(key);
        return null;
      }

      const bodyString = await this.streamToString(response.Body as Readable);

      // Handle decompression if needed
      if (response.Metadata?.["compression"] === "gzip") {
        // Could add decompression here
      }

      return JSON.parse(bodyString);
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fullKey,
        })
      );

      return true;
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);

      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fullKey,
        })
      );

      return true;
    } catch (error: any) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }

  async saveBatch(
    items: Array<{ key: string; data: T; options?: SaveOptions }>
  ): Promise<void> {
    // S3 doesn't have native batch operations, so we'll do them in parallel
    const promises = items.map((item) =>
      this.save(item.key, item.data, item.options)
    );
    await Promise.all(promises);
  }

  async getBatch(keys: string[]): Promise<Array<T | null>> {
    const promises = keys.map((key) => this.get(key));
    return await Promise.all(promises);
  }

  async deleteBatch(keys: string[]): Promise<number> {
    const promises = keys.map((key) => this.delete(key));
    const results = await Promise.all(promises);
    return results.filter(Boolean).length;
  }

  async find(filter: FilterOptions): Promise<T[]> {
    const results: T[] = [];
    let continuationToken: string | undefined;
    let collected = 0;
    const limit = filter.limit || 1000;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keyPrefix,
          MaxKeys: Math.min(1000, limit - collected),
          ContinuationToken: continuationToken,
        })
      );

      if (!response.Contents) break;

      for (const object of response.Contents) {
        if (collected >= limit) break;

        if (!object.Key) continue;

        const key = this.stripPrefix(object.Key);
        const data = await this.get(key);

        if (data && this.matchesFilter(data, object, filter)) {
          results.push(data);
          collected++;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken && collected < limit);

    // Apply sorting if specified
    if (filter.sortBy) {
      results.sort((a, b) => {
        const aVal = this.getNestedValue(a, filter.sortBy!);
        const bVal = this.getNestedValue(b, filter.sortBy!);

        if (filter.sortOrder === "desc") {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    // Apply offset
    if (filter.offset) {
      return results.slice(filter.offset);
    }

    return results;
  }

  async count(filter?: FilterOptions): Promise<number> {
    let count = 0;
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keyPrefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      if (!response.Contents) break;

      for (const object of response.Contents) {
        if (!object.Key) continue;

        if (!filter) {
          count++;
          continue;
        }

        const key = this.stripPrefix(object.Key);
        const data = await this.get(key);

        if (data && this.matchesFilter(data, object, filter)) {
          count++;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return count;
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keyPrefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      if (!response.Contents) break;

      const keysToDelete: string[] = [];

      for (const object of response.Contents) {
        if (!object.Key) continue;

        let shouldDelete = false;

        if (options?.expiredOnly) {
          // Check metadata for expiration
          try {
            const headResponse = await this.s3Client.send(
              new HeadObjectCommand({
                Bucket: this.bucket,
                Key: object.Key,
              })
            );

            const expiresAt = headResponse.Metadata?.["expires-at"];
            if (expiresAt && new Date() > new Date(expiresAt)) {
              shouldDelete = true;
            }
          } catch (error) {
            // If we can't read metadata, skip this object
            continue;
          }
        }

        if (options?.olderThan && object.LastModified) {
          if (object.LastModified < options.olderThan) {
            shouldDelete = true;
          }
        }

        if (!options?.expiredOnly && !options?.olderThan) {
          shouldDelete = true; // Delete all if no specific criteria
        }

        if (shouldDelete) {
          keysToDelete.push(object.Key);
        }
      }

      if (!options?.dryRun && keysToDelete.length > 0) {
        await this.deleteBatch(
          keysToDelete.map((key) => this.stripPrefix(key))
        );
      }

      deleted += keysToDelete.length;
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return deleted;
  }

  async getStats(): Promise<StorageStats> {
    let totalItems = 0;
    let totalSize = 0;
    let oldestItem: Date | undefined;
    let newestItem: Date | undefined;
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keyPrefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      if (!response.Contents) break;

      for (const object of response.Contents) {
        totalItems++;
        totalSize += object.Size || 0;

        if (object.LastModified) {
          if (!oldestItem || object.LastModified < oldestItem) {
            oldestItem = object.LastModified;
          }
          if (!newestItem || object.LastModified > newestItem) {
            newestItem = object.LastModified;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // For S3, we can't easily distinguish between active and expired without checking each object
    // This would be expensive, so we'll provide estimates
    return {
      totalItems,
      activeItems: totalItems, // Estimate - would need to check each object's metadata
      expiredItems: 0, // Estimate
      totalSize,
      avgItemSize: totalItems > 0 ? Math.round(totalSize / totalItems) : 0,
      oldestItem,
      newestItem,
      storageType: StorageType.S3,
      customStats: {
        bucket: this.bucket,
        keyPrefix: this.keyPrefix,
      },
    };
  }

  getStorageType(): StorageType {
    return StorageType.S3;
  }

  private getFullKey(key: string): string {
    return this.keyPrefix + key;
  }

  private stripPrefix(fullKey: string): string {
    return fullKey.startsWith(this.keyPrefix)
      ? fullKey.slice(this.keyPrefix.length)
      : fullKey;
  }

  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  private matchesFilter(data: T, object: any, filter: FilterOptions): boolean {
    // Check expiration
    if (filter.expiresAfter || filter.expiresBefore) {
      // Would need to check object metadata for expiration
    }

    // Check custom filters
    if (filter.customFilters) {
      for (const [key, value] of Object.entries(filter.customFilters)) {
        const dataValue = this.getNestedValue(data, key);
        if (dataValue !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
}
