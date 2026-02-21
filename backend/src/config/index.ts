import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  },

  // MQTT
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clientId: process.env.MQTT_CLIENT_ID || 'lifo4-ems-server',
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'Lifo4 EMS <noreply@lifo4.com.br>',
  },

  // WhatsApp (Evolution API)
  whatsapp: {
    apiUrl: process.env.EVOLUTION_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'lifo4-ems',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // Push Notifications
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || '',
  },

  // Security
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  // Energy Tariff
  tariff: {
    apiUrl: process.env.TARIFF_API_URL || '',
    apiKey: process.env.TARIFF_API_KEY || '',
  },
} as const;

// Validate required environment variables in production
export function validateConfig(): void {
  const requiredInProduction = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
  ];

  if (config.env === 'production') {
    const missing = requiredInProduction.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

export default config;
