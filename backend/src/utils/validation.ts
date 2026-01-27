import { z } from 'zod';

/**
 * Zod validation schemas for API requests
 */

// ============================================
// COMMON SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(data => data.startDate <= data.endDate, {
  message: 'Start date must be before or equal to end date',
});

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  twoFactorCode: z.string().length(6).optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().optional(),
  organizationId: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ============================================
// USER SCHEMAS
// ============================================

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  role: z.enum(['admin', 'technician', 'operator', 'viewer']),
  organizationId: z.string(),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.enum(['create', 'read', 'update', 'delete', 'control'])),
  })).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'technician', 'operator', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  notificationPreferences: z.object({
    email: z.object({
      enabled: z.boolean(),
      criticalOnly: z.boolean(),
    }).optional(),
    whatsapp: z.object({
      enabled: z.boolean(),
      phone: z.string().optional(),
      criticalOnly: z.boolean(),
    }).optional(),
    push: z.object({
      enabled: z.boolean(),
    }).optional(),
    quietHours: z.object({
      enabled: z.boolean(),
      start: z.string(),
      end: z.string(),
    }).optional(),
  }).optional(),
});

// ============================================
// ORGANIZATION SCHEMAS
// ============================================

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  cnpj: z.string().optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z.object({
    street: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('Brasil'),
  }).optional(),
});

// ============================================
// SYSTEM SCHEMAS
// ============================================

export const createSystemSchema = z.object({
  name: z.string().min(2).max(100),
  siteId: z.string(),
  serialNumber: z.string(),
  model: z.string(),
  manufacturer: z.string(),
  installationDate: z.coerce.date(),
  warrantyExpiration: z.coerce.date().optional(),
  deviceId: z.string(),
  mqttTopic: z.string(),
  batterySpec: z.object({
    chemistry: z.enum(['LiFePO4', 'Li-ion', 'Lead-acid']).default('LiFePO4'),
    nominalCapacity: z.number().positive(),
    nominalVoltage: z.number().positive(),
    energyCapacity: z.number().positive(),
    cellCount: z.number().int().positive().default(16),
    cellsInParallel: z.number().int().positive().default(1),
    maxChargeCurrent: z.number().positive(),
    maxDischargeCurrent: z.number().positive(),
    maxChargeVoltage: z.number().positive().default(3.65),
    minDischargeVoltage: z.number().positive().default(2.5),
    maxTemperature: z.number().default(60),
    minTemperature: z.number().default(0),
  }),
});

export const updateSystemSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  firmwareVersion: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// PROTECTION SETTINGS SCHEMAS
// ============================================

export const updateProtectionSettingsSchema = z.object({
  cellOvervoltage: z.number().min(3.0).max(4.0).optional(),
  cellUndervoltage: z.number().min(2.0).max(3.0).optional(),
  cellOvervoltageRecovery: z.number().optional(),
  cellUndervoltageRecovery: z.number().optional(),
  maxChargeCurrent: z.number().positive().optional(),
  maxDischargeCurrent: z.number().positive().optional(),
  chargeHighTemp: z.number().optional(),
  chargeLowTemp: z.number().optional(),
  dischargeHighTemp: z.number().optional(),
  dischargeLowTemp: z.number().optional(),
  balanceStartVoltage: z.number().optional(),
  balanceDeltaVoltage: z.number().optional(),
  minSoc: z.number().min(0).max(100).optional(),
  maxSoc: z.number().min(0).max(100).optional(),
});

// ============================================
// SCHEDULE SCHEMAS
// ============================================

export const createScheduleSchema = z.object({
  name: z.string().min(2).max(100),
  systemId: z.string(),
  isActive: z.boolean().default(true),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  daysOfWeek: z.array(z.number().min(0).max(6)),
  action: z.enum(['charge', 'discharge', 'idle', 'peak_shaving']),
  targetSoc: z.number().min(0).max(100).optional(),
  powerLimit: z.number().positive().optional(),
});

// ============================================
// CONTROL SCHEMAS
// ============================================

export const sendCommandSchema = z.object({
  systemId: z.string(),
  command: z.enum([
    'start_charge',
    'stop_charge',
    'start_discharge',
    'stop_discharge',
    'emergency_stop',
    'reset_alarms',
    'start_balance',
    'stop_balance',
    'set_mode',
    'calibrate_soc',
  ]),
  params: z.record(z.unknown()).optional(),
});

export const setOperationModeSchema = z.object({
  systemId: z.string(),
  mode: z.enum(['auto', 'manual', 'economic', 'grid_support', 'maintenance', 'emergency']),
});

// ============================================
// REPORT SCHEMAS
// ============================================

export const generateReportSchema = z.object({
  systemId: z.string(),
  type: z.enum(['daily', 'weekly', 'monthly', 'custom', 'maintenance']),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
});

// ============================================
// ALERT SCHEMAS
// ============================================

export const acknowledgeAlertSchema = z.object({
  alertId: z.string(),
  notes: z.string().optional(),
});

export const alertQuerySchema = z.object({
  systemId: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  isRead: z.coerce.boolean().optional(),
  isAcknowledged: z.coerce.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// ============================================
// TELEMETRY SCHEMAS
// ============================================

export const telemetryQuerySchema = z.object({
  systemId: z.string(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  resolution: z.enum(['raw', '1m', '5m', '15m', '1h', '1d']).default('5m'),
  fields: z.array(z.string()).optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateSystemInput = z.infer<typeof createSystemSchema>;
export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type SendCommandInput = z.infer<typeof sendCommandSchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
