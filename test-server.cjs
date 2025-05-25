const fastify = require('fastify')({ logger: true });

// Add CORS support
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true,
});

// Health endpoint
fastify.get('/api/health', async (request, reply) => {
  return {
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
});

// Cache endpoints
fastify.get('/api/cache/entries', async (request, reply) => {
  return {
    entries: [],
    total: 0,
    page: 1,
    limit: 50,
  };
});

fastify.get('/api/cache/rules', async (request, reply) => {
  return {
    rules: [],
  };
});

// Debug config endpoint
fastify.get('/api/debug/config', async (request, reply) => {
  return {
    defaultTTL: 300,
    methods: ['GET', 'POST'],
    rules: [],
  };
});

// Backend status endpoint
fastify.get('/api/health/backend', async (request, reply) => {
  return {
    backends: [
      {
        host: 'localhost:3000',
        status: 'healthy',
        responseTime: 50,
        lastCheck: Date.now(),
      },
    ],
  };
});

// Proxy endpoints (for actual proxying)
fastify.all('/proxy/*', async (request, reply) => {
  // This would be where actual proxying logic goes
  return {
    message: 'Proxy endpoint - would forward requests to backend',
    originalUrl: request.url,
    method: request.method,
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '127.0.0.1' });
    console.log('Test server running on http://127.0.0.1:4000');
    console.log('API endpoints available at /api/*');
    console.log('Proxy endpoints available at /proxy/*');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
