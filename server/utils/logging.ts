/**
 * Logging Utilities
 *
 * Provides structured logging for the application.
 * Uses console methods with structured JSON output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment
const MIN_LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context,
  };

  // In production, use JSON format
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(logData);
  }

  // In development, use readable format
  const contextStr = context
    ? ' ' + Object.entries(context)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')
    : '';

  return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
}

/**
 * Log a debug message
 */
export function debug(message: string, context?: LogContext): void {
  if (shouldLog('debug')) {
    console.debug(formatMessage('debug', message, context));
  }
}

/**
 * Log an info message
 */
export function info(message: string, context?: LogContext): void {
  if (shouldLog('info')) {
    console.info(formatMessage('info', message, context));
  }
}

/**
 * Log a warning message
 */
export function warn(message: string, context?: LogContext): void {
  if (shouldLog('warn')) {
    console.warn(formatMessage('warn', message, context));
  }
}

/**
 * Log an error message
 */
export function error(message: string, context?: LogContext): void {
  if (shouldLog('error')) {
    console.error(formatMessage('error', message, context));
  }
}

/**
 * Log an error with stack trace
 */
export function errorWithStack(message: string, err: Error, context?: LogContext): void {
  if (shouldLog('error')) {
    console.error(
      formatMessage('error', message, {
        ...context,
        error: err.message,
        stack: err.stack,
      })
    );
  }
}

/**
 * Create a child logger with preset context
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) =>
      debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      warn(message, { ...defaultContext, ...context }),
    error: (message: string, context?: LogContext) =>
      error(message, { ...defaultContext, ...context }),
    errorWithStack: (message: string, err: Error, context?: LogContext) =>
      errorWithStack(message, err, { ...defaultContext, ...context }),
  };
}

/**
 * Request logging middleware helper
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: LogContext
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  const message = `${method} ${path} ${statusCode} ${durationMs}ms`;

  if (level === 'error') {
    error(message, context);
  } else if (level === 'warn') {
    warn(message, context);
  } else {
    info(message, context);
  }
}
