/**
 * Black Start Service
 * Enables BESS to restore power after grid outage
 */

import { getFirestore, Collections } from '../../config/firebase.js';
import { mqttService } from '../../mqtt/mqtt.service.js';
import { socketService } from '../../websocket/socket.service.js';
import { logger } from '../../utils/logger.js';
import { BessSystem, TelemetryData } from '../../models/types.js';

// ============================================
// TYPES
// ============================================

export enum BlackStartState {
  STANDBY = 'standby',              // Normal operation, monitoring grid
  GRID_LOSS_DETECTED = 'grid_loss', // Grid outage detected
  ISLANDING = 'islanding',          // Transitioning to island mode
  ISLAND_MODE = 'island_mode',      // Operating independently
  GRID_SYNC = 'grid_sync',          // Synchronizing with restored grid
  RECONNECTING = 'reconnecting',    // Reconnecting to grid
  RESTORED = 'restored',            // Normal grid operation restored
}

export enum LoadPriority {
  CRITICAL = 1,     // Life safety, essential controls
  HIGH = 2,         // Important equipment
  MEDIUM = 3,       // Normal operations
  LOW = 4,          // Non-essential
  DEFERRABLE = 5,   // Can wait
}

export interface CriticalLoad {
  id: string;
  name: string;
  power: number; // kW
  priority: LoadPriority;
  minRuntime: number; // minutes
  canShed: boolean;
  contactorId?: string;
}

export interface BlackStartConfig {
  systemId: string;
  enabled: boolean;
  gridLossDetectionTime: number; // ms to confirm grid loss
  transferTime: number; // ms to switch to island mode
  minSocForBlackStart: number; // Minimum SOC to initiate black start
  resyncVoltageWindow: number; // % voltage match required
  resyncFrequencyWindow: number; // Hz frequency match required
  resyncPhaseWindow: number; // degrees phase match required
  criticalLoads: CriticalLoad[];
  loadSheddingEnabled: boolean;
  autoReconnect: boolean;
}

export interface GridStatus {
  timestamp: Date;
  isAvailable: boolean;
  voltage: number; // V
  frequency: number; // Hz
  phase: number; // degrees
  quality: 'good' | 'degraded' | 'poor' | 'lost';
  lastOutage?: Date;
  outageCount24h: number;
}

export interface BlackStartEvent {
  id: string;
  systemId: string;
  startTime: Date;
  endTime?: Date;
  state: BlackStartState;
  triggeredBy: 'automatic' | 'manual';
  cause: string;
  loadsShed: string[];
  peakPower: number;
  totalEnergy: number;
  success: boolean;
  notes?: string;
}

export interface IslandStatus {
  systemId: string;
  state: BlackStartState;
  duration: number; // seconds
  currentLoad: number; // kW
  availablePower: number; // kW
  remainingEnergy: number; // kWh
  estimatedRuntime: number; // minutes at current load
  activeLoads: string[];
  shedLoads: string[];
  gridStatus: GridStatus;
}

// ============================================
// BLACK START SERVICE
// ============================================

