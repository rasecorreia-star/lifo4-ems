/**
 * SLA Reporter Service
 * Generates compliance reports and violation tracking
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import {
  SLAProfile,
  SLAComplianceReport,
  SLAMetricCompliance,
  SLAViolation,
  SLAComplianceStatus,
  SLATier,
  SLATargets,
  LatencyMeasurementType,
  calculateCompliance,
  getComplianceStatus,
} from '../../models/sla.types.js';
import { LatencyTracker, latencyTracker } from './latency-tracker.js';

// ============================================
// TYPES
// ============================================

interface ViolationTracker {
  systemId: string;
  metric: keyof SLATargets;
  startTime: Date;
  readings: number[];
  target: number;
}

interface ReportConfig {
  includeViolations: boolean;
  includeRecommendations: boolean;
  periodMinutes: number;
}

// ============================================
// SLA REPORTER SERVICE
// ============================================

export class SLAReporter extends EventEmitter {
  private profiles: Map<string, SLAProfile> = new Map();
  private systemAssignments: Map<string, string> = new Map();  // systemId -> profileId
  private violations: SLAViolation[] = [];
  private activeViolations: Map<string, ViolationTracker> = new Map();
  private latencyTracker: LatencyTracker;

  private violationCheckInterval: NodeJS.Timeout | null = null;
  private readonly maxViolationHistory = 10000;

  constructor(tracker?: LatencyTracker) {
    super();
    this.latencyTracker = tracker || latencyTracker;
    this.startViolationChecker();
  }

  /**
   * Register an SLA profile
   */
  registerProfile(profile: SLAProfile): void {
    this.profiles.set(profile.id, profile);
    logger.info(`SLA profile registered: ${profile.name} (${profile.tier})`);
  }

  /**
   * Assign a profile to a system
   */
  assignProfile(systemId: string, profileId: string): void {
    if (!this.profiles.has(profileId)) {
      throw new Error(`Unknown SLA profile: ${profileId}`);
    }
    this.systemAssignments.set(systemId, profileId);
    logger.info(`SLA profile ${profileId} assigned to system ${systemId}`);
  }

  /**
   * Get the profile for a system
   */
  getSystemProfile(systemId: string): SLAProfile | undefined {
    const profileId = this.systemAssignments.get(systemId);
    if (!profileId) return undefined;
    return this.profiles.get(profileId);
  }

  /**
   * Generate a compliance report for a system
   */
  generateReport(
    systemId: string,
    config: Partial<ReportConfig> = {}
  ): SLAComplianceReport | null {
    const mergedConfig: ReportConfig = {
      includeViolations: true,
      includeRecommendations: true,
      periodMinutes: 60,
      ...config,
    };

    const profile = this.getSystemProfile(systemId);
    if (!profile) {
      logger.warn(`No SLA profile assigned to system: ${systemId}`);
      return null;
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - mergedConfig.periodMinutes * 60 * 1000);

    // Get latency statistics
    const telemetryStats = this.latencyTracker.getStats(
      systemId,
      LatencyMeasurementType.TELEMETRY,
      mergedConfig.periodMinutes
    );
    const commandStats = this.latencyTracker.getStats(
      systemId,
      LatencyMeasurementType.COMMAND,
      mergedConfig.periodMinutes
    );
    const alertStats = this.latencyTracker.getStats(
      systemId,
      LatencyMeasurementType.ALERT,
      mergedConfig.periodMinutes
    );
    const apiStats = this.latencyTracker.getStats(
      systemId,
      LatencyMeasurementType.API,
      mergedConfig.periodMinutes
    );

    // Calculate metric compliance
    const metrics: SLAMetricCompliance[] = [];

    // Telemetry latency
    if (telemetryStats) {
      const compliance = calculateCompliance(
        telemetryStats.p99,
        profile.targets.telemetryLatency,
        true
      );
      metrics.push({
        metric: 'telemetryLatency',
        target: profile.targets.telemetryLatency,
        actual: telemetryStats.p99,
        compliance,
        status: getComplianceStatus(compliance),
        samples: telemetryStats.count,
      });
    }

    // Command latency
    if (commandStats) {
      const compliance = calculateCompliance(
        commandStats.p99,
        profile.targets.commandLatency,
        true
      );
      metrics.push({
        metric: 'commandLatency',
        target: profile.targets.commandLatency,
        actual: commandStats.p99,
        compliance,
        status: getComplianceStatus(compliance),
        samples: commandStats.count,
      });
    }

    // Alert latency
    if (alertStats) {
      const compliance = calculateCompliance(
        alertStats.p99,
        profile.targets.alertLatency,
        true
      );
      metrics.push({
        metric: 'alertLatency',
        target: profile.targets.alertLatency,
        actual: alertStats.p99,
        compliance,
        status: getComplianceStatus(compliance),
        samples: alertStats.count,
      });
    }

    // API response latency
    if (apiStats) {
      const compliance = calculateCompliance(
        apiStats.p99,
        profile.targets.apiResponseLatency,
        true
      );
      metrics.push({
        metric: 'apiResponseLatency',
        target: profile.targets.apiResponseLatency,
        actual: apiStats.p99,
        compliance,
        status: getComplianceStatus(compliance),
        samples: apiStats.count,
      });
    }

    // Calculate overall compliance
    const overallCompliance = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.compliance, 0) / metrics.length
      : 100;

    // Get violations for this period
    const periodViolations = mergedConfig.includeViolations
      ? this.violations.filter(
          v => v.systemId === systemId &&
               v.timestamp >= periodStart &&
               v.timestamp <= now
        )
      : [];

    const report: SLAComplianceReport = {
      systemId,
      profileId: profile.id,
      period: {
        start: periodStart,
        end: now,
      },
      metrics,
      overallCompliance,
      violations: periodViolations,
      status: getComplianceStatus(overallCompliance),
    };

    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Record a violation
   */
  recordViolation(
    systemId: string,
    metric: keyof SLATargets,
    target: number,
    actual: number,
    severity: 'minor' | 'major' | 'critical' = 'minor'
  ): SLAViolation {
    const profileId = this.systemAssignments.get(systemId) || 'unknown';

    const violation: SLAViolation = {
      id: `viol-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      systemId,
      profileId,
      metric,
      timestamp: new Date(),
      target,
      actual,
      severity,
      acknowledged: false,
    };

    this.violations.push(violation);
    if (this.violations.length > this.maxViolationHistory) {
      this.violations.shift();
    }

    logger.warn(`SLA violation recorded: ${systemId}, ${metric}, actual: ${actual}, target: ${target}`);
    this.emit('violation', violation);

    return violation;
  }

  /**
   * Acknowledge a violation
   */
  acknowledgeViolation(violationId: string, acknowledgedBy: string): boolean {
    const violation = this.violations.find(v => v.id === violationId);
    if (!violation) return false;

    violation.acknowledged = true;
    violation.acknowledgedBy = acknowledgedBy;
    violation.acknowledgedAt = new Date();

    this.emit('violationAcknowledged', violation);
    return true;
  }

  /**
   * Resolve a violation
   */
  resolveViolation(violationId: string, rootCause?: string): boolean {
    const violation = this.violations.find(v => v.id === violationId);
    if (!violation) return false;

    violation.resolvedAt = new Date();
    if (rootCause) {
      violation.rootCause = rootCause;
    }

    // Calculate duration if we have start info
    const tracker = this.activeViolations.get(`${violation.systemId}:${violation.metric}`);
    if (tracker) {
      violation.duration = Date.now() - tracker.startTime.getTime();
      this.activeViolations.delete(`${violation.systemId}:${violation.metric}`);
    }

    this.emit('violationResolved', violation);
    return true;
  }

  /**
   * Get violations for a system
   */
  getViolations(
    systemId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      metric?: keyof SLATargets;
      severity?: SLAViolation['severity'];
      acknowledged?: boolean;
      resolved?: boolean;
    } = {}
  ): SLAViolation[] {
    return this.violations.filter(v => {
      if (v.systemId !== systemId) return false;
      if (options.startDate && v.timestamp < options.startDate) return false;
      if (options.endDate && v.timestamp > options.endDate) return false;
      if (options.metric && v.metric !== options.metric) return false;
      if (options.severity && v.severity !== options.severity) return false;
      if (options.acknowledged !== undefined && v.acknowledged !== options.acknowledged) return false;
      if (options.resolved !== undefined && (!!v.resolvedAt) !== options.resolved) return false;
      return true;
    });
  }

  /**
   * Get active (unresolved) violations
   */
  getActiveViolations(systemId?: string): SLAViolation[] {
    return this.violations.filter(v => {
      if (systemId && v.systemId !== systemId) return false;
      return !v.resolvedAt;
    });
  }

  /**
   * Get violation summary
   */
  getViolationSummary(systemId: string, periodDays: number = 30): {
    total: number;
    bySeverity: Record<string, number>;
    byMetric: Record<string, number>;
    avgResolutionTime: number;
    unacknowledged: number;
    active: number;
  } {
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const violations = this.violations.filter(
      v => v.systemId === systemId && v.timestamp >= cutoff
    );

    const bySeverity: Record<string, number> = {};
    const byMetric: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const v of violations) {
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
      byMetric[v.metric] = (byMetric[v.metric] || 0) + 1;

      if (v.resolvedAt && v.duration) {
        totalResolutionTime += v.duration;
        resolvedCount++;
      }
    }

    return {
      total: violations.length,
      bySeverity,
      byMetric,
      avgResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      unacknowledged: violations.filter(v => !v.acknowledged).length,
      active: violations.filter(v => !v.resolvedAt).length,
    };
  }

  /**
   * Generate compliance trend
   */
  getComplianceTrend(
    systemId: string,
    periodDays: number = 30,
    intervalHours: number = 24
  ): { timestamp: Date; compliance: number }[] {
    const trend: { timestamp: Date; compliance: number }[] = [];
    const now = new Date();
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const periods = Math.ceil((periodDays * 24) / intervalHours);

    for (let i = periods - 1; i >= 0; i--) {
      const periodEnd = new Date(now.getTime() - i * intervalMs);
      const periodStart = new Date(periodEnd.getTime() - intervalMs);

      // Count violations in this period
      const periodViolations = this.violations.filter(
        v => v.systemId === systemId &&
             v.timestamp >= periodStart &&
             v.timestamp <= periodEnd
      );

      // Simple compliance: 100 - (violations * penalty factor)
      const compliance = Math.max(0, 100 - periodViolations.length * 5);

      trend.push({
        timestamp: periodEnd,
        compliance,
      });
    }

    return trend;
  }

  /**
   * Get SLA dashboard data
   */
  getDashboardData(systemId: string): {
    currentStatus: SLAComplianceStatus;
    compliance: number;
    tier: SLATier;
    activeViolations: number;
    latencyStats: {
      telemetry: { current: number; target: number; status: SLAComplianceStatus };
      command: { current: number; target: number; status: SLAComplianceStatus };
      alert: { current: number; target: number; status: SLAComplianceStatus };
      api: { current: number; target: number; status: SLAComplianceStatus };
    };
  } | null {
    const profile = this.getSystemProfile(systemId);
    if (!profile) return null;

    const report = this.generateReport(systemId, { periodMinutes: 60 });
    if (!report) return null;

    const realTimeLatency = this.latencyTracker.getRealTimeLatency(systemId);

    const getLatencyStat = (type: LatencyMeasurementType, targetKey: keyof SLATargets) => {
      const stat = realTimeLatency.find(r => r.type === type);
      const target = profile.targets[targetKey] as number;
      return {
        current: stat?.current || 0,
        target,
        status: stat ? getComplianceStatus(calculateCompliance(stat.current, target, true)) : SLAComplianceStatus.UNKNOWN,
      };
    };

    return {
      currentStatus: report.status,
      compliance: report.overallCompliance,
      tier: profile.tier,
      activeViolations: this.getActiveViolations(systemId).length,
      latencyStats: {
        telemetry: getLatencyStat(LatencyMeasurementType.TELEMETRY, 'telemetryLatency'),
        command: getLatencyStat(LatencyMeasurementType.COMMAND, 'commandLatency'),
        alert: getLatencyStat(LatencyMeasurementType.ALERT, 'alertLatency'),
        api: getLatencyStat(LatencyMeasurementType.API, 'apiResponseLatency'),
      },
    };
  }

  /**
   * Shutdown the reporter
   */
  shutdown(): void {
    if (this.violationCheckInterval) {
      clearInterval(this.violationCheckInterval);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private startViolationChecker(): void {
    this.violationCheckInterval = setInterval(() => {
      this.checkForViolations();
    }, 10000);  // Check every 10 seconds
  }

  private checkForViolations(): void {
    for (const [systemId, profileId] of this.systemAssignments.entries()) {
      const profile = this.profiles.get(profileId);
      if (!profile) continue;

      const compliance = this.latencyTracker.checkSLACompliance(systemId, profile.targets);

      // Check each metric
      this.checkMetricViolation(systemId, 'telemetryLatency', compliance.telemetry, profile.targets.telemetryLatency);
      this.checkMetricViolation(systemId, 'commandLatency', compliance.command, profile.targets.commandLatency);
      this.checkMetricViolation(systemId, 'alertLatency', compliance.alert, profile.targets.alertLatency);
      this.checkMetricViolation(systemId, 'apiResponseLatency', compliance.api, profile.targets.apiResponseLatency);
    }
  }

  private checkMetricViolation(
    systemId: string,
    metric: keyof SLATargets,
    result: { compliant: boolean; p99: number; target: number },
    target: number
  ): void {
    const key = `${systemId}:${metric}`;

    if (!result.compliant && result.p99 > 0) {
      // Start or continue tracking violation
      let tracker = this.activeViolations.get(key);
      if (!tracker) {
        tracker = {
          systemId,
          metric,
          startTime: new Date(),
          readings: [],
          target,
        };
        this.activeViolations.set(key, tracker);

        // Record new violation
        const severity = this.calculateSeverity(result.p99, target);
        this.recordViolation(systemId, metric, target, result.p99, severity);
      }
      tracker.readings.push(result.p99);
    } else {
      // Check if we were tracking a violation that's now resolved
      const tracker = this.activeViolations.get(key);
      if (tracker) {
        // Find the most recent unresolved violation for this metric
        const unresolvedViolation = this.violations
          .filter(v => v.systemId === systemId && v.metric === metric && !v.resolvedAt)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        if (unresolvedViolation) {
          this.resolveViolation(unresolvedViolation.id, 'Auto-resolved: metric returned to compliance');
        }
        this.activeViolations.delete(key);
      }
    }
  }

  private calculateSeverity(actual: number, target: number): 'minor' | 'major' | 'critical' {
    const ratio = actual / target;
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'major';
    return 'minor';
  }
}

export const slaReporter = new SLAReporter(latencyTracker);
