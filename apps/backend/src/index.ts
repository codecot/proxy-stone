import { createServer } from "@/server.js";

// Start server
try {
  const app = await createServer();
  await app.listen({ port: app.config.port, host: app.config.host });
} catch (err) {
  console.error(err);
  process.exit(1);
}
