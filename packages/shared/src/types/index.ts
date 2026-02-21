/**
 * Shared TypeScript types for LIFO4 EMS
 * Used across frontend, backend, and edge controller
 */

// ============================================================================
// User & Authentication
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer' | 'service';

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthToken;
}

// ============================================================================
// Battery Systems
// ============================================================================

export interface System {
  id: string;
  name: string;
  location: string;
  type: 'battery' | 'hybrid' | 'solar+battery';
  status: SystemStatus;
  capacity: number; // kWh
  power: number; // kW
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export type SystemStatus = 'operational' | 'standby' | 'error' | 'maintenance';

// ============================================================================
// Battery Telemetry
// ============================================================================

export interface BatteryTelemetry {
  systemId: string;
  timestamp: string;

  // Energy
  voltage: number; // Volts
  current: number; // Amps
  power: number; // Watts (discharge negative)
  soc: number; // State of Charge 0-100%
  soh: number; // State of Health 0-100%

  // Temperature
  temperature: number; // Celsius
  temperatureMax?: number;
  temperatureMin?: number;

  // Status
  status: 'normal' | 'warning' | 'error';
  faults: string[];

  // Cycle info
  cycleCount: number;
  totalEnergy: number; // kWh total cycled
}

export interface CellTelemetry {
  systemId: string;
  cellNumber: number;
  voltage: number; // mV
  temperature: number; // Celsius
  resistance: number; // mΩ
}

// ============================================================================
// Control Commands
// ============================================================================

export interface ControlCommand {
  id: string;
  systemId: string;
  action: ControlAction;
  status: CommandStatus;
  parameters?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

export type ControlAction = 'charge' | 'discharge' | 'stop' | 'standby' | 'reset';
export type CommandStatus = 'pending' | 'executing' | 'completed' | 'failed';

export interface ChargeCommand extends ControlCommand {
  action: 'charge';
  parameters: {
    power: number; // kW
    duration?: number; // minutes
  };
}

export interface DischargeCommand extends ControlCommand {
  action: 'discharge';
  parameters: {
    power: number; // kW
    duration?: number; // minutes
  };
}

// ============================================================================
// API Responses
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: ApiResponse['meta'] & {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  timeout: number;
}

export interface MqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId: string;
  qos: 0 | 1 | 2;
}

export interface ModbusConfig {
  protocol: 'tcp' | 'rtu';
  host?: string;
  port?: number;
  serialPort?: string;
  baudRate?: number;
  slaveId: number;
}

// ============================================================================
// Error Handling
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export class EmsError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EmsError';
  }
}

// ============================================================================
// Events
// ============================================================================

export interface SystemEvent {
  id: string;
  systemId: string;
  type: SystemEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export type SystemEventType =
  | 'system_online'
  | 'system_offline'
  | 'charging_started'
  | 'discharging_started'
  | 'error_detected'
  | 'temperature_warning'
  | 'voltage_warning'
  | 'command_executed'
  | 'calibration_needed';
