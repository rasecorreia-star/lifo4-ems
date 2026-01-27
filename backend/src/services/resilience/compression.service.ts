/**
 * Compression Service
 * Adaptive compression for efficient data transmission
 */

import { createGzip, createGunzip, createDeflate, createInflate, gzipSync, gunzipSync, deflateSync, inflateSync } from 'zlib';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export enum CompressionAlgorithm {
  NONE = 'none',
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  LZ4 = 'lz4',      // Requires external library
  ZSTD = 'zstd',    // Requires external library
  SNAPPY = 'snappy', // Requires external library
}

export enum CompressionLevel {
  FASTEST = 1,
  FAST = 3,
  DEFAULT = 6,
  BEST = 9,
}

export interface CompressionResult {
  data: Buffer;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  timeMs: number;
}

export interface CompressionStats {
  totalCompressed: number;
  totalDecompressed: number;
  bytesIn: number;
  bytesOut: number;
  avgRatio: number;
  avgTimeMs: number;
  byAlgorithm: Record<CompressionAlgorithm, {
    count: number;
    avgRatio: number;
    avgTimeMs: number;
  }>;
}

export interface AdaptiveConfig {
  enabled: boolean;
  minSizeForCompression: number;  // bytes
  targetRatio: number;            // minimum ratio to use compression
  bandwidthThresholdKbps: number; // below this, compress more aggressively
  cpuThresholdPercent: number;    // above this, prefer faster algorithms
}

// ============================================
// COMPRESSION SERVICE
// ============================================

export class CompressionService extends EventEmitter {
  private stats: CompressionStats = {
    totalCompressed: 0,
    totalDecompressed: 0,
    bytesIn: 0,
    bytesOut: 0,
    avgRatio: 0,
    avgTimeMs: 0,
    byAlgorithm: {
      [CompressionAlgorithm.NONE]: { count: 0, avgRatio: 1, avgTimeMs: 0 },
      [CompressionAlgorithm.GZIP]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
      [CompressionAlgorithm.DEFLATE]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
      [CompressionAlgorithm.LZ4]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
      [CompressionAlgorithm.ZSTD]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
      [CompressionAlgorithm.SNAPPY]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
    },
  };

  private adaptiveConfig: AdaptiveConfig = {
    enabled: true,
    minSizeForCompression: 100,      // Only compress if > 100 bytes
    targetRatio: 0.8,                // Only use compression if saves > 20%
    bandwidthThresholdKbps: 100,     // Low bandwidth threshold
    cpuThresholdPercent: 80,         // High CPU threshold
  };

  private currentBandwidthKbps: number = 1000;  // Estimated bandwidth
  private currentCpuPercent: number = 30;       // Estimated CPU usage
  private ratioHistory: Map<CompressionAlgorithm, number[]> = new Map();

  constructor(config?: Partial<AdaptiveConfig>) {
    super();
    if (config) {
      this.adaptiveConfig = { ...this.adaptiveConfig, ...config };
    }
  }

  /**
   * Compress data with specified algorithm
   */
  compress(
    data: Buffer,
    algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP,
    level: CompressionLevel = CompressionLevel.DEFAULT
  ): CompressionResult {
    const startTime = Date.now();
    let compressed: Buffer;

    if (algorithm === CompressionAlgorithm.NONE || data.length < this.adaptiveConfig.minSizeForCompression) {
      return {
        data,
        algorithm: CompressionAlgorithm.NONE,
        originalSize: data.length,
        compressedSize: data.length,
        ratio: 1,
        timeMs: Date.now() - startTime,
      };
    }

    try {
      switch (algorithm) {
        case CompressionAlgorithm.GZIP:
          compressed = gzipSync(data, { level });
          break;

        case CompressionAlgorithm.DEFLATE:
          compressed = deflateSync(data, { level });
          break;

        case CompressionAlgorithm.LZ4:
          // LZ4 would require external library
          // Fallback to deflate with fastest settings
          compressed = deflateSync(data, { level: 1 });
          break;

        case CompressionAlgorithm.ZSTD:
          // ZSTD would require external library
          // Fallback to gzip
          compressed = gzipSync(data, { level });
          break;

        case CompressionAlgorithm.SNAPPY:
          // Snappy would require external library
          // Fallback to deflate
          compressed = deflateSync(data, { level: 1 });
          break;

        default:
          compressed = data;
      }
    } catch (error) {
      logger.error('Compression failed, returning uncompressed', { error, algorithm });
      return {
        data,
        algorithm: CompressionAlgorithm.NONE,
        originalSize: data.length,
        compressedSize: data.length,
        ratio: 1,
        timeMs: Date.now() - startTime,
      };
    }

    const timeMs = Date.now() - startTime;
    const ratio = compressed.length / data.length;

    // Update stats
    this.updateStats(algorithm, data.length, compressed.length, ratio, timeMs);

    const result: CompressionResult = {
      data: compressed,
      algorithm,
      originalSize: data.length,
      compressedSize: compressed.length,
      ratio,
      timeMs,
    };

    this.emit('compressed', result);
    return result;
  }

