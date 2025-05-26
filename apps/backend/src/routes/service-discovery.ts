import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireReadAccess, requireAdmin } from '../plugins/auth.js';

// Extend FastifyInstance to include serviceDiscovery
declare module 'fastify' {
  interface FastifyInstance {
    serviceDiscovery?: any; // Will be properly typed when integrated
  }
}

export async function serviceDiscoveryRoutes(fastify: FastifyInstance) {
  // GET /service-discovery/status - Get service discovery status
  fastify.get('/service-discovery/status', async (request, reply) => {
    const serviceDiscovery = fastify.serviceDiscovery;
    
    if (!serviceDiscovery) {
      return reply.status(503).send({
        error: 'Service discovery not available',
        enabled: false
      });
    }

    const currentService = serviceDiscovery.getCurrentService();
    const isLeader = serviceDiscovery.isLeader();

    return {
      enabled: true,
      currentService,
      isLeader,
      status: currentService ? 'registered' : 'not_registered'
    };
  });

  // GET /service-discovery/services - Get all discovered services
  fastify.get('/service-discovery/services', { preHandler: requireReadAccess() }, async (request, reply) => {
    const serviceDiscovery = fastify.serviceDiscovery;
    
    if (!serviceDiscovery) {
      return reply.status(503).send({
        error: 'Service discovery not available'
      });
    }

    try {
      const services = await serviceDiscovery.getAvailableServices();
      const healthyServices = await serviceDiscovery.getHealthyServices();
      
      // Add health status to each service
      const servicesWithHealth = await Promise.all(
        services.map(async (service) => {
          const health = await serviceDiscovery.getServiceHealth(service.id);
          return {
            ...service,
            health: health ? {
              status: health.status,
              responseTime: health.responseTime,
              lastCheck: health.timestamp,
              error: health.error
            } : null,
            isHealthy: healthyServices.some(h => h.id === service.id)
          };
        })
      );

      return {
        services: servicesWithHealth,
        total: services.length,
        healthy: healthyServices.length,
        unhealthy: services.length - healthyServices.length
      };
    } catch (error) {
      fastify.log.error('Error getting services:', error);
      return reply.status(500).send({
        error: 'Failed to get services',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /service-discovery/services/healthy - Get only healthy services
  fastify.get('/service-discovery/services/healthy', { preHandler: requireReadAccess() }, async (request, reply) => {
    const serviceDiscovery = fastify.serviceDiscovery;
    
    if (!serviceDiscovery) {
      return reply.status(503).send({
        error: 'Service discovery not available'
      });
    }

    try {
      const services = await serviceDiscovery.getHealthyServices();
      return {
        services,
        count: services.length
      };
    } catch (error) {
      fastify.log.error('Error getting healthy services:', error);
      return reply.status(500).send({
        error: 'Failed to get healthy services',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /service-discovery/topology - Get cluster topology
  fastify.get('/service-discovery/topology', { preHandler: requireReadAccess() }, async (request, reply) => {
    const serviceDiscovery = fastify.serviceDiscovery;
    
    if (!serviceDiscovery) {
      return reply.status(503).send({
        error: 'Service discovery not available'
      });
    }

    try {
      const topology = await serviceDiscovery.getClusterTopology();
      return topology;
    } catch (error) {
      fastify.log.error('Error getting cluster topology:', error);
      return reply.status(500).send({
        error: 'Failed to get cluster topology',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /service-discovery/services/:serviceId - Get specific service details
  fastify.get<{ Params: { serviceId: string } }>(
    '/service-discovery/services/:serviceId',
    { preHandler: requireReadAccess() },
    async (request, reply) => {
      const serviceDiscovery = fastify.serviceDiscovery;
      const { serviceId } = request.params;
      
      if (!serviceDiscovery) {
        return reply.status(503).send({
          error: 'Service discovery not available'
        });
      }

      try {
        const manager = serviceDiscovery.getManager();
        if (!manager) {
          return reply.status(503).send({
            error: 'Service discovery manager not available'
          });
        }

        const service = await manager.getService(serviceId);
        if (!service) {
          return reply.status(404).send({
            error: 'Service not found',
            serviceId
          });
        }

        const health = await serviceDiscovery.getServiceHealth(serviceId);
        
        return {
          service,
          health: health ? {
            status: health.status,
            responseTime: health.responseTime,
            lastCheck: health.timestamp,
            error: health.error,
            details: health.details
          } : null
        };
      } catch (error) {
        fastify.log.error(`Error getting service ${serviceId}:`, error);
        return reply.status(500).send({
          error: 'Failed to get service',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // POST /service-discovery/services/:serviceId/enable - Enable a service
  fastify.post<{ Params: { serviceId: string } }>(
    '/service-discovery/services/:serviceId/enable',
    { preHandler: requireAdmin() },
    async (request, reply) => {
      const serviceDiscovery = fastify.serviceDiscovery;
      const { serviceId } = request.params;
      
      if (!serviceDiscovery) {
        return reply.status(503).send({
          error: 'Service discovery not available'
        });
      }

      try {
        await serviceDiscovery.setServiceEnabled(serviceId, true);
        return {
          success: true,
          message: `Service ${serviceId} enabled`,
          serviceId
        };
      } catch (error) {
        fastify.log.error(`Error enabling service ${serviceId}:`, error);
        return reply.status(500).send({
          error: 'Failed to enable service',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // POST /service-discovery/services/:serviceId/disable - Disable a service
  fastify.post<{ Params: { serviceId: string } }>(
    '/service-discovery/services/:serviceId/disable',
    { preHandler: requireAdmin() },
    async (request, reply) => {
      const serviceDiscovery = fastify.serviceDiscovery;
      const { serviceId } = request.params;
      
      if (!serviceDiscovery) {
        return reply.status(503).send({
          error: 'Service discovery not available'
        });
      }

      try {
        await serviceDiscovery.setServiceEnabled(serviceId, false);
        return {
          success: true,
          message: `Service ${serviceId} disabled`,
          serviceId
        };
      } catch (error) {
        fastify.log.error(`Error disabling service ${serviceId}:`, error);
        return reply.status(500).send({
          error: 'Failed to disable service',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GET /service-discovery/services/:serviceId/health - Get service health
  fastify.get<{ Params: { serviceId: string } }>(
    '/service-discovery/services/:serviceId/health',
    { preHandler: requireReadAccess() },
    async (request, reply) => {
      const serviceDiscovery = fastify.serviceDiscovery;
      const { serviceId } = request.params;
      
      if (!serviceDiscovery) {
        return reply.status(503).send({
          error: 'Service discovery not available'
        });
      }

      try {
        const health = await serviceDiscovery.getServiceHealth(serviceId);
        
        if (!health) {
          return reply.status(404).send({
            error: 'Health information not available',
            serviceId
          });
        }

        return {
          serviceId,
          health: {
            status: health.status,
            responseTime: health.responseTime,
            lastCheck: health.timestamp,
            error: health.error,
            details: health.details
          }
        };
      } catch (error) {
        fastify.log.error(`Error getting health for service ${serviceId}:`, error);
        return reply.status(500).send({
          error: 'Failed to get service health',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GET /service-discovery/events - Server-sent events for real-time updates
  fastify.get('/service-discovery/events', { preHandler: requireReadAccess() }, async (request, reply) => {
    const serviceDiscovery = fastify.serviceDiscovery;
    
    if (!serviceDiscovery) {
      return reply.status(503).send({
        error: 'Service discovery not available'
      });
    }

    // Set up Server-Sent Events
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    // Set up event listeners
    const eventHandlers = {
      serviceJoined: (service: any) => {
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'serviceJoined', 
          service, 
          timestamp: Date.now() 
        })}\n\n`);
      },
      serviceLeft: (serviceId: string) => {
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'serviceLeft', 
          serviceId, 
          timestamp: Date.now() 
        })}\n\n`);
      },
      serviceHealthChanged: (serviceId: string, service?: any) => {
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'serviceHealthChanged', 
          serviceId, 
          service, 
          timestamp: Date.now() 
        })}\n\n`);
      },
      leaderElected: (leaderId: string) => {
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'leaderElected', 
          leaderId, 
          timestamp: Date.now() 
        })}\n\n`);
      },
      topologyChanged: () => {
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'topologyChanged', 
          timestamp: Date.now() 
        })}\n\n`);
      }
    };

    // Register event listeners
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      serviceDiscovery.on(event, handler);
    });

    // Clean up on connection close
    request.raw.on('close', () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        serviceDiscovery.off(event, handler);
      });
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
    }, 30000);

    request.raw.on('close', () => {
      clearInterval(keepAlive);
    });
  });
} 