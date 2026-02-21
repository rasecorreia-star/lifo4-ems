/**
 * Hardware Abstraction Service
 * Provides hardware-agnostic interface for different BMS, inverters, and meters
 * Supports retrofits with multiple protocol adapters
 */

import { getFirestore, Collections } from '../../config/firebase.js';
import { mqttService } from '../../mqtt/mqtt.service.js';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export enum HardwareType {
  BMS = 'bms',
  INVERTER = 'inverter',
  METER = 'meter',
  PCS = 'pcs', // Power Conversion System
  HVAC = 'hvac',
  FIRE_SUPPRESSION = 'fire_suppression',
  CONTACTOR = 'contactor',
  SENSOR = 'sensor',
}

export enum Protocol {
  MODBUS_RTU = 'modbus_rtu',
  MODBUS_TCP = 'modbus_tcp',
  CANBUS = 'canbus',
  RS485 = 'rs485',
  RS232 = 'rs232',
  SUNSPEC = 'sunspec',
  IEC61850 = 'iec61850',
  DNP3 = 'dnp3',
  PROPRIETARY = 'proprietary',
  MQTT = 'mqtt',
  REST_API = 'rest_api',
}

export interface HardwareDevice {
  id: string;
  systemId: string;
  type: HardwareType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion?: string;
  protocol: Protocol;
  connectionConfig: ConnectionConfig;
  registerMap?: RegisterMap;
  status: 'online' | 'offline' | 'error' | 'configuring';
  lastCommunication?: Date;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface ConnectionConfig {
  // Modbus RTU / RS485
  port?: string; // e.g., /dev/ttyUSB0
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  slaveId?: number;

  // Modbus TCP / REST
  host?: string;
  tcpPort?: number;

  // CAN Bus
  canInterface?: string;
  canBitrate?: number;

  // MQTT
  topic?: string;

  // Timeouts
  timeout?: number;
  retries?: number;
}

export interface RegisterMap {
  manufacturer: string;
  model: string;
  version: string;
  registers: RegisterDefinition[];
}

export interface RegisterDefinition {
  name: string;
  description: string;
  address: number;
  length: number;
  type: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string' | 'bitmap';
  scale?: number;
  offset?: number;
  unit?: string;
  access: 'read' | 'write' | 'readwrite';
  mapping: string; // Maps to standard field name
}

export interface StandardTelemetry {
  timestamp: Date;
  deviceId: string;

  // BMS Standard Fields
  soc?: number;
  soh?: number;
  packVoltage?: number;
  current?: number;
  power?: number;
  cellVoltages?: number[];
  temperatures?: number[];
  alarms?: number;
  warnings?: number;
  cycleCount?: number;
  capacity?: number;

  // Inverter Standard Fields
  acPower?: number;
  acVoltage?: number;
  acCurrent?: number;
  acFrequency?: number;
  dcPower?: number;
  dcVoltage?: number;
  dcCurrent?: number;
  efficiency?: number;
  operatingMode?: string;
  gridStatus?: string;

  // Meter Standard Fields
  importEnergy?: number;
  exportEnergy?: number;
  activePower?: number;
  reactivePower?: number;
  powerFactor?: number;

