/**
 * Fleet Management Types for Lifo4 EMS
 * Utility-scale fleet management capabilities
 */

// ============================================
// FLEET MANAGEMENT
// ============================================

export interface Fleet {
  id: string;
  organizationId: string;
  name: string;
  description?: string;

  // Systems in Fleet
  systemIds: string[];
  siteIds: string[];

  // Configuration
  config: FleetConfiguration;

  // Aggregated Status
  status: FleetStatus;

  // SLA Configuration
  slaConfig?: SLAConfiguration;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FleetConfiguration {
  // Control Settings
  centralizedControl: boolean;
  autoDispatch: boolean;

  // Alerting
  alertAggregation: boolean;
  alertEscalation: AlertEscalationConfig;

  // Reporting
  consolidatedReporting: boolean;
  benchmarkingEnabled: boolean;

  // Maintenance
  maintenanceCoordination: boolean;
  firmwareRolloutStrategy: 'immediate' | 'staged' | 'manual';

  // Grid Services
  aggregatedGridServices: boolean;
  virtualPowerPlant: boolean;
}

export interface AlertEscalationConfig {
  levels: EscalationLevel[];
  autoEscalate: boolean;
  escalationDelay: number;             // minutes
}

export interface EscalationLevel {
  level: number;
  name: string;
  recipients: string[];                // user IDs
  channels: ('email' | 'sms' | 'phone' | 'push')[];
  responseTimeout: number;             // minutes before next level
}

export interface FleetStatus {
  totalSystems: number;
  onlineSystems: number;
  offlineSystems: number;
  alertingSystems: number;
  maintenanceSystems: number;

  // Aggregated Metrics
  totalCapacity: number;               // MWh
  totalPower: number;                  // MW
  averageSoc: number;                  // %
  averageSoh: number;                  // %

  // Energy Today
  totalEnergyCharged: number;          // MWh
  totalEnergyDischarged: number;       // MWh

  // Financial
  totalSavingsToday: number;           // R$
  totalRevenueToday: number;           // R$

  // Grid Services
  activeGridServices: string[];
  gridServicesRevenue: number;         // R$

  lastUpdate: Date;
}

// ============================================
// SLA MANAGEMENT
// ============================================

export interface SLAConfiguration {
  id: string;
  fleetId?: string;                    // null = system-level
  systemId?: string;
  name: string;

  // Contract Period
  contractStart: Date;
  contractEnd: Date;

  // Availability Targets
  monthlyUptimeTarget: number;         // % (e.g., 99.5)
  annualUptimeTarget: number;          // % (e.g., 99.9)
  responseTimeTarget: number;          // minutes for critical alerts

  // Performance Targets
  roundTripEfficiencyTarget: number;   // %
  capacityAvailabilityTarget: number;  // %
  powerResponseTimeTarget: number;     // seconds

  // Exclusions
  exclusions: SLAExclusion[];

  // Penalties/Credits
  penalties: SLAPenalty[];

