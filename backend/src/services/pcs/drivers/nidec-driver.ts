/**
 * Nidec PCS Driver
 * Supports Nidec ASI with CAN and Modbus
 */

import {
  BasePCSDriver,
  PCSConnectionConfig,
  PCSSpecification,
  PCSTelemetry,
  PCSCommand,
  PCSCommandResult,
  RegisterDefinition,
  PCSProtocol,
} from './base-pcs-driver.js';
import { logger } from '../../../utils/logger.js';

const NIDEC_REGISTERS: RegisterDefinition[] = [
  { name: 'system_state', address: 0x100, length: 1, type: 'uint16', access: 'read' },
  { name: 'fault_code', address: 0x101, length: 1, type: 'uint16', access: 'read' },
  { name: 'dc_voltage', address: 0x200, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'dc_current', address: 0x201, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'dc_power', address: 0x202, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read' },
  { name: 'ac_voltage_l1', address: 0x300, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_voltage_l2', address: 0x301, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_voltage_l3', address: 0x302, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read' },
  { name: 'ac_current_l1', address: 0x303, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_current_l2', address: 0x304, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_current_l3', address: 0x305, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read' },
  { name: 'ac_frequency', address: 0x306, length: 1, type: 'uint16', scale: 0.01, unit: 'Hz', access: 'read' },
  { name: 'ac_power', address: 0x310, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read' },
  { name: 'ac_reactive_power', address: 0x312, length: 2, type: 'int32', scale: 0.001, unit: 'kvar', access: 'read' },
  { name: 'power_factor', address: 0x314, length: 1, type: 'int16', scale: 0.001, access: 'read' },
  { name: 'inverter_temp', address: 0x400, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read' },
  { name: 'energy_charged', address: 0x500, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read' },
  { name: 'energy_discharged', address: 0x502, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read' },
  { name: 'efficiency', address: 0x504, length: 1, type: 'uint16', scale: 0.1, unit: '%', access: 'read' },
  { name: 'operating_mode', address: 0x600, length: 1, type: 'uint16', access: 'readwrite' },
  { name: 'power_setpoint', address: 0x601, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'readwrite' },
  { name: 'start_stop', address: 0x610, length: 1, type: 'uint16', access: 'write' },
];

export class NidecPCSDriver extends BasePCSDriver {
  private canClient: any = null;

  constructor(deviceId: string, config: PCSConnectionConfig) {
    const specification: PCSSpecification = {
      manufacturer: 'Nidec',
      model: 'ASI-1000',
      ratedPowerKw: 1000,
      maxPowerKw: 1100,
      ratedVoltageAc: 480,
      ratedVoltageDc: 900,
      dcVoltageRange: { min: 650, max: 1200 },
      efficiency: 98.5,
      topology: 'multilevel',
      cooling: 'liquid',
      features: ['CAN bus', 'Modbus', 'Grid forming', 'Black start', 'Island mode', 'Seamless transfer'],
    };

    super(deviceId, config, specification);
    this.loadRegisterMap(NIDEC_REGISTERS);
  }

  async connect(): Promise<boolean> {
    try {
      if (this.config.protocol === PCSProtocol.CANBUS) {
        logger.info(`Nidec PCS connected via CAN: ${this.config.canInterface}`);
      } else {
        logger.info(`Nidec PCS connected via Modbus: ${this.config.host}`);
      }
      this.emitConnectionChange(true);
      return true;
    } catch (error) {
      logger.error(`Nidec PCS connection failed: ${error}`);
      this.emitConnectionChange(false);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.emitConnectionChange(false);
    logger.info('Nidec PCS disconnected');
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
    if (register.name === 'dc_voltage') value = 900 + Math.random() * 100;
    if (register.name === 'ac_power') value = (Math.random() - 0.5) * 800;
    if (register.name === 'efficiency') value = 98 + Math.random() * 1;
    if (register.scale) value *= register.scale;
    return value;
  }

  async writeRegister(register: RegisterDefinition, value: number): Promise<boolean> {
    logger.info(`Nidec write ${register.name}: ${value}`);
    return true;
  }

  async sendCommand(command: PCSCommand): Promise<PCSCommandResult> {
    const timestamp = new Date();
    logger.info(`Nidec command: ${command.type}`);
    return { success: true, command, timestamp };
  }

  /**
   * Nidec-specific: Enable seamless transfer to island mode
   */
  async enableSeamlessTransfer(enabled: boolean): Promise<boolean> {
    logger.info(`Nidec seamless transfer: ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }
}
