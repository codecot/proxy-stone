import type { FastifyInstance } from "fastify";
import { CacheError, BackendError } from "../types/errors.js";

interface RecoveryStrategy {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  shouldRetry: (error: unknown) => boolean;
}

export class RecoveryService {
  private app: FastifyInstance;
  private strategies: Map<string, RecoveryStrategy> = new Map();

  constructor(app: FastifyInstance) {
    this.app = app;
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // Cache recovery strategy
    this.strategies.set("cache", {
      maxRetries: 3,
      backoffMs: 100,
      maxBackoffMs: 1000,
      shouldRetry: (error) => error instanceof CacheError,
    });

    // Backend recovery strategy
    this.strategies.set("backend", {
      maxRetries: 2,
      backoffMs: 500,
      maxBackoffMs: 2000,
      shouldRetry: (error) => error instanceof BackendError,
    });

    // Database recovery strategy
    this.strategies.set("database", {
      maxRetries: 3,
      backoffMs: 200,
      maxBackoffMs: 1500,
      shouldRetry: (error) => {
        // Retry on common database errors
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          return (
            message.includes("database") ||
            message.includes("sqlite") ||
            message.includes("locked") ||
            message.includes("busy") ||
            message.includes("connection")
          );
        }
        return false;
      },
    });
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    strategyName: string,
    context?: Record<string, unknown>
  ): Promise<T> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`No recovery strategy found for: ${strategyName}`);
    }

    let lastError: unknown;
    let backoff = strategy.backoffMs;

    for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!strategy.shouldRetry(error)) {
          throw error;
        }

        if (attempt < strategy.maxRetries) {
          this.app.log.warn({
            msg: `Retry attempt ${attempt}/${strategy.maxRetries}`,
            error: error instanceof Error ? error.message : String(error),
            strategy: strategyName,
            context,
          });

          await this.delay(backoff);
          backoff = Math.min(backoff * 2, strategy.maxBackoffMs);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      this.app.log.warn({
        msg: "Primary operation failed, trying fallback",
        error: error instanceof Error ? error.message : String(error),
        context,
      });

      try {
        return await fallback();
      } catch (fallbackError) {
        this.app.log.error({
          msg: "Fallback operation also failed",
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
          context,
        });
        throw fallbackError;
      }
    }
  }

  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    breakerName: string,
    options: {
      failureThreshold: number;
      resetTimeoutMs: number;
    }
  ): Promise<T> {
    const state = this.getCircuitBreakerState(breakerName);
    const now = Date.now();

    if (
      state.status === "open" &&
      now - state.lastFailure < options.resetTimeoutMs
    ) {
      throw new Error(`Circuit breaker '${breakerName}' is open`);
    }

    try {
      const result = await operation();
      state.failures = 0;
      state.status = "closed";
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailure = now;

      if (state.failures >= options.failureThreshold) {
        state.status = "open";
      }

      throw error;
    }
  }

  private circuitBreakers = new Map<
    string,
    {
      status: "closed" | "open";
      failures: number;
      lastFailure: number;
    }
  >();

  private getCircuitBreakerState(name: string) {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, {
        status: "closed",
        failures: 0,
        lastFailure: 0,
      });
    }
    return this.circuitBreakers.get(name)!;
  }

  async recover(): Promise<void> {
    try {
      // ... recovery code ...
    } catch (_error) {
      // ... error handling ...
    }
    return;
  }

  async createSnapshot(): Promise<void> {
    try {
      // ... create snapshot code ...
    } catch (_error) {
      // ... error handling ...
    }
    return;
  }

  async restoreFromSnapshot(snapshotId: string): Promise<void> {
    try {
      // ... restore from snapshot code ...
    } catch (_error) {
      // ... error handling ...
    }
    return;
  }

  async listSnapshots(): Promise<string[]> {
    try {
      // ... list snapshots code ...
    } catch (_error) {
      // ... error handling ...
    }
    return [];
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      // ... delete snapshot code ...
    } catch (_error) {
      // ... error handling ...
    }
    return;
  }
}
