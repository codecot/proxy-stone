import type { FastifyInstance } from "fastify";

export async function metricsRoutes(fastify: FastifyInstance) {
  // Prometheus metrics endpoint
  fastify.get("/metrics", {
    schema: {
      tags: ["metrics"],
      summary: "Get Prometheus metrics",
      description: "Returns metrics in Prometheus format for monitoring and alerting",
      response: {
        200: {
          description: "Prometheus metrics data",
          type: "string",
          headers: {
            "Content-Type": {
              type: "string",
              default: "text/plain; version=0.0.4; charset=utf-8",
            },
          },
        },
        500: {
          description: "Failed to retrieve metrics",
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const metrics = await fastify.metrics?.getMetrics();
      reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      return metrics;
    } catch (error) {
      fastify.log.error("Error getting metrics:", error);
      reply.status(500);
      return { error: "Failed to get metrics" };
    }
  });

  // Metrics summary endpoint (JSON format)
  fastify.get("/metrics/summary", {
    schema: {
      tags: ["metrics"],
      summary: "Get metrics summary in JSON format",
      description: "Returns parsed metrics data in a more readable JSON format",
      response: {
        200: {
          description: "Metrics summary data",
          type: "object",
          properties: {
            timestamp: {
              type: "string",
              format: "date-time",
              description: "When the metrics were collected",
            },
            metrics: {
              type: "object",
              description: "Parsed metrics organized by metric name",
              additionalProperties: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    metric: { type: "string" },
                    value: { type: "number" },
                  },
                },
              },
            },
          },
        },
        500: {
          description: "Failed to retrieve metrics summary",
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const metrics = await fastify.metrics?.getMetrics();

      // Parse Prometheus metrics into a more readable JSON format
      const lines = metrics?.split("\n") || [];
      const summary: Record<string, any> = {};

      for (const line of lines) {
        if (line.startsWith("#") || !line.trim()) continue;

        const [metricName, value] = line.split(" ");
        if (metricName && value) {
          const cleanName = metricName.split("{")[0];
          if (!summary[cleanName]) {
            summary[cleanName] = [];
          }
          summary[cleanName].push({
            metric: metricName,
            value: parseFloat(value) || 0,
          });
        }
      }

      return {
        timestamp: new Date().toISOString(),
        metrics: summary,
      };
    } catch (error) {
      fastify.log.error("Error getting metrics summary:", error);
      reply.status(500);
      return { error: "Failed to get metrics summary" };
    }
  });
}
