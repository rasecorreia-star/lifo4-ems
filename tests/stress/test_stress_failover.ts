/**
 * Stress Test: Repeated Cloud Failover (10x in 30 minutes)
 *
 * Validates system resilience under repeated cloud outages:
 *   - Edges continue operating during each outage
 *   - No data loss across 10 failover cycles
 *   - Automatic reconnection on every restore
 *   - Sync completes fully after each restore
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { InfluxDB } from '@influxdata/influxdb-client';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { EdgeInspector } from '../helpers/edge-inspector.helper';

const SYSTEM_ID = 'stress-bess-001';
const FAILOVER_CYCLES = 10;
const OUTAGE_DURATION_MS = 90_000;  // 90 seconds per outage
const RESTORE_WAIT_MS = 90_000;     // 90 seconds to sync after restore

describe('Stress Test: 10 Failover Cycles in 30 Minutes', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let edge: EdgeInspector;
  let influx: InfluxDB;

  let totalExpectedRecords = 0;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'influxdb', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'influxdb', 'edge']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 70 });
    await bms.start();

    edge = new EdgeInspector({ systemId: SYSTEM_ID });

    influx = new InfluxDB({
      url: process.env.INFLUX_URL ?? 'http://localhost:8086',
      token: process.env.INFLUX_TOKEN ?? 'dev-token',
    });

    // Baseline telemetry before test
    await sleep(5000);
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should survive 10 failover cycles with no data loss', async () => {
    for (let cycle = 1; cycle <= FAILOVER_CYCLES; cycle++) {
      console.log(`\n[Failover] Cycle ${cycle}/${FAILOVER_CYCLES}`);

      // Count records before outage
      const recordsBefore = await countInfluxRecords(influx);

      // Take cloud down
      console.log(`  [${cycle}] Cloud going offline`);
      await compose.stop(['backend', 'mqtt']);

      // Let edge operate autonomously
      await sleep(OUTAGE_DURATION_MS);

      // Verify edge is still operational
      const heartbeat = await edge.getLastHeartbeat();
      assert.ok(
        heartbeat && Date.now() - heartbeat.timestamp < 10_000,
        `[Cycle ${cycle}] Edge should still be running during outage`,
      );

      assert.equal(
        heartbeat.mode,
        'AUTONOMOUS',
        `[Cycle ${cycle}] Edge should be in AUTONOMOUS mode`,
      );

      // Restore cloud
      console.log(`  [${cycle}] Restoring cloud`);
      await compose.start(['mqtt', 'backend']);
      await compose.waitHealthy(['backend', 'mqtt']);

      // Wait for sync
      await sleep(RESTORE_WAIT_MS);

      // Verify edge reconnected
      const afterHeartbeat = await edge.getLastHeartbeat();
      assert.equal(
        afterHeartbeat?.mode,
        'ONLINE',
        `[Cycle ${cycle}] Edge should return to ONLINE mode`,
      );

      // Verify SQLite buffer is empty (all synced)
      const bufferCount = await edge.getSqliteBufferCount();
      assert.equal(
        bufferCount,
        0,
        `[Cycle ${cycle}] SQLite buffer should be empty after sync`,
      );

      // Count records after sync
      const recordsAfter = await countInfluxRecords(influx);
      assert.ok(
        recordsAfter > recordsBefore,
        `[Cycle ${cycle}] InfluxDB should have new records after sync`,
      );

      console.log(`  [${cycle}] ✅ Cycle complete — records: ${recordsBefore} → ${recordsAfter}`);
    }
  });

  it('should maintain zero safety violations across all cycles', async () => {
    const violations = await edge.getSafetyViolationCount();
    assert.equal(violations, 0, 'No safety violations should occur during failover cycles');
  });
});

async function countInfluxRecords(influx: InfluxDB): Promise<number> {
  const queryApi = influx.getQueryApi(process.env.INFLUX_ORG ?? 'lifo4');
  const query = `
    from(bucket: "${process.env.INFLUX_BUCKET ?? 'telemetry'}")
      |> range(start: -60m)
      |> filter(fn: (r) => r.system_id == "stress-bess-001")
      |> group()
      |> count()
  `;

  let total = 0;
  for await (const row of queryApi.iterateRows(query)) {
    total += Number((row as any)._value ?? 0);
  }
  return total;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
