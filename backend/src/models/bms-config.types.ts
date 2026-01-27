/**
 * BMS Configuration Types for Lifo4 EMS
 * Advanced parameter editing with dependency validation
 */

// ============================================
// BMS PARAMETER CATEGORIES
// ============================================

export interface BMSConfiguration {
  id: string;
  systemId: string;

  // Voltage Protection Parameters
  voltageProtection: VoltageProtectionParams;

  // Current Protection Parameters
  currentProtection: CurrentProtectionParams;

  // Temperature Protection Parameters
  temperatureProtection: TemperatureProtectionParams;

  // SOC Calibration Parameters
  socCalibration: SOCCalibrationParams;

  // Balancing Parameters
  balancing: BalancingParams;

  // Capacity & Power Parameters
  capacityPower: CapacityPowerParams;

  // Communication Parameters
  communication: CommunicationParams;

  // Alarm Settings
  alarmSettings: AlarmSettings;

  // Metadata
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  pendingApproval: boolean;
}

// ============================================
// VOLTAGE PROTECTION PARAMETERS
// ============================================

export interface VoltageProtectionParams {
  // Over Voltage Protection (OVP)
  ovpThreshold: number;           // V per cell (3.50 - 3.75V, default 3.65V)
  ovpRecovery: number;            // V per cell (3.45 - 3.70V, default 3.55V)
  ovpDelay: number;               // ms (100 - 5000ms, default 1000ms)

  // Under Voltage Protection (UVP)
  uvpThreshold: number;           // V per cell (2.30 - 2.80V, default 2.50V)
  uvpRecovery: number;            // V per cell (2.40 - 2.90V, default 2.70V)
  uvpDelay: number;               // ms (100 - 5000ms, default 1000ms)

  // Voltage Alarms
  highVoltageAlarm: number;       // V per cell
  lowVoltageAlarm: number;        // V per cell
  cellDifferenceAlarm: number;    // mV (max delta between cells)

  // Pack Voltage
  packOvervoltage: number;        // V (calculated from cell count)
  packUndervoltage: number;       // V
}

// ============================================
// CURRENT PROTECTION PARAMETERS
// ============================================

export interface CurrentProtectionParams {
  // Over Current Protection - Charge
  ocpChargeThreshold: number;     // A (10 - 200A)
  ocpChargeDelay: number;         // ms (100 - 30000ms)
  ocpChargeRecovery: number;      // A (threshold - 10%)

  // Over Current Protection - Discharge
  ocpDischargeThreshold: number;  // A (10 - 200A)
  ocpDischargeDelay: number;      // ms (100 - 30000ms)
  ocpDischargeRecovery: number;   // A

  // Short Circuit Protection
  scpThreshold: number;           // A (200 - 1000A)
  scpDelay: number;               // us (50 - 500us)

  // Current Alarms
  highChargeCurrentAlarm: number;    // A
  highDischargeCurrentAlarm: number; // A
}

// ============================================
// TEMPERATURE PROTECTION PARAMETERS
// ============================================

export interface TemperatureProtectionParams {
  // Charge Over Temperature (COT)
  cotThreshold: number;           // °C (40 - 70°C, default 55°C)
  cotRecovery: number;            // °C (threshold - 5°C)

  // Charge Under Temperature (CUT)
  cutThreshold: number;           // °C (-20 - 10°C, default 0°C for LiFePO4)
  cutRecovery: number;            // °C (threshold + 5°C)

  // Discharge Over Temperature (DOT)
  dotThreshold: number;           // °C (50 - 80°C, default 60°C)
  dotRecovery: number;            // °C

  // Discharge Under Temperature (DUT)
  dutThreshold: number;           // °C (-30 - 0°C, default -20°C)
  dutRecovery: number;            // °C

  // MOS Temperature Protection
  mosOverTemp: number;            // °C (default 100°C)
  mosOverTempRecovery: number;    // °C

  // Environment Temperature Compensation
  tempCompensationEnabled: boolean;
  tempCompensationCoefficient: number; // mV/°C

  // Temperature Alarms
  highTempAlarm: number;          // °C
  lowTempAlarm: number;           // °C
}

// ============================================
// SOC CALIBRATION PARAMETERS
// ============================================

export interface SOCCalibrationParams {
  // SOC Voltage Mapping
  soc100Voltage: number;          // V per cell (3.45 - 3.55V)
  soc0Voltage: number;            // V per cell (2.50 - 2.90V)

