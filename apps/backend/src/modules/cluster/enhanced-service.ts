import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import axios from "axios";
import { ClusterConfig, NodeStatus, NodeRole, NodeRegistrationRequest, NodeHeartbeatRequest } from "./types.js";

export class EnhancedClusterService {
  private app: FastifyInstance;
  private config: ClusterConfig;
  private currentNodeId?: string;
  private currentNodeUrl?: string;
  private isCoordinator: boolean = false;
  private nodes: Map<string, any> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(app: FastifyInstance, config: ClusterConfig) {
    this.app = app;
    this.config = {
      heartbeatInterval: 30,
      nodeTimeout: 60,
      healthCheckInterval: 10,
      autoRegister: true,
      defaultRole: NodeRole.WORKER,
      tags: [],
      storage: { type: "memory" },
      ...config,
    };

    // Determine if this node should be a coordinator
    this.isCoordinator = !this.config.coordinatorUrl;
    
    // Build this node's URL
    const protocol = "http";
    const host = this.app.config.host === "0.0.0.0" ? "localhost" : this.app.config.host;
    const port = this.app.config.port;
    this.currentNodeUrl = `${protocol}://${host}:${port}`;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.app.log.info("Cluster service is disabled");
      return;
    }

    this.app.log.info(`Initializing cluster service...`);
    this.app.log.info(`Mode: ${this.isCoordinator ? "Coordinator" : "Worker"}`);
    this.app.log.info(`Node URL: ${this.currentNodeUrl}`);
    
    if (!this.isCoordinator) {
      this.app.log.info(`Coordinator URL: ${this.config.coordinatorUrl}`);
    }

    // Generate node ID
    this.currentNodeId = this.config.nodeId || randomUUID();

    // Auto-register this node
    if (this.config.autoRegister) {
      await this.autoRegisterNode();
    }

    // Start background tasks
    this.startHeartbeat();
    this.startHealthChecks();
    this.startCleanupTask();

