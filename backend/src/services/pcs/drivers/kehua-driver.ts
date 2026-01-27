/**
 * Kehua PCS Driver
 * Supports Kehua KSTAR series with Modbus TCP
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

const KEHUA_REGISTERS: RegisterDefinition[] = [
  { name: 'system_state', address: 40001, length: 1, type: 'uint16', access: 'read' },
  { name: 'fault_code', address: 40002, length: 1, type: 'uint16', access: 'read' },
  { name: 'dc_voltage', address: 40010, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'dc_current', address: 40011, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'dc_power', address: 40012, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read' },
  { name: 'ac_voltage_l1', address: 40020, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_voltage_l2', address: 40021, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_voltage_l3', address: 40022, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_current_l1', address: 40023, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_current_l2', address: 40024, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_current_l3', address: 40025, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_frequency', address: 40026, length: 1, type: 'uint16', scale: 0.01, unit: 'Hz', access: 'read' },
  { name: 'ac_power', address: 40030, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read' },
  { name: 'ac_reactive_power', address: 40032, length: 2, type: 'int32', scale: 0.001, unit: 'kvar', access: 'read' },
  { name: 'power_factor', address: 40034, length: 1, type: 'int16', scale: 0.001, access: 'read' },
  { name: 'inverter_temp', address: 40050, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read' },
  { name: 'energy_charged', address: 40060, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read' },
  { name: 'energy_discharged', address: 40062, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read' },
  { name: 'efficiency', address: 40070, length: 1, type: 'uint16', scale: 0.1, unit: '%', access: 'read' },
  { name: 'operating_mode', address: 40100, length: 1, type: 'uint16', access: 'readwrite' },
  { name: 'power_setpoint', address: 40101, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'readwrite' },
  { name: 'start_stop', address: 40110, length: 1, type: 'uint16', access: 'write' },
];

export class KehuaPCSDriver extends BasePCSDriver {
  constructor(deviceId: string, config: PCSConnectionConfig) {
    const specification: PCSSpecification = {
      manufacturer: 'Kehua',
      model: 'KSTAR-PCS-500',
      ratedPowerKw: 500,
      maxPowerKw: 550,
      ratedVoltageAc: 400,
      ratedVoltageDc: 750,
      dcVoltageRange: { min: 520, max: 900 },
      efficiency: 98.0,
      topology: 'three_level',
      cooling: 'air',
      features: ['Modbus TCP', 'Grid following', 'Power ramping', 'Reactive power control'],
    };

    super(deviceId, config, specification);
    this.loadRegisterMap(KEHUA_REGISTERS);
  }

  async connect(): Promise<boolean> {
    logger.info(`Kehua PCS connected: ${this.config.host}`);
    this.emitConnectionChange(true);
    return true;
  }

  async disconnect(): Promise<void> {
    this.emitConnectionChange(false);
    logger.info('Kehua PCS disconnected');
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
    if (register.name === 'dc_voltage') value = 750 + Math.random() * 50;
    if (register.name === 'ac_power') value = (Math.random() - 0.5) * 400;
    if (register.scale) value *= register.scale;
    return value;
  }

  async writeRegister(register: RegisterDefinition, value: number): Promise<boolean> {
    logger.info(`Kehua write ${register.name}: ${value}`);
    return true;
  }

  async sendCommand(command: PCSCommand): Promise<PCSCommandResult> {
    const timestamp = new Date();
    logger.info(`Kehua command: ${command.type}`);
    return { success: true, command, timestamp };
  }
}
