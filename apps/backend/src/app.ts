/**
 * Express Application Setup
 * Configures middleware, error handling, and routes
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';

const app: Express = express();

// ========== Middleware ==========

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ========== Request Logging Middleware ==========
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ========== Health Check ==========
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'EMS Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

// ========== Routes ==========
app.use('/', routes);

// ========== 404 Handler ==========
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
    message: `No route found for ${req.method} ${req.path}`,
    availablePaths: [
      '/health',
      '/api/v1/optimization/*',
      '/api/v1/ml/*',
      '/api/v1/telemetry/*',
    ],
  });
});

// ========== Error Handler ==========
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    timestamp: new Date().toISOString(),
  });
});

export default app;
