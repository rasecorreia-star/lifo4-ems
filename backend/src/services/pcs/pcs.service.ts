/**
 * PCS Service
 * Manages Power Conversion Systems with multi-manufacturer support
 */

import { EventEmitter } from 'events';
import { getFirestore } from '../../config/firebase.js';
import { logger } from '../../utils/logger.js';
import {
  BasePCSDriver,
  PCSConnectionConfig,
  PCSSpecification,
  PCSTelemetry,
  PCSCommand,
  PCSCommandResult,
  PCSOperatingMode,
  PCSProtocol,
} from './drivers/base-pcs-driver.js';
import { SungrowPCSDriver } from './drivers/sungrow-driver.js';
import { HitachiPCSDriver } from './drivers/hitachi-driver.js';
import { ABBPCSDriver } from './drivers/abb-driver.js';
import { KehuaPCSDriver } from './drivers/kehua-driver.js';
import { NidecPCSDriver } from './drivers/nidec-driver.js';
import { PowerElectronicsPCSDriver } from './drivers/power-electronics-driver.js';

// ============================================
// TYPES
// ============================================

export type PCSManufacturer = 'sungrow' | 'hitachi' | 'abb' | 'kehua' | 'nidec' | 'power_electronics';

export interface PCSDevice {
  id: string;
  systemId: string;
  manufacturer: PCSManufacturer;
  model: string;
  connectionConfig: PCSConnectionConfig;
  status: 'online' | 'offline' | 'fault' | 'maintenance';
  lastCommunication?: Date;
  lastTelemetry?: PCSTelemetry;
  specification?: PCSSpecification;
}

export interface PCSFleetStatus {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  faultedDevices: number;
  totalCapacityKw: number;
  availableCapacityKw: number;
  currentPowerKw: number;
  avgEfficiency: number;
}

// ============================================
// PCS SERVICE
// ============================================

export class PCSService extends EventEmitter {
  private db = getFirestore();
  private drivers: Map<string, BasePCSDriver> = new Map();
  private devices: Map<string, PCSDevice> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pollingRate: number = 1000; // 1 second default

  constructor() {
    super();
  }

  /**
   * Register a PCS device
   */
  async registerDevice(device: PCSDevice): Promise<void> {
    // Create appropriate driver
    const driver = this.createDriver(device);
    if (!driver) {
      throw new Error(`Unsupported manufacturer: ${device.manufacturer}`);
    }

    // Store device and driver
    this.devices.set(device.id, device);
    this.drivers.set(device.id, driver);

    // Setup event handlers
    this.setupDriverEvents(device.id, driver);

    // Connect
    const connected = await driver.connect();
    device.status = connected ? 'online' : 'offline';
    device.specification = driver.spec;

    // Start polling if connected
    if (connected) {
      this.startPolling(device.id);
    }

    // Save to database
    await this.db.collection('pcs_devices').doc(device.id).set({
      ...device,
      createdAt: new Date(),
    });

    logger.info(`PCS device registered: ${device.manufacturer} ${device.model} (${device.id})`);
  }

  /**
   * Create driver based on manufacturer
   */
  private createDriver(device: PCSDevice): BasePCSDriver | null {
    switch (device.manufacturer) {
      case 'sungrow':
        return new SungrowPCSDriver(device.id, device.connectionConfig);
      case 'hitachi':
        return new HitachiPCSDriver(device.id, device.connectionConfig);
      case 'abb':
        return new ABBPCSDriver(device.id, device.connectionConfig);
      case 'kehua':
        return new KehuaPCSDriver(device.id, device.connectionConfig);
      case 'nidec':
        return new NidecPCSDriver(device.id, device.connectionConfig);
      case 'power_electronics':
        return new PowerElectronicsPCSDriver(device.id, device.connectionConfig);
      default:
        return null;
    }
  }

  /**
   * Setup event handlers for driver
   */
  private setupDriverEvents(deviceId: string, driver: BasePCSDriver): void {
    driver.on('telemetry', (telemetry: PCSTelemetry) => {
      const device = this.devices.get(deviceId);
      if (device) {
        device.lastTelemetry = telemetry;
        device.lastCommunication = new Date();
      }
      this.emit('telemetry', { deviceId, telemetry });
    });

    driver.on('fault', (fault: any) => {
      const device = this.devices.get(deviceId);
      if (device) {
        device.status = 'fault';
      }
      this.emit('fault', fault);
    });

    driver.on('connection', (status: any) => {
      const device = this.devices.get(deviceId);
      if (device) {
        device.status = status.connected ? 'online' : 'offline';
      }
      this.emit('connection', status);
    });
  }

  /**
   * Start polling for a device
   */
  private startPolling(deviceId: string): void {
    const existing = this.pollingIntervals.get(deviceId);
    if (existing) {
      clearInterval(existing);
    }

    const interval = setInterval(async () => {
      await this.pollDevice(deviceId);
    }, this.pollingRate);

    this.pollingIntervals.set(deviceId, interval);
  }

  /**
   * Poll device for telemetry
   */
  private async pollDevice(deviceId: string): Promise<void> {
    const driver = this.drivers.get(deviceId);
    if (!driver || !driver.isConnected) return;

    try {
      await driver.readTelemetry();
    } catch (error) {
      logger.error(`PCS polling error for ${deviceId}`, { error });
    }
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    // Stop polling
    const interval = this.pollingIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(deviceId);
    }

    // Disconnect driver
    const driver = this.drivers.get(deviceId);
    if (driver) {
      await driver.disconnect();
      this.drivers.delete(deviceId);
    }

    this.devices.delete(deviceId);
    await this.db.collection('pcs_devices').doc(deviceId).delete();

