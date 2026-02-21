import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getFirestore, Collections } from '../config/firebase.js';
import { User, UserRole, TelemetryData, Alert } from '../models/types.js';

interface AuthenticatedSocket extends Socket {
  user?: User;
  systemSubscriptions?: Set<string>;
}

export class SocketService {
  private io: Server | null = null;
  private db = getFirestore();
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
        const userDoc = await this.db.collection(Collections.USERS).doc(decoded.userId).get();

        if (!userDoc.exists) {
          return next(new Error('User not found'));
        }

        const userData = userDoc.data();
        if (!userData?.isActive) {
          return next(new Error('User deactivated'));
        }

        socket.user = {
          id: userDoc.id,
          ...userData,
        } as User;

        socket.systemSubscriptions = new Set();

        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const user = socket.user!;
    logger.info(`User connected: ${user.email}`, { socketId: socket.id });

    // Track connected user
    if (!this.connectedUsers.has(user.id)) {
      this.connectedUsers.set(user.id, new Set());
    }
    this.connectedUsers.get(user.id)!.add(socket.id);

    // Join organization room
    socket.join(`org:${user.organizationId}`);

    // Super admin joins all rooms
    if (user.role === UserRole.SUPER_ADMIN) {
      socket.join('admin');
    }

    // Handle events
    socket.on('subscribe:system', (systemId: string) => {
      this.handleSystemSubscription(socket, systemId);
    });

    socket.on('unsubscribe:system', (systemId: string) => {
      this.handleSystemUnsubscription(socket, systemId);
    });

    socket.on('subscribe:alerts', () => {
      socket.join(`alerts:${user.organizationId}`);
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    socket.on('error', (error) => {
      logger.error('Socket error', { error, userId: user.id });
    });

    // Send initial connection success
    socket.emit('connected', {
      userId: user.id,
      organizationId: user.organizationId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle system subscription
   */
  private async handleSystemSubscription(socket: AuthenticatedSocket, systemId: string): Promise<void> {
    const user = socket.user!;

    // Verify access to system
    if (user.role !== UserRole.SUPER_ADMIN) {
      const systemDoc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
      if (!systemDoc.exists || systemDoc.data()?.organizationId !== user.organizationId) {
        socket.emit('error', { message: 'Access denied to system' });
        return;
      }
    }

    // Join system room
    socket.join(`system:${systemId}`);
    socket.systemSubscriptions?.add(systemId);

    // Send current telemetry
    const telemetryDoc = await this.db.collection(Collections.TELEMETRY).doc(systemId).get();
    if (telemetryDoc.exists) {
      socket.emit('telemetry', {
        systemId,
        data: telemetryDoc.data(),
      });
    }

    logger.debug(`User ${user.id} subscribed to system ${systemId}`);
  }

  /**
   * Handle system unsubscription
   */
  private handleSystemUnsubscription(socket: AuthenticatedSocket, systemId: string): void {
    socket.leave(`system:${systemId}`);
    socket.systemSubscriptions?.delete(systemId);
    logger.debug(`User ${socket.user?.id} unsubscribed from system ${systemId}`);
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const user = socket.user;
    if (user) {
      const userSockets = this.connectedUsers.get(user.id);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(user.id);
        }
      }
      logger.info(`User disconnected: ${user.email}`, { reason });
    }
  }

  /**
   * Broadcast telemetry update to subscribed clients
   */
  broadcastTelemetry(systemId: string, data: TelemetryData): void {
    if (!this.io) return;

    this.io.to(`system:${systemId}`).emit('telemetry', {
      systemId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast alert to organization
   */
  broadcastAlert(alert: Alert): void {
    if (!this.io) return;

    this.io.to(`org:${alert.organizationId}`).emit('alert', {
      alert,
      timestamp: Date.now(),
    });

    // Also send to admin room
    this.io.to('admin').emit('alert', {
      alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast system status change
   */
  broadcastSystemStatus(systemId: string, status: Record<string, unknown>): void {
    if (!this.io) return;

    this.io.to(`system:${systemId}`).emit('system:status', {
      systemId,
      status,
      timestamp: Date.now(),
    });
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  /**
   * Broadcast to organization
   */
  broadcastToOrganization(organizationId: string, event: string, data: unknown): void {
    if (!this.io) return;

    this.io.to(`org:${organizationId}`).emit(event, data);
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get online status for a user
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.connectedUsers.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * Get WebSocket server instance
   */
  getServer(): Server | null {
    return this.io;
  }
}

export const socketService = new SocketService();
