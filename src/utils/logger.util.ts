import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console(),

  // Error log file
  new winston.transports.File({
    filename: path.join(process.env.LOG_FILE_PATH || './logs', 'error.log'),
    level: 'error',
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(process.env.LOG_FILE_PATH || './logs', 'combined.log'),
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

// Export logger methods
export default logger;

/**
 * Log error
 */
export function logError(message: string, error?: unknown): void {
  const errorData = error instanceof Error ? error.stack : error;
  logger.error(message, { error: errorData });
}

/**
 * Log warning
 */
export function logWarning(message: string, meta?: unknown): void {
  logger.warn(message, meta as Record<string, unknown>);
}

/**
 * Log info
 */
export function logInfo(message: string, meta?: unknown): void {
  logger.info(message, meta as Record<string, unknown>);
}

/**
 * Log debug
 */
export function logDebug(message: string, meta?: unknown): void {
  logger.debug(message, meta as Record<string, unknown>);
}

/**
 * Log HTTP request
 */
export function logHttp(message: string, meta?: unknown): void {
  logger.http(message, meta as Record<string, unknown>);
}

/**
 * Log database query
 */
export function logQuery(query: string, duration?: number): void {
  logger.debug(`DB Query: ${query}${duration ? ` (${duration}ms)` : ''}`);
}

/**
 * Log API request
 */
export function logApiRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number
): void {
  const message = `${method} ${url} ${statusCode} - ${duration}ms`;

  if (statusCode >= 500) {
    logger.error(message);
  } else if (statusCode >= 400) {
    logger.warn(message);
  } else {
    logger.http(message);
  }
}

/**
 * Create child logger with context
 */
export function createChildLogger(context: string) {
  return logger.child({ context });
}
