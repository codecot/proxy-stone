// Event contracts and schema validators for Proxy Stone
import { z } from "zod";

// Base event schema
export const BaseEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  type: z.string(),
  source: z.string(),
  version: z.string().default("1.0"),
});

// Proxy request event
export const ProxyRequestEventSchema = BaseEventSchema.extend({
  type: z.literal("proxy.request"),
  data: z.object({
    method: z.string(),
    url: z.string().url(),
    headers: z.record(z.string()),
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    duration: z.number().optional(),
    statusCode: z.number().optional(),
    cached: z.boolean().default(false),
  }),
});

// Cache event
export const CacheEventSchema = BaseEventSchema.extend({
  type: z.enum(["cache.hit", "cache.miss", "cache.set", "cache.delete"]),
  data: z.object({
    key: z.string(),
    ttl: z.number().optional(),
    size: z.number().optional(),
  }),
});

// Health check event
export const HealthEventSchema = BaseEventSchema.extend({
  type: z.enum(["health.check", "health.degraded", "health.recovered"]),
  data: z.object({
    status: z.enum(["healthy", "unhealthy", "degraded"]),
    services: z.record(z.enum(["connected", "disconnected", "error"])),
    uptime: z.number(),
  }),
});

// Error event
export const ErrorEventSchema = BaseEventSchema.extend({
  type: z.literal("error"),
  data: z.object({
    error: z.string(),
    stack: z.string().optional(),
    context: z.record(z.any()).optional(),
  }),
});

// Union of all event types
export const EventSchema = z.discriminatedUnion("type", [
  ProxyRequestEventSchema,
  CacheEventSchema,
  HealthEventSchema,
  ErrorEventSchema,
]);

// Type exports
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type ProxyRequestEvent = z.infer<typeof ProxyRequestEventSchema>;
export type CacheEvent = z.infer<typeof CacheEventSchema>;
export type HealthEvent = z.infer<typeof HealthEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type Event = z.infer<typeof EventSchema>;

// Event factory functions
export function createProxyRequestEvent(
  data: ProxyRequestEvent["data"]
): ProxyRequestEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "proxy.request",
    source: "proxy-stone",
    version: "1.0",
    data,
  };
}

export function createCacheEvent(
  type: CacheEvent["type"],
  data: CacheEvent["data"]
): CacheEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    source: "proxy-stone",
    version: "1.0",
    data,
  };
}

export function createHealthEvent(data: HealthEvent["data"]): HealthEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "health.check",
    source: "proxy-stone",
    version: "1.0",
    data,
  };
}

export function createErrorEvent(data: ErrorEvent["data"]): ErrorEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "error",
    source: "proxy-stone",
    version: "1.0",
    data,
  };
}

// Event validation
export function validateEvent(event: unknown): Event {
  return EventSchema.parse(event);
}

export function isValidEvent(event: unknown): event is Event {
  return EventSchema.safeParse(event).success;
}
