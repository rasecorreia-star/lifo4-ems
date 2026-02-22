/**
 * File-based DeploymentRepository implementation.
 *
 * Persists canary deployment state to a JSON file so backend restarts
 * do not lose track of in-progress deployments.
 *
 * In production, replace with a PostgreSQL-backed implementation using
 * the canary_deployments table (DDL in infra/postgres/init.sql).
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../lib/logger.js';
import type { DeploymentRepository, CanaryDeploymentState } from './CanaryDeployment.js';

const STATE_FILE = path.resolve(
  process.env.DEPLOYMENT_STATE_DIR ?? '/data/deployments',
  'canary-state.json',
);

type StateMap = Record<string, CanaryDeploymentState>;

export class FileDeploymentRepository implements DeploymentRepository {
  private async readState(): Promise<StateMap> {
    try {
      const raw = await fs.readFile(STATE_FILE, 'utf8');
      return JSON.parse(raw) as StateMap;
    } catch (err: unknown) {
      // File not found on first run — return empty state
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      logger.warn('Could not read deployment state file', { path: STATE_FILE, error: err });
      return {};
    }
  }

  private async writeState(state: StateMap): Promise<void> {
    try {
      await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      logger.error('Could not write deployment state file', { path: STATE_FILE, error: err });
    }
  }

  async saveDeployment(deployment: CanaryDeploymentState): Promise<void> {
    const state = await this.readState();
    state[deployment.deploymentId] = deployment;
    await this.writeState(state);
    logger.info('[DeploymentRepo] Saved deployment', { deploymentId: deployment.deploymentId });
  }

  async updateDeployment(
    deploymentId: string,
    partial: Partial<CanaryDeploymentState>,
  ): Promise<void> {
    const state = await this.readState();
    if (!state[deploymentId]) {
      logger.warn('[DeploymentRepo] Deployment not found for update', { deploymentId });
      return;
    }
    state[deploymentId] = { ...state[deploymentId], ...partial } as CanaryDeploymentState;
    await this.writeState(state);
  }

  async getDeployment(deploymentId: string): Promise<CanaryDeploymentState | null> {
    const state = await this.readState();
    return state[deploymentId] ?? null;
  }

  async getLatestDeployment(): Promise<CanaryDeploymentState | null> {
    const state = await this.readState();
    const all = Object.values(state);
    if (all.length === 0) return null;
    return all.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )[0] ?? null;
  }
}
