/**
 * Sungrow PCS Driver
 * Supports Sungrow SC/ST series PCS with Modbus TCP
 * Silicon Carbide (SiC) technology, up to 450kW
 */

import {
  BasePCSDriver,
  PCSConnectionConfig,
  PCSSpecification,
  PCSTelemetry,
  PCSCommand,
  PCSCommandResult,
  PCSOperatingMode,
  RegisterDefinition,
  PCSProtocol,
} from './base-pcs-driver.js';
import { logger } from '../../../utils/logger.js';

// Sungrow-specific register definitions
const SUNGROW_REGISTERS: RegisterDefinition[] = [
  // System Status
  { name: 'system_state', address: 5000, length: 1, type: 'uint16', access: 'read', description: 'System Running State' },
  { name: 'fault_code_1', address: 5001, length: 1, type: 'uint16', access: 'read', description: 'Fault Code 1' },
  { name: 'fault_code_2', address: 5002, length: 1, type: 'uint16', access: 'read', description: 'Fault Code 2' },
  { name: 'warning_code', address: 5003, length: 1, type: 'uint16', access: 'read', description: 'Warning Code' },

  // DC Side
  { name: 'dc_voltage', address: 5010, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', description: 'DC Bus Voltage' },
  { name: 'dc_current', address: 5011, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read', description: 'DC Current' },
  { name: 'dc_power', address: 5012, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read', description: 'DC Power' },

  // AC Side - Grid
  { name: 'ac_voltage_l1', address: 5020, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', description: 'Grid Voltage L1' },
  { name: 'ac_voltage_l2', address: 5021, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', description: 'Grid Voltage L2' },
  { name: 'ac_voltage_l3', address: 5022, length: 1, type: 'uint16', scale: 0.1, unit: 'V', access: 'read', description: 'Grid Voltage L3' },
  { name: 'ac_current_l1', address: 5023, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read', description: 'Grid Current L1' },
  { name: 'ac_current_l2', address: 5024, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read', description: 'Grid Current L2' },
  { name: 'ac_current_l3', address: 5025, length: 1, type: 'int16', scale: 0.1, unit: 'A', access: 'read', description: 'Grid Current L3' },
  { name: 'ac_frequency', address: 5026, length: 1, type: 'uint16', scale: 0.01, unit: 'Hz', access: 'read', description: 'Grid Frequency' },
  { name: 'ac_power', address: 5030, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'read', description: 'Active Power' },
  { name: 'ac_reactive_power', address: 5032, length: 2, type: 'int32', scale: 0.001, unit: 'kvar', access: 'read', description: 'Reactive Power' },
  { name: 'power_factor', address: 5034, length: 1, type: 'int16', scale: 0.001, access: 'read', description: 'Power Factor' },

  // Temperatures
  { name: 'inverter_temp', address: 5050, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read', description: 'Inverter Temperature' },
  { name: 'ambient_temp', address: 5051, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read', description: 'Ambient Temperature' },
  { name: 'heatsink_temp', address: 5052, length: 1, type: 'int16', scale: 0.1, unit: 'C', access: 'read', description: 'Heatsink Temperature' },

  // Energy Counters
  { name: 'energy_charged', address: 5060, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read', description: 'Total Charged Energy' },
  { name: 'energy_discharged', address: 5062, length: 2, type: 'uint32', scale: 0.1, unit: 'kWh', access: 'read', description: 'Total Discharged Energy' },

  // Efficiency
  { name: 'efficiency', address: 5070, length: 1, type: 'uint16', scale: 0.1, unit: '%', access: 'read', description: 'System Efficiency' },

  // Control Registers (Write)
  { name: 'operating_mode', address: 6000, length: 1, type: 'uint16', access: 'readwrite', description: 'Operating Mode' },
  { name: 'power_setpoint', address: 6001, length: 2, type: 'int32', scale: 0.001, unit: 'kW', access: 'readwrite', description: 'Power Setpoint' },
  { name: 'reactive_setpoint', address: 6003, length: 2, type: 'int32', scale: 0.001, unit: 'kvar', access: 'readwrite', description: 'Reactive Power Setpoint' },
  { name: 'start_stop', address: 6010, length: 1, type: 'uint16', access: 'write', description: 'Start/Stop Command' },
  { name: 'reset_fault', address: 6011, length: 1, type: 'uint16', access: 'write', description: 'Reset Fault Command' },
  { name: 'grid_connect', address: 6012, length: 1, type: 'uint16', access: 'write', description: 'Grid Connect Command' },
];

// Sungrow operating mode mapping
const SUNGROW_MODE_MAP: Record<number, PCSOperatingMode> = {
  0: PCSOperatingMode.STANDBY,
  1: PCSOperatingMode.GRID_FOLLOWING,
  2: PCSOperatingMode.CHARGING,
  3: PCSOperatingMode.DISCHARGING,
  4: PCSOperatingMode.OFF_GRID,
  5: PCSOperatingMode.GRID_FORMING,
  6: PCSOperatingMode.FAULT,
  7: PCSOperatingMode.MAINTENANCE,
};

export class SungrowPCSDriver extends BasePCSDriver {
  private modbusClient: any = null;

  constructor(deviceId: string, config: PCSConnectionConfig) {
    const specification: PCSSpecification = {
      manufacturer: 'Sungrow',
      model: 'SC450KTL-H',
      ratedPowerKw: 450,
      maxPowerKw: 495, // 110% overload
      ratedVoltageAc: 400,
      ratedVoltageDc: 750,
      dcVoltageRange: { min: 520, max: 1000 },
      efficiency: 98.8, // SiC efficiency
      topology: 'three_level',
      cooling: 'liquid',
      features: [
        'Silicon Carbide MOSFETs',
        'Active power control',
        'Reactive power control',
        'Frequency regulation',
        'Voltage regulation',
        'Black start capability',
        'Anti-islanding',
      ],
    };

    super(deviceId, config, specification);
    this.loadRegisterMap(SUNGROW_REGISTERS);
  }

  async connect(): Promise<boolean> {
    try {
      if (this.config.protocol !== PCSProtocol.MODBUS_TCP) {
        throw new Error('Sungrow driver requires Modbus TCP');
      }

      // In production, use modbus-serial or similar library
      // const ModbusRTU = require('modbus-serial');
      // this.modbusClient = new ModbusRTU();
      // await this.modbusClient.connectTCP(this.config.host, { port: this.config.port || 502 });
      // this.modbusClient.setID(this.config.slaveId || 1);

      logger.info(`Sungrow PCS connected: ${this.config.host}:${this.config.port || 502}`);
      this.emitConnectionChange(true);
      return true;

    } catch (error) {
      logger.error(`Sungrow PCS connection failed: ${error}`);
      this.emitConnectionChange(false);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.modbusClient) {
      // await this.modbusClient.close();
      this.modbusClient = null;
    }
    this.emitConnectionChange(false);
    logger.info('Sungrow PCS disconnected');
  }

  async readTelemetry(): Promise<PCSTelemetry> {
    const rawData = new Map<string, number>();

    // Read all telemetry registers
    for (const [name, register] of this.registerMap) {
      if (register.access === 'read' || register.access === 'readwrite') {
        try {
          const value = await this.readRegister(register);
          if (typeof value === 'number') {
            rawData.set(name, value);
          }
        } catch (error) {
          logger.warn(`Failed to read register ${name}: ${error}`);
        }
      }
    }

    const telemetry = this.createTelemetry(rawData);
    this.emitTelemetry(telemetry);
    return telemetry;
  }

  async readRegister(register: RegisterDefinition): Promise<number> {
    // Simulated read - in production use actual Modbus read
    // const result = await this.modbusClient.readHoldingRegisters(register.address, register.length);

    // Simulation for development
    let value = Math.random() * 100;

    if (register.name === 'dc_voltage') value = 750 + Math.random() * 50;
    if (register.name === 'ac_power') value = (Math.random() - 0.5) * 400;
    if (register.name === 'dc_power') value = (Math.random() - 0.5) * 400;
    if (register.name === 'efficiency') value = 98 + Math.random() * 1;
    if (register.name === 'system_state') value = 2; // Discharging
    if (register.name === 'ac_frequency') value = 60 + (Math.random() - 0.5) * 0.1;
    if (register.name.includes('ac_voltage')) value = 230 + Math.random() * 10;
    if (register.name.includes('temp')) value = 35 + Math.random() * 10;

    // Apply scale and offset
    if (register.scale) value *= register.scale;
    if (register.offset) value += register.offset;

    return value;
  }

  async writeRegister(register: RegisterDefinition, value: number): Promise<boolean> {
    try {
      // Apply inverse scale
      let writeValue = value;
      if (register.scale) writeValue /= register.scale;
      if (register.offset) writeValue -= register.offset;

      // In production: await this.modbusClient.writeRegister(register.address, writeValue);

      logger.info(`Sungrow write ${register.name}: ${value}`);
      return true;

    } catch (error) {
      logger.error(`Sungrow write failed ${register.name}: ${error}`);
      return false;
    }
  }

  async sendCommand(command: PCSCommand): Promise<PCSCommandResult> {
    const timestamp = new Date();

    try {
      switch (command.type) {
        case 'power_setpoint': {
          const powerKw = command.parameters.powerKw as number;
          const register = this.registerMap.get('power_setpoint');
          if (register) {
            const success = await this.writeRegister(register, powerKw * 1000); // Convert to W
            return { success, command, timestamp };
          }
          break;
        }

        case 'mode_change': {
          const mode = command.parameters.mode as PCSOperatingMode;
          const modeValue = Object.entries(SUNGROW_MODE_MAP).find(([_, v]) => v === mode)?.[0];
          if (modeValue) {
            const register = this.registerMap.get('operating_mode');
            if (register) {
              const success = await this.writeRegister(register, Number(modeValue));
              return { success, command, timestamp };
            }
          }
          break;
        }

        case 'start': {
          const register = this.registerMap.get('start_stop');
          if (register) {
            const success = await this.writeRegister(register, 1);
            return { success, command, timestamp };
          }
          break;
        }

        case 'stop': {
          const register = this.registerMap.get('start_stop');
          if (register) {
            const success = await this.writeRegister(register, 0);
            return { success, command, timestamp };
          }
          break;
        }

        case 'reset': {
          const register = this.registerMap.get('reset_fault');
          if (register) {
            const success = await this.writeRegister(register, 1);
            return { success, command, timestamp };
          }
          break;
        }

        case 'grid_connect': {
          const register = this.registerMap.get('grid_connect');
          if (register) {
            const success = await this.writeRegister(register, 1);
            return { success, command, timestamp };
          }
          break;
        }

        case 'grid_disconnect': {
          const register = this.registerMap.get('grid_connect');
          if (register) {
            const success = await this.writeRegister(register, 0);
            return { success, command, timestamp };
          }
          break;
        }
      }

      return {
        success: false,
        command,
        timestamp,
        error: `Unknown command type: ${command.type}`,
      };

    } catch (error) {
      return {
        success: false,
        command,
        timestamp,
        error: String(error),
      };
    }
  }

  protected parseOperatingMode(value: number): PCSOperatingMode {
    return SUNGROW_MODE_MAP[value] || PCSOperatingMode.STANDBY;
  }

  /**
   * Sungrow-specific: Enable frequency droop control
   */
  async enableFrequencyDroop(droopPercent: number): Promise<boolean> {
    // Custom Sungrow register for frequency droop
    const register: RegisterDefinition = {
      name: 'freq_droop',
      address: 6020,
      length: 1,
      type: 'uint16',
      scale: 0.1,
      access: 'write',
    };
    return this.writeRegister(register, droopPercent);
  }

  /**
   * Sungrow-specific: Enable voltage droop control
   */
  async enableVoltageDroop(droopPercent: number): Promise<boolean> {
    const register: RegisterDefinition = {
      name: 'volt_droop',
      address: 6021,
      length: 1,
      type: 'uint16',
      scale: 0.1,
      access: 'write',
    };
    return this.writeRegister(register, droopPercent);
  }

  /**
   * Sungrow-specific: Set reactive power control mode
   */
  async setReactivePowerMode(mode: 'pf' | 'var' | 'qv'): Promise<boolean> {
    const modeMap = { pf: 0, var: 1, qv: 2 };
    const register: RegisterDefinition = {
      name: 'reactive_mode',
      address: 6022,
      length: 1,
      type: 'uint16',
      access: 'write',
    };
    return this.writeRegister(register, modeMap[mode]);
  }
}
