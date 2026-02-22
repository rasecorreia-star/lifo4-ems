/**
 * Integration Test: OTA Update with Rollback
 *
 * Verifies:
 *   - Cloud publishes update notification
 *   - Edge downloads, verifies checksum, installs into inactive partition
 *   - Healthy update → commits new version
 *   - Unhealthy update → automatic rollback to previous version
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mqtt from 'mqtt';
import { createHash } from 'crypto';
import { createServer } from 'http';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { EdgeInspector } from '../helpers/edge-inspector.helper';

const SYSTEM_ID = 'test-bess-001';
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

describe('OTA Update with Rollback', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let edge: EdgeInspector;
  let mqttClient: mqtt.MqttClient;
  let fileServer: ReturnType<typeof createServer>;
  let fileServerPort: number;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'backend', 'edge']);
    await compose.waitHealthy(['mqtt', 'edge']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 80 });
    await bms.start();

    edge = new EdgeInspector({ systemId: SYSTEM_ID });

    mqttClient = mqtt.connect(MQTT_URL);
    await new Promise<void>((resolve) => mqttClient.once('connect', resolve));

    // Spin up a local file server to serve test update images
    fileServer = createTestFileServer();
    fileServerPort = await startServer(fileServer);
  });

  after(async () => {
    mqttClient.end();
    fileServer.close();
    await bms.stop();
    await compose.down();
  });

  it('should download and install a valid update', async () => {
    const imageContent = Buffer.from('fake-update-image-v1.1.0');
    const checksum = 'sha256:' + createHash('sha256').update(imageContent).digest('hex');

    registerFileOnServer(fileServer, '/update-v110.img', imageContent);

    const otaPayload = {
      version: '1.1.0',
      url: `http://host.docker.internal:${fileServerPort}/update-v110.img`,
      checksum,
    };

    // Publish OTA notification
    const otaTopic = `lifo4/${SYSTEM_ID}/ota/update`;
    mqttClient.publish(otaTopic, JSON.stringify(otaPayload), { qos: 1 });

    // Subscribe to status topic
    const statusReceived = waitForMqttMessage(
      mqttClient,
      `lifo4/${SYSTEM_ID}/ota/status`,
      (payload) => {
        const data = JSON.parse(payload.toString());
        return data.status === 'UPDATE_SUCCESS' || data.status === 'DOWNLOAD_FAILED';
      },
      60_000,
    );

    const status = JSON.parse((await statusReceived).toString());
    assert.equal(status.status, 'UPDATE_SUCCESS', 'OTA update should succeed');
    assert.equal(status.version, '1.1.0');
  });

  it('should reject update with invalid checksum', async () => {
    const imageContent = Buffer.from('fake-update-image-v1.1.1');
    registerFileOnServer(fileServer, '/update-v111.img', imageContent);

    const otaPayload = {
      version: '1.1.1',
      url: `http://host.docker.internal:${fileServerPort}/update-v111.img`,
      checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', // wrong
    };

    mqttClient.publish(`lifo4/${SYSTEM_ID}/ota/update`, JSON.stringify(otaPayload), { qos: 1 });

    const status = JSON.parse(
      (
        await waitForMqttMessage(
          mqttClient,
          `lifo4/${SYSTEM_ID}/ota/status`,
          (p) => JSON.parse(p.toString()).status === 'CHECKSUM_FAILED',
          30_000,
        )
      ).toString(),
    );

    assert.equal(status.status, 'CHECKSUM_FAILED');
  });

  it('should rollback if post-update healthcheck fails', async () => {
    // This test requires special edge controller support for "fail-next-healthcheck" mode
    await edge.setDebugFlag('fail_next_healthcheck', true);

    const imageContent = Buffer.from('fake-update-image-v1.1.2');
    const checksum = 'sha256:' + createHash('sha256').update(imageContent).digest('hex');
    registerFileOnServer(fileServer, '/update-v112.img', imageContent);

    const otaPayload = {
      version: '1.1.2',
      url: `http://host.docker.internal:${fileServerPort}/update-v112.img`,
      checksum,
    };

    mqttClient.publish(`lifo4/${SYSTEM_ID}/ota/update`, JSON.stringify(otaPayload), { qos: 1 });

    const status = JSON.parse(
      (
        await waitForMqttMessage(
          mqttClient,
          `lifo4/${SYSTEM_ID}/ota/status`,
          (p) => JSON.parse(p.toString()).status === 'ROLLBACK_EXECUTED',
          120_000, // rollback can take longer
        )
      ).toString(),
    );

    assert.equal(status.status, 'ROLLBACK_EXECUTED');

    // Edge should have reverted to previous version
    const version = await edge.getCurrentVersion();
    assert.notEqual(version, '1.1.2', 'Should have rolled back from 1.1.2');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestFileServer() {
  const files = new Map<string, Buffer>();

  const server = createServer((req, res) => {
    const content = files.get(req.url ?? '');
    if (content) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  (server as any).__files = files;
  return server;
}

function registerFileOnServer(server: ReturnType<typeof createServer>, path: string, content: Buffer) {
  (server as any).__files.set(path, content);
}

function startServer(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '0.0.0.0', () => {
      const addr = server.address() as { port: number };
      resolve(addr.port);
    });
  });
}

function waitForMqttMessage(
  client: mqtt.MqttClient,
  topic: string,
  predicate: (payload: Buffer) => boolean,
  timeoutMs: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${topic}`)), timeoutMs);
    client.subscribe(topic);
    client.on('message', (t, payload) => {
      if (t === topic && predicate(payload)) {
        clearTimeout(timer);
        resolve(payload);
      }
    });
  });
}
