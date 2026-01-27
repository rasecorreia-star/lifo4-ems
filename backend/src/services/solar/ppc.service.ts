/**
 * Power Plant Controller (PPC) Service
 * Centralized control for solar-BESS hybrid systems
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export enum PPCMode {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  GRID_SUPPORT = 'grid_support',
  ISLAND = 'island',
  CURTAILMENT = 'curtailment',
  RAMP_CONTROL = 'ramp_control'
}

export enum GridCode {
  IEEE_1547 = 'ieee_1547',
  VDE_AR_N_4105 = 'vde_ar_n_4105',
  CEI_0_21 = 'cei_0_21',
  GRID_CODE_BR = 'grid_code_br',
  CUSTOM = 'custom'
}

export interface PPCSetpoints {
  activePowerLimit: number;      // kW
  reactivePowerLimit: number;    // kVAr
  powerFactor: number;           // -1 to 1
  voltageSetpoint: number;       // V
  frequencyDroop: number;        // %
  rampRateUp: number;            // kW/min
  rampRateDown: number;          // kW/min
}

export interface GridConstraints {
  maxExportPower: number;        // kW
  maxImportPower: number;        // kW
  voltageMin: number;            // V
  voltageMax: number;            // V
  frequencyMin: number;          // Hz
  frequencyMax: number;          // Hz
  powerFactorMin: number;
  powerFactorMax: number;
}

export interface PPCState {
  mode: PPCMode;
  gridCode: GridCode;
  setpoints: PPCSetpoints;
  constraints: GridConstraints;
  currentPower: number;          // kW
  currentReactivePower: number;  // kVAr
  gridVoltage: number;           // V
  gridFrequency: number;         // Hz
  isConnected: boolean;
  curtailmentActive: boolean;
  curtailmentAmount: number;     // kW
  lastUpdate: Date;
}

export interface PlantOverview {
  totalCapacityKW: number;
  solarCapacityKW: number;
  bessCapacityKW: number;
  bessCapacityKWh: number;
  currentGenerationKW: number;
  currentStorageKW: number;     // Positive = charging, Negative = discharging
  currentLoadKW: number;
  gridExportKW: number;
  gridImportKW: number;
  solarAvailableKW: number;
  bessSOC: number;              // %
  efficiency: number;           // %
}

export interface RampEvent {
  timestamp: Date;
  triggerType: 'cloud' | 'load' | 'grid' | 'manual';
  rampDirection: 'up' | 'down';
  rampRateKWMin: number;
  targetPowerKW: number;
  duration: number;             // seconds
}

// ============================================
// PID CONTROLLER FOR POWER REGULATION
// ============================================

class PIDController {
  private kp: number;
  private ki: number;
  private kd: number;
  private integral: number = 0;
  private lastError: number = 0;
  private lastTime: number = Date.now();
  private outputMin: number;
  private outputMax: number;

  constructor(
    kp: number,
    ki: number,
    kd: number,
    outputMin: number,
    outputMax: number
  ) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.outputMin = outputMin;
    this.outputMax = outputMax;
  }

  compute(setpoint: number, measurement: number): number {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000; // seconds
    this.lastTime = now;

    const error = setpoint - measurement;

    // Proportional
    const p = this.kp * error;

    // Integral with anti-windup
    this.integral += error * dt;
    this.integral = Math.max(
      this.outputMin / this.ki,
      Math.min(this.outputMax / this.ki, this.integral)
    );
    const i = this.ki * this.integral;

    // Derivative
    const derivative = dt > 0 ? (error - this.lastError) / dt : 0;
    const d = this.kd * derivative;

    this.lastError = error;

    // Output with limits
    const output = p + i + d;
    return Math.max(this.outputMin, Math.min(this.outputMax, output));
  }

  reset(): void {
    this.integral = 0;
    this.lastError = 0;
    this.lastTime = Date.now();
  }

  setGains(kp: number, ki: number, kd: number): void {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
  }
}

// ============================================
// RAMP RATE CONTROLLER
// ============================================

class RampRateController {
  private currentPower: number = 0;
  private targetPower: number = 0;
  private rampRateUp: number;    // kW/s
  private rampRateDown: number;  // kW/s
  private lastUpdate: number = Date.now();

  constructor(rampRateUpKWMin: number, rampRateDownKWMin: number) {
    this.rampRateUp = rampRateUpKWMin / 60;
    this.rampRateDown = rampRateDownKWMin / 60;
  }

  setTarget(targetPower: number): void {
    this.targetPower = targetPower;
  }

  update(): number {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000; // seconds
    this.lastUpdate = now;

    const diff = this.targetPower - this.currentPower;

    if (Math.abs(diff) < 0.1) {
      this.currentPower = this.targetPower;
      return this.currentPower;
    }

    if (diff > 0) {
      // Ramping up
      const maxChange = this.rampRateUp * dt;
      this.currentPower += Math.min(diff, maxChange);
    } else {
      // Ramping down
      const maxChange = this.rampRateDown * dt;
      this.currentPower -= Math.min(-diff, maxChange);
    }

    return this.currentPower;
  }

  getCurrentPower(): number {
    return this.currentPower;
  }

  setRampRates(rampRateUpKWMin: number, rampRateDownKWMin: number): void {
    this.rampRateUp = rampRateUpKWMin / 60;
    this.rampRateDown = rampRateDownKWMin / 60;
  }
}

// ============================================
// PPC SERVICE
// ============================================

export class PPCService extends EventEmitter {
  private static instance: PPCService;

  private state: PPCState;
  private plantOverview: PlantOverview;
  private rampController: RampRateController;
  private voltagePID: PIDController;
  private frequencyPID: PIDController;
  private powerPID: PIDController;

  private controlInterval: NodeJS.Timeout | null = null;
  private readonly CONTROL_PERIOD_MS = 100; // 100ms control loop

  private rampEvents: RampEvent[] = [];
  private readonly MAX_RAMP_EVENTS = 1000;

  private constructor() {
    super();

    // Default state
    this.state = {
      mode: PPCMode.AUTOMATIC,
      gridCode: GridCode.IEEE_1547,
      setpoints: {
        activePowerLimit: 1000,
        reactivePowerLimit: 500,
        powerFactor: 1.0,
        voltageSetpoint: 400,
        frequencyDroop: 4,
        rampRateUp: 100,
        rampRateDown: 100
      },
      constraints: {
        maxExportPower: 1000,
        maxImportPower: 500,
        voltageMin: 380,
        voltageMax: 420,
        frequencyMin: 59.5,
        frequencyMax: 60.5,
        powerFactorMin: 0.85,
        powerFactorMax: 1.0
      },
      currentPower: 0,
      currentReactivePower: 0,
      gridVoltage: 400,
      gridFrequency: 60,
      isConnected: true,
      curtailmentActive: false,
      curtailmentAmount: 0,
      lastUpdate: new Date()
    };

    // Default plant overview
    this.plantOverview = {
      totalCapacityKW: 2000,
      solarCapacityKW: 1500,
      bessCapacityKW: 500,
      bessCapacityKWh: 1000,
      currentGenerationKW: 0,
      currentStorageKW: 0,
      currentLoadKW: 0,
      gridExportKW: 0,
      gridImportKW: 0,
      solarAvailableKW: 0,
      bessSOC: 50,
      efficiency: 95
    };

    // Initialize controllers
    this.rampController = new RampRateController(
      this.state.setpoints.rampRateUp,
      this.state.setpoints.rampRateDown
    );

    this.voltagePID = new PIDController(1.0, 0.1, 0.05, -100, 100);
    this.frequencyPID = new PIDController(2.0, 0.2, 0.1, -200, 200);
    this.powerPID = new PIDController(0.5, 0.05, 0.02, -500, 500);
  }

  static getInstance(): PPCService {
    if (!PPCService.instance) {
      PPCService.instance = new PPCService();
    }
    return PPCService.instance;
  }

  /**
   * Start PPC control loop
   */
  start(): void {
    if (this.controlInterval) {
      return;
    }

    this.controlInterval = setInterval(() => {
      this.controlLoop();
    }, this.CONTROL_PERIOD_MS);

    logger.info('PPC control loop started');
    this.emit('started');
  }

  /**
   * Stop PPC control loop
   */
  stop(): void {
    if (this.controlInterval) {
      clearInterval(this.controlInterval);
      this.controlInterval = null;
    }

    logger.info('PPC control loop stopped');
    this.emit('stopped');
  }

  /**
   * Main control loop
   */
  private controlLoop(): void {
    try {
      // Update ramp controller
      const rampedPower = this.rampController.update();

      // Apply grid code constraints
      this.applyGridCodeConstraints();

      // Voltage regulation
      if (this.state.mode === PPCMode.GRID_SUPPORT) {
        this.voltageRegulation();
      }

      // Frequency regulation
      this.frequencyRegulation();

      // Check for curtailment needs
      this.checkCurtailment();

      // Update state
      this.state.currentPower = rampedPower;
      this.state.lastUpdate = new Date();

      // Calculate power balance
      this.calculatePowerBalance();

      // Emit telemetry
      this.emit('telemetry', {
        state: this.state,
        plant: this.plantOverview
      });
    } catch (error) {
      logger.error('PPC control loop error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Apply grid code specific constraints
   */
  private applyGridCodeConstraints(): void {
    const { constraints, setpoints, gridVoltage, gridFrequency } = this.state;

    // Voltage limits
    if (gridVoltage < constraints.voltageMin || gridVoltage > constraints.voltageMax) {
      this.emit('voltage_violation', {
        voltage: gridVoltage,
        min: constraints.voltageMin,
        max: constraints.voltageMax
      });
    }

    // Frequency limits
    if (gridFrequency < constraints.frequencyMin || gridFrequency > constraints.frequencyMax) {
      this.emit('frequency_violation', {
        frequency: gridFrequency,
        min: constraints.frequencyMin,
        max: constraints.frequencyMax
      });
    }

    // Power factor correction
    if (Math.abs(setpoints.powerFactor) < constraints.powerFactorMin) {
      this.state.setpoints.powerFactor =
        Math.sign(setpoints.powerFactor) * constraints.powerFactorMin;
    }
  }

  /**
   * Voltage regulation using reactive power
   */
  private voltageRegulation(): void {
    const correction = this.voltagePID.compute(
      this.state.setpoints.voltageSetpoint,
      this.state.gridVoltage
    );

    // Adjust reactive power to regulate voltage
    const newReactivePower = Math.max(
      -this.state.setpoints.reactivePowerLimit,
      Math.min(this.state.setpoints.reactivePowerLimit, correction)
    );

    this.state.currentReactivePower = newReactivePower;
  }

  /**
   * Frequency regulation using droop control
   */
  private frequencyRegulation(): void {
    const nominalFrequency = 60; // Hz
    const frequencyDeviation = this.state.gridFrequency - nominalFrequency;
    const droopPercent = this.state.setpoints.frequencyDroop / 100;

    // Droop control: P = Prated * (f_deviation / (f_nominal * droop))
    const powerAdjustment = -this.plantOverview.totalCapacityKW *
      (frequencyDeviation / (nominalFrequency * droopPercent));

    // Apply PID for smoother response
    const pidCorrection = this.frequencyPID.compute(nominalFrequency, this.state.gridFrequency);

    // Combine droop and PID
    const totalCorrection = powerAdjustment * 0.7 + pidCorrection * 0.3;

    // Adjust target power
    const newTarget = this.rampController.getCurrentPower() + totalCorrection;
    this.rampController.setTarget(
      Math.max(0, Math.min(this.state.setpoints.activePowerLimit, newTarget))
    );
  }

  /**
   * Check and apply curtailment
   */
  private checkCurtailment(): void {
    const { maxExportPower } = this.state.constraints;
    const currentPower = this.rampController.getCurrentPower();

    if (currentPower > maxExportPower) {
      this.state.curtailmentActive = true;
      this.state.curtailmentAmount = currentPower - maxExportPower;

      // Force ramp down
      this.rampController.setTarget(maxExportPower);

      this.recordRampEvent({
        timestamp: new Date(),
        triggerType: 'grid',
        rampDirection: 'down',
        rampRateKWMin: this.state.setpoints.rampRateDown,
        targetPowerKW: maxExportPower,
        duration: (currentPower - maxExportPower) / (this.state.setpoints.rampRateDown / 60)
      });

      this.emit('curtailment', {
        amount: this.state.curtailmentAmount,
        reason: 'grid_limit'
      });
    } else {
      this.state.curtailmentActive = false;
      this.state.curtailmentAmount = 0;
    }
  }

  /**
   * Calculate power balance
   */
  private calculatePowerBalance(): void {
    const { currentGenerationKW, currentStorageKW, currentLoadKW } = this.plantOverview;

    const netPower = currentGenerationKW + currentStorageKW - currentLoadKW;

    if (netPower > 0) {
      this.plantOverview.gridExportKW = netPower;
      this.plantOverview.gridImportKW = 0;
    } else {
      this.plantOverview.gridExportKW = 0;
      this.plantOverview.gridImportKW = -netPower;
    }
  }

  /**
   * Record ramp event
   */
  private recordRampEvent(event: RampEvent): void {
    this.rampEvents.push(event);
    if (this.rampEvents.length > this.MAX_RAMP_EVENTS) {
      this.rampEvents.shift();
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Set PPC mode
   */
  setMode(mode: PPCMode): void {
    const oldMode = this.state.mode;
    this.state.mode = mode;

    logger.info(`PPC mode changed: ${oldMode} -> ${mode}`);
    this.emit('modeChanged', { oldMode, newMode: mode });
  }

  /**
   * Set grid code
   */
  setGridCode(gridCode: GridCode): void {
    this.state.gridCode = gridCode;

    // Apply default constraints for grid code
    this.applyGridCodeDefaults(gridCode);

    logger.info(`Grid code set to: ${gridCode}`);
    this.emit('gridCodeChanged', gridCode);
  }

  /**
   * Apply default constraints for grid code
   */
  private applyGridCodeDefaults(gridCode: GridCode): void {
    switch (gridCode) {
      case GridCode.IEEE_1547:
        this.state.constraints.voltageMin = 380;
        this.state.constraints.voltageMax = 420;
        this.state.constraints.frequencyMin = 59.5;
        this.state.constraints.frequencyMax = 60.5;
        break;
      case GridCode.VDE_AR_N_4105:
        this.state.constraints.voltageMin = 360;
        this.state.constraints.voltageMax = 440;
        this.state.constraints.frequencyMin = 47.5;
        this.state.constraints.frequencyMax = 51.5;
        break;
      case GridCode.GRID_CODE_BR:
        this.state.constraints.voltageMin = 380;
        this.state.constraints.voltageMax = 420;
        this.state.constraints.frequencyMin = 59.5;
        this.state.constraints.frequencyMax = 60.5;
        this.state.constraints.powerFactorMin = 0.92;
        break;
    }
  }

  /**
   * Set active power setpoint
   */
  setActivePowerSetpoint(powerKW: number): void {
    const limitedPower = Math.max(0, Math.min(
      this.state.constraints.maxExportPower,
      powerKW
    ));

    this.state.setpoints.activePowerLimit = limitedPower;
    this.rampController.setTarget(limitedPower);

    logger.info(`Active power setpoint: ${limitedPower} kW`);
    this.emit('setpointChanged', { type: 'activePower', value: limitedPower });
  }

  /**
   * Set reactive power setpoint
   */
  setReactivePowerSetpoint(powerKVAr: number): void {
    this.state.setpoints.reactivePowerLimit = powerKVAr;
    logger.info(`Reactive power setpoint: ${powerKVAr} kVAr`);
  }

  /**
   * Set power factor
   */
  setPowerFactor(pf: number): void {
    const limitedPF = Math.max(-1, Math.min(1, pf));
    this.state.setpoints.powerFactor = limitedPF;
    logger.info(`Power factor setpoint: ${limitedPF}`);
  }

  /**
   * Set ramp rates
   */
  setRampRates(rampUpKWMin: number, rampDownKWMin: number): void {
    this.state.setpoints.rampRateUp = rampUpKWMin;
    this.state.setpoints.rampRateDown = rampDownKWMin;
    this.rampController.setRampRates(rampUpKWMin, rampDownKWMin);
    logger.info(`Ramp rates: up=${rampUpKWMin} kW/min, down=${rampDownKWMin} kW/min`);
  }

  /**
   * Set grid constraints
   */
  setGridConstraints(constraints: Partial<GridConstraints>): void {
    this.state.constraints = {
      ...this.state.constraints,
      ...constraints
    };
    logger.info('Grid constraints updated');
  }

  /**
   * Update grid measurements
   */
  updateGridMeasurements(voltage: number, frequency: number): void {
    this.state.gridVoltage = voltage;
    this.state.gridFrequency = frequency;
  }

  /**
   * Update plant measurements
   */
  updatePlantMeasurements(
    solarGenerationKW: number,
    bessChargeKW: number,
    loadKW: number,
    bessSOC: number
  ): void {
    this.plantOverview.currentGenerationKW = solarGenerationKW;
    this.plantOverview.currentStorageKW = -bessChargeKW; // Positive = discharging
    this.plantOverview.currentLoadKW = loadKW;
    this.plantOverview.bessSOC = bessSOC;
    this.plantOverview.solarAvailableKW = solarGenerationKW;
  }

  /**
   * Get current state
   */
  getState(): PPCState {
    return { ...this.state };
  }

  /**
   * Get plant overview
   */
  getPlantOverview(): PlantOverview {
    return { ...this.plantOverview };
  }

  /**
   * Get ramp events
   */
  getRampEvents(limit: number = 100): RampEvent[] {
    return this.rampEvents.slice(-limit);
  }

  /**
   * Emergency stop
   */
  emergencyStop(): void {
    logger.warn('PPC Emergency Stop activated');

    this.state.mode = PPCMode.MANUAL;
    this.rampController.setTarget(0);
    this.state.curtailmentActive = true;

    this.emit('emergencyStop');
  }

  /**
   * Set plant configuration
   */
  setPlantConfiguration(config: Partial<PlantOverview>): void {
    this.plantOverview = {
      ...this.plantOverview,
      ...config
    };
    logger.info('Plant configuration updated');
  }
}

// Export singleton
export const ppcService = PPCService.getInstance();
