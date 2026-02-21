/**
 * Curtailment Manager
 * Intelligent curtailment decisions for solar-BESS systems
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export enum CurtailmentReason {
  GRID_LIMIT = 'grid_limit',
  VOLTAGE_HIGH = 'voltage_high',
  FREQUENCY_HIGH = 'frequency_high',
  RAMP_RATE = 'ramp_rate',
  THERMAL = 'thermal',
  GRID_OPERATOR = 'grid_operator',
  ECONOMIC = 'economic',
  MANUAL = 'manual'
}

export enum CurtailmentStrategy {
  PROPORTIONAL = 'proportional',      // Distribute equally
  PRIORITY = 'priority',              // Curtail low priority first
  EFFICIENCY = 'efficiency',          // Curtail least efficient first
  THERMAL = 'thermal',                // Curtail hottest first
  GEOGRAPHIC = 'geographic',          // Based on grid location
  HYBRID = 'hybrid'                   // Combination
}

export interface CurtailmentConfig {
  strategy: CurtailmentStrategy;
  maxRampRateKWMin: number;
  voltageThresholdHigh: number;
  voltageThresholdLow: number;
  frequencyThresholdHigh: number;
  frequencyThresholdLow: number;
  thermalThresholdC: number;
  gridExportLimitKW: number;
  bessAbsorptionPriority: boolean;
  minimumCurtailmentKW: number;
}

export interface CurtailmentEvent {
  id: string;
  timestamp: Date;
  reason: CurtailmentReason;
  requestedCurtailmentKW: number;
  actualCurtailmentKW: number;
  bessAbsorbedKW: number;
  duration: number;
  affectedInverters: string[];
  gridConditions: {
    voltage: number;
    frequency: number;
  };
}

export interface CurtailmentStatus {
  isActive: boolean;
  currentCurtailmentKW: number;
  currentCurtailmentPercent: number;
  bessAbsorptionKW: number;
  reason: CurtailmentReason | null;
  startTime: Date | null;
  estimatedEndTime: Date | null;
}

export interface InverterCurtailment {
  inverterId: string;
  originalPowerKW: number;
  curtailedPowerKW: number;
  curtailmentKW: number;
  curtailmentPercent: number;
  priority: number;
}

// ============================================
// CURTAILMENT MANAGER
// ============================================

export class CurtailmentManager extends EventEmitter {
  private static instance: CurtailmentManager;

  private config: CurtailmentConfig;
  private status: CurtailmentStatus;
  private events: CurtailmentEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  private inverterCurtailments: Map<string, InverterCurtailment> = new Map();
  private inverterPriorities: Map<string, number> = new Map();

  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_PERIOD_MS = 500;

  private constructor() {
    super();

    this.config = {
      strategy: CurtailmentStrategy.HYBRID,
      maxRampRateKWMin: 100,
      voltageThresholdHigh: 1.1,    // 110% of nominal
      voltageThresholdLow: 0.9,     // 90% of nominal
      frequencyThresholdHigh: 60.5, // Hz
      frequencyThresholdLow: 59.5,  // Hz
      thermalThresholdC: 75,
      gridExportLimitKW: 1000,
      bessAbsorptionPriority: true,
      minimumCurtailmentKW: 10
    };

    this.status = {
      isActive: false,
      currentCurtailmentKW: 0,
      currentCurtailmentPercent: 0,
      bessAbsorptionKW: 0,
      reason: null,
      startTime: null,
      estimatedEndTime: null
    };
  }

  static getInstance(): CurtailmentManager {
    if (!CurtailmentManager.instance) {
      CurtailmentManager.instance = new CurtailmentManager();
    }
    return CurtailmentManager.instance;
  }

  /**
   * Start curtailment monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkCurtailmentConditions();
    }, this.CHECK_PERIOD_MS);

    logger.info('Curtailment monitoring started');
  }

  /**
   * Stop curtailment monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Curtailment monitoring stopped');
  }

  /**
   * Check conditions that require curtailment
   */
  private checkCurtailmentConditions(): void {
    // This would integrate with actual measurements
    // For now, emit status updates
    this.emit('statusUpdate', this.status);
  }

  /**
   * Request curtailment
   */
  requestCurtailment(
    amountKW: number,
    reason: CurtailmentReason,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    if (amountKW < this.config.minimumCurtailmentKW) {
      logger.debug(`Curtailment request (${amountKW} kW) below minimum threshold`);
      return [];
    }

    logger.info(`Curtailment requested: ${amountKW} kW (${reason})`);

    // Try BESS absorption first if enabled
    let remainingCurtailment = amountKW;
    let bessAbsorbed = 0;

    if (this.config.bessAbsorptionPriority) {
      // This would integrate with BESS service
      const bessAvailable = this.getBESSAbsorptionCapacity();
      bessAbsorbed = Math.min(remainingCurtailment, bessAvailable);
      remainingCurtailment -= bessAbsorbed;

      if (bessAbsorbed > 0) {
        logger.info(`BESS absorbing ${bessAbsorbed} kW`);
        this.emit('bessAbsorption', { amount: bessAbsorbed });
      }
    }

    // Distribute remaining curtailment to inverters
    const curtailments = this.distributeCurtailment(
      remainingCurtailment,
      inverterData
    );

    // Update status
    this.status.isActive = true;
    this.status.currentCurtailmentKW = amountKW;
    this.status.bessAbsorptionKW = bessAbsorbed;
    this.status.reason = reason;
    this.status.startTime = new Date();

    // Calculate curtailment percent
    const totalPower = Array.from(inverterData.values())
      .reduce((sum, d) => sum + d.powerKW, 0);
    this.status.currentCurtailmentPercent = totalPower > 0
      ? (amountKW / totalPower) * 100
      : 0;

    // Record event
    this.recordEvent({
      id: `evt_${Date.now()}`,
      timestamp: new Date(),
      reason,
      requestedCurtailmentKW: amountKW,
      actualCurtailmentKW: amountKW - bessAbsorbed,
      bessAbsorbedKW: bessAbsorbed,
      duration: 0,
      affectedInverters: curtailments.map(c => c.inverterId),
      gridConditions: {
        voltage: 1.0, // Would be actual measurement
        frequency: 60.0
      }
    });

    this.emit('curtailmentActivated', {
      amount: amountKW,
      reason,
      curtailments
    });

    return curtailments;
  }

  /**
   * Distribute curtailment across inverters based on strategy
   */
  private distributeCurtailment(
    amountKW: number,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    const curtailments: InverterCurtailment[] = [];

    if (amountKW <= 0) return curtailments;

    switch (this.config.strategy) {
      case CurtailmentStrategy.PROPORTIONAL:
        return this.distributeProportional(amountKW, inverterData);

      case CurtailmentStrategy.PRIORITY:
        return this.distributePriority(amountKW, inverterData);

      case CurtailmentStrategy.EFFICIENCY:
        return this.distributeByEfficiency(amountKW, inverterData);

      case CurtailmentStrategy.THERMAL:
        return this.distributeByThermal(amountKW, inverterData);

      case CurtailmentStrategy.HYBRID:
        return this.distributeHybrid(amountKW, inverterData);

      default:
        return this.distributeProportional(amountKW, inverterData);
    }
  }

  /**
   * Proportional distribution
   */
  private distributeProportional(
    amountKW: number,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    const curtailments: InverterCurtailment[] = [];
    const totalPower = Array.from(inverterData.values()).reduce((sum, d) => sum + d.powerKW, 0);

    if (totalPower <= 0) return curtailments;

    for (const [inverterId, data] of inverterData) {
      const proportion = data.powerKW / totalPower;
      const curtailmentForInverter = amountKW * proportion;

      const curtailment: InverterCurtailment = {
        inverterId,
        originalPowerKW: data.powerKW,
        curtailedPowerKW: data.powerKW - curtailmentForInverter,
        curtailmentKW: curtailmentForInverter,
        curtailmentPercent: (curtailmentForInverter / data.powerKW) * 100,
        priority: this.inverterPriorities.get(inverterId) || 50
      };

      curtailments.push(curtailment);
      this.inverterCurtailments.set(inverterId, curtailment);
    }

    return curtailments;
  }

  /**
   * Priority-based distribution (low priority first)
   */
  private distributePriority(
    amountKW: number,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    const curtailments: InverterCurtailment[] = [];

    // Sort by priority (ascending - low priority first)
    const sorted = Array.from(inverterData.entries())
      .map(([id, data]) => ({
        id,
        data,
        priority: this.inverterPriorities.get(id) || 50
      }))
      .sort((a, b) => a.priority - b.priority);

    let remaining = amountKW;

    for (const { id, data, priority } of sorted) {
      if (remaining <= 0) break;

      const curtailmentForInverter = Math.min(remaining, data.powerKW);
      remaining -= curtailmentForInverter;

      const curtailment: InverterCurtailment = {
        inverterId: id,
        originalPowerKW: data.powerKW,
        curtailedPowerKW: data.powerKW - curtailmentForInverter,
        curtailmentKW: curtailmentForInverter,
        curtailmentPercent: (curtailmentForInverter / data.powerKW) * 100,
        priority
      };

      curtailments.push(curtailment);
      this.inverterCurtailments.set(id, curtailment);
    }

    return curtailments;
  }

  /**
   * Efficiency-based distribution (least efficient first)
   */
  private distributeByEfficiency(
    amountKW: number,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    const curtailments: InverterCurtailment[] = [];

    // Sort by efficiency (ascending - least efficient first)
    const sorted = Array.from(inverterData.entries())
      .sort((a, b) => a[1].efficiency - b[1].efficiency);

    let remaining = amountKW;

    for (const [id, data] of sorted) {
      if (remaining <= 0) break;

      const curtailmentForInverter = Math.min(remaining, data.powerKW);
      remaining -= curtailmentForInverter;

      const curtailment: InverterCurtailment = {
        inverterId: id,
        originalPowerKW: data.powerKW,
        curtailedPowerKW: data.powerKW - curtailmentForInverter,
        curtailmentKW: curtailmentForInverter,
        curtailmentPercent: (curtailmentForInverter / data.powerKW) * 100,
        priority: this.inverterPriorities.get(id) || 50
      };

      curtailments.push(curtailment);
      this.inverterCurtailments.set(id, curtailment);
    }

    return curtailments;
  }

  /**
   * Thermal-based distribution (hottest first)
   */
  private distributeByThermal(
    amountKW: number,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    const curtailments: InverterCurtailment[] = [];

    // Sort by temperature (descending - hottest first)
    const sorted = Array.from(inverterData.entries())
      .sort((a, b) => b[1].temperatureC - a[1].temperatureC);

    let remaining = amountKW;

    for (const [id, data] of sorted) {
      if (remaining <= 0) break;

      // More curtailment for inverters above threshold
      const thermalFactor = data.temperatureC > this.config.thermalThresholdC
        ? 1.5
        : 1.0;

      const curtailmentForInverter = Math.min(remaining, data.powerKW * thermalFactor);
      remaining -= curtailmentForInverter;

      const curtailment: InverterCurtailment = {
        inverterId: id,
        originalPowerKW: data.powerKW,
        curtailedPowerKW: Math.max(0, data.powerKW - curtailmentForInverter),
        curtailmentKW: Math.min(curtailmentForInverter, data.powerKW),
        curtailmentPercent: (Math.min(curtailmentForInverter, data.powerKW) / data.powerKW) * 100,
        priority: this.inverterPriorities.get(id) || 50
      };

      curtailments.push(curtailment);
      this.inverterCurtailments.set(id, curtailment);
    }

    return curtailments;
  }

  /**
   * Hybrid distribution (combination of factors)
   */
  private distributeHybrid(
    amountKW: number,
    inverterData: Map<string, { powerKW: number; temperatureC: number; efficiency: number }>
  ): InverterCurtailment[] {
    const curtailments: InverterCurtailment[] = [];

    // Calculate composite score for each inverter
    // Higher score = more likely to be curtailed
    const scores = new Map<string, number>();

    for (const [id, data] of inverterData) {
      const priority = this.inverterPriorities.get(id) || 50;

      // Score factors (0-100 each)
      const priorityScore = 100 - priority; // Low priority = high curtailment score
      const efficiencyScore = 100 - data.efficiency; // Low efficiency = high score
      const thermalScore = Math.min(100, (data.temperatureC / this.config.thermalThresholdC) * 100);

      // Weighted composite
      const compositeScore =
        priorityScore * 0.3 +
        efficiencyScore * 0.3 +
        thermalScore * 0.4;

      scores.set(id, compositeScore);
    }

    // Sort by composite score (descending)
    const sorted = Array.from(inverterData.entries())
      .sort((a, b) => (scores.get(b[0]) || 0) - (scores.get(a[0]) || 0));

    let remaining = amountKW;

    for (const [id, data] of sorted) {
      if (remaining <= 0) break;

      const score = scores.get(id) || 50;
      // Higher score = larger share of curtailment
      const shareMultiplier = 0.5 + (score / 100);
      const baseCurtailment = remaining / sorted.length;
      const curtailmentForInverter = Math.min(
        remaining,
        data.powerKW,
        baseCurtailment * shareMultiplier
      );

      remaining -= curtailmentForInverter;

      const curtailment: InverterCurtailment = {
        inverterId: id,
        originalPowerKW: data.powerKW,
        curtailedPowerKW: data.powerKW - curtailmentForInverter,
        curtailmentKW: curtailmentForInverter,
        curtailmentPercent: (curtailmentForInverter / data.powerKW) * 100,
        priority: this.inverterPriorities.get(id) || 50
      };

      curtailments.push(curtailment);
      this.inverterCurtailments.set(id, curtailment);
    }

    return curtailments;
  }

  /**
   * Get BESS absorption capacity
   */
  private getBESSAbsorptionCapacity(): number {
    // Would integrate with BESS service
    // Return available charging capacity
    return 200; // kW placeholder
  }

  /**
   * Release curtailment
   */
  releaseCurtailment(rampRateKWMin?: number): void {
    if (!this.status.isActive) return;

    const rampRate = rampRateKWMin || this.config.maxRampRateKWMin;

    logger.info(`Releasing curtailment with ramp rate: ${rampRate} kW/min`);

    // Update event duration
    if (this.events.length > 0 && this.status.startTime) {
      const lastEvent = this.events[this.events.length - 1];
      lastEvent.duration = (Date.now() - this.status.startTime.getTime()) / 1000;
    }

    this.status.isActive = false;
    this.status.currentCurtailmentKW = 0;
    this.status.currentCurtailmentPercent = 0;
    this.status.bessAbsorptionKW = 0;
    this.status.reason = null;
    this.status.startTime = null;
    this.status.estimatedEndTime = null;

    this.inverterCurtailments.clear();

    this.emit('curtailmentReleased', { rampRate });
  }

  /**
   * Record curtailment event
   */
  private recordEvent(event: CurtailmentEvent): void {
    this.events.push(event);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
  }

  /**
   * Set inverter priority
   */
  setInverterPriority(inverterId: string, priority: number): void {
    const clampedPriority = Math.max(0, Math.min(100, priority));
    this.inverterPriorities.set(inverterId, clampedPriority);
    logger.debug(`Set priority for ${inverterId}: ${clampedPriority}`);
  }

  /**
   * Get curtailment status
   */
  getStatus(): CurtailmentStatus {
    return { ...this.status };
  }

  /**
   * Get curtailment events
   */
  getEvents(limit: number = 100): CurtailmentEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get inverter curtailments
   */
  getInverterCurtailments(): InverterCurtailment[] {
    return Array.from(this.inverterCurtailments.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CurtailmentConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    logger.info('Curtailment configuration updated');
    this.emit('configUpdated', this.config);
  }

  /**
   * Get configuration
   */
  getConfig(): CurtailmentConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalEvents: number;
    totalCurtailmentKWh: number;
    avgDurationSeconds: number;
    byReason: Record<string, number>;
  } {
    let totalKWh = 0;
    let totalDuration = 0;
    const byReason: Record<string, number> = {};

    for (const event of this.events) {
      totalKWh += (event.actualCurtailmentKW * event.duration) / 3600;
      totalDuration += event.duration;
      byReason[event.reason] = (byReason[event.reason] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      totalCurtailmentKWh: totalKWh,
      avgDurationSeconds: this.events.length > 0
        ? totalDuration / this.events.length
        : 0,
      byReason
    };
  }
}

// Export singleton
export const curtailmentManager = CurtailmentManager.getInstance();
