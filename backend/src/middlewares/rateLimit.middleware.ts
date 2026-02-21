import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { TooManyRequestsError } from '../utils/errors.js';

const isDevelopment = config.env === 'development';

/**
 * Default rate limiter for API endpoints
 * Disabled in development mode for easier testing
 */
export const defaultLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: isDevelopment ? 10000 : config.rateLimit.maxRequests, // Very high limit in dev
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment, // Skip rate limiting entirely in development
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests, please try again later'));
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip || 'unknown';
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * More lenient in development mode
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 10, // 10 attempts in prod, 1000 in dev
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment, // Skip in development
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many authentication attempts, please try again in 15 minutes'));
  },
  keyGenerator: (req) => req.ip || 'unknown',
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Rate limiter for control commands (very strict)
 */
export const controlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 commands per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many control commands, please slow down'));
  },
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
});

/**
 * Rate limiter for report generation
 */
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reports per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Report generation limit reached, please try again later'));
  },
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
});

/**
 * Rate limiter for telemetry data (more lenient)
 */
export const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second average)
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many telemetry requests'));
  },
  keyGenerator: (req) => {
    // Allow higher limits per system
    const systemId = req.params.systemId || req.query.systemId;
    return `${req.user?.id || req.ip}:${systemId || 'all'}`;
  },
});