  // Raw data for debugging
  rawData?: Record<string, unknown>;
}

export interface ProtocolAdapter {
  protocol: Protocol;
  connect: (config: ConnectionConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  read: (registers: RegisterDefinition[]) => Promise<Map<string, unknown>>;
  write: (register: RegisterDefinition, value: unknown) => Promise<boolean>;
  isConnected: () => boolean;
}

// ============================================
// BUILT-IN REGISTER MAPS
// ============================================

export const BUILTIN_REGISTER_MAPS: Record<string, RegisterMap> = {
  // JBD BMS (common Chinese BMS)
  'jbd_bms': {
    manufacturer: 'JBD',
    model: 'SP04S020',
    version: '1.0',
    registers: [
      { name: 'pack_voltage', description: 'Pack Voltage', address: 0x00, length: 1, type: 'uint16', scale: 0.01, unit: 'V', access: 'read', mapping: 'packVoltage' },
      { name: 'current', description: 'Current', address: 0x01, length: 1, type: 'int16', scale: 0.01, unit: 'A', access: 'read', mapping: 'current' },
      { name: 'remaining_capacity', description: 'Remaining Capacity', address: 0x02, length: 1, type: 'uint16', scale: 0.01, unit: 'Ah', access: 'read', mapping: 'capacity' },
      { name: 'full_capacity', description: 'Full Capacity', address: 0x03, length: 1, type: 'uint16', scale: 0.01, unit: 'Ah', access: 'read', mapping: 'fullCapacity' },
      { name: 'cycle_count', description: 'Cycle Count', address: 0x04, length: 1, type: 'uint16', access: 'read', mapping: 'cycleCount' },
      { name: 'soc', description: 'State of Charge', address: 0x05, length: 1, type: 'uint16', unit: '%', access: 'read', mapping: 'soc' },
      { name: 'cell_voltages', description: 'Cell Voltages', address: 0x10, length: 16, type: 'uint16', scale: 0.001, unit: 'V', access: 'read', mapping: 'cellVoltages' },
      { name: 'temperatures', description: 'Temperatures', address: 0x20, length: 4, type: 'int16', scale: 0.1, offset: -2731, unit: 'C', access: 'read', mapping: 'temperatures' },
      { name: 'alarms', description: 'Alarm Status', address: 0x30, length: 1, type: 'bitmap', access: 'read', mapping: 'alarms' },
    ],
  },

  // Daly BMS
  'daly_bms': {
    manufacturer: 'Daly',
    model: 'Smart BMS',
    version: '1.0',
    registers: [
      { name: 'soc', description: 'State of Charge', address: 0x90, length: 1, type: 'uint16', unit: '%', access: 'read', mapping: 'soc' },
      { name: 'pack_voltage', description: 'Pack Voltage', address: 0x90, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', mapping: 'packVoltage' },
      { name: 'current', description: 'Current', address: 0x90, length: 1, type: 'int16', scale: 0.1, offset: -30000, unit: 'A', access: 'read', mapping: 'current' },
      { name: 'cell_voltages', description: 'Cell Voltages', address: 0x95, length: 48, type: 'uint16', scale: 0.001, unit: 'V', access: 'read', mapping: 'cellVoltages' },
      { name: 'temperatures', description: 'Temperatures', address: 0x96, length: 8, type: 'int16', offset: -40, unit: 'C', access: 'read', mapping: 'temperatures' },
    ],
  },

  // SMA SunSpec Inverter
  'sma_sunspec': {
    manufacturer: 'SMA',
    model: 'Sunny Tripower',
    version: 'SunSpec 1.0',
    registers: [
      { name: 'ac_power', description: 'AC Power', address: 40084, length: 1, type: 'int16', unit: 'W', access: 'read', mapping: 'acPower' },
      { name: 'ac_voltage', description: 'AC Voltage', address: 40080, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', mapping: 'acVoltage' },
      { name: 'ac_current', description: 'AC Current', address: 40072, length: 1, type: 'uint16', scale: 0.01, unit: 'A', access: 'read', mapping: 'acCurrent' },
      { name: 'ac_frequency', description: 'AC Frequency', address: 40086, length: 1, type: 'uint16', scale: 0.01, unit: 'Hz', access: 'read', mapping: 'acFrequency' },
      { name: 'dc_power', description: 'DC Power', address: 40101, length: 1, type: 'int16', unit: 'W', access: 'read', mapping: 'dcPower' },
      { name: 'dc_voltage', description: 'DC Voltage', address: 40099, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', mapping: 'dcVoltage' },
      { name: 'daily_energy', description: 'Daily Energy', address: 40094, length: 2, type: 'uint32', unit: 'Wh', access: 'read', mapping: 'dailyEnergy' },
      { name: 'total_energy', description: 'Total Energy', address: 40096, length: 2, type: 'uint32', unit: 'Wh', access: 'read', mapping: 'totalEnergy' },
      { name: 'operating_state', description: 'Operating State', address: 40108, length: 1, type: 'uint16', access: 'read', mapping: 'operatingMode' },
    ],
  },

  // Growatt Inverter
  'growatt_inverter': {
    manufacturer: 'Growatt',
    model: 'SPH Series',
    version: '1.0',
    registers: [
      { name: 'pv_power', description: 'PV Power', address: 1, length: 2, type: 'uint32', scale: 0.1, unit: 'W', access: 'read', mapping: 'dcPower' },
      { name: 'pv_voltage', description: 'PV Voltage', address: 3, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', mapping: 'dcVoltage' },
      { name: 'ac_power', description: 'AC Output Power', address: 35, length: 2, type: 'uint32', scale: 0.1, unit: 'W', access: 'read', mapping: 'acPower' },
      { name: 'ac_voltage', description: 'AC Voltage', address: 38, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', mapping: 'acVoltage' },
      { name: 'grid_frequency', description: 'Grid Frequency', address: 37, length: 1, type: 'uint16', scale: 0.01, unit: 'Hz', access: 'read', mapping: 'acFrequency' },
      { name: 'battery_soc', description: 'Battery SOC', address: 1014, length: 1, type: 'uint16', unit: '%', access: 'read', mapping: 'soc' },
      { name: 'battery_power', description: 'Battery Power', address: 1009, length: 2, type: 'int32', scale: 0.1, unit: 'W', access: 'read', mapping: 'power' },
    ],
  },

  // Victron Inverter
  'victron_inverter': {
    manufacturer: 'Victron',
    model: 'MultiPlus-II',
    version: '1.0',
    registers: [
      { name: 'ac_input_voltage', description: 'AC Input Voltage', address: 3, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', mapping: 'acVoltage' },
      { name: 'ac_input_current', description: 'AC Input Current', address: 6, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read', mapping: 'acCurrent' },
      { name: 'ac_input_frequency', description: 'AC Input Frequency', address: 9, length: 1, type: 'int16', scale: 0.01, unit: 'Hz', access: 'read', mapping: 'acFrequency' },
      { name: 'ac_output_power', description: 'AC Output Power', address: 23, length: 1, type: 'int16', unit: 'W', access: 'read', mapping: 'acPower' },
      { name: 'battery_voltage', description: 'Battery Voltage', address: 26, length: 1, type: 'uint16', scale: 0.01, unit: 'V', access: 'read', mapping: 'dcVoltage' },
      { name: 'battery_current', description: 'Battery Current', address: 27, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read', mapping: 'dcCurrent' },
      { name: 'soc', description: 'State of Charge', address: 30, length: 1, type: 'uint16', unit: '%', access: 'read', mapping: 'soc' },
      { name: 'state', description: 'Inverter State', address: 31, length: 1, type: 'uint16', access: 'read', mapping: 'operatingMode' },
    ],
  },

  // SDM630 Energy Meter
  'eastron_sdm630': {
    manufacturer: 'Eastron',
    model: 'SDM630',
    version: '1.0',
    registers: [
      { name: 'voltage_l1', description: 'L1 Voltage', address: 0, length: 2, type: 'float32', unit: 'V', access: 'read', mapping: 'voltageL1' },
      { name: 'voltage_l2', description: 'L2 Voltage', address: 2, length: 2, type: 'float32', unit: 'V', access: 'read', mapping: 'voltageL2' },
      { name: 'voltage_l3', description: 'L3 Voltage', address: 4, length: 2, type: 'float32', unit: 'V', access: 'read', mapping: 'voltageL3' },
      { name: 'current_l1', description: 'L1 Current', address: 6, length: 2, type: 'float32', unit: 'A', access: 'read', mapping: 'currentL1' },
      { name: 'current_l2', description: 'L2 Current', address: 8, length: 2, type: 'float32', unit: 'A', access: 'read', mapping: 'currentL2' },
      { name: 'current_l3', description: 'L3 Current', address: 10, length: 2, type: 'float32', unit: 'A', access: 'read', mapping: 'currentL3' },
      { name: 'active_power', description: 'Total Active Power', address: 52, length: 2, type: 'float32', unit: 'W', access: 'read', mapping: 'activePower' },
      { name: 'reactive_power', description: 'Total Reactive Power', address: 60, length: 2, type: 'float32', unit: 'VAr', access: 'read', mapping: 'reactivePower' },
      { name: 'power_factor', description: 'Power Factor', address: 62, length: 2, type: 'float32', access: 'read', mapping: 'powerFactor' },
      { name: 'frequency', description: 'Frequency', address: 70, length: 2, type: 'float32', unit: 'Hz', access: 'read', mapping: 'frequency' },
      { name: 'import_energy', description: 'Import Energy', address: 72, length: 2, type: 'float32', unit: 'kWh', access: 'read', mapping: 'importEnergy' },
      { name: 'export_energy', description: 'Export Energy', address: 74, length: 2, type: 'float32', unit: 'kWh', access: 'read', mapping: 'exportEnergy' },
    ],
  },

  // Generic CAN BMS
  'generic_can_bms': {
    manufacturer: 'Generic',
    model: 'CAN BMS',
    version: '1.0',
    registers: [
      { name: 'soc', description: 'State of Charge', address: 0x351, length: 1, type: 'uint16', unit: '%', access: 'read', mapping: 'soc' },
      { name: 'soh', description: 'State of Health', address: 0x351, length: 1, type: 'uint16', unit: '%', access: 'read', mapping: 'soh' },
      { name: 'voltage', description: 'Pack Voltage', address: 0x356, length: 2, type: 'uint32', scale: 0.01, unit: 'V', access: 'read', mapping: 'packVoltage' },
      { name: 'current', description: 'Current', address: 0x356, length: 2, type: 'int32', scale: 0.1, unit: 'A', access: 'read', mapping: 'current' },
      { name: 'temperature', description: 'Temperature', address: 0x356, length: 1, type: 'int16', offset: -273, unit: 'C', access: 'read', mapping: 'temperature' },
    ],
  },
};

// ============================================
// HARDWARE ABSTRACTION SERVICE
// ============================================

export class HardwareAbstractionService {
  private db = getFirestore();
  private devices: Map<string, HardwareDevice> = new Map();
  private adapters: Map<string, ProtocolAdapter> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private telemetryCallbacks: Map<string, (telemetry: StandardTelemetry) => void> = new Map();

  /**
   * Register a hardware device
   */
  async registerDevice(device: HardwareDevice): Promise<void> {
    // Apply built-in register map if available
    if (!device.registerMap) {
      const mapKey = `${device.manufacturer.toLowerCase()}_${device.model.toLowerCase()}`.replace(/[^a-z0-9_]/g, '_');
      device.registerMap = BUILTIN_REGISTER_MAPS[mapKey];
    }

    // Store device
    this.devices.set(device.id, device);
    await this.db.collection('hardware_devices').doc(device.id).set({
      ...device,
      createdAt: new Date(),
    });

    // Initialize adapter
    await this.initializeAdapter(device);

    logger.info(`Hardware device registered: ${device.manufacturer} ${device.model} (${device.protocol})`);
  }

  /**
   * Initialize protocol adapter for device
   */
  private async initializeAdapter(device: HardwareDevice): Promise<void> {
    let adapter: ProtocolAdapter;

    switch (device.protocol) {
      case Protocol.MODBUS_RTU:
        adapter = this.createModbusRtuAdapter();
        break;
      case Protocol.MODBUS_TCP:
        adapter = this.createModbusTcpAdapter();
        break;
      case Protocol.CANBUS:
        adapter = this.createCanBusAdapter();
        break;
      case Protocol.MQTT:
        adapter = this.createMqttAdapter();
        break;
      case Protocol.REST_API:
        adapter = this.createRestApiAdapter();
        break;
      default:
        adapter = this.createGenericAdapter(device.protocol);
    }

    this.adapters.set(device.id, adapter);

    // Connect
    const connected = await adapter.connect(device.connectionConfig);
    device.status = connected ? 'online' : 'error';
    device.lastCommunication = new Date();

    this.devices.set(device.id, device);

    if (connected) {
      // Start polling
      this.startPolling(device.id);
    }
  }

  /**
   * Create Modbus RTU adapter
   */
  private createModbusRtuAdapter(): ProtocolAdapter {
    // In production, use modbus-serial library
    return {
      protocol: Protocol.MODBUS_RTU,
      connect: async (config) => {
        logger.info(`Connecting Modbus RTU: ${config.port} @ ${config.baudRate}`);
        // Implement using modbus-serial
        return true;
      },
      disconnect: async () => {
        logger.info('Disconnecting Modbus RTU');
      },
      read: async (registers) => {
        const result = new Map<string, unknown>();
        // Implement register reading
        return result;
      },
      write: async (register, value) => {
        // Implement register writing
        return true;
      },
      isConnected: () => true,
    };
  }

  /**
   * Create Modbus TCP adapter
   */
  private createModbusTcpAdapter(): ProtocolAdapter {
    return {
      protocol: Protocol.MODBUS_TCP,
      connect: async (config) => {
        logger.info(`Connecting Modbus TCP: ${config.host}:${config.tcpPort}`);
        return true;
      },
      disconnect: async () => {
        logger.info('Disconnecting Modbus TCP');
      },
      read: async (registers) => {
        const result = new Map<string, unknown>();
        return result;
      },
      write: async (register, value) => {
        return true;
      },
      isConnected: () => true,
    };
  }

  /**
   * Create CAN Bus adapter
   */
  private createCanBusAdapter(): ProtocolAdapter {
    // In production, use socketcan library
    return {
      protocol: Protocol.CANBUS,
      connect: async (config) => {
        logger.info(`Connecting CAN Bus: ${config.canInterface}`);
        return true;
      },
      disconnect: async () => {
        logger.info('Disconnecting CAN Bus');
      },
      read: async (registers) => {
        const result = new Map<string, unknown>();
        return result;
      },
      write: async (register, value) => {
        return true;
      },
      isConnected: () => true,
    };
  }

  /**
   * Create MQTT adapter
   */
  private createMqttAdapter(): ProtocolAdapter {
    return {
      protocol: Protocol.MQTT,
      connect: async (config) => {
        if (config.topic) {
          mqttService.subscribe(config.topic, (topic, payload) => {
            // Handle incoming data
          });
        }
        return mqttService.connected;
      },
      disconnect: async () => {
        // Unsubscribe handled by main MQTT service
      },
      read: async (registers) => {
        const result = new Map<string, unknown>();
        return result;
      },
      write: async (register, value) => {
        // Publish via MQTT
        return true;
      },
      isConnected: () => mqttService.connected,
    };
  }

  /**
   * Create REST API adapter
   */
  private createRestApiAdapter(): ProtocolAdapter {
    return {
      protocol: Protocol.REST_API,
      connect: async (config) => {
        logger.info(`Connecting REST API: ${config.host}:${config.tcpPort}`);
        return true;
      },
      disconnect: async () => {
        logger.info('Disconnecting REST API');
      },
      read: async (registers) => {
        const result = new Map<string, unknown>();
        // Implement HTTP GET requests
        return result;
      },
      write: async (register, value) => {
        // Implement HTTP POST/PUT requests
        return true;
      },
      isConnected: () => true,
    };
  }

  /**
   * Create generic adapter
   */
  private createGenericAdapter(protocol: Protocol): ProtocolAdapter {
    return {
      protocol,
      connect: async () => {
        logger.warn(`Generic adapter for ${protocol} - limited functionality`);
        return true;
      },
      disconnect: async () => {},
      read: async () => new Map<string, unknown>(),
      write: async () => false,
      isConnected: () => false,
    };
  }

  /**
   * Start polling device
   */
  private startPolling(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Clear existing interval
    const existing = this.pollingIntervals.get(deviceId);
    if (existing) clearInterval(existing);

    // Poll every 1 second
    const interval = setInterval(async () => {
      await this.pollDevice(deviceId);
    }, 1000);

    this.pollingIntervals.set(deviceId, interval);
  }

  /**
   * Poll device for data
   */
  private async pollDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    const adapter = this.adapters.get(deviceId);
    if (!device || !adapter || !device.registerMap) return;

    try {
      // Read all registers
      const rawData = await adapter.read(device.registerMap.registers);

      // Convert to standard telemetry
      const telemetry = this.convertToStandardTelemetry(device, rawData);

      // Update device status
      device.lastCommunication = new Date();
      device.status = 'online';
      this.devices.set(deviceId, device);

      // Notify callbacks
      const callback = this.telemetryCallbacks.get(deviceId);
      if (callback) {
        callback(telemetry);
      }

      // Publish via MQTT for other services
      await mqttService.publish(`lifo4/${device.systemId}/${device.type}/data`, JSON.stringify(telemetry));

    } catch (error) {
      logger.error(`Error polling device ${deviceId}`, { error });
      device.status = 'error';
      this.devices.set(deviceId, device);
    }
  }

  /**
   * Convert raw data to standard telemetry
   */
  private convertToStandardTelemetry(device: HardwareDevice, rawData: Map<string, unknown>): StandardTelemetry {
    const telemetry: StandardTelemetry = {
      timestamp: new Date(),
      deviceId: device.id,
      rawData: Object.fromEntries(rawData),
    };

    if (!device.registerMap) return telemetry;

    // Map each register to standard field
    for (const register of device.registerMap.registers) {
      const value = rawData.get(register.name);
      if (value === undefined) continue;

      let processedValue = value as number;

      // Apply scale and offset
      if (register.scale) {
        processedValue *= register.scale;
      }
      if (register.offset) {
        processedValue += register.offset;
      }

      // Map to standard field
      switch (register.mapping) {
        case 'soc':
          telemetry.soc = processedValue;
          break;
        case 'soh':
          telemetry.soh = processedValue;
          break;
        case 'packVoltage':
          telemetry.packVoltage = processedValue;
          break;
        case 'current':
          telemetry.current = processedValue;
          break;
        case 'power':
          telemetry.power = processedValue;
          break;
        case 'cellVoltages':
          telemetry.cellVoltages = value as number[];
          break;
        case 'temperatures':
          telemetry.temperatures = value as number[];
          break;
        case 'alarms':
          telemetry.alarms = processedValue;
          break;
        case 'warnings':
          telemetry.warnings = processedValue;
          break;
        case 'cycleCount':
          telemetry.cycleCount = processedValue;
          break;
        case 'capacity':
          telemetry.capacity = processedValue;
          break;
        case 'acPower':
          telemetry.acPower = processedValue;
          break;
        case 'acVoltage':
          telemetry.acVoltage = processedValue;
          break;
        case 'acCurrent':
          telemetry.acCurrent = processedValue;
          break;
        case 'acFrequency':
          telemetry.acFrequency = processedValue;
          break;
        case 'dcPower':
          telemetry.dcPower = processedValue;
          break;
        case 'dcVoltage':
          telemetry.dcVoltage = processedValue;
          break;
        case 'dcCurrent':
          telemetry.dcCurrent = processedValue;
          break;
        case 'activePower':
          telemetry.activePower = processedValue;
          break;
        case 'reactivePower':
          telemetry.reactivePower = processedValue;
          break;
        case 'powerFactor':
          telemetry.powerFactor = processedValue;
          break;
        case 'importEnergy':
          telemetry.importEnergy = processedValue;
          break;
        case 'exportEnergy':
          telemetry.exportEnergy = processedValue;
          break;
      }
    }

    return telemetry;
  }

  /**
   * Send command to device
   */
  async sendCommand(deviceId: string, command: string, params: Record<string, unknown>): Promise<boolean> {
    const device = this.devices.get(deviceId);
    const adapter = this.adapters.get(deviceId);
    if (!device || !adapter || !device.registerMap) {
      throw new Error('Device not found or not configured');
    }

    // Find command register
    const commandRegister = device.registerMap.registers.find(r =>
      r.name === command && (r.access === 'write' || r.access === 'readwrite')
    );

    if (!commandRegister) {
      throw new Error(`Command ${command} not supported by device`);
    }

    return adapter.write(commandRegister, params.value);
  }

  /**
   * Register telemetry callback
   */
  onTelemetry(deviceId: string, callback: (telemetry: StandardTelemetry) => void): void {
    this.telemetryCallbacks.set(deviceId, callback);
  }

  /**
   * Get device status
   */
  getDevice(deviceId: string): HardwareDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all devices for a system
   */
  getSystemDevices(systemId: string): HardwareDevice[] {
    return Array.from(this.devices.values()).filter(d => d.systemId === systemId);
  }

  /**
   * Update register map for device
   */
  async updateRegisterMap(deviceId: string, registerMap: RegisterMap): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error('Device not found');

    device.registerMap = registerMap;
    this.devices.set(deviceId, device);

    await this.db.collection('hardware_devices').doc(deviceId).update({
      registerMap,
      updatedAt: new Date(),
    });

    logger.info(`Register map updated for device ${deviceId}`);
  }

  /**
   * Auto-detect device type and model
   */
  async autoDetect(connectionConfig: ConnectionConfig, protocol: Protocol): Promise<{
    manufacturer: string;
    model: string;
    registerMap?: RegisterMap;
  } | null> {
    // Try each known register map
    for (const [key, map] of Object.entries(BUILTIN_REGISTER_MAPS)) {
      try {
        // Create temporary adapter
        const adapter = this.createAdapter(protocol);
        await adapter.connect(connectionConfig);

        // Try to read a few registers
        const testRegisters = map.registers.slice(0, 3);
        const result = await adapter.read(testRegisters);

        if (result.size > 0) {
          await adapter.disconnect();
          return {
            manufacturer: map.manufacturer,
            model: map.model,
            registerMap: map,
          };
        }

        await adapter.disconnect();
      } catch {
        // Continue to next map
      }
    }

    return null;
  }

  /**
   * Create adapter for protocol
   */
  private createAdapter(protocol: Protocol): ProtocolAdapter {
    switch (protocol) {
      case Protocol.MODBUS_RTU:
        return this.createModbusRtuAdapter();
      case Protocol.MODBUS_TCP:
        return this.createModbusTcpAdapter();
      case Protocol.CANBUS:
        return this.createCanBusAdapter();
      case Protocol.MQTT:
        return this.createMqttAdapter();
      case Protocol.REST_API:
        return this.createRestApiAdapter();
      default:
        return this.createGenericAdapter(protocol);
    }
  }

  /**
   * Unregister device
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    const interval = this.pollingIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(deviceId);
    }

    const adapter = this.adapters.get(deviceId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(deviceId);
    }

    this.devices.delete(deviceId);
    this.telemetryCallbacks.delete(deviceId);

    await this.db.collection('hardware_devices').doc(deviceId).delete();

    logger.info(`Device ${deviceId} unregistered`);
  }

  /**
   * Get supported manufacturers and models
   */
  getSupportedDevices(): Array<{ manufacturer: string; model: string; protocol: Protocol }> {
    return Object.entries(BUILTIN_REGISTER_MAPS).map(([key, map]) => ({
      manufacturer: map.manufacturer,
      model: map.model,
      protocol: key.includes('can') ? Protocol.CANBUS : Protocol.MODBUS_RTU,
    }));
  }
}

export const hardwareService = new HardwareAbstractionService();
