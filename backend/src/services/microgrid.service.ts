/**
 * Microgrid Management Service for Lifo4 EMS
 * Handles hybrid microgrid control, islanding, black start, and grid services
 */

import { db, Collections } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { mqttService } from '../mqtt/mqtt.service.js';
import { socketService } from '../websocket/socket.service.js';
import {
  Microgrid,
  MicrogridComponent,
  MicrogridState,
  MicrogridOperatingMode,
  MicrogridControlSettings,
  MicrogridEvent,
  MicrogridEventType,
  MicrogridStatistics,
  ComponentType,
  ComponentStatus,
  PowerDispatch,
  ComponentSetpoint,
  BlackStartConfig,
  BlackStartStep,
  BlackStartAction,
  DispatchStrategy,
  GridServicesConfig,
  EnergyTrade,
  TradeStatus,
} from '../models/microgrid.types.js';

export class MicrogridService {
  private db = db;
  private activeControlLoops: Map<string, NodeJS.Timeout> = new Map();
  private microgridStates: Map<string, MicrogridState> = new Map();

  // ============================================
  // MICROGRID CRUD
  // ============================================

  async createMicrogrid(
    siteId: string,
    organizationId: string,
    data: Partial<Microgrid>
  ): Promise<Microgrid> {
    const now = new Date();

    const defaultState: MicrogridState = {
      operatingMode: MicrogridOperatingMode.GRID_CONNECTED,
      isConnectedToGrid: true,
      totalGeneration: 0,
      totalLoad: 0,
      gridPower: 0,
      bessPower: 0,
      solarPower: 0,
      evChargerLoad: 0,
      selfConsumptionRate: 0,
      selfSufficiencyRate: 0,
      renewableShare: 0,
      gridVoltage: 220,
      gridFrequency: 60,
      powerFactor: 1,
      availableSpinningReserve: 0,
      availableBessCapacity: 0,
      lastUpdate: now,
    };

    const microgrid: Omit<Microgrid, 'id'> = {
      siteId,
      organizationId,
      name: data.name || 'New Microgrid',
      description: data.description,
      components: data.components || [],
      pcc: data.pcc || {
        meterId: '',
        meterType: 'modbus',
        nominalVoltage: 220,
        nominalFrequency: 60,
        phases: 3,
        contractedDemand: 100,
        voltageHighLimit: 10,
        voltageLowLimit: 10,
        frequencyHighLimit: 60.5,
        frequencyLowLimit: 59.5,
        powerFactorMinimum: 0.92,
        antiIslandingEnabled: true,
        antiIslandingMethods: ['rocof', 'frequency_shift'],
      },
      controlSettings: data.controlSettings || {
        operatingMode: MicrogridOperatingMode.GRID_CONNECTED,
        autoModeEnabled: true,
        dispatchStrategy: DispatchStrategy.ECONOMIC,
        loadSheddingEnabled: true,
        seamlessTransitionEnabled: true,
        islandingEnabled: true,
        optimizationObjective: 'maximize_self_consumption',
        optimizationInterval: 60,
        frequencyDroop: 5,
        voltageDroop: 5,
        droopEnabled: true,
        spinningReserve: 10,
        operatingReserve: 20,
      },
      state: defaultState,
      gridServices: data.gridServices || {
        frequencyRegulation: { enabled: false, type: 'fcr', capacity: 0, droopPercentage: 5, deadband: 0.2, responseTime: 1 },
        voltageSupport: { enabled: false, voltVarEnabled: false, voltWattEnabled: false, reactiveCapacity: 0 },
        spinningReserve: { enabled: false, capacity: 0, responseTime: 10 },
        demandResponse: { enabled: false, maxReduction: 0, responseTime: 15, autoAccept: false },
        blackStart: { enabled: false, capacity: 0, cranking: 0 },
      },
      blackStartConfig: data.blackStartConfig,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection(Collections.MICROGRIDS).add(microgrid);

    logger.info(`Microgrid created: ${docRef.id}`, { siteId, organizationId });

    return { id: docRef.id, ...microgrid };
  }

  async getMicrogrid(id: string): Promise<Microgrid | null> {
    const doc = await this.db.collection(Collections.MICROGRIDS).doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      state: {
        ...data.state,
        lastUpdate: data.state?.lastUpdate?.toDate() || new Date(),
        lastModeChange: data.state?.lastModeChange?.toDate(),
      },
    } as Microgrid;
  }

