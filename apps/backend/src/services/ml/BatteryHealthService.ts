/**
 * Battery Health Service - SOH monitoring and degradation prediction
 * Extracts logic from frontend BatteryHealth.tsx
 *
 * Tracks:
 * - State of Health (SOH) degradation
 * - Cycle counting and cycle-life prediction
 * - Warranty status and remaining capacity
 * - Thermal degradation impact
 */

export interface BatteryHealthMetrics {
  systemId: string;
  nominalCapacity: number; // kWh
  currentCapacity: number; // kWh
  soh: number; // % (0-100)
  cycleCount: number;
  maxCycles: number;
  warranty: {
    targetSOH: number; // % at warranty end
    endDate: Date;
    status: 'active' | 'expiring_soon' | 'expired';
  };
  degradation: {
    percentPerMonth: number; // ~0.15-0.25% per month for LiFePO4
    estimatedCyclicDegradation: number; // % from cycling
    estimatedCalendarDegradation: number; // % from time
  };
  lifeRemaining: {
    estimatedMonths: number;
    estimatedCycles: number;
    confidence: number; // 0-1
  };
}

export class BatteryHealthService {
  private readonly LFP_DEGRADATION_RATE = 0.002; // 0.2% per month for LiFePO4
  private readonly LFP_CYCLE_DEGRADATION = 0.000015; // 0.0015% per cycle
  private readonly CALENDAR_DEGRADATION_TEMPERATURE_FACTOR = 1.5; // degradation doubles every 10°C

  /**
   * Calculate current SOH based on actual measurements
   * SOH = (Current Capacity / Nominal Capacity) * 100
   */
  public calculateSOH(currentCapacity: number, nominalCapacity: number): number {
    const soh = (currentCapacity / nominalCapacity) * 100;
    return Math.max(0, Math.min(100, soh)); // Clamp 0-100
  }

  /**
   * Estimate degradation from operating hours
   * Account for temperature effects
   */
  public estimateDegradationFromTemperature(
    operatingHoursPerDay: number,
    averageTemperature: number, // °C
    daysOfOperation: number
  ): number {
    // Reference: 25°C has base degradation rate
    const referenceTemp = 25;
    const tempDifference = Math.max(0, averageTemperature - referenceTemp);

    // Degradation doubles every 10°C above 25°C
    const tempFactor = Math.pow(
      this.CALENDAR_DEGRADATION_TEMPERATURE_FACTOR,
      tempDifference / 10
    );

    // Calculate total calendar degradation
    const monthsOfOperation = (daysOfOperation * operatingHoursPerDay) / 24 / 30;
    const calendarDegradation =
      monthsOfOperation * this.LFP_DEGRADATION_RATE * tempFactor;

    return calendarDegradation;
  }

  /**
   * Estimate degradation from charging cycles
   * Formula: cycleCount * CYCLE_DEGRADATION_RATE
   */
  public estimateDegradationFromCycles(cycleCount: number): number {
    // LiFePO4 typical: 0.0015% capacity loss per cycle
    return cycleCount * this.LFP_CYCLE_DEGRADATION;
  }

  /**
   * Calculate realistic SOH based on calendar + cyclic degradation
   */
  public calculateRealisticSOH(
    nominalSOH: number, // Starting SOH (typically 100%)
    cycleCount: number,
    operatingHoursPerDay: number,
    averageTemperature: number,
    daysOfOperation: number
  ): number {
    // Calendar degradation
    const calendarDeg = this.estimateDegradationFromTemperature(
      operatingHoursPerDay,
      averageTemperature,
      daysOfOperation
    );

    // Cyclic degradation
    const cyclicDeg = this.estimateDegradationFromCycles(cycleCount);

    // Combined SOH
    const soh = nominalSOH - (calendarDeg + cyclicDeg) * 100;

    return Math.max(0, Math.min(100, soh));
  }

