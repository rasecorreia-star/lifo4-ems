/**
 * Integration Test: Cloud → Edge Command Delivery
 *
 * Verifies: Command issued via backend API → edge executes it within SLA
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { ApiClient } from '../helpers/api-client.helper';

const SYSTEM_ID = 'test-bess-001';
const COMMAND_ACK_TIMEOUT_MS = 2000; // 2s SLA

describe('Cloud → Edge Command Delivery', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let api: ApiClient;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'backend', 'edge']);
    await compose.waitHealthy(['mqtt', 'backend']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 60 });
    await bms.start();

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'test@lifo4.com.br', password: 'testpassword' });
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should deliver CHARGE command and receive ACK within SLA', async () => {
    const startCharge = api.post(`/systems/${SYSTEM_ID}/commands/charge`, {
      targetSoc: 80,
      maxPowerKw: 10,
    });

    const ackPromise = bms.waitForCommand('charge', COMMAND_ACK_TIMEOUT_MS);

    const [response, commandReceived] = await Promise.all([startCharge, ackPromise]);

    assert.equal(response.status, 202);
    assert.ok(commandReceived, 'Edge should receive CHARGE command');
    assert.equal(commandReceived.targetSoc, 80);
  });

  it('should deliver DISCHARGE command and receive ACK within SLA', async () => {
    const response = await api.post(`/systems/${SYSTEM_ID}/commands/discharge`, {
      targetSoc: 20,
      maxPowerKw: 15,
    });

    const commandReceived = await bms.waitForCommand('discharge', COMMAND_ACK_TIMEOUT_MS);

    assert.equal(response.status, 202);
    assert.ok(commandReceived, 'Edge should receive DISCHARGE command');
  });

  it('should deliver EMERGENCY_STOP and halt within 500ms', async () => {
    const startMs = Date.now();
    await api.post(`/systems/${SYSTEM_ID}/emergency-stop`, { reason: 'integration-test' });

    const stopped = await bms.waitForCommand('emergency_stop', 500);
    const elapsed = Date.now() - startMs;

    assert.ok(stopped, 'Edge should receive EMERGENCY_STOP');
    assert.ok(elapsed <= 500, `Emergency stop took ${elapsed}ms — SLA is 500ms`);
  });

  it('should reject commands for unknown system', async () => {
    const response = await api.post(
      '/systems/nonexistent-system/commands/charge',
      { targetSoc: 80 },
      { expectError: true },
    );
    assert.equal(response.status, 404);
  });

  it('should reject commands without authentication', async () => {
    const unauthApi = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    const response = await unauthApi.post(
      `/systems/${SYSTEM_ID}/commands/charge`,
      { targetSoc: 80 },
      { expectError: true },
    );
    assert.equal(response.status, 401);
  });
});
