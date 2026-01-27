/**
 * Latency Tracker Service
 * High-precision latency measurement and tracking for SLA compliance
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import {
  LatencyMeasurement,
  LatencyMeasurementType,
  LatencyStats,
  SLATier,
  SLATargets,
} from '../../models/sla.types.js';

// ============================================
// TYPES
// ============================================

interface ActiveMeasurement {
  id: string;
  type: LatencyMeasurementType;
  systemId: string;
  startTime: bigint;  // High-resolution time (nanoseconds)
  metadata?: Record<string, unknown>;
}

interface MeasurementWindow {
  measurements: number[];
  timestamps: number[];
  maxSize: number;
}

// ============================================
// LATENCY TRACKER SERVICE
// ============================================

export class LatencyTracker extends EventEmitter {
  private activeMeasurements: Map<string, ActiveMeasurement> = new Map();
  private measurementWindows: Map<string, MeasurementWindow> = new Map();
  private measurementHistory: LatencyMeasurement[] = [];

  private readonly windowSize: number = 1000;  // Keep last 1000 measurements per type
  private readonly historyLimit: number = 10000;  // Total history limit
  private readonly alertThresholds: Map<LatencyMeasurementType, number> = new Map();

  constructor() {
    super();
    this.initializeDefaultThresholds();
  }

  /**
   * Start a latency measurement
   */
  startMeasurement(
    id: string,
    type: LatencyMeasurementType,
    systemId: string,
    metadata?: Record<string, unknown>
  ): void {
    const measurement: ActiveMeasurement = {
      id,
      type,
      systemId,
      startTime: process.hrtime.bigint(),
      metadata,
    };

    this.activeMeasurements.set(id, measurement);
  }

  /**
   * End a latency measurement and record the result
   */
  endMeasurement(id: string, additionalMetadata?: Record<string, unknown>): LatencyMeasurement | null {
    const active = this.activeMeasurements.get(id);
    if (!active) {
      logger.warn(`No active measurement found for ID: ${id}`);
      return null;
    }

    const endTime = process.hrtime.bigint();
    const latencyNs = endTime - active.startTime;
    const latencyMs = Number(latencyNs) / 1_000_000;

    const measurement: LatencyMeasurement = {
      id: active.id,
      systemId: active.systemId,
      measurementType: active.type,
      startTime: new Date(Date.now() - latencyMs),
      endTime: new Date(),
      latencyMs,
      metadata: { ...active.metadata, ...additionalMetadata },
    };

    this.activeMeasurements.delete(id);
    this.recordMeasurement(measurement);

    return measurement;
  }

  /**
   * Record a pre-calculated measurement
   */
  recordMeasurement(measurement: LatencyMeasurement): void {
    // Add to history
    this.measurementHistory.push(measurement);
    if (this.measurementHistory.length > this.historyLimit) {
      this.measurementHistory.shift();
    }

    // Add to sliding window
    const windowKey = `${measurement.systemId}:${measurement.measurementType}`;
    let window = this.measurementWindows.get(windowKey);
    if (!window) {
      window = { measurements: [], timestamps: [], maxSize: this.windowSize };
      this.measurementWindows.set(windowKey, window);
    }

    window.measurements.push(measurement.latencyMs);
    window.timestamps.push(measurement.endTime.getTime());
    if (window.measurements.length > window.maxSize) {
      window.measurements.shift();
      window.timestamps.shift();
    }

    // Check threshold and emit events
    const threshold = this.alertThresholds.get(measurement.measurementType);
    if (threshold && measurement.latencyMs > threshold) {
      this.emit('latencyThresholdExceeded', {
        measurement,
        threshold,
        exceededBy: measurement.latencyMs - threshold,
      });
    }

    this.emit('measurement', measurement);
  }

  /**
   * Record latency directly without start/end
   */
  recordLatency(
    type: LatencyMeasurementType,
    systemId: string,
    latencyMs: number,
    metadata?: Record<string, unknown>
  ): LatencyMeasurement {
    const measurement: LatencyMeasurement = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      systemId,
      measurementType: type,
      startTime: new Date(Date.now() - latencyMs),
      endTime: new Date(),
      latencyMs,
      metadata,
    };

    this.recordMeasurement(measurement);
    return measurement;
  }

  /**
   * Get statistics for a specific system and measurement type
   */
  getStats(
    systemId: string,
    type: LatencyMeasurementType,
    periodMinutes?: number
  ): LatencyStats | null {
    const windowKey = `${systemId}:${type}`;
    const window = this.measurementWindows.get(windowKey);

    if (!window || window.measurements.length === 0) {
      return null;
    }

    let measurements = window.measurements;
    let timestamps = window.timestamps;

    // Filter by period if specified
    if (periodMinutes) {
      const cutoff = Date.now() - periodMinutes * 60 * 1000;
      const indices = timestamps.map((t, i) => (t >= cutoff ? i : -1)).filter(i => i >= 0);
      measurements = indices.map(i => measurements[i]);
      timestamps = indices.map(i => timestamps[i]);
    }

    if (measurements.length === 0) {
      return null;
    }

    // Sort for percentile calculations
    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    // Calculate statistics
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      type,
      period: {
        start: new Date(Math.min(...timestamps)),
        end: new Date(Math.max(...timestamps)),
      },
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg,
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      stdDev,
    };
  }

  /**
   * Get all stats for a system
   */
  getAllStats(systemId: string, periodMinutes?: number): Map<LatencyMeasurementType, LatencyStats> {
    const stats = new Map<LatencyMeasurementType, LatencyStats>();

    for (const type of Object.values(LatencyMeasurementType)) {
      const stat = this.getStats(systemId, type, periodMinutes);
      if (stat) {
        stats.set(type, stat);
      }
    }

    return stats;
  }

  /**
   * Check if latency meets SLA targets
   */
  checkSLACompliance(
    systemId: string,
    targets: SLATargets,
    periodMinutes: number = 60
  ): {
    telemetry: { compliant: boolean; p99: number; target: number };
    command: { compliant: boolean; p99: number; target: number };
    alert: { compliant: boolean; p99: number; target: number };
    api: { compliant: boolean; p99: number; target: number };
  } {
    const telemetryStats = this.getStats(systemId, LatencyMeasurementType.TELEMETRY, periodMinutes);
    const commandStats = this.getStats(systemId, LatencyMeasurementType.COMMAND, periodMinutes);
    const alertStats = this.getStats(systemId, LatencyMeasurementType.ALERT, periodMinutes);
    const apiStats = this.getStats(systemId, LatencyMeasurementType.API, periodMinutes);

    return {
      telemetry: {
        compliant: !telemetryStats || telemetryStats.p99 <= targets.telemetryLatency,
        p99: telemetryStats?.p99 || 0,
        target: targets.telemetryLatency,
      },
      command: {
        compliant: !commandStats || commandStats.p99 <= targets.commandLatency,
        p99: commandStats?.p99 || 0,
        target: targets.commandLatency,
      },
      alert: {
        compliant: !alertStats || alertStats.p99 <= targets.alertLatency,
        p99: alertStats?.p99 || 0,
        target: targets.alertLatency,
      },
      api: {
        compliant: !apiStats || apiStats.p99 <= targets.apiResponseLatency,
        p99: apiStats?.p99 || 0,
        target: targets.apiResponseLatency,
      },
    };
  }

  /**
   * Set alert threshold for a measurement type
   */
  setAlertThreshold(type: LatencyMeasurementType, thresholdMs: number): void {
    this.alertThresholds.set(type, thresholdMs);
  }

  /**
   * Get recent measurements
   */
  getRecentMeasurements(
    systemId?: string,
    type?: LatencyMeasurementType,
    limit: number = 100
  ): LatencyMeasurement[] {
    let results = this.measurementHistory;

    if (systemId) {
      results = results.filter(m => m.systemId === systemId);
    }
    if (type) {
      results = results.filter(m => m.measurementType === type);
    }

    return results.slice(-limit);
  }

  /**
   * Get real-time latency for display
   */
  getRealTimeLatency(systemId: string): {
    type: LatencyMeasurementType;
    current: number;
    avg: number;
    trend: 'improving' | 'stable' | 'degrading';
  }[] {
    const results: {
      type: LatencyMeasurementType;
      current: number;
      avg: number;
      trend: 'improving' | 'stable' | 'degrading';
    }[] = [];

    for (const type of Object.values(LatencyMeasurementType)) {
      const windowKey = `${systemId}:${type}`;
      const window = this.measurementWindows.get(windowKey);

      if (!window || window.measurements.length < 2) continue;

      const measurements = window.measurements;
      const current = measurements[measurements.length - 1];
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Calculate trend from last 10 measurements
      const recent = measurements.slice(-10);
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (changePercent < -10) trend = 'improving';
      else if (changePercent > 10) trend = 'degrading';

      results.push({ type, current, avg, trend });
    }

    return results;
  }

  /**
   * Cancel an active measurement
   */
  cancelMeasurement(id: string): boolean {
    return this.activeMeasurements.delete(id);
  }

  /**
   * Clear measurements for a system
   */
  clearMeasurements(systemId: string): void {
    // Clear from windows
    for (const [key] of this.measurementWindows.entries()) {
      if (key.startsWith(`${systemId}:`)) {
        this.measurementWindows.delete(key);
      }
    }

    // Clear from history
    this.measurementHistory = this.measurementHistory.filter(m => m.systemId !== systemId);
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultThresholds(): void {
    this.alertThresholds.set(LatencyMeasurementType.TELEMETRY, 1000);
    this.alertThresholds.set(LatencyMeasurementType.COMMAND, 500);
    this.alertThresholds.set(LatencyMeasurementType.ALERT, 500);
    this.alertThresholds.set(LatencyMeasurementType.API, 1000);
    this.alertThresholds.set(LatencyMeasurementType.DATABASE, 100);
    this.alertThresholds.set(LatencyMeasurementType.MQTT, 200);
  }
}

export const latencyTracker = new LatencyTracker();