    logger.info(`PCS device unregistered: ${deviceId}`);
  }

  /**
   * Get device
   */
  getDevice(deviceId: string): PCSDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all devices for a system
   */
  getSystemDevices(systemId: string): PCSDevice[] {
    return Array.from(this.devices.values()).filter(d => d.systemId === systemId);
  }

  /**
   * Get fleet status
   */
  getFleetStatus(systemId?: string): PCSFleetStatus {
    let devices = Array.from(this.devices.values());
    if (systemId) {
      devices = devices.filter(d => d.systemId === systemId);
    }

    const online = devices.filter(d => d.status === 'online');
    const offline = devices.filter(d => d.status === 'offline');
    const faulted = devices.filter(d => d.status === 'fault');

    const totalCapacity = devices.reduce((sum, d) =>
      sum + (d.specification?.ratedPowerKw || 0), 0);
    const availableCapacity = online.reduce((sum, d) =>
      sum + (d.specification?.ratedPowerKw || 0), 0);
    const currentPower = online.reduce((sum, d) =>
      sum + Math.abs(d.lastTelemetry?.acPowerKw || 0), 0);

    const efficiencies = online
      .map(d => d.lastTelemetry?.efficiency)
      .filter(e => e !== undefined) as number[];
    const avgEfficiency = efficiencies.length > 0
      ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
      : 0;

    return {
      totalDevices: devices.length,
      onlineDevices: online.length,
      offlineDevices: offline.length,
      faultedDevices: faulted.length,
      totalCapacityKw: totalCapacity,
      availableCapacityKw: availableCapacity,
      currentPowerKw: currentPower,
      avgEfficiency,
    };
  }

  /**
   * Set power setpoint for a device
   */
  async setPowerSetpoint(deviceId: string, powerKw: number): Promise<PCSCommandResult> {
    const driver = this.drivers.get(deviceId);
    if (!driver) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return driver.setPowerSetpoint(powerKw);
  }

  /**
   * Set power setpoint for all devices in a system (distributed)
   */
  async setSystemPowerSetpoint(systemId: string, totalPowerKw: number): Promise<PCSCommandResult[]> {
    const devices = this.getSystemDevices(systemId).filter(d => d.status === 'online');
    if (devices.length === 0) {
      throw new Error('No online PCS devices');
    }

    // Distribute power proportionally based on rated capacity
    const totalCapacity = devices.reduce((sum, d) =>
      sum + (d.specification?.ratedPowerKw || 0), 0);

    const results: PCSCommandResult[] = [];

    for (const device of devices) {
      const ratio = (device.specification?.ratedPowerKw || 0) / totalCapacity;
      const devicePower = totalPowerKw * ratio;

      const result = await this.setPowerSetpoint(device.id, devicePower);
      results.push(result);
    }

    return results;
  }

  /**
   * Send command to a device
   */
  async sendCommand(deviceId: string, command: PCSCommand): Promise<PCSCommandResult> {
    const driver = this.drivers.get(deviceId);
    if (!driver) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return driver.sendCommand(command);
  }

  /**
   * Start a device
   */
  async startDevice(deviceId: string): Promise<PCSCommandResult> {
    const driver = this.drivers.get(deviceId);
    if (!driver) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return driver.start();
  }

  /**
   * Stop a device
   */
  async stopDevice(deviceId: string): Promise<PCSCommandResult> {
    const driver = this.drivers.get(deviceId);
    if (!driver) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return driver.stop();
  }

  /**
   * Reset faults on a device
   */
  async resetFaults(deviceId: string): Promise<PCSCommandResult> {
    const driver = this.drivers.get(deviceId);
    if (!driver) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return driver.resetFaults();
  }

  /**
   * Get current telemetry for a device
   */
  getTelemetry(deviceId: string): PCSTelemetry | null {
    const driver = this.drivers.get(deviceId);
    return driver?.getLastTelemetry() || null;
  }

  /**
   * Get supported manufacturers
   */
  getSupportedManufacturers(): Array<{
    id: PCSManufacturer;
    name: string;
    protocols: PCSProtocol[];
  }> {
    return [
      { id: 'sungrow', name: 'Sungrow', protocols: [PCSProtocol.MODBUS_TCP] },
      { id: 'hitachi', name: 'Hitachi Energy', protocols: [PCSProtocol.IEC61850] },
      { id: 'abb', name: 'ABB', protocols: [PCSProtocol.MODBUS_TCP, PCSProtocol.IEC61850] },
      { id: 'kehua', name: 'Kehua', protocols: [PCSProtocol.MODBUS_TCP] },
      { id: 'nidec', name: 'Nidec', protocols: [PCSProtocol.CANBUS, PCSProtocol.MODBUS_TCP] },
      { id: 'power_electronics', name: 'Power Electronics', protocols: [PCSProtocol.MODBUS_TCP] },
    ];
  }

  /**
   * Set polling rate
   */
  setPollingRate(rateMs: number): void {
    this.pollingRate = rateMs;

    // Restart all polling intervals
    for (const deviceId of this.pollingIntervals.keys()) {
      this.startPolling(deviceId);
    }
  }

  /**
   * Load devices from database
   */
  async loadFromDatabase(): Promise<void> {
    const snapshot = await this.db.collection('pcs_devices').get();

    for (const doc of snapshot.docs) {
      const device = { id: doc.id, ...doc.data() } as PCSDevice;
      await this.registerDevice(device);
    }

    logger.info(`Loaded ${snapshot.size} PCS devices from database`);
  }

  /**
   * Shutdown all devices
   */
  async shutdown(): Promise<void> {
    for (const [deviceId, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();

    for (const [deviceId, driver] of this.drivers) {
      await driver.disconnect();
    }
    this.drivers.clear();
    this.devices.clear();

    logger.info('PCS service shutdown complete');
  }
}

// Singleton export
export const pcsService = new PCSService();
