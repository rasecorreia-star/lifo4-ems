/**
 * Shared constants for LIFO4 EMS
 * Battery specs, limits, thresholds, etc.
 */

// ============================================================================
// Battery Specifications
// ============================================================================

export const BATTERY_SPECS = {
  // LiFePO4 typical specifications
  nominalVoltage: {
    single: 3.2, // V per cell
    pack4s: 12.8, // 4-series LiFePO4
    pack8s: 25.6, // 8-series
    pack16s: 51.2, // 16-series (common)
    pack24s: 76.8, // 24-series
  },

  // Voltage limits
  voltageThresholds: {
    min: {
      single: 2.5, // V per cell
      pack4s: 10.0,
      pack16s: 40.0,
    },
    max: {
      single: 3.65, // V per cell
      pack4s: 14.6,
      pack16s: 58.4,
    },
  },

  // Temperature limits (Celsius)
  temperatureThresholds: {
    discharge: { min: -10, max: 55, warning: 50 },
    charge: { min: 0, max: 45, warning: 40 },
    storage: { min: -20, max: 45 },
  },

  // Current limits (Amps)
  currentLimits: {
    maxDischarge: 200, // A (example, varies by pack)
    maxCharge: 100, // A
    peakDischarge: 300, // A short-term
  },

  // Cycle life
  cycleLife: 5000, // typical LiFePO4
  nominalCapacity: 100, // Ah (example)
};

// ============================================================================
// System Limits
// ============================================================================

export const SYSTEM_LIMITS = {
  // Power (kW)
  maxChargeRate: 50,
  maxDischargeRate: 50,

  // Energy (kWh)
  minEnergy: 0,
  maxEnergy: 100,

  // Frequency of status updates (ms)
  telemetryIntervalMs: 1000,
  telemetryIntervalMsLowPower: 5000,

  // Command execution
  commandTimeoutMs: 30000,
  commandRetries: 3,

  // WebSocket
  websocketHeartbeatMs: 30000,
  websocketReconnectMs: 5000,
};

// ============================================================================
// MQTT Topics
// ============================================================================

export const MQTT_TOPICS = {
  // Telemetry (published by edge/backend)
  telemetry: (systemId: string) => `lifo4/systems/${systemId}/telemetry`,
  status: (systemId: string) => `lifo4/systems/${systemId}/status`,
  events: (systemId: string) => `lifo4/systems/${systemId}/events`,

  // Commands (published by backend, subscribed by edge)
  commands: (systemId: string) => `lifo4/systems/${systemId}/commands`,
  commandResponse: (systemId: string) => `lifo4/systems/${systemId}/commands/response`,

  // System health
  health: (systemId: string) => `lifo4/systems/${systemId}/health`,
  logs: (systemId: string) => `lifo4/systems/${systemId}/logs`,
};

// ============================================================================
// API Endpoints
// ============================================================================

export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    profile: '/auth/profile',
  },

  // Systems
  systems: {
    list: '/systems',
    get: (id: string) => `/systems/${id}`,
    create: '/systems',
    update: (id: string) => `/systems/${id}`,
    delete: (id: string) => `/systems/${id}`,
  },

  // Telemetry
  telemetry: {
    current: (systemId: string) => `/telemetry/${systemId}/current`,
    history: (systemId: string) => `/telemetry/${systemId}/history`,
    cells: (systemId: string) => `/telemetry/${systemId}/cells`,
  },

  // Control
  control: {
    command: '/control/command',
    charge: (systemId: string) => `/control/${systemId}/charge`,
    discharge: (systemId: string) => `/control/${systemId}/discharge`,
    stop: (systemId: string) => `/control/${systemId}/stop`,
  },

  // Health
  health: '/health',
  version: '/version',
};

// ============================================================================
// Status Enums & Strings
// ============================================================================

export const SYSTEM_STATUS_COLORS = {
  operational: '#10b981', // green
  standby: '#6366f1', // indigo
  error: '#ef4444', // red
  maintenance: '#f59e0b', // amber
} as const;

export const CONTROL_ACTION_LABELS = {
  charge: 'Carregar',
  discharge: 'Descarregar',
  stop: 'Parar',
  standby: 'Espera',
  reset: 'Resetar',
} as const;

export const COMMAND_STATUS_LABELS = {
  pending: 'Aguardando',
  executing: 'Executando',
  completed: 'Concluído',
  failed: 'Falhou',
} as const;

// ============================================================================
// Validation Rules
// ============================================================================

export const VALIDATION_RULES = {
  // Email
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    minLength: 5,
    maxLength: 255,
  },

  // Password
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },

  // System name
  systemName: {
    minLength: 3,
    maxLength: 100,
  },

  // Numeric ranges
  soc: { min: 0, max: 100 }, // State of Charge %
  soh: { min: 0, max: 100 }, // State of Health %
  temperature: { min: -50, max: 100 }, // Celsius
  voltage: { min: 0, max: 200 }, // Volts
  current: { min: -1000, max: 1000 }, // Amps
};

// ============================================================================
// Cache Durations (seconds)
// ============================================================================

export const CACHE_DURATIONS = {
  userProfile: 300, // 5 minutes
  systemList: 60, // 1 minute
  telemetryCurrent: 10, // 10 seconds
  telemetryHistory: 300, // 5 minutes
  configuration: 3600, // 1 hour
};

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION_DEFAULTS = {
  pageSize: 20,
  maxPageSize: 100,
  firstPage: 1,
};

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DEVICE_ERROR: 'DEVICE_ERROR',
  TIMEOUT: 'TIMEOUT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG = {
  logLevel: 'info' as const,
  timezone: 'UTC',
  locale: 'pt-BR',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};
