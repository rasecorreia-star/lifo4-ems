/**
 * Integration Test: Black Start (Grid Restoration from Blackout)
 *
 * Verifies the 6-state FSM:
 *   STANDBY → ENERGIZING → SYNCHRONIZING → ISLANDED → RECONNECTING → NORMAL
 *
 * Scenario: Complete grid blackout → BESS energizes critical loads → syncs → reconnects
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { GridSimulator } from '../helpers/grid-simulator.helper';
import { ApiClient } from '../helpers/api-client.helper';

const SYSTEM_ID = 'test-bess-001';

describe('Black Start — Grid Restoration FSM', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let grid: GridSimulator;
  let api: ApiClient;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'edge']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 70 });
    await bms.start();

    grid = new GridSimulator({ systemId: SYSTEM_ID });

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'test@lifo4.com.br', password: 'testpassword' });
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should enter ENERGIZING state after blackout detection', async () => {
    // Simulate grid failure
    await grid.simulateBlackout();

    // Edge should detect blackout and start FSM
    const stateChange = await waitForBlackStartState('ENERGIZING', 10_000);
    assert.ok(stateChange, 'Should enter ENERGIZING state');
  });

  it('should energize critical loads (not all loads)', async () => {
    await sleep(3000);

    const criticalLoadsActive = await grid.getCriticalLoadsStatus();
    const nonCriticalLoadsActive = await grid.getNonCriticalLoadsStatus();

    assert.ok(criticalLoadsActive, 'Critical loads should be powered');
    assert.ok(!nonCriticalLoadsActive, 'Non-critical loads should NOT be powered during black start');
  });

  it('should transition through SYNCHRONIZING state', async () => {
    const stateChange = await waitForBlackStartState('SYNCHRONIZING', 30_000);
    assert.ok(stateChange, 'Should enter SYNCHRONIZING state');

    const frequency = await bms.getOutputFrequency();
    assert.ok(
      Math.abs(frequency - 60) < 0.1,
      `Frequency should be ~60 Hz, got ${frequency} Hz`,
    );
  });

  it('should enter ISLANDED mode during grid absence', async () => {
    const stateChange = await waitForBlackStartState('ISLANDED', 10_000);
    assert.ok(stateChange, 'Should enter ISLANDED state');

    const status = await api.get(`/systems/${SYSTEM_ID}/black-start/status`);
    assert.equal(status.data.state, 'ISLANDED');
    assert.ok(status.data.islandedSinceMs > 0);
  });

  it('should reconnect when grid returns (RECONNECTING → NORMAL)', async () => {
    // Restore grid
    await grid.restoreGrid();

    const reconnected = await waitForBlackStartState('NORMAL', 60_000);
    assert.ok(reconnected, 'Should return to NORMAL state after grid restoration');

    // All loads should now be powered from grid
    const nonCriticalLoads = await grid.getNonCriticalLoadsStatus();
    assert.ok(nonCriticalLoads, 'Non-critical loads should be restored');
  });

  it('should log all FSM transitions in audit log', async () => {
    const auditResp = await api.get(`/systems/${SYSTEM_ID}/events?type=black_start`);
    const events: Array<{ state: string }> = auditResp.data;

    const expectedStates = ['ENERGIZING', 'SYNCHRONIZING', 'ISLANDED', 'RECONNECTING', 'NORMAL'];
    for (const state of expectedStates) {
      assert.ok(
        events.some((e) => e.state === state),
        `FSM transition to ${state} should be logged`,
      );
    }
  });

  // Helpers
  async function waitForBlackStartState(
    targetState: string,
    timeoutMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const resp = await api.get(`/systems/${SYSTEM_ID}/black-start/status`);
        if (resp.data.state === targetState) return true;
      } catch {
        // backend may be restarting
      }
      await sleep(500);
    }
    return false;
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
