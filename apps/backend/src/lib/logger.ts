/**
 * Centralized structured logger (Winston)
 * Replaces all console.log/console.error calls in production
 */

import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    isProduction ? json() : combine(colorize(), simple()),
  ),

  transports: [
    new winston.transports.Console(),
    // In production, also write to file for ingestion by log aggregator
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: '/var/log/ems/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: '/var/log/ems/combined.log',
            maxsize: 50 * 1024 * 1024,
            maxFiles: 10,
          }),
        ]
      : []),
  ],

  // Do not exit on unhandled rejections — let process.on handle it
  exitOnError: false,
});

export default logger;
