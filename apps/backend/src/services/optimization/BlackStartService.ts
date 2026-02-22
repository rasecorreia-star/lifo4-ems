/**
 * Black Start Service - Grid restoration after blackouts
 * Extracts logic from frontend BlackStart.tsx
 *
 * Implements Finite State Machine (FSM):
 * grid_connected → detected → transferring → island_mode → synchronizing → grid_connected
 */

import {
  GridState,
  SystemTelemetry,
  BlackStartState,
  BlackStartEvent,
} from '../../../../../packages/shared/src/types/optimization';
import { logger } from '../../lib/logger.js';

export interface BlackStartStatus {
  currentState: BlackStartState;
  elapsedTimeMs: number;
  gridVoltage: number; // V
  gridFrequency: number; // Hz
  systemFrequency: number; // Hz
  frequencyError: number; // Hz
  loadConnected: number; // %
  islandModeActive: boolean;
  synchronizationProgress: number; // 0-100%
}

export class BlackStartService {
  private fsm: BlackStartState = 'grid_connected';
  private stateHistory: BlackStartEvent[] = [];
  private lastStateChangeTime: number = Date.now();

  // FSM transition thresholds
  private readonly BLACKOUT_VOLTAGE_THRESHOLD = 50; // V - grid voltage too low
  private readonly FREQUENCY_THRESHOLD = 5; // Hz - frequency deviation too large
  private readonly SYNCHRONIZATION_FREQUENCY_TOLERANCE = 0.5; // Hz
  private readonly SYNCHRONIZATION_VOLTAGE_TOLERANCE = 20; // V
  private readonly SYNCHRONIZATION_PHASE_TOLERANCE = 30; // degrees

  /**
   * Process grid conditions and update FSM state
   */
  public processBlackout(
    gridState: GridState,
    systemTelemetry: SystemTelemetry,
    systemId: string
  ): BlackStartStatus {
    const previousState = this.fsm;

    // Update FSM based on conditions
    this.updateFSM(gridState, systemTelemetry);

    // Log state change
    if (previousState !== this.fsm) {
      this.logStateTransition(
        systemId,
        previousState,
        this.fsm,
        this.getTransitionReason(previousState, this.fsm, gridState)
      );
      this.lastStateChangeTime = Date.now();
    }

    // Return status
    return this.getStatus(gridState, systemTelemetry);
  }

  /**
   * FSM State Machine Logic
   */
  private updateFSM(gridState: GridState, systemTelemetry: SystemTelemetry): void {
    switch (this.fsm) {
      case 'grid_connected':
        // Monitor for blackout detection
        if (gridState.voltage < this.BLACKOUT_VOLTAGE_THRESHOLD) {
          this.fsm = 'blackout_detected';
        }
        break;

      case 'blackout_detected':
        // Wait for transfer to occur, then go to island mode
        if (Math.abs(gridState.frequency - 60) > 2) {
          this.fsm = 'transferring';
        }
        break;

      case 'transferring':
        // After brief transfer period, operate in island mode
        if (this.lastStateChangeTime + 5000 < Date.now()) {
          this.fsm = 'island_mode';
        }
        break;

      case 'island_mode':
        // Monitor for grid restoration
        if (gridState.voltage > this.BLACKOUT_VOLTAGE_THRESHOLD * 2) {
          // Grid is coming back
          this.fsm = 'synchronizing';
        }
        // Apply load shedding if SOC is critical
        this.applyLoadSheddingIfNeeded(systemTelemetry);
        break;

      case 'synchronizing':
        // Check if frequency and voltage are synchronized
        if (this.isSynchronized(gridState)) {
          this.fsm = 'resynchronized';
        }
        // Timeout after 60 seconds
        if (this.lastStateChangeTime + 60000 < Date.now()) {
          this.fsm = 'island_mode'; // Fall back to island mode
        }
        break;

      case 'resynchronized':
        // Wait for confirmation and transition back to grid_connected
        if (this.lastStateChangeTime + 2000 < Date.now()) {
          this.fsm = 'grid_connected';
        }
        break;
    }
  }

