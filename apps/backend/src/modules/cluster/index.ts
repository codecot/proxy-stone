import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { NodeStatus, NodeRole, ClusterConfig } from "./types.js";

// Simple working cluster service
class WorkingClusterService {
  private enabled: boolean = true;
  private serving: boolean = true; // New: controls if cluster answers requests
  private clusterId: string = "default-cluster";
  private nodes: Map<string, any> = new Map();
  private currentNodeId?: string;
  private nodeUrl?: string;
  private heartbeatInterval?: NodeJS.Timeout;
  private heartbeatIntervalMs: number = 10000; // 10 seconds for testing

  constructor(config: Partial<ClusterConfig> = {}, nodeUrl?: string) {
    this.enabled = config.enabled !== false;
    this.serving = true; // Default to serving requests
    this.clusterId = config.clusterId || "default-cluster";
    this.nodeUrl = nodeUrl;
    this.heartbeatIntervalMs = (config.heartbeatInterval || 10) * 1000;
  }

  async initialize(): Promise<void> {
    console.log("Cluster service initialized");

    // Auto-register this node
    this.currentNodeId = randomUUID();
    const node = {
      id: this.currentNodeId,
      url: this.nodeUrl || "http://localhost:4000", // Fallback to default port
      clusterId: this.clusterId,
      status: NodeStatus.ACTIVE,
      role: NodeRole.WORKER,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      tags: [],
      capabilities: {},
      metadata: {
        autoRegistered: true,
        nodeVersion: process.version,
        platform: process.platform,
        startTime: new Date().toISOString(),
      },
    };
    this.nodes.set(this.currentNodeId, node);

    // Start heartbeat mechanism
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (!this.currentNodeId) {
      console.warn("Cannot start heartbeat: no current node ID");
      return;
    }

    console.log(
      `Starting heartbeat with interval: ${this.heartbeatIntervalMs}ms`
    );

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    }, this.heartbeatIntervalMs);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.currentNodeId) {
      return;
    }

    // Collect current node health metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const healthMetadata = {
      uptime,
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round(
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        ),
      },
      cpuUsage: 0, // Could implement actual CPU monitoring
      activeConnections: 0, // Could track active connections
      requestsPerSecond: 0, // Could track RPS
      errorRate: 0, // Could track error rate
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      // Add serving status to heartbeat
      serving: this.serving,
      serviceMode: this.getServiceStatus().mode,
    };

    // Update this node's heartbeat with current serving status
    const nodeStatus =
      this.enabled && this.serving ? NodeStatus.ACTIVE : NodeStatus.DISABLED;
    await this.updateHeartbeat(this.currentNodeId, {
      status: nodeStatus,
      metadata: healthMetadata,
    });

    console.log(
      `Heartbeat sent for node ${this.currentNodeId.substring(0, 8)}... (${this.getServiceStatus().mode})`
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      console.log("Heartbeat stopped");
    }
  }

  async registerNode(data: any): Promise<any> {
    const node = {
      id: data.id || randomUUID(),
      url: data.url,
      clusterId: data.clusterId || this.clusterId,
      status: NodeStatus.ACTIVE,
      role: data.role || NodeRole.WORKER,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      tags: data.tags || [],
      capabilities: data.capabilities || {},
      metadata: data.metadata || {},
      version: data.version,
      region: data.region,
      zone: data.zone,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  async updateHeartbeat(nodeId: string, data: any): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.lastSeen = new Date().toISOString();
    node.status = data.status || node.status;
    if (data.metadata) {
      node.metadata = { ...node.metadata, ...data.metadata };
    }
    if (data.capabilities) {
      node.capabilities = { ...node.capabilities, ...data.capabilities };
    }
    this.nodes.set(nodeId, node);
  }

  async getAllNodes(): Promise<any[]> {
    return Array.from(this.nodes.values());
  }

  async getNode(nodeId: string): Promise<any | null> {
    return this.nodes.get(nodeId) || null;
  }

  async getNodesByCluster(clusterId: string): Promise<any[]> {
    return Array.from(this.nodes.values()).filter(
      (node) => node.clusterId === clusterId
    );
  }

  async getNodesByStatus(status: NodeStatus): Promise<any[]> {
    return Array.from(this.nodes.values()).filter(
      (node) => node.status === status
    );
  }

  async updateNodeStatus(nodeId: string, status: NodeStatus): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    node.status = status;
    node.lastSeen = new Date().toISOString();
    this.nodes.set(nodeId, node);
  }

  async removeNode(nodeId: string): Promise<void> {
    this.nodes.delete(nodeId);
  }

  async getClusterHealth(): Promise<any> {
    const nodes = Array.from(this.nodes.values());
    const activeNodes = nodes.filter((n) => n.status === NodeStatus.ACTIVE);
    const inactiveNodes = nodes.filter((n) => n.status === NodeStatus.INACTIVE);
    const disabledNodes = nodes.filter((n) => n.status === NodeStatus.DISABLED);
    const unhealthyNodes = nodes.filter(
      (n) => n.status === NodeStatus.UNHEALTHY
    );

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
        memoryUsage: node.metadata?.memoryUsage || {
          used: 0,
          total: 0,
          percentage: 0,
        },
        cpuUsage: node.metadata?.cpuUsage || 0,
        activeConnections: node.metadata?.activeConnections || 0,
        requestsPerSecond: node.metadata?.requestsPerSecond || 0,
        errorRate: node.metadata?.errorRate || 0,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCurrentNodeStatus(): Promise<any> {
    if (!this.currentNodeId) {
      return null;
    }

    const node = this.nodes.get(this.currentNodeId);
    if (!node) {
      return null;
    }

    // Return the stored node data (which gets updated by heartbeats)
    return {
      nodeId: node.id,
      status: node.status,
      lastSeen: node.lastSeen,
      uptime: node.metadata?.uptime || process.uptime(),
      memoryUsage: node.metadata?.memoryUsage || {
        used: 0,
        total: 0,
        percentage: 0,
      },
      cpuUsage: node.metadata?.cpuUsage || 0,
      activeConnections: node.metadata?.activeConnections || 0,
      requestsPerSecond: node.metadata?.requestsPerSecond || 0,
      errorRate: node.metadata?.errorRate || 0,
    };
  }

  getCurrentNodeId(): string | undefined {
    return this.currentNodeId;
  }

  getConfig(): any {
    return {
      enabled: this.enabled,
      clusterId: this.clusterId,
      heartbeatInterval: 10,
      nodeTimeout: 60,
      healthCheckInterval: 10,
      autoRegister: true,
      defaultRole: NodeRole.WORKER,
      tags: [],
    };
  }

  async shutdown(): Promise<void> {
    console.log("Shutting down cluster service...");

    // Stop heartbeat first
    this.stopHeartbeat();

    // Mark current node as inactive
    if (this.currentNodeId) {
      await this.updateNodeStatus(this.currentNodeId, NodeStatus.INACTIVE);
    }

    console.log("Cluster service shutdown complete");
  }

  // New control methods
  async enableCluster(): Promise<void> {
    if (this.enabled) {
      console.log("Cluster service is already enabled");
      return;
    }

    this.enabled = true;
    console.log("Enabling cluster service...");

    // Re-initialize the current node if it doesn't exist
    if (!this.currentNodeId) {
      await this.initialize();
    } else {
      // Just restart heartbeat if node exists
      this.startHeartbeat();
      // Mark node as active
      await this.updateNodeStatus(this.currentNodeId, NodeStatus.ACTIVE);
    }

    console.log("Cluster service enabled successfully");
  }

  async disableCluster(): Promise<void> {
    if (!this.enabled) {
      console.log("Cluster service is already disabled");
      return;
    }

    console.log("Disabling cluster service...");
    this.enabled = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Mark current node as inactive
    if (this.currentNodeId) {
      await this.updateNodeStatus(this.currentNodeId, NodeStatus.INACTIVE);
    }

    console.log("Cluster service disabled successfully");
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // New serving control methods
  async enableServing(): Promise<void> {
    if (this.serving) {
      console.log("Cluster service is already serving requests");
      return;
    }

    console.log("Enabling cluster request serving...");
    this.serving = true;

    // Update node status to active if cluster is enabled
    if (this.enabled && this.currentNodeId) {
      await this.updateNodeStatus(this.currentNodeId, NodeStatus.ACTIVE);
    }

    console.log("Cluster service now serving requests");
  }

  async disableServing(): Promise<void> {
    if (!this.serving) {
      console.log("Cluster service is already not serving requests");
      return;
    }

    console.log("Disabling cluster request serving (maintenance mode)...");
    this.serving = false;

    // Update node status to indicate maintenance mode
    if (this.enabled && this.currentNodeId) {
      await this.updateNodeStatus(this.currentNodeId, NodeStatus.DISABLED);
    }

    console.log("Cluster service in maintenance mode (online but not serving)");
  }

  isServing(): boolean {
    return this.serving;
  }

  getServiceStatus(): { enabled: boolean; serving: boolean; mode: string } {
    let mode = "offline";
    if (this.enabled && this.serving) mode = "serving";
    else if (this.enabled && !this.serving) mode = "maintenance";

    return {
      enabled: this.enabled,
      serving: this.serving,
      mode,
    };
  }
}

export const registerCluster = async (fastify: FastifyInstance) => {
  // Get cluster configuration from server config, with defaults
  const clusterConfig = fastify.config.cluster || {};

  // Only initialize cluster service if enabled (default to enabled if not specified)
  if ("enabled" in clusterConfig && clusterConfig.enabled === false) {
    fastify.log.info("Cluster service is disabled");
    return;
  }

  try {
    // Construct the node URL from fastify configuration
    const protocol = "http"; // Default to http since https is not in ServerConfig
    const host =
      fastify.config.host === "0.0.0.0" ? "localhost" : fastify.config.host;
    const port = fastify.config.port;
    const nodeUrl = `${protocol}://${host}:${port}`;

    // Initialize working cluster service
    const clusterService = new WorkingClusterService(clusterConfig, nodeUrl);
    await clusterService.initialize();

    // Decorate fastify instance with cluster service
    fastify.decorate("cluster", clusterService);

    // Register basic cluster routes
    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.get("/cluster/status", async (request, reply) => {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const status = await fastify.cluster.getCurrentNodeStatus();
        const config = fastify.cluster.getConfig();
        const serviceStatus = fastify.cluster.getServiceStatus();

        return reply.send({
          success: true,
          status,
          config,
          serviceStatus,
        });
      });

      fastify.get("/cluster/nodes", async (request, reply) => {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const nodes = await fastify.cluster.getAllNodes();
        return reply.send({
          success: true,
          nodes,
          total: nodes.length,
        });
      });

      fastify.get("/cluster/health", async (request, reply) => {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const health = await fastify.cluster.getClusterHealth();
        return reply.send({
          success: true,
          health,
        });
      });

      // New serving control endpoints
      fastify.post("/cluster/enable-serving", async (request, reply) => {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        await fastify.cluster.enableServing();
        const status = fastify.cluster.getServiceStatus();

        return reply.send({
          success: true,
          message: "Cluster serving enabled",
          status,
        });
      });

      fastify.post("/cluster/disable-serving", async (request, reply) => {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        await fastify.cluster.disableServing();
        const status = fastify.cluster.getServiceStatus();

        return reply.send({
          success: true,
          message: "Cluster serving disabled (maintenance mode)",
          status,
        });
      });

      fastify.get("/cluster/service-status", async (request, reply) => {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const status = fastify.cluster.getServiceStatus();
        const nodeStatus = await fastify.cluster.getCurrentNodeStatus();

        return reply.send({
          success: true,
          status,
          nodeStatus,
        });
      });
    });

    // Setup graceful shutdown
    fastify.addHook("onClose", async () => {
      try {
        await clusterService.shutdown();
      } catch (error) {
        fastify.log.error("Failed to shutdown cluster service:", error);
      }
    });

    fastify.log.info(
      `Cluster service initialized with ID: ${clusterService.getConfig().clusterId}`
    );
  } catch (error) {
    fastify.log.error("Failed to initialize cluster service:", error);
    throw error;
  }
};
