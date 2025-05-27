import { FastifyInstance } from "fastify";
import { StorageType } from "../database/types.js";

export interface LoggedRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  error?: string;
  backendHost?: string;
  backendPath?: string;
  targetUrl?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface RequestLoggerConfig {
  enabled: boolean;
  storage: {
    type: StorageType;
    path?: string;
  };
  maxLogs: number;
  retentionDays: number;
  logLevel: string;
  logFormat: string;
  logFile?: string;
  logConsole: boolean;
  logFileRotation: boolean;
  logFileMaxSize: number;
  logFileMaxFiles: number;
  logFileCompress: boolean;
  logFileDateFormat: string;
  logFileDatePattern: string;
  logFileZippedArchive: boolean;
  logFileMaxSize: number;
  logFileMaxFiles: number;
  logFileCompress: boolean;
  logFileDateFormat: string;
  logFileDatePattern: string;
  logFileZippedArchive: boolean;
}

export class RequestLoggerService {
  private app: FastifyInstance;
  private config: RequestLoggerConfig;
  private logs: LoggedRequest[] = [];
  private _storage: any; // TODO: Add proper type

  constructor(app: FastifyInstance, config: RequestLoggerConfig) {
    this.app = app;
    this.config = config;
    this._storage = null; // Will be initialized in init()
  }

  async init(): Promise<void> {
    if (!this.config.enabled) return;

    // Initialize storage
    if (this.config.storage.type === StorageType.SQLITE) {
      // TODO: Initialize SQLite storage
    } else if (this.config.storage.type === StorageType.FILE) {
      // TODO: Initialize file storage
    }
  }

  async logRequest(request: LoggedRequest): Promise<void> {
    if (!this.config.enabled) return;

    this.logs.push(request);

    // Trim logs if exceeding maxLogs
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }

    // Save to storage
    if (this._storage) {
      await this._storage.save(request);
    }
  }

  async getLogs(): Promise<LoggedRequest[]> {
    if (!this.config.enabled) return [];

    return this.logs;
  }

  async clearLogs(): Promise<void> {
    if (!this.config.enabled) return;

    this.logs = [];
    if (this._storage) {
      await this._storage.clear();
    }
  }

  async getStats(): Promise<{
    total: number;
    errors: number;
    avgResponseTime: number;
  }> {
    if (!this.config.enabled) {
      return { total: 0, errors: 0, avgResponseTime: 0 };
    }

    const total = this.logs.length;
    const errors = this.logs.filter((log) => log.statusCode >= 400).length;
    const avgResponseTime =
      this.logs.reduce((sum, log) => sum + log.responseTime, 0) / total || 0;

    return { total, errors, avgResponseTime };
  }
}
