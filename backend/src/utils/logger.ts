import winston from 'winston';
import path from 'path';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  // Add stack trace for errors
  if (stack) {
    log += `\n${stack}`;
  }

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  return log;
});

// Create transports array
const transports: winston.transport[] = [
  // Console transport (always)
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    ),
  }),
];

// File transports in production
if (config.env === 'production') {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(config.logging.filePath, 'error.log'),
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(config.logging.filePath, 'combined.log'),
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), logFormat),
    }),
  ],
  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), logFormat),
    }),
  ],
});

// Utility functions for structured logging
export const logRequest = (method: string, path: string, userId?: string) => {
  logger.info(`${method} ${path}`, { userId });
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(error.message, { error, ...context });
};

export const logAlert = (systemId: string, alertType: string, message: string) => {
  logger.warn(`Alert [${systemId}]: ${alertType} - ${message}`);
};

export const logTelemetry = (systemId: string, data: Record<string, unknown>) => {
  logger.debug(`Telemetry [${systemId}]`, data);
};

export default logger;
