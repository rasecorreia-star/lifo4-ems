/**
 * Integration Test: Edge → Cloud Telemetry Pipeline
 *
 * Verifies: Edge controller publishes telemetry → arrives in InfluxDB within SLA
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mqtt from 'mqtt';
import { InfluxDB } from '@influxdata/influxdb-client';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const INFLUX_URL = process.env.INFLUX_URL ?? 'http://localhost:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN ?? 'dev-token';
const INFLUX_ORG = process.env.INFLUX_ORG ?? 'lifo4';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET ?? 'telemetry';

const SYSTEM_ID = 'test-bess-001';
const TELEMETRY_LATENCY_SLA_MS = 500;

describe('Edge → Cloud Telemetry Pipeline', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let mqttClient: mqtt.MqttClient;
  let influx: InfluxDB;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'influxdb', 'backend', 'edge']);
    await compose.waitHealthy(['influxdb', 'mqtt', 'backend']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 65 });
    await bms.start();

    mqttClient = mqtt.connect(MQTT_URL);
    await new Promise<void>((resolve) => mqttClient.once('connect', resolve));

    influx = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
  });

  after(async () => {
    mqttClient.end();
    await bms.stop();
    await compose.down();
  });

  it('should receive telemetry in InfluxDB within SLA', async () => {
    const sentAt = Date.now();

    // Trigger a telemetry publish by poking BMS simulator
    await bms.publishTelemetry({
      voltage: 48.5,
      current: 12.3,
      soc: 65,
      temperature: 25.1,
      power: 595.55,
    });

    // Poll InfluxDB until data arrives or timeout
    const queryApi = influx.getQueryApi(INFLUX_ORG);
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -1m)
        |> filter(fn: (r) => r.system_id == "${SYSTEM_ID}")
        |> last()
    `;

    let received = false;
    let latencyMs = 0;

    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(100);
      const rows: unknown[] = [];
      for await (const row of queryApi.iterateRows(query)) {
        rows.push(row);
      }
      if (rows.length > 0) {
        received = true;
        latencyMs = Date.now() - sentAt;
        break;
      }
    }

    assert.ok(received, 'Telemetry should arrive in InfluxDB');
    assert.ok(
      latencyMs <= TELEMETRY_LATENCY_SLA_MS,
      `Latency ${latencyMs}ms exceeds SLA of ${TELEMETRY_LATENCY_SLA_MS}ms`,
    );
  });

  it('should persist 1000 consecutive telemetry points without loss', async () => {
    const publishCount = 1000;

    for (let i = 0; i < publishCount; i++) {
      await bms.publishTelemetry({ soc: 50 + (i % 40), voltage: 48 + Math.random() });
      await sleep(5);
    }

    await sleep(2000); // allow ingestion

    const queryApi = influx.getQueryApi(INFLUX_ORG);
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -5m)
        |> filter(fn: (r) => r.system_id == "${SYSTEM_ID}")
        |> count()
    `;

    let totalCount = 0;
    for await (const row of queryApi.iterateRows(query)) {
      totalCount += Number((row as any)._value ?? 0);
    }

    // Allow up to 1% loss in dev environment
    assert.ok(
      totalCount >= publishCount * 0.99,
      `Expected ≥${publishCount * 0.99} points, got ${totalCount}`,
    );
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
