/**
 * Universal Protocol Adapter Service
 * Auto-detection and adaptation for any industrial protocol
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export enum ProtocolType {
  MODBUS_RTU = 'modbus_rtu',
  MODBUS_TCP = 'modbus_tcp',
  CANBUS = 'canbus',
  IEC_61850 = 'iec_61850',
  SUNSPEC = 'sunspec',
  PROPRIETARY = 'proprietary',
  UNKNOWN = 'unknown'
}

export enum DeviceType {
  BMS = 'bms',
  PCS = 'pcs',
  INVERTER = 'inverter',
  METER = 'meter',
  SENSOR = 'sensor',
  CONTROLLER = 'controller',
  UNKNOWN = 'unknown'
}

export interface DetectionResult {
  protocol: ProtocolType;
  confidence: number;
  deviceType: DeviceType;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  registerMap?: RegisterMap;
  topPredictions?: Array<{
    protocol: string;
    confidence: number;
  }>;
}

export interface RegisterDefinition {
  address: number;
  name: string;
  dataType: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string';
  scale: number;
  unit: string;
  description: string;
  readable: boolean;
  writable: boolean;
  category: string;
}

export interface RegisterMap {
  deviceId: string;
  protocol: ProtocolType;
  manufacturer: string;
  model: string;
  registers: RegisterDefinition[];
  version: string;
  createdAt: Date;
}

export interface ConnectionConfig {
  id: string;
  type: 'serial' | 'tcp' | 'can';
  host?: string;
  port?: number;
  serialPort?: string;
  baudRate?: number;
  slaveId?: number;
  timeout?: number;
}

export interface AdapterStatus {
  connectionId: string;
  connected: boolean;
  protocol: ProtocolType;
  deviceType: DeviceType;
  lastActivity: Date;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  latencyMs: number;
}

// ============================================
// PROTOCOL HANDLER INTERFACE
// ============================================

export interface IProtocolHandler {
  protocol: ProtocolType;
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  read(address: number, count: number): Promise<number[]>;
  write(address: number, values: number[]): Promise<void>;
  parseResponse(data: Buffer): any;
  buildRequest(functionCode: number, address: number, data?: number[]): Buffer;
}

// ============================================
// MODBUS RTU HANDLER
// ============================================

class ModbusRtuHandler implements IProtocolHandler {
  protocol = ProtocolType.MODBUS_RTU;
  private connected = false;
  private slaveId = 1;

  async connect(config: ConnectionConfig): Promise<void> {
    this.slaveId = config.slaveId || 1;
    this.connected = true;
    logger.info(`Modbus RTU connected to ${config.serialPort}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async read(address: number, count: number): Promise<number[]> {
    // Implementation would use actual serial communication
    const request = this.buildRequest(0x03, address, [count]);
    logger.debug(`Modbus RTU read: address=${address}, count=${count}`);
    return new Array(count).fill(0);
  }

  async write(address: number, values: number[]): Promise<void> {
    const request = this.buildRequest(0x10, address, values);
    logger.debug(`Modbus RTU write: address=${address}, values=${values}`);
  }

  parseResponse(data: Buffer): any {
    if (data.length < 3) return null;

    const slaveId = data[0];
    const functionCode = data[1];

    if (functionCode & 0x80) {
      return {
        error: true,
        exceptionCode: data[2]
      };
    }

    if (functionCode === 0x03 || functionCode === 0x04) {
      const byteCount = data[2];
      const values: number[] = [];
      for (let i = 0; i < byteCount; i += 2) {
        values.push(data.readUInt16BE(3 + i));
      }
      return { values };
    }

    return { raw: data };
  }

  buildRequest(functionCode: number, address: number, data?: number[]): Buffer {
    const buffer = Buffer.alloc(8);
    buffer[0] = this.slaveId;
    buffer[1] = functionCode;
    buffer.writeUInt16BE(address, 2);

    if (data && data.length > 0) {
      buffer.writeUInt16BE(data[0], 4);
    }

    // Add CRC
    const crc = this.calculateCRC(buffer.slice(0, 6));
    buffer.writeUInt16LE(crc, 6);

    return buffer;
  }

  private calculateCRC(data: Buffer): number {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }
}

// ============================================
// MODBUS TCP HANDLER
// ============================================

class ModbusTcpHandler implements IProtocolHandler {
  protocol = ProtocolType.MODBUS_TCP;
  private connected = false;
  private transactionId = 0;
  private unitId = 1;

  async connect(config: ConnectionConfig): Promise<void> {
    this.unitId = config.slaveId || 1;
    this.connected = true;
    logger.info(`Modbus TCP connected to ${config.host}:${config.port}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async read(address: number, count: number): Promise<number[]> {
    const request = this.buildRequest(0x03, address, [count]);
    logger.debug(`Modbus TCP read: address=${address}, count=${count}`);
    return new Array(count).fill(0);
  }

  async write(address: number, values: number[]): Promise<void> {
    const request = this.buildRequest(0x10, address, values);
    logger.debug(`Modbus TCP write: address=${address}, values=${values}`);
  }

  parseResponse(data: Buffer): any {
    if (data.length < 9) return null;

    const transactionId = data.readUInt16BE(0);
    const protocolId = data.readUInt16BE(2);
    const length = data.readUInt16BE(4);
    const unitId = data[6];
    const functionCode = data[7];

    if (functionCode & 0x80) {
      return {
        error: true,
        exceptionCode: data[8]
      };
    }

    if (functionCode === 0x03 || functionCode === 0x04) {
      const byteCount = data[8];
      const values: number[] = [];
      for (let i = 0; i < byteCount; i += 2) {
        values.push(data.readUInt16BE(9 + i));
      }
      return { transactionId, values };
    }

    return { transactionId, raw: data };
  }

  buildRequest(functionCode: number, address: number, data?: number[]): Buffer {
    this.transactionId = (this.transactionId + 1) & 0xFFFF;

    const pduLength = functionCode === 0x10 ? 7 + (data?.length || 0) * 2 : 6;
    const buffer = Buffer.alloc(6 + pduLength);

    // MBAP Header
    buffer.writeUInt16BE(this.transactionId, 0);
    buffer.writeUInt16BE(0, 2); // Protocol ID (Modbus)
    buffer.writeUInt16BE(pduLength, 4);
    buffer[6] = this.unitId;

    // PDU
    buffer[7] = functionCode;
    buffer.writeUInt16BE(address, 8);

    if (data && data.length > 0) {
      buffer.writeUInt16BE(data[0], 10);
    }

    return buffer;
  }
}

// ============================================
// UNIVERSAL ADAPTER SERVICE
// ============================================

export class UniversalAdapterService extends EventEmitter {
  private static instance: UniversalAdapterService;

  private handlers: Map<string, IProtocolHandler> = new Map();
  private connections: Map<string, ConnectionConfig> = new Map();
  private registerMaps: Map<string, RegisterMap> = new Map();
  private statistics: Map<string, AdapterStatus> = new Map();

  private aiServiceUrl: string;

  private constructor() {
    super();
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  }

  static getInstance(): UniversalAdapterService {
    if (!UniversalAdapterService.instance) {
      UniversalAdapterService.instance = new UniversalAdapterService();
    }
    return UniversalAdapterService.instance;
  }

  /**
   * Auto-detect protocol from raw data
   */
  async detectProtocol(
    data: Buffer,
    metadata?: Record<string, any>
  ): Promise<DetectionResult> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/protocol/detect`,
        {
          data: data.toString('base64'),
          metadata
        }
      );

      const result = response.data;

      return {
        protocol: this.mapProtocolType(result.protocol),
        confidence: result.confidence,
        deviceType: this.mapDeviceType(result.device_type),
        manufacturer: result.manufacturer,
        model: result.model,
        firmwareVersion: result.firmware_version,
        topPredictions: result.top_predictions
      };
    } catch (error) {
      logger.error('Protocol detection failed:', error);

      // Fallback to local heuristic detection
      return this.localDetection(data);
    }
  }

  /**
   * Local heuristic-based detection (fallback)
   */
  private localDetection(data: Buffer): DetectionResult {
    // Check for Modbus TCP header
    if (data.length >= 7) {
      const protocolId = data.readUInt16BE(2);
      if (protocolId === 0) {
        return {
          protocol: ProtocolType.MODBUS_TCP,
          confidence: 0.7,
          deviceType: DeviceType.UNKNOWN
        };
      }
    }

    // Check for Modbus RTU
    if (data.length >= 4) {
      const functionCode = data[1] & 0x7F;
      if ([1, 2, 3, 4, 5, 6, 15, 16, 23].includes(functionCode)) {
        return {
          protocol: ProtocolType.MODBUS_RTU,
          confidence: 0.6,
          deviceType: DeviceType.UNKNOWN
        };
      }
    }

    // Check for SunSpec
    if (data.includes(Buffer.from('SunS'))) {
      return {
        protocol: ProtocolType.SUNSPEC,
        confidence: 0.9,
        deviceType: DeviceType.INVERTER
      };
    }

    // Check for CAN frame (8 bytes data)
    if (data.length === 8 || data.length === 13) {
      return {
        protocol: ProtocolType.CANBUS,
        confidence: 0.5,
        deviceType: DeviceType.UNKNOWN
      };
    }

    return {
      protocol: ProtocolType.UNKNOWN,
      confidence: 0.0,
      deviceType: DeviceType.UNKNOWN
    };
  }

  /**
   * Connect to device using detected or specified protocol
   */
  async connect(
    connectionId: string,
    config: ConnectionConfig,
    protocol?: ProtocolType
  ): Promise<void> {
    let handler: IProtocolHandler;

    // Create appropriate handler
    switch (protocol || ProtocolType.MODBUS_TCP) {
      case ProtocolType.MODBUS_RTU:
        handler = new ModbusRtuHandler();
        break;
      case ProtocolType.MODBUS_TCP:
      default:
        handler = new ModbusTcpHandler();
        break;
    }

    await handler.connect(config);

    this.handlers.set(connectionId, handler);
    this.connections.set(connectionId, config);
    this.statistics.set(connectionId, {
      connectionId,
      connected: true,
      protocol: handler.protocol,
      deviceType: DeviceType.UNKNOWN,
      lastActivity: new Date(),
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      latencyMs: 0
    });

    this.emit('connected', { connectionId, protocol: handler.protocol });
    logger.info(`Connected ${connectionId} using ${handler.protocol}`);
  }

  /**
   * Disconnect from device
   */
  async disconnect(connectionId: string): Promise<void> {
    const handler = this.handlers.get(connectionId);
    if (handler) {
      await handler.disconnect();
      this.handlers.delete(connectionId);
      this.connections.delete(connectionId);

      const status = this.statistics.get(connectionId);
      if (status) {
        status.connected = false;
      }

      this.emit('disconnected', { connectionId });
      logger.info(`Disconnected ${connectionId}`);
    }
  }

  /**
   * Read registers using register map
   */
  async readRegisters(
    connectionId: string,
    registerNames: string[]
  ): Promise<Map<string, any>> {
    const handler = this.handlers.get(connectionId);
    const registerMap = this.registerMaps.get(connectionId);

    if (!handler) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const results = new Map<string, any>();
    const startTime = Date.now();

    for (const name of registerNames) {
      const register = registerMap?.registers.find(r => r.name === name);

      if (!register) {
        logger.warn(`Register not found: ${name}`);
        continue;
      }

      try {
        const rawValues = await handler.read(register.address, this.getRegisterSize(register.dataType));
        const value = this.convertValue(rawValues, register);
        results.set(name, {
          value,
          unit: register.unit,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Failed to read register ${name}:`, error);
        this.updateStatistics(connectionId, { errors: 1 });
      }
    }

    const latencyMs = Date.now() - startTime;
    this.updateStatistics(connectionId, {
      messagesReceived: registerNames.length,
      latencyMs
    });

    return results;
  }

  /**
   * Write register value
   */
  async writeRegister(
    connectionId: string,
    registerName: string,
    value: number
  ): Promise<void> {
    const handler = this.handlers.get(connectionId);
    const registerMap = this.registerMaps.get(connectionId);

    if (!handler) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const register = registerMap?.registers.find(r => r.name === registerName);

    if (!register) {
      throw new Error(`Register not found: ${registerName}`);
    }

    if (!register.writable) {
      throw new Error(`Register not writable: ${registerName}`);
    }

    const rawValue = Math.round(value / register.scale);
    await handler.write(register.address, [rawValue]);

    this.updateStatistics(connectionId, { messagesSent: 1 });
    this.emit('registerWritten', { connectionId, registerName, value });
  }

  /**
   * Set register map for connection
   */
  setRegisterMap(connectionId: string, registerMap: RegisterMap): void {
    this.registerMaps.set(connectionId, registerMap);

    const status = this.statistics.get(connectionId);
    if (status) {
      status.deviceType = this.inferDeviceType(registerMap);
    }

    logger.info(`Register map set for ${connectionId}: ${registerMap.manufacturer} ${registerMap.model}`);
  }

  /**
   * Auto-discover and map registers
   */
  async autoDiscoverRegisters(
    connectionId: string,
    scanRange: { start: number; end: number }
  ): Promise<RegisterMap> {
    const handler = this.handlers.get(connectionId);

    if (!handler) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const samples: Array<{ address: number; values: number[] }> = [];

    // Scan register range
    for (let addr = scanRange.start; addr < scanRange.end; addr += 10) {
      try {
        const values = await handler.read(addr, Math.min(10, scanRange.end - addr));
        samples.push({ address: addr, values });
      } catch (error) {
        // Register not readable, skip
      }
    }

    // Send to AI service for analysis
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/protocol/analyze-registers`,
        { samples }
      );

      const registerMap: RegisterMap = {
        deviceId: connectionId,
        protocol: handler.protocol,
        manufacturer: response.data.manufacturer || 'Unknown',
        model: response.data.model || 'Unknown',
        registers: response.data.registers.map((r: any) => ({
          address: r.address,
          name: r.name,
          dataType: r.data_type || 'uint16',
          scale: r.scale || 1,
          unit: r.unit || '',
          description: r.description || '',
          readable: true,
          writable: r.writable || false,
          category: r.category || 'unknown'
        })),
        version: '1.0.0',
        createdAt: new Date()
      };

      this.setRegisterMap(connectionId, registerMap);
      return registerMap;
    } catch (error) {
      logger.error('Auto-discovery failed:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus(connectionId: string): AdapterStatus | undefined {
    return this.statistics.get(connectionId);
  }

  /**
   * Get all connection statuses
   */
  getAllStatuses(): AdapterStatus[] {
    return Array.from(this.statistics.values());
  }

  /**
   * Get register map for connection
   */
  getRegisterMap(connectionId: string): RegisterMap | undefined {
    return this.registerMaps.get(connectionId);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapProtocolType(protocol: string): ProtocolType {
    const mapping: Record<string, ProtocolType> = {
      'modbus_rtu': ProtocolType.MODBUS_RTU,
      'modbus_tcp': ProtocolType.MODBUS_TCP,
      'canbus': ProtocolType.CANBUS,
      'iec_61850': ProtocolType.IEC_61850,
      'sunspec': ProtocolType.SUNSPEC,
      'proprietary': ProtocolType.PROPRIETARY
    };
    return mapping[protocol] || ProtocolType.UNKNOWN;
  }

  private mapDeviceType(deviceType: string): DeviceType {
    const mapping: Record<string, DeviceType> = {
      'bms': DeviceType.BMS,
      'pcs': DeviceType.PCS,
      'inverter': DeviceType.INVERTER,
      'meter': DeviceType.METER,
      'sensor': DeviceType.SENSOR,
      'controller': DeviceType.CONTROLLER
    };
    return mapping[deviceType] || DeviceType.UNKNOWN;
  }

  private getRegisterSize(dataType: string): number {
    switch (dataType) {
      case 'uint32':
      case 'int32':
      case 'float32':
        return 2;
      case 'string':
        return 16;
      default:
        return 1;
    }
  }

  private convertValue(rawValues: number[], register: RegisterDefinition): number | string {
    const { dataType, scale } = register;

    switch (dataType) {
      case 'int16':
        const signed = rawValues[0] > 32767 ? rawValues[0] - 65536 : rawValues[0];
        return signed * scale;

      case 'uint32':
        const uint32 = (rawValues[0] << 16) | rawValues[1];
        return uint32 * scale;

      case 'int32':
        const int32 = (rawValues[0] << 16) | rawValues[1];
        const signedInt32 = int32 > 2147483647 ? int32 - 4294967296 : int32;
        return signedInt32 * scale;

      case 'float32':
        const buffer = Buffer.alloc(4);
        buffer.writeUInt16BE(rawValues[0], 0);
        buffer.writeUInt16BE(rawValues[1], 2);
        return buffer.readFloatBE(0) * scale;

      case 'string':
        return Buffer.from(rawValues.flatMap(v => [(v >> 8) & 0xFF, v & 0xFF]))
          .toString('utf8')
          .replace(/\0/g, '');

      default:
        return rawValues[0] * scale;
    }
  }

  private inferDeviceType(registerMap: RegisterMap): DeviceType {
    const categories = new Set(registerMap.registers.map(r => r.category));

    if (categories.has('soc') || categories.has('cell_voltage')) {
      return DeviceType.BMS;
    }
    if (categories.has('ac_power') || categories.has('dc_power')) {
      return DeviceType.PCS;
    }
    if (categories.has('pv_power')) {
      return DeviceType.INVERTER;
    }

    return DeviceType.UNKNOWN;
  }

  private updateStatistics(connectionId: string, updates: Partial<AdapterStatus>): void {
    const status = this.statistics.get(connectionId);
    if (status) {
      if (updates.messagesReceived) {
        status.messagesReceived += updates.messagesReceived;
      }
      if (updates.messagesSent) {
        status.messagesSent += updates.messagesSent;
      }
      if (updates.errors) {
        status.errors += updates.errors;
      }
      if (updates.latencyMs !== undefined) {
        status.latencyMs = updates.latencyMs;
      }
      status.lastActivity = new Date();
    }
  }
}

// Export singleton
export const universalAdapter = UniversalAdapterService.getInstance();
