/**
 * Grid Integration Service
 * Manages Solar + BESS + Grid integration for hybrid systems
 */

import { getFirestore, Collections } from '../../config/firebase.js';
import { mqttService } from '../../mqtt/mqtt.service.js';
import { socketService } from '../../websocket/socket.service.js';
import { logger } from '../../utils/logger.js';
import { BessSystem, TelemetryData } from '../../models/types.js';

// ============================================
// TYPES
// ============================================

export interface HybridSystemConfig {
  systemId: string;
  solarCapacity: number; // kWp
  bessCapacity: number; // kWh
  gridConnectionCapacity: number; // kVA
  exportLimit?: number; // kW (null = unlimited)
  importLimit?: number; // kW (null = unlimited)
  meterIds: {
    grid: string;
    solar: string;
    bess: string;
    load: string;
  };
  controlMode: HybridControlMode;
  priorityOrder: EnergySource[];
}

export enum HybridControlMode {
  AUTO = 'auto',
  SELF_CONSUMPTION = 'self_consumption',
  ZERO_EXPORT = 'zero_export',
  TIME_OF_USE = 'time_of_use',
  BACKUP = 'backup',
  ECONOMIC = 'economic',
}

export enum EnergySource {
  SOLAR = 'solar',
  BESS = 'bess',
  GRID = 'grid',
}

export interface PowerFlowStatus {
  timestamp: Date;
  systemId: string;

  // Power measurements (kW)
  solarPower: number;
  bessPower: number; // positive = discharge, negative = charge
  gridPower: number; // positive = import, negative = export
  loadPower: number;

  // Energy today (kWh)
  solarEnergyToday: number;
  gridImportToday: number;
  gridExportToday: number;
  bessChargedToday: number;
  bessDischargedToday: number;
  loadEnergyToday: number;

  // Status
  selfConsumptionRate: number; // %
  solarUtilizationRate: number; // %
  gridDependencyRate: number; // %

  // BESS status
  bessSoc: number;
  bessState: 'charging' | 'discharging' | 'idle' | 'standby';
}

export interface SolarInverterData {
  inverterId: string;
  timestamp: Date;
  power: number; // kW
  voltage: number; // V
  current: number; // A
  frequency: number; // Hz
  dailyEnergy: number; // kWh
  totalEnergy: number; // kWh
  efficiency: number; // %
  temperature: number; // C
  status: 'generating' | 'idle' | 'fault' | 'offline';
  mpptTrackers: MPPTData[];
}

export interface MPPTData {
  id: number;
  voltage: number; // V
  current: number; // A
  power: number; // W
}

export interface GridMeterData {
  meterId: string;
  timestamp: Date;
  activePower: number; // kW (positive = import, negative = export)
  reactivePower: number; // kVAr
  apparentPower: number; // kVA
  powerFactor: number;
  voltage: { a: number; b: number; c: number };
  current: { a: number; b: number; c: number };
  frequency: number;
  importEnergy: number; // kWh
  exportEnergy: number; // kWh
}

export interface DispatchCommand {
  timestamp: Date;
  source: EnergySource;
  action: 'charge' | 'discharge' | 'export' | 'import' | 'curtail' | 'idle';
  power: number; // kW
  reason: string;
}

// ============================================
// GRID INTEGRATION SERVICE
// ============================================

export class GridIntegrationService {
  private db = getFirestore();
  private configs: Map<string, HybridSystemConfig> = new Map();
  private powerFlowStatus: Map<string, PowerFlowStatus> = new Map();
  private controlLoops: Map<string, NodeJS.Timeout> = new Map();
  private dailyCounters: Map<string, {
    solarEnergy: number;
    gridImport: number;
    gridExport: number;
    bessCharged: number;
    bessDischarged: number;
    loadEnergy: number;
    lastReset: Date;
  }> = new Map();

