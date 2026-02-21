/**
 * Microgrid Types for Lifo4 EMS
 * Hybrid microgrid management with multi-source coordination
 */

// ============================================
// MICROGRID CONFIGURATION
// ============================================

export interface Microgrid {
  id: string;
  siteId: string;
  organizationId: string;
  name: string;
  description?: string;

  // Components
  components: MicrogridComponent[];

  // Point of Common Coupling
  pcc: PCCConfiguration;

  // Control Settings
  controlSettings: MicrogridControlSettings;

  // Current State
  state: MicrogridState;

  // Grid Services Configuration
  gridServices: GridServicesConfig;

  // Black Start Configuration
  blackStartConfig?: BlackStartConfig;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MicrogridComponent {
  id: string;
  type: ComponentType;
  name: string;
  manufacturer?: string;
  model?: string;

  // Rated Values
  ratedPower: number;                  // kW
  ratedEnergy?: number;                // kWh (for storage)
  ratedCapacity?: number;              // kWp (for solar)

  // Connection
  connectionType: 'modbus_tcp' | 'modbus_rtu' | 'sunspec' | 'api' | 'manual';
  connectionConfig?: Record<string, unknown>;

  // Reference to specific device
  deviceId?: string;                   // BESS ID, Inverter ID, etc.

  // Priority for dispatch
  priority: number;                    // higher = dispatched first
  blackStartCapable: boolean;

  // Status
  status: ComponentStatus;
  lastSeen?: Date;

  isActive: boolean;
}

export enum ComponentType {
  BESS = 'bess',
  SOLAR_PV = 'solar_pv',
  WIND = 'wind',
  DIESEL_GENERATOR = 'diesel_generator',
  GAS_GENERATOR = 'gas_generator',
  HYDRO = 'hydro',
  GRID = 'grid',
  EV_CHARGER = 'ev_charger',
  CONTROLLABLE_LOAD = 'controllable_load',
  CRITICAL_LOAD = 'critical_load',
  NON_CRITICAL_LOAD = 'non_critical_load',
}

export enum ComponentStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  STANDBY = 'standby',
  RUNNING = 'running',
  FAULT = 'fault',
  MAINTENANCE = 'maintenance',
}

// ============================================
// POINT OF COMMON COUPLING (PCC)
// ============================================

export interface PCCConfiguration {
  meterId: string;                     // meter device ID
  meterType: 'modbus' | 'api' | 'manual';

  // Grid Connection Parameters
  nominalVoltage: number;              // V (e.g., 220, 380, 13800)
  nominalFrequency: number;            // Hz (e.g., 60)
  phases: 1 | 3;

  // Contract Limits
  contractedDemand: number;            // kW
  exportLimit?: number;                // kW (0 = no export allowed)
  importLimit?: number;                // kW

  // Power Quality Thresholds
  voltageHighLimit: number;            // % above nominal
  voltageLowLimit: number;             // % below nominal
  frequencyHighLimit: number;          // Hz
  frequencyLowLimit: number;           // Hz
  powerFactorMinimum: number;          // e.g., 0.92

  // Anti-Islanding
  antiIslandingEnabled: boolean;
  antiIslandingMethods: AntiIslandingMethod[];
}

export enum AntiIslandingMethod {
  FREQUENCY_SHIFT = 'frequency_shift',
  VOLTAGE_SHIFT = 'voltage_shift',
  IMPEDANCE_MEASUREMENT = 'impedance_measurement',
  RATE_OF_CHANGE_FREQUENCY = 'rocof',
  VECTOR_SURGE = 'vector_surge',
}

// ============================================
// MICROGRID CONTROL SETTINGS
// ============================================

export interface MicrogridControlSettings {
  // Operating Mode
  operatingMode: MicrogridOperatingMode;
  autoModeEnabled: boolean;

  // Dispatch Strategy
  dispatchStrategy: DispatchStrategy;

  // Load Shedding
  loadSheddingEnabled: boolean;
  loadSheddingConfig?: LoadSheddingConfig;

  // Islanding
  seamlessTransitionEnabled: boolean;
  islandingEnabled: boolean;
  maxIslandDuration?: number;          // hours

  // Optimization
  optimizationObjective: OptimizationObjective;
  optimizationInterval: number;        // seconds

  // Frequency/Voltage Control
  frequencyDroop: number;              // % (e.g., 5%)
  voltageDroop: number;                // %
  droopEnabled: boolean;

  // Reserve Margins
  spinningReserve: number;             // % of load
  operatingReserve: number;            // %
}

export enum MicrogridOperatingMode {
  GRID_CONNECTED = 'grid_connected',
  ISLANDED = 'islanded',
  TRANSITION_TO_ISLAND = 'transition_to_island',
  TRANSITION_TO_GRID = 'transition_to_grid',
  BLACK_START = 'black_start',
  EMERGENCY = 'emergency',
  MAINTENANCE = 'maintenance',
}

