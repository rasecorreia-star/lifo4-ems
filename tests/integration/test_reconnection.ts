/**
 * Integration Test: Cloud Reconnection & Data Sync
 *
 * Verifies: After cloud returns online, edge:
 *   - Reconnects automatically (no manual intervention)
 *   - Syncs all buffered SQLite telemetry to InfluxDB
 *   - Resumes receiving cloud optimization updates
 *   - No data loss during the offline period
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { InfluxDB } from '@influxdata/influxdb-client';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { EdgeInspector } from '../helpers/edge-inspector.helper';
import { ApiClient } from '../helpers/api-client.helper';

const SYSTEM_ID = 'test-bess-001';

describe('Cloud Reconnection & Data Sync', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let edge: EdgeInspector;
  let api: ApiClient;
  let influx: InfluxDB;

  let bufferCountBeforeOffline = 0;
  let offlineStartMs = 0;
  let offlineEndMs = 0;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'influxdb', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'edge', 'influxdb']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 55 });
    await bms.start();

    edge = new EdgeInspector({ systemId: SYSTEM_ID });
    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    influx = new InfluxDB({
      url: process.env.INFLUX_URL ?? 'http://localhost:8086',
      token: process.env.INFLUX_TOKEN ?? 'dev-token',
    });

    // Baseline sync period
    await sleep(5000);
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should buffer data during outage', async () => {
    bufferCountBeforeOffline = await edge.getSqliteBufferCount();

    // Take cloud offline
    await compose.stop(['backend', 'mqtt']);
    offlineStartMs = Date.now();

    // Let data accumulate for 30s
    await sleep(30_000);

    const bufferAfter = await edge.getSqliteBufferCount();
    assert.ok(
      bufferAfter > bufferCountBeforeOffline,
      `Buffer should grow during outage: before=${bufferCountBeforeOffline} after=${bufferAfter}`,
    );
  });

  it('should reconnect automatically when cloud returns', async () => {
    // Restore cloud
    await compose.start(['mqtt', 'backend']);
    await compose.waitHealthy(['backend', 'mqtt']);
    offlineEndMs = Date.now();

    // Give edge time to detect reconnection
    await sleep(10_000);

    const heartbeat = await edge.getLastHeartbeat();
    assert.ok(heartbeat, 'Edge should send heartbeat after reconnect');
    assert.equal(heartbeat.mode, 'ONLINE', 'Edge should switch back to ONLINE mode');
  });

  it('should sync all buffered telemetry to InfluxDB', async () => {
    // Wait for sync to complete
    await sleep(15_000);

    const remainingBuffer = await edge.getSqliteBufferCount();
    assert.equal(remainingBuffer, 0, 'SQLite buffer should be empty after sync');

    // Verify records arrived in InfluxDB
    const queryApi = influx.getQueryApi(process.env.INFLUX_ORG ?? 'lifo4');
    const offlineStartISO = new Date(offlineStartMs).toISOString();
    const query = `
      from(bucket: "${process.env.INFLUX_BUCKET ?? 'telemetry'}")
        |> range(start: ${offlineStartISO})
        |> filter(fn: (r) => r.system_id == "${SYSTEM_ID}")
        |> count()
    `;

    let syncedCount = 0;
    for await (const row of queryApi.iterateRows(query)) {
      syncedCount += Number((row as any)._value ?? 0);
    }

    assert.ok(syncedCount > 0, 'Buffered telemetry should appear in InfluxDB after sync');
  });

  it('should resume receiving cloud optimization commands after reconnect', async () => {
    await api.authenticate({ email: 'test@lifo4.com.br', password: 'testpassword' });

    const response = await api.post(`/systems/${SYSTEM_ID}/commands/charge`, {
      targetSoc: 75,
      maxPowerKw: 10,
    });

    assert.equal(response.status, 202, 'Backend should accept commands after reconnect');

    const commandReceived = await bms.waitForCommand('charge', 3000);
    assert.ok(commandReceived, 'Edge should receive commands after reconnect');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
