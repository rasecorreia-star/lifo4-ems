/**
 * EV Charger Types for Lifo4 EMS
 * OCPP 1.6 / 2.0 Protocol Support
 */

// ============================================
// EV CHARGER CONFIGURATION
// ============================================

export interface EVCharger {
  id: string;
  siteId: string;
  organizationId: string;
  name: string;
  serialNumber: string;
  model: string;
  manufacturer: string;

  // Connection
  connection: OCPPConnection;

  // Specifications
  specifications: ChargerSpecifications;

  // Connectors
  connectors: Connector[];

  // Status
  status: ChargerStatus;
  lastSeen?: Date;
  lastError?: string;

  // Configuration
  configuration: ChargerConfiguration;

  // Smart Charging Profile
  chargingProfile?: ChargingProfile;

  // Location
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OCPPConnection {
  protocol: 'ocpp16' | 'ocpp201';
  chargePointId: string;
  websocketUrl: string;
  securityProfile: 0 | 1 | 2 | 3;      // OCPP security profiles
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  certificatePath?: string;

  heartbeatInterval: number;           // seconds
  connectionTimeout: number;           // seconds
}

export interface ChargerSpecifications {
  maxPower: number;                    // kW
  maxCurrent: number;                  // A
  voltage: number;                     // V
  phases: 1 | 3;
  connectorCount: number;

  acType?: 'Type1' | 'Type2' | 'CCS1' | 'CCS2' | 'CHAdeMO' | 'Tesla';
  dcFastCharging: boolean;
  v2gCapable: boolean;                 // Vehicle-to-Grid

  // MID Certified for billing
  meteringCertified: boolean;
  meteringAccuracy?: string;           // e.g., "Class 0.5"
}

export interface Connector {
  id: number;
  type: ConnectorType;
  status: ConnectorStatus;
  maxPower: number;                    // kW
  maxCurrent: number;                  // A

  // Current session
  currentSession?: ChargingSession;

  // Error
  errorCode?: string;
  vendorErrorCode?: string;
}

export enum ConnectorType {
  TYPE1 = 'Type1',
  TYPE2 = 'Type2',
  CCS1 = 'CCS1',
  CCS2 = 'CCS2',
  CHADEMO = 'CHAdeMO',
  TESLA = 'Tesla',
  GB_T = 'GB/T',
}

export enum ConnectorStatus {
  AVAILABLE = 'Available',
  PREPARING = 'Preparing',
  CHARGING = 'Charging',
  SUSPENDED_EV = 'SuspendedEV',
  SUSPENDED_EVSE = 'SuspendedEVSE',
  FINISHING = 'Finishing',
  RESERVED = 'Reserved',
  UNAVAILABLE = 'Unavailable',
  FAULTED = 'Faulted',
}

export interface ChargerStatus {
  state: 'online' | 'offline' | 'error' | 'maintenance';
  firmwareVersion?: string;
  lastBootTime?: Date;
  uptime?: number;                     // seconds
  diagnostics?: ChargerDiagnostics;
}

export interface ChargerDiagnostics {
  temperature?: number;
  humidity?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  networkStrength?: number;
}

// ============================================
// CHARGER CONFIGURATION
// ============================================

export interface ChargerConfiguration {
  // Authorization
  authorizationEnabled: boolean;
  localAuthList: AuthorizationEntry[];
  freeVendEnabled: boolean;            // allow charging without auth

  // Power Management
  powerManagement: {
    enabled: boolean;
    maxSitePower: number;              // kW (for load balancing)
    dynamicPowerSharing: boolean;
  };

  // Tariffs
  tariffs: EVTariff[];

  // Restrictions
  maxSessionDuration?: number;         // minutes
  maxSessionEnergy?: number;           // kWh
  reservationEnabled: boolean;
  reservationTimeout: number;          // minutes

  // Notifications
  notifyOnSessionStart: boolean;
  notifyOnSessionEnd: boolean;
  notifyOnError: boolean;
}

export interface AuthorizationEntry {
  idTag: string;                       // RFID or other ID
  idTagType: 'rfid' | 'app' | 'pin' | 'credit_card';
  userId?: string;
  groupId?: string;
  status: 'accepted' | 'blocked' | 'expired' | 'invalid';
  expiryDate?: Date;
  parentIdTag?: string;
}

export interface EVTariff {
  id: string;
  name: string;
  description?: string;

  // Pricing
  pricePerKwh: number;                 // R$/kWh
  pricePerMinute?: number;             // R$/min
  connectionFee?: number;              // R$ flat fee
  idleFee?: number;                    // R$/min after charging complete

  // Validity
  validFrom?: Date;
  validUntil?: Date;
  daysOfWeek?: number[];               // 0-6
  startTime?: string;                  // HH:mm
  endTime?: string;

