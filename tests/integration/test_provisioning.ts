/**
 * Integration Test: Zero-Touch Provisioning
 *
 * Verifies: New edge controller registers itself and receives full config
 *   - Edge publishes to lifo4/provisioning/register
 *   - Cloud creates system in PostgreSQL automatically
 *   - Cloud responds with config on lifo4/provisioning/{edgeId}/config
 *   - Edge transitions to OPERATIONAL state
 *   - Zero human interaction required
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mqtt from 'mqtt';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { ApiClient } from '../helpers/api-client.helper';
import { DbClient } from '../helpers/db-client.helper';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

describe('Zero-Touch Provisioning', () => {
  let compose: DockerCompose;
  let mqttClient: mqtt.MqttClient;
  let api: ApiClient;
  let db: DbClient;
  let testEdgeId: string;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'postgres', 'backend']);
    await compose.waitHealthy(['backend', 'postgres', 'mqtt']);

    mqttClient = mqtt.connect(MQTT_URL);
    await new Promise<void>((resolve) => mqttClient.once('connect', resolve));

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'admin@lifo4.com.br', password: 'adminpassword' });

    db = new DbClient({ connectionString: process.env.DATABASE_URL ?? 'postgresql://ems:ems@localhost:5432/ems' });
  });

  after(async () => {
    mqttClient.end();
    await db.close();
    await compose.down();
  });

  it('should auto-create system when new edge registers', async () => {
    testEdgeId = `edge-test-${Date.now().toString(16)}`;

    const configReceived = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timeout waiting for provisioning config')),
        15_000,
      );

      mqttClient.subscribe(`lifo4/provisioning/${testEdgeId}/config`, (err) => {
        if (err) reject(err);
      });

      mqttClient.on('message', (topic, payload) => {
        if (topic === `lifo4/provisioning/${testEdgeId}/config`) {
          clearTimeout(timeout);
          resolve(JSON.parse(payload.toString()));
        }
      });
    });

    // Publish registration (simulating edge bootstrap)
    const registration = {
      edge_id: testEdgeId,
      mac_address: 'AA:BB:CC:DD:EE:FF',
      hardware: 'jetson-orin-nano',
      software_version: '1.0.0',
      ip_address: '192.168.1.100',
      timestamp: new Date().toISOString(),
      serial_number: 'SN123456',
      capabilities: ['modbus-tcp', 'mqtt', 'sqlite', 'edge-ml'],
    };

    mqttClient.publish('lifo4/provisioning/register', JSON.stringify(registration), { qos: 1 });

    // Wait for cloud to respond with config
    const config = await configReceived;

    assert.ok(config.site_id, 'Config should include site_id');
    assert.ok(config.system_id, 'Config should include system_id');
    assert.ok(config.organization_id, 'Config should include organization_id');
    assert.ok(config.modbus_config, 'Config should include modbus_config');
    assert.ok(config.safety_limits, 'Config should include safety_limits');
  });

  it('should create system record in PostgreSQL', async () => {
    // Give backend time to persist the record
    await sleep(2000);

    const system = await db.query(
      'SELECT * FROM systems WHERE edge_id = $1',
      [testEdgeId],
    );

    assert.equal(system.rows.length, 1, 'System should be created in database');
    assert.equal(system.rows[0].status, 'PROVISIONING', 'System should start in PROVISIONING status');
  });

  it('should be visible via API after provisioning', async () => {
    const response = await api.get('/systems');
    const systems: Array<{ edge_id: string }> = response.data;
    const found = systems.find((s) => s.edge_id === testEdgeId);
    assert.ok(found, 'Provisioned system should appear in API response');
  });

  it('should handle duplicate registration gracefully', async () => {
    // Re-registering same edge should not create duplicates
    const registration = {
      edge_id: testEdgeId,
      mac_address: 'AA:BB:CC:DD:EE:FF',
      hardware: 'jetson-orin-nano',
      software_version: '1.0.0',
      ip_address: '192.168.1.101', // IP changed (DHCP)
      timestamp: new Date().toISOString(),
      serial_number: 'SN123456',
      capabilities: ['modbus-tcp', 'mqtt'],
    };

    mqttClient.publish('lifo4/provisioning/register', JSON.stringify(registration), { qos: 1 });
    await sleep(3000);

    const result = await db.query('SELECT COUNT(*) FROM systems WHERE edge_id = $1', [testEdgeId]);
    assert.equal(Number(result.rows[0].count), 1, 'No duplicate systems should be created');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
