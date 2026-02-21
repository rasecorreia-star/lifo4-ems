/**
 * Unified Decision Engine - CORE OF OPTIMIZATION
 *
 * Hierarchical priority system that decides what the battery should do every 5 minutes:
 * 1. SAFETY - Hard constraints (never violate)
 * 2. GRID_CODE - Regulatory obligations
 * 3. CONTRACTUAL - Customer obligations
 * 4. ECONOMIC - Maximize profit
 * 5. LONGEVITY - Preserve battery
 *
 * Decision is made top-to-bottom. First priority that triggers wins.
 */

import {
  DecisionResult,
  DecisionAction,
  DecisionPriority,
  SystemTelemetry,
  GridState,
  MarketData,
  SystemConstraints,
  OptimizationConfig,
} from '../../../../../packages/shared/src/types/optimization';

export class UnifiedDecisionEngine {
  private systemId: string;
  private constraints: SystemConstraints;
  private config: OptimizationConfig;

  constructor(
    systemId: string,
    constraints: SystemConstraints,
    config: OptimizationConfig
  ) {
    this.systemId = systemId;
    this.constraints = constraints;
    this.config = config;
  }

  /**
   * Main decision cycle - called every 5 minutes
   */
  public async decide(
    telemetry: SystemTelemetry,
    gridState: GridState,
    marketData: MarketData,
    forecast?: any
  ): Promise<DecisionResult> {
    const timestamp = new Date();

    console.log(`[${timestamp.toISOString()}] UDE: Decision cycle for ${this.systemId}`);

    // PRIORITY 1: SAFETY (hard constraints)
    {
      const safetyDecision = this.checkSafety(telemetry);
      if (safetyDecision) {
        console.log(`[UDE][${this.systemId}] Priority:${safetyDecision.priority} Action:${safetyDecision.action} Reason:${safetyDecision.reason}`);
        return safetyDecision;
      }
    }

    // PRIORITY 2: GRID_CODE (regulatory obligations)
    if (gridState.gridConnected) {
      const gridDecision = this.checkGridCode(telemetry, gridState);
      if (gridDecision) {
        console.log(`[UDE][${this.systemId}] Priority:${gridDecision.priority} Action:${gridDecision.action} Reason:${gridDecision.reason}`);
        return gridDecision;
      }
    }

    // PRIORITY 3: CONTRACTUAL (customer obligations)
    {
      const contractualDecision = this.checkContractual(telemetry, marketData);
      if (contractualDecision) {
        console.log(`[UDE][${this.systemId}] Priority:${contractualDecision.priority} Action:${contractualDecision.action} Reason:${contractualDecision.reason}`);
        return contractualDecision;
      }
    }

    // PRIORITY 4: ECONOMIC (maximize profit)
    {
      const economicDecision = this.checkEconomic(telemetry, marketData, forecast);
      if (economicDecision) {
        console.log(`[UDE][${this.systemId}] Priority:${economicDecision.priority} Action:${economicDecision.action} Reason:${economicDecision.reason}`);
        return economicDecision;
      }
    }

    // PRIORITY 5: LONGEVITY (preserve battery)
    {
      const longevityDecision = this.checkLongevity(telemetry);
      if (longevityDecision) {
        console.log(`[UDE][${this.systemId}] Priority:${longevityDecision.priority} Action:${longevityDecision.action} Reason:${longevityDecision.reason}`);
        return longevityDecision;
      }
    }

    // Default: IDLE (BUG FIX #4)
    const defaultDecision: DecisionResult = {
      action: 'IDLE' as DecisionAction,
      powerKW: 0,
      durationMinutes: 5,
      priority: 'LONGEVITY' as DecisionPriority,
      reason: 'No action required - battery in healthy state',
      confidence: 1.0,
      timestamp,
      nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
    };
    console.log(`[UDE][${this.systemId}] Priority:${defaultDecision.priority} Action:${defaultDecision.action} Reason:${defaultDecision.reason}`);
    return defaultDecision;
  }