    this.app.log.info("Cluster service initialized successfully");
  }

  private async autoRegisterNode(): Promise<void> {
    const registrationData: NodeRegistrationRequest = {
      id: this.currentNodeId!,
      url: this.currentNodeUrl!,
      clusterId: this.config.clusterId!,
      tags: this.config.tags || [],
      capabilities: {},
      role: this.isCoordinator ? NodeRole.COORDINATOR : this.config.defaultRole!,
      metadata: {
        autoRegistered: true,
        startedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        coordinator: this.isCoordinator,
      },
    };

    try {
      const node = await this.registerNode(registrationData);
      this.app.log.info(
        `Auto-registered node: ${node.id.substring(0, 8)}... at ${node.url} (${this.isCoordinator ? "coordinator" : "worker"})`
      );
    } catch (error) {
      this.app.log.error("Failed to auto-register node:", error);
      throw error;
    }
  }

  async registerNode(data: NodeRegistrationRequest): Promise<any> {
    if (this.isCoordinator) {
      // This is the coordinator - register locally
      return this.registerNodeLocally(data);
    } else {
      // This is a worker - register with remote coordinator
      return this.registerNodeRemotely(data);
    }
  }

  private async registerNodeLocally(data: NodeRegistrationRequest): Promise<any> {
    const nodeId = data.id || randomUUID();
    const now = new Date().toISOString();

    const node = {
      id: nodeId,
      url: data.url,
      clusterId: data.clusterId,
      tags: data.tags || [],
      capabilities: data.capabilities || {},
      status: NodeStatus.ACTIVE,
      role: data.role || NodeRole.WORKER,
      lastSeen: now,
      createdAt: now,
      metadata: data.metadata || {},
      version: data.version,
      region: data.region,
      zone: data.zone,
    };

    this.nodes.set(nodeId, node);
    this.app.log.info(`Registered node locally: ${nodeId.substring(0, 8)}... at ${node.url}`);
    return node;
  }

  private async registerNodeRemotely(data: NodeRegistrationRequest): Promise<any> {
    if (!this.config.coordinatorUrl) {
      throw new Error("No coordinator URL configured for remote registration");
    }

    try {
      const response = await axios.post(
        `${this.config.coordinatorUrl}/api/cluster/register`,
        data,
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success && response.data.node) {
        this.app.log.info(
          `Registered with remote coordinator: ${response.data.node.id.substring(0, 8)}... at ${this.config.coordinatorUrl}`
        );
        return response.data.node;
      } else {
        throw new Error(`Registration failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new Error(`Cannot connect to cluster coordinator at ${this.config.coordinatorUrl}`);
        } else if (error.response) {
          throw new Error(`Registration failed: ${error.response.status} ${error.response.statusText}`);
        }
      }
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateHeartbeat(nodeId: string, data: NodeHeartbeatRequest): Promise<void> {
    if (this.isCoordinator) {
      // Update locally if we're the coordinator
      return this.updateHeartbeatLocally(nodeId, data);
    } else {
      // Send to remote coordinator
      return this.updateHeartbeatRemotely(nodeId, data);
    }
  }

  private async updateHeartbeatLocally(nodeId: string, data: NodeHeartbeatRequest): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const now = new Date().toISOString();
    node.lastSeen = now;
    node.status = data.status || node.status;
    if (data.metadata) {
      node.metadata = { ...node.metadata, ...data.metadata };
    }
    if (data.capabilities) {
      node.capabilities = { ...node.capabilities, ...data.capabilities };
    }
    this.nodes.set(nodeId, node);
  }

  private async updateHeartbeatRemotely(nodeId: string, data: NodeHeartbeatRequest): Promise<void> {
    if (!this.config.coordinatorUrl) {
      return; // Silent fail if no coordinator
    }

    try {
      await axios.post(
        `${this.config.coordinatorUrl}/api/cluster/heartbeat/${nodeId}`,
        data,
        {
          timeout: 3000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      // Log heartbeat failures but don't throw - allow local operation to continue
      this.app.log.warn(`Failed to send heartbeat to coordinator: ${error instanceof Error ? error.message : error}`);
    }
  }

  private startHeartbeat(): void {
    if (!this.currentNodeId || !this.config.heartbeatInterval || this.config.heartbeatInterval <= 0) {
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
            coordinator: this.isCoordinator,
          },
        });
      } catch (error) {
        this.app.log.error("Failed to send heartbeat:", error);
      }
    }, (this.config.heartbeatInterval || 30) * 1000);

    this.app.log.info(
      `Started heartbeat with interval: ${this.config.heartbeatInterval || 30}s`
    );
  }

  private startHealthChecks(): void {
    if (!this.isCoordinator || !this.config.healthCheckInterval || this.config.healthCheckInterval <= 0) {
      return; // Only coordinators perform health checks
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.app.log.error("Failed to perform health checks:", error);
      }
    }, (this.config.healthCheckInterval || 10) * 1000);

    this.app.log.info(
      `Started health checks with interval: ${this.config.healthCheckInterval || 10}s`
    );
  }

  private startCleanupTask(): void {
    if (!this.isCoordinator) {
      return; // Only coordinators perform cleanup
    }

    this.cleanupTimer = setInterval(
      async () => {
        try {
          await this.cleanupInactiveNodes();
        } catch (error) {
          this.app.log.error("Failed to cleanup inactive nodes:", error);
        }
      },
      5 * 60 * 1000 // Every 5 minutes
    );

    this.app.log.info("Started cleanup task for inactive nodes");
  }

  private async performHealthChecks(): Promise<void> {
    const nodes = Array.from(this.nodes.values());
    const now = new Date();
    const timeoutMs = (this.config.nodeTimeout || 60) * 1000;

    for (const node of nodes) {
      if (node.status === NodeStatus.DISABLED) {
        continue; // Skip disabled nodes
      }

      const lastSeenTime = new Date(node.lastSeen);
      const timeSinceLastSeen = now.getTime() - lastSeenTime.getTime();

      if (timeSinceLastSeen > timeoutMs && node.status === NodeStatus.ACTIVE) {
        await this.updateNodeStatus(node.id, NodeStatus.INACTIVE);
        this.app.log.warn(
          `Marked node ${node.id.substring(0, 8)}... as inactive (last seen: ${node.lastSeen})`
        );
      }
    }
  }

  private async cleanupInactiveNodes(): Promise<void> {
    const now = new Date();
    const cleanupThresholdMs = (this.config.nodeTimeout || 60) * 1000 * 10; // 10x timeout period
    let cleanedCount = 0;

    const nodes = Array.from(this.nodes.values());
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

    if (cleanedCount > 0) {
      this.app.log.info(`Cleaned up ${cleanedCount} inactive nodes`);
    }
  }

  // Coordinator-only methods (these will fail gracefully on worker nodes)
  async getAllNodes(): Promise<any[]> {
    if (this.isCoordinator) {
      return Array.from(this.nodes.values());
    } else {
      // Worker nodes don't have access to all nodes
      return this.currentNodeId ? [await this.getCurrentNodeInfo()] : [];
    }
  }

  async getNode(nodeId: string): Promise<any | null> {
    if (this.isCoordinator) {
      return this.nodes.get(nodeId) || null;
    } else {
      // Worker can only return info about itself
      return nodeId === this.currentNodeId ? await this.getCurrentNodeInfo() : null;
    }
  }

  async updateNodeStatus(nodeId: string, status: NodeStatus): Promise<void> {
    if (this.isCoordinator) {
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }
      node.status = status;
      node.lastSeen = new Date().toISOString();
      this.nodes.set(nodeId, node);
      this.app.log.info(`Updated node ${nodeId.substring(0, 8)}... status to ${status}`);
    } else {
      throw new Error("Only coordinators can update node status");
    }
  }

  async removeNode(nodeId: string): Promise<void> {
    if (this.isCoordinator) {
      this.nodes.delete(nodeId);
      this.app.log.info(`Removed node: ${nodeId.substring(0, 8)}...`);
    } else {
      throw new Error("Only coordinators can remove nodes");
    }
  }

  async getClusterHealth(): Promise<any> {
    if (!this.isCoordinator) {
      throw new Error("Only coordinators can provide cluster health");
    }

    const nodes = Array.from(this.nodes.values());
    const activeNodes = nodes.filter((n) => n.status === NodeStatus.ACTIVE);
    const inactiveNodes = nodes.filter((n) => n.status === NodeStatus.INACTIVE);
    const disabledNodes = nodes.filter((n) => n.status === NodeStatus.DISABLED);
    const unhealthyNodes = nodes.filter((n) => n.status === NodeStatus.UNHEALTHY);

    return {
      totalNodes: nodes.length,
      activeNodes: activeNodes.length,
      inactiveNodes: inactiveNodes.length,
      disabledNodes: disabledNodes.length,
      unhealthyNodes: unhealthyNodes.length,
      nodes: nodes.map((node) => ({
        nodeId: node.id,
        status: node.status,
        lastSeen: node.lastSeen,
        uptime: node.metadata?.uptime || 0,
        memoryUsage: node.metadata?.memoryUsage || { used: 0, total: 0, percentage: 0 },
        cpuUsage: node.metadata?.cpuUsage || 0,
        activeConnections: node.metadata?.activeConnections || 0,
        requestsPerSecond: node.metadata?.requestsPerSecond || 0,
        errorRate: node.metadata?.errorRate || 0,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCurrentNodeStatus(): Promise<any> {
    return await this.getCurrentNodeInfo();
  }

  private async getCurrentNodeInfo(): Promise<any> {
    if (!this.currentNodeId) {
      return null;
    }

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      nodeId: this.currentNodeId,
      status: NodeStatus.ACTIVE,
      lastSeen: new Date().toISOString(),
      uptime,
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpuUsage: 0,
      activeConnections: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      coordinator: this.isCoordinator,
    };
  }

  getCurrentNodeId(): string | undefined {
    return this.currentNodeId;
  }

  getConfig(): ClusterConfig {
    return { ...this.config };
  }

  isClusterCoordinator(): boolean {
    return this.isCoordinator;
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
        this.app.log.error("Failed to mark node as inactive during shutdown:", error);
      }
    }

    this.app.log.info("Cluster service shutdown complete");
  }
}