  // Capacity Settings
  fullChargeCapacity: number;     // Ah (nominal)
  designCapacity: number;         // Ah (original)
  currentCapacity: number;        // Ah (measured)

  // Coulomb Counter Settings
  coulombCounterResetInterval: number; // days (0 = disabled)
  autoCalibrationEnabled: boolean;
  calibrationVoltageHigh: number; // V per cell (triggers 100% cal)
  calibrationVoltageLow: number;  // V per cell (triggers 0% cal)

  // OCV Table (Open Circuit Voltage)
  ocvTable: OCVTableEntry[];

  // Self-discharge Compensation
  selfDischargeRate: number;      // %/month
  selfDischargeCompensation: boolean;
}

export interface OCVTableEntry {
  soc: number;                    // 0-100%
  voltage: number;                // V per cell
}

// ============================================
// BALANCING PARAMETERS
// ============================================

export interface BalancingParams {
  // Balance Triggers
  balanceEnabled: boolean;
  balanceStartVoltage: number;    // V per cell (3.30 - 3.50V)
  balanceDeltaTrigger: number;    // mV (20 - 100mV)

  // Balance Current
  balanceCurrent: number;         // mA (50 - 200mA)
  maxBalanceTime: number;         // minutes per session

  // Balance Window (when to balance)
  balanceDuringCharge: boolean;
  balanceDuringRest: boolean;
  balanceDuringDischarge: boolean;

  // Balance Type
  balanceType: 'passive' | 'active';

  // Active Balance Specific
  activeBalanceMinDelta?: number;   // mV
  activeBalanceMaxCurrent?: number; // mA

  // Monitoring
  balanceTimeLimit: number;       // total hours before alert
  balanceEfficiencyAlert: number; // % threshold
}

// ============================================
// CAPACITY & POWER PARAMETERS
// ============================================

export interface CapacityPowerParams {
  // Nominal Values
  nominalCapacity: number;        // Ah
  nominalVoltage: number;         // V
  nominalEnergy: number;          // kWh

  // Usable Range
  usableCapacity: number;         // Ah (adjusted for SOH)
  reserveCapacity: number;        // % (5-20%)

  // Power Limits
  maxChargePower: number;         // kW
  maxDischargePower: number;      // kW
  continuousChargePower: number;  // kW (sustained)
  continuousDischargePower: number; // kW

  // Ramp Rates
  powerRampRate: number;          // kW/s (0.1 - 5.0)

  // C-Rate Limits
  maxChargeRate: number;          // C (e.g., 1.0C)
  maxDischargeRate: number;       // C

  // Efficiency Parameters
  chargeEfficiency: number;       // % (default 98%)
  dischargeEfficiency: number;    // % (default 98%)
  inverterEfficiency: number;     // % (default 96%)
}

// ============================================
// COMMUNICATION PARAMETERS
// ============================================

export interface CommunicationParams {
  // Modbus Settings
  modbusAddress: number;          // 1 - 247
  modbusBaudRate: 9600 | 19200 | 38400 | 57600 | 115200;
  modbusParity: 'none' | 'even' | 'odd';
  modbusStopBits: 1 | 2;
  modbusDataBits: 7 | 8;

  // CAN Bus Settings
  canEnabled: boolean;
  canBaudRate: 125000 | 250000 | 500000 | 1000000;
  canNodeId: number;
  canProtocol: 'standard' | 'j1939' | 'canopen';

  // Communication Timeouts
  communicationTimeout: number;   // ms (3000 - 30000)
  heartbeatInterval: number;      // seconds (5 - 60)
  retryCount: number;             // 1 - 10
  retryDelay: number;             // ms

  // Data Logging
  loggingInterval: number;        // seconds (1 - 60)
  detailedLogging: boolean;
}

// ============================================
// ALARM SETTINGS
// ============================================

export interface AlarmSettings {
  // Alarm Enable/Disable
  alarms: AlarmConfig[];

  // Global Settings
  alarmAutoReset: boolean;
  alarmDelay: number;             // ms (general delay)

  // Notification Routing per Alarm Type
  notificationRouting: NotificationRouting[];
}