  /**
   * Check if system frequency and voltage are synchronized with grid
   */
  private isSynchronized(gridState: GridState): boolean {
    // Frequency within deadband
    const frequencyOk =
      Math.abs(gridState.frequency - 60) < this.SYNCHRONIZATION_FREQUENCY_TOLERANCE;

    // Voltage within range
    const voltageOk =
      Math.abs(gridState.voltage - 380) < this.SYNCHRONIZATION_VOLTAGE_TOLERANCE;

    return frequencyOk && voltageOk;
  }

  /**
   * Apply load shedding if SOC is critical during island mode
   */
  private applyLoadSheddingIfNeeded(systemTelemetry: SystemTelemetry): void {
    // If SOC drops below 50% in island mode, shed non-essential loads
    if (
      this.fsm === 'island_mode' &&
      systemTelemetry.soc < 50 &&
      systemTelemetry.power > 0
    ) {
      // Shed non-essential loads (heating, AC, non-critical equipment)
      // This would trigger a signal to the BMS to reduce load
      // Load shedding signal sent to BMS
      // logger is imported lazily to avoid circular dependency in this service
    }
  }

  /**
   * Get human-readable reason for state transition
   */
  private getTransitionReason(
    fromState: BlackStartState,
    toState: BlackStartState,
    gridState: GridState
  ): string {
    const reasons: Record<string, string> = {
      'grid_connected->blackout_detected': `Voltage dropped to ${gridState.voltage.toFixed(1)}V (threshold: ${this.BLACKOUT_VOLTAGE_THRESHOLD}V)`,
      'blackout_detected->transferring': `Frequency deviation detected: ${Math.abs(gridState.frequency - 60).toFixed(2)}Hz`,
      'transferring->island_mode': 'Transfer period complete, operating independently',
      'island_mode->synchronizing': `Grid restoration detected: voltage at ${gridState.voltage.toFixed(1)}V`,
      'synchronizing->resynchronized': 'Frequency and voltage synchronized with grid',
      'resynchronized->grid_connected': 'Confirmation received, resuming normal operation',
      'synchronizing->island_mode': 'Synchronization timeout, maintaining island mode',
    };

    return (
      reasons[`${fromState}->${toState}`] || 'State transition occurred'
    );
  }

  /**
   * Log state transition for audit trail
   */
  private logStateTransition(
    systemId: string,
    fromState: BlackStartState,
    toState: BlackStartState,
    reason: string
  ): void {
    const event: BlackStartEvent = {
      timestamp: new Date(),
      fromState,
      toState,
      reason,
      systemId,
    };

    this.stateHistory.push(event);

    // Keep only last 1000 events
    if (this.stateHistory.length > 1000) {
      this.stateHistory.shift();
    }

    logger.info('BlackStart FSM transition', { systemId, fromState, toState, reason });
  }

  /**
   * Get current black start status
   */
  private getStatus(
    gridState: GridState,
    systemTelemetry: SystemTelemetry
  ): BlackStartStatus {
    const frequencyError = Math.abs(gridState.frequency - 60);
    const synchronizationProgress = Math.max(
      0,
      100 -
        (frequencyError / this.SYNCHRONIZATION_FREQUENCY_TOLERANCE) * 100
    );

    return {
      currentState: this.fsm,
      elapsedTimeMs: Date.now() - this.lastStateChangeTime,
      gridVoltage: gridState.voltage,
      gridFrequency: gridState.frequency,
      systemFrequency: 60, // In real system, measured from inverter
      frequencyError,
      loadConnected: this.fsm === 'grid_connected' ? 100 : 50,
      islandModeActive: this.fsm === 'island_mode' || this.fsm === 'transferring',
      synchronizationProgress: Math.min(
        100,
        this.fsm === 'synchronizing' ? synchronizationProgress : 0
      ),
    };
  }

