import fastify from 'fastify';
import { config } from './config/index.js';
import { corsPlugin } from './plugins/cors.js';
import { formBodyPlugin } from './plugins/formbody.js';
import { apiRoutes } from './routes/api.js';
import { healthRoutes } from './routes/health.js';
import { AppInstance } from './types/index.js';

const isProduction = process.env.NODE_ENV === 'production';

const app: AppInstance = fastify({
  logger: {
    level: 'info',
    ...(isProduction
      ? {}
      : {
          // Conditional pino-pretty configuration
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              colorize: true,
            },
          },
        }),
  },
});

// Decorate the app instance with the config
app.decorate('config', config);

// Register plugins
await app.register(corsPlugin);
await app.register(formBodyPlugin);

// Register routes
await app.register(apiRoutes);
await app.register(healthRoutes);

// Start server
try {
  await app.listen({ port: app.config.port, host: app.config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
