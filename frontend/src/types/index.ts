/**
 * Core types for Lifo4 EMS Frontend
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
    start: string;
    end: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  cnpj?: string;
  contactEmail: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SYSTEM TYPES
// ============================================

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
  batterySpec: BatterySpecification;
  status: SystemStatus;
  connectionStatus: ConnectionStatus;
  lastCommunication?: Date;
  deviceId: string;
  mqttTopic: string;
  firmwareVersion?: string;
  operationMode?: OperationMode;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatterySpecification {
  chemistry: 'LiFePO4' | 'Li-ion' | 'Lead-acid';
  nominalCapacity: number;
  nominalVoltage: number;
  energyCapacity: number;
  cellCount: number;
  cellsInParallel: number;
  maxChargeCurrent: number;
  maxDischargeCurrent: number;
  maxChargeVoltage: number;
  minDischargeVoltage: number;
  maxTemperature: number;
  minTemperature: number;
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
  DEGRADED = 'degraded',
}

export enum OperationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
  ECONOMIC = 'economic',
  GRID_SUPPORT = 'grid_support',
  MAINTENANCE = 'maintenance',
  EMERGENCY = 'emergency',
}

// ============================================
// TELEMETRY TYPES
// ============================================

export interface TelemetryData {
  id: string;
  systemId: string;
  timestamp: Date;
  soc: number;
  soh: number;
  totalVoltage: number;
  current: number;
  power: number;
  temperature: TemperatureData;
  cells: CellData[];
  chargeCapacity: number;
  energyRemaining: number;
  cycleCount: number;
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
  sensors: number[];
}

export interface CellData {
  index: number;
  voltage: number;
  temperature?: number;
  isBalancing: boolean;
  status: CellStatus;
}

export enum CellStatus {
  NORMAL = 'normal',
  ATTENTION = 'attention',
  CRITICAL = 'critical',
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
// ALERT TYPES
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

// ============================================
// PROTECTION SETTINGS
// ============================================

export interface ProtectionSettings {
  id: string;
  systemId: string;
  cellOvervoltage: number;
  cellUndervoltage: number;
  cellOvervoltageRecovery: number;
  cellUndervoltageRecovery: number;
  maxChargeCurrent: number;
  maxDischargeCurrent: number;
  chargeHighTemp: number;
  chargeLowTemp: number;
  dischargeHighTemp: number;
  dischargeLowTemp: number;
  balanceStartVoltage: number;
  balanceDeltaVoltage: number;
  minSoc: number;
  maxSoc: number;
  updatedAt: Date;
  updatedBy: string;
}

// ============================================
// SCHEDULE TYPES
// ============================================

export interface Schedule {
  id: string;
  systemId: string;
  name: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  action: ScheduleAction;
  targetSoc?: number;
  powerLimit?: number;
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

// ============================================
// CHART DATA TYPES
// ============================================

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
}

export interface MultiSeriesChartData {
  timestamps: Date[];
  series: {
    name: string;
    data: number[];
    color?: string;
  }[];
}

// ============================================
// SYSTEM OVERVIEW
// ============================================

export interface SystemsOverview {
  total: number;
  online: number;
  offline: number;
  error: number;
  charging: number;
  discharging: number;
}

export interface AlertsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unread: number;
  unacknowledged: number;
}
