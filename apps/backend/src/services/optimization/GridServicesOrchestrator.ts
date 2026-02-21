/**
 * Grid Services Orchestrator - Consolidated grid integration logic
 * Merges logic from:
 * - GridIntegration.tsx (control modes, frequency response)
 * - DemandResponse.tsx (load shedding, compliance)
 * - VirtualPowerPlant.tsx (aggregation, collective dispatch)
 */

import {
  DecisionResult,
  GridState,
  SystemTelemetry,
  GridServiceRequest,
} from '../../../../../packages/shared/src/types/optimization';

export type GridControlMode =
  | 'grid_following'
  | 'grid_forming'
  | 'islanding'
  | 'black_start'
  | 'synchronizing';

export interface ControlModeDefinition {
  name: GridControlMode;
  description: string;
  priority: number;
  requiredVoltageStability: number; // 0-1
  requiredFrequencyStability: number; // 0-1
  maxResponseTimeMs: number;
  requiresGridConnection: boolean;
}

export interface DemandResponseEvent {
  eventId: string;
  requiredReduction: number; // kW
  durationMinutes: number;
  compensationPerMWh: number; // R$/MWh
  compliance: number; // 0-1 (achieved / requested)
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface VirtualPowerPlantState {
  participantCount: number;
  totalCapacity: number; // kW
  availableCapacity: number; // kW
  averageSOC: number; // %
  averageSOH: number; // %
  dispatchingPower: number; // kW (aggregate)
  frequency: number; // Hz
  voltage: number; // V
}

export class GridServicesOrchestrator {
  private controlModes: Map<GridControlMode, ControlModeDefinition>;
  private currentMode: GridControlMode = 'grid_following';
  private demandResponseEvents: Map<string, DemandResponseEvent> = new Map();
  private vppParticipants: Map<string, SystemTelemetry> = new Map();

  // Grid reference parameters
  private readonly NOMINAL_FREQUENCY = 60; // Hz
  private readonly NOMINAL_VOLTAGE = 380; // V
  private readonly FREQUENCY_DEADBAND = 0.5; // Hz
  private readonly VOLTAGE_DEADBAND = 30; // V

  constructor() {
    this.controlModes = this.initializeControlModes();
  }

  /**
   * Define available grid control modes
   */
  private initializeControlModes(): Map<GridControlMode, ControlModeDefinition> {
    return new Map([
      [
        'grid_following',
        {
          name: 'grid_following',
          description: 'Standard mode - follows grid voltage and frequency',
          priority: 1,
          requiredVoltageStability: 0.95,
          requiredFrequencyStability: 0.98,
          maxResponseTimeMs: 100,
          requiresGridConnection: true,
        },
      ],
      [
        'grid_forming',
        {
          name: 'grid_forming',
          description: 'Creates its own voltage/frequency reference',
          priority: 2,
          requiredVoltageStability: 0.90,
          requiredFrequencyStability: 0.90,
          maxResponseTimeMs: 50,
          requiresGridConnection: true,
        },
      ],
      [
        'islanding',
        {
          name: 'islanding',
          description: 'Operates independently when grid is unavailable',
          priority: 3,
          requiredVoltageStability: 0.85,
          requiredFrequencyStability: 0.85,
          maxResponseTimeMs: 200,
          requiresGridConnection: false,
        },
      ],
      [
        'black_start',
        {
          name: 'black_start',
          description: 'Helps restore grid after blackout',
          priority: 4,
          requiredVoltageStability: 0.80,
          requiredFrequencyStability: 0.80,
          maxResponseTimeMs: 300,
          requiresGridConnection: false,
        },
      ],
      [
        'synchronizing',
        {
          name: 'synchronizing',
          description: 'Synchronizing with grid after island mode',
          priority: 5,
          requiredVoltageStability: 0.92,
          requiredFrequencyStability: 0.96,
          maxResponseTimeMs: 150,
          requiresGridConnection: true,
        },
      ],
    ]);
  }

