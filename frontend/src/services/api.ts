import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  User,
  BessSystem,
  TelemetryData,
  Alert,
  ProtectionSettings,
  Schedule,
  SystemsOverview,
  AlertsSummary,
  ApiResponse,
  PaginationParams,
} from '../types';

// Em produção, VITE_API_URL vazio significa usar URL relativa (mesmo host)
const API_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:3001';
const API_VERSION = import.meta.env.VITE_API_VERSION;

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_VERSION ? `${API_URL}/api/${API_VERSION}` : `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authData = localStorage.getItem('lifo4-auth');
    if (authData) {
      const { state } = JSON.parse(authData);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const authData = localStorage.getItem('lifo4-auth');
        if (authData) {
          const { state } = JSON.parse(authData);
          if (state?.refreshToken) {
            const response = await axios.post(`${API_URL}/api/${API_VERSION}/auth/refresh`, {
              refreshToken: state.refreshToken,
            });

            const { tokens } = response.data.data;

            // Update stored tokens
            const newState = { ...state, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
            localStorage.setItem('lifo4-auth', JSON.stringify({ state: newState }));

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        // Refresh failed, redirect to login
        localStorage.removeItem('lifo4-auth');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================

// Use dev-login in development mode (bypasses Firebase)
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const authApi = {
  login: (data: { email: string; password: string; twoFactorCode?: string }) =>
    api.post<ApiResponse<{ user: User; tokens: { accessToken: string; refreshToken: string }; requires2FA?: boolean }>>(
      isDev ? '/auth/dev-login' : '/auth/login',
      data
    ),

  register: (data: { email: string; password: string; name: string }) =>
    api.post<ApiResponse<{ user: User; tokens: { accessToken: string; refreshToken: string } }>>('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>('/auth/refresh', { refreshToken }),

  getProfile: () => api.get<ApiResponse<User>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  setup2FA: () => api.post<ApiResponse<{ secret: string; qrCodeUrl: string }>>('/auth/2fa/setup'),

  verify2FA: (code: string) => api.post('/auth/2fa/verify', { code }),

  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),
};

// ============================================
// SYSTEMS API
// ============================================

export const systemsApi = {
  getAll: (params?: PaginationParams) =>
    api.get<ApiResponse<BessSystem[]>>('/systems', { params }),

  getById: (systemId: string) =>
    api.get<ApiResponse<BessSystem>>(`/systems/${systemId}`),

  create: (data: Partial<BessSystem>) =>
    api.post<ApiResponse<BessSystem>>('/systems', data),

  update: (systemId: string, data: Partial<BessSystem>) =>
    api.patch<ApiResponse<BessSystem>>(`/systems/${systemId}`, data),

  delete: (systemId: string) =>
    api.delete(`/systems/${systemId}`),

  getOverview: () =>
    api.get<ApiResponse<SystemsOverview>>('/systems/overview'),

  getProtectionSettings: (systemId: string) =>
    api.get<ApiResponse<ProtectionSettings>>(`/systems/${systemId}/protection`),

  updateProtectionSettings: (systemId: string, data: Partial<ProtectionSettings>) =>
    api.patch<ApiResponse<ProtectionSettings>>(`/systems/${systemId}/protection`, data),
};

// ============================================
// TELEMETRY API
// ============================================

export const telemetryApi = {
  getCurrent: (systemId: string) =>
    api.get<ApiResponse<TelemetryData>>(`/telemetry/${systemId}/current`),

  getHistory: (systemId: string, params?: { startDate?: string; endDate?: string; resolution?: string }) =>
    api.get<ApiResponse<TelemetryData[]>>(`/telemetry/${systemId}/history`, { params }),

  getCells: (systemId: string) =>
    api.get<ApiResponse<TelemetryData['cells']>>(`/telemetry/${systemId}/cells`),

  getRange: (systemId: string, startDate: string, endDate: string, resolution?: string) =>
    api.get(`/telemetry/${systemId}/range`, { params: { startDate, endDate, resolution } }),

  getSocHistory: (systemId: string, period?: string) =>
    api.get(`/telemetry/${systemId}/soc`, { params: { period } }),

  getEnergyStats: (systemId: string, startDate: string, endDate: string) =>
    api.get(`/telemetry/${systemId}/energy`, { params: { startDate, endDate } }),
};

// ============================================
// CONTROL API
// ============================================

export const controlApi = {
  sendCommand: (systemId: string, command: string, params?: Record<string, unknown>) =>
    api.post('/control/command', { systemId, command, params }),

  setMode: (systemId: string, mode: string) =>
    api.post(`/control/${systemId}/mode`, { mode }),

  emergencyStop: (systemId: string, reason?: string) =>
    api.post(`/control/${systemId}/emergency-stop`, { reason }),

  startCharge: (systemId: string, options?: { targetSoc?: number; maxCurrent?: number }) =>
    api.post(`/control/${systemId}/charge/start`, options),

  stopCharge: (systemId: string) =>
    api.post(`/control/${systemId}/charge/stop`),

  startDischarge: (systemId: string, options?: { targetSoc?: number; maxCurrent?: number; power?: number }) =>
    api.post(`/control/${systemId}/discharge/start`, options),

  stopDischarge: (systemId: string) =>
    api.post(`/control/${systemId}/discharge/stop`),

  resetAlarms: (systemId: string) =>
    api.post(`/control/${systemId}/reset-alarms`),

  startBalance: (systemId: string) =>
    api.post(`/control/${systemId}/balance/start`),

  stopBalance: (systemId: string) =>
    api.post(`/control/${systemId}/balance/stop`),

  calibrateSoc: (systemId: string, actualSoc: number) =>
    api.post(`/control/${systemId}/calibrate-soc`, { actualSoc }),

  // Connect/Disconnect
  connect: (systemId: string) =>
    api.post(`/control/${systemId}/connect`),

  disconnect: (systemId: string) =>
    api.post(`/control/${systemId}/disconnect`),

  // Schedules
  getSchedules: (systemId: string) =>
    api.get<ApiResponse<Schedule[]>>(`/control/${systemId}/schedules`),

  createSchedule: (data: Partial<Schedule>) =>
    api.post<ApiResponse<Schedule>>('/control/schedules', data),

  updateSchedule: (scheduleId: string, data: Partial<Schedule>) =>
    api.patch<ApiResponse<Schedule>>(`/control/schedules/${scheduleId}`, data),

  deleteSchedule: (scheduleId: string) =>
    api.delete(`/control/schedules/${scheduleId}`),
};

// ============================================
// ALERTS API
// ============================================

export const alertsApi = {
  getAll: (params?: PaginationParams & { systemId?: string; severity?: string; isRead?: boolean }) =>
    api.get<ApiResponse<Alert[]>>('/alerts', { params }),

  getById: (alertId: string) =>
    api.get<ApiResponse<Alert>>(`/alerts/${alertId}`),

  markAsRead: (alertId: string) =>
    api.post(`/alerts/${alertId}/read`),

  acknowledge: (alertId: string, notes?: string) =>
    api.post(`/alerts/${alertId}/acknowledge`, { notes }),

  resolve: (alertId: string, notes?: string) =>
    api.post(`/alerts/${alertId}/resolve`, { notes }),

  markMultipleAsRead: (alertIds: string[]) =>
    api.post('/alerts/read-multiple', { alertIds }),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/alerts/unread-count'),

  getSummary: () =>
    api.get<ApiResponse<AlertsSummary>>('/alerts/summary'),
};

// ============================================
// REPORTS API
// ============================================

export const reportsApi = {
  generate: (systemId: string, type: string, startDate?: string, endDate?: string, format?: string) =>
    api.post('/reports/generate', { systemId, type, startDate, endDate, format }),

  getAll: (params?: PaginationParams) =>
    api.get('/reports', { params }),

  download: (reportId: string) =>
    api.get(`/reports/${reportId}/download`, { responseType: 'blob' }),
};

// ============================================
// USERS API
// ============================================

export interface CreateUserInput {
  email: string;
  name: string;
  phone?: string;
  role: string;
  isEndUser?: boolean;
  allowedSystems?: string[];
  canInviteFamily?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  allowedSystems?: string[];
  canInviteFamily?: boolean;
}

export interface InviteFamilyInput {
  email: string;
  name: string;
}

export const usersApi = {
  getAll: (params?: PaginationParams & { role?: string; isActive?: boolean }) =>
    api.get<ApiResponse<User[]>>('/users', { params }),

  getById: (userId: string) =>
    api.get<ApiResponse<User>>(`/users/${userId}`),

  create: (data: CreateUserInput) =>
    api.post<ApiResponse<User>>('/users', data),

  update: (userId: string, data: UpdateUserInput) =>
    api.patch<ApiResponse<User>>(`/users/${userId}`, data),

  delete: (userId: string) =>
    api.delete(`/users/${userId}`),

  deactivate: (userId: string) =>
    api.post(`/users/${userId}/deactivate`),

  activate: (userId: string) =>
    api.post(`/users/${userId}/activate`),

  inviteFamily: (data: InviteFamilyInput) =>
    api.post<ApiResponse<User>>('/users/invite-family', data),

  resendInvite: (userId: string) =>
    api.post(`/users/${userId}/resend-invite`),
};

// ============================================
// ORGANIZATIONS API
// ============================================

import { Organization } from '../types';

export interface CreateOrganizationInput {
  name: string;
  cnpj?: string;
  contactEmail: string;
  contactPhone?: string;
}

export const organizationsApi = {
  getAll: (params?: PaginationParams) =>
    api.get<ApiResponse<Organization[]>>('/organizations', { params }),

  getById: (orgId: string) =>
    api.get<ApiResponse<Organization>>(`/organizations/${orgId}`),

  create: (data: CreateOrganizationInput) =>
    api.post<ApiResponse<Organization>>('/organizations', data),

  update: (orgId: string, data: Partial<Organization>) =>
    api.patch<ApiResponse<Organization>>(`/organizations/${orgId}`, data),

  delete: (orgId: string) =>
    api.delete(`/organizations/${orgId}`),

  getUsers: (orgId: string) =>
    api.get<ApiResponse<User[]>>(`/organizations/${orgId}/users`),

  getSystems: (orgId: string) =>
    api.get<ApiResponse<BessSystem[]>>(`/organizations/${orgId}/systems`),
};

// ============================================
// OPTIMIZATION API
// ============================================

export interface OptimizationConfig {
  strategy: string;
  minSoc?: number;
  maxSoc?: number;
  reserveCapacity?: number;
  maxChargeRate?: number;
  maxDischargeRate?: number;
  forecastHorizon?: number;
  updateInterval?: number;
}

export const optimizationApi = {
  start: (systemId: string, config: OptimizationConfig) =>
    api.post(`/optimization/${systemId}/start`, config),

  stop: (systemId: string) =>
    api.post(`/optimization/${systemId}/stop`),

  getSchedule: (systemId: string) =>
    api.get(`/optimization/${systemId}/schedule`),

  getRecommendation: (systemId: string) =>
    api.get(`/optimization/${systemId}/recommendation`),

  getStrategies: () =>
    api.get('/optimization/strategies'),

  getConfig: (systemId: string) =>
    api.get(`/optimization/${systemId}/config`),

  updateConfig: (systemId: string, config: Record<string, unknown>) =>
    api.put(`/optimization/${systemId}/config`, config),

  getResults: (systemId: string) =>
    api.get(`/optimization/${systemId}/results`),

  runOptimization: (systemId: string) =>
    api.post(`/optimization/${systemId}/run`),
};

// ============================================
// BLACK START API
// ============================================

export interface BlackStartConfig {
  gridLossDetectionTime?: number;
  transferTime?: number;
  minSocForBlackStart?: number;
  criticalLoads?: any[];
  loadSheddingEnabled?: boolean;
  autoReconnect?: boolean;
}

export const blackStartApi = {
  initialize: (systemId: string, config: BlackStartConfig) =>
    api.post(`/blackstart/${systemId}/init`, config),

  trigger: (systemId: string) =>
    api.post(`/blackstart/${systemId}/trigger`),

  reconnect: (systemId: string) =>
    api.post(`/blackstart/${systemId}/reconnect`),

  getStatus: (systemId: string) =>
    api.get(`/blackstart/${systemId}/status`),

  getHistory: (systemId: string, limit?: number) =>
    api.get(`/blackstart/${systemId}/history`, { params: { limit } }),
};

// ============================================
// GRID INTEGRATION API
// ============================================

export interface HybridSystemConfig {
  solarCapacity: number;
  bessCapacity: number;
  gridConnectionCapacity: number;
  exportLimit?: number;
  importLimit?: number;
  meterIds: {
    grid: string;
    solar: string;
    bess: string;
    load: string;
  };
  controlMode?: string;
  priorityOrder?: string[];
}

export const gridApi = {
  initialize: (systemId: string, config: HybridSystemConfig) =>
    api.post(`/grid/${systemId}/init`, config),

  getPowerFlow: (systemId: string) =>
    api.get(`/grid/${systemId}/powerflow`),

  setControlMode: (systemId: string, mode: string) =>
    api.post(`/grid/${systemId}/mode`, { mode }),

  getControlModes: () =>
    api.get('/grid/modes'),

  getEnergyHistory: (systemId: string, start: string, end: string) =>
    api.get(`/grid/${systemId}/history`, { params: { start, end } }),
};

// ============================================
// HIGH AVAILABILITY API
// ============================================

export const haApi = {
  getClusterStatus: () =>
    api.get('/ha/cluster'),

  getHealthStatus: () =>
    api.get('/ha/health'),

  triggerFailover: (targetNodeId: string) =>
    api.post('/ha/failover', { targetNodeId }),

  getFailoverHistory: (limit?: number) =>
    api.get('/ha/failover/history', { params: { limit } }),
};

// ============================================
// HARDWARE API
// ============================================

export interface HardwareDeviceConfig {
  systemId: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  protocol: string;
  connectionConfig: Record<string, unknown>;
}

export const hardwareApi = {
  registerDevice: (device: HardwareDeviceConfig) =>
    api.post('/hardware/devices', device),

  getDevice: (deviceId: string) =>
    api.get(`/hardware/devices/${deviceId}`),

  getSystemDevices: (systemId: string) =>
    api.get(`/hardware/systems/${systemId}/devices`),

  sendCommand: (deviceId: string, command: string, params?: Record<string, unknown>) =>
    api.post(`/hardware/devices/${deviceId}/command`, { command, params }),

  autoDetect: (connectionConfig: Record<string, unknown>, protocol: string) =>
    api.post('/hardware/autodetect', { connectionConfig, protocol }),

  unregisterDevice: (deviceId: string) =>
    api.delete(`/hardware/devices/${deviceId}`),

  getSupportedDevices: () =>
    api.get('/hardware/supported'),

  getProtocols: () =>
    api.get('/hardware/protocols'),

  getDeviceTypes: () =>
    api.get('/hardware/types'),
};

export default api;
