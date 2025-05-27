import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import Redis from "ioredis";
import { DatabaseAdapter } from "../../database/types.js";
import { ClusterRepository } from "./repository.js";
import {
  ClusterNode,
  NodeStatus,
  NodeRole,
  NodeRegistrationRequest,
  NodeHeartbeatRequest,
  NodeHealthStatus,
  ClusterHealthResponse,
  ClusterConfig,
  NodeCapabilities,
} from "./types.js";

export class ClusterService {
  private app: FastifyInstance;
  private config: ClusterConfig;
  private redis?: Redis;
  private repository?: ClusterRepository;
  private currentNodeId?: string;
  private heartbeatTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    app: FastifyInstance,
    config: ClusterConfig,
    dbAdapter?: DatabaseAdapter
  ) {
    this.app = app;
    this.config = config;

    // Initialize repository if using database storage
    if (this.config.storage.type === "sqlite" && dbAdapter) {
      this.repository = new ClusterRepository(dbAdapter);
    }
  }

  async initialize(): Promise<void> {
    this.app.log.info("Initializing cluster service...");

    // Initialize storage
    if (this.config.storage.type === "redis") {
      await this.initializeRedis();
    } else if (this.repository) {
      await this.repository.initialize();
    }

    // Auto-register this node if enabled
    if (this.config.autoRegister) {
      await this.autoRegisterNode();
    }

    // Start background tasks
    this.startHeartbeat();
    this.startHealthChecks();
    this.startCleanupTask();

    this.app.log.info("Cluster service initialized successfully");
  }

  private async initializeRedis(): Promise<void> {
    if (!this.config.storage.redis) {
      throw new Error(
        "Redis configuration is required when storage type is redis"
      );
    }

    this.redis = new Redis({
      host: this.config.storage.redis.host,
      port: this.config.storage.redis.port,
      password: this.config.storage.redis.password,
      db: this.config.storage.redis.db || 0,
      keyPrefix: this.config.storage.redis.keyPrefix || "cluster:",
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (error) => {
      this.app.log.error("Redis connection error:", error);
    });

    this.redis.on("connect", () => {
      this.app.log.info("Connected to Redis for cluster storage");
    });
  }

  private async autoRegisterNode(): Promise<void> {
    const nodeId = this.config.nodeId || randomUUID();
    const nodeUrl = `http://${this.app.config.host}:${this.app.config.port}`;

    const registrationData: NodeRegistrationRequest = {
      id: nodeId,
      url: nodeUrl,
      clusterId: this.config.clusterId,
      tags: this.config.tags,
      capabilities: this.config.defaultCapabilities,
      role: this.config.defaultRole,
      metadata: {
        ...this.config.metadata,
        autoRegistered: true,
        startedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    const node = await this.registerNode(registrationData);
    this.currentNodeId = node.id;
    this.app.log.info(`Auto-registered node: ${node.id} at ${node.url}`);
  }

  async registerNode(data: NodeRegistrationRequest): Promise<ClusterNode> {
    const nodeId = data.id || randomUUID();
    const now = new Date().toISOString();

    const node: ClusterNode = {
      id: nodeId,
      url: data.url,
      clusterId: data.clusterId,
      tags: data.tags || [],
      capabilities: data.capabilities || {},
      status: NodeStatus.ACTIVE,
      role: data.role || NodeRole.DEFAULT,
      lastSeen: now,
      createdAt: now,
      metadata: data.metadata,
      version: data.version,
      region: data.region,
      zone: data.zone,
    };

    if (this.redis) {
      await this.redis.hset("nodes", nodeId, JSON.stringify(node));
    } else if (this.repository) {
      await this.repository.saveNode(node);
    }

    this.app.log.info(`Registered node: ${nodeId}`);
    return node;
  }

  async updateHeartbeat(
    nodeId: string,
    data: NodeHeartbeatRequest
  ): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const now = new Date().toISOString();
    const updatedNode: ClusterNode = {
      ...node,
      status: data.status || node.status,
      lastSeen: now,
      metadata: { ...node.metadata, ...data.metadata },
      capabilities: { ...node.capabilities, ...data.capabilities },
    };

    if (this.redis) {
      await this.redis.hset("nodes", nodeId, JSON.stringify(updatedNode));
    } else if (this.repository) {
      await this.repository.updateNodeHeartbeat(
        nodeId,
        updatedNode.status,
        updatedNode.lastSeen,
        updatedNode.metadata || {},
        updatedNode.capabilities
      );
    }
  }

  async getNode(nodeId: string): Promise<ClusterNode | null> {
    if (this.redis) {
      const nodeData = await this.redis.hget("nodes", nodeId);
      return nodeData ? JSON.parse(nodeData) : null;
    } else if (this.repository) {
      return await this.repository.getNode(nodeId);
    }
    return null;
  }

  async getAllNodes(): Promise<ClusterNode[]> {
    if (this.redis) {
      const nodesData = await this.redis.hgetall("nodes");
      return Object.values(nodesData).map((data) => JSON.parse(data));
    } else if (this.repository) {
      return await this.repository.getAllNodes();
    }
    return [];
  }

  async getNodesByCluster(clusterId: string): Promise<ClusterNode[]> {
    if (this.repository) {
      return await this.repository.getNodesByCluster(clusterId);
    }

    // Fallback for Redis
    const allNodes = await this.getAllNodes();
    return allNodes.filter((node) => node.clusterId === clusterId);
  }

  async getNodesByStatus(status: NodeStatus): Promise<ClusterNode[]> {
    if (this.repository) {
      return await this.repository.getNodesByStatus(status);
    }

    // Fallback for Redis
    const allNodes = await this.getAllNodes();
    return allNodes.filter((node) => node.status === status);
  }

  async updateNodeStatus(nodeId: string, status: NodeStatus): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const now = new Date().toISOString();
    const updatedNode: ClusterNode = {
      ...node,
      status,
      lastSeen: now,
    };

    if (this.redis) {
      await this.redis.hset("nodes", nodeId, JSON.stringify(updatedNode));
    } else if (this.repository) {
      await this.repository.updateNodeStatus(nodeId, status, now);
    }

    this.app.log.info(`Updated node ${nodeId} status to ${status}`);
  }

  async removeNode(nodeId: string): Promise<void> {
    if (this.redis) {
      await this.redis.hdel("nodes", nodeId);
    } else if (this.repository) {
      await this.repository.removeNode(nodeId);
    }

    this.app.log.info(`Removed node: ${nodeId}`);
  }

  async getClusterHealth(): Promise<ClusterHealthResponse> {
    const nodes = await this.getAllNodes();
    const now = new Date();
    const timeoutMs = this.config.nodeTimeout * 1000;

    const nodeHealthStatuses: NodeHealthStatus[] = [];
    let activeNodes = 0;
    let inactiveNodes = 0;
    let disabledNodes = 0;
    let unhealthyNodes = 0;

    for (const node of nodes) {
      const lastSeenTime = new Date(node.lastSeen);
      const timeSinceLastSeen = now.getTime() - lastSeenTime.getTime();

      let effectiveStatus = node.status;

      // Mark as inactive if haven't heard from node in timeout period
      if (
        effectiveStatus === NodeStatus.ACTIVE &&
        timeSinceLastSeen > timeoutMs
      ) {
        effectiveStatus = NodeStatus.INACTIVE;
        // Update the node status in storage
        await this.updateNodeStatus(node.id, NodeStatus.INACTIVE);
      }

      const healthStatus: NodeHealthStatus = {
        nodeId: node.id,
        status: effectiveStatus,
        lastSeen: node.lastSeen,
        uptime: node.metadata?.uptime,
        memoryUsage: node.metadata?.memoryUsage,
        cpuUsage: node.metadata?.cpuUsage,
        activeConnections: node.metadata?.activeConnections,
        requestsPerSecond: node.metadata?.requestsPerSecond,
        errorRate: node.metadata?.errorRate,
      };

      nodeHealthStatuses.push(healthStatus);

      // Count nodes by status
      switch (effectiveStatus) {
        case NodeStatus.ACTIVE:
          activeNodes++;
          break;
        case NodeStatus.INACTIVE:
          inactiveNodes++;
          break;
        case NodeStatus.DISABLED:
          disabledNodes++;
          break;
        case NodeStatus.UNHEALTHY:
          unhealthyNodes++;
          break;
      }
    }

    return {
      totalNodes: nodes.length,
      activeNodes,
      inactiveNodes,
      disabledNodes,
      unhealthyNodes,
      nodes: nodeHealthStatuses,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCurrentNodeStatus(): Promise<NodeHealthStatus | null> {
    if (!this.currentNodeId) {
      return null;
    }

    const node = await this.getNode(this.currentNodeId);
    if (!node) {
      return null;
    }

    // Get current system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      nodeId: node.id,
      status: node.status,
      lastSeen: node.lastSeen,
      uptime,
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpuUsage: node.metadata?.cpuUsage,
      activeConnections: node.metadata?.activeConnections,
      requestsPerSecond: node.metadata?.requestsPerSecond,
      errorRate: node.metadata?.errorRate,
    };
  }

  private startHeartbeat(): void {
    if (!this.currentNodeId || this.config.heartbeatInterval <= 0) {
      return;
    }

    this.heartbeatTimer = setInterval(async () => {
      try {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        await this.updateHeartbeat(this.currentNodeId!, {
          status: NodeStatus.ACTIVE,
          metadata: {
            uptime,
            memoryUsage: {
              used: memoryUsage.heapUsed,
              total: memoryUsage.heapTotal,
              percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            },
            lastHeartbeat: new Date().toISOString(),
          },
        });
      } catch (error) {
        this.app.log.error("Failed to send heartbeat:", error);
      }
    }, this.config.heartbeatInterval * 1000);

    this.app.log.info(
      `Started heartbeat with interval: ${this.config.heartbeatInterval}s`
    );
  }

  private startHealthChecks(): void {
    if (this.config.healthCheckInterval <= 0) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.app.log.error("Failed to perform health checks:", error);
      }
    }, this.config.healthCheckInterval * 1000);

    this.app.log.info(
      `Started health checks with interval: ${this.config.healthCheckInterval}s`
    );
  }

  private startCleanupTask(): void {
    // Clean up inactive nodes every 5 minutes
    this.cleanupTimer = setInterval(
      async () => {
        try {
          await this.cleanupInactiveNodes();
        } catch (error) {
          this.app.log.error("Failed to cleanup inactive nodes:", error);
        }
      },
      5 * 60 * 1000
    );

    this.app.log.info("Started cleanup task for inactive nodes");
  }

  private async performHealthChecks(): Promise<void> {
    const nodes = await this.getAllNodes();
    const now = new Date();
    const timeoutMs = this.config.nodeTimeout * 1000;

    for (const node of nodes) {
      if (node.status === NodeStatus.DISABLED) {
        continue; // Skip disabled nodes
      }

      const lastSeenTime = new Date(node.lastSeen);
      const timeSinceLastSeen = now.getTime() - lastSeenTime.getTime();

      if (timeSinceLastSeen > timeoutMs && node.status === NodeStatus.ACTIVE) {
        await this.updateNodeStatus(node.id, NodeStatus.INACTIVE);
        this.app.log.warn(
          `Marked node ${node.id} as inactive (last seen: ${node.lastSeen})`
        );
      }
    }
  }

  private async cleanupInactiveNodes(): Promise<void> {
    const now = new Date();
    const cleanupThresholdMs = this.config.nodeTimeout * 1000 * 10; // 10x timeout period
    const cleanupThreshold = new Date(
      now.getTime() - cleanupThresholdMs
    ).toISOString();

    let cleanedCount = 0;

    if (this.repository) {
      // Use repository method for efficient cleanup
      cleanedCount =
        await this.repository.cleanupInactiveNodes(cleanupThreshold);
    } else {
      // Fallback for Redis
      const nodes = await this.getAllNodes();
      for (const node of nodes) {
        if (node.status === NodeStatus.INACTIVE) {
          const lastSeenTime = new Date(node.lastSeen);
          const timeSinceLastSeen = now.getTime() - lastSeenTime.getTime();

          if (timeSinceLastSeen > cleanupThresholdMs) {
            await this.removeNode(node.id);
            cleanedCount++;
          }
        }
      }
    }

    if (cleanedCount > 0) {
      this.app.log.info(`Cleaned up ${cleanedCount} inactive nodes`);
    }
  }

  async shutdown(): Promise<void> {
    this.app.log.info("Shutting down cluster service...");

    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Mark current node as inactive
    if (this.currentNodeId) {
      try {
        await this.updateNodeStatus(this.currentNodeId, NodeStatus.INACTIVE);
      } catch (error) {
        this.app.log.error(
          "Failed to mark node as inactive during shutdown:",
          error
        );
      }
    }

    // Close connections
    if (this.redis) {
      this.redis.disconnect();
    }

    this.app.log.info("Cluster service shutdown complete");
  }

  getCurrentNodeId(): string | undefined {
    return this.currentNodeId;
  }

  getConfig(): ClusterConfig {
    return { ...this.config };
  }
}
