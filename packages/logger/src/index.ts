// Centralized logger for Proxy Stone
import pino from "pino";
import type { LogConfig } from "@proxy-stone/shared";

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string | Error, ...args: any[]): void;
  child(bindings: Record<string, any>): Logger;
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

  debug(message: string, ...args: any[]): void {
    this.pino.debug(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.pino.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.pino.warn(message, ...args);
  }

  error(message: string | Error, ...args: any[]): void {
    if (message instanceof Error) {
      this.pino.error(message, ...args);
    } else {
      this.pino.error(message, ...args);
    }
  }

  child(bindings: Record<string, any>): Logger {
    const childPino = this.pino.child(bindings);
    return {
      debug: (message: string, ...args: any[]) =>
        childPino.debug(message, ...args),
      info: (message: string, ...args: any[]) =>
        childPino.info(message, ...args),
      warn: (message: string, ...args: any[]) =>
        childPino.warn(message, ...args),
      error: (message: string | Error, ...args: any[]) => {
        if (message instanceof Error) {
          childPino.error(message, ...args);
        } else {
          childPino.error(message, ...args);
        }
      },
      child: (bindings: Record<string, any>) => this.child(bindings),
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
export function createChildLogger(bindings: Record<string, any>): Logger {
  return getLogger().child(bindings);
}

// Export types
export type { LogConfig };
