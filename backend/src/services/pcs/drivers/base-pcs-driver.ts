/**
 * Base PCS Driver
 * Abstract class for Power Conversion System drivers
 */

import { EventEmitter } from 'events';
import { logger } from '../../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export enum PCSOperatingMode {
  STANDBY = 'standby',
  CHARGING = 'charging',
  DISCHARGING = 'discharging',
  GRID_FORMING = 'grid_forming',
  GRID_FOLLOWING = 'grid_following',
  OFF_GRID = 'off_grid',
  FAULT = 'fault',
  MAINTENANCE = 'maintenance',
}

export enum PCSProtocol {
  MODBUS_TCP = 'modbus_tcp',
  MODBUS_RTU = 'modbus_rtu',
  IEC61850 = 'iec61850',
  CANBUS = 'canbus',
  SUNSPEC = 'sunspec',
}

export interface PCSConnectionConfig {
  protocol: PCSProtocol;
  host?: string;
  port?: number;
  slaveId?: number;
  serialPort?: string;
  baudRate?: number;
  iedName?: string; // IEC 61850
  timeout?: number;
  retries?: number;
}

export interface PCSSpecification {
  manufacturer: string;
  model: string;
  ratedPowerKw: number;
  maxPowerKw: number;
  ratedVoltageAc: number;
  ratedVoltageDc: number;
  dcVoltageRange: { min: number; max: number };
  efficiency: number;
  topology: 'two_level' | 'three_level' | 'multilevel';
  cooling: 'air' | 'liquid';
  features: string[];
}

export interface PCSTelemetry {
  timestamp: Date;
  deviceId: string;

  // AC Side
  acPowerKw: number;
  acReactivePowerKvar: number;
  acVoltageL1: number;
  acVoltageL2: number;
  acVoltageL3: number;
  acCurrentL1: number;
  acCurrentL2: number;
  acCurrentL3: number;
  acFrequency: number;
  powerFactor: number;

  // DC Side
  dcPowerKw: number;
  dcVoltage: number;
  dcCurrent: number;

  // Operating State
  operatingMode: PCSOperatingMode;
  gridConnected: boolean;
  faultCode: number;
  warningCode: number;

  // Thermal
  inverterTemperature: number;
  ambientTemperature: number;
  heatsinkTemperature?: number;

  // Efficiency
  efficiency: number;
  energyChargedKwh: number;
  energyDischargedKwh: number;
}

export interface PCSCommand {
  type: 'power_setpoint' | 'mode_change' | 'start' | 'stop' | 'reset' | 'grid_connect' | 'grid_disconnect';
  parameters: Record<string, unknown>;
}

export interface PCSCommandResult {
  success: boolean;
  command: PCSCommand;
  timestamp: Date;
  error?: string;
  response?: Record<string, unknown>;
}

export interface RegisterDefinition {
  name: string;
  address: number;
  length: number;
  type: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string';
  scale?: number;
  offset?: number;
  unit?: string;
  access: 'read' | 'write' | 'readwrite';
  description?: string;
}

// ============================================
// BASE PCS DRIVER
// ============================================

export abstract class BasePCSDriver extends EventEmitter {
  protected deviceId: string;
  protected config: PCSConnectionConfig;
  protected specification: PCSSpecification;
  protected connected: boolean = false;
  protected lastTelemetry: PCSTelemetry | null = null;
  protected registerMap: Map<string, RegisterDefinition> = new Map();

  constructor(
    deviceId: string,
    config: PCSConnectionConfig,
    specification: PCSSpecification
  ) {
    super();
    this.deviceId = deviceId;
    this.config = config;
    this.specification = specification;
  }

  // Abstract methods to be implemented by specific drivers
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract readTelemetry(): Promise<PCSTelemetry>;
  abstract sendCommand(command: PCSCommand): Promise<PCSCommandResult>;
  abstract readRegister(register: RegisterDefinition): Promise<number | string>;
  abstract writeRegister(register: RegisterDefinition, value: number | string): Promise<boolean>;

  // Common methods
  get isConnected(): boolean {
    return this.connected;
  }

  get spec(): PCSSpecification {
    return this.specification;
  }

  get id(): string {
    return this.deviceId;
  }

  getLastTelemetry(): PCSTelemetry | null {
    return this.lastTelemetry;
  }

  /**
   * Set active power setpoint
   */
  async setPowerSetpoint(powerKw: number): Promise<PCSCommandResult> {
    // Validate power is within limits
    if (Math.abs(powerKw) > this.specification.maxPowerKw) {
      return {
        success: false,
        command: { type: 'power_setpoint', parameters: { powerKw } },
        timestamp: new Date(),
        error: `Power setpoint ${powerKw}kW exceeds max ${this.specification.maxPowerKw}kW`,
      };
    }

    return this.sendCommand({
      type: 'power_setpoint',
      parameters: { powerKw },
    });
  }