  /**
   * Check warranty status
   */
  public checkWarrantyStatus(
    currentSOH: number,
    warrantyTargetSOH: number,
    warrantyEndDate: Date
  ): 'active' | 'expiring_soon' | 'expired' {
    const now = new Date();
    const daysToExpiry = Math.floor(
      (warrantyEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Warranty expired if date passed OR SOH below target
    if (daysToExpiry <= 0 || currentSOH < warrantyTargetSOH) {
      return 'expired';
    }

    // Expiring soon if less than 90 days or SOH within 5% of target
    const soHMargin = warrantyTargetSOH - currentSOH;
    if (daysToExpiry < 90 || soHMargin >= -5) {
      return 'expiring_soon';
    }

    return 'active';
  }

  /**
   * Estimate remaining useful life (RUL)
   * Returns months and cycles until SOH reaches end-of-life threshold (80%)
   */
  public estimateRemainingLife(
    currentSOH: number,
    cycleCount: number,
    maxCycles: number,
    monthlyDegradationRate: number, // e.g., 0.002 for 0.2%
    eolThreshold: number = 80 // End of Life at 80% SOH
  ): {
    estimatedMonths: number;
    estimatedCycles: number;
    confidence: number;
  } {
    // Calendar-based RUL: (currentSOH - eolThreshold) / monthlyDegradationRate
    const monthsRemaining = Math.max(
      0,
      (currentSOH - eolThreshold) / monthlyDegradationRate
    );

    // Cycle-based RUL: maxCycles - currentCycleCount
    const cyclesRemaining = Math.max(0, maxCycles - cycleCount);

    // Confidence decreases for long predictions
    const confidence = Math.max(0.5, 1 - monthsRemaining / 240); // 0.5-1.0 confidence

    return {
      estimatedMonths: Math.round(monthsRemaining * 10) / 10,
      estimatedCycles: Math.round(cyclesRemaining),
      confidence: Math.round(confidence * 1000) / 1000,
    };
  }

  /**
   * Get health score (0-100) for UI display
   * Combines SOH, age, and cycle count
   */
  public getHealthScore(
    soh: number,
    cycleCount: number,
    maxCycles: number,
    ageMonths: number
  ): number {
    // SOH weight: 50%
    const sohScore = soh * 0.5;

    // Cycle utilization weight: 30% (maxed at 80% of cycles)
    const cycleUtilization = Math.min(0.8, cycleCount / maxCycles);
    const cycleScore = (1 - cycleUtilization) * 100 * 0.3;

    // Age weight: 20% (assume 10-year lifespan = 120 months)
    const ageScore = Math.max(0, (1 - ageMonths / 120) * 100 * 0.2);

    return Math.round(sohScore + cycleScore + ageScore);
  }

  /**
   * Predict optimal maintenance windows
   */
  public predictMaintenanceNeeds(
    soh: number,
    cycleCount: number,
    maxCycles: number,
    averageTemperature: number
  ): {
    urgency: 'low' | 'medium' | 'high';
    recommendedAction: string;
    estimatedCost: number; // R$
  } {
    const cycleUtilization = cycleCount / maxCycles;

    // High temperature increases maintenance need
    const tempFactor = averageTemperature > 40 ? 1.5 : 1.0;

    if (soh < 70) {
      return {
        urgency: 'high',
        recommendedAction:
          'Schedule cell balancing and thermal check. Consider capacity test.',
        estimatedCost: 15000,
      };
    }

    if (soh < 80 || cycleUtilization > 0.7) {
      return {
        urgency: 'medium',
        recommendedAction:
          'Perform quarterly thermal scan and inspect for cell imbalance.',
        estimatedCost: 5000,
      };
    }

    if (cycleUtilization > 0.5) {
      return {
        urgency: 'low',
        recommendedAction:
          'Include in routine maintenance schedule. Monitor temperature trends.',
        estimatedCost: 1500,
      };
    }

    return {
      urgency: 'low',
      recommendedAction: 'Continue normal operation. Annual check recommended.',
      estimatedCost: 500,
    };
  }

  /**
   * Calculate cost of degradation (replacement or capacity loss)
   */
  public calculateDegradationCost(
    degradationPercent: number,
    batteryCapacityKWh: number,
    costPerKWh: number // e.g., 8000 R$/kWh for LiFePO4
  ): {
    lostCapacityKWh: number;
    estimatedCostR: number;
  } {
    const lostCapacity = (degradationPercent / 100) * batteryCapacityKWh;
    return {
      lostCapacityKWh: lostCapacity,
      estimatedCostR: lostCapacity * costPerKWh,
    };
  }

  /**
   * Get comprehensive health report
   */
  public generateHealthReport(
    systemId: string,
    nominalCapacity: number,
    currentCapacity: number,
    cycleCount: number,
    maxCycles: number,
    operatingHoursPerDay: number,
    averageTemperature: number,
    daysOfOperation: number,
    warrantyEndDate: Date
  ): BatteryHealthMetrics {
    const soh = this.calculateSOH(currentCapacity, nominalCapacity);
    const calendarDeg = this.estimateDegradationFromTemperature(
      operatingHoursPerDay,
      averageTemperature,
      daysOfOperation
    );
    const cyclicDeg = this.estimateDegradationFromCycles(cycleCount);

    const warrantyStatus = this.checkWarrantyStatus(
      soh,
      80, // Target 80% SOH at warranty end
      warrantyEndDate
    );

    const lifeRemaining = this.estimateRemainingLife(
      soh,
      cycleCount,
      maxCycles,
      this.LFP_DEGRADATION_RATE
    );

    return {
      systemId,
      nominalCapacity,
      currentCapacity,
      soh,
      cycleCount,
      maxCycles,
      warranty: {
        targetSOH: 80,
        endDate: warrantyEndDate,
        status: warrantyStatus,
      },
      degradation: {
        percentPerMonth: this.LFP_DEGRADATION_RATE * 100,
        estimatedCyclicDegradation: cyclicDeg * 100,
        estimatedCalendarDegradation: calendarDeg * 100,
      },
      lifeRemaining,
    };
  }
}
