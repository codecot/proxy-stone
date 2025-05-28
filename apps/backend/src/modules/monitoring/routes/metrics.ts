import type { FastifyInstance } from "fastify";

export async function metricsRoutes(fastify: FastifyInstance) {
  // Prometheus metrics endpoint
  fastify.get("/metrics", async (request, reply) => {
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
  fastify.get("/metrics/summary", async (request, reply) => {
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
