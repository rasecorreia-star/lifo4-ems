/**
 * Stress Test: 100 BESS Telemetry Simultaneous Load
 *
 * Validates system behavior under peak load:
 *   - 100 BESS sending telemetry at 5s intervals
 *   - InfluxDB ingests all data without loss
 *   - Backend latency stays acceptable
 *   - No memory leaks in Node.js process
 *   - MQTT broker does not drop messages
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mqtt from 'mqtt';
import { InfluxDB } from '@influxdata/influxdb-client';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { ProcessMonitor } from '../helpers/process-monitor.helper';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const SYSTEM_COUNT = 100;
const TELEMETRY_INTERVAL_MS = 5000;
const TEST_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MEMORY_INCREASE_MB = 200;
const MAX_PUBLISH_LATENCY_MS = 1000;

describe('Stress Test: 100 BESS Telemetry', () => {
  let compose: DockerCompose;
  let clients: mqtt.MqttClient[];
  let influx: InfluxDB;
  let monitor: ProcessMonitor;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'influxdb', 'backend']);
    await compose.waitHealthy(['mqtt', 'influxdb', 'backend']);

    influx = new InfluxDB({
      url: process.env.INFLUX_URL ?? 'http://localhost:8086',
      token: process.env.INFLUX_TOKEN ?? 'dev-token',
    });

    monitor = new ProcessMonitor({ processName: 'node' });

    // Create 100 MQTT clients
    clients = [];
    for (let i = 0; i < SYSTEM_COUNT; i++) {
      const client = mqtt.connect(MQTT_URL, {
        clientId: `stress-bess-${String(i).padStart(3, '0')}`,
      });
      clients.push(client);
    }

    // Wait for all to connect
    await Promise.all(
      clients.map(
        (c) => new Promise<void>((resolve) => c.once('connect', resolve)),
      ),
    );
  });

  after(async () => {
    clients.forEach((c) => c.end());
    await compose.down();
  });

  it('should sustain 100 BESS telemetry for 5 minutes without degradation', async () => {
    const startMemoryMb = await monitor.getMemoryMb();
    let totalPublished = 0;
    let totalErrors = 0;
    let maxLatencyMs = 0;

    const publishInterval = setInterval(async () => {
      const latencies = await Promise.all(
        clients.map(async (client, i) => {
          const systemId = `stress-bess-${String(i).padStart(3, '0')}`;
          const payload = JSON.stringify({
            system_id: systemId,
            voltage: 48 + Math.random() * 4,
            current: Math.random() * 50 - 25,
            soc: 20 + Math.random() * 70,
            temperature: 20 + Math.random() * 15,
            timestamp: Date.now(),
          });

          const start = Date.now();
          return new Promise<number>((resolve) => {
            client.publish(
              `lifo4/${systemId}/telemetry`,
              payload,
              { qos: 1 },
              (err) => {
                if (err) totalErrors++;
                else totalPublished++;
                resolve(Date.now() - start);
              },
            );
          });
        }),
      );

      const maxRound = Math.max(...latencies);
      if (maxRound > maxLatencyMs) maxLatencyMs = maxRound;
    }, TELEMETRY_INTERVAL_MS);

    await sleep(TEST_DURATION_MS);
    clearInterval(publishInterval);

    const endMemoryMb = await monitor.getMemoryMb();
    const memoryIncreaseMb = endMemoryMb - startMemoryMb;

    console.log(`Total published: ${totalPublished}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Max publish latency: ${maxLatencyMs}ms`);
    console.log(`Memory increase: ${memoryIncreaseMb}MB`);

    // Loss tolerance: < 1%
    assert.ok(
      totalErrors / totalPublished < 0.01,
      `Error rate ${((totalErrors / totalPublished) * 100).toFixed(2)}% exceeds 1% threshold`,
    );

    // Latency SLA
    assert.ok(
      maxLatencyMs <= MAX_PUBLISH_LATENCY_MS,
      `Max publish latency ${maxLatencyMs}ms exceeds ${MAX_PUBLISH_LATENCY_MS}ms SLA`,
    );

    // Memory leak check
    assert.ok(
      memoryIncreaseMb <= MAX_MEMORY_INCREASE_MB,
      `Memory increase ${memoryIncreaseMb}MB exceeds ${MAX_MEMORY_INCREASE_MB}MB threshold`,
    );
  });

  it('should have all records in InfluxDB after stress test', async () => {
    await sleep(10_000); // allow any remaining ingestion

    const queryApi = influx.getQueryApi(process.env.INFLUX_ORG ?? 'lifo4');
    const query = `
      from(bucket: "${process.env.INFLUX_BUCKET ?? 'telemetry'}")
        |> range(start: -15m)
        |> filter(fn: (r) => r._measurement == "telemetry")
        |> group()
        |> count()
    `;

    let totalRecords = 0;
    for await (const row of queryApi.iterateRows(query)) {
      totalRecords += Number((row as any)._value ?? 0);
    }

    // Expect at least 99% of records
    const expectedMin = (TEST_DURATION_MS / TELEMETRY_INTERVAL_MS) * SYSTEM_COUNT * 0.99;
    assert.ok(
      totalRecords >= expectedMin,
      `Expected ≥${Math.ceil(expectedMin)} records in InfluxDB, got ${totalRecords}`,
    );
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
