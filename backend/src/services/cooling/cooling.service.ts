/**
 * Cooling Service
 * Central service for liquid cooling system management
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import {
  CoolantMonitor,
  CoolantStatus,
  CoolantSensorReading,
  CoolantSensorType,
  CoolantAlarm,
  CoolantThresholds,
  coolantMonitor,
} from './coolant-monitor.js';
import {
  PumpController,
  PumpStatus,
  PumpConfig,
  PumpMode,
  PumpSchedule,
  pumpController,
} from './pump-controller.js';
import {
  ThermalManagementService,
  ThermalZone,
  ThermalState,
  ControlMode,
  thermalManagement,
} from './thermal-management.js';

// ============================================
// TYPES
// ============================================

export interface CoolingSystemConfig {
  systemId: string;
  name: string;
  type: CoolingSystemType;
  capacity: number;  // kW
  primaryCoolant: CoolantType;
  hasRedundancy: boolean;
  zones: ThermalZone[];
  pumps: PumpConfig[];
}

export enum CoolingSystemType {
  DIRECT_LIQUID = 'direct_liquid',
  INDIRECT_LIQUID = 'indirect_liquid',
  IMMERSION = 'immersion',
  HYBRID = 'hybrid',
}

export enum CoolantType {
  WATER = 'water',
  WATER_GLYCOL = 'water_glycol',
  DIELECTRIC = 'dielectric',
  MINERAL_OIL = 'mineral_oil',
}

export interface CoolingDashboardData {
  systemId: string;
  name: string;
  status: 'optimal' | 'normal' | 'warning' | 'critical';
  coolant: {
    inletTemp: number;
    outletTemp: number;
    deltaT: number;
    flowRate: number;
    pressure: number;
    level: number;
  };
  pumps: Array<{
    id: string;
    name: string;
    state: string;
    speed: number;
    power: number;
  }>;
  zones: Array<{
    id: string;
    name: string;
    currentTemp: number;
    targetTemp: number;
    status: string;
  }>;
  efficiency: number;
  coolingPower: number;
  alerts: Array<{
    id: string;
    severity: string;
    message: string;
    timestamp: Date;
  }>;
}

// ============================================
// COOLING SERVICE
// ============================================

export class CoolingService extends EventEmitter {
  private systems: Map<string, CoolingSystemConfig> = new Map();
  private monitor: CoolantMonitor;
  private pump: PumpController;
  private thermal: ThermalManagementService;
  private initialized: boolean = false;

  constructor(
    monitor?: CoolantMonitor,
    pump?: PumpController,
    thermal?: ThermalManagementService
  ) {
    super();
    this.monitor = monitor || coolantMonitor;
    this.pump = pump || pumpController;
    this.thermal = thermal || thermalManagement;

    this.setupEventForwarding();
  }

  /**
   * Initialize cooling service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Cooling service initializing...');
    this.initialized = true;
    logger.info('Cooling service initialized');
  }

  /**
   * Register a cooling system
   */
  registerSystem(config: CoolingSystemConfig): void {
    this.systems.set(config.systemId, config);

    // Register pumps
    for (const pumpConfig of config.pumps) {
      this.pump.registerPump(pumpConfig);
    }

    // Register thermal zones
    for (const zone of config.zones) {
      this.thermal.registerZone(zone);
    }

    logger.info(`Cooling system registered: ${config.name} (${config.systemId})`);
    this.emit('systemRegistered', config);
  }

  /**
   * Get system configuration
   */
  getSystemConfig(systemId: string): CoolingSystemConfig | undefined {
    return this.systems.get(systemId);
  }

  // ============================================
  // SENSOR DATA
  // ============================================

  /**
   * Process sensor reading
   */
  processSensorReading(systemId: string, reading: CoolantSensorReading): void {
    this.monitor.processSensorReading(systemId, reading);
  }

  /**
   * Update zone temperature
   */
  updateZoneTemperature(zoneId: string, temperature: number): void {
    this.thermal.updateZoneTemperature(zoneId, temperature);
  }

  // ============================================
  // COOLANT STATUS
  // ============================================

  /**
   * Get coolant status
   */
  getCoolantStatus(systemId: string): CoolantStatus | undefined {
    return this.monitor.getStatus(systemId);
  }

  /**
   * Get coolant sensor history
   */
  getCoolantHistory(
    systemId: string,
    sensorType: CoolantSensorType,
    limit?: number
  ): CoolantSensorReading[] {
    return this.monitor.getSensorHistory(systemId, sensorType, limit);
  }

  /**
   * Set coolant thresholds
   */
  setCoolantThresholds(systemId: string, thresholds: Partial<CoolantThresholds>): void {
    this.monitor.setThresholds(systemId, thresholds);
  }

  /**
   * Get coolant alarms
   */
  getCoolantAlarms(systemId?: string): CoolantAlarm[] {
    return this.monitor.getAlarms(systemId);
  }

  /**
   * Acknowledge coolant alarm
   */
  acknowledgeCoolantAlarm(alarmId: string): boolean {
    return this.monitor.acknowledgeAlarm(alarmId);
  }

  // ============================================
  // PUMP CONTROL
  // ============================================

  /**
   * Get pump status
   */
  getPumpStatus(pumpId: string): PumpStatus | undefined {
    return this.pump.getPumpStatus(pumpId);
  }

  /**
   * Get all pumps for a system
   */
  getSystemPumps(systemId: string): PumpStatus[] {
    return this.pump.getSystemPumps(systemId);
  }

  /**
   * Start pump
   */
  async startPump(pumpId: string, reason?: string): Promise<boolean> {
    return this.pump.startPump(pumpId, reason);
  }

  /**
   * Stop pump
   */
  async stopPump(pumpId: string, reason?: string): Promise<boolean> {
    return this.pump.stopPump(pumpId, reason);
  }

  /**
   * Set pump speed
   */
  async setPumpSpeed(pumpId: string, speedPercent: number): Promise<boolean> {
    return this.pump.setSpeed(pumpId, speedPercent);
  }

  /**
   * Set pump mode
   */
  setPumpMode(pumpId: string, mode: PumpMode): boolean {
    return this.pump.setMode(pumpId, mode);
  }

  /**
   * Set pump schedule
   */
  setPumpSchedule(pumpId: string, schedule: PumpSchedule): void {
    this.pump.setSchedule(pumpId, schedule);
  }

  /**
   * Failover to redundant pump
   */
  async failoverPump(pumpId: string): Promise<boolean> {
    return this.pump.failoverToRedundant(pumpId);
  }

  // ============================================
  // THERMAL MANAGEMENT
  // ============================================

  /**
   * Get thermal state
   */
  getThermalState(systemId: string): ThermalState {
    return this.thermal.getThermalState(systemId);
  }

  /**
   * Set control mode
   */
  setControlMode(mode: ControlMode): void {
    this.thermal.setControlMode(mode);
  }

  /**
   * Get temperature history for a zone
   */
  getTemperatureHistory(
    zoneId: string,
    periodMinutes?: number
  ): { timestamp: Date; temp: number }[] {
    return this.thermal.getTemperatureHistory(zoneId, periodMinutes);
  }

  /**
   * Get thermal map data
   */
  getThermalMap(systemId: string) {
    return this.thermal.getThermalMap(systemId);
  }

  /**
   * Activate emergency cooling
   */
  async emergencyCooling(systemId: string): Promise<void> {
    await this.thermal.emergencyCooling(systemId);
  }

  // ============================================
  // DASHBOARD & REPORTING
  // ============================================

  /**
   * Get dashboard data
   */
  getDashboardData(systemId: string): CoolingDashboardData | null {
    const config = this.systems.get(systemId);
    if (!config) return null;

    const coolantStatus = this.monitor.getStatus(systemId);
    const pumps = this.pump.getSystemPumps(systemId);
    const thermalState = this.thermal.getThermalState(systemId);

    const status = this.calculateOverallStatus(coolantStatus, thermalState);

    return {
      systemId,
      name: config.name,
      status,
      coolant: {
        inletTemp: coolantStatus?.inletTemperature || 0,
        outletTemp: coolantStatus?.outletTemperature || 0,
        deltaT: coolantStatus?.deltaT || 0,
        flowRate: coolantStatus?.flowRate || 0,
        pressure: coolantStatus?.pressure || 0,
        level: coolantStatus?.level || 0,
      },
      pumps: pumps.map(p => ({
        id: p.pumpId,
        name: p.pumpId,
        state: p.state,
        speed: p.speedPercent,
        power: p.powerConsumption,
      })),
      zones: thermalState.zones.map(z => ({
        id: z.id,
        name: z.name,
        currentTemp: z.currentTemperature,
        targetTemp: z.targetTemperature,
        status: this.getZoneStatus(z),
      })),
      efficiency: thermalState.efficiency,
      coolingPower: thermalState.coolingPower,
      alerts: [
        ...this.monitor.getAlarms(systemId).map(a => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          timestamp: a.timestamp,
        })),
        ...thermalState.alerts.map(a => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          timestamp: a.timestamp,
        })),
      ].slice(0, 10),
    };
  }

  /**
   * Get cooling statistics
   */
  getStatistics(systemId: string): {
    avgInletTemp: number;
    avgOutletTemp: number;
    avgFlowRate: number;
    totalCoolingEnergy: number;
    pumpRunHours: number;
    efficiency: number;
    uptime: number;
  } {
    const coolantHistory = this.monitor.getSensorHistory(
      systemId,
      CoolantSensorType.TEMPERATURE_INLET,
      1000
    );

    const inletTemps = coolantHistory.map(r => r.value);
    const avgInletTemp = inletTemps.length > 0
      ? inletTemps.reduce((a, b) => a + b, 0) / inletTemps.length
      : 0;

    const outletHistory = this.monitor.getSensorHistory(
      systemId,
      CoolantSensorType.TEMPERATURE_OUTLET,
      1000
    );
    const outletTemps = outletHistory.map(r => r.value);
    const avgOutletTemp = outletTemps.length > 0
      ? outletTemps.reduce((a, b) => a + b, 0) / outletTemps.length
      : 0;

    const flowHistory = this.monitor.getSensorHistory(
      systemId,
      CoolantSensorType.FLOW_RATE,
      1000
    );
    const flowRates = flowHistory.map(r => r.value);
    const avgFlowRate = flowRates.length > 0
      ? flowRates.reduce((a, b) => a + b, 0) / flowRates.length
      : 0;

    const pumps = this.pump.getSystemPumps(systemId);
    const pumpRunHours = pumps.reduce((sum, p) => sum + p.runningHours, 0);

    const thermalState = this.thermal.getThermalState(systemId);

    return {
      avgInletTemp: Math.round(avgInletTemp * 10) / 10,
      avgOutletTemp: Math.round(avgOutletTemp * 10) / 10,
      avgFlowRate: Math.round(avgFlowRate * 10) / 10,
      totalCoolingEnergy: thermalState.coolingPower * pumpRunHours / 1000,  // kWh
      pumpRunHours: Math.round(pumpRunHours * 10) / 10,
      efficiency: thermalState.efficiency,
      uptime: this.calculateUptime(systemId),
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private setupEventForwarding(): void {
    this.monitor.on('alarm', (alarm) => {
      this.emit('coolantAlarm', alarm);
    });

    this.pump.on('pumpFault', (data) => {
      this.emit('pumpFault', data);
    });

    this.pump.on('failover', (data) => {
      this.emit('pumpFailover', data);
    });

    this.thermal.on('alert', (alert) => {
      this.emit('thermalAlert', alert);
    });

    this.thermal.on('emergencyCooling', (data) => {
      this.emit('emergencyCooling', data);
    });
  }

  private calculateOverallStatus(
    coolant: CoolantStatus | undefined,
    thermal: ThermalState
  ): 'optimal' | 'normal' | 'warning' | 'critical' {
    if (!coolant) return 'warning';

    const coolantHealth = coolant.health;
    const thermalHealth = thermal.health;

    if (coolantHealth === 'critical' || coolantHealth === 'fault' ||
        thermalHealth === 'critical') {
      return 'critical';
    }

    if (coolantHealth === 'warning' || coolantHealth === 'degraded' ||
        thermalHealth === 'poor') {
      return 'warning';
    }

    if (coolantHealth === 'optimal' && thermalHealth === 'optimal') {
      return 'optimal';
    }

    return 'normal';
  }

  private getZoneStatus(zone: ThermalZone): string {
    const deviation = Math.abs(zone.currentTemperature - zone.targetTemperature);
    if (deviation <= 2) return 'optimal';
    if (deviation <= 5) return 'normal';
    if (zone.currentTemperature > zone.maxTemperature) return 'critical';
    return 'warning';
  }

  private calculateUptime(systemId: string): number {
    // Simplified uptime calculation
    const pumps = this.pump.getSystemPumps(systemId);
    if (pumps.length === 0) return 100;

    const runningPumps = pumps.filter(p => p.state === 'running').length;
    return (runningPumps / pumps.length) * 100;
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.pump.shutdown();
    this.thermal.shutdown();
  }
}

// Export singleton and sub-services
export const coolingService = new CoolingService(coolantMonitor, pumpController, thermalManagement);
export { coolantMonitor, pumpController, thermalManagement };
