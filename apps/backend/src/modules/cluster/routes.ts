import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  NodeRegistrationRequest,
  NodeHeartbeatRequest,
  NodeStatus,
  NodeRole,
} from "./types.js";

// JSON Schema definitions for request validation
const nodeRegistrationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    url: { type: "string", format: "uri" },
    clusterId: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    capabilities: {
      type: "object",
      additionalProperties: { type: "boolean" },
    },
    role: {
      type: "string",
      enum: Object.values(NodeRole),
    },
    metadata: { type: "object" },
    version: { type: "string" },
    region: { type: "string" },
    zone: { type: "string" },
  },
  required: ["url"],
  additionalProperties: false,
};

const nodeHeartbeatSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: Object.values(NodeStatus),
    },
    metadata: { type: "object" },
    capabilities: {
      type: "object",
      additionalProperties: { type: "boolean" },
    },
  },
  additionalProperties: false,
};

const nodeStatusUpdateSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: [NodeStatus.ACTIVE, NodeStatus.DISABLED],
    },
  },
  required: ["status"],
  additionalProperties: false,
};

export async function clusterRoutes(fastify: FastifyInstance) {
  // POST /cluster/register - Node self-registration
  fastify.post<{
    Body: NodeRegistrationRequest;
  }>(
    "/register",
    {
      schema: {
        body: nodeRegistrationSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              node: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  url: { type: "string" },
                  clusterId: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  capabilities: { type: "object" },
                  status: { type: "string" },
                  role: { type: "string" },
                  lastSeen: { type: "string" },
                  createdAt: { type: "string" },
                  metadata: { type: "object" },
                  version: { type: "string" },
                  region: { type: "string" },
                  zone: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: NodeRegistrationRequest }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const node = await fastify.cluster.registerNode(request.body);

        fastify.log.info(`Node registered: ${node.id} from ${request.ip}`);

        return reply.send({
          success: true,
          node,
        });
      } catch (error) {
        fastify.log.error("Failed to register node:", error);
        return reply.status(400).send({
          error: "Registration Failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // POST /cluster/heartbeat/:nodeId - Periodic liveness update
  fastify.post<{
    Params: { nodeId: string };
    Body: NodeHeartbeatRequest;
  }>(
    "/heartbeat/:nodeId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
          },
          required: ["nodeId"],
        },
        body: nodeHeartbeatSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              timestamp: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { nodeId: string };
        Body: NodeHeartbeatRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        await fastify.cluster.updateHeartbeat(
          request.params.nodeId,
          request.body
        );

        return reply.send({
          success: true,
          message: "Heartbeat updated successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: "Node Not Found",
            message: error.message,
          });
        }

        fastify.log.error("Failed to update heartbeat:", error);
        return reply.status(400).send({
          error: "Heartbeat Failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // GET /cluster/nodes - List of all registered nodes
  fastify.get(
    "/nodes",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            clusterId: { type: "string" },
            status: {
              type: "string",
              enum: Object.values(NodeStatus),
            },
            role: {
              type: "string",
              enum: Object.values(NodeRole),
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              nodes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    url: { type: "string" },
                    clusterId: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                    capabilities: { type: "object" },
                    status: { type: "string" },
                    role: { type: "string" },
                    lastSeen: { type: "string" },
                    createdAt: { type: "string" },
                    metadata: { type: "object" },
                    version: { type: "string" },
                    region: { type: "string" },
                    zone: { type: "string" },
                  },
                },
              },
              total: { type: "number" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          clusterId?: string;
          status?: NodeStatus;
          role?: NodeRole;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        let nodes = await fastify.cluster.getAllNodes();

        // Apply filters
        if (request.query.clusterId) {
          nodes = nodes.filter(
            (node: any) => node.clusterId === request.query.clusterId
          );
        }

        if (request.query.status) {
          nodes = nodes.filter(
            (node: any) => node.status === request.query.status
          );
        }

        if (request.query.role) {
          nodes = nodes.filter((node: any) => node.role === request.query.role);
        }

        return reply.send({
          success: true,
          nodes,
          total: nodes.length,
        });
      } catch (error) {
        fastify.log.error("Failed to get nodes:", error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to retrieve nodes",
        });
      }
    }
  );

  // GET /cluster/nodes/:nodeId - Get specific node details
  fastify.get<{
    Params: { nodeId: string };
  }>(
    "/nodes/:nodeId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
          },
          required: ["nodeId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              node: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  url: { type: "string" },
                  clusterId: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  capabilities: { type: "object" },
                  status: { type: "string" },
                  role: { type: "string" },
                  lastSeen: { type: "string" },
                  createdAt: { type: "string" },
                  metadata: { type: "object" },
                  version: { type: "string" },
                  region: { type: "string" },
                  zone: { type: "string" },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { nodeId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const node = await fastify.cluster.getNode(request.params.nodeId);

        if (!node) {
          return reply.status(404).send({
            error: "Node Not Found",
            message: `Node ${request.params.nodeId} not found`,
          });
        }

        return reply.send({
          success: true,
          node,
        });
      } catch (error) {
        fastify.log.error("Failed to get node:", error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to retrieve node",
        });
      }
    }
  );

  // PATCH /cluster/nodes/:nodeId/enable - Activate node
  fastify.patch<{
    Params: { nodeId: string };
  }>(
    "/nodes/:nodeId/enable",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
          },
          required: ["nodeId"],
        },
        body: nodeStatusUpdateSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { nodeId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        await fastify.cluster.updateNodeStatus(
          request.params.nodeId,
          NodeStatus.ACTIVE
        );

        fastify.log.info(
          `Node ${request.params.nodeId} enabled by ${request.ip}`
        );

        return reply.send({
          success: true,
          message: `Node ${request.params.nodeId} has been enabled`,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: "Node Not Found",
            message: error.message,
          });
        }

        fastify.log.error("Failed to enable node:", error);
        return reply.status(400).send({
          error: "Enable Failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // PATCH /cluster/nodes/:nodeId/disable - Deactivate node
  fastify.patch<{
    Params: { nodeId: string };
  }>(
    "/nodes/:nodeId/disable",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
          },
          required: ["nodeId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { nodeId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        await fastify.cluster.updateNodeStatus(
          request.params.nodeId,
          NodeStatus.DISABLED
        );

        fastify.log.info(
          `Node ${request.params.nodeId} disabled by ${request.ip}`
        );

        return reply.send({
          success: true,
          message: `Node ${request.params.nodeId} has been disabled`,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: "Node Not Found",
            message: error.message,
          });
        }

        fastify.log.error("Failed to disable node:", error);
        return reply.status(400).send({
          error: "Disable Failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // DELETE /cluster/nodes/:nodeId - Remove node from cluster
  fastify.delete<{
    Params: { nodeId: string };
  }>(
    "/nodes/:nodeId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
          },
          required: ["nodeId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { nodeId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        // Check if node exists first
        const node = await fastify.cluster.getNode(request.params.nodeId);
        if (!node) {
          return reply.status(404).send({
            error: "Node Not Found",
            message: `Node ${request.params.nodeId} not found`,
          });
        }

        await fastify.cluster.removeNode(request.params.nodeId);

        fastify.log.info(
          `Node ${request.params.nodeId} removed by ${request.ip}`
        );

        return reply.send({
          success: true,
          message: `Node ${request.params.nodeId} has been removed`,
        });
      } catch (error) {
        fastify.log.error("Failed to remove node:", error);
        return reply.status(500).send({
          error: "Remove Failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // GET /cluster/health - Aggregate status of all known nodes
  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              health: {
                type: "object",
                properties: {
                  totalNodes: { type: "number" },
                  activeNodes: { type: "number" },
                  inactiveNodes: { type: "number" },
                  disabledNodes: { type: "number" },
                  unhealthyNodes: { type: "number" },
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nodeId: { type: "string" },
                        status: { type: "string" },
                        lastSeen: { type: "string" },
                        uptime: { type: "number" },
                        memoryUsage: {
                          type: "object",
                          properties: {
                            used: { type: "number" },
                            total: { type: "number" },
                            percentage: { type: "number" },
                          },
                        },
                        cpuUsage: { type: "number" },
                        activeConnections: { type: "number" },
                        requestsPerSecond: { type: "number" },
                        errorRate: { type: "number" },
                      },
                    },
                  },
                  lastUpdated: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
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
      } catch (error) {
        fastify.log.error("Failed to get cluster health:", error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to retrieve cluster health",
        });
      }
    }
  );

  // GET /cluster/status - Status of current node
  fastify.get(
    "/status",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              status: {
                type: "object",
                properties: {
                  nodeId: { type: "string" },
                  status: { type: "string" },
                  lastSeen: { type: "string" },
                  uptime: { type: "number" },
                  memoryUsage: {
                    type: "object",
                    properties: {
                      used: { type: "number" },
                      total: { type: "number" },
                      percentage: { type: "number" },
                    },
                  },
                  cpuUsage: { type: "number" },
                  activeConnections: { type: "number" },
                  requestsPerSecond: { type: "number" },
                  errorRate: { type: "number" },
                },
              },
              config: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  clusterId: { type: "string" },
                  heartbeatInterval: { type: "number" },
                  nodeTimeout: { type: "number" },
                  healthCheckInterval: { type: "number" },
                  autoRegister: { type: "boolean" },
                  defaultRole: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!fastify.cluster) {
          return reply.status(503).send({
            error: "Service Unavailable",
            message: "Cluster service is not enabled",
          });
        }

        const status = await fastify.cluster.getCurrentNodeStatus();
        const config = fastify.cluster.getConfig();

        return reply.send({
          success: true,
          status,
          config: {
            enabled: config.enabled,
            clusterId: config.clusterId,
            heartbeatInterval: config.heartbeatInterval,
            nodeTimeout: config.nodeTimeout,
            healthCheckInterval: config.healthCheckInterval,
            autoRegister: config.autoRegister,
            defaultRole: config.defaultRole,
            tags: config.tags,
          },
        });
      } catch (error) {
        fastify.log.error("Failed to get node status:", error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to retrieve node status",
        });
      }
    }
  );
}