  // Contact Information
  primaryContact: ContactInfo;
  escalationContacts: ContactInfo[];

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAExclusion {
  type: 'scheduled_maintenance' | 'force_majeure' | 'customer_caused' | 'grid_outage' | 'other';
  description: string;
  requiresNotice: boolean;
  noticeHours?: number;                // hours of advance notice required
}

export interface SLAPenalty {
  condition: string;                   // e.g., "monthly uptime < 99.5%"
  thresholdValue: number;
  penaltyType: 'credit_percentage' | 'fixed_amount' | 'termination_right';
  penaltyValue: number;                // % or R$
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface SLAReport {
  id: string;
  slaConfigId: string;
  systemId?: string;
  fleetId?: string;

  period: {
    start: Date;
    end: Date;
  };

  // Availability Metrics
  totalTime: number;                   // hours
  uptime: number;                      // hours
  downtime: number;                    // hours
  scheduledMaintenance: number;        // hours
  excludedTime: number;                // hours
  calculatedUptime: number;            // % (after exclusions)
  targetUptime: number;                // %
  slaAchieved: boolean;

  // Incidents
  incidents: SLAIncident[];
  totalIncidents: number;
  mttr: number;                        // Mean Time To Repair (hours)
  mtbf: number;                        // Mean Time Between Failures (hours)

  // Performance Metrics
  averageEfficiency: number;           // %
  capacityAvailability: number;        // %
  averageResponseTime: number;         // ms

  // Credits/Penalties
  creditDue: number;                   // R$
  creditApplied: boolean;

  // Compliance Status
  complianceStatus: 'compliant' | 'warning' | 'breach';
  complianceNotes?: string;

  generatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface SLAIncident {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;                   // minutes
  type: 'outage' | 'degradation' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  rootCause?: string;
  resolution?: string;
  excluded: boolean;
  exclusionReason?: string;
  affectedSla: boolean;
}

// ============================================
// FLEET OPERATIONS
// ============================================

export interface BulkOperation {
  id: string;
  fleetId?: string;
  organizationId: string;

  type: BulkOperationType;
  name: string;
  description?: string;

  // Target Selection
  targetSystemIds: string[];
  targetSiteIds?: string[];
  targetSelection: 'all' | 'selected' | 'filter';
  filterCriteria?: Record<string, unknown>;

  // Operation Details
  payload: Record<string, unknown>;

  // Execution
  strategy: 'immediate' | 'staged' | 'scheduled';
  stagedConfig?: StagedRolloutConfig;
  scheduledTime?: Date;

  // Progress
  status: BulkOperationStatus;
  progress: BulkOperationProgress;

  // Results
  results: BulkOperationResult[];

  createdAt: Date;
  createdBy: string;
  startedAt?: Date;
  completedAt?: Date;
}

export enum BulkOperationType {
  SET_OPERATION_MODE = 'set_operation_mode',
  UPDATE_CONFIGURATION = 'update_configuration',
  FIRMWARE_UPDATE = 'firmware_update',
  APPLY_PROFILE = 'apply_profile',
  SCHEDULE_MAINTENANCE = 'schedule_maintenance',
  SET_CHARGING_PROFILE = 'set_charging_profile',
  EMERGENCY_STOP = 'emergency_stop',
  RESET = 'reset',
}

export interface StagedRolloutConfig {
  stages: RolloutStage[];
  pauseOnFailure: boolean;
  failureThreshold: number;            // % failures to pause
  rollbackOnFailure: boolean;
}

export interface RolloutStage {
  percentage: number;                  // % of systems
  delayMinutes: number;                // wait before next stage
  requireApproval: boolean;
}

export enum BulkOperationStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLING_BACK = 'rolling_back',
}

export interface BulkOperationProgress {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
  currentStage?: number;
  totalStages?: number;
}

export interface BulkOperationResult {
  systemId: string;
  systemName: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

// ============================================
// FLEET ANALYTICS
// ============================================

export interface FleetAnalytics {
  fleetId: string;
  period: {
    start: Date;
    end: Date;
  };

  // System Status Distribution
  systemStatusDistribution: Record<string, number>;

  // Performance Metrics
  averageEfficiency: number;           // %
  averageSoc: number;                  // %
  averageSoh: number;                  // %
  averageUptime: number;               // %

  // Energy Metrics
  totalEnergyCharged: number;          // MWh
  totalEnergyDischarged: number;       // MWh
  totalEnergyThroughput: number;       // MWh
  totalCycles: number;

  // Financial Metrics
  totalSavings: number;                // R$
  totalRevenue: number;                // R$
  savingsPerMwh: number;               // R$/MWh

  // Alerts & Issues
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  mostCommonAlerts: AlertFrequency[];

  // Grid Services
  gridServicesParticipation: GridServiceStats[];

  // Benchmarking
  topPerformers: SystemBenchmark[];
  underPerformers: SystemBenchmark[];