export enum DispatchStrategy {
  ECONOMIC = 'economic',               // minimize cost
  RENEWABLE_FIRST = 'renewable_first', // maximize renewable
  BATTERY_PRIORITY = 'battery_priority', // use battery first
  PEAK_SHAVING = 'peak_shaving',       // minimize grid demand
  LOAD_FOLLOWING = 'load_following',   // follow load profile
  SCHEDULED = 'scheduled',             // follow schedule
  MANUAL = 'manual',                   // manual control
}

export enum OptimizationObjective {
  MINIMIZE_COST = 'minimize_cost',
  MINIMIZE_EMISSIONS = 'minimize_emissions',
  MAXIMIZE_SELF_CONSUMPTION = 'maximize_self_consumption',
  MAXIMIZE_REVENUE = 'maximize_revenue',
  MAXIMIZE_RELIABILITY = 'maximize_reliability',
  BALANCED = 'balanced',
}

export interface LoadSheddingConfig {
  enabled: boolean;
  stages: LoadSheddingStage[];
  automaticRestoration: boolean;
  restorationDelay: number;            // seconds
}

export interface LoadSheddingStage {
  stage: number;
  triggerCondition: 'frequency' | 'voltage' | 'power_deficit' | 'manual';
  threshold: number;                   // value that triggers this stage
  loads: ShedableLoad[];
  delaySeconds: number;
}

export interface ShedableLoad {
  componentId: string;
  name: string;
  power: number;                       // kW
  priority: number;                    // lower = shed first
  minOffTime: number;                  // seconds before can restart
}

// ============================================
// MICROGRID STATE
// ============================================

export interface MicrogridState {
  operatingMode: MicrogridOperatingMode;
  isConnectedToGrid: boolean;
  islandDuration?: number;             // seconds if islanded

  // Power Balance
  totalGeneration: number;             // kW
  totalLoad: number;                   // kW
  gridPower: number;                   // kW (+ import, - export)
  bessPower: number;                   // kW (+ discharge, - charge)
  solarPower: number;                  // kW
  windPower?: number;                  // kW
  generatorPower?: number;             // kW
  evChargerLoad: number;               // kW

  // Energy Metrics
  selfConsumptionRate: number;         // %
  selfSufficiencyRate: number;         // %
  renewableShare: number;              // %

  // Grid Quality
  gridVoltage: number;                 // V
  gridFrequency: number;               // Hz
  powerFactor: number;
  thd?: number;                        // Total Harmonic Distortion %

  // Reserves
  availableSpinningReserve: number;    // kW
  availableBessCapacity: number;       // kWh

  // Timestamps
  lastUpdate: Date;
  lastModeChange?: Date;
}

// ============================================
// GRID SERVICES
// ============================================

export interface GridServicesConfig {
  // Frequency Services
  frequencyRegulation: {
    enabled: boolean;
    type: 'fcr' | 'afrr' | 'mfrr';     // Primary, Secondary, Tertiary
    capacity: number;                  // kW
    droopPercentage: number;           // %
    deadband: number;                  // Hz
    responseTime: number;              // seconds
  };

  // Voltage Services
  voltageSupport: {
    enabled: boolean;
    voltVarEnabled: boolean;
    voltWattEnabled: boolean;
    reactiveCapacity: number;          // kVAR
  };

  // Reserve Services
  spinningReserve: {
    enabled: boolean;
    capacity: number;                  // kW
    responseTime: number;              // seconds
  };

  // Demand Response
  demandResponse: {
    enabled: boolean;
    maxReduction: number;              // kW
    responseTime: number;              // minutes
    autoAccept: boolean;
  };

  // Black Start
  blackStart: {
    enabled: boolean;
    capacity: number;                  // kW
    cranking: number;                  // MVA
  };
}

export interface BlackStartConfig {
  enabled: boolean;

  // Black Start Sequence
  sequence: BlackStartStep[];

  // Cranking Power
  crankingSource: 'bess' | 'diesel' | 'both';
  minBessSocForBlackStart: number;     // %

  // Synchronization
  syncVoltageWindow: number;           // % of nominal
  syncFrequencyWindow: number;         // Hz
  syncPhaseAngleWindow: number;        // degrees
  maxSyncAttempts: number;
  syncTimeout: number;                 // seconds

  // Testing
  lastTestDate?: Date;
  testInterval: number;                // days
  nextTestDate?: Date;
}

export interface BlackStartStep {
  order: number;
  action: BlackStartAction;
  componentId?: string;
  targetPower?: number;                // kW
  targetVoltage?: number;              // V
  targetFrequency?: number;            // Hz
  timeout: number;                     // seconds
  conditions?: BlackStartCondition[];
}

export enum BlackStartAction {
  START_BESS = 'start_bess',
  START_GENERATOR = 'start_generator',
  ENERGIZE_BUS = 'energize_bus',
  CLOSE_BREAKER = 'close_breaker',
  START_LOAD = 'start_load',
  STABILIZE = 'stabilize',
  SYNCHRONIZE = 'synchronize',
  CONNECT_GRID = 'connect_grid',
  TRANSFER_CONTROL = 'transfer_control',
}

export interface BlackStartCondition {
  type: 'voltage' | 'frequency' | 'power' | 'soc' | 'status';
  parameter: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | string;
}

