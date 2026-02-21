import { io, Socket } from 'socket.io-client';
import { TelemetryData, Alert } from '../types';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private telemetryHandlers: Map<string, Set<(data: TelemetryData) => void>> = new Map();
  private globalTelemetryHandlers: Set<(data: TelemetryData & { systemId: string }) => void> = new Set();
  private alertHandlers: Set<(alert: Alert) => void> = new Set();
  private statusHandlers: Map<string, Set<(status: Record<string, unknown>) => void>> = new Map();
  private connectionHandlers: Set<(connected: boolean) => void> = new Set();

  /**
   * Connect to WebSocket server
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventHandlers();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.notifyConnectionHandlers(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.notifyConnectionHandlers(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.notifyConnectionHandlers(false);
    });

    this.socket.on('telemetry', (data: { systemId: string; data: TelemetryData }) => {
      // Notify system-specific handlers
      const handlers = this.telemetryHandlers.get(data.systemId);
      if (handlers) {
        handlers.forEach((handler) => handler(data.data));
      }
      // Notify global handlers
      this.globalTelemetryHandlers.forEach((handler) =>
        handler({ ...data.data, systemId: data.systemId })
      );
    });

    this.socket.on('alert', (data: { alert: Alert }) => {
      this.alertHandlers.forEach((handler) => handler(data.alert));
    });

    this.socket.on('system:status', (data: { systemId: string; status: Record<string, unknown> }) => {
      const handlers = this.statusHandlers.get(data.systemId);
      if (handlers) {
        handlers.forEach((handler) => handler(data.status));
      }
    });
  }

  /**
   * Subscribe to a system's telemetry updates
   */
  subscribeToSystem(systemId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:system', systemId);
    }
  }

  /**
   * Unsubscribe from a system's telemetry updates
   */
  unsubscribeFromSystem(systemId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:system', systemId);
    }
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:alerts');
    }
  }

  /**
   * Add global telemetry handler (receives updates from all systems)
   */
  onTelemetryUpdate(handler: (data: TelemetryData & { systemId: string }) => void): () => void {
    this.globalTelemetryHandlers.add(handler);
    return () => {
      this.globalTelemetryHandlers.delete(handler);
    };
  }

  /**
   * Add telemetry handler for a system
   */
  onTelemetry(systemId: string, handler: (data: TelemetryData) => void): () => void {
    if (!this.telemetryHandlers.has(systemId)) {
      this.telemetryHandlers.set(systemId, new Set());
    }
    this.telemetryHandlers.get(systemId)!.add(handler);

    // Subscribe to system if connected
    this.subscribeToSystem(systemId);

    // Return cleanup function
    return () => {
      const handlers = this.telemetryHandlers.get(systemId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.telemetryHandlers.delete(systemId);
          this.unsubscribeFromSystem(systemId);
        }
      }
    };
  }

  /**
   * Add alert handler
   */
  onAlert(handler: (alert: Alert) => void): () => void {
    this.alertHandlers.add(handler);
    this.subscribeToAlerts();

    return () => {
      this.alertHandlers.delete(handler);
    };
  }

  /**
   * Add system status handler
   */
  onSystemStatus(systemId: string, handler: (status: Record<string, unknown>) => void): () => void {
    if (!this.statusHandlers.has(systemId)) {
      this.statusHandlers.set(systemId, new Set());
    }
    this.statusHandlers.get(systemId)!.add(handler);

    return () => {
      const handlers = this.statusHandlers.get(systemId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.statusHandlers.delete(systemId);
        }
      }
    };
  }

  /**
   * Add connection state handler
   */
  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.add(handler);
    // Notify immediately with current state
    handler(this.socket?.connected || false);

    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Notify all connection handlers
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => handler(connected));
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
