/**
 * Core types for Lifo4 EMS
 */

// ============================================
// USER & ORGANIZATION TYPES
// ============================================

export enum UserRole {
  SUPER_ADMIN = 'super_admin',    // Lifo4 - acesso total a todos clientes
  ADMIN = 'admin',                // Admin do cliente - acesso total aos SEUS sistemas
  MANAGER = 'manager',            // Gerente - relatórios, sem editar usuários
  TECHNICIAN = 'technician',      // Técnico - config técnicas com aprovação
  OPERATOR = 'operator',          // Operador - controle básico
  VIEWER = 'viewer',              // Visualização apenas
  USER = 'user',                  // Cliente final - acesso APENAS aos sistemas permitidos
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  organizationId: string;
  permissions: Permission[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences: NotificationPreferences;
  language: 'pt-BR' | 'en' | 'es';
  theme: 'dark' | 'light' | 'system';

  // Campos para usuário final (USER role)
  allowedSystems?: string[];        // IDs dos sistemas que o usuário pode acessar
  invitedBy?: string;               // ID do usuário que convidou (para convite de familiares)
  isEndUser?: boolean;              // Flag para identificar cliente final
  canInviteFamily?: boolean;        // Pode convidar familiares com mesmo acesso
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'control')[];
}

export interface Organization {
  id: string;
  name: string;
  cnpj?: string;
  address?: Address;
  contactEmail: string;
  contactPhone?: string;
  isActive: boolean;
  parentOrganizationId?: string; // For Lifo4 as parent
  createdAt: Date;
  updatedAt: Date;
  settings: OrganizationSettings;
}

export interface OrganizationSettings {
  maxUsers: number;
  maxSystems: number;
  features: string[];
  tariffProfile?: TariffProfile;
}

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// ============================================
// SITE & SYSTEM TYPES
// ============================================

export interface Site {
  id: string;
  name: string;
  organizationId: string;
  address: Address;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BessSystem {
  id: string;
  name: string;
  siteId: string;
  organizationId: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  installationDate: Date;
  warrantyExpiration?: Date;

  // Battery specifications
  batterySpec: BatterySpecification;

  // Current status
  status: SystemStatus;
  connectionStatus: ConnectionStatus;
  lastCommunication?: Date;

  // Device identification
  deviceId: string;  // ESP32 unique ID
  mqttTopic: string;
  firmwareVersion?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatterySpecification {
  chemistry: 'LiFePO4' | 'Li-ion' | 'Lead-acid';
  nominalCapacity: number;      // Ah
  nominalVoltage: number;       // V
  energyCapacity: number;       // kWh
  cellCount: number;            // Number of cells in series
  cellsInParallel: number;      // Number of parallel strings
  maxChargeCurrent: number;     // A
  maxDischargeCurrent: number;  // A
  maxChargeVoltage: number;     // V per cell
  minDischargeVoltage: number;  // V per cell
  maxTemperature: number;       // °C
  minTemperature: number;       // °C
}

export enum SystemStatus {
  IDLE = 'idle',
  CHARGING = 'charging',
  DISCHARGING = 'discharging',
  BALANCING = 'balancing',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}

export enum ConnectionStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',  // Intermittent connection
}

// ============================================
// TELEMETRY TYPES
// ============================================

export interface TelemetryData {
  id: string;
  systemId: string;
  timestamp: Date;

  // Pack level data
  soc: number;                  // State of Charge (%)
  soh: number;                  // State of Health (%)
  totalVoltage: number;         // V
  current: number;              // A (positive = charging, negative = discharging)
  power: number;                // W

  // Temperature data
  temperature: TemperatureData;

  // Cell level data
  cells: CellData[];

  // Calculated values
  chargeCapacity: number;       // Ah remaining
  energyRemaining: number;      // kWh remaining
  cycleCount: number;

  // Status flags
  isCharging: boolean;
  isDischarging: boolean;
  isBalancing: boolean;
  alarms: AlarmFlag[];
  warnings: WarningFlag[];
}

export interface TemperatureData {
  min: number;
  max: number;
  average: number;
  sensors: number[];  // Individual sensor readings
}

export interface CellData {
  index: number;              // Cell number (1-16)
  voltage: number;            // V
  temperature?: number;       // °C
  isBalancing: boolean;
  status: CellStatus;
}

export enum CellStatus {
  NORMAL = 'normal',
  ATTENTION = 'attention',    // Near limits
  CRITICAL = 'critical',      // Out of limits
  UNKNOWN = 'unknown',
}

export enum AlarmFlag {
  OVERVOLTAGE = 'overvoltage',
  UNDERVOLTAGE = 'undervoltage',
  OVERCURRENT_CHARGE = 'overcurrent_charge',
  OVERCURRENT_DISCHARGE = 'overcurrent_discharge',
  OVERTEMPERATURE = 'overtemperature',
  UNDERTEMPERATURE = 'undertemperature',
  CELL_IMBALANCE = 'cell_imbalance',
  SHORT_CIRCUIT = 'short_circuit',
  COMMUNICATION_ERROR = 'communication_error',
}

export enum WarningFlag {
  HIGH_TEMPERATURE = 'high_temperature',
  LOW_TEMPERATURE = 'low_temperature',
  HIGH_VOLTAGE = 'high_voltage',
  LOW_VOLTAGE = 'low_voltage',
  CELL_IMBALANCE_WARNING = 'cell_imbalance_warning',
  LOW_SOH = 'low_soh',
}

// ============================================
// CONTROL & PROTECTION TYPES
// ============================================

export enum OperationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
  ECONOMIC = 'economic',
  GRID_SUPPORT = 'grid_support',
  MAINTENANCE = 'maintenance',
  EMERGENCY = 'emergency',
}