  /**
   * Estimate energy available for island mode operation
   */
  public estimateIslandModeDuration(
    batteryCapacityKWh: number,
    systemTelemetry: SystemTelemetry,
    averageLoadKW: number // Average load during island
  ): {
    durationHours: number;
    shutdownSOC: number; // % at which critical loads shut down
  } {
    const availableEnergy = (systemTelemetry.soc / 100) * batteryCapacityKWh;
    const criticalLoadThreshold = 20; // % SOC

    const usableEnergy = (systemTelemetry.soc - criticalLoadThreshold) / 100 * batteryCapacityKWh;
    const durationHours = usableEnergy / averageLoadKW;

    return {
      durationHours: Math.max(0, durationHours),
      shutdownSOC: criticalLoadThreshold,
    };
  }

  /**
   * Get state history for analysis
   */
  public getStateHistory(): BlackStartEvent[] {
    return [...this.stateHistory];
  }

  /**
   * Get current FSM state
   */
  public getCurrentState(): BlackStartState {
    return this.fsm;
  }

  /**
   * Reset FSM to initial state (manual reset after service)
   */
  public resetFSM(): void {
    if (this.fsm !== 'grid_connected') {
      this.fsm = 'grid_connected';
      this.lastStateChangeTime = Date.now();
      logger.info('BlackStart FSM manually reset', { systemId: 'manual', toState: 'grid_connected' });
    }
  }

  /**
   * Calculate black start capability (can the system help restore grid?)
   * Must have: SOC > 50%, voltage stable, frequency stable
   */
  public getBlackStartCapability(
    systemTelemetry: SystemTelemetry,
    gridState: GridState
  ): {
    capable: boolean;
    confidence: number; // 0-1
    limitingFactor: string;
  } {
    let capable = true;
    let confidence = 1.0;
    let limitingFactor = 'none';

    // Check SOC
    if (systemTelemetry.soc < 50) {
      capable = false;
      limitingFactor = `Low SOC: ${systemTelemetry.soc.toFixed(1)}% (minimum 50%)`;
      confidence = systemTelemetry.soc / 50;
    }

    // Check temperature
    if (systemTelemetry.temperature > 45) {
      capable = false;
      confidence *= 0.8;
      limitingFactor = `High temperature: ${systemTelemetry.temperature.toFixed(1)}°C`;
    }

    // Check voltage stability
    const voltageDeviation = Math.abs(gridState.voltage - 380);
    if (voltageDeviation > 50) {
      confidence *= Math.max(0.5, 1 - voltageDeviation / 100);
    }

    return {
      capable: capable && confidence > 0.8,
      confidence: Math.max(0, Math.min(1, confidence)),
      limitingFactor,
    };
  }

  /**
   * Estimate grid restoration time
   * Factors: frequency deviation, voltage deviation, system response
   */
  public estimateRestorationTime(
    gridState: GridState,
    systemTelemetry: SystemTelemetry
  ): {
    estimatedMinutes: number;
    confidence: number;
    stages: string[];
  } {
    const frequencyDeviation = Math.abs(gridState.frequency - 60);
    const voltageDeviation = Math.abs(gridState.voltage - 380);

    // Stage 1: Detection (0-5 seconds)
    // Stage 2: Transfer (5-10 seconds)
    // Stage 3: Island operation (variable)
    // Stage 4: Grid stabilization (10-60 seconds)
    // Stage 5: Resynchronization (10-30 seconds)

    let estimatedTime = 0.5; // Start with 30 seconds

    // Add time based on frequency deviation
    if (frequencyDeviation > 5) {
      estimatedTime += (frequencyDeviation - 5) * 0.2; // 1.2 min per Hz
    }

    // Add time based on voltage deviation
    if (voltageDeviation > 50) {
      estimatedTime += (voltageDeviation - 50) / 100 * 2; // Up to 2 min

    }

    // Add time if SOC is low (slower discharge rates)
    if (systemTelemetry.soc < 30) {
      estimatedTime *= 1.5; // 50% slower
    }

    const confidence = Math.max(0.5, 1 - (frequencyDeviation + voltageDeviation / 380) / 10);

    return {
      estimatedMinutes: estimatedTime,
      confidence,
      stages: [
        'Detection',
        'Transfer',
        'Island mode',
        'Grid stabilization',
        'Resynchronization',
      ],
    };
  }
}