export class BlackStartService {
  private db = getFirestore();
  private activeIslands: Map<string, IslandStatus> = new Map();
  private configs: Map<string, BlackStartConfig> = new Map();
  private gridMonitors: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize black start capability for a system
   */
  async initialize(config: BlackStartConfig): Promise<void> {
    const { systemId } = config;

    // Store configuration
    this.configs.set(systemId, config);
    await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
      blackStartConfig: config,
    });

    // Start grid monitoring
    this.startGridMonitoring(systemId);

    // Initialize island status
    this.activeIslands.set(systemId, {
      systemId,
      state: BlackStartState.STANDBY,
      duration: 0,
      currentLoad: 0,
      availablePower: 0,
      remainingEnergy: 0,
      estimatedRuntime: 0,
      activeLoads: [],
      shedLoads: [],
      gridStatus: {
        timestamp: new Date(),
        isAvailable: true,
        voltage: 220,
        frequency: 60,
        phase: 0,
        quality: 'good',
        outageCount24h: 0,
      },
    });

    logger.info(`Black start initialized for system ${systemId}`);
  }

  /**
   * Start continuous grid monitoring
   */
  private startGridMonitoring(systemId: string): void {
    // Clear existing monitor
    const existing = this.gridMonitors.get(systemId);
    if (existing) clearInterval(existing);

    // Monitor grid every 100ms for fast detection
    const monitor = setInterval(() => {
      this.checkGridStatus(systemId);
    }, 100);

    this.gridMonitors.set(systemId, monitor);
  }

  /**
   * Check grid status and trigger black start if needed
   */
  private async checkGridStatus(systemId: string): Promise<void> {
    const config = this.configs.get(systemId);
    const islandStatus = this.activeIslands.get(systemId);
    if (!config || !islandStatus) return;

    // Get grid measurements (would come from grid meter via MQTT)
    const gridStatus = await this.measureGridStatus(systemId);
    islandStatus.gridStatus = gridStatus;

    // State machine
    switch (islandStatus.state) {
      case BlackStartState.STANDBY:
        if (!gridStatus.isAvailable) {
          // Grid loss detected - start timer
          islandStatus.state = BlackStartState.GRID_LOSS_DETECTED;
          logger.warn(`Grid loss detected for system ${systemId}`);
        }
        break;

      case BlackStartState.GRID_LOSS_DETECTED:
        if (gridStatus.isAvailable) {
          // Grid restored - false alarm
          islandStatus.state = BlackStartState.STANDBY;
          logger.info(`Grid restored (false alarm) for system ${systemId}`);
        } else {
          // Confirm grid loss and initiate black start
          await this.initiateBlackStart(systemId, 'Grid loss confirmed');
        }
        break;

      case BlackStartState.ISLAND_MODE:
        // Update runtime and check for grid restoration
        islandStatus.duration += 0.1; // seconds
        await this.updateIslandOperation(systemId);

        if (gridStatus.isAvailable && config.autoReconnect) {
          await this.initiateGridSync(systemId);
        }
        break;

      case BlackStartState.GRID_SYNC:
        // Check sync conditions
        await this.checkSyncConditions(systemId);
        break;
    }

    this.activeIslands.set(systemId, islandStatus);
  }

  /**
   * Measure grid status from meters
   */
  private async measureGridStatus(systemId: string): Promise<GridStatus> {
    // In production, this reads from grid meter via Modbus/MQTT
    // Simulating grid status for now
    const doc = await this.db.collection('grid_status').doc(systemId).get();
    const data = doc.exists ? doc.data() : null;

    return {
      timestamp: new Date(),
      isAvailable: data?.isAvailable ?? true,
      voltage: data?.voltage ?? 220,
      frequency: data?.frequency ?? 60,
      phase: data?.phase ?? 0,
      quality: data?.quality ?? 'good',
      outageCount24h: data?.outageCount24h ?? 0,
    };
  }

  /**
   * Initiate black start sequence
   */
  async initiateBlackStart(systemId: string, cause: string): Promise<void> {
    const config = this.configs.get(systemId);
    const islandStatus = this.activeIslands.get(systemId);
    if (!config || !islandStatus) return;

    // Check minimum SOC
    const telemetry = await this.getCurrentTelemetry(systemId);
    if (!telemetry || telemetry.soc < config.minSocForBlackStart) {
      logger.error(`Black start aborted: SOC ${telemetry?.soc}% below minimum ${config.minSocForBlackStart}%`);
      await this.createAlert(systemId, 'critical', 'Black Start Aborted',
        `SOC insuficiente para black start: ${telemetry?.soc}%`);
      return;
    }

    logger.warn(`Initiating black start for system ${systemId}: ${cause}`);

    // Update state
    islandStatus.state = BlackStartState.ISLANDING;

    // Create event record
    const event: Omit<BlackStartEvent, 'id'> = {
      systemId,
      startTime: new Date(),
      state: BlackStartState.ISLANDING,
      triggeredBy: 'automatic',
      cause,
      loadsShed: [],
      peakPower: 0,
      totalEnergy: 0,
      success: false,
    };

    const eventRef = await this.db.collection('blackstart_events').add(event);

    // Execute black start sequence
    await this.executeBlackStartSequence(systemId, eventRef.id, config, telemetry);
  }

  /**
   * Execute the black start sequence
   */
  private async executeBlackStartSequence(
    systemId: string,
    eventId: string,
    config: BlackStartConfig,
    telemetry: TelemetryData
  ): Promise<void> {
    const islandStatus = this.activeIslands.get(systemId)!;

    try {
      // Step 1: Open grid breaker
      await this.sendCommand(systemId, 'open_grid_breaker', {});
      logger.info(`Grid breaker opened for system ${systemId}`);

      // Step 2: Configure inverter for island mode
      await this.sendCommand(systemId, 'set_island_mode', {
        voltage: 220,
        frequency: 60,
        rampRate: 10, // V/s
      });

      // Step 3: Load shedding based on priority
      const { activeLoads, shedLoads } = await this.performLoadShedding(
        systemId,
        config.criticalLoads,
        telemetry
      );

      islandStatus.activeLoads = activeLoads;
      islandStatus.shedLoads = shedLoads;

      // Step 4: Energize critical loads sequentially
      await this.energizeLoadsSequentially(systemId, config.criticalLoads, activeLoads);

      // Step 5: Update state to island mode
      islandStatus.state = BlackStartState.ISLAND_MODE;
      islandStatus.duration = 0;

      // Calculate available power
      const system = await this.getSystem(systemId);
      if (system) {
        islandStatus.availablePower = system.batterySpec.maxDischargeCurrent *
          system.batterySpec.nominalVoltage / 1000;
        islandStatus.remainingEnergy = (telemetry.soc / 100) * system.batterySpec.energyCapacity;
      }

      // Update event
      await this.db.collection('blackstart_events').doc(eventId).update({
        state: BlackStartState.ISLAND_MODE,
        loadsShed: shedLoads,
      });

      // Broadcast status
      this.broadcastIslandStatus(systemId, islandStatus);

      // Create alert
      await this.createAlert(systemId, 'high', 'Black Start Ativado',
        `Sistema operando em modo ilha. Cargas ativas: ${activeLoads.length}, Cargas desligadas: ${shedLoads.length}`);

      logger.info(`Black start complete for system ${systemId} - Island mode active`);

    } catch (error) {
      logger.error(`Black start sequence failed for system ${systemId}`, { error });
      islandStatus.state = BlackStartState.STANDBY;

      await this.createAlert(systemId, 'critical', 'Black Start Falhou',
        `Falha na sequência de black start: ${error}`);
    }
  }

  /**
   * Perform intelligent load shedding based on SOC and priority
   */
  private async performLoadShedding(
    systemId: string,
    loads: CriticalLoad[],
    telemetry: TelemetryData
  ): Promise<{ activeLoads: string[]; shedLoads: string[] }> {
    const activeLoads: string[] = [];
    const shedLoads: string[] = [];

    // Sort loads by priority
    const sortedLoads = [...loads].sort((a, b) => a.priority - b.priority);

    // Get available power based on SOC
    const system = await this.getSystem(systemId);
    if (!system) {
      return { activeLoads: [], shedLoads: loads.map(l => l.id) };
    }

    const availableEnergy = (telemetry.soc / 100) * system.batterySpec.energyCapacity;
    const maxPower = system.batterySpec.maxDischargeCurrent * system.batterySpec.nominalVoltage / 1000;

    // Calculate minimum runtime needed (in hours)
    const minRuntimeHours = Math.max(...loads.map(l => l.minRuntime)) / 60;

    // Available power considering runtime
    let availablePower = Math.min(maxPower, availableEnergy / minRuntimeHours);
    let currentPower = 0;

    for (const load of sortedLoads) {
      if (currentPower + load.power <= availablePower) {
        activeLoads.push(load.id);
        currentPower += load.power;
      } else if (load.canShed) {
        shedLoads.push(load.id);
        // Send shed command
        if (load.contactorId) {
          await this.sendCommand(systemId, 'control_contactor', {
            contactorId: load.contactorId,
            state: 'open',
          });
        }
      } else {
        // Critical load that can't be shed - must include
        activeLoads.push(load.id);
        currentPower += load.power;
        // Shed lower priority loads if needed
        while (currentPower > availablePower && shedLoads.length < sortedLoads.length) {
          const lowestPriority = sortedLoads
            .filter(l => activeLoads.includes(l.id) && l.canShed)
            .pop();
          if (lowestPriority) {
            activeLoads.splice(activeLoads.indexOf(lowestPriority.id), 1);
            shedLoads.push(lowestPriority.id);
            currentPower -= lowestPriority.power;
          } else {
            break;
          }
        }
      }
    }

    logger.info(`Load shedding complete: ${activeLoads.length} active, ${shedLoads.length} shed`);

    return { activeLoads, shedLoads };
  }

  /**
   * Energize loads sequentially to avoid inrush current issues
   */
  private async energizeLoadsSequentially(
    systemId: string,
    allLoads: CriticalLoad[],
    activeLoadIds: string[]
  ): Promise<void> {
    const activeLoads = allLoads.filter(l => activeLoadIds.includes(l.id));

    for (const load of activeLoads) {
      if (load.contactorId) {
        await this.sendCommand(systemId, 'control_contactor', {
          contactorId: load.contactorId,
          state: 'close',
        });

        // Wait for inrush to settle
        await new Promise(resolve => setTimeout(resolve, 500));

        logger.debug(`Load ${load.name} energized`);
      }
    }
  }

  /**
   * Update island operation status
   */
  private async updateIslandOperation(systemId: string): Promise<void> {
    const islandStatus = this.activeIslands.get(systemId);
    if (!islandStatus) return;

    const telemetry = await this.getCurrentTelemetry(systemId);
    if (!telemetry) return;

    const system = await this.getSystem(systemId);
    if (!system) return;

    // Update metrics
    islandStatus.currentLoad = Math.abs(telemetry.power) / 1000; // kW
    islandStatus.remainingEnergy = (telemetry.soc / 100) * system.batterySpec.energyCapacity;
    islandStatus.estimatedRuntime = islandStatus.currentLoad > 0
      ? (islandStatus.remainingEnergy / islandStatus.currentLoad) * 60 // minutes
      : 999;

    // Check for low SOC warning
    const config = this.configs.get(systemId);
    if (telemetry.soc < 20) {
      await this.createAlert(systemId, 'high', 'SOC Baixo em Modo Ilha',
        `SOC em ${telemetry.soc}%. Tempo estimado: ${islandStatus.estimatedRuntime.toFixed(0)} minutos`);

      // Consider additional load shedding
      if (config?.loadSheddingEnabled) {
        await this.performEmergencyLoadShedding(systemId);
      }
    }

    // Broadcast every 5 seconds
    if (Math.floor(islandStatus.duration) % 5 === 0) {
      this.broadcastIslandStatus(systemId, islandStatus);
    }
  }

  /**
   * Emergency load shedding when SOC is critically low
   */
  private async performEmergencyLoadShedding(systemId: string): Promise<void> {
    const config = this.configs.get(systemId);
    const islandStatus = this.activeIslands.get(systemId);
    if (!config || !islandStatus) return;

    // Shed lowest priority active loads
    const activeLoads = config.criticalLoads.filter(l =>
      islandStatus.activeLoads.includes(l.id) && l.canShed
    );

    const lowestPriority = activeLoads.sort((a, b) => b.priority - a.priority)[0];
    if (lowestPriority?.contactorId) {
      await this.sendCommand(systemId, 'control_contactor', {
        contactorId: lowestPriority.contactorId,
        state: 'open',
      });

      islandStatus.activeLoads = islandStatus.activeLoads.filter(id => id !== lowestPriority.id);
      islandStatus.shedLoads.push(lowestPriority.id);

      logger.warn(`Emergency load shed: ${lowestPriority.name}`);
    }
  }

  /**
   * Initiate grid synchronization
   */
  private async initiateGridSync(systemId: string): Promise<void> {
    const islandStatus = this.activeIslands.get(systemId);
    if (!islandStatus) return;

    islandStatus.state = BlackStartState.GRID_SYNC;

    logger.info(`Initiating grid sync for system ${systemId}`);

    // Configure inverter for grid sync
    await this.sendCommand(systemId, 'start_grid_sync', {
      targetVoltage: islandStatus.gridStatus.voltage,
      targetFrequency: islandStatus.gridStatus.frequency,
    });
  }

  /**
   * Check if sync conditions are met
   */
  private async checkSyncConditions(systemId: string): Promise<void> {
    const config = this.configs.get(systemId);
    const islandStatus = this.activeIslands.get(systemId);
    if (!config || !islandStatus) return;

    const gridStatus = islandStatus.gridStatus;

    // Get inverter output measurements
    const inverterStatus = await this.getInverterStatus(systemId);
    if (!inverterStatus) return;

    // Check voltage match
    const voltageMatch = Math.abs(inverterStatus.voltage - gridStatus.voltage) / gridStatus.voltage * 100
      < config.resyncVoltageWindow;

    // Check frequency match
    const freqMatch = Math.abs(inverterStatus.frequency - gridStatus.frequency)
      < config.resyncFrequencyWindow;

    // Check phase match
    const phaseMatch = Math.abs(inverterStatus.phase - gridStatus.phase)
      < config.resyncPhaseWindow;

    if (voltageMatch && freqMatch && phaseMatch) {
      await this.reconnectToGrid(systemId);
    } else {
      logger.debug(`Sync conditions not met: V=${voltageMatch}, F=${freqMatch}, P=${phaseMatch}`);
    }
  }

  /**
   * Reconnect to grid
   */
  private async reconnectToGrid(systemId: string): Promise<void> {
    const islandStatus = this.activeIslands.get(systemId);
    const config = this.configs.get(systemId);
    if (!islandStatus || !config) return;

    islandStatus.state = BlackStartState.RECONNECTING;

    try {
      // Close grid breaker
      await this.sendCommand(systemId, 'close_grid_breaker', {});

      // Wait for settling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Switch inverter to grid-tied mode
      await this.sendCommand(systemId, 'set_grid_tied_mode', {});

      // Restore shed loads
      for (const loadId of islandStatus.shedLoads) {
        const load = config.criticalLoads.find(l => l.id === loadId);
        if (load?.contactorId) {
          await this.sendCommand(systemId, 'control_contactor', {
            contactorId: load.contactorId,
            state: 'close',
          });
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Update state
      islandStatus.state = BlackStartState.RESTORED;
      islandStatus.shedLoads = [];
      islandStatus.activeLoads = config.criticalLoads.map(l => l.id);

      // Update event
      const eventQuery = await this.db.collection('blackstart_events')
        .where('systemId', '==', systemId)
        .orderBy('startTime', 'desc')
        .limit(1)
        .get();

      if (!eventQuery.empty) {
        await eventQuery.docs[0].ref.update({
          endTime: new Date(),
          state: BlackStartState.RESTORED,
          success: true,
        });
      }

      await this.createAlert(systemId, 'medium', 'Rede Restaurada',
        `Sistema reconectado à rede após ${islandStatus.duration.toFixed(0)} segundos em modo ilha`);

      logger.info(`Grid reconnection complete for system ${systemId}`);

      // Reset to standby after delay
      setTimeout(() => {
        if (islandStatus.state === BlackStartState.RESTORED) {
          islandStatus.state = BlackStartState.STANDBY;
          islandStatus.duration = 0;
        }
      }, 5000);

    } catch (error) {
      logger.error(`Grid reconnection failed for system ${systemId}`, { error });
      islandStatus.state = BlackStartState.ISLAND_MODE;

      await this.createAlert(systemId, 'critical', 'Reconexao Falhou',
        `Falha ao reconectar a rede: ${error}`);
    }
  }

  /**
   * Manual black start trigger
   */
  async triggerManualBlackStart(systemId: string, userId: string): Promise<void> {
    logger.info(`Manual black start triggered by ${userId} for system ${systemId}`);
    await this.initiateBlackStart(systemId, `Manual trigger by ${userId}`);
  }

  /**
   * Manual grid reconnection
   */
  async triggerManualReconnect(systemId: string, userId: string): Promise<void> {
    const islandStatus = this.activeIslands.get(systemId);
    if (islandStatus?.state === BlackStartState.ISLAND_MODE) {
      logger.info(`Manual reconnect triggered by ${userId} for system ${systemId}`);
      await this.initiateGridSync(systemId);
    }
  }

  /**
   * Get current island status
   */
  getIslandStatus(systemId: string): IslandStatus | null {
    return this.activeIslands.get(systemId) || null;
  }

  /**
   * Get black start history
   */
  async getBlackStartHistory(systemId: string, limit = 50): Promise<BlackStartEvent[]> {
    const snapshot = await this.db.collection('blackstart_events')
      .where('systemId', '==', systemId)
      .orderBy('startTime', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate(),
      endTime: doc.data().endTime?.toDate(),
    })) as BlackStartEvent[];
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

  private async getInverterStatus(systemId: string): Promise<{
    voltage: number;
    frequency: number;
    phase: number;
  } | null> {
    // Would read from inverter via Modbus/MQTT
    // Simulating for now
    return {
      voltage: 220,
      frequency: 60,
      phase: 0,
    };
  }

  private async sendCommand(systemId: string, command: string, params: Record<string, unknown>): Promise<void> {
    const system = await this.getSystem(systemId);
    if (!system) throw new Error('System not found');

    const payload = {
      command,
      params,
      timestamp: Date.now(),
      requestId: `bs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    await mqttService.publish(`${system.mqttTopic}/command`, JSON.stringify(payload));
  }

  private async createAlert(systemId: string, severity: string, title: string, message: string): Promise<void> {
    const system = await this.getSystem(systemId);
    if (!system) return;

    await this.db.collection(Collections.ALERTS).add({
      systemId,
      organizationId: system.organizationId,
      type: 'blackstart',
      severity,
      title,
      message,
      isRead: false,
      isAcknowledged: false,
      createdAt: new Date(),
    });

    socketService.broadcastAlert({
      id: '',
      systemId,
      organizationId: system.organizationId,
      type: 'blackstart',
      severity: severity as any,
      title,
      message,
      isRead: false,
      isAcknowledged: false,
      createdAt: new Date(),
    });
  }

  private broadcastIslandStatus(systemId: string, status: IslandStatus): void {
    socketService.broadcastSystemStatus(systemId, {
      type: 'island_status',
      ...status,
    });
  }

  /**
   * Stop black start monitoring
   */
  stop(systemId: string): void {
    const monitor = this.gridMonitors.get(systemId);
    if (monitor) {
      clearInterval(monitor);
      this.gridMonitors.delete(systemId);
    }
    this.activeIslands.delete(systemId);
    this.configs.delete(systemId);

    logger.info(`Black start stopped for system ${systemId}`);
  }
}

export const blackStartService = new BlackStartService();
