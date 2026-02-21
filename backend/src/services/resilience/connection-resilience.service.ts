/**
 * Connection Resilience Service
 * Central service for managing connection resilience, buffering, and failover
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import {
  MessageBuffer,
  BufferedMessage,
  MessagePriority,
  BufferStats,
  messageBuffer,
} from './message-buffer.js';
import {
  CompressionService,
  CompressionAlgorithm,
  CompressionResult,
  compressionService,
} from './compression.service.js';
import {
  FailoverManager,
  ConnectionEndpoint,
  EndpointType,
  EndpointStatus,
  FailoverPolicy,
  FailoverMode,
  failoverManager,
} from './failover-manager.js';

// ============================================
// TYPES
// ============================================

export enum ConnectionState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
}

export interface ResilienceConfig {
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  bufferWhenOffline: boolean;
  compressMessages: boolean;
  compressionThreshold: number;  // bytes
  prioritizeCommands: boolean;
  flushOnReconnect: boolean;
  offlineGracePeriod: number;  // ms before marking as offline
}

export interface ConnectionHealth {
  state: ConnectionState;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  bufferedMessages: number;
  activeEndpoint?: string;
  latencyMs?: number;
  packetLoss?: number;
}

export interface TransmissionResult {
  success: boolean;
  messageId?: string;
  buffered: boolean;
  compressed: boolean;
  latencyMs?: number;
  error?: string;
}

// ============================================
// CONNECTION RESILIENCE SERVICE
// ============================================

export class ConnectionResilienceService extends EventEmitter {
  private buffer: MessageBuffer;
  private compression: CompressionService;
  private failover: FailoverManager;

  private config: ResilienceConfig;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private lastConnected?: Date;
  private lastDisconnected?: Date;
  private reconnectAttempts: number = 0;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private offlineTimer: NodeJS.Timeout | null = null;
  private sendFn?: (endpoint: ConnectionEndpoint, data: Buffer) => Promise<void>;

  constructor(
    buffer?: MessageBuffer,
    compression?: CompressionService,
    failover?: FailoverManager,
    config?: Partial<ResilienceConfig>
  ) {
    super();

    this.buffer = buffer || messageBuffer;
    this.compression = compression || compressionService;
    this.failover = failover || failoverManager;

    this.config = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      bufferWhenOffline: true,
      compressMessages: true,
      compressionThreshold: 500,
      prioritizeCommands: true,
      flushOnReconnect: true,
      offlineGracePeriod: 30000,
      ...config,
    };

    this.setupEventListeners();
  }

  /**
   * Initialize with a send function
   */
  initialize(sendFn: (endpoint: ConnectionEndpoint, data: Buffer) => Promise<void>): void {
    this.sendFn = sendFn;
    logger.info('Connection resilience service initialized');
  }

  /**
   * Register a connection endpoint
   */
  registerEndpoint(
    id: string,
    name: string,
    url: string,
    type: EndpointType = EndpointType.PRIMARY,
    groupId: string = 'default'
  ): void {
    const endpoint: ConnectionEndpoint = {
      id,
      name,
      type,
      url,
      priority: type === EndpointType.PRIMARY ? 0 : type === EndpointType.SECONDARY ? 1 : 2,
      healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
        successThreshold: 2,
        failureThreshold: 3,
        method: 'tcp',
      },
      status: EndpointStatus.UNKNOWN,
      failureCount: 0,
    };

    this.failover.registerEndpoint(endpoint, groupId);
  }

  /**
   * Set failover policy
   */
  setFailoverPolicy(groupId: string, policy: Partial<FailoverPolicy>): void {
    this.failover.setPolicy(groupId, policy);
  }

  /**
   * Report connection established
   */
  onConnected(endpointId?: string): void {
    this.connectionState = ConnectionState.CONNECTED;
    this.lastConnected = new Date();
    this.reconnectAttempts = 0;

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }

    if (endpointId) {
      this.failover.reportSuccess(endpointId);
    }

    logger.info('Connection established');
    this.emit('connected', { endpointId });

    // Flush buffered messages
    if (this.config.flushOnReconnect) {
      this.flushBuffer();
    }
  }

  /**
   * Report connection lost
   */
  onDisconnected(endpointId?: string, error?: Error): void {
    this.connectionState = ConnectionState.DISCONNECTED;
    this.lastDisconnected = new Date();

    if (endpointId) {
      this.failover.reportFailure(endpointId, error);
    }

    logger.warn('Connection lost', { endpointId, error: error?.message });
    this.emit('disconnected', { endpointId, error });

    // Start reconnection
    if (this.config.autoReconnect) {
      this.startReconnection();
    }

    // Start offline timer
    this.startOfflineTimer();
  }

  /**
   * Send message with resilience
   */
  async send(
    topic: string,
    payload: Buffer,
    options: {
      priority?: MessagePriority;
      groupId?: string;
      maxRetries?: number;
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<TransmissionResult> {
    const priority = options.priority ?? MessagePriority.NORMAL;
    const groupId = options.groupId || 'default';

    // If offline, buffer the message
    if (this.connectionState === ConnectionState.OFFLINE ||
        this.connectionState === ConnectionState.DISCONNECTED) {
      if (this.config.bufferWhenOffline) {
        const messageId = this.bufferMessage(topic, payload, priority, options);
        return {
          success: false,
          messageId,
          buffered: true,
          compressed: false,
          error: 'Connection offline, message buffered',
        };
      }
      return {
        success: false,
        buffered: false,
        compressed: false,
        error: 'Connection offline, buffering disabled',
      };
    }

    // Compress if enabled and above threshold
    let dataToSend = payload;
    let compressed = false;
    let compressionResult: CompressionResult | undefined;

    if (this.config.compressMessages && payload.length > this.config.compressionThreshold) {
      compressionResult = this.compression.compressAdaptive(payload);
      if (compressionResult.algorithm !== CompressionAlgorithm.NONE) {
        dataToSend = compressionResult.data;
        compressed = true;
      }
    }

    // Try to send
    try {
      const startTime = Date.now();

      await this.failover.executeWithFailover(groupId, async (endpoint) => {
        if (!this.sendFn) {
          throw new Error('Send function not initialized');
        }
        await this.sendFn(endpoint, dataToSend);
      });

      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        buffered: false,
        compressed,
        latencyMs,
      };
    } catch (error) {
      // Buffer on failure
      if (this.config.bufferWhenOffline) {
        const messageId = this.bufferMessage(topic, payload, priority, options);
        return {
          success: false,
          messageId,
          buffered: true,
          compressed: false,
          error: (error as Error).message,
        };
      }

      return {
        success: false,
        buffered: false,
        compressed: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send command with high priority
   */
  async sendCommand(
    topic: string,
    payload: Buffer,
    groupId: string = 'default'
  ): Promise<TransmissionResult> {
    return this.send(topic, payload, {
      priority: MessagePriority.CRITICAL,
      groupId,
      maxRetries: 5,
    });
  }

  /**
   * Send telemetry with normal priority
   */
  async sendTelemetry(
    topic: string,
    payload: Buffer,
    groupId: string = 'default'
  ): Promise<TransmissionResult> {
    return this.send(topic, payload, {
      priority: MessagePriority.NORMAL,
      groupId,
      expiresAt: new Date(Date.now() + 60000),  // Expire in 1 minute
    });
  }

  /**
   * Get connection health
   */
  getHealth(groupId: string = 'default'): ConnectionHealth {
    const activeEndpoint = this.failover.getActiveEndpoint(groupId);
    const bufferStats = this.buffer.getStats();

    return {
      state: this.connectionState,
      lastConnected: this.lastConnected,
      lastDisconnected: this.lastDisconnected,
      reconnectAttempts: this.reconnectAttempts,
      bufferedMessages: bufferStats.totalMessages,
      activeEndpoint: activeEndpoint?.id,
      latencyMs: activeEndpoint?.latencyMs,
    };
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): BufferStats {
    return this.buffer.getStats();
  }

  /**
   * Get compression statistics
   */
  getCompressionStats() {
    return this.compression.getStats();
  }

  /**
   * Get all endpoints status
   */
  getEndpointsStatus(groupId: string = 'default') {
    return this.failover.getGroupEndpoints(groupId).map(ep => ({
      ...ep,
      circuitState: this.failover.getEndpointStatus(ep.id)?.circuitState,
      available: this.failover.getEndpointStatus(ep.id)?.available,
    }));
  }

  /**
   * Trigger manual failover
   */
  async triggerFailover(
    groupId: string = 'default',
    targetEndpointId?: string
  ): Promise<boolean> {
    return this.failover.triggerFailover(groupId, 'manual', targetEndpointId);
  }

  /**
   * Force flush buffer
   */
  async flushBuffer(): Promise<number> {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      return 0;
    }

    let flushed = 0;
    let message: BufferedMessage | undefined;

    while ((message = this.buffer.pop()) !== undefined) {
      try {
        const result = await this.send(message.topic, message.payload, {
          priority: message.priority,
          metadata: message.metadata,
        });

        if (result.success) {
          flushed++;
        } else if (result.buffered) {
          // Message was re-buffered, stop flushing
          break;
        }
      } catch (error) {
        // Re-buffer the message
        this.buffer.requeue(message);
        break;
      }
    }

    logger.info(`Flushed ${flushed} buffered messages`);
    this.emit('bufferFlushed', { count: flushed });

    return flushed;
  }

  /**
   * Update network conditions
   */
  updateNetworkConditions(bandwidthKbps: number, latencyMs?: number): void {
    this.compression.updateNetworkConditions(bandwidthKbps, latencyMs);

    // Adjust state based on conditions
    if (this.connectionState === ConnectionState.CONNECTED) {
      if (bandwidthKbps < 50) {
        this.connectionState = ConnectionState.DEGRADED;
        this.emit('degraded', { bandwidthKbps, latencyMs });
      }
    }
  }

  /**
   * Persist buffer to disk
   */
  async persistBuffer(): Promise<string> {
    return this.buffer.persistToDisk();
  }

  /**
   * Load buffer from disk
   */
  async loadBuffer(filepath: string): Promise<number> {
    return this.buffer.loadFromDisk(filepath);
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
    }

    this.failover.shutdown();
    await this.buffer.shutdown();

    logger.info('Connection resilience service shutdown');
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private setupEventListeners(): void {
    this.failover.on('failover', (event) => {
      this.emit('failover', event);
    });

    this.failover.on('circuitOpened', (data) => {
      this.emit('circuitOpened', data);
    });

    this.buffer.on('messageDropped', (data) => {
      this.emit('messageDropped', data);
    });
  }

  private bufferMessage(
    topic: string,
    payload: Buffer,
    priority: MessagePriority,
    options: {
      maxRetries?: number;
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
    }
  ): string {
    return this.buffer.add({
      topic,
      priority,
      payload,
      maxRetries: options.maxRetries || 3,
      expiresAt: options.expiresAt,
      metadata: options.metadata || {},
    });
  }

  private startReconnection(): void {
    if (this.reconnectInterval) return;

    this.connectionState = ConnectionState.RECONNECTING;

    this.reconnectInterval = setInterval(async () => {
      if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        clearInterval(this.reconnectInterval!);
        this.reconnectInterval = null;
        this.connectionState = ConnectionState.OFFLINE;
        logger.error('Max reconnection attempts reached');
        this.emit('maxReconnectReached');
        return;
      }

      this.reconnectAttempts++;
      logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
      this.emit('reconnecting', { attempt: this.reconnectAttempts });

      // Trigger failover to try next endpoint
      await this.failover.triggerFailover('default', 'reconnection');
    }, this.config.reconnectInterval);
  }

  private startOfflineTimer(): void {
    if (this.offlineTimer) return;

    this.offlineTimer = setTimeout(() => {
      if (this.connectionState !== ConnectionState.CONNECTED) {
        this.connectionState = ConnectionState.OFFLINE;
        logger.warn('Connection marked as offline');
        this.emit('offline');
      }
    }, this.config.offlineGracePeriod);
  }
}

// Export singleton and sub-services
export const connectionResilience = new ConnectionResilienceService(
  messageBuffer,
  compressionService,
  failoverManager
);

export {
  messageBuffer,
  compressionService,
  failoverManager,
};
