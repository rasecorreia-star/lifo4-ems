/**
 * Optimization Socket Events
 * Real-time WebSocket handlers for optimization updates
 */

import { Server, Socket } from 'socket.io';
import { UnifiedDecisionEngine } from '../services/optimization/UnifiedDecisionEngine';

export function setupOptimizationSockets(io: Server) {
  const connections = new Map<string, Socket>();

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Subscribe to system updates
    socket.on('subscribe:system', (systemId: string) => {
      socket.join(`system:${systemId}`);
      console.log(`[Socket] User subscribed to ${systemId}`);
    });

    // Unsubscribe from system
    socket.on('unsubscribe:system', (systemId: string) => {
      socket.leave(`system:${systemId}`);
      console.log(`[Socket] User unsubscribed from ${systemId}`);
    });

    // Request immediate decision
    socket.on('request:decision', async (data) => {
      const { systemId, telemetry, gridState, marketData, constraints, config } = data;

      const engine = new UnifiedDecisionEngine(
        systemId,
        constraints,
        config
      );

      const decision = await engine.decide(telemetry, gridState, marketData);

      socket.emit('decision:update', {
        systemId,
        decision,
        timestamp: new Date().toISOString(),
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
      connections.delete(socket.id);
    });
  });

  // Broadcast telemetry to subscribed clients
  return {
    broadcastTelemetry: (systemId: string, telemetry: any) => {
      io.to(`system:${systemId}`).emit('telemetry:update', {
        systemId,
        telemetry,
        timestamp: new Date().toISOString(),
      });
    },

    broadcastDecision: (systemId: string, decision: any) => {
      io.to(`system:${systemId}`).emit('decision:update', {
        systemId,
        decision,
        timestamp: new Date().toISOString(),
      });
    },

    broadcastAlert: (systemId: string, alert: any) => {
      io.to(`system:${systemId}`).emit('alert:new', {
        systemId,
        alert,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