  generatedAt: Date;
}

export interface AlertFrequency {
  type: string;
  count: number;
  percentage: number;
  affectedSystems: number;
}

export interface GridServiceStats {
  service: string;
  participatingSystems: number;
  totalCapacity: number;               // MW
  totalEnergy: number;                 // MWh
  revenue: number;                     // R$
}

export interface SystemBenchmark {
  systemId: string;
  systemName: string;
  siteName: string;

  // Performance Scores (0-100)
  overallScore: number;
  efficiencyScore: number;
  availabilityScore: number;
  savingsScore: number;

  // Key Metrics
  efficiency: number;                  // %
  uptime: number;                      // %
  soh: number;                         // %
  savingsPerKwh: number;               // R$/kWh

  // Comparison to Fleet Average
  vsFleetEfficiency: number;           // % difference
  vsFleetAvailability: number;
  vsFleetSavings: number;
}

// ============================================
// FIRMWARE MANAGEMENT
// ============================================

export interface FirmwareVersion {
  id: string;
  version: string;
  releaseDate: Date;
  releaseNotes: string;
  changelog: string[];

  // Compatibility
  compatibleModels: string[];
  minPreviousVersion?: string;

  // Files
  firmwareUrl: string;
  fileSize: number;                    // bytes
  checksum: string;                    // SHA-256
  signature: string;                   // RSA signature

  // Status
  status: 'draft' | 'testing' | 'released' | 'deprecated';
  isLatest: boolean;
  isCritical: boolean;                 // security patch

  // Statistics
  installationCount: number;
  successRate: number;                 // %

  createdAt: Date;
  updatedAt: Date;
}

export interface FirmwareUpdate {
  id: string;
  systemId: string;
  firmwareVersionId: string;
  targetVersion: string;

  // Status
  status: FirmwareUpdateStatus;
  progress: number;                    // 0-100%
  currentStep: string;

  // Timing
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Previous Version (for rollback)
  previousVersion: string;
  canRollback: boolean;
  rolledBack: boolean;

  // Errors
  error?: string;
  retryCount: number;
  maxRetries: number;

  createdAt: Date;
  createdBy: string;
}

export enum FirmwareUpdateStatus {
  SCHEDULED = 'scheduled',
  DOWNLOADING = 'downloading',
  VERIFYING = 'verifying',
  INSTALLING = 'installing',
  REBOOTING = 'rebooting',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled',
}

// ============================================
// CONFIGURATION PROFILES
// ============================================

export interface ConfigurationProfile {
  id: string;
  organizationId: string;
  name: string;
  description?: string;

  // Profile Type
  type: 'operation' | 'protection' | 'optimization' | 'full';

  // Configuration Values
  configuration: Partial<{
    operationMode: string;
    protectionSettings: Record<string, unknown>;
    optimizationSettings: Record<string, unknown>;
    schedules: Record<string, unknown>[];
    chargingProfiles: Record<string, unknown>[];
  }>;

  // Applicability
  applicableModels?: string[];
  applicableChemistries?: string[];

  // Metadata
  isDefault: boolean;
  usageCount: number;

  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

// ============================================
// MAINTENANCE COORDINATION
// ============================================

export interface MaintenanceSchedule {
  id: string;
  fleetId?: string;
  systemId?: string;
  organizationId: string;

  // Schedule Type
  type: 'preventive' | 'corrective' | 'predictive' | 'calibration' | 'inspection';
  title: string;
  description?: string;

  // Timing
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;

  // Assignment
  assignedTechnician?: string;
  assignedTeam?: string;

  // Status
  status: MaintenanceStatus;
  priority: 'urgent' | 'high' | 'normal' | 'low';

  // Checklist
  checklist: MaintenanceChecklistItem[];

  // Parts & Materials
  requiredParts: MaintenancePart[];
  partsAvailable: boolean;

  // Notes & Documentation
  notes?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  workReport?: string;

  // SLA Impact
  notifiedCustomer: boolean;
  slaExemption: boolean;

  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export enum MaintenanceStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export interface MaintenanceChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
  required: boolean;
}

export interface MaintenancePart {
  partNumber: string;
  description: string;
  quantity: number;
  available: boolean;
  reservedFor?: string;                // maintenance ID
}
