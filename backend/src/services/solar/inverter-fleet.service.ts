/**
 * Inverter Fleet Service
 * Manages multiple solar inverters as a coordinated fleet
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export enum InverterStatus {
  OFFLINE = 'offline',
  STANDBY = 'standby',
  RUNNING = 'running',
  FAULT = 'fault',
  MAINTENANCE = 'maintenance',
  LIMITED = 'limited'
}

export enum InverterType {
  STRING = 'string',
  CENTRAL = 'central',
  MICRO = 'micro',
  HYBRID = 'hybrid'
}

export interface InverterConfig {
  id: string;
  name: string;
  type: InverterType;
  manufacturer: string;
  model: string;
  ratedPowerKW: number;
  maxACCurrentA: number;
  maxDCVoltageV: number;
  mpptChannels: number;
  efficiency: number;
  host: string;
  port: number;
  slaveId: number;
}

export interface InverterTelemetry {
  inverterId: string;
  timestamp: Date;
  status: InverterStatus;
  acPowerKW: number;
  dcPowerKW: number;
  efficiency: number;
  acVoltageV: number;
  acCurrentA: number;
  acFrequencyHz: number;
  dcVoltageV: number;
  dcCurrentA: number;
  temperatureC: number;
  energyTodayKWh: number;
  energyTotalMWh: number;
  mpptData: MPPTData[];
  alarms: string[];
  warnings: string[];
}

export interface MPPTData {
  channel: number;
  voltageV: number;
  currentA: number;
  powerKW: number;
}

export interface FleetSummary {
  totalInverters: number;
  onlineInverters: number;
  offlineInverters: number;
  faultedInverters: number;
  totalCapacityKW: number;
  currentGenerationKW: number;
  fleetEfficiency: number;
  energyTodayKWh: number;
  energyTotalMWh: number;
  avgTemperatureC: number;
  pvAvailabilityPercent: number;
}

export interface PowerDistribution {
  inverterId: string;
  targetPowerKW: number;
  actualPowerKW: number;
  curtailmentKW: number;
}

// ============================================
// INVERTER FLEET SERVICE
// ============================================

export class InverterFleetService extends EventEmitter {
  private static instance: InverterFleetService;

  private inverters: Map<string, InverterConfig> = new Map();
  private telemetry: Map<string, InverterTelemetry> = new Map();
  private powerTargets: Map<string, number> = new Map();

  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_PERIOD_MS = 1000;

  private constructor() {
    super();
  }

  static getInstance(): InverterFleetService {
    if (!InverterFleetService.instance) {
      InverterFleetService.instance = new InverterFleetService();
    }
    return InverterFleetService.instance;
  }

  /**
   * Register an inverter in the fleet
   */
  registerInverter(config: InverterConfig): void {
    this.inverters.set(config.id, config);

    // Initialize telemetry
    this.telemetry.set(config.id, {
      inverterId: config.id,
      timestamp: new Date(),
      status: InverterStatus.OFFLINE,
      acPowerKW: 0,
      dcPowerKW: 0,
      efficiency: 0,
      acVoltageV: 0,
      acCurrentA: 0,
      acFrequencyHz: 0,
      dcVoltageV: 0,
      dcCurrentA: 0,
      temperatureC: 0,
      energyTodayKWh: 0,
      energyTotalMWh: 0,
      mpptData: [],
      alarms: [],
      warnings: []
    });

    // Set initial power target to rated power
    this.powerTargets.set(config.id, config.ratedPowerKW);

    logger.info(`Registered inverter: ${config.id} (${config.manufacturer} ${config.model})`);
    this.emit('inverterRegistered', config);
  }

  /**
   * Unregister an inverter
   */
  unregisterInverter(inverterId: string): boolean {
    const removed = this.inverters.delete(inverterId);
    this.telemetry.delete(inverterId);
    this.powerTargets.delete(inverterId);

    if (removed) {
      logger.info(`Unregistered inverter: ${inverterId}`);
      this.emit('inverterUnregistered', inverterId);
    }

    return removed;
  }

  /**
   * Start fleet monitoring
   */
  startMonitoring(): void {
    if (this.pollingInterval) {
      return;
    }

    this.pollingInterval = setInterval(() => {
      this.pollAllInverters();
    }, this.POLLING_PERIOD_MS);

    logger.info('Inverter fleet monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop fleet monitoring
   */
  stopMonitoring(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    logger.info('Inverter fleet monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Poll all inverters for telemetry
   */
  private async pollAllInverters(): Promise<void> {
    const pollPromises = Array.from(this.inverters.keys()).map(id =>
      this.pollInverter(id).catch(error => {
        logger.error(`Failed to poll inverter ${id}:`, error);
      })
    );

    await Promise.all(pollPromises);

    // Emit fleet summary
    this.emit('fleetTelemetry', this.getFleetSummary());
  }

  /**
   * Poll single inverter
   */
  private async pollInverter(inverterId: string): Promise<void> {
    const config = this.inverters.get(inverterId);
    if (!config) return;

    // In production, this would communicate with actual inverter
    // For now, simulate telemetry
    const telemetry = this.simulateInverterTelemetry(config);
    this.telemetry.set(inverterId, telemetry);

    this.emit('inverterTelemetry', telemetry);
  }

  /**
   * Simulate inverter telemetry (for development)
   */
  private simulateInverterTelemetry(config: InverterConfig): InverterTelemetry {
    const now = new Date();
    const hour = now.getHours();

    // Simulate solar curve (peak at noon)
    const solarFactor = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
    const cloudFactor = 0.8 + Math.random() * 0.2; // 80-100% clearness

    const dcPower = config.ratedPowerKW * solarFactor * cloudFactor;
    const efficiency = dcPower > 0 ? 0.95 + Math.random() * 0.03 : 0;
    const acPower = dcPower * efficiency;

    // Generate MPPT data
    const mpptData: MPPTData[] = [];
    const powerPerMPPT = dcPower / config.mpptChannels;
    for (let i = 0; i < config.mpptChannels; i++) {
      const mpptVariation = 0.9 + Math.random() * 0.2;
      mpptData.push({
        channel: i + 1,
        voltageV: 500 + Math.random() * 200,
        currentA: (powerPerMPPT * 1000 * mpptVariation) / (500 + Math.random() * 200),
        powerKW: powerPerMPPT * mpptVariation
      });
    }

    return {
      inverterId: config.id,
      timestamp: now,
      status: dcPower > 0 ? InverterStatus.RUNNING : InverterStatus.STANDBY,
      acPowerKW: acPower,
      dcPowerKW: dcPower,
      efficiency: efficiency * 100,
      acVoltageV: 380 + Math.random() * 20,
      acCurrentA: (acPower * 1000) / (Math.sqrt(3) * 400),
      acFrequencyHz: 59.95 + Math.random() * 0.1,
      dcVoltageV: dcPower > 0 ? 500 + Math.random() * 200 : 0,
      dcCurrentA: dcPower > 0 ? (dcPower * 1000) / (500 + Math.random() * 200) : 0,
      temperatureC: 25 + solarFactor * 30 + Math.random() * 5,
      energyTodayKWh: acPower * hour / 2, // Rough estimate
      energyTotalMWh: 1000 + Math.random() * 100,
      mpptData,
      alarms: [],
      warnings: []
    };
  }

  /**
   * Update telemetry from external source
   */
  updateTelemetry(inverterId: string, telemetry: Partial<InverterTelemetry>): void {
    const current = this.telemetry.get(inverterId);
    if (current) {
      this.telemetry.set(inverterId, {
        ...current,
        ...telemetry,
        inverterId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get fleet summary
   */
  getFleetSummary(): FleetSummary {
    let totalCapacity = 0;
    let currentGeneration = 0;
    let energyToday = 0;
    let energyTotal = 0;
    let tempSum = 0;
    let efficiencySum = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    let faultedCount = 0;

    for (const [id, config] of this.inverters) {
      totalCapacity += config.ratedPowerKW;

      const telemetry = this.telemetry.get(id);
      if (telemetry) {
        currentGeneration += telemetry.acPowerKW;
        energyToday += telemetry.energyTodayKWh;
        energyTotal += telemetry.energyTotalMWh;
        tempSum += telemetry.temperatureC;
        efficiencySum += telemetry.efficiency;

        switch (telemetry.status) {
          case InverterStatus.RUNNING:
          case InverterStatus.STANDBY:
            onlineCount++;
            break;
          case InverterStatus.OFFLINE:
            offlineCount++;
            break;
          case InverterStatus.FAULT:
            faultedCount++;
            break;
        }
      }
    }

    const totalInverters = this.inverters.size;

    return {
      totalInverters,
      onlineInverters: onlineCount,
      offlineInverters: offlineCount,
      faultedInverters: faultedCount,
      totalCapacityKW: totalCapacity,
      currentGenerationKW: currentGeneration,
      fleetEfficiency: totalInverters > 0 ? efficiencySum / totalInverters : 0,
      energyTodayKWh: energyToday,
      energyTotalMWh: energyTotal,
      avgTemperatureC: totalInverters > 0 ? tempSum / totalInverters : 0,
      pvAvailabilityPercent: totalCapacity > 0
        ? (currentGeneration / totalCapacity) * 100
        : 0
    };
  }

  /**
   * Distribute power target across fleet
   */
  distributePower(targetPowerKW: number): PowerDistribution[] {
    const distributions: PowerDistribution[] = [];
    const onlineInverters: Array<{ id: string; capacity: number }> = [];

    // Collect online inverters
    for (const [id, config] of this.inverters) {
      const telemetry = this.telemetry.get(id);
      if (telemetry &&
        (telemetry.status === InverterStatus.RUNNING ||
          telemetry.status === InverterStatus.STANDBY)) {
        onlineInverters.push({
          id,
          capacity: config.ratedPowerKW
        });
      }
    }

    if (onlineInverters.length === 0) {
      logger.warn('No online inverters available for power distribution');
      return distributions;
    }

    // Calculate total available capacity
    const totalCapacity = onlineInverters.reduce((sum, inv) => sum + inv.capacity, 0);

    // Proportional distribution
    for (const inverter of onlineInverters) {
      const proportion = inverter.capacity / totalCapacity;
      const targetForInverter = Math.min(
        targetPowerKW * proportion,
        inverter.capacity
      );

      this.powerTargets.set(inverter.id, targetForInverter);

      const telemetry = this.telemetry.get(inverter.id);
      const actualPower = telemetry?.acPowerKW || 0;
      const curtailment = Math.max(0, actualPower - targetForInverter);

      distributions.push({
        inverterId: inverter.id,
        targetPowerKW: targetForInverter,
        actualPowerKW: actualPower,
        curtailmentKW: curtailment
      });
    }

    logger.debug(`Distributed ${targetPowerKW} kW across ${onlineInverters.length} inverters`);
    this.emit('powerDistributed', distributions);

    return distributions;
  }

  /**
   * Set individual inverter power limit
   */
  setInverterPowerLimit(inverterId: string, limitKW: number): void {
    const config = this.inverters.get(inverterId);
    if (!config) {
      throw new Error(`Inverter not found: ${inverterId}`);
    }

    const limitedPower = Math.max(0, Math.min(config.ratedPowerKW, limitKW));
    this.powerTargets.set(inverterId, limitedPower);

    logger.info(`Set power limit for ${inverterId}: ${limitedPower} kW`);
    this.emit('powerLimitSet', { inverterId, limitKW: limitedPower });
  }

  /**
   * Curtail all inverters
   */
  curtailFleet(curtailmentPercent: number): void {
    const factor = 1 - (Math.max(0, Math.min(100, curtailmentPercent)) / 100);

    for (const [id, config] of this.inverters) {
      const newTarget = config.ratedPowerKW * factor;
      this.powerTargets.set(id, newTarget);
    }

    logger.info(`Fleet curtailed to ${(factor * 100).toFixed(1)}%`);
    this.emit('fleetCurtailed', { percent: curtailmentPercent, factor });
  }

  /**
   * Get inverter configuration
   */
  getInverterConfig(inverterId: string): InverterConfig | undefined {
    return this.inverters.get(inverterId);
  }

  /**
   * Get inverter telemetry
   */
  getInverterTelemetry(inverterId: string): InverterTelemetry | undefined {
    return this.telemetry.get(inverterId);
  }

  /**
   * Get all inverter configurations
   */
  getAllInverterConfigs(): InverterConfig[] {
    return Array.from(this.inverters.values());
  }

  /**
   * Get all inverter telemetry
   */
  getAllInverterTelemetry(): InverterTelemetry[] {
    return Array.from(this.telemetry.values());
  }

  /**
   * Get inverters with faults
   */
  getFaultedInverters(): InverterTelemetry[] {
    return Array.from(this.telemetry.values())
      .filter(t => t.status === InverterStatus.FAULT || t.alarms.length > 0);
  }

  /**
   * Clear inverter fault
   */
  clearInverterFault(inverterId: string): void {
    const telemetry = this.telemetry.get(inverterId);
    if (telemetry) {
      telemetry.alarms = [];
      telemetry.warnings = [];
      if (telemetry.status === InverterStatus.FAULT) {
        telemetry.status = InverterStatus.STANDBY;
      }
      logger.info(`Cleared faults for inverter: ${inverterId}`);
      this.emit('faultCleared', inverterId);
    }
  }

  /**
   * Get power targets
   */
  getPowerTargets(): Map<string, number> {
    return new Map(this.powerTargets);
  }
}

// Export singleton
export const inverterFleetService = InverterFleetService.getInstance();
