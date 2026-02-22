/**
 * Integration Test: Cloud Offline → Edge Continues Autonomous Operation
 *
 * Verifies: When cloud becomes unreachable, edge:
 *   - Continues real-time control
 *   - Applies cached optimization parameters
 *   - Buffers telemetry in SQLite
 *   - Does NOT stop the battery due to cloud loss
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { EdgeInspector } from '../helpers/edge-inspector.helper';

const SYSTEM_ID = 'test-bess-001';
const OFFLINE_DURATION_MS = 60_000; // simulate 1 min of cloud outage

describe('Failover: Cloud Offline → Edge Autonomous', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let edge: EdgeInspector;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'influxdb', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'edge']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 60 });
    await bms.start();

    edge = new EdgeInspector({ systemId: SYSTEM_ID });

    // Allow edge to sync optimization config before we kill cloud
    await sleep(5000);
  });

  after(async () => {
    await bms.stop();
    await compose.down();
  });

  it('should continue control loop when cloud is offline', async () => {
    // Take down backend + MQTT broker (simulating cloud outage)
    await compose.stop(['backend', 'mqtt']);

    // Wait and verify edge continues producing operational readings
    await sleep(10_000);

    const heartbeat = await edge.getLastHeartbeat();
    assert.ok(heartbeat, 'Edge should still produce heartbeats');
    assert.ok(
      Date.now() - heartbeat.timestamp < 5000,
      'Last heartbeat should be recent (< 5s ago)',
    );
    assert.equal(heartbeat.mode, 'AUTONOMOUS', 'Edge should switch to AUTONOMOUS mode');
  });

  it('should buffer telemetry in SQLite while offline', async () => {
    // Edge should be in AUTONOMOUS mode now
    const bufferedCount = await edge.getSqliteBufferCount();
    assert.ok(bufferedCount > 0, 'SQLite buffer should have records');
  });

  it('should keep battery operational (no emergency stop from cloud loss)', async () => {
    const batteryStatus = await bms.getStatus();
    assert.notEqual(batteryStatus.mode, 'EMERGENCY_STOP', 'Battery must not enter emergency stop');
    assert.notEqual(batteryStatus.mode, 'IDLE', 'Battery must remain in operational mode');
  });

  it('should apply cached optimization decisions offline', async () => {
    const decisions = await edge.getRecentDecisions(5);
    assert.ok(decisions.length > 0, 'Edge should be making decisions offline');
    // Decisions should reference cached optimization config
    for (const d of decisions) {
      assert.ok(d.source === 'CACHED' || d.source === 'LOCAL', 'Decisions should use local/cached config');
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
