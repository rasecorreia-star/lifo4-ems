/**
 * Express Application Setup
 * Configures middleware, error handling, and routes
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { logger } from './lib/logger.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.middleware.js';

const app: Express = express();

// ========== Security Headers ==========
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
    },
  }),
);

// ========== CORS ==========
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman in dev)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ========== Rate Limiting ==========

// Global limiter — applies to all routes
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', retryAfter: '60s' },
});
app.use(globalLimiter);

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts', retryAfter: '15min' },
  skipSuccessfulRequests: true,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// Command limiter — BESS control endpoints
// keyGenerator prefers userId (populated by authMiddleware) over IP,
// ensuring per-user limits rather than per-IP. Unauthenticated requests
// are not rate-limited here — auth middleware rejects them first.
const commandLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.userId ?? `ip:${req.ip ?? 'unknown'}`,
  skip: (req) => !req.user?.userId, // auth middleware handles unauthenticated
  message: { error: 'Command rate limit exceeded', retryAfter: '60s' },
});
app.use('/api/v1/systems/:systemId/commands', commandLimiter);

// Emergency stop — separate, more lenient limit (but still protected)
const emergencyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Emergency stop rate limit exceeded' },
});
app.use('/api/v1/systems/:systemId/emergency-stop', emergencyLimiter);

// ========== Logging ==========
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
  }),
);

// ========== Body Parsing ==========
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// ========== Prometheus Metrics (public, no auth) ==========
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

// ========== Health Check (public, no auth) ==========
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ========== Routes ==========
app.use('/', routes);

// ========== 404 Handler ==========
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route found for ${req.method} ${req.path}`,
  });
});

// ========== Global Error Handler ==========
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    // Never leak internal error details in production
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

export default app;