export interface ProtectionSettings {
  id: string;
  systemId: string;

  // Voltage limits
  cellOvervoltage: number;              // V (default 3.65)
  cellUndervoltage: number;             // V (default 2.5)
  cellOvervoltageRecovery: number;      // V
  cellUndervoltageRecovery: number;     // V

  // Current limits
  maxChargeCurrent: number;             // A
  maxDischargeCurrent: number;          // A

  // Temperature limits
  chargeHighTemp: number;               // °C
  chargeLowTemp: number;                // °C
  dischargeHighTemp: number;            // °C
  dischargeLowTemp: number;             // °C

  // Balance settings
  balanceStartVoltage: number;          // V
  balanceDeltaVoltage: number;          // mV - max delta between cells

  // SOC limits
  minSoc: number;                       // % - stop discharge
  maxSoc: number;                       // % - stop charge

  updatedAt: Date;
  updatedBy: string;
}

export interface Schedule {
  id: string;
  systemId: string;
  name: string;
  isActive: boolean;

  // Schedule timing
  startTime: string;          // HH:mm format
  endTime: string;
  daysOfWeek: number[];       // 0-6, Sunday = 0

  // Action
  action: ScheduleAction;
  targetSoc?: number;         // For charge/discharge
  powerLimit?: number;        // W

  createdAt: Date;
  updatedAt: Date;
}

export enum ScheduleAction {
  CHARGE = 'charge',
  DISCHARGE = 'discharge',
  IDLE = 'idle',
  PEAK_SHAVING = 'peak_shaving',
}

// ============================================
// ALERT & NOTIFICATION TYPES
// ============================================

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface Alert {
  id: string;
  systemId: string;
  organizationId: string;

  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, unknown>;

  isRead: boolean;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;

  createdAt: Date;
  resolvedAt?: Date;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    criticalOnly: boolean;
  };
  whatsapp: {
    enabled: boolean;
    phone?: string;
    criticalOnly: boolean;
  };
  push: {
    enabled: boolean;
  };
  telegram: {
    enabled: boolean;
    chatId?: string;
  };
  quietHours: {
    enabled: boolean;
    start: string;  // HH:mm
    end: string;
  };
}

// ============================================
// REPORT & ANALYTICS TYPES
// ============================================

export interface CycleRecord {
  id: string;
  systemId: string;

  startTime: Date;
  endTime: Date;

  startSoc: number;
  endSoc: number;
  depthOfDischarge: number;   // %

  energyCharged: number;      // kWh
  energyDischarged: number;   // kWh
  efficiency: number;         // Round-trip efficiency %

  avgTemperature: number;
  maxTemperature: number;
  minTemperature: number;

  type: 'charge' | 'discharge' | 'full';
}

export interface Report {
  id: string;
  systemId: string;
  organizationId: string;

  type: ReportType;
  period: {
    start: Date;
    end: Date;
  };

  status: 'pending' | 'generating' | 'completed' | 'failed';
  fileUrl?: string;
  fileName?: string;

  createdAt: Date;
  createdBy: string;
}

export enum ReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
  MAINTENANCE = 'maintenance',
}

// ============================================
// TARIFF TYPES
// ============================================

export interface TariffProfile {
  id: string;
  name: string;
  utility: string;              // e.g., "Equatorial Energia PI"

  // Time-of-use periods
  periods: TariffPeriod[];

  // Flag tariffs (bandeiras)
  flagTariffs?: {
    green: number;
    yellow: number;
    red1: number;
    red2: number;
  };

  validFrom: Date;
  validUntil?: Date;
}

export interface TariffPeriod {
  name: string;               // e.g., "Ponta", "Fora de Ponta"
  startTime: string;          // HH:mm
  endTime: string;
  rate: number;               // R$/kWh
  daysOfWeek: number[];       // 0-6
}

// ============================================
// AUDIT & MAINTENANCE TYPES
// ============================================

export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;

  action: string;
  resource: string;
  resourceId?: string;

  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;

  timestamp: Date;
}

export interface MaintenanceRecord {
  id: string;
  systemId: string;

  type: MaintenanceType;
  description: string;

  scheduledDate?: Date;
  completedDate?: Date;

  technician?: string;
  notes?: string;

  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

  createdAt: Date;
  updatedAt: Date;
}

export enum MaintenanceType {
  INSPECTION = 'inspection',
  CALIBRATION = 'calibration',
  FIRMWARE_UPDATE = 'firmware_update',
  CLEANING = 'cleaning',
  REPAIR = 'repair',
  REPLACEMENT = 'replacement',
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
