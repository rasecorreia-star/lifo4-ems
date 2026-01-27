import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { telemetryService } from '../services/telemetry.service.js';
import { getFirestore, Collections } from '../config/firebase.js';
import { ConnectionStatus } from '../models/types.js';

interface MqttMessage {
  topic: string;
  payload: string;
  timestamp: Date;
}

type MessageHandler = (topic: string, payload: Buffer) => void;

export class MqttService {
  private client: MqttClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private db = getFirestore();

  /**
   * Initialize MQTT connection
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const options: IClientOptions = {
      clientId: config.mqtt.clientId,
      username: config.mqtt.username,
      password: config.mqtt.password,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      keepalive: 60,
    };

    logger.info(`Connecting to MQTT broker: ${config.mqtt.brokerUrl}`);

    this.client = mqtt.connect(config.mqtt.brokerUrl, options);

    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Connected to MQTT broker');

      // Subscribe to system topics
      this.subscribeToSystemTopics();
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    this.client.on('error', (error) => {
      logger.error('MQTT error', { error });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('MQTT connection closed');
    });

    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      logger.info(`MQTT reconnecting... Attempt ${this.reconnectAttempts}`);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Max MQTT reconnect attempts reached');
      }
    });

    this.client.on('offline', () => {
      this.isConnected = false;
      logger.warn('MQTT client offline');
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client?.end(false, {}, () => {
          this.client = null;
          this.isConnected = false;
          logger.info('Disconnected from MQTT broker');
          resolve();
        });
      });
    }
  }

  /**
   * Subscribe to all system topics
   */
  private async subscribeToSystemTopics(): Promise<void> {
    if (!this.client) return;

    // Subscribe to wildcard topic for all systems
    const topics = [
      'lifo4/+/telemetry',      // Telemetry data from devices
      'lifo4/+/status',         // Device status updates
      'lifo4/+/response',       // Command responses
      'lifo4/+/alarm',          // Alarm notifications
    ];

    for (const topic of topics) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}`, { error: err });
        } else {
          logger.info(`Subscribed to ${topic}`);
        }
      });
    }

    // Also subscribe to specific system topics from database
    const systemsSnapshot = await this.db
      .collection(Collections.SYSTEMS)
      .where('isActive', '==', true)
      .get();

    for (const doc of systemsSnapshot.docs) {
      const system = doc.data();
      if (system.mqttTopic) {
        this.client.subscribe(`${system.mqttTopic}/telemetry`, { qos: 1 });
        this.client.subscribe(`${system.mqttTopic}/status`, { qos: 1 });
        this.client.subscribe(`${system.mqttTopic}/response`, { qos: 1 });
      }
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      const message = payload.toString();
      logger.debug(`MQTT message received: ${topic}`, { messageLength: message.length });

      // Parse topic to get system ID and message type
      const topicParts = topic.split('/');
      const messageType = topicParts[topicParts.length - 1];
      const systemId = topicParts[topicParts.length - 2];

      // Handle different message types
      switch (messageType) {
        case 'telemetry':
          await this.handleTelemetry(systemId, message);
          break;

        case 'status':
          await this.handleStatusUpdate(systemId, message);
          break;

        case 'response':
          await this.handleCommandResponse(systemId, message);
          break;

        case 'alarm':
          await this.handleAlarm(systemId, message);
          break;

        default:
          logger.warn(`Unknown message type: ${messageType}`);
      }

      // Call registered handlers
      const handlers = this.messageHandlers.get(topic) || this.messageHandlers.get(topicParts.slice(0, -1).join('/') + '/+');
      if (handlers) {
        for (const handler of handlers) {
          handler(topic, payload);
        }
      }
    } catch (error) {
      logger.error('Error handling MQTT message', { error, topic });
    }
  }

  /**
   * Handle telemetry data from device
   */
  private async handleTelemetry(systemId: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      // Process telemetry through service
      await telemetryService.processTelemetry(systemId, {
        packVoltage: data.v || 0,
        current: data.i || 0,
        soc: data.soc || 0,
        cellVoltages: data.cells || [],
        temperatures: data.temps || [],
        balancingStatus: data.bal || 0,
        alarms: data.alm || 0,
        warnings: data.wrn || 0,
        cycleCount: data.cyc || 0,
        capacity: data.cap || 0,
      });
    } catch (error) {
      logger.error('Error processing telemetry', { error, systemId });
    }
  }

  /**
   * Handle device status update
   */
  private async handleStatusUpdate(systemId: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      const connectionStatus: ConnectionStatus =
        data.online === true ? ConnectionStatus.ONLINE :
        data.online === false ? ConnectionStatus.OFFLINE :
        ConnectionStatus.DEGRADED;

      await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
        connectionStatus,
        lastCommunication: new Date(),
        firmwareVersion: data.firmware || null,
        rssi: data.rssi || null,
        freeHeap: data.heap || null,
      });

      logger.debug(`System ${systemId} status updated: ${connectionStatus}`);
    } catch (error) {
      logger.error('Error processing status update', { error, systemId });
    }
  }

  /**
   * Handle command response from device
   */
  private async handleCommandResponse(systemId: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      // Store response in events collection
      await this.db.collection(Collections.EVENTS).add({
        systemId,
        type: 'command_response',
        requestId: data.requestId,
        success: data.success,
        message: data.message,
        data: data.data,
        timestamp: new Date(),
      });

      if (!data.success) {
        logger.warn(`Command failed for system ${systemId}`, { data });
      }
    } catch (error) {
      logger.error('Error processing command response', { error, systemId });
    }
  }

  /**
   * Handle alarm from device
   */
  private async handleAlarm(systemId: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      // Get system organization
      const systemDoc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
      const organizationId = systemDoc.data()?.organizationId || '';

      // Create alert
      await this.db.collection(Collections.ALERTS).add({
        systemId,
        organizationId,
        type: data.type || 'device_alarm',
        severity: data.severity || 'high',
        title: data.title || 'Alarme do Dispositivo',
        message: data.message || 'Alarme recebido do dispositivo',
        data: data,
        isRead: false,
        isAcknowledged: false,
        createdAt: new Date(),
      });

      logger.warn(`Alarm received from system ${systemId}`, { data });
    } catch (error) {
      logger.error('Error processing alarm', { error, systemId });
    }
  }

  /**
   * Publish message to MQTT topic
   */
  async publish(topic: string, message: string, qos: 0 | 1 | 2 = 1): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.error('MQTT client not connected');
      return false;
    }

    return new Promise((resolve) => {
      this.client!.publish(topic, message, { qos }, (err) => {
        if (err) {
          logger.error(`Failed to publish to ${topic}`, { error: err });
          resolve(false);
        } else {
          logger.debug(`Published to ${topic}`, { messageLength: message.length });
          resolve(true);
        }
      });
    });
  }

  /**
   * Subscribe to a topic with a handler
   */
  subscribe(topic: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(topic)) {
      this.messageHandlers.set(topic, []);
    }
    this.messageHandlers.get(topic)!.push(handler);

    if (this.client && this.isConnected) {
      this.client.subscribe(topic, { qos: 1 });
    }
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string): void {
    this.messageHandlers.delete(topic);

    if (this.client && this.isConnected) {
      this.client.unsubscribe(topic);
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

export const mqttService = new MqttService();
