import type { FastifyInstance } from 'fastify';
import { ProxyError } from '../types/errors.js';

interface ErrorEvent {
  error: Error | string;
  context?: Record<string, unknown>;
  tags?: string[];
  level?: 'error' | 'warning' | 'info';
  timestamp?: number;
}

interface ErrorTrackerConfig {
  enabled: boolean;
  service: 'sentry' | 'datadog' | 'custom';
  dsn?: string;
  environment?: string;
  sampleRate?: number;
  customEndpoint?: string;
}

export class ErrorTrackerService {
  private app: FastifyInstance;
  private config: ErrorTrackerConfig;
  private queue: ErrorEvent[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor(app: FastifyInstance, config: ErrorTrackerConfig) {
    this.app = app;
    this.config = config;
    this.initialize();
  }

  private initialize() {
    if (!this.config.enabled) return;

    // Initialize monitoring service
    switch (this.config.service) {
      case 'sentry':
        this.initializeSentry();
        break;
      case 'datadog':
        this.initializeDatadog();
        break;
      case 'custom':
        this.initializeCustom();
        break;
    }

    // Start periodic flush of error queue
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  private initializeSentry() {
    if (!this.config.dsn) {
      this.app.log.warn('Sentry DSN not provided, error tracking disabled');
      return;
    }

    // Initialize Sentry SDK
    import('@sentry/node')
      .then((Sentry) => {
        Sentry.init({
          dsn: this.config.dsn,
          environment: this.config.environment,
          tracesSampleRate: this.config.sampleRate || 1.0,
        });
      })
      .catch((error) => {
        this.app.log.error('Failed to initialize Sentry:', error);
      });
  }

  private initializeDatadog() {
    // Initialize Datadog tracer
    import('dd-trace')
      .then((dd) => {
        dd.init({
          service: 'proxy-stone',
          environment: this.config.environment,
          sampleRate: this.config.sampleRate || 1.0,
        });
      })
      .catch((error) => {
        this.app.log.error('Failed to initialize Datadog:', error);
      });
  }

  private initializeCustom() {
    if (!this.config.customEndpoint) {
      this.app.log.warn('Custom endpoint not provided, error tracking disabled');
      return;
    }
  }

  trackError(error: unknown, context?: Record<string, unknown>, tags?: string[]) {
    if (!this.config.enabled) return;

    const event: ErrorEvent = {
      error: error instanceof Error ? error : String(error),
      context,
      tags,
      level: 'error',
      timestamp: Date.now(),
    };

    this.queue.push(event);

    // If queue is getting large, flush immediately
    if (this.queue.length >= 100) {
      this.flush();
    }
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0, this.queue.length);

    try {
      switch (this.config.service) {
        case 'sentry':
          await this.flushToSentry(events);
          break;
        case 'datadog':
          await this.flushToDatadog(events);
          break;
        case 'custom':
          await this.flushToCustom(events);
          break;
      }
    } catch (error) {
      this.app.log.error('Failed to flush error events:', error);
      // Put events back in queue
      this.queue.unshift(...events);
    }
  }

  private async flushToSentry(events: ErrorEvent[]) {
    const Sentry = await import('@sentry/node');

    for (const event of events) {
      if (event.error instanceof Error) {
        Sentry.captureException(event.error, {
          extra: event.context,
          tags: event.tags?.reduce((acc, tag) => ({ ...acc, [tag]: true }), {}),
        });
      } else {
        Sentry.captureMessage(event.error, {
          level: event.level,
          extra: event.context,
          tags: event.tags?.reduce((acc, tag) => ({ ...acc, [tag]: true }), {}),
        });
      }
    }
  }

  private async flushToDatadog(events: ErrorEvent[]) {
    const tracer = await import('dd-trace');

    for (const event of events) {
      const span = tracer.startSpan('error', {
        service: 'proxy-stone',
        resource: event.error instanceof Error ? event.error.name : 'error',
        type: 'error',
        tags: {
          ...event.tags?.reduce((acc, tag) => ({ ...acc, [tag]: true }), {}),
          error: event.error instanceof Error ? event.error.message : event.error,
          stack: event.error instanceof Error ? event.error.stack : undefined,
          ...event.context,
        },
      });
      span.finish();
    }
  }

  private async flushToCustom(events: ErrorEvent[]) {
    if (!this.config.customEndpoint) return;

    try {
      const response = await fetch(this.config.customEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send events: ${response.statusText}`);
      }
    } catch (error) {
      this.app.log.error('Failed to send events to custom endpoint:', error);
      throw error;
    }
  }

  shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    return this.flush();
  }
}