  /**
   * Determine optimal control mode based on grid conditions
   */
  public selectControlMode(gridState: GridState): GridControlMode {
    if (!gridState.gridConnected) {
      // Check if black start is needed
      if (this.shouldInitiateBlackStart(gridState)) {
        return 'black_start';
      }
      // Otherwise island mode
      return 'islanding';
    }

    // Grid is connected - check for synchronization needs
    if (this.currentMode === 'islanding' || this.currentMode === 'black_start') {
      return 'synchronizing';
    }

    // Check voltage and frequency stability
    const voltageStability = this.evaluateVoltageStability(gridState);
    const frequencyStability = this.evaluateFrequencyStability(gridState);

    // If voltage is stable, prefer grid-following (more efficient)
    if (voltageStability > 0.95 && frequencyStability > 0.98) {
      return 'grid_following';
    }

    // If grid needs support, use grid-forming
    if (voltageStability > 0.90 || frequencyStability > 0.90) {
      return 'grid_forming';
    }

    // Fallback to grid-following
    return 'grid_following';
  }

  /**
   * Evaluate voltage stability (0-1)
   * 1.0 = nominal voltage, < 0.95 = low voltage event
   */
  private evaluateVoltageStability(gridState: GridState): number {
    const voltageDeviation = Math.abs(gridState.voltage - this.NOMINAL_VOLTAGE);
    const stability = 1 - voltageDeviation / this.NOMINAL_VOLTAGE;
    return Math.max(0, Math.min(1, stability));
  }

  /**
   * Evaluate frequency stability (0-1)
   * 1.0 = nominal frequency, proportional degradation with deviation
   */
  private evaluateFrequencyStability(gridState: GridState): number {
    const frequencyDeviation = Math.abs(gridState.frequency - this.NOMINAL_FREQUENCY);
    // Stability: 1 - (deviation as fraction of nominal frequency)
    const stability = 1 - frequencyDeviation / this.NOMINAL_FREQUENCY;
    return Math.max(0, Math.min(1, stability));
  }

  /**
   * Check if black start operation should be initiated
   */
  private shouldInitiateBlackStart(gridState: GridState): boolean {
    // Black start needed if:
    // 1. Grid is disconnected
    // 2. Voltage is near zero (blackout)
    // 3. Frequency is way off nominal

    return (
      !gridState.gridConnected &&
      gridState.voltage < 50 &&
      Math.abs(gridState.frequency - this.NOMINAL_FREQUENCY) > 5
    );
  }

  /**
   * Process demand response event
   */
  public processDemandResponseEvent(
    request: GridServiceRequest
  ): DemandResponseEvent {
    const eventId = `dr-${Date.now()}`;

    const event: DemandResponseEvent = {
      eventId,
      requiredReduction: request.powerRequired,
      durationMinutes: request.durationMinutes,
      compensationPerMWh: request.compensation || 0,
      compliance: 0,
      status: 'pending',
    };

    this.demandResponseEvents.set(eventId, event);
    return event;
  }

  /**
   * Calculate compliance with demand response
   * Compliance = (targetReduction - actualReduction) / targetReduction * 100
   */
  public calculateDRCompliance(
    eventId: string,
    actualReduction: number // kW achieved
  ): number {
    const event = this.demandResponseEvents.get(eventId);
    if (!event) return 0;

    const compliance = (actualReduction / event.requiredReduction) * 100;
    event.compliance = Math.min(100, compliance) / 100;

    // Update status
    if (event.compliance >= 0.85) {
      event.status = 'active';
    } else {
      event.status = 'failed';
    }

    return Math.round(event.compliance * 1000) / 10; // Return as percentage
  }

  /**
   * Register system for Virtual Power Plant
   */
  public registerVPPParticipant(
    systemId: string,
    telemetry: SystemTelemetry
  ): void {
    this.vppParticipants.set(systemId, telemetry);
  }

  /**
   * Unregister system from Virtual Power Plant
   */
  public unregisterVPPParticipant(systemId: string): void {
    this.vppParticipants.delete(systemId);
  }

