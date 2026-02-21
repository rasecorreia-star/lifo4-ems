/**
 * Server Initialization
 * Starts the Express server with environment configuration
 * Initializes Socket.IO for real-time communication
 */

import app from './app';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

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
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Handle decision updates
  socket.on('subscribe-decision', (systemId: string) => {
    socket.join(`decision:${systemId}`);
    console.log(`[Socket.IO] Client ${socket.id} subscribed to decisions for system ${systemId}`);
  });

  // Handle telemetry updates
  socket.on('subscribe-telemetry', (systemId: string) => {
    socket.join(`telemetry:${systemId}`);
    console.log(`[Socket.IO] Client ${socket.id} subscribed to telemetry for system ${systemId}`);
  });

  // Handle grid services updates
  socket.on('subscribe-grid', (systemId: string) => {
    socket.join(`grid:${systemId}`);
    console.log(`[Socket.IO] Client ${socket.id} subscribed to grid services for system ${systemId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Export io for use in controllers
export { io };

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║         🔋 LIFO4 EMS - Energy Management System API            ║
║                                                                ║
║  Server running on: http://localhost:${PORT}
║  Environment: ${NODE_ENV}
║  API Documentation: http://localhost:${PORT}/api/v1/docs
║                                                                ║
║  Available Modules:                                            ║
║  - Unified Decision Engine (5-level priority)                  ║
║  - Energy Arbitrage (buy/sell optimization)                    ║
║  - Peak Shaving (demand management)                            ║
║  - Grid Services (grid integration & VPP)                      ║
║  - Black Start (grid restoration)                              ║
║  - Forecasting (5 ML models - 94.5% accuracy)                  ║
║  - Battery Health (SOH monitoring & RUL)                       ║
║  - Predictive Maintenance (failure prediction)                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default server;
