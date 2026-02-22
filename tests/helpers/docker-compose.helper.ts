/**
 * Docker Compose test helper
 * Controls services lifecycle for integration and stress tests
 */

import { execSync, spawn } from 'child_process';
import path from 'path';

const COMPOSE_DIR = path.resolve(__dirname, '../../');

export class DockerCompose {
  private readonly file: string;

  constructor(composeFile = 'docker-compose.test.yml') {
    this.file = composeFile;
  }

  private cmd(args: string): string {
    const command = `docker compose -f ${path.join(COMPOSE_DIR, this.file)} ${args}`;
    return execSync(command, { cwd: COMPOSE_DIR, encoding: 'utf8', timeout: 120_000 });
  }

  async up(services: string[] = []): Promise<void> {
    const serviceArgs = services.join(' ');
    this.cmd(`up -d ${serviceArgs}`);
    await this.sleep(3000);
  }

  async down(): Promise<void> {
    try {
      this.cmd('down -v --remove-orphans');
    } catch {
      // best-effort cleanup
    }
  }

  async stop(services: string[]): Promise<void> {
    this.cmd(`stop ${services.join(' ')}`);
  }

  async start(services: string[]): Promise<void> {
    this.cmd(`start ${services.join(' ')}`);
  }

  async waitHealthy(services: string[], timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      let allHealthy = true;

      for (const service of services) {
        try {
          const output = this.cmd(`ps --format json ${service}`);
          const lines = output.trim().split('\n').filter((l) => l.trim().length > 0);

          if (lines.length === 0) {
            allHealthy = false;
            break;
          }

          let containers: Array<{ Health?: string; State?: string }> = [];
          try {
            containers = JSON.parse(`[${lines.join(',')}]`);
          } catch {
            // JSON parse failed — service not yet running
            allHealthy = false;
            break;
          }

          const healthy = containers.some(
            (c) => c.Health === 'healthy' || (c.Health === '' && c.State === 'running'),
          );
          if (!healthy) {
            allHealthy = false;
            break;
          }
        } catch {
          allHealthy = false;
          break;
        }
      }

      if (allHealthy) return;
      await this.sleep(2000);
    }

    throw new Error(`Services did not become healthy within ${timeoutMs}ms: ${services.join(', ')}`);
  }

  async getLogs(service: string, lines = 50): Promise<string> {
    return this.cmd(`logs --tail=${lines} ${service}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
