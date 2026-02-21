/**
 * AI-Driven Energy Optimization Service
 * Handles arbitrage, peak shaving, value stacking, and intelligent dispatch
 */

import { getFirestore, Collections } from '../../config/firebase.js';
import { logger } from '../../utils/logger.js';
import { TelemetryData, TariffProfile, TariffPeriod, BessSystem } from '../../models/types.js';

// ============================================
// TYPES
// ============================================

export interface OptimizationConfig {
  systemId: string;
  strategy: OptimizationStrategy;
  constraints: OptimizationConstraints;
  objectives: OptimizationObjective[];
  forecastHorizon: number; // hours
  updateInterval: number; // minutes
}

export enum OptimizationStrategy {
  ARBITRAGE = 'arbitrage',
  PEAK_SHAVING = 'peak_shaving',
  VALUE_STACKING = 'value_stacking',
  LOAD_LEVELING = 'load_leveling',
  FREQUENCY_RESPONSE = 'frequency_response',
  SELF_CONSUMPTION = 'self_consumption',
  BACKUP_POWER = 'backup_power',
}

export interface OptimizationConstraints {
  minSoc: number; // Minimum SOC to maintain (%)
  maxSoc: number; // Maximum SOC (%)
  maxCyclesToday: number; // Limit daily cycles for battery health
  reserveCapacity: number; // % reserved for backup
  maxChargeRate: number; // C-rate
  maxDischargeRate: number; // C-rate
  gridExportLimit?: number; // kW limit for grid export
  gridImportLimit?: number; // kW limit for grid import
}

export interface OptimizationObjective {
  type: 'cost' | 'carbon' | 'self_consumption' | 'peak_reduction' | 'revenue';
  weight: number; // 0-1, total should sum to 1
}

export interface DispatchSchedule {
  id: string;
  systemId: string;
  generatedAt: Date;
  validUntil: Date;
  intervals: DispatchInterval[];
  expectedSavings: number;
  expectedRevenue: number;
  confidence: number;
}

export interface DispatchInterval {
  startTime: Date;
  endTime: Date;
  action: 'charge' | 'discharge' | 'idle' | 'grid_support';
  targetPower: number; // kW (positive = discharge, negative = charge)
  targetSoc?: number;
  reason: string;
  priority: number;
}

export interface PriceForecast {
  timestamp: Date;
  price: number;
  confidence: number;
  source: 'tariff' | 'market' | 'forecast';
}

export interface LoadForecast {
  timestamp: Date;
  load: number; // kW
  confidence: number;
}

export interface SolarForecast {
  timestamp: Date;
  generation: number; // kW
  confidence: number;
}

export interface GridSignal {
  timestamp: Date;
  type: 'frequency' | 'voltage' | 'demand_response' | 'ancillary';
  value: number;
  action?: 'charge' | 'discharge' | 'standby';
  duration?: number; // seconds
  compensation?: number; // R$/kWh
}

// ============================================
// OPTIMIZATION ENGINE
// ============================================

export class EnergyOptimizerService {
  private db = getFirestore();
  private activeOptimizations: Map<string, NodeJS.Timeout> = new Map();
  private dispatchSchedules: Map<string, DispatchSchedule> = new Map();