  // Eligibility
  groupIds?: string[];                 // which user groups
  isDefault: boolean;
}

// ============================================
// CHARGING SESSIONS
// ============================================

export interface ChargingSession {
  id: string;
  chargerId: string;
  connectorId: number;
  siteId: string;
  organizationId: string;

  // User/Authorization
  idTag?: string;
  userId?: string;
  vehicleId?: string;

  // Timing
  startTime: Date;
  endTime?: Date;
  duration?: number;                   // seconds

  // Energy
  energyDelivered: number;             // kWh
  energyRequested?: number;            // kWh (if known)
  meterStart: number;                  // Wh
  meterEnd?: number;                   // Wh

  // Power
  maxPowerDelivered: number;           // kW
  averagePower: number;                // kW

  // Billing
  tariffId?: string;
  totalCost?: number;                  // R$
  costBreakdown?: CostBreakdown;

  // Vehicle Info (if available via ISO 15118)
  vehicleSoc?: number;                 // %
  vehicleSocEnd?: number;              // %
  vehicleBatteryCapacity?: number;     // kWh

  // Status
  status: SessionStatus;
  stopReason?: StopReason;
  errorCode?: string;

  // Metering
  meterValues: MeterValue[];

  createdAt: Date;
  updatedAt: Date;
}

export enum SessionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum StopReason {
  EV_DISCONNECTED = 'EVDisconnected',
  EMERGENCY_STOP = 'EmergencyStop',
  HARD_RESET = 'HardReset',
  LOCAL = 'Local',
  OTHER = 'Other',
  POWER_LOSS = 'PowerLoss',
  REBOOT = 'Reboot',
  REMOTE = 'Remote',
  SOFT_RESET = 'SoftReset',
  UNLOCK_COMMAND = 'UnlockCommand',
  DE_AUTHORIZED = 'DeAuthorized',
  ENERGY_LIMIT = 'EnergyLimit',
  TIME_LIMIT = 'TimeLimit',
}

export interface CostBreakdown {
  energyCost: number;                  // R$ for energy
  timeCost: number;                    // R$ for time
  connectionFee: number;               // R$ flat fee
  idleFee: number;                     // R$ for idle time
  taxes?: number;                      // R$
  discounts?: number;                  // R$
}

export interface MeterValue {
  timestamp: Date;
  sampled: SampledValue[];
}

export interface SampledValue {
  value: string;
  context?: 'Interruption.Begin' | 'Interruption.End' | 'Sample.Clock' | 'Sample.Periodic' | 'Transaction.Begin' | 'Transaction.End' | 'Trigger' | 'Other';
  format?: 'Raw' | 'SignedData';
  measurand?: Measurand;
  phase?: 'L1' | 'L2' | 'L3' | 'N' | 'L1-N' | 'L2-N' | 'L3-N' | 'L1-L2' | 'L2-L3' | 'L3-L1';
  location?: 'Cable' | 'EV' | 'Inlet' | 'Outlet' | 'Body';
  unit?: string;
}

export enum Measurand {
  ENERGY_ACTIVE_EXPORT_REGISTER = 'Energy.Active.Export.Register',
  ENERGY_ACTIVE_IMPORT_REGISTER = 'Energy.Active.Import.Register',
  ENERGY_REACTIVE_EXPORT_REGISTER = 'Energy.Reactive.Export.Register',
  ENERGY_REACTIVE_IMPORT_REGISTER = 'Energy.Reactive.Import.Register',
  ENERGY_ACTIVE_EXPORT_INTERVAL = 'Energy.Active.Export.Interval',
  ENERGY_ACTIVE_IMPORT_INTERVAL = 'Energy.Active.Import.Interval',
  POWER_ACTIVE_EXPORT = 'Power.Active.Export',
  POWER_ACTIVE_IMPORT = 'Power.Active.Import',
  POWER_OFFERED = 'Power.Offered',
  POWER_REACTIVE_EXPORT = 'Power.Reactive.Export',
  POWER_REACTIVE_IMPORT = 'Power.Reactive.Import',
  POWER_FACTOR = 'Power.Factor',
  CURRENT_IMPORT = 'Current.Import',
  CURRENT_EXPORT = 'Current.Export',
  CURRENT_OFFERED = 'Current.Offered',
  VOLTAGE = 'Voltage',
  FREQUENCY = 'Frequency',
  TEMPERATURE = 'Temperature',
  SOC = 'SoC',
  RPM = 'RPM',
}

// ============================================
// SMART CHARGING
// ============================================

export interface ChargingProfile {
  id: string;
  chargerId?: string;                  // null = site-wide
  connectorId?: number;                // null = all connectors

  stackLevel: number;                  // priority (0 = lowest)
  profilePurpose: ProfilePurpose;
  kind: ProfileKind;
  recurrencyKind?: 'Daily' | 'Weekly';

  // Schedule
  validFrom?: Date;
  validTo?: Date;
  schedule: ChargingSchedulePeriod[];

