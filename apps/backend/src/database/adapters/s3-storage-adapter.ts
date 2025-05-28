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
  private s3Client: any = null;
  private bucket: string;
  private keyPrefix: string;

  constructor(private config: S3Config) {
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix || "";
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of AWS SDK
      const s3Module = await import("@aws-sdk/client-s3");
      const S3Client = s3Module.S3Client;

      this.s3Client = new S3Client({
        region: this.config.region,
        credentials:
          this.config.accessKeyId && this.config.secretAccessKey
            ? {
                accessKeyId: this.config.accessKeyId,
                secretAccessKey: this.config.secretAccessKey,
              }
            : undefined,
        endpoint: this.config.endpoint,
      });

      // Test connection by listing objects
      const ListObjectsV2Command = s3Module.ListObjectsV2Command;
      await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1,
        })
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize S3 storage: ${error instanceof Error ? error.message : error}. Make sure to install: npm install @aws-sdk/client-s3`
      );
    }
  }

  async close(): Promise<void> {
    // S3 client doesn't need explicit closing
  }

  async save(key: string, data: T, options?: SaveOptions): Promise<void> {
    if (!this.s3Client) throw new Error("S3 not initialized");

    const s3Module = await import("@aws-sdk/client-s3");
    const PutObjectCommand = s3Module.PutObjectCommand;

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
    if (!this.s3Client) throw new Error("S3 not initialized");

    try {
      const s3Module = await import("@aws-sdk/client-s3");
      const GetObjectCommand = s3Module.GetObjectCommand;

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
    if (!this.s3Client) throw new Error("S3 not initialized");

    try {
      const s3Module = await import("@aws-sdk/client-s3");
      const DeleteObjectCommand = s3Module.DeleteObjectCommand;

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
    if (!this.s3Client) throw new Error("S3 not initialized");

    try {
      const s3Module = await import("@aws-sdk/client-s3");
      const HeadObjectCommand = s3Module.HeadObjectCommand;

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
    // S3 doesn't have native batch operations, so we'll do them in parallel
    const promises = keys.map((key) => this.get(key));
    return await Promise.all(promises);
  }

  async deleteBatch(keys: string[]): Promise<number> {
    // S3 doesn't have native batch operations, so we'll do them in parallel
    const promises = keys.map((key) => this.delete(key));
    const results = await Promise.all(promises);
    return results.filter(Boolean).length;
  }

  async find(filter: FilterOptions): Promise<T[]> {
    if (!this.s3Client) throw new Error("S3 not initialized");

    const s3Module = await import("@aws-sdk/client-s3");
    const ListObjectsV2Command = s3Module.ListObjectsV2Command;

    const results: T[] = [];
    let continuationToken: string | undefined;
    let itemCount = 0;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keyPrefix,
          MaxKeys: filter.limit || 1000,
          ContinuationToken: continuationToken,
        })
      );

      if (!response.Contents) break;

      for (const object of response.Contents) {
        if (filter.offset && itemCount < filter.offset) {
          itemCount++;
          continue;
        }

        if (filter.limit && results.length >= filter.limit) {
          break;
        }

        const key = this.stripPrefix(object.Key || "");
        const data = await this.get(key);

        if (data !== null) {
          // Apply filters
          let includeItem = true;

          if (filter.createdAfter && object.LastModified) {
            if (object.LastModified <= filter.createdAfter) {
              includeItem = false;
            }
          }

          if (filter.createdBefore && object.LastModified) {
            if (object.LastModified >= filter.createdBefore) {
              includeItem = false;
            }
          }

          if (includeItem && this.matchesFilter(data, object, filter)) {
            results.push(data);
          }
        }

        itemCount++;
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken && (!filter.limit || results.length < filter.limit));

    return results;
  }

  async count(filter?: FilterOptions): Promise<number> {
    if (!this.s3Client) throw new Error("S3 not initialized");

    const s3Module = await import("@aws-sdk/client-s3");
    const ListObjectsV2Command = s3Module.ListObjectsV2Command;

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
        // Apply basic filters
        let includeItem = true;

        if (filter?.createdAfter && object.LastModified) {
          if (object.LastModified <= filter.createdAfter) {
            includeItem = false;
          }
        }

        if (filter?.createdBefore && object.LastModified) {
          if (object.LastModified >= filter.createdBefore) {
            includeItem = false;
          }
        }

        if (includeItem) {
          count++;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return count;
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    if (!this.s3Client) throw new Error("S3 not initialized");

    const s3Module = await import("@aws-sdk/client-s3");
    const ListObjectsV2Command = s3Module.ListObjectsV2Command;

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
        let shouldDelete = false;

        if (options?.expiredOnly) {
          // Check metadata for expiration
          const key = this.stripPrefix(object.Key || "");
          try {
            const data = await this.get(key);
            if (data === null) {
              shouldDelete = true; // Already expired/deleted
            }
          } catch (error) {
            shouldDelete = true; // Error accessing, consider for deletion
          }
        } else if (options?.olderThan && object.LastModified) {
          if (object.LastModified < options.olderThan) {
            shouldDelete = true;
          }
        } else if (!options?.expiredOnly) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          keysToDelete.push(this.stripPrefix(object.Key || ""));
        }
      }

      if (keysToDelete.length > 0 && !options?.dryRun) {
        const deleteResults = await this.deleteBatch(keysToDelete);
        deleted += deleteResults;
      } else if (options?.dryRun) {
        deleted += keysToDelete.length;
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return deleted;
  }

  async getStats(): Promise<StorageStats> {
    if (!this.s3Client) throw new Error("S3 not initialized");

    const s3Module = await import("@aws-sdk/client-s3");
    const ListObjectsV2Command = s3Module.ListObjectsV2Command;

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
    return `${this.keyPrefix}${key}`;
  }

  private stripPrefix(fullKey: string): string {
    return fullKey.startsWith(this.keyPrefix) ? fullKey.slice(this.keyPrefix.length) : fullKey;
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
    // Basic filtering - could be extended based on metadata
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