  /**
   * Start optimization for a system
   */
  async startOptimization(config: OptimizationConfig): Promise<void> {
    const { systemId, updateInterval } = config;

    // Stop existing optimization if running
    this.stopOptimization(systemId);

    // Store config
    await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
      optimizationConfig: config,
      optimizationStatus: 'active',
    });

    // Run initial optimization
    await this.runOptimization(config);

    // Schedule periodic updates
    const interval = setInterval(
      () => this.runOptimization(config),
      updateInterval * 60 * 1000
    );

    this.activeOptimizations.set(systemId, interval);

    logger.info(`Optimization started for system ${systemId}`, {
      strategy: config.strategy,
      updateInterval,
    });
  }

  /**
   * Stop optimization for a system
   */
  stopOptimization(systemId: string): void {
    const interval = this.activeOptimizations.get(systemId);
    if (interval) {
      clearInterval(interval);
      this.activeOptimizations.delete(systemId);
    }
    this.dispatchSchedules.delete(systemId);

    logger.info(`Optimization stopped for system ${systemId}`);
  }

  /**
   * Run optimization and generate dispatch schedule
   */
  private async runOptimization(config: OptimizationConfig): Promise<DispatchSchedule> {
    const { systemId, strategy, constraints, forecastHorizon } = config;

    try {
      // Gather inputs
      const [system, telemetry, tariff, loadForecast, solarForecast, gridSignals] = await Promise.all([
        this.getSystem(systemId),
        this.getCurrentTelemetry(systemId),
        this.getTariffProfile(systemId),
        this.getLoadForecast(systemId, forecastHorizon),
        this.getSolarForecast(systemId, forecastHorizon),
        this.getGridSignals(systemId),
      ]);

      if (!system || !telemetry) {
        throw new Error('System or telemetry not available');
      }

      // Generate price forecast
      const priceForecast = this.generatePriceForecast(tariff, forecastHorizon);

      // Run strategy-specific optimization
      let schedule: DispatchSchedule;

      switch (strategy) {
        case OptimizationStrategy.ARBITRAGE:
          schedule = await this.optimizeArbitrage(
            system, telemetry, priceForecast, constraints, forecastHorizon
          );
          break;

        case OptimizationStrategy.PEAK_SHAVING:
          schedule = await this.optimizePeakShaving(
            system, telemetry, loadForecast, constraints, forecastHorizon
          );
          break;

        case OptimizationStrategy.VALUE_STACKING:
          schedule = await this.optimizeValueStacking(
            system, telemetry, priceForecast, loadForecast, solarForecast, gridSignals, constraints, forecastHorizon
          );
          break;

        case OptimizationStrategy.LOAD_LEVELING:
          schedule = await this.optimizeLoadLeveling(
            system, telemetry, loadForecast, constraints, forecastHorizon
          );
          break;

        case OptimizationStrategy.FREQUENCY_RESPONSE:
          schedule = await this.optimizeFrequencyResponse(
            system, telemetry, gridSignals, constraints
          );
          break;

        case OptimizationStrategy.SELF_CONSUMPTION:
          schedule = await this.optimizeSelfConsumption(
            system, telemetry, solarForecast, loadForecast, constraints, forecastHorizon
          );
          break;

        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }

      // Store schedule
      this.dispatchSchedules.set(systemId, schedule);
      await this.storeDispatchSchedule(schedule);

      logger.info(`Optimization completed for system ${systemId}`, {
        strategy,
        intervals: schedule.intervals.length,
        expectedSavings: schedule.expectedSavings,
      });

      return schedule;

    } catch (error) {
      logger.error(`Optimization failed for system ${systemId}`, { error });
      throw error;
    }
  }

  /**
   * ARBITRAGE OPTIMIZATION
   * Buy low, sell high based on time-of-use tariffs or market prices
   */
  private async optimizeArbitrage(
    system: BessSystem,
    telemetry: TelemetryData,
    priceForecast: PriceForecast[],
    constraints: OptimizationConstraints,
    horizonHours: number
  ): Promise<DispatchSchedule> {
    const intervals: DispatchInterval[] = [];
    const now = new Date();
    const batteryCapacity = system.batterySpec.energyCapacity;
    const maxChargeRate = constraints.maxChargeRate * batteryCapacity;
    const maxDischargeRate = constraints.maxDischargeRate * batteryCapacity;

    // Find price differentials
    const sortedPrices = [...priceForecast].sort((a, b) => a.price - b.price);
    const lowPriceThreshold = sortedPrices[Math.floor(sortedPrices.length * 0.25)]?.price || 0;
    const highPriceThreshold = sortedPrices[Math.floor(sortedPrices.length * 0.75)]?.price || 0;

    let currentSoc = telemetry.soc;
    let totalSavings = 0;
    let totalRevenue = 0;

    // Generate hourly intervals
    for (let h = 0; h < horizonHours; h++) {
      const intervalStart = new Date(now.getTime() + h * 3600000);
      const intervalEnd = new Date(intervalStart.getTime() + 3600000);

      const priceDatum = priceForecast.find(p =>
        p.timestamp.getTime() >= intervalStart.getTime() &&
        p.timestamp.getTime() < intervalEnd.getTime()
      );

      const currentPrice = priceDatum?.price || 0;

      let action: 'charge' | 'discharge' | 'idle' = 'idle';
      let targetPower = 0;
      let reason = '';

      // Low price period - charge
      if (currentPrice <= lowPriceThreshold && currentSoc < constraints.maxSoc) {
        action = 'charge';
        const socGap = constraints.maxSoc - currentSoc;
        const energyNeeded = (socGap / 100) * batteryCapacity;
        targetPower = -Math.min(maxChargeRate, energyNeeded);
        currentSoc = Math.min(constraints.maxSoc, currentSoc + (Math.abs(targetPower) / batteryCapacity) * 100);
        reason = `Charging during low price period (R$${currentPrice.toFixed(2)}/kWh)`;
      }
      // High price period - discharge
      else if (currentPrice >= highPriceThreshold && currentSoc > constraints.minSoc + constraints.reserveCapacity) {
        action = 'discharge';
        const availableSoc = currentSoc - constraints.minSoc - constraints.reserveCapacity;
        const energyAvailable = (availableSoc / 100) * batteryCapacity;
        targetPower = Math.min(maxDischargeRate, energyAvailable);
        const energyDischarged = targetPower;
        currentSoc = Math.max(constraints.minSoc + constraints.reserveCapacity, currentSoc - (energyDischarged / batteryCapacity) * 100);
        totalRevenue += energyDischarged * currentPrice;
        reason = `Discharging during high price period (R$${currentPrice.toFixed(2)}/kWh)`;
      }
      // Idle
      else {
        reason = `Idle - price within normal range (R$${currentPrice.toFixed(2)}/kWh)`;
      }

      intervals.push({
        startTime: intervalStart,
        endTime: intervalEnd,
        action,
        targetPower,
        targetSoc: currentSoc,
        reason,
        priority: action === 'discharge' ? 1 : action === 'charge' ? 2 : 3,
      });
    }

    // Calculate savings (compared to no storage)
    const priceSpread = highPriceThreshold - lowPriceThreshold;
    totalSavings = totalRevenue * (priceSpread / highPriceThreshold);

    return {
      id: `arb_${system.id}_${Date.now()}`,
      systemId: system.id,
      generatedAt: now,
      validUntil: new Date(now.getTime() + horizonHours * 3600000),
      intervals,
      expectedSavings: totalSavings,
      expectedRevenue: totalRevenue,
      confidence: 0.85,
    };
  }

  /**
   * PEAK SHAVING OPTIMIZATION
   * Reduce demand peaks to lower demand charges
   */
  private async optimizePeakShaving(
    system: BessSystem,
    telemetry: TelemetryData,
    loadForecast: LoadForecast[],
    constraints: OptimizationConstraints,
    horizonHours: number
  ): Promise<DispatchSchedule> {
    const intervals: DispatchInterval[] = [];
    const now = new Date();
    const batteryCapacity = system.batterySpec.energyCapacity;
    const maxDischargeRate = constraints.maxDischargeRate * batteryCapacity;

    // Calculate peak threshold (target to shave above)
    const loads = loadForecast.map(l => l.load);
    const averageLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    const peakLoad = Math.max(...loads);
    const peakThreshold = averageLoad + (peakLoad - averageLoad) * 0.5; // Shave top 50% of peak

    let currentSoc = telemetry.soc;
    let peakReduction = 0;

    for (let h = 0; h < horizonHours; h++) {
      const intervalStart = new Date(now.getTime() + h * 3600000);
      const intervalEnd = new Date(intervalStart.getTime() + 3600000);

      const loadDatum = loadForecast.find(l =>
        l.timestamp.getTime() >= intervalStart.getTime() &&
        l.timestamp.getTime() < intervalEnd.getTime()
      );

      const currentLoad = loadDatum?.load || averageLoad;

      let action: 'charge' | 'discharge' | 'idle' = 'idle';
      let targetPower = 0;
      let reason = '';

      // Peak period - discharge to shave
      if (currentLoad > peakThreshold && currentSoc > constraints.minSoc + constraints.reserveCapacity) {
        const excessLoad = currentLoad - peakThreshold;
        const availableSoc = currentSoc - constraints.minSoc - constraints.reserveCapacity;
        const availableEnergy = (availableSoc / 100) * batteryCapacity;

        action = 'discharge';
        targetPower = Math.min(maxDischargeRate, excessLoad, availableEnergy);
        currentSoc -= (targetPower / batteryCapacity) * 100;
        peakReduction = Math.max(peakReduction, excessLoad - targetPower);
        reason = `Peak shaving: reducing ${currentLoad.toFixed(1)}kW to ${(currentLoad - targetPower).toFixed(1)}kW`;
      }
      // Low load period - recharge
      else if (currentLoad < averageLoad * 0.7 && currentSoc < constraints.maxSoc) {
        const chargeRate = constraints.maxChargeRate * batteryCapacity;
        const socGap = constraints.maxSoc - currentSoc;
        const energyNeeded = (socGap / 100) * batteryCapacity;

        action = 'charge';
        targetPower = -Math.min(chargeRate, energyNeeded);
        currentSoc += (Math.abs(targetPower) / batteryCapacity) * 100;
        reason = `Recharging during low demand (${currentLoad.toFixed(1)}kW)`;
      }
      // Normal period
      else {
        reason = `Standby - load within normal range (${currentLoad.toFixed(1)}kW)`;
      }

      intervals.push({
        startTime: intervalStart,
        endTime: intervalEnd,
        action,
        targetPower,
        targetSoc: currentSoc,
        reason,
        priority: action === 'discharge' ? 1 : action === 'charge' ? 3 : 2,
      });
    }

    // Estimate savings from demand charge reduction
    const demandChargeSavings = peakReduction * 30; // Assuming R$30/kW demand charge

    return {
      id: `peak_${system.id}_${Date.now()}`,
      systemId: system.id,
      generatedAt: now,
      validUntil: new Date(now.getTime() + horizonHours * 3600000),
      intervals,
      expectedSavings: demandChargeSavings,
      expectedRevenue: 0,
      confidence: 0.9,
    };
  }

  /**
   * VALUE STACKING OPTIMIZATION
   * Combine multiple revenue streams for maximum value
   */
  private async optimizeValueStacking(
    system: BessSystem,
    telemetry: TelemetryData,
    priceForecast: PriceForecast[],
    loadForecast: LoadForecast[],
    solarForecast: SolarForecast[],
    gridSignals: GridSignal[],
    constraints: OptimizationConstraints,
    horizonHours: number
  ): Promise<DispatchSchedule> {
    const intervals: DispatchInterval[] = [];
    const now = new Date();
    const batteryCapacity = system.batterySpec.energyCapacity;
    const maxChargeRate = constraints.maxChargeRate * batteryCapacity;
    const maxDischargeRate = constraints.maxDischargeRate * batteryCapacity;

    let currentSoc = telemetry.soc;
    let totalSavings = 0;
    let totalRevenue = 0;

    // Calculate optimal dispatch for each interval considering all value streams
    for (let h = 0; h < horizonHours; h++) {
      const intervalStart = new Date(now.getTime() + h * 3600000);
      const intervalEnd = new Date(intervalStart.getTime() + 3600000);

      // Get all forecasts for this interval
      const price = priceForecast.find(p => p.timestamp.getTime() >= intervalStart.getTime())?.price || 0;
      const load = loadForecast.find(l => l.timestamp.getTime() >= intervalStart.getTime())?.load || 0;
      const solar = solarForecast.find(s => s.timestamp.getTime() >= intervalStart.getTime())?.generation || 0;
      const gridSignal = gridSignals.find(g =>
        g.timestamp.getTime() >= intervalStart.getTime() &&
        g.timestamp.getTime() < intervalEnd.getTime()
      );

      // Calculate net load (load - solar)
      const netLoad = Math.max(0, load - solar);
      const excessSolar = Math.max(0, solar - load);

      // Value scores for each action
      const scores = {
        charge: 0,
        discharge: 0,
        idle: 0,
        gridSupport: 0,
      };

      // Score for charging
      if (currentSoc < constraints.maxSoc) {
        // Value from low price
        const priceScore = (1 - price / 2) * 30; // Higher score for lower prices
        // Value from capturing excess solar
        const solarScore = excessSolar > 0 ? 50 : 0;
        scores.charge = priceScore + solarScore;
      }

      // Score for discharging
      if (currentSoc > constraints.minSoc + constraints.reserveCapacity) {
        // Value from high price
        const priceScore = (price / 2) * 30;
        // Value from peak shaving
        const peakScore = netLoad > load * 0.8 ? 40 : 0;
        // Value from self-consumption
        const selfConsumptionScore = netLoad > 0 ? 20 : 0;
        scores.discharge = priceScore + peakScore + selfConsumptionScore;
      }

      // Score for grid support (frequency response, etc.)
      if (gridSignal && gridSignal.compensation) {
        scores.gridSupport = gridSignal.compensation * 100;
      }

      // Default idle score
      scores.idle = 10;

      // Select best action
      const bestAction = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
      let action: 'charge' | 'discharge' | 'idle' | 'grid_support' = bestAction[0] as any;
      let targetPower = 0;
      let reason = '';

      switch (action) {
        case 'charge':
          const chargeEnergy = Math.min(
            maxChargeRate,
            (constraints.maxSoc - currentSoc) / 100 * batteryCapacity,
            excessSolar > 0 ? excessSolar : maxChargeRate
          );
          targetPower = -chargeEnergy;
          currentSoc += (chargeEnergy / batteryCapacity) * 100;
          reason = excessSolar > 0
            ? `Storing excess solar (${excessSolar.toFixed(1)}kW)`
            : `Charging during low price (R$${price.toFixed(2)}/kWh)`;
          break;

        case 'discharge':
          const dischargeEnergy = Math.min(
            maxDischargeRate,
            (currentSoc - constraints.minSoc - constraints.reserveCapacity) / 100 * batteryCapacity,
            netLoad
          );
          targetPower = dischargeEnergy;
          currentSoc -= (dischargeEnergy / batteryCapacity) * 100;
          totalRevenue += dischargeEnergy * price;
          reason = `Discharging for self-consumption/arbitrage (${dischargeEnergy.toFixed(1)}kW)`;
          break;

        case 'grid_support':
          if (gridSignal) {
            if (gridSignal.action === 'discharge') {
              targetPower = Math.min(maxDischargeRate, (currentSoc - constraints.minSoc) / 100 * batteryCapacity);
              currentSoc -= (targetPower / batteryCapacity) * 100;
            } else if (gridSignal.action === 'charge') {
              targetPower = -Math.min(maxChargeRate, (constraints.maxSoc - currentSoc) / 100 * batteryCapacity);
              currentSoc += (Math.abs(targetPower) / batteryCapacity) * 100;
            }
            totalRevenue += Math.abs(targetPower) * (gridSignal.compensation || 0);
            action = 'grid_support';
            reason = `Grid support: ${gridSignal.type} (compensation: R$${gridSignal.compensation}/kWh)`;
          }
          break;

        default:
          reason = 'Standby - no profitable action available';
      }

      intervals.push({
        startTime: intervalStart,
        endTime: intervalEnd,
        action: action as any,
        targetPower,
        targetSoc: currentSoc,
        reason,
        priority: scores[action as keyof typeof scores] > 50 ? 1 : scores[action as keyof typeof scores] > 30 ? 2 : 3,
      });
    }

    return {
      id: `stack_${system.id}_${Date.now()}`,
      systemId: system.id,
      generatedAt: now,
      validUntil: new Date(now.getTime() + horizonHours * 3600000),
      intervals,
      expectedSavings: totalSavings,
      expectedRevenue: totalRevenue,
      confidence: 0.75,
    };
  }

  /**
   * LOAD LEVELING OPTIMIZATION
   * Smooth out load variations
   */
  private async optimizeLoadLeveling(
    system: BessSystem,
    telemetry: TelemetryData,
    loadForecast: LoadForecast[],
    constraints: OptimizationConstraints,
    horizonHours: number
  ): Promise<DispatchSchedule> {
    const intervals: DispatchInterval[] = [];
    const now = new Date();
    const batteryCapacity = system.batterySpec.energyCapacity;

    const loads = loadForecast.map(l => l.load);
    const targetLoad = loads.reduce((a, b) => a + b, 0) / loads.length;

    let currentSoc = telemetry.soc;

    for (let h = 0; h < horizonHours; h++) {
      const intervalStart = new Date(now.getTime() + h * 3600000);
      const intervalEnd = new Date(intervalStart.getTime() + 3600000);

      const loadDatum = loadForecast.find(l =>
        l.timestamp.getTime() >= intervalStart.getTime() &&
        l.timestamp.getTime() < intervalEnd.getTime()
      );

      const currentLoad = loadDatum?.load || targetLoad;
      const loadDeviation = currentLoad - targetLoad;

      let action: 'charge' | 'discharge' | 'idle' = 'idle';
      let targetPower = 0;
      let reason = '';

      // Load above target - discharge to compensate
      if (loadDeviation > targetLoad * 0.1 && currentSoc > constraints.minSoc + constraints.reserveCapacity) {
        action = 'discharge';
        const maxDischarge = constraints.maxDischargeRate * batteryCapacity;
        const availableEnergy = (currentSoc - constraints.minSoc - constraints.reserveCapacity) / 100 * batteryCapacity;
        targetPower = Math.min(loadDeviation, maxDischarge, availableEnergy);
        currentSoc -= (targetPower / batteryCapacity) * 100;
        reason = `Load leveling: reducing peak (${currentLoad.toFixed(1)}kW -> ${(currentLoad - targetPower).toFixed(1)}kW)`;
      }
      // Load below target - charge
      else if (loadDeviation < -targetLoad * 0.1 && currentSoc < constraints.maxSoc) {
        action = 'charge';
        const maxCharge = constraints.maxChargeRate * batteryCapacity;
        const chargeNeeded = (constraints.maxSoc - currentSoc) / 100 * batteryCapacity;
        targetPower = -Math.min(Math.abs(loadDeviation), maxCharge, chargeNeeded);
        currentSoc += (Math.abs(targetPower) / batteryCapacity) * 100;
        reason = `Load leveling: filling valley (${currentLoad.toFixed(1)}kW -> ${(currentLoad - targetPower).toFixed(1)}kW)`;
      }
      else {
        reason = `Load within target range (${currentLoad.toFixed(1)}kW, target: ${targetLoad.toFixed(1)}kW)`;
      }

      intervals.push({
        startTime: intervalStart,
        endTime: intervalEnd,
        action,
        targetPower,
        targetSoc: currentSoc,
        reason,
        priority: Math.abs(loadDeviation) > targetLoad * 0.2 ? 1 : 2,
      });
    }

    // Calculate load factor improvement
    const beforeLoadFactor = loads.reduce((a, b) => a + b, 0) / (Math.max(...loads) * loads.length);
    const improvedLoadFactor = 0.85; // Target
    const savings = (improvedLoadFactor - beforeLoadFactor) * batteryCapacity * 100;

    return {
      id: `level_${system.id}_${Date.now()}`,
      systemId: system.id,
      generatedAt: now,
      validUntil: new Date(now.getTime() + horizonHours * 3600000),
      intervals,
      expectedSavings: savings,
      expectedRevenue: 0,
      confidence: 0.85,
    };
  }

  /**
   * FREQUENCY RESPONSE OPTIMIZATION
   * Fast response to grid frequency deviations
   */
  private async optimizeFrequencyResponse(
    system: BessSystem,
    telemetry: TelemetryData,
    gridSignals: GridSignal[],
    constraints: OptimizationConstraints
  ): Promise<DispatchSchedule> {
    const intervals: DispatchInterval[] = [];
    const now = new Date();
    const batteryCapacity = system.batterySpec.energyCapacity;

    // Frequency response requires fast dispatch capability
    // Generate real-time response intervals
    const frequencySignals = gridSignals.filter(g => g.type === 'frequency');

    let currentSoc = telemetry.soc;
    let totalRevenue = 0;

    for (const signal of frequencySignals) {
      let action: 'charge' | 'discharge' | 'idle' = 'idle';
      let targetPower = 0;
      let reason = '';

      // Under-frequency event (grid needs power) - discharge
      if (signal.value < 59.95 && currentSoc > constraints.minSoc + constraints.reserveCapacity) {
        const severity = (60 - signal.value) / 0.5; // Normalized severity
        const maxDischarge = constraints.maxDischargeRate * batteryCapacity;
        action = 'discharge';
        targetPower = Math.min(maxDischarge * severity, (currentSoc - constraints.minSoc) / 100 * batteryCapacity);
        currentSoc -= (targetPower / batteryCapacity) * 100;
        totalRevenue += targetPower * (signal.compensation || 0.5) * (signal.duration || 1) / 3600;
        reason = `Frequency response: under-frequency (${signal.value}Hz), injecting ${targetPower.toFixed(1)}kW`;
      }
      // Over-frequency event (grid has excess) - charge
      else if (signal.value > 60.05 && currentSoc < constraints.maxSoc) {
        const severity = (signal.value - 60) / 0.5;
        const maxCharge = constraints.maxChargeRate * batteryCapacity;
        action = 'charge';
        targetPower = -Math.min(maxCharge * severity, (constraints.maxSoc - currentSoc) / 100 * batteryCapacity);
        currentSoc += (Math.abs(targetPower) / batteryCapacity) * 100;
        totalRevenue += Math.abs(targetPower) * (signal.compensation || 0.3) * (signal.duration || 1) / 3600;
        reason = `Frequency response: over-frequency (${signal.value}Hz), absorbing ${Math.abs(targetPower).toFixed(1)}kW`;
      }

      if (action !== 'idle') {
        intervals.push({
          startTime: signal.timestamp,
          endTime: new Date(signal.timestamp.getTime() + (signal.duration || 1) * 1000),
          action,
          targetPower,
          targetSoc: currentSoc,
          reason,
          priority: 0, // Highest priority for grid stability
        });
      }
    }

    // If no signals, create standby interval
    if (intervals.length === 0) {
      intervals.push({
        startTime: now,
        endTime: new Date(now.getTime() + 3600000),
        action: 'idle',
        targetPower: 0,
        targetSoc: currentSoc,
        reason: 'Standby for frequency response - ready to deploy within 1 second',
        priority: 1,
      });
    }

    return {
      id: `freq_${system.id}_${Date.now()}`,
      systemId: system.id,
      generatedAt: now,
      validUntil: new Date(now.getTime() + 3600000),
      intervals,
      expectedSavings: 0,
      expectedRevenue: totalRevenue,
      confidence: 0.95, // High confidence for frequency response
    };
  }

  /**
   * SELF-CONSUMPTION OPTIMIZATION
   * Maximize use of self-generated solar
   */
  private async optimizeSelfConsumption(
    system: BessSystem,
    telemetry: TelemetryData,
    solarForecast: SolarForecast[],
    loadForecast: LoadForecast[],
    constraints: OptimizationConstraints,
    horizonHours: number
  ): Promise<DispatchSchedule> {
    const intervals: DispatchInterval[] = [];
    const now = new Date();
    const batteryCapacity = system.batterySpec.energyCapacity;

    let currentSoc = telemetry.soc;
    let totalSavings = 0;

    for (let h = 0; h < horizonHours; h++) {
      const intervalStart = new Date(now.getTime() + h * 3600000);
      const intervalEnd = new Date(intervalStart.getTime() + 3600000);

      const solar = solarForecast.find(s =>
        s.timestamp.getTime() >= intervalStart.getTime() &&
        s.timestamp.getTime() < intervalEnd.getTime()
      )?.generation || 0;

      const load = loadForecast.find(l =>
        l.timestamp.getTime() >= intervalStart.getTime() &&
        l.timestamp.getTime() < intervalEnd.getTime()
      )?.load || 0;

      const excessSolar = solar - load;
      const deficit = load - solar;

      let action: 'charge' | 'discharge' | 'idle' = 'idle';
      let targetPower = 0;
      let reason = '';

      // Excess solar - store it
      if (excessSolar > 0 && currentSoc < constraints.maxSoc) {
        action = 'charge';
        const maxCharge = constraints.maxChargeRate * batteryCapacity;
        const chargeNeeded = (constraints.maxSoc - currentSoc) / 100 * batteryCapacity;
        targetPower = -Math.min(excessSolar, maxCharge, chargeNeeded);
        currentSoc += (Math.abs(targetPower) / batteryCapacity) * 100;
        totalSavings += Math.abs(targetPower) * 0.8; // Assumed grid export rate
        reason = `Storing excess solar: ${excessSolar.toFixed(1)}kW excess, charging ${Math.abs(targetPower).toFixed(1)}kW`;
      }
      // Deficit - use stored energy
      else if (deficit > 0 && currentSoc > constraints.minSoc + constraints.reserveCapacity) {
        action = 'discharge';
        const maxDischarge = constraints.maxDischargeRate * batteryCapacity;
        const availableEnergy = (currentSoc - constraints.minSoc - constraints.reserveCapacity) / 100 * batteryCapacity;
        targetPower = Math.min(deficit, maxDischarge, availableEnergy);
        currentSoc -= (targetPower / batteryCapacity) * 100;
        totalSavings += targetPower * 1.2; // Assumed grid import rate avoided
        reason = `Self-consumption: ${deficit.toFixed(1)}kW deficit, discharging ${targetPower.toFixed(1)}kW`;
      }
      else {
        reason = solar > 0
          ? `Solar covering load (${solar.toFixed(1)}kW solar, ${load.toFixed(1)}kW load)`
          : `No solar, minimal load (${load.toFixed(1)}kW)`;
      }

      intervals.push({
        startTime: intervalStart,
        endTime: intervalEnd,
        action,
        targetPower,
        targetSoc: currentSoc,
        reason,
        priority: action !== 'idle' ? 1 : 3,
      });
    }

    return {
      id: `self_${system.id}_${Date.now()}`,
      systemId: system.id,
      generatedAt: now,
      validUntil: new Date(now.getTime() + horizonHours * 3600000),
      intervals,
      expectedSavings: totalSavings,
      expectedRevenue: 0,
      confidence: 0.9,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getSystem(systemId: string): Promise<BessSystem | null> {
    const doc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as BessSystem;
  }

  private async getCurrentTelemetry(systemId: string): Promise<TelemetryData | null> {
    const doc = await this.db.collection(Collections.TELEMETRY).doc(systemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as TelemetryData;
  }

  private async getTariffProfile(systemId: string): Promise<TariffProfile | null> {
    const systemDoc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
    const orgId = systemDoc.data()?.organizationId;
    if (!orgId) return null;

    const orgDoc = await this.db.collection(Collections.ORGANIZATIONS).doc(orgId).get();
    return orgDoc.data()?.settings?.tariffProfile || null;
  }

  private generatePriceForecast(tariff: TariffProfile | null, horizonHours: number): PriceForecast[] {
    const forecasts: PriceForecast[] = [];
    const now = new Date();

    for (let h = 0; h < horizonHours; h++) {
      const timestamp = new Date(now.getTime() + h * 3600000);
      const hour = timestamp.getHours();
      const dayOfWeek = timestamp.getDay();

      let price = 0.5; // Default R$/kWh

      if (tariff) {
        const period = tariff.periods.find(p => {
          const [startHour] = p.startTime.split(':').map(Number);
          const [endHour] = p.endTime.split(':').map(Number);
          return hour >= startHour && hour < endHour && p.daysOfWeek.includes(dayOfWeek);
        });

        price = period?.rate || 0.5;
      }

      forecasts.push({
        timestamp,
        price,
        confidence: 0.95,
        source: tariff ? 'tariff' : 'forecast',
      });
    }

    return forecasts;
  }

  private async getLoadForecast(systemId: string, horizonHours: number): Promise<LoadForecast[]> {
    // In production, this would use ML models based on historical data
    // For now, generate synthetic forecast based on typical patterns
    const forecasts: LoadForecast[] = [];
    const now = new Date();

    for (let h = 0; h < horizonHours; h++) {
      const timestamp = new Date(now.getTime() + h * 3600000);
      const hour = timestamp.getHours();

      // Typical load profile
      let baseLoad = 50; // kW base load
      if (hour >= 6 && hour <= 9) baseLoad = 80; // Morning peak
      if (hour >= 11 && hour <= 14) baseLoad = 100; // Midday peak
      if (hour >= 18 && hour <= 21) baseLoad = 120; // Evening peak
      if (hour >= 23 || hour <= 5) baseLoad = 30; // Night valley

      // Add some variance
      const variance = (Math.random() - 0.5) * 20;

      forecasts.push({
        timestamp,
        load: baseLoad + variance,
        confidence: 0.8,
      });
    }

    return forecasts;
  }

  private async getSolarForecast(systemId: string, horizonHours: number): Promise<SolarForecast[]> {
    // In production, would use weather APIs and ML models
    const forecasts: SolarForecast[] = [];
    const now = new Date();

    for (let h = 0; h < horizonHours; h++) {
      const timestamp = new Date(now.getTime() + h * 3600000);
      const hour = timestamp.getHours();

      // Typical solar profile
      let generation = 0;
      if (hour >= 6 && hour <= 18) {
        // Bell curve peaking at noon
        const solarHour = hour - 12;
        generation = Math.max(0, 100 * Math.exp(-0.1 * solarHour * solarHour));
      }

      forecasts.push({
        timestamp,
        generation,
        confidence: 0.7,
      });
    }

    return forecasts;
  }

  private async getGridSignals(systemId: string): Promise<GridSignal[]> {
    // In production, would connect to grid operator APIs
    // For now, return empty array (no active signals)
    return [];
  }

  private async storeDispatchSchedule(schedule: DispatchSchedule): Promise<void> {
    await this.db.collection('dispatch_schedules').doc(schedule.id).set({
      ...schedule,
      intervals: schedule.intervals.map(i => ({
        ...i,
        startTime: i.startTime,
        endTime: i.endTime,
      })),
    });
  }

  /**
   * Get current dispatch recommendation
   */
  getDispatchRecommendation(systemId: string): DispatchInterval | null {
    const schedule = this.dispatchSchedules.get(systemId);
    if (!schedule) return null;

    const now = Date.now();
    return schedule.intervals.find(i =>
      i.startTime.getTime() <= now && i.endTime.getTime() > now
    ) || null;
  }

  /**
   * Get full dispatch schedule
   */
  getDispatchSchedule(systemId: string): DispatchSchedule | null {
    return this.dispatchSchedules.get(systemId) || null;
  }
}

export const energyOptimizerService = new EnergyOptimizerService();