  /**
   * PRIORITY 1: SAFETY
   * Hard constraints that NEVER can be violated
   */
  private checkSafety(telemetry: SystemTelemetry): DecisionResult | null {
    const timestamp = new Date();

    // Cell voltage check (BUG FIX #3)
    const numCells = 16; // Default for LiFePO4 16S configuration
    const cellVoltage = telemetry.voltage / numCells;
    if (cellVoltage < this.constraints.minCellVoltage || cellVoltage > this.constraints.maxCellVoltage) {
      return {
        action: 'EMERGENCY_STOP',
        powerKW: 0,
        durationMinutes: 5,
        priority: 'SAFETY',
        reason: `Critical: Cell voltage ${cellVoltage.toFixed(2)}V out of bounds [${this.constraints.minCellVoltage}, ${this.constraints.maxCellVoltage}]V`,
        confidence: 1.0,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    // Temperature emergency
    if (telemetry.temperature > this.constraints.maxTemperature) {
      return {
        action: 'EMERGENCY_STOP',
        powerKW: 0,
        durationMinutes: 5,
        priority: 'SAFETY',
        reason: `Critical: Temperature ${telemetry.temperature}°C exceeds limit ${this.constraints.maxTemperature}°C`,
        confidence: 1.0,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    // SOC lower bound (BUG FIX #1)
    if (telemetry.soc < this.constraints.minSOC) {
      return {
        action: 'IDLE',
        powerKW: 0,
        durationMinutes: 5,
        priority: 'SAFETY',
        reason: `Safety: SOC ${telemetry.soc}% below minimum ${this.constraints.minSOC}% - STOP_DISCHARGE only. Charging still allowed to recover.`,
        confidence: 1.0,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    // SOC upper bound (BUG FIX #2 - reason clarification)
    if (telemetry.soc > this.constraints.maxSOC) {
      return {
        action: 'IDLE',
        powerKW: 0,
        durationMinutes: 5,
        priority: 'SAFETY',
        reason: `Safety: SOC ${telemetry.soc}% above maximum ${this.constraints.maxSOC}% - STOP_CHARGE required`,
        confidence: 1.0,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    // Current limit
    if (Math.abs(telemetry.current) > this.constraints.maxCurrent) {
      return {
        action: 'IDLE',
        powerKW: 0,
        durationMinutes: 5,
        priority: 'SAFETY',
        reason: `Safety: Current ${telemetry.current}A exceeds limit ${this.constraints.maxCurrent}A - reduce power`,
        confidence: 1.0,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    return null;
  }

  /**
   * PRIORITY 2: GRID_CODE
   * Regulatory obligations for grid stability
   */
  private checkGridCode(telemetry: SystemTelemetry, gridState: GridState): DecisionResult | null {
    const timestamp = new Date();

    // Frequency response - droop control
    if (Math.abs(gridState.frequency - 60) > this.constraints.frequencyDeadband) {
      // Frequency too low: discharge (inject power)
      // Frequency too high: charge (absorb power)
      const frequencyError = 60 - gridState.frequency;
      const droop = 0.05; // 5% droop

      if (frequencyError > 0) {
        // Under-frequency: inject power
        const injectionPower = Math.min(
          this.constraints.maxPower,
          (frequencyError / droop) * this.constraints.maxPower
        );

        if (telemetry.soc > this.constraints.minSOC + 5) {
          return {
            action: 'DISCHARGE',
            powerKW: injectionPower,
            durationMinutes: 5,
            priority: 'GRID_CODE',
            reason: `Grid support: Frequency ${gridState.frequency.toFixed(2)}Hz - injecting ${injectionPower.toFixed(1)}kW`,
            confidence: 0.95,
            timestamp,
            nextReviewAt: new Date(timestamp.getTime() + 1 * 60000), // Review sooner for grid services
            metadata: { gridFrequency: gridState.frequency },
          };
        }
      } else {
        // Over-frequency: absorb power
        const absorptionPower = Math.min(
          this.constraints.maxPower,
          (-frequencyError / droop) * this.constraints.maxPower
        );

        if (telemetry.soc < this.constraints.maxSOC - 5) {
          return {
            action: 'CHARGE',
            powerKW: -absorptionPower,
            durationMinutes: 5,
            priority: 'GRID_CODE',
            reason: `Grid support: Frequency ${gridState.frequency.toFixed(2)}Hz - absorbing ${absorptionPower.toFixed(1)}kW`,
            confidence: 0.95,
            timestamp,
            nextReviewAt: new Date(timestamp.getTime() + 1 * 60000),
            metadata: { gridFrequency: gridState.frequency },
          };
        }
      }
    }

    return null;
  }

  /**
   * PRIORITY 3: CONTRACTUAL
   * Customer obligations (demand limit, reserved capacity, etc)
   */
  private checkContractual(telemetry: SystemTelemetry, marketData: MarketData): DecisionResult | null {
    const timestamp = new Date();

    // Peak shaving
    if (
      this.config.peakShaving?.enabled &&
      marketData.loadProfile === 'peak'
    ) {
      const demandLimit = this.config.peakShaving.demandLimit || 100;
      const triggerThreshold = this.config.peakShaving.triggerThreshold || 80;

      // Simulate current demand (in real system would come from telemetry)
      const currentDemand = marketData.demandForecast * 1.1; // Add 10% margin

      if (currentDemand > (demandLimit * triggerThreshold) / 100) {
        const excessPower = currentDemand - demandLimit;

        if (telemetry.soc > this.constraints.minSOC + 10) {
          return {
            action: 'DISCHARGE',
            powerKW: Math.min(excessPower, this.constraints.maxPower),
            durationMinutes: 60, // Peak shaving is longer duration
            priority: 'CONTRACTUAL',
            reason: `Peak shaving: Demand forecast ${currentDemand.toFixed(0)}kW > limit ${demandLimit}kW`,
            confidence: 0.9,
            timestamp,
            nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
          };
        }
      }
    }

    return null;
  }

  /**
   * PRIORITY 4: ECONOMIC
   * Maximize profit through arbitrage, trading, and energy optimization
   */
  private checkEconomic(
    telemetry: SystemTelemetry,
    marketData: MarketData,
    forecast?: any
  ): DecisionResult | null {
    const timestamp = new Date();

    // Arbitrage opportunity
    if (
      this.config.arbitrage?.enabled &&
      this.config.arbitrage.buyThreshold &&
      this.config.arbitrage.sellThreshold
    ) {
      const buyThreshold = this.config.arbitrage.buyThreshold;
      const sellThreshold = this.config.arbitrage.sellThreshold;

      // Buy signal: price is low
      if (marketData.spotPrice < buyThreshold && telemetry.soc < this.constraints.maxSOC - 10) {
        return {
          action: 'CHARGE',
          powerKW: -Math.min(50, this.constraints.maxPower), // Conservative power for arbitrage
          durationMinutes: 60, // Longer arbitrage windows
          priority: 'ECONOMIC',
          reason: `Arbitrage: Spot price R$ ${marketData.spotPrice.toFixed(0)}/MWh < threshold R$ ${buyThreshold.toFixed(0)}/MWh - buying`,
          confidence: 0.85,
          timestamp,
          nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
          metadata: { arbitragePrice: marketData.spotPrice },
        };
      }

      // Sell signal: price is high
      if (marketData.spotPrice > sellThreshold && telemetry.soc > this.constraints.minSOC + 10) {
        return {
          action: 'DISCHARGE',
          powerKW: Math.min(50, this.constraints.maxPower),
          durationMinutes: 60,
          priority: 'ECONOMIC',
          reason: `Arbitrage: Spot price R$ ${marketData.spotPrice.toFixed(0)}/MWh > threshold R$ ${sellThreshold.toFixed(0)}/MWh - selling`,
          confidence: 0.85,
          timestamp,
          nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
          metadata: { arbitragePrice: marketData.spotPrice },
        };
      }
    }

    return null;
  }

  /**
   * PRIORITY 5: LONGEVITY
   * Preserve battery health by avoiding unnecessary cycling
   */
  private checkLongevity(telemetry: SystemTelemetry): DecisionResult | null {
    const timestamp = new Date();

    // Keep SOC in sweet spot (20-80%) when idle
    const sweetSpotLow = 20;
    const sweetSpotHigh = 80;

    // If below sweet spot, gently charge
    if (telemetry.soc < sweetSpotLow) {
      return {
        action: 'CHARGE',
        powerKW: -Math.min(20, this.constraints.maxPower),
        durationMinutes: 30,
        priority: 'LONGEVITY',
        reason: `Battery preservation: SOC ${telemetry.soc}% below sweet spot ${sweetSpotLow}% - gentle charge to extend lifespan`,
        confidence: 0.7,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    // If above sweet spot, gently discharge
    if (telemetry.soc > sweetSpotHigh) {
      return {
        action: 'DISCHARGE',
        powerKW: Math.min(20, this.constraints.maxPower),
        durationMinutes: 30,
        priority: 'LONGEVITY',
        reason: `Battery preservation: SOC ${telemetry.soc}% above sweet spot ${sweetSpotHigh}% - gentle discharge to extend lifespan`,
        confidence: 0.7,
        timestamp,
        nextReviewAt: new Date(timestamp.getTime() + 5 * 60000),
      };
    }

    return null;
  }

  /**
   * Calculate battery degradation impact of a decision
   */
  private calculateDegradationImpact(action: DecisionAction, power: number, duration: number): number {
    // Simplified degradation: assume 0.001% per kWh cycled
    const energyCycled = Math.abs(power) * (duration / 60);
    return energyCycled * 0.00001; // Percentage points of SOH lost
  }
}
