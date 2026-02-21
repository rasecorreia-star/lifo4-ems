import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.lifo4.com.br';
const API_VERSION = 'v1';

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const authData = await SecureStore.getItemAsync('lifo4-auth');
      if (authData) {
        const { state } = JSON.parse(authData);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      }
    } catch (e) {
      console.warn('Error reading auth token:', e);
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const authData = await SecureStore.getItemAsync('lifo4-auth');
        if (authData) {
          const { state } = JSON.parse(authData);
          if (state?.refreshToken) {
            const response = await axios.post(`${API_URL}/api/${API_VERSION}/auth/refresh`, {
              refreshToken: state.refreshToken,
            });

            const { tokens } = response.data.data;

            // Update stored tokens
            const newState = {
              ...state,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            };
            await SecureStore.setItemAsync('lifo4-auth', JSON.stringify({ state: newState }));

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        // Refresh failed, user needs to re-login
        await SecureStore.deleteItemAsync('lifo4-auth');
      }
    }

    return Promise.reject(error);
  }
);

// API Response Types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Auth API
export const authApi = {
  login: (data: { email: string; password: string; twoFactorCode?: string }) =>
    api.post<ApiResponse<{ user: any; tokens: { accessToken: string; refreshToken: string }; requires2FA?: boolean }>>('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string }; user?: any }>>('/auth/refresh', { refreshToken }),

  getProfile: () => api.get<ApiResponse<any>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Systems API
export const systemsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse<any[]>>('/systems', { params }),

  getById: (systemId: string) =>
    api.get<ApiResponse<any>>(`/systems/${systemId}`),

  getOverview: () =>
    api.get<ApiResponse<any>>('/systems/overview'),
};

// Telemetry API
export const telemetryApi = {
  getCurrent: (systemId: string) =>
    api.get<ApiResponse<any>>(`/telemetry/${systemId}/current`),

  getHistory: (systemId: string, params?: any) =>
    api.get<ApiResponse<any[]>>(`/telemetry/${systemId}/history`, { params }),
};

// Alerts API
export const alertsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse<any[]>>('/alerts', { params }),

  getSummary: () =>
    api.get<ApiResponse<any>>('/alerts/summary'),

  markAsRead: (alertId: string) =>
    api.post(`/alerts/${alertId}/read`),

  acknowledge: (alertId: string, notes?: string) =>
    api.post(`/alerts/${alertId}/acknowledge`, { notes }),
};

// Control API
export const controlApi = {
  setMode: (systemId: string, mode: string) =>
    api.post(`/control/${systemId}/mode`, { mode }),

  startCharge: (systemId: string, options?: any) =>
    api.post(`/control/${systemId}/charge/start`, options),

  stopCharge: (systemId: string) =>
    api.post(`/control/${systemId}/charge/stop`),

  startDischarge: (systemId: string, options?: any) =>
    api.post(`/control/${systemId}/discharge/start`, options),

  stopDischarge: (systemId: string) =>
    api.post(`/control/${systemId}/discharge/stop`),

  emergencyStop: (systemId: string, reason?: string) =>
    api.post(`/control/${systemId}/emergency-stop`, { reason }),
};

// EV Chargers API
export const evChargersApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse<any[]>>('/ev-chargers', { params }),

  getById: (chargerId: string) =>
    api.get<ApiResponse<any>>(`/ev-chargers/${chargerId}`),

  getStatus: (chargerId: string) =>
    api.get<ApiResponse<any>>(`/ev-chargers/${chargerId}/status`),

  startCharging: (chargerId: string, connectorId: number, idTag?: string) =>
    api.post(`/ev-chargers/${chargerId}/start`, { connectorId, idTag }),

  stopCharging: (chargerId: string, connectorId?: number) =>
    api.post(`/ev-chargers/${chargerId}/stop`, { connectorId }),

  getActiveSessions: () =>
    api.get<ApiResponse<any[]>>('/ev-chargers/sessions/active'),

  getSessionHistory: (params?: any) =>
    api.get<ApiResponse<any[]>>('/ev-chargers/sessions', { params }),

  getSession: (chargerId: string, sessionId: string) =>
    api.get<ApiResponse<any>>(`/ev-chargers/${chargerId}/sessions/${sessionId}`),
};

