/**
 * Pump Controller Service
 * Controls coolant pumps for liquid cooling systems
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export enum PumpState {
  OFF = 'off',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  FAULT = 'fault',
  MAINTENANCE = 'maintenance',
}

export enum PumpMode {
  MANUAL = 'manual',
  AUTO = 'auto',
  SCHEDULED = 'scheduled',
  EMERGENCY = 'emergency',
}

export interface PumpStatus {
  pumpId: string;
  systemId: string;
  state: PumpState;
  mode: PumpMode;
  speedPercent: number;  // 0-100
  currentRPM: number;
  maxRPM: number;
  powerConsumption: number;  // Watts
  runningHours: number;
  temperature: number;  // Motor temperature
  lastStartTime?: Date;
  lastStopTime?: Date;
  faultCode?: string;
  faultMessage?: string;
}

export interface PumpCommand {
  command: 'start' | 'stop' | 'setSpeed' | 'setMode' | 'reset';
  value?: number | PumpMode;
  reason?: string;
}

export interface PumpConfig {
  pumpId: string;
  systemId: string;
  name: string;
  type: PumpType;
  maxRPM: number;
  ratedPower: number;  // Watts
  minSpeedPercent: number;
  maxSpeedPercent: number;
  startupDelay: number;  // ms
  shutdownDelay: number;  // ms
  redundant: boolean;  // Is this a backup pump?
  primaryPumpId?: string;  // If redundant, which pump is primary
}

export enum PumpType {
  CENTRIFUGAL = 'centrifugal',
  POSITIVE_DISPLACEMENT = 'positive_displacement',
  VARIABLE_FREQUENCY = 'variable_frequency',
}

export interface PumpSchedule {
  enabled: boolean;
  startTime: string;  // HH:mm format
  stopTime: string;
  daysOfWeek: number[];  // 0-6, Sunday = 0
  targetSpeed: number;
}

// ============================================
// PUMP CONTROLLER SERVICE
// ============================================

export class PumpController extends EventEmitter {
  private pumps: Map<string, PumpStatus> = new Map();
  private configs: Map<string, PumpConfig> = new Map();
  private schedules: Map<string, PumpSchedule> = new Map();
  private speedHistory: Map<string, { timestamp: Date; speed: number }[]> = new Map();
  private commandQueue: Map<string, PumpCommand[]> = new Map();

  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startScheduler();
  }

  /**
   * Register a pump
   */
  registerPump(config: PumpConfig): void {
    this.configs.set(config.pumpId, config);

    const status: PumpStatus = {
      pumpId: config.pumpId,
      systemId: config.systemId,
      state: PumpState.OFF,
      mode: PumpMode.MANUAL,
      speedPercent: 0,
      currentRPM: 0,
      maxRPM: config.maxRPM,
      powerConsumption: 0,
      runningHours: 0,
      temperature: 25,
    };

    this.pumps.set(config.pumpId, status);
    logger.info(`Pump registered: ${config.name} (${config.pumpId})`);
    this.emit('pumpRegistered', config);
  }

  /**
   * Get pump status
   */
  getPumpStatus(pumpId: string): PumpStatus | undefined {
    return this.pumps.get(pumpId);
  }

  /**
   * Get all pumps for a system
   */
  getSystemPumps(systemId: string): PumpStatus[] {
    return Array.from(this.pumps.values())
      .filter(p => p.systemId === systemId);
  }

  /**
   * Start pump
   */
  async startPump(pumpId: string, reason?: string): Promise<boolean> {
    const status = this.pumps.get(pumpId);
    const config = this.configs.get(pumpId);

    if (!status || !config) {
      logger.error(`Pump not found: ${pumpId}`);
      return false;
    }

    if (status.state === PumpState.RUNNING) {
      logger.warn(`Pump ${pumpId} is already running`);
      return true;
    }

    if (status.state === PumpState.FAULT) {
      logger.error(`Cannot start pump ${pumpId} - in fault state`);
      return false;
    }

    try {
      // Set starting state
      status.state = PumpState.STARTING;
      this.emit('pumpStateChange', { pumpId, state: PumpState.STARTING, reason });

      // Simulate startup delay
      await this.delay(config.startupDelay);

      // Set running state
      status.state = PumpState.RUNNING;
      status.lastStartTime = new Date();
      status.speedPercent = status.speedPercent || config.minSpeedPercent;
      status.currentRPM = (status.speedPercent / 100) * config.maxRPM;

      logger.info(`Pump started: ${pumpId}, reason: ${reason || 'manual'}`);
      this.emit('pumpStarted', { pumpId, reason });
      this.emit('pumpStateChange', { pumpId, state: PumpState.RUNNING, reason });

      return true;
    } catch (error) {
      status.state = PumpState.FAULT;
      status.faultMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to start pump ${pumpId}`, { error });
      this.emit('pumpFault', { pumpId, error: status.faultMessage });
      return false;
    }
  }

  /**
   * Stop pump
   */
  async stopPump(pumpId: string, reason?: string): Promise<boolean> {
    const status = this.pumps.get(pumpId);
    const config = this.configs.get(pumpId);

    if (!status || !config) {
      logger.error(`Pump not found: ${pumpId}`);
      return false;
    }

    if (status.state === PumpState.OFF) {
      logger.warn(`Pump ${pumpId} is already stopped`);
      return true;
    }

    try {
      // Set stopping state
      status.state = PumpState.STOPPING;
      this.emit('pumpStateChange', { pumpId, state: PumpState.STOPPING, reason });

      // Ramp down speed
      while (status.speedPercent > 0) {
        status.speedPercent = Math.max(0, status.speedPercent - 10);
        status.currentRPM = (status.speedPercent / 100) * config.maxRPM;
        await this.delay(100);
      }

      // Simulate shutdown delay
      await this.delay(config.shutdownDelay);

      // Set off state
      status.state = PumpState.OFF;
      status.lastStopTime = new Date();
      status.powerConsumption = 0;

      logger.info(`Pump stopped: ${pumpId}, reason: ${reason || 'manual'}`);
      this.emit('pumpStopped', { pumpId, reason });
      this.emit('pumpStateChange', { pumpId, state: PumpState.OFF, reason });

      return true;
    } catch (error) {
      status.state = PumpState.FAULT;
      status.faultMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to stop pump ${pumpId}`, { error });
      this.emit('pumpFault', { pumpId, error: status.faultMessage });
      return false;
    }
  }

  /**
   * Set pump speed
   */
  async setSpeed(pumpId: string, speedPercent: number): Promise<boolean> {
    const status = this.pumps.get(pumpId);
    const config = this.configs.get(pumpId);

    if (!status || !config) {
      logger.error(`Pump not found: ${pumpId}`);
      return false;
    }

    // Clamp speed to configured limits
    speedPercent = Math.max(config.minSpeedPercent, Math.min(config.maxSpeedPercent, speedPercent));

    // If pump is off, start it first
    if (status.state === PumpState.OFF && speedPercent > 0) {
      await this.startPump(pumpId, 'speed_command');
    }

    // If setting speed to 0, stop the pump
    if (speedPercent === 0) {
      return this.stopPump(pumpId, 'speed_zero');
    }

    // Update speed
    status.speedPercent = speedPercent;
    status.currentRPM = (speedPercent / 100) * config.maxRPM;
    status.powerConsumption = this.calculatePowerConsumption(config, speedPercent);

    // Record history
    this.recordSpeedHistory(pumpId, speedPercent);

    logger.debug(`Pump ${pumpId} speed set to ${speedPercent}%`);
    this.emit('pumpSpeedChange', { pumpId, speedPercent, rpm: status.currentRPM });

    return true;
  }

  /**
   * Set pump mode
   */
  setMode(pumpId: string, mode: PumpMode): boolean {
    const status = this.pumps.get(pumpId);
    if (!status) {
      logger.error(`Pump not found: ${pumpId}`);
      return false;
    }

    const previousMode = status.mode;
    status.mode = mode;

    logger.info(`Pump ${pumpId} mode changed: ${previousMode} -> ${mode}`);
    this.emit('pumpModeChange', { pumpId, previousMode, newMode: mode });

    return true;
  }

  /**
   * Reset pump fault
   */
  async resetFault(pumpId: string): Promise<boolean> {
    const status = this.pumps.get(pumpId);
    if (!status) {
      logger.error(`Pump not found: ${pumpId}`);
      return false;
    }

    if (status.state !== PumpState.FAULT) {
      logger.warn(`Pump ${pumpId} is not in fault state`);
      return true;
    }

    status.state = PumpState.OFF;
    status.faultCode = undefined;
    status.faultMessage = undefined;

    logger.info(`Pump ${pumpId} fault reset`);
    this.emit('pumpFaultReset', { pumpId });

    return true;
  }

  /**
   * Set pump schedule
   */
  setSchedule(pumpId: string, schedule: PumpSchedule): void {
    this.schedules.set(pumpId, schedule);
    logger.info(`Pump ${pumpId} schedule set: ${schedule.startTime} - ${schedule.stopTime}`);
    this.emit('scheduleSet', { pumpId, schedule });
  }

  /**
   * Get pump schedule
   */
  getSchedule(pumpId: string): PumpSchedule | undefined {
    return this.schedules.get(pumpId);
  }

  /**
   * Enable failover to redundant pump
   */
  async failoverToRedundant(pumpId: string): Promise<boolean> {
    const config = this.configs.get(pumpId);
    if (!config || !config.redundant) {
      logger.error(`No redundant pump available for ${pumpId}`);
      return false;
    }

    // Find the primary pump and its redundant
    const allConfigs = Array.from(this.configs.values());
    const redundantConfig = allConfigs.find(
      c => c.primaryPumpId === pumpId || (config.primaryPumpId && c.pumpId === config.primaryPumpId)
    );

    if (!redundantConfig) {
      logger.error(`Redundant pump configuration not found for ${pumpId}`);
      return false;
    }

    const primaryPumpId = config.primaryPumpId || pumpId;
    const backupPumpId = config.primaryPumpId ? pumpId : redundantConfig.pumpId;

    // Stop primary
    await this.stopPump(primaryPumpId, 'failover');

    // Start backup
    const success = await this.startPump(backupPumpId, 'failover');

    if (success) {
      // Match speed of primary
      const primaryStatus = this.pumps.get(primaryPumpId);
      if (primaryStatus) {
        await this.setSpeed(backupPumpId, primaryStatus.speedPercent);
      }

      logger.info(`Failover successful: ${primaryPumpId} -> ${backupPumpId}`);
      this.emit('failover', { primaryPumpId, backupPumpId });
    }

    return success;
  }

  /**
   * Get pump efficiency
   */
  getEfficiency(pumpId: string): number {
    const status = this.pumps.get(pumpId);
    const config = this.configs.get(pumpId);

    if (!status || !config || status.state !== PumpState.RUNNING) {
      return 0;
    }

    // Simplified efficiency calculation based on operating point
    // Centrifugal pumps are most efficient at 70-85% of rated speed
    const optimalSpeed = 77.5; // Middle of optimal range
    const speedDeviation = Math.abs(status.speedPercent - optimalSpeed);
    const efficiency = Math.max(50, 95 - speedDeviation * 0.5);

    return Math.round(efficiency * 10) / 10;
  }

  /**
   * Calculate power consumption
   */
  private calculatePowerConsumption(config: PumpConfig, speedPercent: number): number {
    // Power is proportional to cube of speed (affinity laws)
    const speedRatio = speedPercent / 100;
    return config.ratedPower * Math.pow(speedRatio, 3);
  }

  /**
   * Record speed history
   */
  private recordSpeedHistory(pumpId: string, speed: number): void {
    let history = this.speedHistory.get(pumpId) || [];
    history.push({ timestamp: new Date(), speed });
    if (history.length > 1000) {
      history = history.slice(-1000);
    }
    this.speedHistory.set(pumpId, history);
  }

  /**
   * Get speed history
   */
  getSpeedHistory(pumpId: string, limit: number = 100): { timestamp: Date; speed: number }[] {
    const history = this.speedHistory.get(pumpId) || [];
    return history.slice(-limit);
  }

  /**
   * Start scheduler for scheduled operations
   */
  private startScheduler(): void {
    this.schedulerInterval = setInterval(() => {
      this.checkSchedules();
    }, 60000); // Check every minute
  }

  /**
   * Check and execute schedules
   */
  private checkSchedules(): void {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();

    for (const [pumpId, schedule] of this.schedules.entries()) {
      if (!schedule.enabled) continue;
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      const status = this.pumps.get(pumpId);
      if (!status || status.mode !== PumpMode.SCHEDULED) continue;

      if (currentTime === schedule.startTime && status.state === PumpState.OFF) {
        this.startPump(pumpId, 'scheduled');
        this.setSpeed(pumpId, schedule.targetSpeed);
      } else if (currentTime === schedule.stopTime && status.state === PumpState.RUNNING) {
        this.stopPump(pumpId, 'scheduled');
      }
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown controller
   */
  shutdown(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
  }
}

export const pumpController = new PumpController();
