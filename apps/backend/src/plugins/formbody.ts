import { FastifyInstance } from 'fastify';
import formBody from '@fastify/formbody';

export async function formBodyPlugin(fastify: FastifyInstance) {
  await fastify.register(formBody);
  fastify.log.info('@fastify/formbody plugin registered.');
}
