/**
 * Coolant Monitor Service
 * Monitors coolant flow, temperature, and health for liquid cooling systems
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export interface CoolantSensorReading {
  sensorId: string;
  type: CoolantSensorType;
  value: number;
  unit: string;
  timestamp: Date;
  quality: 'good' | 'degraded' | 'bad';
}

export enum CoolantSensorType {
  TEMPERATURE_INLET = 'temperature_inlet',
  TEMPERATURE_OUTLET = 'temperature_outlet',
  FLOW_RATE = 'flow_rate',
  PRESSURE = 'pressure',
  CONDUCTIVITY = 'conductivity',
  PH_LEVEL = 'ph_level',
  LEVEL = 'level',
}

export interface CoolantStatus {
  systemId: string;
  inletTemperature: number;  // °C
  outletTemperature: number;  // °C
  deltaT: number;  // Temperature difference
  flowRate: number;  // L/min
  pressure: number;  // bar
  level: number;  // Percentage
  conductivity?: number;  // µS/cm
  phLevel?: number;
  health: CoolantHealth;
  lastUpdate: Date;
}

export enum CoolantHealth {
  OPTIMAL = 'optimal',
  GOOD = 'good',
  DEGRADED = 'degraded',
  WARNING = 'warning',
  CRITICAL = 'critical',
  FAULT = 'fault',
}

export interface CoolantAlarm {
  id: string;
  systemId: string;
  type: CoolantAlarmType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export enum CoolantAlarmType {
  HIGH_INLET_TEMP = 'high_inlet_temp',
  HIGH_OUTLET_TEMP = 'high_outlet_temp',
  HIGH_DELTA_T = 'high_delta_t',
  LOW_FLOW_RATE = 'low_flow_rate',
  HIGH_PRESSURE = 'high_pressure',
  LOW_PRESSURE = 'low_pressure',
  LOW_LEVEL = 'low_level',
  HIGH_CONDUCTIVITY = 'high_conductivity',
  ABNORMAL_PH = 'abnormal_ph',
  PUMP_FAULT = 'pump_fault',
  LEAK_DETECTED = 'leak_detected',
}

export interface CoolantThresholds {
  maxInletTemp: number;
  maxOutletTemp: number;
  maxDeltaT: number;
  minFlowRate: number;
  maxPressure: number;
  minPressure: number;
  minLevel: number;
  maxConductivity: number;
  minPh: number;
  maxPh: number;
}

// ============================================
// DEFAULT THRESHOLDS
// ============================================

const DEFAULT_THRESHOLDS: CoolantThresholds = {
  maxInletTemp: 35,       // °C
  maxOutletTemp: 45,      // °C
  maxDeltaT: 15,          // °C
  minFlowRate: 10,        // L/min
  maxPressure: 4.0,       // bar
  minPressure: 1.0,       // bar
  minLevel: 20,           // %
  maxConductivity: 1000,  // µS/cm
  minPh: 6.5,
  maxPh: 8.5,
};

// ============================================
// COOLANT MONITOR SERVICE
// ============================================

export class CoolantMonitor extends EventEmitter {
  private systemStatuses: Map<string, CoolantStatus> = new Map();
  private sensorReadings: Map<string, CoolantSensorReading[]> = new Map();
  private alarms: CoolantAlarm[] = [];
  private thresholds: Map<string, CoolantThresholds> = new Map();

  private readonly maxReadingsHistory = 1000;
  private readonly maxAlarmHistory = 500;

  constructor() {
    super();
  }

  /**
   * Process sensor reading
   */
  processSensorReading(systemId: string, reading: CoolantSensorReading): void {
    // Store reading
    const key = `${systemId}:${reading.sensorId}`;
    let readings = this.sensorReadings.get(key) || [];
    readings.push(reading);
    if (readings.length > this.maxReadingsHistory) {
      readings = readings.slice(-this.maxReadingsHistory);
    }
    this.sensorReadings.set(key, readings);

    // Update system status
    this.updateSystemStatus(systemId, reading);

    this.emit('sensorReading', { systemId, reading });
  }

  /**
   * Update system status based on all sensor readings
   */
  private updateSystemStatus(systemId: string, latestReading: CoolantSensorReading): void {
    let status = this.systemStatuses.get(systemId) || {
      systemId,
      inletTemperature: 0,
      outletTemperature: 0,
      deltaT: 0,
      flowRate: 0,
      pressure: 0,
      level: 100,
      health: CoolantHealth.GOOD,
      lastUpdate: new Date(),
    };

    // Update specific field based on sensor type
    switch (latestReading.type) {
      case CoolantSensorType.TEMPERATURE_INLET:
        status.inletTemperature = latestReading.value;
        break;
      case CoolantSensorType.TEMPERATURE_OUTLET:
        status.outletTemperature = latestReading.value;
        break;
      case CoolantSensorType.FLOW_RATE:
        status.flowRate = latestReading.value;
        break;
      case CoolantSensorType.PRESSURE:
        status.pressure = latestReading.value;
        break;
      case CoolantSensorType.LEVEL:
        status.level = latestReading.value;
        break;
      case CoolantSensorType.CONDUCTIVITY:
        status.conductivity = latestReading.value;
        break;
      case CoolantSensorType.PH_LEVEL:
        status.phLevel = latestReading.value;
        break;
    }

    // Calculate delta T
    status.deltaT = Math.abs(status.outletTemperature - status.inletTemperature);

    // Update health and check alarms
    status.health = this.calculateHealth(systemId, status);
    status.lastUpdate = new Date();

    this.systemStatuses.set(systemId, status);

    // Check for alarms
    this.checkAlarms(systemId, status);

    this.emit('statusUpdate', status);
  }

  /**
   * Calculate overall coolant system health
   */
  private calculateHealth(systemId: string, status: CoolantStatus): CoolantHealth {
    const thresholds = this.getThresholds(systemId);
    let score = 100;

    // Temperature checks
    if (status.inletTemperature > thresholds.maxInletTemp) {
      score -= 20;
    } else if (status.inletTemperature > thresholds.maxInletTemp * 0.9) {
      score -= 10;
    }

    if (status.outletTemperature > thresholds.maxOutletTemp) {
      score -= 30;
    } else if (status.outletTemperature > thresholds.maxOutletTemp * 0.9) {
      score -= 15;
    }

    if (status.deltaT > thresholds.maxDeltaT) {
      score -= 25;
    }

    // Flow rate checks
    if (status.flowRate < thresholds.minFlowRate) {
      score -= 30;
    } else if (status.flowRate < thresholds.minFlowRate * 1.2) {
      score -= 15;
    }

    // Pressure checks
    if (status.pressure > thresholds.maxPressure || status.pressure < thresholds.minPressure) {
      score -= 20;
    }

    // Level checks
    if (status.level < thresholds.minLevel) {
      score -= 40;
    } else if (status.level < thresholds.minLevel * 1.5) {
      score -= 15;
    }

    // Convert score to health status
    if (score >= 90) return CoolantHealth.OPTIMAL;
    if (score >= 70) return CoolantHealth.GOOD;
    if (score >= 50) return CoolantHealth.DEGRADED;
    if (score >= 30) return CoolantHealth.WARNING;
    if (score >= 10) return CoolantHealth.CRITICAL;
    return CoolantHealth.FAULT;
  }

  /**
   * Check and generate alarms
   */
  private checkAlarms(systemId: string, status: CoolantStatus): void {
    const thresholds = this.getThresholds(systemId);

    // Check each threshold
    if (status.inletTemperature > thresholds.maxInletTemp) {
      this.createAlarm(systemId, CoolantAlarmType.HIGH_INLET_TEMP, 'critical',
        `Inlet temperature ${status.inletTemperature.toFixed(1)}°C exceeds limit`,
        status.inletTemperature, thresholds.maxInletTemp);
    }

    if (status.outletTemperature > thresholds.maxOutletTemp) {
      this.createAlarm(systemId, CoolantAlarmType.HIGH_OUTLET_TEMP, 'critical',
        `Outlet temperature ${status.outletTemperature.toFixed(1)}°C exceeds limit`,
        status.outletTemperature, thresholds.maxOutletTemp);
    }

    if (status.deltaT > thresholds.maxDeltaT) {
      this.createAlarm(systemId, CoolantAlarmType.HIGH_DELTA_T, 'warning',
        `Temperature differential ${status.deltaT.toFixed(1)}°C too high`,
        status.deltaT, thresholds.maxDeltaT);
    }

    if (status.flowRate < thresholds.minFlowRate) {
      this.createAlarm(systemId, CoolantAlarmType.LOW_FLOW_RATE, 'critical',
        `Flow rate ${status.flowRate.toFixed(1)} L/min below minimum`,
        status.flowRate, thresholds.minFlowRate);
    }

    if (status.pressure > thresholds.maxPressure) {
      this.createAlarm(systemId, CoolantAlarmType.HIGH_PRESSURE, 'warning',
        `Pressure ${status.pressure.toFixed(2)} bar exceeds maximum`,
        status.pressure, thresholds.maxPressure);
    }

    if (status.pressure < thresholds.minPressure) {
      this.createAlarm(systemId, CoolantAlarmType.LOW_PRESSURE, 'critical',
        `Pressure ${status.pressure.toFixed(2)} bar below minimum`,
        status.pressure, thresholds.minPressure);
    }

    if (status.level < thresholds.minLevel) {
      this.createAlarm(systemId, CoolantAlarmType.LOW_LEVEL, 'critical',
        `Coolant level ${status.level.toFixed(0)}% critically low`,
        status.level, thresholds.minLevel);
    }

    if (status.conductivity && status.conductivity > thresholds.maxConductivity) {
      this.createAlarm(systemId, CoolantAlarmType.HIGH_CONDUCTIVITY, 'warning',
        `Coolant conductivity ${status.conductivity} µS/cm indicates contamination`,
        status.conductivity, thresholds.maxConductivity);
    }

    if (status.phLevel && (status.phLevel < thresholds.minPh || status.phLevel > thresholds.maxPh)) {
      this.createAlarm(systemId, CoolantAlarmType.ABNORMAL_PH, 'warning',
        `Coolant pH ${status.phLevel.toFixed(1)} out of acceptable range`,
        status.phLevel, status.phLevel < thresholds.minPh ? thresholds.minPh : thresholds.maxPh);
    }
  }

  /**
   * Create alarm
   */
  private createAlarm(
    systemId: string,
    type: CoolantAlarmType,
    severity: 'info' | 'warning' | 'critical',
    message: string,
    value: number,
    threshold: number
  ): void {
    // Check if same alarm already exists (to avoid duplicates)
    const recentAlarms = this.alarms.filter(
      a => a.systemId === systemId &&
           a.type === type &&
           Date.now() - a.timestamp.getTime() < 60000 // Within 1 minute
    );

    if (recentAlarms.length > 0) return;

    const alarm: CoolantAlarm = {
      id: `alarm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      systemId,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alarms.push(alarm);
    if (this.alarms.length > this.maxAlarmHistory) {
      this.alarms.shift();
    }

    logger.warn(`Coolant alarm: ${systemId} - ${message}`);
    this.emit('alarm', alarm);
  }

  /**
   * Get status for a system
   */
  getStatus(systemId: string): CoolantStatus | undefined {
    return this.systemStatuses.get(systemId);
  }

  /**
   * Get all system statuses
   */
  getAllStatuses(): CoolantStatus[] {
    return Array.from(this.systemStatuses.values());
  }

  /**
   * Get sensor readings history
   */
  getSensorHistory(
    systemId: string,
    sensorType: CoolantSensorType,
    limit: number = 100
  ): CoolantSensorReading[] {
    const allReadings: CoolantSensorReading[] = [];

    for (const [key, readings] of this.sensorReadings.entries()) {
      if (key.startsWith(`${systemId}:`)) {
        allReadings.push(...readings.filter(r => r.type === sensorType));
      }
    }

    return allReadings.slice(-limit);
  }

  /**
   * Get alarms
   */
  getAlarms(systemId?: string, unacknowledgedOnly: boolean = false): CoolantAlarm[] {
    return this.alarms.filter(a => {
      if (systemId && a.systemId !== systemId) return false;
      if (unacknowledgedOnly && a.acknowledged) return false;
      return true;
    });
  }

  /**
   * Acknowledge alarm
   */
  acknowledgeAlarm(alarmId: string): boolean {
    const alarm = this.alarms.find(a => a.id === alarmId);
    if (!alarm) return false;

    alarm.acknowledged = true;
    this.emit('alarmAcknowledged', alarm);
    return true;
  }

  /**
   * Set thresholds for a system
   */
  setThresholds(systemId: string, thresholds: Partial<CoolantThresholds>): void {
    const current = this.thresholds.get(systemId) || { ...DEFAULT_THRESHOLDS };
    this.thresholds.set(systemId, { ...current, ...thresholds });
  }

  /**
   * Get thresholds for a system
   */
  getThresholds(systemId: string): CoolantThresholds {
    return this.thresholds.get(systemId) || DEFAULT_THRESHOLDS;
  }

  /**
   * Calculate cooling efficiency
   */
  calculateEfficiency(systemId: string): number {
    const status = this.systemStatuses.get(systemId);
    if (!status) return 0;

    // Efficiency based on delta T and flow rate
    // Higher flow with lower delta T = better efficiency
    const idealDeltaT = 8; // Ideal temperature difference
    const deltaTEfficiency = Math.max(0, 100 - Math.abs(status.deltaT - idealDeltaT) * 5);

    const minFlow = this.getThresholds(systemId).minFlowRate;
    const flowEfficiency = Math.min(100, (status.flowRate / minFlow) * 50 + 50);

    return (deltaTEfficiency + flowEfficiency) / 2;
  }

  /**
   * Get cooling capacity (kW)
   */
  getCoolingCapacity(systemId: string): number {
    const status = this.systemStatuses.get(systemId);
    if (!status) return 0;

    // Q = m * Cp * ΔT
    // Assuming water: Cp = 4.186 kJ/(kg·K), density = 1 kg/L
    const flowRateKgPerSec = status.flowRate / 60; // Convert L/min to kg/s
    const specificHeat = 4.186; // kJ/(kg·K)
    const coolingKW = flowRateKgPerSec * specificHeat * status.deltaT;

    return Math.round(coolingKW * 100) / 100;
  }
}

export const coolantMonitor = new CoolantMonitor();
