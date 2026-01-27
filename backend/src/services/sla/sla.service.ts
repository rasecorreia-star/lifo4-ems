/**
 * SLA Service
 * Central service for SLA management, latency tracking, and compliance reporting
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import {
  SLAProfile,
  SLATier,
  SLATargets,
  SLAComplianceReport,
  SLAViolation,
  SystemSLAAssignment,
  DEFAULT_SLA_PROFILES,
  Priority,
  PrioritizedRequest,
  LatencyMeasurementType,
  LatencyStats,
} from '../../models/sla.types.js';
import { LatencyTracker, latencyTracker } from './latency-tracker.js';
import { PriorityQueueService, priorityQueue } from './priority-queue.js';
import { SLAReporter, slaReporter } from './sla-reporter.js';

// ============================================
// SLA SERVICE
// ============================================

export class SLAService extends EventEmitter {
  private tracker: LatencyTracker;
  private queue: PriorityQueueService;
  private reporter: SLAReporter;
  private profiles: Map<string, SLAProfile> = new Map();
  private assignments: Map<string, SystemSLAAssignment> = new Map();
  private initialized: boolean = false;

  constructor(
    tracker?: LatencyTracker,
    queue?: PriorityQueueService,
    reporter?: SLAReporter
  ) {
    super();
    this.tracker = tracker || latencyTracker;
    this.queue = queue || priorityQueue;
    this.reporter = reporter || slaReporter;

    this.setupEventForwarding();
  }

  /**
   * Initialize SLA service with default profiles
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create default profiles
    for (const profileData of DEFAULT_SLA_PROFILES) {
      const profile: SLAProfile = {
        ...profileData,
        id: `sla-${profileData.tier}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.profiles.set(profile.id, profile);
      this.reporter.registerProfile(profile);
    }

    this.initialized = true;
    logger.info('SLA service initialized with default profiles');
  }

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  /**
   * Create a custom SLA profile
   */
  createProfile(
    name: string,
    tier: SLATier,
    targets: SLATargets,
    isDefault: boolean = false
  ): SLAProfile {
    const id = `sla-custom-${Date.now()}`;
    const profile: SLAProfile = {
      id,
      name,
      tier,
      targets,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault,
    };

    this.profiles.set(id, profile);
    this.reporter.registerProfile(profile);

    logger.info(`Custom SLA profile created: ${name}`);
    return profile;
  }

  /**
   * Update an SLA profile
   */
  updateProfile(id: string, updates: Partial<Omit<SLAProfile, 'id' | 'createdAt'>>): SLAProfile {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`SLA profile not found: ${id}`);
    }

    const updated = {
      ...profile,
      ...updates,
      updatedAt: new Date(),
    };

    this.profiles.set(id, updated);
    this.reporter.registerProfile(updated);

    logger.info(`SLA profile updated: ${id}`);
    return updated;
  }

  /**
   * Get all profiles
   */
  getProfiles(): SLAProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile by ID
   */
  getProfile(id: string): SLAProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get profile by tier
   */
  getProfileByTier(tier: SLATier): SLAProfile | undefined {
    return Array.from(this.profiles.values()).find(p => p.tier === tier);
  }

  // ============================================
  // SYSTEM ASSIGNMENT
  // ============================================

  /**
   * Assign SLA profile to a system
   */
  assignToSystem(
    systemId: string,
    profileId: string,
    assignedBy: string,
    effectiveFrom?: Date,
    effectiveUntil?: Date
  ): SystemSLAAssignment {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`SLA profile not found: ${profileId}`);
    }

    const assignment: SystemSLAAssignment = {
      systemId,
      profileId,
      assignedAt: new Date(),
      assignedBy,
      effectiveFrom: effectiveFrom || new Date(),
      effectiveUntil,
    };

    this.assignments.set(systemId, assignment);
    this.reporter.assignProfile(systemId, profileId);

    // Set up alert thresholds based on profile
    this.tracker.setAlertThreshold(
      LatencyMeasurementType.TELEMETRY,
      profile.targets.telemetryLatency
    );
    this.tracker.setAlertThreshold(
      LatencyMeasurementType.COMMAND,
      profile.targets.commandLatency
    );
    this.tracker.setAlertThreshold(
      LatencyMeasurementType.ALERT,
      profile.targets.alertLatency
    );
    this.tracker.setAlertThreshold(
      LatencyMeasurementType.API,
      profile.targets.apiResponseLatency
    );

    logger.info(`SLA profile ${profileId} assigned to system ${systemId}`);
    this.emit('systemAssigned', assignment);

    return assignment;
  }

  /**
   * Get system assignment
   */
  getSystemAssignment(systemId: string): SystemSLAAssignment | undefined {
    return this.assignments.get(systemId);
  }

  /**
   * Get system's SLA tier
   */
  getSystemTier(systemId: string): SLATier | undefined {
    const assignment = this.assignments.get(systemId);
    if (!assignment) return undefined;

    const profile = this.profiles.get(assignment.profileId);
    return profile?.tier;
  }

  /**
   * Get system's SLA targets
   */
  getSystemTargets(systemId: string): SLATargets | undefined {
    const assignment = this.assignments.get(systemId);
    if (!assignment) return undefined;

    const profile = this.profiles.get(assignment.profileId);
    return profile?.targets;
  }

  // ============================================
  // LATENCY TRACKING
  // ============================================

  /**
   * Start tracking latency for an operation
   */
  startLatencyTracking(
    operationId: string,
    type: LatencyMeasurementType,
    systemId: string,
    metadata?: Record<string, unknown>
  ): void {
    this.tracker.startMeasurement(operationId, type, systemId, metadata);
  }

  /**
   * End tracking and record latency
   */
  endLatencyTracking(
    operationId: string,
    additionalMetadata?: Record<string, unknown>
  ): number | null {
    const measurement = this.tracker.endMeasurement(operationId, additionalMetadata);
    return measurement?.latencyMs || null;
  }

  /**
   * Record latency directly
   */
  recordLatency(
    type: LatencyMeasurementType,
    systemId: string,
    latencyMs: number,
    metadata?: Record<string, unknown>
  ): void {
    this.tracker.recordLatency(type, systemId, latencyMs, metadata);
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(
    systemId: string,
    type?: LatencyMeasurementType,
    periodMinutes?: number
  ): LatencyStats | Map<LatencyMeasurementType, LatencyStats> | null {
    if (type) {
      return this.tracker.getStats(systemId, type, periodMinutes);
    }
    return this.tracker.getAllStats(systemId, periodMinutes);
  }

  /**
   * Get real-time latency
   */
  getRealTimeLatency(systemId: string) {
    return this.tracker.getRealTimeLatency(systemId);
  }

  // ============================================
  // PRIORITY QUEUE
  // ============================================

  /**
   * Enqueue a request with SLA-based priority
   */
  enqueueRequest(
    systemId: string,
    type: PrioritizedRequest['type'],
    payload: unknown,
    options?: { deadline?: Date; maxRetries?: number }
  ): string {
    const tier = this.getSystemTier(systemId) || SLATier.SILVER;
    return this.queue.createFromSLATier(systemId, tier, type, payload, options);
  }

  /**
   * Dequeue next request
   */
  dequeueRequest(): PrioritizedRequest | undefined {
    return this.queue.dequeue();
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queue.getStats();
  }

  // ============================================
  // COMPLIANCE REPORTING
  // ============================================

  /**
   * Generate compliance report for a system
   */
  generateReport(
    systemId: string,
    periodMinutes?: number
  ): SLAComplianceReport | null {
    return this.reporter.generateReport(systemId, { periodMinutes });
  }

  /**
   * Get violations for a system
   */
  getViolations(
    systemId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      metric?: keyof SLATargets;
    }
  ): SLAViolation[] {
    return this.reporter.getViolations(systemId, options);
  }

  /**
   * Get active violations
   */
  getActiveViolations(systemId?: string): SLAViolation[] {
    return this.reporter.getActiveViolations(systemId);
  }

  /**
   * Acknowledge a violation
   */
  acknowledgeViolation(violationId: string, acknowledgedBy: string): boolean {
    return this.reporter.acknowledgeViolation(violationId, acknowledgedBy);
  }

  /**
   * Get compliance trend
   */
  getComplianceTrend(
    systemId: string,
    periodDays?: number,
    intervalHours?: number
  ) {
    return this.reporter.getComplianceTrend(systemId, periodDays, intervalHours);
  }

  /**
   * Get dashboard data for UI
   */
  getDashboardData(systemId: string) {
    return this.reporter.getDashboardData(systemId);
  }

  /**
   * Get violation summary
   */
  getViolationSummary(systemId: string, periodDays?: number) {
    return this.reporter.getViolationSummary(systemId, periodDays);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if a system is meeting SLA
   */
  isCompliant(systemId: string): boolean {
    const report = this.generateReport(systemId, 60);
    if (!report) return true;  // No data = assume compliant
    return report.overallCompliance >= 100;
  }

  /**
   * Get system health based on SLA
   */
  getSystemHealth(systemId: string): {
    status: 'healthy' | 'degraded' | 'critical';
    compliance: number;
    activeViolations: number;
    recommendations: string[];
  } {
    const report = this.generateReport(systemId, 60);
    const activeViolations = this.getActiveViolations(systemId);
    const recommendations: string[] = [];

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (!report) {
      return { status, compliance: 100, activeViolations: 0, recommendations };
    }

    const compliance = report.overallCompliance;

    if (compliance < 90 || activeViolations.length >= 3) {
      status = 'critical';
      recommendations.push('Immediate attention required - multiple SLA violations');
    } else if (compliance < 95 || activeViolations.length > 0) {
      status = 'degraded';
      recommendations.push('Monitor closely - system approaching SLA limits');
    }

    // Add specific recommendations based on metrics
    for (const metric of report.metrics) {
      if (metric.compliance < 100) {
        recommendations.push(
          `Improve ${metric.metric}: current ${metric.actual.toFixed(0)}ms, target ${metric.target}ms`
        );
      }
    }

    return {
      status,
      compliance,
      activeViolations: activeViolations.length,
      recommendations,
    };
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.queue.shutdown();
    this.reporter.shutdown();
    logger.info('SLA service shutdown');
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private setupEventForwarding(): void {
    // Forward events from sub-services
    this.tracker.on('latencyThresholdExceeded', data => {
      this.emit('latencyThresholdExceeded', data);
    });

    this.queue.on('timeout', request => {
      this.emit('requestTimeout', request);
    });

    this.reporter.on('violation', violation => {
      this.emit('violation', violation);
    });

    this.reporter.on('violationResolved', violation => {
      this.emit('violationResolved', violation);
    });
  }
}

// Export singleton instance
export const slaService = new SLAService(latencyTracker, priorityQueue, slaReporter);

// Export sub-services for direct access
export { latencyTracker, priorityQueue, slaReporter };
