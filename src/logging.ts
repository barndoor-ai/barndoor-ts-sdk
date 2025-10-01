/**
 * Unified logging system for the Barndoor SDK.
 *
 * This module provides a centralized logging interface that can be configured
 * by SDK consumers to integrate with their preferred logging systems.
 */

/**
 * Logger interface for SDK consumers to plug their own logger.
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Default console logger implementation.
 */
const defaultLogger: Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(message, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (typeof console !== 'undefined' && console.info) {
      console.info(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error(message, ...args);
    }
  },
};

// Global logger instance that can be configured
let _logger: Logger = defaultLogger;

/**
 * Set a custom logger for the entire SDK.
 * @param logger - Custom logger implementation
 */
export function setLogger(logger: Logger): void {
  _logger = logger;
}

/**
 * Get the current logger instance.
 * @returns Current logger
 */
export function getLogger(): Logger {
  return _logger;
}

/**
 * Create a scoped logger with a prefix for better organization.
 * @param scope - Scope name (e.g., 'client', 'auth', 'http')
 * @returns Scoped logger
 */
export function createScopedLogger(scope: string): Logger {
  return {
    debug: (message: string, ...args: unknown[]) => {
      _logger.debug(`[${scope}] ${message}`, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      _logger.info(`[${scope}] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      _logger.warn(`[${scope}] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      _logger.error(`[${scope}] ${message}`, ...args);
    },
  };
}

/**
 * Convenience function to log debug messages.
 */
export function debug(message: string, ...args: unknown[]): void {
  _logger.debug(message, ...args);
}

/**
 * Convenience function to log info messages.
 */
export function info(message: string, ...args: unknown[]): void {
  _logger.info(message, ...args);
}

/**
 * Convenience function to log warning messages.
 */
export function warn(message: string, ...args: unknown[]): void {
  _logger.warn(message, ...args);
}

/**
 * Convenience function to log error messages.
 */
export function error(message: string, ...args: unknown[]): void {
  _logger.error(message, ...args);
}