export interface AlarmConfig {
  type: AlarmType;
  enabled: boolean;
  delay: number;                  // ms
  autoReset: boolean;
  resetDelay: number;             // ms (time after condition clears)
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export enum AlarmType {
  CELL_OVERVOLTAGE = 'cell_overvoltage',
  CELL_UNDERVOLTAGE = 'cell_undervoltage',
  PACK_OVERVOLTAGE = 'pack_overvoltage',
  PACK_UNDERVOLTAGE = 'pack_undervoltage',
  CHARGE_OVERCURRENT = 'charge_overcurrent',
  DISCHARGE_OVERCURRENT = 'discharge_overcurrent',
  SHORT_CIRCUIT = 'short_circuit',
  CHARGE_OVERTEMP = 'charge_overtemp',
  CHARGE_UNDERTEMP = 'charge_undertemp',
  DISCHARGE_OVERTEMP = 'discharge_overtemp',
  DISCHARGE_UNDERTEMP = 'discharge_undertemp',
  MOS_OVERTEMP = 'mos_overtemp',
  CELL_IMBALANCE = 'cell_imbalance',
  COMMUNICATION_FAILURE = 'communication_failure',
  SOC_LOW = 'soc_low',
  SOC_HIGH = 'soc_high',
  SOH_LOW = 'soh_low',
}

export interface NotificationRouting {
  alarmType: AlarmType;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'email' | 'whatsapp' | 'telegram' | 'push' | 'sms' | 'voice';
  enabled: boolean;
  recipients?: string[];          // specific recipients (if empty, use defaults)
  escalationDelay?: number;       // minutes before escalation
}

// ============================================
// PARAMETER DEPENDENCY RULES
// ============================================

export interface ParameterDependency {
  parameter: string;              // e.g., 'voltageProtection.ovpRecovery'
  dependsOn: string;              // e.g., 'voltageProtection.ovpThreshold'
  rule: DependencyRule;
  gap?: number;                   // required gap (e.g., 50mV)
  message: string;                // user-friendly explanation
}

export enum DependencyRule {
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  WITHIN_RANGE = 'within_range',
  DEPENDS_ON_CHEMISTRY = 'depends_on_chemistry',
  DEPENDS_ON_HARDWARE = 'depends_on_hardware',
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  parameter: string;
  value: unknown;
  message: string;
  rule: string;
  dependentParameter?: string;
  dependentValue?: unknown;
  suggestedFix?: {
    adjustParameter: string;
    suggestedValue: unknown;
  };
}

export interface ValidationWarning {
  parameter: string;
  value: unknown;
  message: string;
  recommendation?: string;
}

// ============================================
// CONFIGURATION CHANGE HISTORY
// ============================================

export interface ConfigurationChange {
  id: string;
  systemId: string;
  configurationId: string;

  timestamp: Date;
  userId: string;
  userName: string;
  userRole: string;

  changeType: 'create' | 'update' | 'restore' | 'approve' | 'reject';

  // What changed
  changes: ParameterChange[];

  // Context
  reason: string;                 // required for critical changes
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;

  // For rollback
  previousConfigSnapshot?: Partial<BMSConfiguration>;
}

export interface ParameterChange {
  category: string;               // e.g., 'voltageProtection'
  parameter: string;              // e.g., 'ovpThreshold'
  previousValue: unknown;
  newValue: unknown;
  isCritical: boolean;
}

// ============================================
// BMS TEMPLATES
// ============================================

export interface BMSTemplate {
  id: string;
  name: string;
  description: string;
  manufacturer: string;           // e.g., 'JBD', 'Daly', 'ANT'
  model: string;
  chemistry: 'LiFePO4' | 'Li-ion' | 'Lead-acid';
  cellCount: number;

  // Default configuration for this template
  defaultConfig: Partial<BMSConfiguration>;

  // Modbus register map
  registerMap: ModbusRegisterMap;

  createdAt: Date;
  updatedAt: Date;
  isBuiltIn: boolean;             // system templates vs user-created
}

export interface ModbusRegisterMap {
  // Read-only registers (telemetry)
  telemetryRegisters: ModbusRegister[];

  // Read-write registers (configuration)
  configRegisters: ModbusRegister[];

  // Command registers
  commandRegisters: ModbusRegister[];
}

export interface ModbusRegister {
  name: string;
  address: number;
  length: number;                 // number of registers
  dataType: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string';
  scaleFactor: number;            // multiply by this to get real value
  unit: string;
  access: 'read' | 'write' | 'readwrite';
  description: string;

  // Mapping to EMS parameter
  emsParameter?: string;          // e.g., 'voltageProtection.ovpThreshold'
}