  /**
   * Get VPP aggregated state
   */
  public getVPPState(): VirtualPowerPlantState {
    const participants = Array.from(this.vppParticipants.values());

    if (participants.length === 0) {
      return {
        participantCount: 0,
        totalCapacity: 0,
        availableCapacity: 0,
        averageSOC: 0,
        averageSOH: 0,
        dispatchingPower: 0,
        frequency: this.NOMINAL_FREQUENCY,
        voltage: this.NOMINAL_VOLTAGE,
      };
    }

    const totalCapacity = participants.length * 500; // Assume 500kW each
    const availableCapacity = participants.reduce(
      (sum, t) => sum + (t.soc / 100) * 500,
      0
    );
    const averageSOC =
      participants.reduce((sum, t) => sum + t.soc, 0) / participants.length;
    const averageSOH =
      participants.reduce((sum, t) => sum + t.soh, 0) / participants.length;
    const dispatchingPower = participants.reduce(
      (sum, t) => sum + t.power,
      0
    );

    return {
      participantCount: participants.length,
      totalCapacity,
      availableCapacity,
      averageSOC,
      averageSOH,
      dispatchingPower,
      frequency: this.NOMINAL_FREQUENCY, // In real system, measured from grid
      voltage: this.NOMINAL_VOLTAGE,
    };
  }

  /**
   * Coordinate VPP dispatch
   * Distribute power setpoint to all participants proportionally
   */
  public coordinateVPPDispatch(
    totalDispatchPower: number // kW (negative = charge, positive = discharge)
  ): Map<string, number> {
    const dispatch = new Map<string, number>();
    const participants = Array.from(this.vppParticipants.entries());

    if (participants.length === 0) return dispatch;

    // Distribute power proportionally to available capacity
    const totalAvailable = participants.reduce(
      (sum, [_, t]) => sum + (t.soc / 100) * 500,
      0
    );

    participants.forEach(([systemId, telemetry]) => {
      const availableRatio = (telemetry.soc / 100) * 500 / totalAvailable || 0;
      const systemPower = totalDispatchPower * availableRatio;
      dispatch.set(systemId, systemPower);
    });

    return dispatch;
  }

  /**
   * Get current control mode
   */
  public getCurrentMode(): GridControlMode {
    return this.currentMode;
  }

  /**
   * Set control mode
   */
  public setControlMode(mode: GridControlMode): void {
    this.currentMode = mode;
  }

  /**
   * Get tariff schedule (time-based pricing)
   */
  public getTariffSchedule(
    hour: number
  ): { period: string; rate: number; factor: number } {
    // Brazilian tariff schedule (typical)
    // Peak: 17:00-22:00 (highest)
    // Intermediate: 7:00-17:00 and 22:00-23:00 (medium)
    // Off-peak: 23:00-7:00 (lowest)

    if (hour >= 17 && hour < 22) {
      return { period: 'peak', rate: 0.85, factor: 1.5 };
    } else if ((hour >= 7 && hour < 17) || hour === 22) {
      return { period: 'intermediate', rate: 0.60, factor: 1.0 };
    } else {
      return { period: 'offPeak', rate: 0.30, factor: 0.5 };
    }
  }

  /**
   * Load shedding logic for emergency conditions
   */
  public calculateLoadShedding(
    currentSOC: number,
    socThreshold: number = 50 // %
  ): {
    shouldShed: boolean;
    essentialLoadsOnly: boolean;
    reductionTarget: number; // % to reduce
  } {
    if (currentSOC >= socThreshold) {
      return {
        shouldShed: false,
        essentialLoadsOnly: false,
        reductionTarget: 0,
      };
    }

    // Calculate reduction needed based on SOC depletion
    const depletionPercent = (socThreshold - currentSOC) / socThreshold;

    return {
      shouldShed: true,
      essentialLoadsOnly: currentSOC < socThreshold * 0.5, // Very critical
      reductionTarget: Math.min(100, depletionPercent * 100 + 20), // Progressive reduction
    };
  }
}
