import admin from 'firebase-admin';
import { config } from './index.js';

let firebaseApp: admin.app.App | null = null;
let firestoreDb: admin.firestore.Firestore | null = null;
let messagingInstance: admin.messaging.Messaging | null = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if we have credentials
  if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
    console.warn('Firebase credentials not configured. Using emulator or mock mode.');

    // Initialize without credentials for development
    firebaseApp = admin.initializeApp({
      projectId: config.firebase.projectId || 'lifo4-ems-dev',
    });
  } else {
    // Initialize with credentials
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
      storageBucket: config.firebase.storageBucket,
    });
  }

  console.log('Firebase Admin SDK initialized successfully');
  return firebaseApp;
}

/**
 * Get Firestore database instance
 */
export function getFirestore(): admin.firestore.Firestore {
  if (!firestoreDb) {
    if (!firebaseApp) {
      initializeFirebase();
    }
    firestoreDb = admin.firestore();

    // Configure Firestore settings
    firestoreDb.settings({
      ignoreUndefinedProperties: true,
    });
  }
  return firestoreDb;
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
}

/**
 * Get Firebase Storage bucket
 */
export function getStorage(): admin.storage.Storage {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.storage();
}

/**
 * Get Firebase Cloud Messaging instance
 */
export function getMessaging(): admin.messaging.Messaging {
  if (!messagingInstance) {
    if (!firebaseApp) {
      initializeFirebase();
    }
    messagingInstance = admin.messaging();
  }
  return messagingInstance;
}

// Lazy convenience exports for direct imports
export const firestore = {
  collection: (...args: Parameters<admin.firestore.Firestore['collection']>) => getFirestore().collection(...args),
  doc: (...args: Parameters<admin.firestore.Firestore['doc']>) => getFirestore().doc(...args),
  batch: () => getFirestore().batch(),
  runTransaction: <T>(fn: (transaction: admin.firestore.Transaction) => Promise<T>) => getFirestore().runTransaction(fn),
};

export const messaging = {
  send: (message: admin.messaging.Message) => getMessaging().send(message),
  sendEach: (messages: admin.messaging.Message[]) => getMessaging().sendEach(messages),
  subscribeToTopic: (tokens: string | string[], topic: string) => getMessaging().subscribeToTopic(tokens, topic),
  unsubscribeFromTopic: (tokens: string | string[], topic: string) => getMessaging().unsubscribeFromTopic(tokens, topic),
};

/**
 * Firestore collection names
 */
export const Collections = {
  // Core collections
  USERS: 'users',
  ORGANIZATIONS: 'organizations',
  SITES: 'sites',
  SYSTEMS: 'systems',

  // Telemetry data
  TELEMETRY: 'telemetry',
  TELEMETRY_HISTORY: 'telemetry_history',
  CELL_DATA: 'cell_data',

  // Alerts and events
  ALERTS: 'alerts',
  EVENTS: 'events',

  // Configuration
  SYSTEM_CONFIG: 'system_config',
  PROTECTION_SETTINGS: 'protection_settings',
  OPERATION_MODES: 'operation_modes',
  SCHEDULES: 'schedules',

  // BMS Configuration
  BMS_CONFIGS: 'bms_configs',
  BMS_CONFIG_PENDING: 'bms_config_pending',
  BMS_CONFIG_HISTORY: 'bms_config_history',
  BMS_CONFIG_CHANGES: 'bms_config_changes',
  BMS_TEMPLATES: 'bms_templates',

  // Camera & AI
  CAMERAS: 'cameras',
  CAMERA_EVENTS: 'camera_events',
  CAMERA_RECORDINGS: 'camera_recordings',
  SECURITY_ZONES: 'security_zones',
  VOICE_MESSAGES: 'voice_messages',

  // EV Chargers
  EV_CHARGERS: 'ev_chargers',
  CHARGING_SESSIONS: 'charging_sessions',
  CHARGING_PROFILES: 'charging_profiles',
  EV_AUTHORIZATIONS: 'ev_authorizations',
  EV_TARIFFS: 'ev_tariffs',
  EV_RESERVATIONS: 'ev_reservations',
  OCPP_COMMANDS: 'ocpp_commands',

  // Microgrids
  MICROGRIDS: 'microgrids',
  MICROGRID_COMPONENTS: 'microgrid_components',
  MICROGRID_EVENTS: 'microgrid_events',
  POWER_DISPATCHES: 'power_dispatches',
  ENERGY_TRADES: 'energy_trades',

  // Prospects & Pre-sales
  PROSPECTS: 'prospects',
  PROSPECT_ANALYSIS: 'prospect_analysis',
  PROSPECT_PROPOSALS: 'prospect_proposals',
  PROSPECT_NOTES: 'prospect_notes',
  PROSPECT_ACTIVITIES: 'prospect_activities',
  ANALYZER_KITS: 'analyzer_kits',

  // Fleet Management
  FLEETS: 'fleets',
  BULK_OPERATIONS: 'bulk_operations',
  FIRMWARE_VERSIONS: 'firmware_versions',
  FIRMWARE_UPDATES: 'firmware_updates',
  CONFIGURATION_PROFILES: 'configuration_profiles',

  // SLA Management
  SLA_CONFIGS: 'sla_configs',
  SLA_REPORTS: 'sla_reports',
  SLA_INCIDENTS: 'sla_incidents',

  // Maintenance
  MAINTENANCE_SCHEDULES: 'maintenance_schedules',
  MAINTENANCE_CHECKLISTS: 'maintenance_checklists',

  // Reports and analytics
  REPORTS: 'reports',
  CYCLES: 'cycles',
  MAINTENANCE: 'maintenance',

  // Audit
  AUDIT_LOGS: 'audit_logs',

  // Notifications
  NOTIFICATION_SETTINGS: 'notification_settings',
  NOTIFICATION_HISTORY: 'notification_history',

  // Sessions
  USER_SESSIONS: 'user_sessions',
  DEVICES: 'devices',

  // Grid Services
  GRID_SERVICES: 'grid_services',
  GRID_EVENTS: 'grid_events',

  // Tariffs
  TARIFF_PROFILES: 'tariff_profiles',
} as const;

/**
 * Create Firestore indexes for optimal querying
 */
export async function createIndexes(): Promise<void> {
  console.log('Firestore indexes should be created via Firebase Console or firebase.indexes.json');
}

export default {
  initializeFirebase,
  getFirestore,
  getAuth,
  getStorage,
  getMessaging,
  Collections,
  firestore,
  messaging,
};