// ============================================
// POWER FLOW & DISPATCH
// ============================================

export interface PowerDispatch {
  timestamp: Date;
  duration: number;                    // seconds

  // Setpoints per component
  setpoints: ComponentSetpoint[];

  // Expected outcome
  expectedGridPower: number;           // kW
  expectedCost: number;                // R$
  expectedEmissions: number;           // kg CO2

  // Source
  source: 'optimizer' | 'schedule' | 'manual' | 'emergency';
  optimizerId?: string;
}

export interface ComponentSetpoint {
  componentId: string;
  type: ComponentType;

  // Power setpoint
  activePower: number;                 // kW (+ generate/discharge, - consume/charge)
  reactivePower?: number;              // kVAR

  // For generators
  startCommand?: boolean;
  stopCommand?: boolean;

  // For loads
  shedCommand?: boolean;
  restoreCommand?: boolean;

  // Priority
  mandatory: boolean;                  // must execute
}

// ============================================
// ENERGY TRADING
// ============================================

export interface EnergyTrade {
  id: string;
  microgridId: string;

  // Trade Details
  type: 'buy' | 'sell';
  market: 'spot' | 'day_ahead' | 'real_time' | 'ancillary' | 'bilateral';
  product?: string;                    // e.g., 'FCR-N', 'aFRR'

  // Quantity
  energy: number;                      // kWh
  power?: number;                      // kW (for capacity products)
  duration: number;                    // hours

  // Timing
  deliveryStart: Date;
  deliveryEnd: Date;

  // Pricing
  price: number;                       // R$/MWh or R$/MW
  totalValue: number;                  // R$

  // Status
  status: TradeStatus;
  settlementStatus?: 'pending' | 'settled' | 'disputed';

  // References
  externalId?: string;                 // market operator ID
  contractId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export enum TradeStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
}

// ============================================
// MICROGRID EVENTS
// ============================================

export interface MicrogridEvent {
  id: string;
  microgridId: string;
  timestamp: Date;

  type: MicrogridEventType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';

  title: string;
  description: string;

  // Related data
  componentId?: string;
  previousState?: string;
  newState?: string;
  measurements?: Record<string, number>;

  // Duration (for events with duration)
  startTime: Date;
  endTime?: Date;
  duration?: number;                   // seconds

  // Resolution
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export enum MicrogridEventType {
  // Mode Changes
  MODE_CHANGE = 'mode_change',
  ISLANDING_START = 'islanding_start',
  ISLANDING_END = 'islanding_end',
  BLACK_START_INITIATED = 'black_start_initiated',
  BLACK_START_COMPLETED = 'black_start_completed',
  BLACK_START_FAILED = 'black_start_failed',

  // Grid Events
  GRID_OUTAGE = 'grid_outage',
  GRID_RESTORED = 'grid_restored',
  GRID_VOLTAGE_EXCURSION = 'grid_voltage_excursion',
  GRID_FREQUENCY_EXCURSION = 'grid_frequency_excursion',

  // Component Events
  COMPONENT_ONLINE = 'component_online',
  COMPONENT_OFFLINE = 'component_offline',
  COMPONENT_FAULT = 'component_fault',
  GENERATOR_START = 'generator_start',
  GENERATOR_STOP = 'generator_stop',

  // Load Events
  LOAD_SHED = 'load_shed',
  LOAD_RESTORED = 'load_restored',

  // Dispatch Events
  DISPATCH_EXECUTED = 'dispatch_executed',
  DISPATCH_FAILED = 'dispatch_failed',

  // Trading Events
  TRADE_SUBMITTED = 'trade_submitted',
  TRADE_ACCEPTED = 'trade_accepted',
  TRADE_DELIVERED = 'trade_delivered',

  // Control Events
  SETPOINT_CHANGE = 'setpoint_change',
  EMERGENCY_ACTION = 'emergency_action',
}

// ============================================
// MICROGRID STATISTICS
// ============================================

export interface MicrogridStatistics {
  microgridId: string;
  period: {
    start: Date;
    end: Date;
  };

  // Energy Stats
  totalGeneration: number;             // kWh
  totalConsumption: number;            // kWh
  gridImport: number;                  // kWh
  gridExport: number;                  // kWh
  selfConsumption: number;             // kWh

  // Generation by Source
  generationBySource: Record<ComponentType, number>;

  // Performance
  selfConsumptionRate: number;         // %
  selfSufficiencyRate: number;         // %
  renewableShare: number;              // %
  overallEfficiency: number;           // %

  // Reliability
  gridConnectedTime: number;           // hours
  islandedTime: number;                // hours
  outageCount: number;
  averageOutageDuration: number;       // minutes
  loadServed: number;                  // % of total load

  // Financial
  gridCost: number;                    // R$
  gridRevenue: number;                 // R$
  savingsFromSelfConsumption: number;  // R$
  demandChargesAvoided: number;        // R$
  gridServicesRevenue: number;         // R$

  // Environmental
  co2Avoided: number;                  // kg
  renewableEnergy: number;             // kWh
}
