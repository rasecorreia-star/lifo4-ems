/**
 * SLA (Service Level Agreement) Types
 * Defines latency targets and compliance tracking for BESS systems
 */

// ============================================
// SLA TIER DEFINITIONS
// ============================================

export enum SLATier {
  PLATINUM = 'platinum',  // Critical infrastructure, lowest latency
  GOLD = 'gold',          // High-priority commercial
  SILVER = 'silver',      // Standard commercial
  BRONZE = 'bronze',      // Basic monitoring
}

export interface SLATargets {
  // Latency targets (milliseconds)
  telemetryLatency: number;      // Max time from sensor to database
  commandLatency: number;        // Max time for control commands
  alertLatency: number;          // Max time for alert propagation
  apiResponseLatency: number;    // Max API response time

  // Availability targets (percentage)
  availability: number;          // System uptime (e.g., 99.99)
  dataCompleteness: number;      // Data points collected vs expected

  // Throughput targets
  maxTelemetryInterval: number;  // Max seconds between telemetry updates
  minCommandsPerSecond: number;  // Min commands system must handle
}

export interface SLAProfile {
  id: string;
  name: string;
  tier: SLATier;
  targets: SLATargets;
  penalties?: SLAPenalty[];
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

export interface SLAPenalty {
  metric: keyof SLATargets;
  thresholdPercent: number;  // % over target to trigger penalty
  penaltyType: 'warning' | 'alert' | 'escalation' | 'financial';
  description: string;
}

// ============================================
// LATENCY MEASUREMENT
// ============================================

export interface LatencyMeasurement {
  id: string;
  systemId: string;
  measurementType: LatencyMeasurementType;
  startTime: Date;
  endTime: Date;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export enum LatencyMeasurementType {
  TELEMETRY = 'telemetry',
  COMMAND = 'command',
  ALERT = 'alert',
  API = 'api',
  DATABASE = 'database',
  MQTT = 'mqtt',
  WEBSOCKET = 'websocket',
  EDGE_TO_CLOUD = 'edge_to_cloud',
}

export interface LatencyStats {
  type: LatencyMeasurementType;
  period: {
    start: Date;
    end: Date;
  };
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
}

// ============================================
// SLA COMPLIANCE
// ============================================

export interface SLAComplianceReport {
  systemId: string;
  profileId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: SLAMetricCompliance[];
  overallCompliance: number;
  violations: SLAViolation[];
  status: SLAComplianceStatus;
}

export interface SLAMetricCompliance {
  metric: keyof SLATargets;
  target: number;
  actual: number;
  compliance: number;  // Percentage (0-100)
  status: SLAComplianceStatus;
  samples: number;
}

export enum SLAComplianceStatus {
  COMPLIANT = 'compliant',
  AT_RISK = 'at_risk',
  VIOLATED = 'violated',
  UNKNOWN = 'unknown',
}

export interface SLAViolation {
  id: string;
  systemId: string;
  profileId: string;
  metric: keyof SLATargets;
  timestamp: Date;
  target: number;
  actual: number;
  duration?: number;  // How long the violation lasted (ms)
  severity: 'minor' | 'major' | 'critical';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  rootCause?: string;
}

// ============================================
// PRIORITY QUEUE
// ============================================

export enum Priority {
  CRITICAL = 0,   // Immediate processing
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4,
}

export interface PrioritizedRequest {
  id: string;
  priority: Priority;
  timestamp: Date;
  deadline?: Date;  // When this must be processed by
  systemId: string;
  slaTier: SLATier;
  type: 'telemetry' | 'command' | 'alert' | 'query';
  payload: unknown;
  retries: number;
  maxRetries: number;
}

// ============================================
// SYSTEM ASSIGNMENT
// ============================================

export interface SystemSLAAssignment {
  systemId: string;
  profileId: string;
  assignedAt: Date;
  assignedBy: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  notes?: string;
}

// ============================================
// DEFAULT SLA PROFILES
// ============================================

export const DEFAULT_SLA_PROFILES: Omit<SLAProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Platinum - Critical Infrastructure',
    tier: SLATier.PLATINUM,
    isDefault: false,
    targets: {
      telemetryLatency: 100,       // 100ms
      commandLatency: 50,          // 50ms
      alertLatency: 200,           // 200ms
      apiResponseLatency: 100,     // 100ms
      availability: 99.99,         // 99.99%
      dataCompleteness: 99.9,      // 99.9%
      maxTelemetryInterval: 1,     // 1 second
      minCommandsPerSecond: 100,   // 100 cmd/s
    },
    penalties: [
      {
        metric: 'availability',
        thresholdPercent: 0.01,
        penaltyType: 'escalation',
        description: 'Immediate escalation to on-call team',
      },
    ],
  },
  {
    name: 'Gold - High Priority',
    tier: SLATier.GOLD,
    isDefault: false,
    targets: {
      telemetryLatency: 500,       // 500ms
      commandLatency: 200,         // 200ms
      alertLatency: 500,           // 500ms
      apiResponseLatency: 200,     // 200ms
      availability: 99.9,          // 99.9%
      dataCompleteness: 99.5,      // 99.5%
      maxTelemetryInterval: 5,     // 5 seconds
      minCommandsPerSecond: 50,    // 50 cmd/s
    },
  },
  {
    name: 'Silver - Standard',
    tier: SLATier.SILVER,
    isDefault: true,
    targets: {
      telemetryLatency: 1000,      // 1 second
      commandLatency: 500,         // 500ms
      alertLatency: 1000,          // 1 second
      apiResponseLatency: 500,     // 500ms
      availability: 99.5,          // 99.5%
      dataCompleteness: 99,        // 99%
      maxTelemetryInterval: 15,    // 15 seconds
      minCommandsPerSecond: 20,    // 20 cmd/s
    },
  },
  {
    name: 'Bronze - Basic',
    tier: SLATier.BRONZE,
    isDefault: false,
    targets: {
      telemetryLatency: 5000,      // 5 seconds
      commandLatency: 2000,        // 2 seconds
      alertLatency: 5000,          // 5 seconds
      apiResponseLatency: 2000,    // 2 seconds
      availability: 99,            // 99%
      dataCompleteness: 95,        // 95%
      maxTelemetryInterval: 60,    // 1 minute
      minCommandsPerSecond: 5,     // 5 cmd/s
    },
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get priority from SLA tier
 */
export function getPriorityFromTier(tier: SLATier): Priority {
  switch (tier) {
    case SLATier.PLATINUM:
      return Priority.CRITICAL;
    case SLATier.GOLD:
      return Priority.HIGH;
    case SLATier.SILVER:
      return Priority.MEDIUM;
    case SLATier.BRONZE:
      return Priority.LOW;
    default:
      return Priority.MEDIUM;
  }
}

/**
 * Calculate compliance percentage
 */
export function calculateCompliance(actual: number, target: number, isLowerBetter: boolean): number {
  if (isLowerBetter) {
    // For latency: lower is better
    if (actual <= target) return 100;
    const overage = (actual - target) / target;
    return Math.max(0, 100 - overage * 100);
  } else {
    // For availability: higher is better
    if (actual >= target) return 100;
    return (actual / target) * 100;
  }
}

/**
 * Determine compliance status
 */
export function getComplianceStatus(compliance: number): SLAComplianceStatus {
  if (compliance >= 100) return SLAComplianceStatus.COMPLIANT;
  if (compliance >= 95) return SLAComplianceStatus.AT_RISK;
  return SLAComplianceStatus.VIOLATED;
}
