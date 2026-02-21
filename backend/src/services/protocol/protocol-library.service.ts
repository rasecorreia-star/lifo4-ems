/**
 * Protocol Library Service
 * Central repository for protocol definitions and register maps
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import {
  ProtocolType,
  DeviceType,
  RegisterDefinition,
  RegisterMap
} from './universal-adapter.service';

// ============================================
// TYPES
// ============================================

export interface ProtocolDefinition {
  id: string;
  name: string;
  type: ProtocolType;
  version: string;
  description: string;
  defaultSettings: ConnectionSettings;
  features: ProtocolFeature[];
  documentation?: string;
}

export interface ConnectionSettings {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  timeout?: number;
  retries?: number;
  port?: number;
}

export interface ProtocolFeature {
  name: string;
  supported: boolean;
  description: string;
}

export interface DeviceProfile {
  id: string;
  manufacturer: string;
  model: string;
  deviceType: DeviceType;
  protocol: ProtocolType;
  registerMap: RegisterMap;
  defaultSlaveId?: number;
  pollingIntervalMs?: number;
  capabilities: string[];
  documentation?: string;
}

export interface LibraryStatistics {
  totalProtocols: number;
  totalDevices: number;
  totalRegisters: number;
  byManufacturer: Record<string, number>;
  byDeviceType: Record<string, number>;
  byProtocol: Record<string, number>;
}

// ============================================
// BUILT-IN PROTOCOL DEFINITIONS
// ============================================

const BUILT_IN_PROTOCOLS: ProtocolDefinition[] = [
  {
    id: 'modbus_rtu',
    name: 'Modbus RTU',
    type: ProtocolType.MODBUS_RTU,
    version: '1.0',
    description: 'Serial Modbus protocol with RTU framing',
    defaultSettings: {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      timeout: 1000,
      retries: 3
    },
    features: [
      { name: 'Read Coils (0x01)', supported: true, description: 'Read discrete outputs' },
      { name: 'Read Discrete Inputs (0x02)', supported: true, description: 'Read discrete inputs' },
      { name: 'Read Holding Registers (0x03)', supported: true, description: 'Read analog outputs' },
      { name: 'Read Input Registers (0x04)', supported: true, description: 'Read analog inputs' },
      { name: 'Write Single Coil (0x05)', supported: true, description: 'Write single discrete output' },
      { name: 'Write Single Register (0x06)', supported: true, description: 'Write single analog output' },
      { name: 'Write Multiple Coils (0x0F)', supported: true, description: 'Write multiple discrete outputs' },
      { name: 'Write Multiple Registers (0x10)', supported: true, description: 'Write multiple analog outputs' }
    ]
  },
  {
    id: 'modbus_tcp',
    name: 'Modbus TCP',
    type: ProtocolType.MODBUS_TCP,
    version: '1.0',
    description: 'Modbus over TCP/IP',
    defaultSettings: {
      port: 502,
      timeout: 5000,
      retries: 3
    },
    features: [
      { name: 'Read Coils (0x01)', supported: true, description: 'Read discrete outputs' },
      { name: 'Read Holding Registers (0x03)', supported: true, description: 'Read analog outputs' },
      { name: 'Read Input Registers (0x04)', supported: true, description: 'Read analog inputs' },
      { name: 'Write Multiple Registers (0x10)', supported: true, description: 'Write multiple analog outputs' },
      { name: 'Encapsulated Interface Transport', supported: false, description: 'MEI transport' }
    ]
  },
  {
    id: 'sunspec',
    name: 'SunSpec',
    type: ProtocolType.SUNSPEC,
    version: '1.2',
    description: 'SunSpec Alliance protocol for solar/storage devices',
    defaultSettings: {
      port: 502,
      timeout: 5000,
      retries: 3
    },
    features: [
      { name: 'Common Model', supported: true, description: 'Device identification (Model 1)' },
      { name: 'Inverter Model', supported: true, description: 'Inverter data (Model 101-103)' },
      { name: 'Storage Model', supported: true, description: 'Battery storage (Model 124)' },
      { name: 'MPPT Model', supported: true, description: 'MPPT data (Model 160)' }
    ]
  },
  {
    id: 'canbus',
    name: 'CAN Bus',
    type: ProtocolType.CANBUS,
    version: '2.0B',
    description: 'Controller Area Network',
    defaultSettings: {
      baudRate: 500000,
      timeout: 1000
    },
    features: [
      { name: 'Standard Frame (11-bit)', supported: true, description: 'Standard identifier' },
      { name: 'Extended Frame (29-bit)', supported: true, description: 'Extended identifier' },
      { name: 'Remote Frame', supported: false, description: 'Request transmission' }
    ]
  }
];

// ============================================
// BUILT-IN DEVICE PROFILES
// ============================================

const BUILT_IN_DEVICES: DeviceProfile[] = [
  {
    id: 'catl_bms_generic',
    manufacturer: 'CATL',
    model: 'Generic BMS',
    deviceType: DeviceType.BMS,
    protocol: ProtocolType.MODBUS_RTU,
    defaultSlaveId: 1,
    pollingIntervalMs: 1000,
    capabilities: ['soc', 'soh', 'cell_voltages', 'temperatures', 'current', 'alarms'],
    registerMap: {
      deviceId: 'catl_bms_generic',
      protocol: ProtocolType.MODBUS_RTU,
      manufacturer: 'CATL',
      model: 'Generic BMS',
      version: '1.0.0',
      createdAt: new Date(),
      registers: [
        { address: 0, name: 'pack_voltage', dataType: 'uint16', scale: 0.1, unit: 'V', description: 'Pack Voltage', readable: true, writable: false, category: 'voltage' },
        { address: 1, name: 'pack_current', dataType: 'int16', scale: 0.1, unit: 'A', description: 'Pack Current', readable: true, writable: false, category: 'current' },
        { address: 2, name: 'soc', dataType: 'uint16', scale: 0.1, unit: '%', description: 'State of Charge', readable: true, writable: false, category: 'soc' },
        { address: 3, name: 'soh', dataType: 'uint16', scale: 0.1, unit: '%', description: 'State of Health', readable: true, writable: false, category: 'soh' },
        { address: 4, name: 'max_cell_voltage', dataType: 'uint16', scale: 0.001, unit: 'V', description: 'Max Cell Voltage', readable: true, writable: false, category: 'cell_voltage' },
        { address: 5, name: 'min_cell_voltage', dataType: 'uint16', scale: 0.001, unit: 'V', description: 'Min Cell Voltage', readable: true, writable: false, category: 'cell_voltage' },
        { address: 6, name: 'max_temperature', dataType: 'int16', scale: 0.1, unit: '°C', description: 'Max Temperature', readable: true, writable: false, category: 'temperature' },
        { address: 7, name: 'min_temperature', dataType: 'int16', scale: 0.1, unit: '°C', description: 'Min Temperature', readable: true, writable: false, category: 'temperature' },
        { address: 8, name: 'cycle_count', dataType: 'uint16', scale: 1, unit: '', description: 'Cycle Count', readable: true, writable: false, category: 'status' },
        { address: 9, name: 'alarm_status', dataType: 'uint16', scale: 1, unit: '', description: 'Alarm Status Bits', readable: true, writable: false, category: 'alarm' }
      ]
    }
  },
  {
    id: 'sungrow_pcs',
    manufacturer: 'Sungrow',
    model: 'SC Series PCS',
    deviceType: DeviceType.PCS,
    protocol: ProtocolType.MODBUS_TCP,
    defaultSlaveId: 1,
    pollingIntervalMs: 500,
    capabilities: ['ac_power', 'dc_power', 'efficiency', 'grid_frequency', 'control'],
    registerMap: {
      deviceId: 'sungrow_pcs',
      protocol: ProtocolType.MODBUS_TCP,
      manufacturer: 'Sungrow',
      model: 'SC Series PCS',
      version: '1.0.0',
      createdAt: new Date(),
      registers: [
        { address: 5000, name: 'system_status', dataType: 'uint16', scale: 1, unit: '', description: 'System Status', readable: true, writable: false, category: 'status' },
        { address: 5001, name: 'running_state', dataType: 'uint16', scale: 1, unit: '', description: 'Running State', readable: true, writable: false, category: 'status' },
        { address: 5003, name: 'daily_power', dataType: 'uint32', scale: 0.1, unit: 'kWh', description: 'Daily Power Generation', readable: true, writable: false, category: 'energy' },
        { address: 5005, name: 'total_power', dataType: 'uint32', scale: 0.1, unit: 'kWh', description: 'Total Power Generation', readable: true, writable: false, category: 'energy' },
        { address: 5008, name: 'dc_voltage', dataType: 'uint16', scale: 0.1, unit: 'V', description: 'DC Voltage', readable: true, writable: false, category: 'dc_voltage' },
        { address: 5009, name: 'dc_current', dataType: 'int16', scale: 0.1, unit: 'A', description: 'DC Current', readable: true, writable: false, category: 'dc_current' },
        { address: 5010, name: 'dc_power', dataType: 'int32', scale: 1, unit: 'W', description: 'DC Power', readable: true, writable: false, category: 'dc_power' },
        { address: 5017, name: 'grid_frequency', dataType: 'uint16', scale: 0.01, unit: 'Hz', description: 'Grid Frequency', readable: true, writable: false, category: 'grid' },
        { address: 5019, name: 'ac_power', dataType: 'int32', scale: 1, unit: 'W', description: 'AC Power', readable: true, writable: false, category: 'ac_power' },
        { address: 5035, name: 'internal_temp', dataType: 'int16', scale: 0.1, unit: '°C', description: 'Internal Temperature', readable: true, writable: false, category: 'temperature' },
        { address: 13000, name: 'power_setpoint', dataType: 'int32', scale: 1, unit: 'W', description: 'Power Setpoint', readable: true, writable: true, category: 'control' },
        { address: 13006, name: 'start_stop', dataType: 'uint16', scale: 1, unit: '', description: 'Start/Stop Control', readable: true, writable: true, category: 'control' }
      ]
    }
  },
  {
    id: 'pylontech_us3000',
    manufacturer: 'Pylontech',
    model: 'US3000',
    deviceType: DeviceType.BMS,
    protocol: ProtocolType.CANBUS,
    pollingIntervalMs: 1000,
    capabilities: ['soc', 'soh', 'cell_voltages', 'temperatures', 'current'],
    registerMap: {
      deviceId: 'pylontech_us3000',
      protocol: ProtocolType.CANBUS,
      manufacturer: 'Pylontech',
      model: 'US3000',
      version: '1.0.0',
      createdAt: new Date(),
      registers: [
        { address: 0x351, name: 'charge_voltage', dataType: 'uint16', scale: 0.1, unit: 'V', description: 'Charge Voltage Limit', readable: true, writable: false, category: 'voltage' },
        { address: 0x351, name: 'charge_current', dataType: 'int16', scale: 0.1, unit: 'A', description: 'Charge Current Limit', readable: true, writable: false, category: 'current' },
        { address: 0x355, name: 'soc', dataType: 'uint16', scale: 1, unit: '%', description: 'State of Charge', readable: true, writable: false, category: 'soc' },
        { address: 0x355, name: 'soh', dataType: 'uint16', scale: 1, unit: '%', description: 'State of Health', readable: true, writable: false, category: 'soh' },
        { address: 0x356, name: 'battery_voltage', dataType: 'int16', scale: 0.01, unit: 'V', description: 'Battery Voltage', readable: true, writable: false, category: 'voltage' },
        { address: 0x356, name: 'battery_current', dataType: 'int16', scale: 0.1, unit: 'A', description: 'Battery Current', readable: true, writable: false, category: 'current' },
        { address: 0x356, name: 'battery_temp', dataType: 'int16', scale: 0.1, unit: '°C', description: 'Battery Temperature', readable: true, writable: false, category: 'temperature' }
      ]
    }
  },
  {
    id: 'byd_hvs',
    manufacturer: 'BYD',
    model: 'Battery-Box HVS',
    deviceType: DeviceType.BMS,
    protocol: ProtocolType.CANBUS,
    pollingIntervalMs: 1000,
    capabilities: ['soc', 'soh', 'temperatures', 'current', 'cell_voltages'],
    registerMap: {
      deviceId: 'byd_hvs',
      protocol: ProtocolType.CANBUS,
      manufacturer: 'BYD',
      model: 'Battery-Box HVS',
      version: '1.0.0',
      createdAt: new Date(),
      registers: [
        { address: 0x100, name: 'battery_voltage', dataType: 'uint16', scale: 0.1, unit: 'V', description: 'Battery Voltage', readable: true, writable: false, category: 'voltage' },
        { address: 0x100, name: 'battery_current', dataType: 'int16', scale: 0.1, unit: 'A', description: 'Battery Current', readable: true, writable: false, category: 'current' },
        { address: 0x100, name: 'battery_temp', dataType: 'int16', scale: 1, unit: '°C', description: 'Battery Temperature', readable: true, writable: false, category: 'temperature' },
        { address: 0x101, name: 'soc', dataType: 'uint16', scale: 0.1, unit: '%', description: 'State of Charge', readable: true, writable: false, category: 'soc' },
        { address: 0x101, name: 'soh', dataType: 'uint16', scale: 0.1, unit: '%', description: 'State of Health', readable: true, writable: false, category: 'soh' },
        { address: 0x102, name: 'max_charge_voltage', dataType: 'uint16', scale: 0.1, unit: 'V', description: 'Max Charge Voltage', readable: true, writable: false, category: 'voltage' },
        { address: 0x102, name: 'max_charge_current', dataType: 'uint16', scale: 0.1, unit: 'A', description: 'Max Charge Current', readable: true, writable: false, category: 'current' }
      ]
    }
  },
  {
    id: 'sunspec_inverter',
    manufacturer: 'Generic',
    model: 'SunSpec Inverter',
    deviceType: DeviceType.INVERTER,
    protocol: ProtocolType.SUNSPEC,
    defaultSlaveId: 1,
    pollingIntervalMs: 1000,
    capabilities: ['ac_power', 'dc_power', 'efficiency', 'grid', 'mppt'],
    registerMap: {
      deviceId: 'sunspec_inverter',
      protocol: ProtocolType.SUNSPEC,
      manufacturer: 'Generic',
      model: 'SunSpec Inverter',
      version: '1.0.0',
      createdAt: new Date(),
      registers: [
        { address: 40000, name: 'sunspec_id', dataType: 'string', scale: 1, unit: '', description: 'SunSpec ID (SunS)', readable: true, writable: false, category: 'identification' },
        { address: 40002, name: 'common_model_id', dataType: 'uint16', scale: 1, unit: '', description: 'Common Model ID', readable: true, writable: false, category: 'identification' },
        { address: 40004, name: 'manufacturer', dataType: 'string', scale: 1, unit: '', description: 'Manufacturer', readable: true, writable: false, category: 'identification' },
        { address: 40020, name: 'model', dataType: 'string', scale: 1, unit: '', description: 'Model', readable: true, writable: false, category: 'identification' },
        { address: 40070, name: 'inverter_model_id', dataType: 'uint16', scale: 1, unit: '', description: 'Inverter Model ID', readable: true, writable: false, category: 'identification' },
        { address: 40072, name: 'ac_current', dataType: 'uint16', scale: 0.1, unit: 'A', description: 'AC Current', readable: true, writable: false, category: 'ac_power' },
        { address: 40080, name: 'ac_power', dataType: 'int16', scale: 1, unit: 'W', description: 'AC Power', readable: true, writable: false, category: 'ac_power' },
        { address: 40082, name: 'ac_frequency', dataType: 'uint16', scale: 0.01, unit: 'Hz', description: 'AC Frequency', readable: true, writable: false, category: 'grid' },
        { address: 40084, name: 'ac_energy', dataType: 'uint32', scale: 1, unit: 'Wh', description: 'AC Energy', readable: true, writable: false, category: 'energy' },
        { address: 40090, name: 'dc_current', dataType: 'uint16', scale: 0.1, unit: 'A', description: 'DC Current', readable: true, writable: false, category: 'dc_power' },
        { address: 40091, name: 'dc_voltage', dataType: 'uint16', scale: 0.1, unit: 'V', description: 'DC Voltage', readable: true, writable: false, category: 'dc_power' },
        { address: 40092, name: 'dc_power', dataType: 'int16', scale: 1, unit: 'W', description: 'DC Power', readable: true, writable: false, category: 'dc_power' }
      ]
    }
  }
];

// ============================================
// PROTOCOL LIBRARY SERVICE
// ============================================

export class ProtocolLibraryService extends EventEmitter {
  private static instance: ProtocolLibraryService;

  private protocols: Map<string, ProtocolDefinition> = new Map();
  private devices: Map<string, DeviceProfile> = new Map();
  private customLibraryPath: string;

  private constructor() {
    super();
    this.customLibraryPath = process.env.PROTOCOL_LIBRARY_PATH || './data/protocol-library';

    this.loadBuiltInDefinitions();
    this.loadCustomDefinitions();
  }

  static getInstance(): ProtocolLibraryService {
    if (!ProtocolLibraryService.instance) {
      ProtocolLibraryService.instance = new ProtocolLibraryService();
    }
    return ProtocolLibraryService.instance;
  }

  /**
   * Load built-in protocol and device definitions
   */
  private loadBuiltInDefinitions(): void {
    for (const protocol of BUILT_IN_PROTOCOLS) {
      this.protocols.set(protocol.id, protocol);
    }

    for (const device of BUILT_IN_DEVICES) {
      this.devices.set(device.id, device);
    }

    logger.info(`Loaded ${this.protocols.size} protocols and ${this.devices.size} device profiles`);
  }

  /**
   * Load custom definitions from disk
   */
  private loadCustomDefinitions(): void {
    try {
      if (!fs.existsSync(this.customLibraryPath)) {
        fs.mkdirSync(this.customLibraryPath, { recursive: true });
        return;
      }

      // Load protocols
      const protocolsPath = path.join(this.customLibraryPath, 'protocols');
      if (fs.existsSync(protocolsPath)) {
        const files = fs.readdirSync(protocolsPath).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const content = fs.readFileSync(path.join(protocolsPath, file), 'utf8');
          const protocol = JSON.parse(content) as ProtocolDefinition;
          this.protocols.set(protocol.id, protocol);
        }
      }

      // Load devices
      const devicesPath = path.join(this.customLibraryPath, 'devices');
      if (fs.existsSync(devicesPath)) {
        const files = fs.readdirSync(devicesPath).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const content = fs.readFileSync(path.join(devicesPath, file), 'utf8');
          const device = JSON.parse(content) as DeviceProfile;
          device.registerMap.createdAt = new Date(device.registerMap.createdAt);
          this.devices.set(device.id, device);
        }
      }

      logger.info(`Loaded custom definitions from ${this.customLibraryPath}`);
    } catch (error) {
      logger.error('Failed to load custom definitions:', error);
    }
  }

  /**
   * Get all protocol definitions
   */
  getProtocols(): ProtocolDefinition[] {
    return Array.from(this.protocols.values());
  }

  /**
   * Get protocol by ID
   */
  getProtocol(id: string): ProtocolDefinition | undefined {
    return this.protocols.get(id);
  }

  /**
   * Get all device profiles
   */
  getDevices(): DeviceProfile[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device profile by ID
   */
  getDevice(id: string): DeviceProfile | undefined {
    return this.devices.get(id);
  }

  /**
   * Search devices by criteria
   */
  searchDevices(criteria: {
    manufacturer?: string;
    deviceType?: DeviceType;
    protocol?: ProtocolType;
    capability?: string;
  }): DeviceProfile[] {
    return Array.from(this.devices.values()).filter(device => {
      if (criteria.manufacturer && !device.manufacturer.toLowerCase().includes(criteria.manufacturer.toLowerCase())) {
        return false;
      }
      if (criteria.deviceType && device.deviceType !== criteria.deviceType) {
        return false;
      }
      if (criteria.protocol && device.protocol !== criteria.protocol) {
        return false;
      }
      if (criteria.capability && !device.capabilities.includes(criteria.capability)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Add custom protocol definition
   */
  addProtocol(protocol: ProtocolDefinition): void {
    this.protocols.set(protocol.id, protocol);
    this.saveProtocol(protocol);
    this.emit('protocolAdded', protocol);
    logger.info(`Added protocol: ${protocol.id}`);
  }

  /**
   * Add custom device profile
   */
  addDevice(device: DeviceProfile): void {
    this.devices.set(device.id, device);
    this.saveDevice(device);
    this.emit('deviceAdded', device);
    logger.info(`Added device: ${device.id}`);
  }

  /**
   * Save protocol to disk
   */
  private saveProtocol(protocol: ProtocolDefinition): void {
    try {
      const protocolsPath = path.join(this.customLibraryPath, 'protocols');
      if (!fs.existsSync(protocolsPath)) {
        fs.mkdirSync(protocolsPath, { recursive: true });
      }

      const filePath = path.join(protocolsPath, `${protocol.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(protocol, null, 2));
    } catch (error) {
      logger.error(`Failed to save protocol ${protocol.id}:`, error);
    }
  }

  /**
   * Save device to disk
   */
  private saveDevice(device: DeviceProfile): void {
    try {
      const devicesPath = path.join(this.customLibraryPath, 'devices');
      if (!fs.existsSync(devicesPath)) {
        fs.mkdirSync(devicesPath, { recursive: true });
      }

      const filePath = path.join(devicesPath, `${device.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(device, null, 2));
    } catch (error) {
      logger.error(`Failed to save device ${device.id}:`, error);
    }
  }

  /**
   * Delete protocol
   */
  deleteProtocol(id: string): boolean {
    if (BUILT_IN_PROTOCOLS.some(p => p.id === id)) {
      logger.warn(`Cannot delete built-in protocol: ${id}`);
      return false;
    }

    const deleted = this.protocols.delete(id);
    if (deleted) {
      const filePath = path.join(this.customLibraryPath, 'protocols', `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.emit('protocolDeleted', id);
    }
    return deleted;
  }

  /**
   * Delete device
   */
  deleteDevice(id: string): boolean {
    if (BUILT_IN_DEVICES.some(d => d.id === id)) {
      logger.warn(`Cannot delete built-in device: ${id}`);
      return false;
    }

    const deleted = this.devices.delete(id);
    if (deleted) {
      const filePath = path.join(this.customLibraryPath, 'devices', `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.emit('deviceDeleted', id);
    }
    return deleted;
  }

  /**
   * Find matching device profile by detection result
   */
  findMatchingDevice(
    manufacturer: string,
    model?: string,
    deviceType?: DeviceType
  ): DeviceProfile | undefined {
    const matches = Array.from(this.devices.values()).filter(device => {
      const manufacturerMatch = device.manufacturer.toLowerCase().includes(manufacturer.toLowerCase());
      const modelMatch = !model || device.model.toLowerCase().includes(model.toLowerCase());
      const typeMatch = !deviceType || device.deviceType === deviceType;
      return manufacturerMatch && modelMatch && typeMatch;
    });

    // Return best match (exact model match preferred)
    if (model) {
      const exactMatch = matches.find(d =>
        d.model.toLowerCase() === model.toLowerCase()
      );
      if (exactMatch) return exactMatch;
    }

    return matches[0];
  }

  /**
   * Get register by name from device profile
   */
  getRegister(deviceId: string, registerName: string): RegisterDefinition | undefined {
    const device = this.devices.get(deviceId);
    return device?.registerMap.registers.find(r => r.name === registerName);
  }

  /**
   * Get all registers for a category
   */
  getRegistersByCategory(deviceId: string, category: string): RegisterDefinition[] {
    const device = this.devices.get(deviceId);
    return device?.registerMap.registers.filter(r => r.category === category) || [];
  }

  /**
   * Get library statistics
   */
  getStatistics(): LibraryStatistics {
    const byManufacturer: Record<string, number> = {};
    const byDeviceType: Record<string, number> = {};
    const byProtocol: Record<string, number> = {};
    let totalRegisters = 0;

    for (const device of this.devices.values()) {
      byManufacturer[device.manufacturer] = (byManufacturer[device.manufacturer] || 0) + 1;
      byDeviceType[device.deviceType] = (byDeviceType[device.deviceType] || 0) + 1;
      byProtocol[device.protocol] = (byProtocol[device.protocol] || 0) + 1;
      totalRegisters += device.registerMap.registers.length;
    }

    return {
      totalProtocols: this.protocols.size,
      totalDevices: this.devices.size,
      totalRegisters,
      byManufacturer,
      byDeviceType,
      byProtocol
    };
  }

  /**
   * Export device profile for sharing
   */
  exportDevice(deviceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    return JSON.stringify(device, null, 2);
  }

  /**
   * Import device profile
   */
  importDevice(json: string): DeviceProfile {
    const device = JSON.parse(json) as DeviceProfile;

    // Validate required fields
    if (!device.id || !device.manufacturer || !device.model) {
      throw new Error('Invalid device profile: missing required fields');
    }

    // Ensure unique ID
    if (this.devices.has(device.id)) {
      device.id = `${device.id}_${Date.now()}`;
    }

    device.registerMap.createdAt = new Date();
    this.addDevice(device);

    return device;
  }

  /**
   * Clone device profile with modifications
   */
  cloneDevice(sourceId: string, newId: string, modifications?: Partial<DeviceProfile>): DeviceProfile {
    const source = this.devices.get(sourceId);
    if (!source) {
      throw new Error(`Source device not found: ${sourceId}`);
    }

    const cloned: DeviceProfile = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      ...modifications,
      registerMap: {
        ...JSON.parse(JSON.stringify(source.registerMap)),
        deviceId: newId,
        createdAt: new Date()
      }
    };

    this.addDevice(cloned);
    return cloned;
  }
}

// Export singleton
export const protocolLibrary = ProtocolLibraryService.getInstance();
