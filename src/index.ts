import fastify from "fastify";
import cors from "@fastify/cors";
import { FastifyRequest, FastifyReply } from "fastify";

const app = fastify({
  logger: true,
});

// Register CORS
await app.register(cors, {
  origin: true, // Allow all origins
});

// Health check route
app.get("/health", async () => {
  return { status: "ok" };
});

// API route handler for all methods and paths under /api/*
app.all("/api/*", async (request: FastifyRequest, reply: FastifyReply) => {
  const method = request.method;
  const url = request.url;
  const headers = request.headers;
  const body = request.body;

  app.log.info(
    {
      method,
      url,
      headers,
      body,
    },
    "API Request received",
  );

  // Here you can add your API logic
  // For now, we'll just echo back the request details
  return {
    method,
    url,
    headers,
    body,
    timestamp: new Date().toISOString(),
  };
});

// Start server
try {
  await app.listen({ port: 3000, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
