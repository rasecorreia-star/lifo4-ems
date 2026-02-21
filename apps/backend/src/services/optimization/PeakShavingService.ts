/**
 * Peak Shaving Service - Demand management and peak reduction
 * Extracts logic from frontend Optimization.tsx and DemandResponse.tsx
 *
 * Core Algorithm:
 * - Monitor demand forecast vs contracted limit
 * - Discharge battery when demand exceeds trigger threshold
 * - Calculate peak reduction and demand charge savings
 */

import {
  SystemTelemetry,
  SystemConstraints,
  MarketData,
  PeakShavingEvent,
} from '../../../../../packages/shared/src/types/optimization';

export interface PeakShavingConfig {
  enabled: boolean;
  demandLimit: number; // kW - contracted demand limit
  triggerThreshold: number; // % of limit at which to start shaving (e.g., 80%)
  minSOCMargin: number; // % - don't discharge below this + minSOC
  complianceTarget: number; // % - target compliance with demand reduction (e.g., 85%)
  maxReductionCapability: number; // % - max reduction achievable (e.g., 80%)
}

export interface TariffStructure {
  demandChargePerkW: number; // R$/kW/month
  peakHours: { start: number; end: number }; // e.g., 17:00-22:00
  seasonalFactor: number; // 1.0 = normal, 1.5 = dry season premium
}

export class PeakShavingService {
  private config: PeakShavingConfig;
  private constraints: SystemConstraints;
  private tariff: TariffStructure;
  private batteryCapacity: number; // kWh

  constructor(
    config: PeakShavingConfig,
    constraints: SystemConstraints,
    tariff: TariffStructure,
    batteryCapacity: number
  ) {
    this.config = config;
    this.constraints = constraints;
    this.tariff = tariff;
    this.batteryCapacity = batteryCapacity;
  }

  /**
   * Evaluate if peak shaving is needed and beneficial
   */
  public evaluatePeakShavingNeed(
    telemetry: SystemTelemetry,
    marketData: MarketData,
    currentHour: number
  ): PeakShavingEvent | null {
    if (!this.config.enabled) return null;

    // Check if in peak hours
    const inPeakHours = this.isInPeakHours(currentHour);
    if (!inPeakHours) return null;

    // Check if demand exceeds trigger threshold
    const triggerLevel = (this.config.triggerThreshold / 100) * this.config.demandLimit;
    const currentDemand = marketData.demandForecast;

    if (currentDemand <= triggerLevel) return null; // No action needed

    // Calculate excess power
    const excessPower = currentDemand - this.config.demandLimit;
    if (excessPower <= 0) return null;

    // Check SOC margin
    const minUsableSOC =
      this.constraints.minSOC + this.config.minSOCMargin;
    if (telemetry.soc <= minUsableSOC) return null; // Battery too low

    // Calculate available discharge power
    const availableEnergy = telemetry.soc - minUsableSOC;
    const maxAvailablePower = Math.min(
      this.constraints.maxPower,
      (availableEnergy / 100) * this.batteryCapacity * 0.25 // 15 minutes discharge
    );

    // Required power to bring demand to limit
    const requiredPower = Math.min(excessPower, maxAvailablePower);
    if (requiredPower <= 0) return null;

    // Required energy = power × 1 hour (power in kW, energy in kWh)
    const requiredEnergy = requiredPower; // 1 hour duration

    // Check if achievable
    if (requiredEnergy > (availableEnergy / 100) * this.batteryCapacity) {
      return null; // Not enough capacity
    }

    return {
      systemId: '', // Will be set by caller
      demandForecast: currentDemand,
      demandLimit: this.config.demandLimit,
      excessPower: excessPower,
      recommendedAction: 'DISCHARGE',
      requiredEnergy: requiredEnergy,
    };
  }