  /**
   * Decompress data
   */
  decompress(
    data: Buffer,
    algorithm: CompressionAlgorithm
  ): Buffer {
    const startTime = Date.now();

    if (algorithm === CompressionAlgorithm.NONE) {
      return data;
    }

    try {
      let decompressed: Buffer;

      switch (algorithm) {
        case CompressionAlgorithm.GZIP:
          decompressed = gunzipSync(data);
          break;

        case CompressionAlgorithm.DEFLATE:
          decompressed = inflateSync(data);
          break;

        case CompressionAlgorithm.LZ4:
        case CompressionAlgorithm.SNAPPY:
          // Fallback to deflate since we used it for compression
          decompressed = inflateSync(data);
          break;

        case CompressionAlgorithm.ZSTD:
          // Fallback to gzip since we used it for compression
          decompressed = gunzipSync(data);
          break;

        default:
          return data;
      }

      this.stats.totalDecompressed++;
      const timeMs = Date.now() - startTime;

      this.emit('decompressed', {
        algorithm,
        compressedSize: data.length,
        decompressedSize: decompressed.length,
        timeMs,
      });

      return decompressed;
    } catch (error) {
      logger.error('Decompression failed', { error, algorithm });
      throw error;
    }
  }

  /**
   * Adaptive compression - automatically select best algorithm
   */
  compressAdaptive(data: Buffer): CompressionResult {
    if (!this.adaptiveConfig.enabled || data.length < this.adaptiveConfig.minSizeForCompression) {
      return this.compress(data, CompressionAlgorithm.NONE);
    }

    // Select algorithm based on conditions
    const algorithm = this.selectAlgorithm(data.length);
    const level = this.selectLevel();

    const result = this.compress(data, algorithm, level);

    // If compression didn't help enough, return uncompressed
    if (result.ratio > this.adaptiveConfig.targetRatio) {
      return {
        data,
        algorithm: CompressionAlgorithm.NONE,
        originalSize: data.length,
        compressedSize: data.length,
        ratio: 1,
        timeMs: result.timeMs,
      };
    }

    return result;
  }

  /**
   * Compress stream
   */
  createCompressStream(
    algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP,
    level: CompressionLevel = CompressionLevel.DEFAULT
  ): NodeJS.ReadWriteStream {
    switch (algorithm) {
      case CompressionAlgorithm.GZIP:
        return createGzip({ level });
      case CompressionAlgorithm.DEFLATE:
        return createDeflate({ level });
      default:
        return createGzip({ level });
    }
  }

  /**
   * Decompress stream
   */
  createDecompressStream(algorithm: CompressionAlgorithm): NodeJS.ReadWriteStream {
    switch (algorithm) {
      case CompressionAlgorithm.GZIP:
        return createGunzip();
      case CompressionAlgorithm.DEFLATE:
        return createInflate();
      default:
        return createGunzip();
    }
  }

  /**
   * Test compression ratios for data
   */
  benchmark(data: Buffer): Record<CompressionAlgorithm, CompressionResult> {
    const results: Record<string, CompressionResult> = {};

    for (const algorithm of Object.values(CompressionAlgorithm)) {
      if (algorithm === CompressionAlgorithm.NONE) continue;
      results[algorithm] = this.compress(data, algorithm, CompressionLevel.DEFAULT);
    }

    return results as Record<CompressionAlgorithm, CompressionResult>;
  }

  /**
   * Update network conditions for adaptive compression
   */
  updateNetworkConditions(bandwidthKbps: number, latencyMs?: number): void {
    this.currentBandwidthKbps = bandwidthKbps;

    this.emit('networkConditionsUpdated', {
      bandwidthKbps,
      latencyMs,
    });
  }

