import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string, twoFactorCode?: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
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

      login: async (email, password, twoFactorCode) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email, password, twoFactorCode });

          if (response.data.data?.requires2FA) {
            set({ isLoading: false });
            return false; // Indicates 2FA required
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
            error: error.response?.data?.error?.message || 'Login failed',
            isLoading: false,
          });
          return false;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.register({ email, password, name });
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
            error: error.response?.data?.error?.message || 'Registration failed',
            isLoading: false,
          });
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
        });
      },

      refreshAuth: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const response = await authApi.refreshToken(refreshToken);
          const { tokens } = response.data.data!;

          set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          });

          return true;
        } catch {
          // Refresh failed, clear auth
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

        // MODO DEMO: Controlado por variável de environment
        const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
        if (isDemoMode) {
          try {
            // NOTE: Demo credentials must be set in .env — NO hardcoded fallbacks
            const demoEmail = import.meta.env.VITE_DEMO_EMAIL;
            const demoPassword = import.meta.env.VITE_DEMO_PASSWORD;

            if (!demoEmail || !demoPassword) {
              throw new Error('Demo mode enabled but VITE_DEMO_EMAIL or VITE_DEMO_PASSWORD not set in .env');
            }

            const response = await authApi.login({
              email: demoEmail,
              password: demoPassword
            });
            const { user, tokens } = response.data.data!;
            set({
              user,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } catch (e) {
            console.error('Demo login failed:', e);
            // Fallback: continuar sem autenticação
            set({ isLoading: false });
            return;
          }
        }

        if (!accessToken && !refreshToken) {
          set({ isLoading: false });
          return;
        }

        // If we have an access token, try to get user profile
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

        // Try to refresh
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

        // All attempts failed
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
    }),
    {
      name: 'lifo4-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
