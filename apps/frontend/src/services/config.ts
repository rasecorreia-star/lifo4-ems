/**
 * Configuração centralizada de URLs e endpoints da API
 * Todas as variáveis vêm de import.meta.env (Vite)
 */

// Validar que as variáveis obrigatórias estão definidas
function validateEnv() {
  const required = ['VITE_API_URL', 'VITE_WS_URL'];
  const missing = required.filter(key => !import.meta.env[key as keyof ImportMetaEnv]);

  if (missing.length > 0) {
    const error = `❌ CRITICAL: Variáveis de environment não definidas: ${missing.join(', ')}\n` +
      'Copie .env.example para .env e preencha os valores.\n' +
      'FASE 1 SECURITY: Falha intencional para evitar ambiente mal configurado.';
    console.error(error);
    throw new Error(error);
  }
}

// Validar variáveis de demo mode se ativado
function validateDemoMode() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  if (isDemoMode) {
    const required = ['VITE_DEMO_EMAIL', 'VITE_DEMO_PASSWORD'];
    const missing = required.filter(key => !import.meta.env[key as keyof ImportMetaEnv]);

    if (missing.length > 0) {
      const error = `❌ CRITICAL: Demo mode ativado mas variáveis ausentes: ${missing.join(', ')}\n` +
        'DEMO MODE REQUER: VITE_DEMO_EMAIL e VITE_DEMO_PASSWORD no arquivo .env\n' +
        'Copie .env.example para .env e defina as credenciais de demo.';
      console.error(error);
      throw new Error(error);
    }
  }
}

validateEnv();
validateDemoMode();

// API Configuration
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL,
  version: import.meta.env.VITE_API_VERSION || 'v1',
  wsURL: import.meta.env.VITE_WS_URL,
  timeout: 30000,
  retryAttempts: 3,
} as const;

// Endpoints
export const API_ENDPOINTS = {
  // Auth
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    profile: '/auth/profile',
  },

  // Systems
  systems: {
    list: '/systems',
    detail: (id: string) => `/systems/${id}`,
    connection: (id: string) => `/systems/${id}/connection`,
    create: '/systems',
    update: (id: string) => `/systems/${id}`,
  },

  // Telemetry
  telemetry: {
    current: (id: string) => `/telemetry/${id}/current`,
    history: (id: string) => `/telemetry/${id}/history`,
    cells: (id: string) => `/telemetry/${id}/cells`,
  },

  // Control
  control: {
    command: '/control/command',
    charge: (id: string) => `/control/${id}/charge/start`,
    discharge: (id: string) => `/control/${id}/discharge/start`,
    emergencyStop: (id: string) => `/control/${id}/emergency-stop`,
  },

  // Optimization
  optimization: {
    status: (id: string) => `/optimization/${id}/status`,
    config: (id: string) => `/optimization/${id}/config`,
  },
} as const;

// App Configuration
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'Lifo4 EMS',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  pwaEnabled: import.meta.env.VITE_ENABLE_PWA === 'true',
  analyticsEnabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  sentryEnabled: import.meta.env.VITE_ENABLE_SENTRY === 'true',
  sentryDSN: import.meta.env.VITE_SENTRY_DSN || '',
} as const;

// Demo Mode Configuration
// NOTE: validateDemoMode() ensures these exist if DEMO_MODE=true
export const DEMO_CONFIG = {
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  email: import.meta.env.VITE_DEMO_EMAIL,  // Validated in validateDemoMode()
  password: import.meta.env.VITE_DEMO_PASSWORD,  // Validated in validateDemoMode()
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  pwa: APP_CONFIG.pwaEnabled,
  analytics: APP_CONFIG.analyticsEnabled,
  sentry: APP_CONFIG.sentryEnabled,
} as const;

/**
 * Construir URL completa da API
 * @param endpoint Endpoint relativo (ex: '/systems')
 * @returns URL completa (ex: 'http://localhost:3001/api/v1/systems')
 */
export function buildApiUrl(endpoint: string): string {
  const baseURL = API_CONFIG.baseURL.replace(/\/$/, ''); // Remove trailing slash
  const version = API_CONFIG.version;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseURL}/api/${version}${path}`;
}

/**
 * Log de configuração (development only)
 */
// Removed: console.log for production code cleanliness
// Enable during development if needed for debugging