  // Transaction specific
  transactionId?: string;
}

export enum ProfilePurpose {
  CHARGE_POINT_MAX_PROFILE = 'ChargePointMaxProfile',
  TX_DEFAULT_PROFILE = 'TxDefaultProfile',
  TX_PROFILE = 'TxProfile',
}

export enum ProfileKind {
  ABSOLUTE = 'Absolute',
  RECURRING = 'Recurring',
  RELATIVE = 'Relative',
}

export interface ChargingSchedulePeriod {
  startPeriod: number;                 // seconds from start
  limit: number;                       // A or W depending on unit
  numberPhases?: number;               // 1-3
}

// ============================================
// LOAD BALANCING
// ============================================

export interface LoadBalancingConfig {
  siteId: string;
  enabled: boolean;

  // Site Constraints
  maxSitePower: number;                // kW
  maxSiteCurrent: number;              // A

  // Priority Settings
  priorityMode: 'fifo' | 'equal' | 'priority_based';
  chargerPriorities?: ChargerPriority[];

  // Grid Integration
  gridConstraint?: {
    enabled: boolean;
    maxImportPower: number;            // kW
    preferSolar: boolean;
    preferBattery: boolean;
  };

  // BESS Integration
  bessIntegration?: {
    enabled: boolean;
    systemId: string;
    preferBessOverGrid: boolean;
    minBessSocForCharging: number;     // %
  };
}

export interface ChargerPriority {
  chargerId: string;
  priority: number;                    // higher = more priority
  minPower?: number;                   // kW guaranteed
}

// ============================================
// EV CHARGER STATISTICS
// ============================================

export interface EVChargerStatistics {
  chargerId: string;
  period: {
    start: Date;
    end: Date;
  };

  // Session Stats
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageSessionDuration: number;      // minutes
  averageSessionEnergy: number;        // kWh

  // Energy Stats
  totalEnergyDelivered: number;        // kWh
  peakPowerDelivered: number;          // kW
  averagePower: number;                // kW

  // Revenue Stats
  totalRevenue: number;                // R$
  averageRevenuePerSession: number;    // R$

  // Utilization Stats
  utilizationRate: number;             // % of time in use
  peakHour: number;                    // 0-23
  sessionsPerDay: number;

  // User Stats
  uniqueUsers: number;
  topUsers: { userId: string; sessions: number; energy: number }[];

  // Uptime Stats
  uptimePercentage: number;
  totalDowntime: number;               // seconds
  faultCount: number;
}

// ============================================
// OCPP COMMANDS & RESPONSES
// ============================================

export interface OCPPCommand {
  type: OCPPCommandType;
  chargerId: string;
  connectorId?: number;
  payload: Record<string, unknown>;
  timestamp: Date;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'timeout';
  response?: Record<string, unknown>;
  error?: string;
}

export enum OCPPCommandType {
  // Core Profile
  AUTHORIZE = 'Authorize',
  BOOT_NOTIFICATION = 'BootNotification',
  CHANGE_AVAILABILITY = 'ChangeAvailability',
  CHANGE_CONFIGURATION = 'ChangeConfiguration',
  CLEAR_CACHE = 'ClearCache',
  GET_CONFIGURATION = 'GetConfiguration',
  HEARTBEAT = 'Heartbeat',
  METER_VALUES = 'MeterValues',
  REMOTE_START_TRANSACTION = 'RemoteStartTransaction',
  REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction',
  RESET = 'Reset',
  START_TRANSACTION = 'StartTransaction',
  STATUS_NOTIFICATION = 'StatusNotification',
  STOP_TRANSACTION = 'StopTransaction',
  UNLOCK_CONNECTOR = 'UnlockConnector',

  // Smart Charging Profile
  CLEAR_CHARGING_PROFILE = 'ClearChargingProfile',
  GET_COMPOSITE_SCHEDULE = 'GetCompositeSchedule',
  SET_CHARGING_PROFILE = 'SetChargingProfile',

  // Remote Trigger Profile
  TRIGGER_MESSAGE = 'TriggerMessage',

  // Firmware Management Profile
  GET_DIAGNOSTICS = 'GetDiagnostics',
  UPDATE_FIRMWARE = 'UpdateFirmware',

  // Local Auth List Management Profile
  GET_LOCAL_LIST_VERSION = 'GetLocalListVersion',
  SEND_LOCAL_LIST = 'SendLocalList',

  // Reservation Profile
  CANCEL_RESERVATION = 'CancelReservation',
  RESERVE_NOW = 'ReserveNow',
}

// ============================================
// RESERVATIONS
// ============================================

export interface Reservation {
  id: string;
  chargerId: string;
  connectorId: number;
  userId: string;
  idTag: string;

  startTime: Date;
  expiryTime: Date;

  status: 'pending' | 'active' | 'used' | 'cancelled' | 'expired';
  sessionId?: string;                  // if reservation was used

  createdAt: Date;
  updatedAt: Date;
}
