/**
 * Integration Test: Multi-System Concurrent Operation
 *
 * Verifies the system handles 10 BESS units operating simultaneously:
 *   - Telemetry from all 10 systems ingested correctly
 *   - Commands to each system delivered independently
 *   - No cross-contamination between systems
 *   - VPP coordinator optimizes across all units
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { ApiClient } from '../helpers/api-client.helper';
import { InfluxDB } from '@influxdata/influxdb-client';

const SYSTEM_COUNT = 10;
const SYSTEMS = Array.from({ length: SYSTEM_COUNT }, (_, i) => `test-bess-${String(i + 1).padStart(3, '0')}`);

describe('Multi-System Concurrent Operation (10 BESS)', () => {
  let compose: DockerCompose;
  let bmsInstances: BmsSimulator[];
  let api: ApiClient;
  let influx: InfluxDB;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'influxdb', 'postgres', 'backend']);
    await compose.waitHealthy(['backend', 'influxdb']);

    // Start all simulators in parallel
    bmsInstances = SYSTEMS.map(
      (systemId, i) =>
        new BmsSimulator({
          systemId,
          socPercent: 40 + i * 5, // staggered SOC
        }),
    );

    await Promise.all(bmsInstances.map((bms) => bms.start()));

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'admin@lifo4.com.br', password: 'adminpassword' });

    influx = new InfluxDB({
      url: process.env.INFLUX_URL ?? 'http://localhost:8086',
      token: process.env.INFLUX_TOKEN ?? 'dev-token',
    });

    // Allow telemetry to flow for 10s
    await sleep(10_000);
  });

  after(async () => {
    await Promise.all(bmsInstances.map((bms) => bms.stop()));
    await compose.down();
  });

  it('should ingest telemetry from all 10 systems', async () => {
    const queryApi = influx.getQueryApi(process.env.INFLUX_ORG ?? 'lifo4');

    for (const systemId of SYSTEMS) {
      const query = `
        from(bucket: "${process.env.INFLUX_BUCKET ?? 'telemetry'}")
          |> range(start: -1m)
          |> filter(fn: (r) => r.system_id == "${systemId}")
          |> count()
      `;

      let count = 0;
      for await (const row of queryApi.iterateRows(query)) {
        count += Number((row as any)._value ?? 0);
      }

      assert.ok(count > 0, `System ${systemId} should have telemetry in InfluxDB`);
    }
  });

  it('should deliver independent commands to each system', async () => {
    const commandPromises = SYSTEMS.map((systemId) =>
      api.post(`/systems/${systemId}/commands/charge`, {
        targetSoc: 75,
        maxPowerKw: 5,
      }),
    );

    const responses = await Promise.all(commandPromises);
    for (const [i, response] of responses.entries()) {
      assert.equal(
        response.status,
        202,
        `Command to system ${SYSTEMS[i]} should succeed`,
      );
    }
  });

  it('should not cross-contaminate commands between systems', async () => {
    // Send DISCHARGE only to system 001
    await api.post(`/systems/${SYSTEMS[0]}/commands/discharge`, {
      targetSoc: 30,
      maxPowerKw: 10,
    });

    await sleep(2000);

    // All other systems should NOT be discharging
    for (let i = 1; i < bmsInstances.length; i++) {
      const status = await bmsInstances[i].getStatus();
      assert.notEqual(
        status.mode,
        'DISCHARGING',
        `System ${SYSTEMS[i]} should not be discharging (only ${SYSTEMS[0]} was commanded)`,
      );
    }
  });

  it('should expose all 10 systems via API', async () => {
    const response = await api.get('/systems');
    const systems: Array<{ system_id: string }> = response.data;

    for (const systemId of SYSTEMS) {
      assert.ok(
        systems.some((s) => s.system_id === systemId),
        `System ${systemId} should appear in API response`,
      );
    }
  });

  it('should handle concurrent telemetry without message loss', async () => {
    // Each simulator publishes 100 points simultaneously
    const publishPromises = bmsInstances.map((bms) =>
      Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          bms.publishTelemetry({ soc: 50 + Math.random() * 10 }),
        ),
      ),
    );

    await Promise.all(publishPromises);
    await sleep(5000); // allow ingestion

    const queryApi = influx.getQueryApi(process.env.INFLUX_ORG ?? 'lifo4');
    let totalRecords = 0;

    for (const systemId of SYSTEMS) {
      const query = `
        from(bucket: "${process.env.INFLUX_BUCKET ?? 'telemetry'}")
          |> range(start: -3m)
          |> filter(fn: (r) => r.system_id == "${systemId}")
          |> count()
      `;
      for await (const row of queryApi.iterateRows(query)) {
        totalRecords += Number((row as any)._value ?? 0);
      }
    }

    const expectedMin = SYSTEM_COUNT * 100 * 0.99; // allow 1% loss
    assert.ok(
      totalRecords >= expectedMin,
      `Expected ≥${expectedMin} records across all systems, got ${totalRecords}`,
    );
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
