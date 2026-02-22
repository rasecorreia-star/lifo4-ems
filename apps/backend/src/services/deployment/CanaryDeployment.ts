/**
 * Canary Deployment Strategy for OTA Updates
 *
 * Gradual rollout to reduce risk of wide-scale failures:
 *
 *   Stage 0 → 5%  of edges (pilot sites, lowest criticality)
 *            Monitor 24h
 *   Stage 1 → 25% Monitor 24h
 *   Stage 2 → 50% Monitor 24h
 *   Stage 3 → 100%
 *
 * If any monitored metric degrades at any stage:
 *   → Pause rollout
 *   → Rollback all updated edges
 *   → Alert development team
 *
 * Metrics monitored during canary:
 *   - Modbus error rate (must not increase)
 *   - Control loop latency (must not increase)
 *   - Safety violations (must remain zero)
 *   - Edge uptime (must be 100%)
 *   - MQTT connection stability (must be stable)
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgeSystem {
  edgeId: string;
  systemId: string;
  siteId: string;
  organizationId: string;
  currentVersion: string;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastSeenAt: Date;
  region?: string;
}

export interface UpdateVersion {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  checksum: string;
  signature?: string;
  releasedAt: Date;
}

export interface CanaryStage {
  stageIndex: number;
  percentage: number;
  monitoringDurationMs: number;
  targetEdgeIds: string[];
  startedAt?: Date;
  completedAt?: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
}

export interface CanaryMetrics {
  edgeId: string;
  modbusErrorRate: number;          // errors per minute
  controlLoopLatencyMs: number;     // average ms
  safetyViolationCount: number;     // must be 0
  uptimePercent: number;            // must be 100
  mqttDisconnects: number;          // must be 0 in window
  recordedAt: Date;
}

export interface CanaryDeploymentConfig {
  version: UpdateVersion;
  stages: Array<{ percentage: number; monitoringDurationMs: number }>;
  metricsThresholds: MetricsThresholds;
  onStageComplete?: (stage: CanaryStage) => Promise<void>;
  onRollback?: (reason: string, affectedEdges: string[]) => Promise<void>;
}

export interface MetricsThresholds {
  maxModbusErrorRateIncrease: number;   // absolute errors/min increase allowed
  maxLatencyIncreaseMs: number;          // ms increase allowed
  maxSafetyViolations: number;           // must be 0
  minUptimePercent: number;              // e.g. 99.9
  maxMqttDisconnects: number;            // e.g. 0
}

export type DeploymentStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PAUSED'
  | 'ROLLED_BACK'
  | 'FAILED';

// ---------------------------------------------------------------------------
// Ports (injected dependencies, not coupled to specific implementations)
// ---------------------------------------------------------------------------

export interface EdgeRepository {
  getAllEdges(): Promise<EdgeSystem[]>;
  getEdgeMetrics(edgeId: string, sinceMs: number): Promise<CanaryMetrics[]>;
  getBaselineMetrics(edgeId: string): Promise<CanaryMetrics | null>;
}

export interface OtaPublisher {
  sendUpdateNotification(edgeId: string, version: UpdateVersion): Promise<void>;
  sendRollbackCommand(edgeId: string, targetVersion: string): Promise<void>;
}

export interface DeploymentRepository {
  saveDeployment(deployment: CanaryDeploymentState): Promise<void>;
  updateDeployment(deploymentId: string, partial: Partial<CanaryDeploymentState>): Promise<void>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface CanaryDeploymentState {
  deploymentId: string;
  version: string;
  status: DeploymentStatus;
  stages: CanaryStage[];
  updatedEdgeIds: string[];
  rolledBackEdgeIds: string[];
  startedAt: Date;
  completedAt?: Date;
  failureReason?: string;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_STAGES: CanaryDeploymentConfig['stages'] = [
  { percentage: 5,   monitoringDurationMs: 24 * 60 * 60 * 1000 }, // 5%  for 24h
  { percentage: 25,  monitoringDurationMs: 24 * 60 * 60 * 1000 }, // 25% for 24h
  { percentage: 50,  monitoringDurationMs: 24 * 60 * 60 * 1000 }, // 50% for 24h
  { percentage: 100, monitoringDurationMs: 0 },                    // 100% — complete
];

const DEFAULT_THRESHOLDS: MetricsThresholds = {
  maxModbusErrorRateIncrease: 2,
  maxLatencyIncreaseMs: 50,
  maxSafetyViolations: 0,
  minUptimePercent: 99.9,
  maxMqttDisconnects: 0,
};

// ---------------------------------------------------------------------------
// CanaryDeploymentService
// ---------------------------------------------------------------------------

export class CanaryDeploymentService extends EventEmitter {
  private readonly stages: CanaryDeploymentConfig['stages'];
  private readonly thresholds: MetricsThresholds;

  constructor(
    private readonly edgeRepo: EdgeRepository,
    private readonly otaPublisher: OtaPublisher,
    private readonly deploymentRepo: DeploymentRepository,
    private readonly logger: Logger,
    thresholds: Partial<MetricsThresholds> = {},
    stages: CanaryDeploymentConfig['stages'] = DEFAULT_STAGES,
  ) {
    super();
    this.stages = stages;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Start a new canary deployment for the given version.
   */
  async startDeployment(version: UpdateVersion): Promise<CanaryDeploymentState> {
    this.logger.info(`[Canary] Starting deployment for v${version.version}`);

    const allEdges = await this.edgeRepo.getAllEdges();
    const eligibleEdges = this.selectEligibleEdges(allEdges);

    const deploymentId = `deploy-${version.version}-${Date.now()}`;
    const stageDefinitions = this.buildStages(eligibleEdges);

    const state: CanaryDeploymentState = {
      deploymentId,
      version: version.version,
      status: 'IN_PROGRESS',
      stages: stageDefinitions,
      updatedEdgeIds: [],
      rolledBackEdgeIds: [],
      startedAt: new Date(),
    };

    await this.deploymentRepo.saveDeployment(state);
    this.emit('deployment:started', { deploymentId, version: version.version });

    // Execute stages sequentially
    this.executeStages(state, version, eligibleEdges).catch((err) => {
      this.logger.error(`[Canary] Unhandled error in deployment ${deploymentId}: ${err}`);
    });

    return state;
  }

  // -------------------------------------------------------------------------
  // Stage execution
  // -------------------------------------------------------------------------

  private async executeStages(
    state: CanaryDeploymentState,
    version: UpdateVersion,
    allEdges: EdgeSystem[],
  ): Promise<void> {
    for (let i = 0; i < state.stages.length; i++) {
      const stage = state.stages[i];

      this.logger.info(
        `[Canary] Starting stage ${i + 1}/${state.stages.length} — ${stage.targetEdgeIds.length} edges`,
      );

      stage.status = 'IN_PROGRESS';
      stage.startedAt = new Date();
      await this.deploymentRepo.updateDeployment(state.deploymentId, { stages: state.stages });

      // Send OTA notifications to this stage's edges
      await this.notifyEdges(stage.targetEdgeIds, version);
      state.updatedEdgeIds.push(...stage.targetEdgeIds);
      await this.deploymentRepo.updateDeployment(state.deploymentId, {
        updatedEdgeIds: state.updatedEdgeIds,
      });

      // Monitor (skip for 100% stage)
      if (stage.monitoringDurationMs > 0) {
        const passed = await this.monitorStage(stage, version.version);

        if (!passed) {
          await this.executeRollback(state, version.version);
          return;
        }
      }

      stage.status = 'PASSED';
      stage.completedAt = new Date();
      await this.deploymentRepo.updateDeployment(state.deploymentId, { stages: state.stages });

      this.emit('stage:completed', { deploymentId: state.deploymentId, stageIndex: i });
      this.logger.info(`[Canary] Stage ${i + 1} passed`);
    }

    // All stages complete
    state.status = 'COMPLETED';
    state.completedAt = new Date();
    await this.deploymentRepo.updateDeployment(state.deploymentId, {
      status: 'COMPLETED',
      completedAt: state.completedAt,
    });

    this.emit('deployment:completed', { deploymentId: state.deploymentId, version: version.version });
    this.logger.info(`[Canary] Deployment ${state.deploymentId} COMPLETED successfully`);
  }

  // -------------------------------------------------------------------------
  // Monitoring
  // -------------------------------------------------------------------------

  private async monitorStage(stage: CanaryStage, version: string): Promise<boolean> {
    const monitoringEndMs = Date.now() + stage.monitoringDurationMs;
    const checkIntervalMs = 5 * 60 * 1000; // check every 5 min

    while (Date.now() < monitoringEndMs) {
      const issues = await this.checkMetrics(stage.targetEdgeIds);

      if (issues.length > 0) {
        this.logger.warn(
          `[Canary] Metric degradation detected in stage — pausing: ${issues.join(', ')}`,
        );
        stage.status = 'FAILED';
        this.emit('stage:failed', { stage, issues });
        return false;
      }

      const remainingMin = Math.ceil((monitoringEndMs - Date.now()) / 60000);
      this.logger.info(
        `[Canary] Stage monitoring OK — ${remainingMin}min remaining`,
      );

      await this.sleep(checkIntervalMs);
    }

    return true;
  }

  private async checkMetrics(edgeIds: string[]): Promise<string[]> {
    const issues: string[] = [];
    const sinceMs = 5 * 60 * 1000; // last 5 minutes

    for (const edgeId of edgeIds) {
      const [metrics, baseline] = await Promise.all([
        this.edgeRepo.getEdgeMetrics(edgeId, sinceMs),
        this.edgeRepo.getBaselineMetrics(edgeId),
      ]);

      if (!metrics.length) {
        issues.push(`${edgeId}: no metrics available`);
        continue;
      }

      const latest = metrics[metrics.length - 1];

      // Safety violations: must be zero
      if (latest.safetyViolationCount > this.thresholds.maxSafetyViolations) {
        issues.push(
          `${edgeId}: safety violation count=${latest.safetyViolationCount}`,
        );
      }

      // Uptime
      if (latest.uptimePercent < this.thresholds.minUptimePercent) {
        issues.push(
          `${edgeId}: uptime=${latest.uptimePercent}% < ${this.thresholds.minUptimePercent}%`,
        );
      }

      // MQTT disconnects
      if (latest.mqttDisconnects > this.thresholds.maxMqttDisconnects) {
        issues.push(`${edgeId}: mqttDisconnects=${latest.mqttDisconnects}`);
      }

      if (baseline) {
        // Modbus error rate increase
        const errorIncrease = latest.modbusErrorRate - baseline.modbusErrorRate;
        if (errorIncrease > this.thresholds.maxModbusErrorRateIncrease) {
          issues.push(
            `${edgeId}: modbusErrorRate increased by ${errorIncrease.toFixed(1)}/min`,
          );
        }

        // Latency increase
        const latencyIncrease = latest.controlLoopLatencyMs - baseline.controlLoopLatencyMs;
        if (latencyIncrease > this.thresholds.maxLatencyIncreaseMs) {
          issues.push(
            `${edgeId}: latency increased by ${latencyIncrease.toFixed(0)}ms`,
          );
        }
      }
    }

    return issues;
  }

  // -------------------------------------------------------------------------
  // Rollback
  // -------------------------------------------------------------------------

  private async executeRollback(
    state: CanaryDeploymentState,
    failedVersion: string,
  ): Promise<void> {
    this.logger.warn(
      `[Canary] Rolling back ${state.updatedEdgeIds.length} edges from v${failedVersion}`,
    );

    state.status = 'ROLLED_BACK';

    const rollbackResults = await Promise.allSettled(
      state.updatedEdgeIds.map((edgeId) =>
        this.otaPublisher.sendRollbackCommand(edgeId, 'previous'),
      ),
    );

    rollbackResults.forEach((result, idx) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `[Canary] Rollback failed for edge ${state.updatedEdgeIds[idx]}: ${result.reason}`,
        );
      } else {
        state.rolledBackEdgeIds.push(state.updatedEdgeIds[idx]);
      }
    });

    await this.deploymentRepo.updateDeployment(state.deploymentId, {
      status: 'ROLLED_BACK',
      rolledBackEdgeIds: state.rolledBackEdgeIds,
      failureReason: `Metric degradation detected during canary monitoring`,
    });

    this.emit('deployment:rolledback', {
      deploymentId: state.deploymentId,
      rolledBackCount: state.rolledBackEdgeIds.length,
    });

    this.logger.error(
      `[Canary] Rollback complete — ${state.rolledBackEdgeIds.length}/${state.updatedEdgeIds.length} edges restored`,
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Select eligible edges: online, not in critical alarm, sorted by criticality ascending
   * (lowest-criticality sites go first).
   */
  private selectEligibleEdges(edges: EdgeSystem[]): EdgeSystem[] {
    const criticalityOrder: Record<EdgeSystem['criticality'], number> = {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3,
    };

    return edges
      .filter((e) => {
        const isRecentlySeen =
          Date.now() - e.lastSeenAt.getTime() < 10 * 60 * 1000; // seen in last 10min
        return isRecentlySeen;
      })
      .sort((a, b) => criticalityOrder[a.criticality] - criticalityOrder[b.criticality]);
  }

  /**
   * Build stage objects from percentage-based config, assigning specific edge IDs.
   */
  private buildStages(edges: EdgeSystem[]): CanaryStage[] {
    let assignedCount = 0;

    return this.stages.map((stageCfg, index) => {
      const targetCount = Math.ceil((stageCfg.percentage / 100) * edges.length);
      const targetEdges = edges.slice(0, targetCount);
      assignedCount = targetCount;

      return {
        stageIndex: index,
        percentage: stageCfg.percentage,
        monitoringDurationMs: stageCfg.monitoringDurationMs,
        targetEdgeIds: targetEdges.map((e) => e.edgeId),
        status: 'PENDING',
      };
    });
  }

  private async notifyEdges(edgeIds: string[], version: UpdateVersion): Promise<void> {
    const results = await Promise.allSettled(
      edgeIds.map((edgeId) => this.otaPublisher.sendUpdateNotification(edgeId, version)),
    );

    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `[Canary] Failed to notify edge ${edgeIds[idx]}: ${result.reason}`,
        );
      }
    });

    this.logger.info(`[Canary] Update notification sent to ${edgeIds.length} edges`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