  /**
   * Set operating mode
   */
  async setMode(mode: PCSOperatingMode): Promise<PCSCommandResult> {
    return this.sendCommand({
      type: 'mode_change',
      parameters: { mode },
    });
  }

  /**
   * Start the PCS
   */
  async start(): Promise<PCSCommandResult> {
    return this.sendCommand({
      type: 'start',
      parameters: {},
    });
  }

  /**
   * Stop the PCS
   */
  async stop(): Promise<PCSCommandResult> {
    return this.sendCommand({
      type: 'stop',
      parameters: {},
    });
  }

  /**
   * Reset faults
   */
  async resetFaults(): Promise<PCSCommandResult> {
    return this.sendCommand({
      type: 'reset',
      parameters: {},
    });
  }

  /**
   * Connect to grid
   */
  async connectToGrid(): Promise<PCSCommandResult> {
    return this.sendCommand({
      type: 'grid_connect',
      parameters: {},
    });
  }

  /**
   * Disconnect from grid
   */
  async disconnectFromGrid(): Promise<PCSCommandResult> {
    return this.sendCommand({
      type: 'grid_disconnect',
      parameters: {},
    });
  }

  /**
   * Load register map from JSON
   */
  protected loadRegisterMap(registers: RegisterDefinition[]): void {
    this.registerMap.clear();
    for (const reg of registers) {
      this.registerMap.set(reg.name, reg);
    }
    logger.info(`Loaded ${this.registerMap.size} registers for ${this.specification.manufacturer} ${this.specification.model}`);
  }

  /**
   * Convert raw register values to telemetry
   */
  protected createTelemetry(rawData: Map<string, number | string>): PCSTelemetry {
    const getValue = (name: string, defaultValue: number = 0): number => {
      const val = rawData.get(name);
      return typeof val === 'number' ? val : defaultValue;
    };

    const telemetry: PCSTelemetry = {
      timestamp: new Date(),
      deviceId: this.deviceId,

      // AC Side
      acPowerKw: getValue('ac_power'),
      acReactivePowerKvar: getValue('ac_reactive_power'),
      acVoltageL1: getValue('ac_voltage_l1'),
      acVoltageL2: getValue('ac_voltage_l2'),
      acVoltageL3: getValue('ac_voltage_l3'),
      acCurrentL1: getValue('ac_current_l1'),
      acCurrentL2: getValue('ac_current_l2'),
      acCurrentL3: getValue('ac_current_l3'),
      acFrequency: getValue('ac_frequency'),
      powerFactor: getValue('power_factor'),

      // DC Side
      dcPowerKw: getValue('dc_power'),
      dcVoltage: getValue('dc_voltage'),
      dcCurrent: getValue('dc_current'),

      // Operating State
      operatingMode: this.parseOperatingMode(getValue('operating_mode')),
      gridConnected: getValue('grid_status') === 1,
      faultCode: getValue('fault_code'),
      warningCode: getValue('warning_code'),

      // Thermal
      inverterTemperature: getValue('inverter_temp'),
      ambientTemperature: getValue('ambient_temp'),
      heatsinkTemperature: getValue('heatsink_temp'),

      // Efficiency
      efficiency: getValue('efficiency', 95),
      energyChargedKwh: getValue('energy_charged'),
      energyDischargedKwh: getValue('energy_discharged'),
    };

    this.lastTelemetry = telemetry;
    return telemetry;
  }

  /**
   * Parse operating mode from raw value
   */
  protected parseOperatingMode(value: number): PCSOperatingMode {
    // Default mapping - override in specific drivers
    switch (value) {
      case 0: return PCSOperatingMode.STANDBY;
      case 1: return PCSOperatingMode.CHARGING;
      case 2: return PCSOperatingMode.DISCHARGING;
      case 3: return PCSOperatingMode.GRID_FORMING;
      case 4: return PCSOperatingMode.GRID_FOLLOWING;
      case 5: return PCSOperatingMode.OFF_GRID;
      case 6: return PCSOperatingMode.FAULT;
      case 7: return PCSOperatingMode.MAINTENANCE;
      default: return PCSOperatingMode.STANDBY;
    }
  }

  /**
   * Emit telemetry event
   */
  protected emitTelemetry(telemetry: PCSTelemetry): void {
    this.emit('telemetry', telemetry);
  }

  /**
   * Emit fault event
   */
  protected emitFault(faultCode: number, description: string): void {
    this.emit('fault', { deviceId: this.deviceId, faultCode, description, timestamp: new Date() });
  }

  /**
   * Emit connection status change
   */
  protected emitConnectionChange(connected: boolean): void {
    this.connected = connected;
    this.emit('connection', { deviceId: this.deviceId, connected, timestamp: new Date() });
  }
}
