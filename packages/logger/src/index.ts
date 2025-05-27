// Centralized logger for Proxy Stone
import pino from "pino";
import type { LogConfig } from "@proxy-stone/shared";

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string | Error, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}

class ProxyStoneLogger implements Logger {
  private pino: pino.Logger;

  constructor(config: LogConfig) {
    const pinoConfig: pino.LoggerOptions = {
      level: config.level,
      ...(config.format === "pretty" && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
    };

    if (config.file) {
      this.pino = pino(pinoConfig, pino.destination(config.file));
    } else {
      this.pino = pino(pinoConfig);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    this.pino.debug(message, ...(args as any[]));
  }

  info(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    this.pino.info(message, ...(args as any[]));
  }

  warn(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    this.pino.warn(message, ...(args as any[]));
  }

  error(message: string | Error, ...args: unknown[]): void {
    if (message instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      this.pino.error(message, ...(args as any[]));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      this.pino.error(message, ...(args as any[]));
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const childPino = this.pino.child(bindings as any);
    return {
      debug: (message: string, ...args: unknown[]) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        childPino.debug(message, ...(args as any[]));
      },
      info: (message: string, ...args: unknown[]) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        childPino.info(message, ...(args as any[]));
      },
      warn: (message: string, ...args: unknown[]) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        childPino.warn(message, ...(args as any[]));
      },
      error: (message: string | Error, ...args: unknown[]) => {
        if (message instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
          childPino.error(message, ...(args as any[]));
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
          childPino.error(message, ...(args as any[]));
        }
      },
      child: (bindings: Record<string, unknown>) => this.child(bindings),
    };
  }
}

// Default logger instance
let defaultLogger: Logger | null = null;

/**
 * Create a new logger instance
 */
export function createLogger(config: LogConfig): Logger {
  return new ProxyStoneLogger(config);
}

/**
 * Initialize the default logger
 */
export function initializeLogger(config: LogConfig): Logger {
  defaultLogger = createLogger(config);
  return defaultLogger;
}

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    // Fallback to console logger if not initialized
    return createLogger({
      level: "info",
      format: "pretty",
    });
  }
  return defaultLogger;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

// Export types
export type { LogConfig };
