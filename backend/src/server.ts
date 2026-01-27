import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';

import { config, validateConfig } from './config/index.js';
import { initializeFirebase } from './config/firebase.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { defaultLimiter } from './middlewares/rateLimit.middleware.js';
import { mqttService } from './mqtt/mqtt.service.js';
import { socketService } from './websocket/socket.service.js';
import { logger } from './utils/logger.js';

// Validate configuration
validateConfig();

// Initialize Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - allow multiple origins in development
app.use(cors({
  origin: config.env === 'development'
    ? [config.frontendUrl, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']
    : config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// Rate limiting (global)
app.use(defaultLimiter);

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Routes
app.use(routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize Firebase
    logger.info('Initializing Firebase...');
    initializeFirebase();

    // Initialize MQTT
    logger.info('Connecting to MQTT broker...');
    await mqttService.connect();

    // Initialize WebSocket
    logger.info('Initializing WebSocket server...');
    socketService.initialize(httpServer);

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`
========================================
🔋 Lifo4 EMS Server Started
========================================
Environment: ${config.env}
Port: ${config.port}
API Version: ${config.apiVersion}
Frontend URL: ${config.frontendUrl}
========================================
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Disconnect MQTT
  await mqttService.disconnect();
  logger.info('MQTT disconnected');

  // Close database connections (Firebase handles this automatically)

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

// Start server
startServer();

export { app, httpServer };
