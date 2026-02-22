/**
 * Integration Test: Safety Manager Override
 *
 * Verifies that the Safety Manager (PRIORITY 1) correctly blocks
 * optimizer decisions that would violate safety limits.
 *
 * Safety must ALWAYS win, regardless of economic optimization.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { ApiClient } from '../helpers/api-client.helper';

const SYSTEM_ID = 'test-bess-001';

describe('Safety Manager Override', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let api: ApiClient;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'edge']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 50 });
    await bms.start();

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'test@lifo4.com.br', password: 'testpassword' });
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should block discharge when SOC is below minimum', async () => {
    await bms.forceSOC(19); // below 20% min
    await sleep(1000);

    const response = await api.post(
      `/systems/${SYSTEM_ID}/commands/discharge`,
      { targetSoc: 10, maxPowerKw: 20 },
      { expectError: true },
    );

    assert.ok(
      response.status === 400 || response.status === 409,
      `Should reject discharge command at low SOC, got ${response.status}`,
    );
    assert.ok(
      response.data.reason?.includes('SOC') || response.data.error?.includes('safety'),
      'Error message should mention SOC/safety',
    );
  });

  it('should block charge when SOC is above maximum', async () => {
    await bms.forceSOC(91); // above 90% max
    await sleep(1000);

    const response = await api.post(
      `/systems/${SYSTEM_ID}/commands/charge`,
      { targetSoc: 100, maxPowerKw: 20 },
      { expectError: true },
    );

    assert.ok(
      response.status === 400 || response.status === 409,
      `Should reject charge at high SOC, got ${response.status}`,
    );
  });

  it('should block all operations when temperature exceeds limit', async () => {
    await bms.forceTemperature(55); // above 50°C max
    await sleep(1000);

    const chargeResp = await api.post(
      `/systems/${SYSTEM_ID}/commands/charge`,
      { targetSoc: 80 },
      { expectError: true },
    );
    assert.ok(chargeResp.status >= 400, 'Charge should be blocked at high temperature');

    const dischargeResp = await api.post(
      `/systems/${SYSTEM_ID}/commands/discharge`,
      { targetSoc: 20 },
      { expectError: true },
    );
    assert.ok(dischargeResp.status >= 400, 'Discharge should be blocked at high temperature');

    // Restore temperature
    await bms.forceTemperature(25);
  });

  it('should allow operations after conditions return to safe range', async () => {
    await bms.forceSOC(60);
    await bms.forceTemperature(25);
    await sleep(2000);

    const response = await api.post(`/systems/${SYSTEM_ID}/commands/charge`, {
      targetSoc: 75,
      maxPowerKw: 10,
    });

    assert.equal(response.status, 202, 'Should allow charge when conditions are safe');
  });

  it('should log all safety override events in audit log', async () => {
    const eventsResp = await api.get(`/systems/${SYSTEM_ID}/events?type=safety_override`);
    const events: unknown[] = eventsResp.data;
    assert.ok(events.length > 0, 'Safety override events should be logged');
  });

  it('should trigger P1 alarm on critical safety violation', async () => {
    await bms.forceTemperature(60); // critical threshold
    await sleep(2000);

    const alarmsResp = await api.get(`/systems/${SYSTEM_ID}/alarms?active=true&severity=CRITICAL`);
    const alarms: Array<{ severity: string; type: string }> = alarmsResp.data;

    assert.ok(
      alarms.some((a) => a.type === 'OVER_TEMPERATURE' || a.type === 'TEMPERATURE_CRITICAL'),
      'Critical temperature alarm should be raised',
    );

    await bms.forceTemperature(25);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