  /**
   * Update CPU usage for adaptive compression
   */
  updateCpuUsage(cpuPercent: number): void {
    this.currentCpuPercent = cpuPercent;
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompressed: 0,
      totalDecompressed: 0,
      bytesIn: 0,
      bytesOut: 0,
      avgRatio: 0,
      avgTimeMs: 0,
      byAlgorithm: {
        [CompressionAlgorithm.NONE]: { count: 0, avgRatio: 1, avgTimeMs: 0 },
        [CompressionAlgorithm.GZIP]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
        [CompressionAlgorithm.DEFLATE]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
        [CompressionAlgorithm.LZ4]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
        [CompressionAlgorithm.ZSTD]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
        [CompressionAlgorithm.SNAPPY]: { count: 0, avgRatio: 0, avgTimeMs: 0 },
      },
    };
    this.ratioHistory.clear();
  }

  /**
   * Get recommended algorithm based on data characteristics
   */
  getRecommendedAlgorithm(
    dataType: 'json' | 'binary' | 'text' | 'mixed',
    priority: 'speed' | 'ratio' | 'balanced'
  ): CompressionAlgorithm {
    if (priority === 'speed') {
      return CompressionAlgorithm.LZ4;  // Would use actual LZ4 with library
    }

    if (priority === 'ratio') {
      return CompressionAlgorithm.ZSTD;  // Would use actual ZSTD with library
    }

    // Balanced - use GZIP for JSON/text, DEFLATE for binary
    if (dataType === 'binary') {
      return CompressionAlgorithm.DEFLATE;
    }

    return CompressionAlgorithm.GZIP;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private selectAlgorithm(dataSize: number): CompressionAlgorithm {
    // Low bandwidth: use best compression
    if (this.currentBandwidthKbps < this.adaptiveConfig.bandwidthThresholdKbps) {
      return CompressionAlgorithm.GZIP;  // Best ratio
    }

    // High CPU: use fast compression
    if (this.currentCpuPercent > this.adaptiveConfig.cpuThresholdPercent) {
      return CompressionAlgorithm.LZ4;  // Fastest (simulated with deflate level 1)
    }

    // Small data: use fast compression
    if (dataSize < 1000) {
      return CompressionAlgorithm.DEFLATE;
    }

    // Default: balanced
    return CompressionAlgorithm.GZIP;
  }

  private selectLevel(): CompressionLevel {
    // High CPU: use fastest level
    if (this.currentCpuPercent > this.adaptiveConfig.cpuThresholdPercent) {
      return CompressionLevel.FASTEST;
    }

    // Low bandwidth: use best compression
    if (this.currentBandwidthKbps < this.adaptiveConfig.bandwidthThresholdKbps) {
      return CompressionLevel.BEST;
    }

    return CompressionLevel.DEFAULT;
  }

  private updateStats(
    algorithm: CompressionAlgorithm,
    originalSize: number,
    compressedSize: number,
    ratio: number,
    timeMs: number
  ): void {
    this.stats.totalCompressed++;
    this.stats.bytesIn += originalSize;
    this.stats.bytesOut += compressedSize;

    // Update rolling average
    this.stats.avgRatio = (
      (this.stats.avgRatio * (this.stats.totalCompressed - 1) + ratio) /
      this.stats.totalCompressed
    );
    this.stats.avgTimeMs = (
      (this.stats.avgTimeMs * (this.stats.totalCompressed - 1) + timeMs) /
      this.stats.totalCompressed
    );

    // Update per-algorithm stats
    const algStats = this.stats.byAlgorithm[algorithm];
    algStats.count++;
    algStats.avgRatio = (
      (algStats.avgRatio * (algStats.count - 1) + ratio) /
      algStats.count
    );
    algStats.avgTimeMs = (
      (algStats.avgTimeMs * (algStats.count - 1) + timeMs) /
      algStats.count
    );

    // Keep ratio history for adaptive selection
    let history = this.ratioHistory.get(algorithm) || [];
    history.push(ratio);
    if (history.length > 100) {
      history = history.slice(-100);
    }
    this.ratioHistory.set(algorithm, history);
  }
}

export const compressionService = new CompressionService();
