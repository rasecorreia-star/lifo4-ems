/**
 * Server Initialization
 * Starts the Express server with environment configuration
 * Initializes Socket.IO for real-time communication
 */

import app from './app.js';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './lib/logger.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server and Socket.IO instance
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  logger.debug('Socket.IO client connected', { socketId: socket.id });

  // Handle decision updates
  socket.on('subscribe-decision', (systemId: string) => {
    socket.join(`decision:${systemId}`);
    logger.debug('Socket subscribed to decisions', { socketId: socket.id, systemId });
  });

  // Handle telemetry updates
  socket.on('subscribe-telemetry', (systemId: string) => {
    socket.join(`telemetry:${systemId}`);
    logger.debug('Socket subscribed to telemetry', { socketId: socket.id, systemId });
  });

  // Handle grid services updates
  socket.on('subscribe-grid', (systemId: string) => {
    socket.join(`grid:${systemId}`);
    logger.debug('Socket subscribed to grid services', { socketId: socket.id, systemId });
  });

  socket.on('disconnect', () => {
    logger.debug('Socket.IO client disconnected', { socketId: socket.id });
  });
});

// Export io for use in controllers
export { io };

// Start server
server.listen(PORT, () => {
  logger.info('LIFO4 EMS API started', {
    port: PORT,
    environment: NODE_ENV,
    docs: `http://localhost:${PORT}/api/v1/docs`,
  });
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
