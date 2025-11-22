import winston from "winston";
import path from "path";
import fs from "fs";

// Ensure log directory exists
const logDir = process.env.LOG_FILE_PATH || "./logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join(logDir, "error.log"),
    level: "error",
    format,
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(logDir, "combined.log"),
    format,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
    }),
  ],
});

// Export logger methods
export default logger;

/**
 * Log error dengan stack trace
 */
export function logError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    logger.error(message, {
      error: error.message,
      stack: error.stack,
    });
  } else {
    logger.error(message, { error });
  }
}

/**
 * Log warning
 */
export function logWarn(message: string, meta?: unknown): void {
  logger.warn(message, meta);
}

/**
 * Log info
 */
export function logInfo(message: string, meta?: unknown): void {
  logger.info(message, meta);
}

/**
 * Log debug
 */
export function logDebug(message: string, meta?: unknown): void {
  logger.debug(message, meta);
}

/**
 * Log HTTP request
 */
export function logHttp(message: string, meta?: unknown): void {
  logger.http(message, meta);
}

/**
 * Log database query
 */
export function logQuery(query: string, duration?: number): void {
  logger.debug(`DB Query: ${query}${duration ? ` (${duration}ms)` : ""}`);
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
