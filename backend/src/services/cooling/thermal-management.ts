/**
 * Thermal Management Service
 * Intelligent thermal control for battery cooling systems
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { CoolantMonitor, CoolantStatus, coolantMonitor } from './coolant-monitor.js';
import { PumpController, PumpState, pumpController } from './pump-controller.js';

// ============================================
// TYPES
// ============================================

export interface ThermalZone {
  id: string;
  systemId: string;
  name: string;
  type: ZoneType;
  currentTemperature: number;
  targetTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  priority: ZonePriority;
  sensors: string[];
  actuators: ThermalActuator[];
}

export enum ZoneType {
  BATTERY_PACK = 'battery_pack',
  POWER_ELECTRONICS = 'power_electronics',
  INVERTER = 'inverter',
  TRANSFORMER = 'transformer',
  CABINET = 'cabinet',
  ROOM = 'room',
}

export enum ZonePriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
}

export interface ThermalActuator {
  id: string;
  type: ActuatorType;
  state: 'on' | 'off' | 'modulating';
  output: number;  // 0-100%
  pumpId?: string;
}

export enum ActuatorType {
  PUMP = 'pump',
  VALVE = 'valve',
  FAN = 'fan',
  CHILLER = 'chiller',
  HEATER = 'heater',
}

export interface ThermalControlStrategy {
  id: string;
  name: string;
  mode: ControlMode;
  parameters: ControlParameters;
}

export enum ControlMode {
  TEMPERATURE_SETPOINT = 'temperature_setpoint',
  DELTA_T_CONTROL = 'delta_t_control',
  LOAD_FOLLOWING = 'load_following',
  PREDICTIVE = 'predictive',
  ECONOMY = 'economy',
  PERFORMANCE = 'performance',
}

export interface ControlParameters {
  setpoint?: number;
  deadband?: number;
  kp?: number;  // Proportional gain
  ki?: number;  // Integral gain
  kd?: number;  // Derivative gain
  minOutput?: number;
  maxOutput?: number;
  rampRate?: number;  // °C/min
}

export interface ThermalState {
  systemId: string;
  zones: ThermalZone[];
  coolantStatus: CoolantStatus | null;
  coolingPower: number;  // kW
  efficiency: number;  // %
  mode: ControlMode;
  health: ThermalHealth;
  alerts: ThermalAlert[];
  lastUpdate: Date;
}

export enum ThermalHealth {
  OPTIMAL = 'optimal',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

export interface ThermalAlert {
  id: string;
  zoneId: string;
  type: ThermalAlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

export enum ThermalAlertType {
  HIGH_TEMPERATURE = 'high_temperature',
  LOW_TEMPERATURE = 'low_temperature',
  RAPID_RISE = 'rapid_rise',
  GRADIENT_ALARM = 'gradient_alarm',
  SENSOR_FAULT = 'sensor_fault',
  ACTUATOR_FAULT = 'actuator_fault',
}

// ============================================
// PID CONTROLLER
// ============================================

class PIDController {
  private kp: number;
  private ki: number;
  private kd: number;
  private integral: number = 0;
  private previousError: number = 0;
  private minOutput: number;
  private maxOutput: number;
  private lastTime: number = Date.now();

  constructor(params: ControlParameters) {
    this.kp = params.kp || 1.0;
    this.ki = params.ki || 0.1;
    this.kd = params.kd || 0.05;
    this.minOutput = params.minOutput || 0;
    this.maxOutput = params.maxOutput || 100;
  }

  compute(setpoint: number, currentValue: number): number {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000; // seconds
    this.lastTime = now;

    const error = setpoint - currentValue;

    // Proportional term
    const pTerm = this.kp * error;

    // Integral term (with anti-windup)
    this.integral += error * dt;
    const maxIntegral = (this.maxOutput - this.minOutput) / (2 * this.ki);
    this.integral = Math.max(-maxIntegral, Math.min(maxIntegral, this.integral));
    const iTerm = this.ki * this.integral;

    // Derivative term
    const dTerm = this.kd * (error - this.previousError) / dt;
    this.previousError = error;

    // Calculate output
    let output = pTerm + iTerm + dTerm;
    output = Math.max(this.minOutput, Math.min(this.maxOutput, output));

    return output;
  }

  reset(): void {
    this.integral = 0;
    this.previousError = 0;
    this.lastTime = Date.now();
  }
}

// ============================================
// THERMAL MANAGEMENT SERVICE
// ============================================

export class ThermalManagementService extends EventEmitter {
  private zones: Map<string, ThermalZone> = new Map();
  private strategies: Map<string, ThermalControlStrategy> = new Map();
  private pidControllers: Map<string, PIDController> = new Map();
  private temperatureHistory: Map<string, { timestamp: Date; temp: number }[]> = new Map();
  private alerts: ThermalAlert[] = [];

  private coolantMonitor: CoolantMonitor;
  private pumpController: PumpController;
  private controlInterval: NodeJS.Timeout | null = null;
  private activeMode: ControlMode = ControlMode.TEMPERATURE_SETPOINT;

  constructor(
    coolant?: CoolantMonitor,
    pump?: PumpController
  ) {
    super();
    this.coolantMonitor = coolant || coolantMonitor;
    this.pumpController = pump || pumpController;

    this.initializeDefaultStrategies();
    this.setupEventListeners();
    this.startControlLoop();
  }

  /**
   * Register a thermal zone
   */
  registerZone(zone: ThermalZone): void {
    this.zones.set(zone.id, zone);

    // Create PID controller for zone
    const strategy = this.strategies.get(this.activeMode.toString()) ||
                    this.strategies.get(ControlMode.TEMPERATURE_SETPOINT);
    if (strategy) {
      this.pidControllers.set(zone.id, new PIDController(strategy.parameters));
    }

    logger.info(`Thermal zone registered: ${zone.name} (${zone.id})`);
    this.emit('zoneRegistered', zone);
  }

  /**
   * Update zone temperature
   */
  updateZoneTemperature(zoneId: string, temperature: number): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    const previousTemp = zone.currentTemperature;
    zone.currentTemperature = temperature;

    // Record history
    this.recordTemperatureHistory(zoneId, temperature);

    // Check for rapid temperature rise
    this.checkTemperatureRise(zone, previousTemp, temperature);

    // Check temperature limits
    this.checkTemperatureLimits(zone);

    this.emit('temperatureUpdate', { zoneId, temperature, previousTemp });
  }

  /**
   * Set control mode
   */
  setControlMode(mode: ControlMode): void {
    this.activeMode = mode;

    // Update PID controllers with new strategy parameters
    const strategy = this.strategies.get(mode);
    if (strategy) {
      for (const [zoneId, controller] of this.pidControllers.entries()) {
        this.pidControllers.set(zoneId, new PIDController(strategy.parameters));
      }
    }

    logger.info(`Thermal control mode set to: ${mode}`);
    this.emit('modeChange', mode);
  }

  /**
   * Get thermal state for a system
   */
  getThermalState(systemId: string): ThermalState {
    const zones = Array.from(this.zones.values())
      .filter(z => z.systemId === systemId);

    const coolantStatus = this.coolantMonitor.getStatus(systemId);
    const coolingPower = coolantStatus ? this.coolantMonitor.getCoolingCapacity(systemId) : 0;
    const efficiency = this.calculateSystemEfficiency(systemId);
    const health = this.calculateThermalHealth(zones, coolantStatus);

    return {
      systemId,
      zones,
      coolantStatus: coolantStatus || null,
      coolingPower,
      efficiency,
      mode: this.activeMode,
      health,
      alerts: this.alerts.filter(a =>
        zones.some(z => z.id === a.zoneId)
      ),
      lastUpdate: new Date(),
    };
  }

  /**
   * Get zone temperature history
   */
  getTemperatureHistory(
    zoneId: string,
    periodMinutes: number = 60
  ): { timestamp: Date; temp: number }[] {
    const history = this.temperatureHistory.get(zoneId) || [];
    const cutoff = Date.now() - periodMinutes * 60 * 1000;
    return history.filter(h => h.timestamp.getTime() >= cutoff);
  }

  /**
   * Get thermal map data for visualization
   */
  getThermalMap(systemId: string): {
    zones: { id: string; name: string; temp: number; target: number; health: string }[];
    gradients: { from: string; to: string; deltaT: number }[];
  } {
    const zones = Array.from(this.zones.values())
      .filter(z => z.systemId === systemId)
      .map(z => ({
        id: z.id,
        name: z.name,
        temp: z.currentTemperature,
        target: z.targetTemperature,
        health: this.getZoneHealth(z),
      }));

    // Calculate gradients between adjacent zones
    const gradients: { from: string; to: string; deltaT: number }[] = [];
    for (let i = 0; i < zones.length - 1; i++) {
      gradients.push({
        from: zones[i].id,
        to: zones[i + 1].id,
        deltaT: Math.abs(zones[i].temp - zones[i + 1].temp),
      });
    }

    return { zones, gradients };
  }

  /**
   * Emergency cooling
   */
  async emergencyCooling(systemId: string): Promise<void> {
    logger.warn(`Emergency cooling activated for system: ${systemId}`);

    // Get all pumps for this system
    const pumps = this.pumpController.getSystemPumps(systemId);

    // Start all pumps at maximum speed
    for (const pump of pumps) {
      if (pump.state !== PumpState.RUNNING) {
        await this.pumpController.startPump(pump.pumpId, 'emergency');
      }
      await this.pumpController.setSpeed(pump.pumpId, 100);
    }

    // Set all zones to maximum cooling
    for (const zone of this.zones.values()) {
      if (zone.systemId === systemId) {
        for (const actuator of zone.actuators) {
          actuator.state = 'on';
          actuator.output = 100;
        }
      }
    }

    this.emit('emergencyCooling', { systemId });
  }

  /**
   * Shutdown thermal management
   */
  shutdown(): void {
    if (this.controlInterval) {
      clearInterval(this.controlInterval);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private initializeDefaultStrategies(): void {
    const strategies: ThermalControlStrategy[] = [
      {
        id: 'setpoint',
        name: 'Temperature Setpoint Control',
        mode: ControlMode.TEMPERATURE_SETPOINT,
        parameters: {
          setpoint: 25,
          deadband: 2,
          kp: 2.0,
          ki: 0.1,
          kd: 0.5,
          minOutput: 20,
          maxOutput: 100,
        },
      },
      {
        id: 'delta_t',
        name: 'Delta-T Control',
        mode: ControlMode.DELTA_T_CONTROL,
        parameters: {
          setpoint: 8,  // Target delta T
          deadband: 1,
          kp: 3.0,
          ki: 0.2,
          kd: 0.3,
          minOutput: 30,
          maxOutput: 100,
        },
      },
      {
        id: 'economy',
        name: 'Economy Mode',
        mode: ControlMode.ECONOMY,
        parameters: {
          setpoint: 30,  // Higher temperature allowed
          deadband: 3,
          kp: 1.0,
          ki: 0.05,
          kd: 0.2,
          minOutput: 10,
          maxOutput: 60,
        },
      },
      {
        id: 'performance',
        name: 'Performance Mode',
        mode: ControlMode.PERFORMANCE,
        parameters: {
          setpoint: 20,  // Aggressive cooling
          deadband: 1,
          kp: 4.0,
          ki: 0.3,
          kd: 1.0,
          minOutput: 50,
          maxOutput: 100,
        },
      },
    ];

    for (const strategy of strategies) {
      this.strategies.set(strategy.mode, strategy);
    }
  }

  private setupEventListeners(): void {
    this.coolantMonitor.on('alarm', (alarm) => {
      this.handleCoolantAlarm(alarm);
    });

    this.pumpController.on('pumpFault', ({ pumpId, error }) => {
      this.handlePumpFault(pumpId, error);
    });
  }

  private startControlLoop(): void {
    this.controlInterval = setInterval(() => {
      this.runControlCycle();
    }, 5000);  // Run every 5 seconds
  }

  private runControlCycle(): void {
    for (const zone of this.zones.values()) {
      const pid = this.pidControllers.get(zone.id);
      if (!pid) continue;

      // Calculate control output
      const output = pid.compute(zone.targetTemperature, zone.currentTemperature);

      // Apply output to actuators
      for (const actuator of zone.actuators) {
        this.applyActuatorOutput(actuator, output, zone.priority);
      }
    }
  }

  private async applyActuatorOutput(
    actuator: ThermalActuator,
    output: number,
    priority: ZonePriority
  ): Promise<void> {
    switch (actuator.type) {
      case ActuatorType.PUMP:
        if (actuator.pumpId) {
          // Scale output based on priority
          const scaledOutput = output * (1 + (3 - priority) * 0.1);
          await this.pumpController.setSpeed(actuator.pumpId, Math.min(100, scaledOutput));
        }
        break;

      case ActuatorType.VALVE:
      case ActuatorType.FAN:
        actuator.output = output;
        actuator.state = output > 0 ? 'modulating' : 'off';
        break;

      case ActuatorType.CHILLER:
        // Chillers typically have staged control
        actuator.output = Math.round(output / 25) * 25;  // 0, 25, 50, 75, 100
        actuator.state = actuator.output > 0 ? 'on' : 'off';
        break;
    }
  }

  private recordTemperatureHistory(zoneId: string, temperature: number): void {
    let history = this.temperatureHistory.get(zoneId) || [];
    history.push({ timestamp: new Date(), temp: temperature });

    // Keep last 24 hours of data (at 5-second intervals = ~17280 points)
    const maxHistory = 17280;
    if (history.length > maxHistory) {
      history = history.slice(-maxHistory);
    }

    this.temperatureHistory.set(zoneId, history);
  }

  private checkTemperatureRise(
    zone: ThermalZone,
    previousTemp: number,
    currentTemp: number
  ): void {
    const ratePerMinute = (currentTemp - previousTemp) * 12;  // 5-second sampling

    if (ratePerMinute > 3) {  // More than 3°C/min rise
      this.createAlert(zone.id, ThermalAlertType.RAPID_RISE, 'warning',
        `Rapid temperature rise in ${zone.name}: ${ratePerMinute.toFixed(1)}°C/min`);
    }
  }

  private checkTemperatureLimits(zone: ThermalZone): void {
    if (zone.currentTemperature > zone.maxTemperature) {
      this.createAlert(zone.id, ThermalAlertType.HIGH_TEMPERATURE, 'critical',
        `High temperature in ${zone.name}: ${zone.currentTemperature.toFixed(1)}°C`);
    } else if (zone.currentTemperature < zone.minTemperature) {
      this.createAlert(zone.id, ThermalAlertType.LOW_TEMPERATURE, 'warning',
        `Low temperature in ${zone.name}: ${zone.currentTemperature.toFixed(1)}°C`);
    }
  }

  private createAlert(
    zoneId: string,
    type: ThermalAlertType,
    severity: 'info' | 'warning' | 'critical',
    message: string
  ): void {
    // Prevent duplicate alerts
    const recentSimilar = this.alerts.find(
      a => a.zoneId === zoneId &&
           a.type === type &&
           Date.now() - a.timestamp.getTime() < 60000
    );

    if (recentSimilar) return;

    const alert: ThermalAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      zoneId,
      type,
      severity,
      message,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    if (this.alerts.length > 200) {
      this.alerts.shift();
    }

    logger.warn(`Thermal alert: ${message}`);
    this.emit('alert', alert);
  }

  private handleCoolantAlarm(alarm: unknown): void {
    // Handle coolant-related alarms
    this.emit('coolantAlarm', alarm);
  }

  private handlePumpFault(pumpId: string, error: string): void {
    // Find zones using this pump
    for (const zone of this.zones.values()) {
      const affectedActuator = zone.actuators.find(a => a.pumpId === pumpId);
      if (affectedActuator) {
        this.createAlert(zone.id, ThermalAlertType.ACTUATOR_FAULT, 'critical',
          `Pump fault affecting ${zone.name}: ${error}`);
      }
    }
  }

  private getZoneHealth(zone: ThermalZone): string {
    const deviation = Math.abs(zone.currentTemperature - zone.targetTemperature);
    if (deviation <= 2) return 'optimal';
    if (deviation <= 5) return 'good';
    if (deviation <= 10) return 'fair';
    if (zone.currentTemperature > zone.maxTemperature) return 'critical';
    return 'poor';
  }

  private calculateSystemEfficiency(systemId: string): number {
    const zones = Array.from(this.zones.values())
      .filter(z => z.systemId === systemId);

    if (zones.length === 0) return 0;

    // Average zone efficiency
    let totalEfficiency = 0;
    for (const zone of zones) {
      const deviation = Math.abs(zone.currentTemperature - zone.targetTemperature);
      const zoneEfficiency = Math.max(0, 100 - deviation * 5);
      totalEfficiency += zoneEfficiency;
    }

    return Math.round(totalEfficiency / zones.length);
  }

  private calculateThermalHealth(
    zones: ThermalZone[],
    coolantStatus: CoolantStatus | undefined
  ): ThermalHealth {
    if (zones.length === 0) return ThermalHealth.OPTIMAL;

    let score = 100;

    // Check each zone
    for (const zone of zones) {
      const health = this.getZoneHealth(zone);
      switch (health) {
        case 'critical':
          score -= 30;
          break;
        case 'poor':
          score -= 20;
          break;
        case 'fair':
          score -= 10;
          break;
        case 'good':
          score -= 5;
          break;
      }
    }

    // Factor in coolant health
    if (coolantStatus) {
      switch (coolantStatus.health) {
        case 'critical':
        case 'fault':
          score -= 30;
          break;
        case 'warning':
          score -= 20;
          break;
        case 'degraded':
          score -= 10;
          break;
      }
    }

    if (score >= 90) return ThermalHealth.OPTIMAL;
    if (score >= 70) return ThermalHealth.GOOD;
    if (score >= 50) return ThermalHealth.FAIR;
    if (score >= 30) return ThermalHealth.POOR;
    return ThermalHealth.CRITICAL;
  }
}

export const thermalManagement = new ThermalManagementService(coolantMonitor, pumpController);