  async getMicrogridsBySite(siteId: string): Promise<Microgrid[]> {
    const snapshot = await this.db.collection(Collections.MICROGRIDS)
      .where('siteId', '==', siteId)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Microgrid[];
  }

  async updateMicrogrid(id: string, updates: Partial<Microgrid>): Promise<Microgrid> {
    const ref = this.db.collection(Collections.MICROGRIDS).doc(id);
    const doc = await ref.get();

    if (!doc.exists) throw new NotFoundError('Microgrid');

    await ref.update({
      ...updates,
      updatedAt: new Date(),
    });

    const updated = await this.getMicrogrid(id);
    if (!updated) throw new NotFoundError('Microgrid');

    return updated;
  }

  // ============================================
  // COMPONENT MANAGEMENT
  // ============================================

  async addComponent(microgridId: string, component: Omit<MicrogridComponent, 'id'>): Promise<MicrogridComponent> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const newComponent: MicrogridComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...component,
      status: ComponentStatus.OFFLINE,
      isActive: true,
    };

    const components = [...microgrid.components, newComponent];
    await this.updateMicrogrid(microgridId, { components });

    logger.info(`Component added to microgrid: ${microgridId}`, { componentId: newComponent.id, type: component.type });

    return newComponent;
  }

  async removeComponent(microgridId: string, componentId: string): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const components = microgrid.components.filter(c => c.id !== componentId);
    if (components.length === microgrid.components.length) {
      throw new NotFoundError('Component');
    }

    await this.updateMicrogrid(microgridId, { components });
    logger.info(`Component removed from microgrid: ${microgridId}`, { componentId });
  }

  async updateComponentStatus(microgridId: string, componentId: string, status: ComponentStatus): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const components = microgrid.components.map(c =>
      c.id === componentId ? { ...c, status, lastSeen: new Date() } : c
    );

    await this.updateMicrogrid(microgridId, { components });
  }

  // ============================================
  // OPERATING MODE CONTROL
  // ============================================

  async setOperatingMode(microgridId: string, mode: MicrogridOperatingMode, userId: string): Promise<MicrogridState> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const previousMode = microgrid.state.operatingMode;
    const now = new Date();

    // Validate mode transition
    this.validateModeTransition(previousMode, mode, microgrid);

    const newState: MicrogridState = {
      ...microgrid.state,
      operatingMode: mode,
      isConnectedToGrid: mode === MicrogridOperatingMode.GRID_CONNECTED,
      lastUpdate: now,
      lastModeChange: now,
      islandDuration: mode === MicrogridOperatingMode.ISLANDED ? 0 : undefined,
    };

    await this.updateMicrogrid(microgridId, { state: newState });

    // Log event
    await this.logEvent(microgridId, {
      type: MicrogridEventType.MODE_CHANGE,
      severity: 'info',
      title: `Operating mode changed to ${mode}`,
      description: `Mode changed from ${previousMode} to ${mode} by user ${userId}`,
      previousState: previousMode,
      newState: mode,
    });

    // Broadcast state change
    socketService.broadcastSystemStatus(microgridId, { type: 'microgrid_mode_change', state: newState });

    logger.info(`Microgrid mode changed: ${microgridId}`, { previousMode, newMode: mode, userId });

    return newState;
  }

  private validateModeTransition(from: MicrogridOperatingMode, to: MicrogridOperatingMode, microgrid: Microgrid): void {
    const invalidTransitions: Record<MicrogridOperatingMode, MicrogridOperatingMode[]> = {
      [MicrogridOperatingMode.GRID_CONNECTED]: [],
      [MicrogridOperatingMode.ISLANDED]: [MicrogridOperatingMode.BLACK_START],
      [MicrogridOperatingMode.TRANSITION_TO_ISLAND]: [MicrogridOperatingMode.BLACK_START],
      [MicrogridOperatingMode.TRANSITION_TO_GRID]: [MicrogridOperatingMode.BLACK_START],
      [MicrogridOperatingMode.BLACK_START]: [MicrogridOperatingMode.ISLANDED],
      [MicrogridOperatingMode.EMERGENCY]: [],
      [MicrogridOperatingMode.MAINTENANCE]: [],
    };

    if (invalidTransitions[from]?.includes(to)) {
      throw new BadRequestError(`Cannot transition from ${from} to ${to}`);
    }

    // Check black start requirements
    if (to === MicrogridOperatingMode.BLACK_START) {
      if (!microgrid.blackStartConfig?.enabled) {
        throw new BadRequestError('Black start is not enabled for this microgrid');
      }
      const bessComponents = microgrid.components.filter(c => c.type === ComponentType.BESS && c.blackStartCapable);
      if (bessComponents.length === 0) {
        throw new BadRequestError('No black start capable BESS available');
      }
    }
  }

  // ============================================
  // ISLANDING CONTROL
  // ============================================

  async initiateIslanding(microgridId: string, reason: string, userId?: string): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    if (!microgrid.controlSettings.islandingEnabled) {
      throw new BadRequestError('Islanding is not enabled for this microgrid');
    }

    // Transition to island mode
    await this.setOperatingMode(microgridId, MicrogridOperatingMode.TRANSITION_TO_ISLAND, userId || 'system');

    // Execute islanding sequence
    await this.executeIslandingSequence(microgrid);

    // Complete transition
    await this.setOperatingMode(microgridId, MicrogridOperatingMode.ISLANDED, userId || 'system');

    await this.logEvent(microgridId, {
      type: MicrogridEventType.ISLANDING_START,
      severity: 'high',
      title: 'Islanding initiated',
      description: `Reason: ${reason}`,
    });

    logger.info(`Islanding initiated: ${microgridId}`, { reason });
  }

  private async executeIslandingSequence(microgrid: Microgrid): Promise<void> {
    // 1. Open main breaker
    await this.sendCommand(microgrid.id, 'open_main_breaker', {});

    // 2. Stabilize frequency and voltage with BESS
    const bessComponents = microgrid.components.filter(c => c.type === ComponentType.BESS);
    for (const bess of bessComponents) {
      await this.sendCommand(microgrid.id, 'set_grid_forming', { componentId: bess.id });
    }

    // 3. Balance load
    await this.balanceIslandLoad(microgrid);
  }

  async reconnectToGrid(microgridId: string, userId?: string): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    if (microgrid.state.operatingMode !== MicrogridOperatingMode.ISLANDED) {
      throw new BadRequestError('Microgrid is not in islanded mode');
    }

    await this.setOperatingMode(microgridId, MicrogridOperatingMode.TRANSITION_TO_GRID, userId || 'system');

    // Execute synchronization
    await this.executeSynchronization(microgrid);

    await this.setOperatingMode(microgridId, MicrogridOperatingMode.GRID_CONNECTED, userId || 'system');

    await this.logEvent(microgridId, {
      type: MicrogridEventType.ISLANDING_END,
      severity: 'info',
      title: 'Grid reconnection completed',
      description: 'Successfully synchronized and reconnected to grid',
    });

    logger.info(`Grid reconnection completed: ${microgridId}`);
  }

  private async executeSynchronization(microgrid: Microgrid): Promise<void> {
    const config = microgrid.blackStartConfig;
    if (!config) return;

    // Monitor sync parameters until within window
    let syncAttempts = 0;
    const maxAttempts = config.maxSyncAttempts || 10;

    while (syncAttempts < maxAttempts) {
      const syncStatus = await this.checkSyncConditions(microgrid);

      if (syncStatus.ready) {
        await this.sendCommand(microgrid.id, 'close_main_breaker', {});
        return;
      }

      syncAttempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new BadRequestError('Synchronization failed: exceeded maximum attempts');
  }

  private async checkSyncConditions(microgrid: Microgrid): Promise<{ ready: boolean; voltage?: number; frequency?: number; phase?: number }> {
    // In production, this would read actual measurements
    // For now, simulate a successful sync check
    return { ready: true, voltage: 220, frequency: 60, phase: 0 };
  }

  private async balanceIslandLoad(microgrid: Microgrid): Promise<void> {
    // Calculate available generation
    const generation = microgrid.components
      .filter(c => [ComponentType.BESS, ComponentType.SOLAR_PV, ComponentType.DIESEL_GENERATOR].includes(c.type))
      .filter(c => c.status === ComponentStatus.ONLINE || c.status === ComponentStatus.RUNNING)
      .reduce((sum, c) => sum + c.ratedPower, 0);

    // If load exceeds generation, shed non-critical loads
    if (microgrid.state.totalLoad > generation && microgrid.controlSettings.loadSheddingEnabled) {
      await this.executeLoadShedding(microgrid, microgrid.state.totalLoad - generation);
    }
  }

  // ============================================
  // BLACK START
  // ============================================

  async initiateBlackStart(microgridId: string, userId: string): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    if (!microgrid.blackStartConfig?.enabled) {
      throw new BadRequestError('Black start is not configured for this microgrid');
    }

    await this.setOperatingMode(microgridId, MicrogridOperatingMode.BLACK_START, userId);

    await this.logEvent(microgridId, {
      type: MicrogridEventType.BLACK_START_INITIATED,
      severity: 'critical',
      title: 'Black start initiated',
      description: `Black start sequence initiated by ${userId}`,
    });

    try {
      await this.executeBlackStartSequence(microgrid);

      await this.setOperatingMode(microgridId, MicrogridOperatingMode.ISLANDED, userId);

      await this.logEvent(microgridId, {
        type: MicrogridEventType.BLACK_START_COMPLETED,
        severity: 'info',
        title: 'Black start completed',
        description: 'Microgrid successfully energized',
      });

      logger.info(`Black start completed: ${microgridId}`);
    } catch (error) {
      await this.logEvent(microgridId, {
        type: MicrogridEventType.BLACK_START_FAILED,
        severity: 'critical',
        title: 'Black start failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async executeBlackStartSequence(microgrid: Microgrid): Promise<void> {
    const config = microgrid.blackStartConfig!;

    for (const step of config.sequence) {
      logger.info(`Executing black start step ${step.order}: ${step.action}`, { microgridId: microgrid.id });

      // Check conditions
      if (step.conditions) {
        for (const condition of step.conditions) {
          const result = await this.checkBlackStartCondition(microgrid, condition);
          if (!result) {
            throw new BadRequestError(`Black start condition not met: ${condition.type} ${condition.parameter}`);
          }
        }
      }

      // Execute action
      await this.executeBlackStartAction(microgrid, step);

      // Wait for stabilization
      await new Promise(resolve => setTimeout(resolve, step.timeout * 100)); // Scaled for testing
    }
  }

  private async checkBlackStartCondition(
    microgrid: Microgrid,
    condition: { type: string; parameter: string; operator: string; value: number | string }
  ): Promise<boolean> {
    // In production, read actual values
    // For now, return true to allow sequence to proceed
    return true;
  }

  private async executeBlackStartAction(microgrid: Microgrid, step: BlackStartStep): Promise<void> {
    switch (step.action) {
      case BlackStartAction.START_BESS:
        await this.sendCommand(microgrid.id, 'start_bess', { componentId: step.componentId, power: step.targetPower });
        break;
      case BlackStartAction.START_GENERATOR:
        await this.sendCommand(microgrid.id, 'start_generator', { componentId: step.componentId });
        break;
      case BlackStartAction.ENERGIZE_BUS:
        await this.sendCommand(microgrid.id, 'energize_bus', { voltage: step.targetVoltage, frequency: step.targetFrequency });
        break;
      case BlackStartAction.CLOSE_BREAKER:
        await this.sendCommand(microgrid.id, 'close_breaker', { componentId: step.componentId });
        break;
      case BlackStartAction.START_LOAD:
        await this.sendCommand(microgrid.id, 'start_load', { componentId: step.componentId, power: step.targetPower });
        break;
      case BlackStartAction.STABILIZE:
        await new Promise(resolve => setTimeout(resolve, 5000));
        break;
      default:
        logger.warn(`Unknown black start action: ${step.action}`);
    }
  }

  // ============================================
  // POWER DISPATCH
  // ============================================

  async dispatchPower(microgridId: string, dispatch: PowerDispatch): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    for (const setpoint of dispatch.setpoints) {
      await this.applySetpoint(microgrid, setpoint);
    }

    await this.logEvent(microgridId, {
      type: MicrogridEventType.DISPATCH_EXECUTED,
      severity: 'info',
      title: 'Power dispatch executed',
      description: `Source: ${dispatch.source}, Expected grid power: ${dispatch.expectedGridPower}kW`,
    });

    logger.info(`Power dispatch executed: ${microgridId}`, { source: dispatch.source, setpoints: dispatch.setpoints.length });
  }

  private async applySetpoint(microgrid: Microgrid, setpoint: ComponentSetpoint): Promise<void> {
    const component = microgrid.components.find(c => c.id === setpoint.componentId);
    if (!component) {
      if (setpoint.mandatory) throw new NotFoundError('Component');
      return;
    }

    switch (setpoint.type) {
      case ComponentType.BESS:
        if (setpoint.activePower > 0) {
          await this.sendCommand(microgrid.id, 'set_discharge_power', { componentId: component.id, power: setpoint.activePower * 1000 });
        } else if (setpoint.activePower < 0) {
          await this.sendCommand(microgrid.id, 'set_charge_power', { componentId: component.id, power: Math.abs(setpoint.activePower) * 1000 });
        } else {
          await this.sendCommand(microgrid.id, 'set_idle', { componentId: component.id });
        }
        break;
      case ComponentType.DIESEL_GENERATOR:
      case ComponentType.GAS_GENERATOR:
        if (setpoint.startCommand) {
          await this.sendCommand(microgrid.id, 'start_generator', { componentId: component.id });
        } else if (setpoint.stopCommand) {
          await this.sendCommand(microgrid.id, 'stop_generator', { componentId: component.id });
        }
        break;
      case ComponentType.CONTROLLABLE_LOAD:
      case ComponentType.NON_CRITICAL_LOAD:
        if (setpoint.shedCommand) {
          await this.sendCommand(microgrid.id, 'shed_load', { componentId: component.id });
        } else if (setpoint.restoreCommand) {
          await this.sendCommand(microgrid.id, 'restore_load', { componentId: component.id });
        }
        break;
    }
  }

  // ============================================
  // LOAD SHEDDING
  // ============================================

  async executeLoadShedding(microgrid: Microgrid, powerDeficit: number): Promise<void> {
    const config = microgrid.controlSettings.loadSheddingConfig;
    if (!config?.enabled) return;

    let shedPower = 0;

    for (const stage of config.stages.sort((a, b) => a.stage - b.stage)) {
      if (shedPower >= powerDeficit) break;

      for (const load of stage.loads.sort((a, b) => a.priority - b.priority)) {
        if (shedPower >= powerDeficit) break;

        await this.sendCommand(microgrid.id, 'shed_load', { componentId: load.componentId });
        shedPower += load.power;

        await this.logEvent(microgrid.id, {
          type: MicrogridEventType.LOAD_SHED,
          severity: 'high',
          title: `Load shed: ${load.name}`,
          description: `Stage ${stage.stage}, Power: ${load.power}kW`,
          componentId: load.componentId,
        });
      }

      await new Promise(resolve => setTimeout(resolve, stage.delaySeconds * 1000));
    }

    logger.info(`Load shedding executed: ${microgrid.id}`, { deficit: powerDeficit, shed: shedPower });
  }

  // ============================================
  // GRID SERVICES
  // ============================================

  async updateGridServicesConfig(microgridId: string, config: Partial<GridServicesConfig>): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const updatedConfig = { ...microgrid.gridServices, ...config };
    await this.updateMicrogrid(microgridId, { gridServices: updatedConfig });

    logger.info(`Grid services config updated: ${microgridId}`);
  }

  async respondToFrequencyEvent(microgridId: string, frequency: number): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const frConfig = microgrid.gridServices.frequencyRegulation;
    if (!frConfig.enabled) return;

    const nominalFreq = microgrid.pcc.nominalFrequency;
    const deviation = frequency - nominalFreq;

    if (Math.abs(deviation) < frConfig.deadband) return;

    // Calculate required power change based on droop
    const powerChange = (deviation / nominalFreq) * (100 / frConfig.droopPercentage) * frConfig.capacity;

    // Apply power change to BESS
    const bessComponents = microgrid.components.filter(c => c.type === ComponentType.BESS);
    for (const bess of bessComponents) {
      await this.sendCommand(microgrid.id, 'adjust_power', { componentId: bess.id, delta: powerChange * 1000 });
    }

    logger.info(`Frequency response executed: ${microgridId}`, { frequency, deviation, powerChange });
  }

  // ============================================
  // ENERGY TRADING
  // ============================================

  async createTrade(microgridId: string, trade: Omit<EnergyTrade, 'id' | 'microgridId' | 'createdAt' | 'updatedAt'>): Promise<EnergyTrade> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) throw new NotFoundError('Microgrid');

    const now = new Date();
    const newTrade: Omit<EnergyTrade, 'id'> = {
      ...trade,
      microgridId,
      status: TradeStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection('energy_trades').add(newTrade);

    logger.info(`Trade created: ${docRef.id}`, { microgridId, type: trade.type, market: trade.market });

    return { id: docRef.id, ...newTrade };
  }

  async submitTrade(tradeId: string): Promise<EnergyTrade> {
    const tradeRef = this.db.collection('energy_trades').doc(tradeId);
    const doc = await tradeRef.get();

    if (!doc.exists) throw new NotFoundError('Trade');

    await tradeRef.update({
      status: TradeStatus.SUBMITTED,
      updatedAt: new Date(),
    });

    const updated = await tradeRef.get();
    return { id: updated.id, ...updated.data() } as EnergyTrade;
  }

  // ============================================
  // EVENTS & STATISTICS
  // ============================================

  async logEvent(microgridId: string, event: Partial<MicrogridEvent>): Promise<void> {
    const now = new Date();
    const newEvent: Omit<MicrogridEvent, 'id'> = {
      microgridId,
      timestamp: now,
      type: event.type || MicrogridEventType.MODE_CHANGE,
      severity: event.severity || 'info',
      title: event.title || '',
      description: event.description || '',
      componentId: event.componentId,
      previousState: event.previousState,
      newState: event.newState,
      measurements: event.measurements,
      startTime: now,
      endTime: event.endTime,
      duration: event.duration,
      isResolved: event.isResolved ?? false,
      resolvedAt: event.resolvedAt,
      resolvedBy: event.resolvedBy,
      resolutionNotes: event.resolutionNotes,
    };

    await this.db.collection('microgrid_events').add(newEvent);
  }

  async getEvents(microgridId: string, limit: number = 100): Promise<MicrogridEvent[]> {
    const snapshot = await this.db.collection('microgrid_events')
      .where('microgridId', '==', microgridId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
      startTime: doc.data().startTime?.toDate(),
      endTime: doc.data().endTime?.toDate(),
    })) as MicrogridEvent[];
  }

  async getStatistics(microgridId: string, startDate: Date, endDate: Date): Promise<MicrogridStatistics> {
    // In production, this would aggregate from time-series data
    // For now, return placeholder statistics
    return {
      microgridId,
      period: { start: startDate, end: endDate },
      totalGeneration: 0,
      totalConsumption: 0,
      gridImport: 0,
      gridExport: 0,
      selfConsumption: 0,
      generationBySource: {} as Record<ComponentType, number>,
      selfConsumptionRate: 0,
      selfSufficiencyRate: 0,
      renewableShare: 0,
      overallEfficiency: 0,
      gridConnectedTime: 0,
      islandedTime: 0,
      outageCount: 0,
      averageOutageDuration: 0,
      loadServed: 100,
      gridCost: 0,
      gridRevenue: 0,
      savingsFromSelfConsumption: 0,
      demandChargesAvoided: 0,
      gridServicesRevenue: 0,
      co2Avoided: 0,
      renewableEnergy: 0,
    };
  }

  // ============================================
  // CONTROL LOOP
  // ============================================

  startControlLoop(microgridId: string): void {
    if (this.activeControlLoops.has(microgridId)) return;

    const loop = setInterval(async () => {
      try {
        await this.runControlCycle(microgridId);
      } catch (error) {
        logger.error(`Control loop error: ${microgridId}`, { error });
      }
    }, 1000);

    this.activeControlLoops.set(microgridId, loop);
    logger.info(`Control loop started: ${microgridId}`);
  }

  stopControlLoop(microgridId: string): void {
    const loop = this.activeControlLoops.get(microgridId);
    if (loop) {
      clearInterval(loop);
      this.activeControlLoops.delete(microgridId);
      logger.info(`Control loop stopped: ${microgridId}`);
    }
  }

  private async runControlCycle(microgridId: string): Promise<void> {
    const microgrid = await this.getMicrogrid(microgridId);
    if (!microgrid) return;

    // Update state from components
    const state = await this.aggregateComponentStates(microgrid);
    this.microgridStates.set(microgridId, state);

    // Check for anomalies
    await this.checkAnomalies(microgrid, state);

    // Broadcast state
    socketService.broadcastSystemStatus(microgridId, { type: 'microgrid_state', state });
  }

  private async aggregateComponentStates(microgrid: Microgrid): Promise<MicrogridState> {
    // In production, read from actual devices
    return microgrid.state;
  }

  private async checkAnomalies(microgrid: Microgrid, state: MicrogridState): Promise<void> {
    // Check voltage
    if (state.gridVoltage > microgrid.pcc.nominalVoltage * (1 + microgrid.pcc.voltageHighLimit / 100)) {
      await this.logEvent(microgrid.id, {
        type: MicrogridEventType.GRID_VOLTAGE_EXCURSION,
        severity: 'high',
        title: 'High voltage detected',
        description: `Voltage: ${state.gridVoltage}V`,
      });
    }

    // Check frequency
    if (state.gridFrequency > microgrid.pcc.frequencyHighLimit || state.gridFrequency < microgrid.pcc.frequencyLowLimit) {
      await this.logEvent(microgrid.id, {
        type: MicrogridEventType.GRID_FREQUENCY_EXCURSION,
        severity: 'high',
        title: 'Frequency excursion detected',
        description: `Frequency: ${state.gridFrequency}Hz`,
      });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async sendCommand(microgridId: string, command: string, params: Record<string, unknown>): Promise<void> {
    const topic = `microgrid/${microgridId}/command`;
    const payload = {
      command,
      params,
      timestamp: Date.now(),
      requestId: `mg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    await mqttService.publish(topic, JSON.stringify(payload));
  }
}

export const microgridService = new MicrogridService();
