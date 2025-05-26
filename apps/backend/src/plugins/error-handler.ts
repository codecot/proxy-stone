import { FastifyPluginAsync } from "fastify";
import { ProxyError, createErrorResponse } from "../types/errors.js";

export const errorHandler: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Log the error
    fastify.log.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url,
      method: request.method,
      headers: request.headers,
      query: request.query,
      params: request.params,
    });

    // Handle our custom errors
    if (error instanceof ProxyError) {
      reply.status(error.statusCode);
      return createErrorResponse(error);
    }

    // Handle validation errors from Fastify
    if (error.validation) {
      reply.status(400);
      return createErrorResponse(
        new ProxyError(
          "Validation error",
          "VALIDATION_ERROR",
          400,
          error.validation
        )
      );
    }

    // Handle unknown errors
    reply.status(500);
    return createErrorResponse(error);
  });
};
