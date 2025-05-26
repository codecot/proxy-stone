import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  StorageAdapter,
  StorageConfig,
  SaveOptions,
  FilterOptions,
  CleanupOptions,
  StorageStats,
} from "@proxy-stone/backend";

export interface S3StorageConfig extends StorageConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  keyPrefix?: string;
  serverSideEncryption?: string;
  storageClass?: string;
}

interface S3ObjectMetadata {
  data: string;
  metadata: any;
  createdAt: string;
  expiresAt?: string;
}

export class S3StorageAdapter<T> implements StorageAdapter<T> {
  private client: S3Client;
  private bucket: string;
  private keyPrefix: string;

  constructor(private config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix || "proxy-stone/";

    const clientConfig: S3ClientConfig = {
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = config.forcePathStyle ?? true;
    }

    this.client = new S3Client(clientConfig);
  }

  private getKey(id: string): string {
    return `${this.keyPrefix}${id}.json`;
  }

  async save(id: string, data: T, options?: SaveOptions): Promise<void> {
    const key = this.getKey(id);
    const now = new Date().toISOString();
    const expiresAt = options?.ttl
      ? new Date(Date.now() + options.ttl * 1000).toISOString()
      : undefined;

    const objectData: S3ObjectMetadata = {
      data: JSON.stringify(data),
      metadata: options?.metadata || {},
      createdAt: now,
      ...(expiresAt && { expiresAt }),
    };

    const putParams: any = {
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(objectData),
      ContentType: "application/json",
      Metadata: {
        "proxy-stone-id": id,
        "proxy-stone-created": now,
        ...(expiresAt && { "proxy-stone-expires": expiresAt }),
      },
    };

    if (this.config.serverSideEncryption) {
      putParams.ServerSideEncryption = this.config.serverSideEncryption;
    }

    if (this.config.storageClass) {
      putParams.StorageClass = this.config.storageClass;
    }

    const upload = new Upload({
      client: this.client,
      params: putParams,
    });

    await upload.done();
  }

  async load(id: string): Promise<T | null> {
    const key = this.getKey(id);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      const bodyString = await response.Body.transformToString();
      const objectData: S3ObjectMetadata = JSON.parse(bodyString);

      // Check if expired
      if (
        objectData.expiresAt &&
        new Date(objectData.expiresAt) <= new Date()
      ) {
        // Optionally delete expired object
        await this.delete(id);
        return null;
      }

      return JSON.parse(objectData.data);
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const key = this.getKey(id);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const key = this.getKey(id);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      // Check if expired based on metadata
      const expiresAt = response.Metadata?.["proxy-stone-expires"];
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        // Optionally delete expired object
        await this.delete(id);
        return false;
      }

      return true;
    } catch (error: any) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }

  async list(options?: FilterOptions): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: this.keyPrefix,
      MaxKeys: options?.limit || 1000,
    });

    const response = await this.client.send(command);
    const objects = response.Contents || [];

    let ids = objects
      .map((obj) => {
        if (!obj.Key) return null;
        const key = obj.Key.replace(this.keyPrefix, "").replace(".json", "");
        return key;
      })
      .filter((key): key is string => key !== null);

    // Apply pattern filtering
    if (options?.pattern) {
      const regex = new RegExp(
        options.pattern.replace(/\*/g, ".*").replace(/\?/g, "."),
        "i"
      );
      ids = ids.filter((id) => regex.test(id));
    }

    // Apply offset
    if (options?.offset) {
      ids = ids.slice(options.offset);
    }

    // Apply limit
    if (options?.limit) {
      ids = ids.slice(0, options.limit);
    }

    return ids;
  }

  async cleanup(options?: CleanupOptions): Promise<number> {
    let deletedCount = 0;
    const allIds = await this.list();

    for (const id of allIds) {
      try {
        const key = this.getKey(id);
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });

        const response = await this.client.send(command);
        const expiresAt = response.Metadata?.["proxy-stone-expires"];
        const createdAt = response.Metadata?.["proxy-stone-created"];

        let shouldDelete = false;

        // Check if expired
        if (expiresAt && new Date(expiresAt) <= new Date()) {
          shouldDelete = true;
        }

        // Check if too old
        if (options?.maxAge && createdAt) {
          const cutoffDate = new Date(Date.now() - options.maxAge * 1000);
          if (new Date(createdAt) < cutoffDate) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          await this.delete(id);
          deletedCount++;
        }
      } catch (error) {
        // Skip errors for individual objects
        console.warn(`Failed to cleanup object ${id}:`, error);
      }
    }

    return deletedCount;
  }

  async getStats(): Promise<StorageStats> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: this.keyPrefix,
    });

    let totalItems = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      if (continuationToken) {
        command.input.ContinuationToken = continuationToken;
      }

      const response = await this.client.send(command);
      const objects = response.Contents || [];

      totalItems += objects.length;
      totalSize += objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      totalItems,
      totalSize,
      lastCleanup: new Date(),
    };
  }

  async close(): Promise<void> {
    // S3 client doesn't need explicit closing
  }
}
