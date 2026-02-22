/**
 * Process monitor helper for stress test memory/CPU tracking
 */

import { execSync } from 'child_process';

export interface ProcessMonitorConfig {
  processName: string;
}

export class ProcessMonitor {
  constructor(private readonly config: ProcessMonitorConfig) {}

  async getMemoryMb(): Promise<number> {
    try {
      // Docker container memory usage via stats API
      const output = execSync(
        `docker stats --no-stream --format "{{.MemUsage}}" | head -1`,
        { encoding: 'utf8', timeout: 5000 },
      );
      const match = output.match(/([\d.]+)([MGK]?iB)/);
      if (!match) return 0;

      const value = parseFloat(match[1]);
      const unit = match[2];

      if (unit.startsWith('G')) return value * 1024;
      if (unit.startsWith('K')) return value / 1024;
      return value;
    } catch {
      // Fallback: Node.js process memory
      return process.memoryUsage().heapUsed / 1_048_576;
    }
  }

  async getCpuPercent(): Promise<number> {
    try {
      const output = execSync(
        `docker stats --no-stream --format "{{.CPUPerc}}" | head -1`,
        { encoding: 'utf8', timeout: 5000 },
      );
      return parseFloat(output.replace('%', '').trim()) || 0;
    } catch {
      return 0;
    }
  }
}
