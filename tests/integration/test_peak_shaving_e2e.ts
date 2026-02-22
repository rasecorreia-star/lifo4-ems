/**
 * Integration Test: Peak Shaving End-to-End
 *
 * Verifies the full peak shaving cycle:
 *   1. Facility demand rises above threshold
 *   2. Edge detects demand spike (within 5s)
 *   3. BESS starts discharging (ramp-up)
 *   4. Demand drops below threshold
 *   5. BESS stops discharging
 *   6. Logs event + savings in database
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { LoadSimulator } from '../helpers/load-simulator.helper';
import { ApiClient } from '../helpers/api-client.helper';

const SYSTEM_ID = 'test-bess-001';
const DEMAND_LIMIT_KW = 100;
const TRIGGER_THRESHOLD_KW = 80;  // 80% of limit
const RESPONSE_TIME_SLA_MS = 5000; // 5s SLA

describe('Peak Shaving End-to-End', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let load: LoadSimulator;
  let api: ApiClient;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'edge']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 75 });
    await bms.start();

    load = new LoadSimulator({ systemId: SYSTEM_ID, baselineKw: 50 });

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'test@lifo4.com.br', password: 'testpassword' });

    // Configure peak shaving parameters
    await api.put(`/systems/${SYSTEM_ID}/optimization/peak-shaving`, {
      enabled: true,
      demandLimitKw: DEMAND_LIMIT_KW,
      triggerThresholdPercent: 80,
      minSocPercent: 20,
      maxDischargePowerKw: 50,
    });

    // Allow config to propagate to edge
    await sleep(3000);
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should start discharging within 5s when demand exceeds threshold', async () => {
    const spikeStartMs = Date.now();

    // Spike demand above threshold (80 kW)
    await load.setDemandKw(90);

    // Watch for discharge command on BMS
    const dischargingStarted = await bms.waitForMode('DISCHARGING', RESPONSE_TIME_SLA_MS);
    const responseTimeMs = Date.now() - spikeStartMs;

    assert.ok(dischargingStarted, 'BESS should start discharging when demand exceeds threshold');
    assert.ok(
      responseTimeMs <= RESPONSE_TIME_SLA_MS,
      `Response time ${responseTimeMs}ms exceeds SLA of ${RESPONSE_TIME_SLA_MS}ms`,
    );
  });

  it('should reduce effective demand below limit', async () => {
    // Give discharge a moment to ramp up
    await sleep(2000);

    const netDemand = await load.getMeasuredNetDemandKw();
    assert.ok(
      netDemand < DEMAND_LIMIT_KW,
      `Net demand ${netDemand} kW should be below limit ${DEMAND_LIMIT_KW} kW`,
    );
  });

  it('should stop discharging when demand drops naturally', async () => {
    // Reduce load back to baseline
    await load.setDemandKw(50);
    await sleep(3000);

    const status = await bms.getStatus();
    assert.notEqual(status.mode, 'DISCHARGING', 'BESS should stop discharging after demand spike passes');
  });

  it('should NOT discharge below minimum SOC', async () => {
    // Force SOC to near minimum
    await bms.forceSOC(21);
    await sleep(1000);

    // Spike demand again
    await load.setDemandKw(95);

    const dischargingStarted = await bms.waitForMode('DISCHARGING', 3000).catch(() => false);

    // SOC is at 21% (above 20% min), may discharge. Let's check it stops at 20%
    if (dischargingStarted) {
      await bms.waitForSOC(20, 10_000);
      await sleep(1000);
      const status = await bms.getStatus();
      assert.notEqual(status.mode, 'DISCHARGING', 'Should stop at min SOC');
    }

    await load.setDemandKw(50);
  });

  it('should log peak shaving event in API', async () => {
    const eventsResp = await api.get(`/systems/${SYSTEM_ID}/events?type=peak_shaving`);
    const events: unknown[] = eventsResp.data;
    assert.ok(events.length > 0, 'Peak shaving events should be logged');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
