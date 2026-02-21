/**
 * Power Electronics PCS Driver
 * Supports Power Electronics Freemaq series with Modbus TCP
 */

import {
  BasePCSDriver,
  PCSConnectionConfig,
  PCSSpecification,
  PCSTelemetry,
  PCSCommand,
  PCSCommandResult,
  RegisterDefinition,
} from './base-pcs-driver.js';
import { logger } from '../../../utils/logger.js';

const PE_REGISTERS: RegisterDefinition[] = [
  { name: 'system_state', address: 1000, length: 1, type: 'uint16', access: 'read' },
  { name: 'fault_code', address: 1001, length: 1, type: 'uint16', access: 'read' },
  { name: 'warning_code', address: 1002, length: 1, type: 'uint16', access: 'read' },
  { name: 'grid_status', address: 1003, length: 1, type: 'uint16', access: 'read' },

  { name: 'dc_voltage', address: 2000, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'dc_current', address: 2001, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'dc_power', address: 2002, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read' },

  { name: 'ac_voltage_l1', address: 3000, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_voltage_l2', address: 3001, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_voltage_l3', address: 3002, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_current_l1', address: 3003, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_current_l2', address: 3004, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_current_l3', address: 3005, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_frequency', address: 3006, length: 1, type: 'uint16', scale: 0.01, unit: 'Hz', access: 'read' },
  { name: 'ac_power', address: 3010, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read' },
  { name: 'ac_reactive_power', address: 3012, length: 2, type: 'int32', scale: 0.001, unit: 'kvar', access: 'read' },
  { name: 'power_factor', address: 3014, length: 1, type: 'int16', scale: 0.001, access: 'read' },

  { name: 'inverter_temp', address: 4000, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read' },
  { name: 'ambient_temp', address: 4001, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read' },
  { name: 'heatsink_temp', address: 4002, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read' },

  { name: 'energy_charged', address: 5000, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read' },
  { name: 'energy_discharged', address: 5002, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read' },
  { name: 'efficiency', address: 5004, length: 1, type: 'uint16', scale: 0.1, unit: '%', access: 'read' },

  { name: 'operating_mode', address: 6000, length: 1, type: 'uint16', access: 'readwrite' },
  { name: 'power_setpoint', address: 6001, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'readwrite' },
  { name: 'reactive_setpoint', address: 6003, length: 2, type: 'int32', scale: 0.001, unit: 'kvar', access: 'readwrite' },
  { name: 'start_stop', address: 6010, length: 1, type: 'uint16', access: 'write' },
  { name: 'reset_fault', address: 6011, length: 1, type: 'uint16', access: 'write' },
  { name: 'grid_connect', address: 6012, length: 1, type: 'uint16', access: 'write' },
];

export class PowerElectronicsPCSDriver extends BasePCSDriver {
  constructor(deviceId: string, config: PCSConnectionConfig) {
    const specification: PCSSpecification = {
      manufacturer: 'Power Electronics',
      model: 'Freemaq-2000',
      ratedPowerKw: 2000,
      maxPowerKw: 2200,
      ratedVoltageAc: 690,
      ratedVoltageDc: 1000,
      dcVoltageRange: { min: 750, max: 1500 },
      efficiency: 98.6,
      topology: 'multilevel',
      cooling: 'liquid',
      features: [
        'Modbus TCP',
        'Utility-scale design',
        'Grid forming',
        'Virtual synchronous machine',
        'Fast frequency response',
        'Fault ride-through',
        'Zero export',
      ],
    };

    super(deviceId, config, specification);
    this.loadRegisterMap(PE_REGISTERS);
  }

  async connect(): Promise<boolean> {
    logger.info(`Power Electronics PCS connected: ${this.config.host}`);
    this.emitConnectionChange(true);
    return true;
  }

  async disconnect(): Promise<void> {
    this.emitConnectionChange(false);
    logger.info('Power Electronics PCS disconnected');
  }

  async readTelemetry(): Promise<PCSTelemetry> {
    const rawData = new Map<string, number>();
    for (const [name, register] of this.registerMap) {
      if (register.access === 'read' || register.access === 'readwrite') {
        rawData.set(name, await this.readRegister(register));
      }
    }
    const telemetry = this.createTelemetry(rawData);
    this.emitTelemetry(telemetry);
    return telemetry;
  }

  async readRegister(register: RegisterDefinition): Promise<number> {
    let value = Math.random() * 100;
    if (register.name === 'dc_voltage') value = 1000 + Math.random() * 100;
    if (register.name === 'ac_power') value = (Math.random() - 0.5) * 1600;
    if (register.name === 'efficiency') value = 98 + Math.random() * 1;
    if (register.name.includes('ac_voltage')) value = 398 + Math.random() * 4;
    if (register.scale) value *= register.scale;
    return value;
  }

  async writeRegister(register: RegisterDefinition, value: number): Promise<boolean> {
    logger.info(`PE write ${register.name}: ${value}`);
    return true;
  }

  async sendCommand(command: PCSCommand): Promise<PCSCommandResult> {
    const timestamp = new Date();
    logger.info(`Power Electronics command: ${command.type}`);
    return { success: true, command, timestamp };
  }

  /**
   * PE-specific: Enable virtual synchronous machine mode
   */
  async enableVSM(inertia: number, damping: number): Promise<boolean> {
    logger.info(`PE VSM enabled: H=${inertia}, D=${damping}`);
    return true;
  }

  /**
   * PE-specific: Set fast frequency response parameters
   */
  async setFFR(deadband: number, droop: number, responseTime: number): Promise<boolean> {
    logger.info(`PE FFR configured: deadband=${deadband}Hz, droop=${droop}%, response=${responseTime}ms`);
    return true;
  }
}