  /**
   * Calculate demand charge savings from peak shaving
   * Formula: excessPower * demandChargePerkW * seasonalFactor
   */
  public calculateDemandChargeSavings(
    peakReduction: number // kW - amount reduced
  ): number {
    // Each kW of peak reduction saves demand charge for the entire month
    // Typical Brazilian tariff: R$ 20-40/kW for peak period
    return (
      peakReduction *
      this.tariff.demandChargePerkW *
      this.tariff.seasonalFactor *
      1 // Assuming 1 month period
    );
  }

  /**
   * Calculate compliance with demand reduction target
   * Compliance = (targetReduction - achievedReduction) / targetReduction
   */
  public calculateComplianceRate(
    demandForecast: number,
    actualDemand: number
  ): number {
    const targetDemand =
      demandForecast * ((100 - this.config.complianceTarget) / 100);
    const actualReduction = demandForecast - actualDemand;
    const targetReduction = demandForecast - targetDemand;

    if (targetReduction <= 0) return 100; // Already compliant

    const compliance = (actualReduction / targetReduction) * 100;
    return Math.min(100, Math.max(0, compliance));
  }

  /**
   * Estimate battery degradation from peak shaving cycle
   * Degradation depends on Depth of Discharge (DoD)
   * More energy discharged = more wear per cycle
   * Assumes one 1-hour discharge per day during peak season
   */
  public estimateDegradationImpact(
    peakShavingEnergy: number, // kWh per cycle
    daysOfOperation: number // days in peak season (typically 120 days)
  ): number {
    // Typical LiFePO4: ~0.015% capacity loss per cycle (at 100% DoD)
    // Degradation scales with Depth of Discharge
    const normalizedEnergy = peakShavingEnergy / this.batteryCapacity;
    const cyclesPerDay = 1;
    const totalCycles = cyclesPerDay * daysOfOperation;
    const degradationPerCycle = 0.00015 * normalizedEnergy; // Scale with DoD
    return totalCycles * degradationPerCycle;
  }

  /**
   * Calculate ROI of peak shaving investment
   */
  public calculateROI(
    annualDemandChargeSavings: number,
    batteryInvestmentCost: number,
    operatingCosts: number // maintenance, degradation, etc.
  ): {
    paybackPeriodMonths: number;
    annualROI: number;
    totalSavings10Years: number;
  } {
    const netAnnualBenefit = annualDemandChargeSavings - operatingCosts;
    const paybackPeriodMonths = (batteryInvestmentCost / netAnnualBenefit) * 12;
    const annualROI = (netAnnualBenefit / batteryInvestmentCost) * 100;
    const totalSavings10Years = netAnnualBenefit * 10 - batteryInvestmentCost;

    return {
      paybackPeriodMonths: Math.max(0, paybackPeriodMonths),
      annualROI: Math.max(0, annualROI),
      totalSavings10Years: Math.max(0, totalSavings10Years),
    };
  }

  /**
   * Check if current hour is in peak tariff period
   */
  private isInPeakHours(currentHour: number): boolean {
    const start = this.tariff.peakHours.start;
    const end = this.tariff.peakHours.end;

    if (start < end) {
      // Normal case: e.g., 17:00-22:00
      return currentHour >= start && currentHour < end;
    } else {
      // Crossing midnight: e.g., 22:00-06:00
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Get peak shaving efficiency
   * Efficiency depends on number of hours until peak ends
   */
  public getEfficiency(hoursUntilPeakEnd: number): number {
    // More time available = better planning = higher efficiency
    if (hoursUntilPeakEnd > 3) return 0.95;
    if (hoursUntilPeakEnd > 1) return 0.90;
    return 0.80; // Emergency shaving less efficient
  }

  /**
   * Estimate annual peak shaving benefit
   * Assumes 120 peak days/year in Brazil dry season
   */
  public estimateAnnualBenefit(
    peakReductionCapabilityKW: number,
    peakDaysPerYear: number = 120
  ): number {
    const dailyBenefit = this.calculateDemandChargeSavings(
      peakReductionCapabilityKW
    );
    return dailyBenefit * peakDaysPerYear;
  }
}
