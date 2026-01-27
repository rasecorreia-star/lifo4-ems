import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, authApi } from '../services/api';

// Secure storage adapter for Zustand persist
const secureStorage = {
  getItem: async (name: string) => {
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
  USER = 'user',
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  language: 'pt-BR' | 'en' | 'es';
  theme: 'dark' | 'light' | 'system';
  allowedSystems?: string[];
  isEndUser?: boolean;
  canInviteFamily?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;

  // Actions
  login: (email: string, password: string, twoFactorCode?: string) => Promise<boolean>;
  loginWithBiometrics: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => void;
  checkBiometricsAvailable: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      biometricsEnabled: false,
      biometricsAvailable: false,

      checkBiometricsAvailable: async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        set({ biometricsAvailable: compatible && enrolled });
      },

      login: async (email, password, twoFactorCode) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email, password, twoFactorCode });

          if (response.data.data?.requires2FA) {
            set({ isLoading: false });
            return false;
          }

          const { user, tokens } = response.data.data!;

          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || 'Login falhou',
            isLoading: false,
          });
          return false;
        }
      },

      loginWithBiometrics: async () => {
        const { biometricsEnabled, refreshToken } = get();

        if (!biometricsEnabled || !refreshToken) {
          return false;
        }

        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Autentique-se para entrar',
            cancelLabel: 'Cancelar',
            disableDeviceFallback: false,
          });

          if (result.success) {
            set({ isLoading: true });
            const success = await get().refreshAuth();
            set({ isLoading: false });
            return success;
          }

          return false;
        } catch (error) {
          console.error('Biometric auth error:', error);
          return false;
        }
      },

      logout: async () => {
        const { accessToken } = get();

        if (accessToken) {
          try {
            await authApi.logout();
          } catch {
            // Ignore logout errors
          }
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          biometricsEnabled: false,
        });
      },

      refreshAuth: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const response = await authApi.refreshToken(refreshToken);
          const { tokens, user } = response.data.data!;

          set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: user || get().user,
            isAuthenticated: true,
          });

          return true;
        } catch {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      checkAuth: async () => {
        const { accessToken, refreshToken } = get();

        await get().checkBiometricsAvailable();

        if (!accessToken && !refreshToken) {
          set({ isLoading: false });
          return;
        }

        if (accessToken) {
          try {
            const response = await authApi.getProfile();
            set({
              user: response.data.data!,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } catch {
            // Token might be expired, try refresh
          }
        }

        if (refreshToken) {
          const success = await get().refreshAuth();
          if (success) {
            try {
              const response = await authApi.getProfile();
              set({
                user: response.data.data!,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            } catch {
              // Refresh worked but profile failed
            }
          }
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      enableBiometrics: async () => {
        const { biometricsAvailable } = get();

        if (!biometricsAvailable) {
          return false;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Habilitar login biométrico',
          cancelLabel: 'Cancelar',
        });

        if (result.success) {
          set({ biometricsEnabled: true });
          return true;
        }

        return false;
      },

      disableBiometrics: () => {
        set({ biometricsEnabled: false });
      },
    }),
    {
      name: 'lifo4-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        biometricsEnabled: state.biometricsEnabled,
      }),
    }
  )
);
