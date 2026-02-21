/**
 * Telemetry Processing Service
 * Processes raw hardware telemetry data into standardized SystemTelemetry format
 */

import { SystemTelemetry } from '../../../../../packages/shared/src/types/optimization';

export interface RawTelemetryData {
  timestamp?: number;
  soc?: number; // State of charge (%)
  soh?: number; // State of health (%)
  temperature?: number; // Celsius
  voltage?: number; // Volts
  current?: number; // Amps
  power?: number; // Watts
  numCells?: number;
  cellVoltages?: number[];
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Battery configuration (LiFePO4 typical values)
export interface BatteryConfig {
  numCells?: number;       // Number of cells in series (e.g., 96 for 384V system)
  nominalVoltagePerCell?: number; // Nominal voltage per cell (3.2V for LiFePO4)
  minVoltagePerCell?: number;     // Min voltage per cell (2.5V for LiFePO4)
  maxVoltagePerCell?: number;     // Max voltage per cell (3.65V for LiFePO4)
}

export const DEFAULT_BATTERY_CONFIG: BatteryConfig = {
  numCells: 96,           // Default: 96 cells in series = 307.2V nominal
  nominalVoltagePerCell: 3.2,
  minVoltagePerCell: 2.5,
  maxVoltagePerCell: 3.65,
};

export class TelemetryProcessor {
  constructor(
    private systemId: string,
    private batteryConfig: BatteryConfig = DEFAULT_BATTERY_CONFIG
  ) {}

  /**
   * Process raw telemetry data into standardized format
   * @param rawData Raw data from hardware
   * @returns Processed SystemTelemetry
   */
  processar(rawData: RawTelemetryData): SystemTelemetry {
    return {
      systemId: this.systemId,
      soc: rawData.soc ?? 50,
      soh: rawData.soh ?? 100,
      temperature: rawData.temperature ?? 25,
      voltage: rawData.voltage ?? 800,
      current: rawData.current ?? 0,
      power: rawData.power ?? 0,
      timestamp: new Date(rawData.timestamp || Date.now()),
    };
  }

  /**
   * Validate telemetry data ranges
   * @param telemetry Telemetry to validate
   * @returns Validation result with errors
   */
  validar(telemetry: SystemTelemetry): ValidationResult {
    const errors: string[] = [];

    // SOC validation (0-100%)
    if (telemetry.soc < 0 || telemetry.soc > 100) {
      errors.push(`SOC out of range: ${telemetry.soc}% (expected 0-100%)`);
    }

    // SOH validation (0-100%)
    if (telemetry.soh < 0 || telemetry.soh > 100) {
      errors.push(`SOH out of range: ${telemetry.soh}% (expected 0-100%)`);
    }

    // Temperature validation (-20 to 60°C typical for LiFePO4)
    if (telemetry.temperature < -20 || telemetry.temperature > 60) {
      errors.push(`Temperature out of safe range: ${telemetry.temperature}°C`);
    }

    // Voltage validation (typically 600-1000V for battery systems)
    if (telemetry.voltage < 600 || telemetry.voltage > 1000) {
      errors.push(`Voltage out of expected range: ${telemetry.voltage}V`);
    }

    // Current validation (typically -300 to 300A)
    if (Math.abs(telemetry.current) > 500) {
      errors.push(`Current exceeds safe limit: ${telemetry.current}A`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate moving average of historical values
   * @param historico Array of historical values
   * @param janela Window size for moving average
   * @returns Moving average value
   */
  calcularMediaMovel(historico: number[], janela: number = 5): number {
    if (historico.length === 0) return 0;

    const tamanho = Math.min(janela, historico.length);
    const ultimos = historico.slice(-tamanho);
    const soma = ultimos.reduce((a, b) => a + b, 0);

    return soma / tamanho;
  }

  /**
   * Detect anomalies in telemetry data
   * @param atual Current telemetry
   * @param anterior Previous telemetry
   * @returns Anomalies detected
   */
  detectarAnomalias(atual: SystemTelemetry, anterior: SystemTelemetry): string[] {
    const anomalias: string[] = [];

    // Sudden SOC change (more than 10% per reading)
    const deltaSOC = Math.abs(atual.soc - anterior.soc);
    if (deltaSOC > 10) {
      anomalias.push(`Sudden SOC change: ${deltaSOC.toFixed(1)}%`);
    }

    // Sudden temperature change (more than 5°C per reading)
    const deltaTemp = Math.abs(atual.temperature - anterior.temperature);
    if (deltaTemp > 5) {
      anomalias.push(`Sudden temperature change: ${deltaTemp.toFixed(1)}°C`);
    }

    // Voltage instability
    const deltaVoltage = Math.abs(atual.voltage - anterior.voltage);
    if (deltaVoltage > 50) {
      anomalias.push(`Voltage instability: ${deltaVoltage.toFixed(0)}V change`);
    }

    return anomalias;
  }
}