  /**
   * Initialize hybrid system integration
   */
  async initialize(config: HybridSystemConfig): Promise<void> {
    const { systemId } = config;

    // Store configuration
    this.configs.set(systemId, config);
    await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
      hybridConfig: config,
    });

    // Initialize counters
    this.dailyCounters.set(systemId, {
      solarEnergy: 0,
      gridImport: 0,
      gridExport: 0,
      bessCharged: 0,
      bessDischarged: 0,
      loadEnergy: 0,
      lastReset: new Date(),
    });

    // Initialize power flow status
    this.powerFlowStatus.set(systemId, {
      timestamp: new Date(),
      systemId,
      solarPower: 0,
      bessPower: 0,
      gridPower: 0,
      loadPower: 0,
      solarEnergyToday: 0,
      gridImportToday: 0,
      gridExportToday: 0,
      bessChargedToday: 0,
      bessDischargedToday: 0,
      loadEnergyToday: 0,
      selfConsumptionRate: 0,
      solarUtilizationRate: 0,
      gridDependencyRate: 0,
      bessSoc: 0,
      bessState: 'idle',
    });

    // Subscribe to MQTT topics for all meters
    this.subscribeToMeters(systemId, config);

    // Start control loop (100ms for fast response)
    this.startControlLoop(systemId);

    logger.info(`Grid integration initialized for system ${systemId}`);
  }

  /**
   * Subscribe to meter MQTT topics
   */
  private subscribeToMeters(systemId: string, config: HybridSystemConfig): void {
    const { meterIds } = config;

    // Solar inverter data
    mqttService.subscribe(`lifo4/${systemId}/solar/+/data`, (topic, payload) => {
      const data = JSON.parse(payload.toString());
      this.handleSolarData(systemId, data);
    });

    // Grid meter data
    mqttService.subscribe(`lifo4/${systemId}/grid/data`, (topic, payload) => {
      const data = JSON.parse(payload.toString());
      this.handleGridMeterData(systemId, data);
    });

    // Load meter data
    mqttService.subscribe(`lifo4/${systemId}/load/data`, (topic, payload) => {
      const data = JSON.parse(payload.toString());
      this.handleLoadMeterData(systemId, data);
    });
  }

  /**
   * Handle incoming solar inverter data
   */
  private async handleSolarData(systemId: string, data: SolarInverterData): Promise<void> {
    const status = this.powerFlowStatus.get(systemId);
    if (!status) return;

    status.solarPower = data.power;
    status.timestamp = new Date();

    // Update daily counter
    const counters = this.dailyCounters.get(systemId);
    if (counters) {
      this.checkDayReset(systemId, counters);
      counters.solarEnergy += data.power / 3600; // Assuming 1-second interval
    }

    // Store solar telemetry
    await this.db.collection('solar_telemetry').doc(systemId).set({
      ...data,
      updatedAt: new Date(),
    });

    this.updateMetrics(systemId);
  }

  /**
   * Handle incoming grid meter data
   */
  private async handleGridMeterData(systemId: string, data: GridMeterData): Promise<void> {
    const status = this.powerFlowStatus.get(systemId);
    if (!status) return;

    status.gridPower = data.activePower;
    status.timestamp = new Date();

    // Update daily counters
    const counters = this.dailyCounters.get(systemId);
    if (counters) {
      this.checkDayReset(systemId, counters);
      if (data.activePower > 0) {
        counters.gridImport += data.activePower / 3600;
      } else {
        counters.gridExport += Math.abs(data.activePower) / 3600;
      }
    }

    // Store grid telemetry
    await this.db.collection('grid_telemetry').doc(systemId).set({
      ...data,
      updatedAt: new Date(),
    });

    this.updateMetrics(systemId);
  }

  /**
   * Handle incoming load meter data
   */
  private async handleLoadMeterData(systemId: string, data: { power: number }): Promise<void> {
    const status = this.powerFlowStatus.get(systemId);
    if (!status) return;

    status.loadPower = data.power;

    // Update daily counter
    const counters = this.dailyCounters.get(systemId);
    if (counters) {
      counters.loadEnergy += data.power / 3600;
    }

    this.updateMetrics(systemId);
  }

  /**
   * Check and reset daily counters at midnight
   */
  private checkDayReset(systemId: string, counters: typeof this.dailyCounters extends Map<string, infer T> ? T : never): void {
    const now = new Date();
    if (now.getDate() !== counters.lastReset.getDate()) {
      // Store previous day's data
      this.storeDailyHistory(systemId, counters);

      // Reset counters
      counters.solarEnergy = 0;
      counters.gridImport = 0;
      counters.gridExport = 0;
      counters.bessCharged = 0;
      counters.bessDischarged = 0;
      counters.loadEnergy = 0;
      counters.lastReset = now;
    }
  }

  /**
   * Store daily history
   */
  private async storeDailyHistory(systemId: string, counters: any): Promise<void> {
    const date = new Date(counters.lastReset);
    date.setHours(0, 0, 0, 0);

    await this.db.collection('energy_history').add({
      systemId,
      date,
      solarEnergy: counters.solarEnergy,
      gridImport: counters.gridImport,
      gridExport: counters.gridExport,
      bessCharged: counters.bessCharged,
      bessDischarged: counters.bessDischarged,
      loadEnergy: counters.loadEnergy,
      selfConsumptionRate: counters.solarEnergy > 0
        ? ((counters.solarEnergy - counters.gridExport) / counters.solarEnergy) * 100
        : 0,
    });
  }

  /**
   * Update calculated metrics
   */
  private updateMetrics(systemId: string): void {
    const status = this.powerFlowStatus.get(systemId);
    const counters = this.dailyCounters.get(systemId);
    if (!status || !counters) return;

    // Update energy totals
    status.solarEnergyToday = counters.solarEnergy;
    status.gridImportToday = counters.gridImport;
    status.gridExportToday = counters.gridExport;
    status.bessChargedToday = counters.bessCharged;
    status.bessDischargedToday = counters.bessDischarged;
    status.loadEnergyToday = counters.loadEnergy;

    // Calculate rates
    if (status.solarEnergyToday > 0) {
      const selfConsumed = status.solarEnergyToday - status.gridExportToday;
      status.selfConsumptionRate = (selfConsumed / status.solarEnergyToday) * 100;
      status.solarUtilizationRate = (status.solarEnergyToday / (status.loadEnergyToday || 1)) * 100;
    }

    if (status.loadEnergyToday > 0) {
      status.gridDependencyRate = (status.gridImportToday / status.loadEnergyToday) * 100;
    }

    this.powerFlowStatus.set(systemId, status);
  }

  /**
   * Start the main control loop
   */
  private startControlLoop(systemId: string): void {
    // Clear existing loop
    const existing = this.controlLoops.get(systemId);
    if (existing) clearInterval(existing);

    // Run control loop every 100ms for sub-second response
    const loop = setInterval(async () => {
      await this.runControlLoop(systemId);
    }, 100);

    this.controlLoops.set(systemId, loop);
  }

  /**
   * Main control loop - determines optimal power dispatch
   */
  private async runControlLoop(systemId: string): Promise<void> {
    const config = this.configs.get(systemId);
    const status = this.powerFlowStatus.get(systemId);
    if (!config || !status) return;

    try {
      // Get current BESS telemetry
      const bessTelemetry = await this.getBessTelemetry(systemId);
      if (bessTelemetry) {
        status.bessSoc = bessTelemetry.soc;
        status.bessPower = bessTelemetry.power / 1000; // Convert to kW

        if (bessTelemetry.current > 0.1) {
          status.bessState = 'charging';
        } else if (bessTelemetry.current < -0.1) {
          status.bessState = 'discharging';
        } else {
          status.bessState = 'idle';
        }

        // Update daily BESS counters
        const counters = this.dailyCounters.get(systemId);
        if (counters) {
          if (status.bessPower < 0) {
            counters.bessCharged += Math.abs(status.bessPower) / 3600;
          } else {
            counters.bessDischarged += status.bessPower / 3600;
          }
        }
      }

      // Calculate power balance
      const powerBalance = this.calculatePowerBalance(status, config);

      // Determine dispatch commands based on control mode
      const commands = this.determineDispatch(config, status, powerBalance);

      // Execute dispatch commands
      for (const cmd of commands) {
        await this.executeDispatchCommand(systemId, cmd);
      }

      // Broadcast power flow status every 500ms
      const now = Date.now();
      if (now % 500 < 100) {
        this.broadcastPowerFlow(systemId, status);
      }

    } catch (error) {
      logger.error(`Control loop error for system ${systemId}`, { error });
    }
  }

  /**
   * Calculate power balance
   */
  private calculatePowerBalance(status: PowerFlowStatus, config: HybridSystemConfig): {
    surplus: number;
    deficit: number;
    netPower: number;
  } {
    // Net power = Solar - Load (positive = surplus, negative = deficit)
    const netPower = status.solarPower - status.loadPower;

    return {
      surplus: Math.max(0, netPower),
      deficit: Math.max(0, -netPower),
      netPower,
    };
  }

  /**
   * Determine dispatch commands based on control mode
   */
  private determineDispatch(
    config: HybridSystemConfig,
    status: PowerFlowStatus,
    balance: { surplus: number; deficit: number; netPower: number }
  ): DispatchCommand[] {
    const commands: DispatchCommand[] = [];
    const { surplus, deficit, netPower } = balance;

    switch (config.controlMode) {
      case HybridControlMode.SELF_CONSUMPTION:
        // Maximize use of solar, minimize grid exchange
        if (surplus > 0) {
          // Excess solar - charge BESS first
          if (status.bessSoc < 95) {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.BESS,
              action: 'charge',
              power: Math.min(surplus, config.bessCapacity * 0.5), // C/2 max
              reason: 'Storing excess solar in BESS',
            });
          } else if (config.exportLimit === undefined || surplus <= config.exportLimit) {
            // Export to grid if BESS is full
            commands.push({
              timestamp: new Date(),
              source: EnergySource.GRID,
              action: 'export',
              power: surplus,
              reason: 'Exporting excess solar to grid',
            });
          } else {
            // Curtail if export limited and BESS full
            commands.push({
              timestamp: new Date(),
              source: EnergySource.SOLAR,
              action: 'curtail',
              power: surplus - (config.exportLimit || 0),
              reason: 'Curtailing solar due to export limit',
            });
          }
        } else if (deficit > 0) {
          // Need more power - use BESS first
          if (status.bessSoc > 20) {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.BESS,
              action: 'discharge',
              power: Math.min(deficit, config.bessCapacity * 0.5),
              reason: 'Discharging BESS to cover load',
            });
          } else {
            // Import from grid
            commands.push({
              timestamp: new Date(),
              source: EnergySource.GRID,
              action: 'import',
              power: deficit,
              reason: 'Importing from grid - BESS too low',
            });
          }
        }
        break;

      case HybridControlMode.ZERO_EXPORT:
        // Never export to grid
        if (surplus > 0) {
          if (status.bessSoc < 98) {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.BESS,
              action: 'charge',
              power: surplus,
              reason: 'Zero export: storing all excess in BESS',
            });
          } else {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.SOLAR,
              action: 'curtail',
              power: surplus,
              reason: 'Zero export: curtailing solar (BESS full)',
            });
          }
        } else if (deficit > 0) {
          if (status.bessSoc > 15) {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.BESS,
              action: 'discharge',
              power: deficit,
              reason: 'Discharging BESS to cover load',
            });
          } else {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.GRID,
              action: 'import',
              power: deficit,
              reason: 'Importing from grid',
            });
          }
        }
        break;

      case HybridControlMode.BACKUP:
        // Keep BESS at high SOC for backup
        if (status.bessSoc < 80 && surplus > 0) {
          commands.push({
            timestamp: new Date(),
            source: EnergySource.BESS,
            action: 'charge',
            power: surplus,
            reason: 'Charging BESS for backup reserve',
          });
        } else if (surplus > 0) {
          commands.push({
            timestamp: new Date(),
            source: EnergySource.GRID,
            action: 'export',
            power: surplus,
            reason: 'Exporting surplus (backup reserve met)',
          });
        } else if (deficit > 0) {
          // Import from grid to preserve BESS
          commands.push({
            timestamp: new Date(),
            source: EnergySource.GRID,
            action: 'import',
            power: deficit,
            reason: 'Importing from grid to preserve BESS backup',
          });
        }
        break;

      case HybridControlMode.TIME_OF_USE:
        // This would integrate with tariff profiles
        // Simplified implementation
        const hour = new Date().getHours();
        const isPeakHour = hour >= 17 && hour <= 21;

        if (isPeakHour) {
          // Peak hours - use BESS, don't import
          if (deficit > 0 && status.bessSoc > 10) {
            commands.push({
              timestamp: new Date(),
              source: EnergySource.BESS,
              action: 'discharge',
              power: deficit,
              reason: 'Peak hour: using BESS instead of grid',
            });
          }
        } else {
          // Off-peak - charge BESS
          if (status.bessSoc < 90) {
            const chargeRate = Math.min(
              config.bessCapacity * 0.3,
              (config.importLimit || 100) - Math.max(0, deficit)
            );
            if (chargeRate > 0) {
              commands.push({
                timestamp: new Date(),
                source: EnergySource.BESS,
                action: 'charge',
                power: chargeRate,
                reason: 'Off-peak: charging BESS from grid',
              });
            }
          }
        }
        break;

      default:
        // AUTO mode - intelligent dispatch based on all factors
        commands.push(...this.autoModeDispatch(config, status, balance));
    }

    return commands;
  }

  /**
   * Auto mode intelligent dispatch
   */
  private autoModeDispatch(
    config: HybridSystemConfig,
    status: PowerFlowStatus,
    balance: { surplus: number; deficit: number }
  ): DispatchCommand[] {
    const commands: DispatchCommand[] = [];
    const { surplus, deficit } = balance;

    // Follow priority order
    for (const source of config.priorityOrder) {
      if (surplus > 0) {
        // Have excess power
        if (source === EnergySource.BESS && status.bessSoc < 95) {
          const chargeAmount = Math.min(surplus, config.bessCapacity * 0.5);
          commands.push({
            timestamp: new Date(),
            source: EnergySource.BESS,
            action: 'charge',
            power: chargeAmount,
            reason: `Auto: charging BESS (${status.bessSoc.toFixed(1)}% SOC)`,
          });
          break;
        } else if (source === EnergySource.GRID) {
          commands.push({
            timestamp: new Date(),
            source: EnergySource.GRID,
            action: 'export',
            power: surplus,
            reason: 'Auto: exporting to grid',
          });
          break;
        }
      } else if (deficit > 0) {
        // Need more power
        if (source === EnergySource.BESS && status.bessSoc > 20) {
          const dischargeAmount = Math.min(deficit, config.bessCapacity * 0.5);
          commands.push({
            timestamp: new Date(),
            source: EnergySource.BESS,
            action: 'discharge',
            power: dischargeAmount,
            reason: `Auto: discharging BESS (${status.bessSoc.toFixed(1)}% SOC)`,
          });
          break;
        } else if (source === EnergySource.GRID) {
          commands.push({
            timestamp: new Date(),
            source: EnergySource.GRID,
            action: 'import',
            power: deficit,
            reason: 'Auto: importing from grid',
          });
          break;
        }
      }
    }

    return commands;
  }

  /**
   * Execute a dispatch command
   */
  private async executeDispatchCommand(systemId: string, cmd: DispatchCommand): Promise<void> {
    const system = await this.getSystem(systemId);
    if (!system) return;

    let mqttCommand = '';
    let params: Record<string, unknown> = {};

    switch (cmd.source) {
      case EnergySource.BESS:
        if (cmd.action === 'charge') {
          mqttCommand = 'set_charge_power';
          params = { power: cmd.power * 1000 }; // Convert to W
        } else if (cmd.action === 'discharge') {
          mqttCommand = 'set_discharge_power';
          params = { power: cmd.power * 1000 };
        } else if (cmd.action === 'idle') {
          mqttCommand = 'set_idle';
          params = {};
        }
        break;

      case EnergySource.SOLAR:
        if (cmd.action === 'curtail') {
          mqttCommand = 'set_solar_limit';
          params = { limit: (this.configs.get(systemId)?.solarCapacity || 0) - cmd.power };
        }
        break;

      case EnergySource.GRID:
        // Grid actions are typically passive (result of BESS/solar actions)
        // But we can set export/import limits
        if (cmd.action === 'export') {
          mqttCommand = 'set_export_power';
          params = { power: cmd.power * 1000 };
        }
        break;
    }

    if (mqttCommand) {
      const payload = {
        command: mqttCommand,
        params,
        timestamp: Date.now(),
        requestId: `grid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      await mqttService.publish(`${system.mqttTopic}/command`, JSON.stringify(payload));

      logger.debug(`Dispatch executed: ${cmd.source} ${cmd.action} ${cmd.power}kW - ${cmd.reason}`);
    }
  }

  /**
   * Get BESS telemetry
   */
  private async getBessTelemetry(systemId: string): Promise<TelemetryData | null> {
    const doc = await this.db.collection(Collections.TELEMETRY).doc(systemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as TelemetryData;
  }

  /**
   * Get system
   */
  private async getSystem(systemId: string): Promise<BessSystem | null> {
    const doc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as BessSystem;
  }

  /**
   * Broadcast power flow status
   */
  private broadcastPowerFlow(systemId: string, status: PowerFlowStatus): void {
    socketService.broadcastSystemStatus(systemId, {
      type: 'power_flow',
      ...status,
    });
  }

  /**
   * Get current power flow status
   */
  getPowerFlowStatus(systemId: string): PowerFlowStatus | null {
    return this.powerFlowStatus.get(systemId) || null;
  }

  /**
   * Set control mode
   */
  async setControlMode(systemId: string, mode: HybridControlMode): Promise<void> {
    const config = this.configs.get(systemId);
    if (!config) throw new Error('System not configured');

    config.controlMode = mode;
    this.configs.set(systemId, config);

    await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
      'hybridConfig.controlMode': mode,
    });

    logger.info(`Control mode set to ${mode} for system ${systemId}`);
  }

  /**
   * Get energy history
   */
  async getEnergyHistory(
    systemId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const snapshot = await this.db.collection('energy_history')
      .where('systemId', '==', systemId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate(),
    }));
  }

  /**
   * Stop grid integration
   */
  stop(systemId: string): void {
    const loop = this.controlLoops.get(systemId);
    if (loop) {
      clearInterval(loop);
      this.controlLoops.delete(systemId);
    }

    this.configs.delete(systemId);
    this.powerFlowStatus.delete(systemId);
    this.dailyCounters.delete(systemId);

    logger.info(`Grid integration stopped for system ${systemId}`);
  }
}

export const gridIntegrationService = new GridIntegrationService();