// Cameras API
export const camerasApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse<any[]>>('/cameras', { params }),

  getById: (cameraId: string) =>
    api.get<ApiResponse<any>>(`/cameras/${cameraId}`),

  getStats: () =>
    api.get<ApiResponse<any>>('/cameras/stats'),

  getStreamUrl: (cameraId: string) =>
    api.get<ApiResponse<{ url: string }>>(`/cameras/${cameraId}/stream`),

  takeSnapshot: (cameraId: string) =>
    api.post<ApiResponse<{ url: string }>>(`/cameras/${cameraId}/snapshot`),

  startRecording: (cameraId: string) =>
    api.post(`/cameras/${cameraId}/recording/start`),

  stopRecording: (cameraId: string) =>
    api.post(`/cameras/${cameraId}/recording/stop`),

  ptzControl: (cameraId: string, command: { pan?: string; tilt?: string; zoom?: string }) =>
    api.post(`/cameras/${cameraId}/ptz`, command),

  getEvents: (cameraId: string, params?: any) =>
    api.get<ApiResponse<any[]>>(`/cameras/${cameraId}/events`, { params }),

  getAllEvents: (params?: any) =>
    api.get<ApiResponse<any[]>>('/cameras/events', { params }),

  acknowledgeEvent: (eventId: string) =>
    api.post(`/cameras/events/${eventId}/acknowledge`),
};

// Microgrids API
export const microgridsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse<any[]>>('/microgrids', { params }),

  getById: (microgridId: string) =>
    api.get<ApiResponse<any>>(`/microgrids/${microgridId}`),

  getStatus: (microgridId: string) =>
    api.get<ApiResponse<any>>(`/microgrids/${microgridId}/status`),

  setMode: (microgridId: string, mode: string) =>
    api.post(`/microgrids/${microgridId}/mode`, { mode }),

  initiateIslanding: (microgridId: string, reason?: string) =>
    api.post(`/microgrids/${microgridId}/island`, { reason }),

  reconnectToGrid: (microgridId: string) =>
    api.post(`/microgrids/${microgridId}/reconnect`),

  initiateBlackStart: (microgridId: string) =>
    api.post(`/microgrids/${microgridId}/blackstart`),

  getComponents: (microgridId: string) =>
    api.get<ApiResponse<any[]>>(`/microgrids/${microgridId}/components`),
};

// Prospects API
export const prospectsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse<any[]>>('/prospects', { params }),

  getById: (prospectId: string) =>
    api.get<ApiResponse<any>>(`/prospects/${prospectId}`),

  getStatistics: () =>
    api.get<ApiResponse<any>>('/prospects/statistics'),

  updateStage: (prospectId: string, stage: string) =>
    api.put(`/prospects/${prospectId}/stage`, { stage }),

  addNote: (prospectId: string, content: string, category?: string) =>
    api.post(`/prospects/${prospectId}/notes`, { content, category }),

  getNotes: (prospectId: string) =>
    api.get<ApiResponse<any[]>>(`/prospects/${prospectId}/notes`),

  getActivities: (prospectId: string) =>
    api.get<ApiResponse<any[]>>(`/prospects/${prospectId}/activities`),

  addActivity: (prospectId: string, data: any) =>
    api.post(`/prospects/${prospectId}/activities`, data),

  getAnalysis: (prospectId: string) =>
    api.get<ApiResponse<any>>(`/prospects/${prospectId}/analysis`),

  getRecommendations: (prospectId: string) =>
    api.get<ApiResponse<any[]>>(`/prospects/${prospectId}/recommendations`),
};

export default api;
