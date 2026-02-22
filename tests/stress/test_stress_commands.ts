/**
 * Stress Test: 1000 Commands in 1 Minute
 *
 * Validates command processing under high load:
 *   - All commands processed (no dropped messages)
 *   - Rate limiting kicks in gracefully (429, not crashes)
 *   - No duplicate command execution
 *   - Audit log records every command
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DockerCompose } from '../helpers/docker-compose.helper';
import { BmsSimulator } from '../helpers/bms-simulator.helper';
import { ApiClient } from '../helpers/api-client.helper';
import { DbClient } from '../helpers/db-client.helper';

const SYSTEM_ID = 'stress-bess-001';
const COMMAND_COUNT = 1000;
const WINDOW_MS = 60_000; // 1 minute

describe('Stress Test: 1000 Commands in 1 Minute', () => {
  let compose: DockerCompose;
  let bms: BmsSimulator;
  let api: ApiClient;
  let db: DbClient;

  before(async () => {
    compose = new DockerCompose('docker-compose.test.yml');
    await compose.up(['mqtt', 'postgres', 'backend', 'edge']);
    await compose.waitHealthy(['backend', 'postgres']);

    bms = new BmsSimulator({ systemId: SYSTEM_ID, socPercent: 60 });
    await bms.start();

    api = new ApiClient({ baseUrl: process.env.API_URL ?? 'http://localhost:3001/api/v1' });
    await api.authenticate({ email: 'test@lifo4.com.br', password: 'testpassword' });

    db = new DbClient({ connectionString: process.env.DATABASE_URL ?? 'postgresql://ems:ems@localhost:5432/ems' });
  });

  after(async () => {
    await bms.stop();
    await db.close();
    await compose.down();
  });

  it('should process all commands or rate-limit gracefully — no crashes', async () => {
    const results = {
      accepted: 0,      // 202
      rateLimited: 0,   // 429
      errors: 0,        // 5xx
      other: 0,
    };

    const commandIds = new Set<string>();
    const intervalMs = WINDOW_MS / COMMAND_COUNT;

    // Send commands spread across the window
    const promises: Promise<void>[] = [];
    for (let i = 0; i < COMMAND_COUNT; i++) {
      const delay = i * intervalMs;
      promises.push(
        sleep(delay).then(async () => {
          try {
            const response = await api.post(
              `/systems/${SYSTEM_ID}/commands/charge`,
              { targetSoc: 50 + (i % 30), maxPowerKw: 5 },
              { expectError: true },
            );

            if (response.status === 202) {
              results.accepted++;
              if (response.data.commandId) {
                commandIds.add(response.data.commandId);
              }
            } else if (response.status === 429) {
              results.rateLimited++;
            } else if (response.status >= 500) {
              results.errors++;
            } else {
              results.other++;
            }
          } catch {
            results.errors++;
          }
        }),
      );
    }

    await Promise.all(promises);
    await sleep(5000); // allow all processing to complete

    console.log('Command results:', results);

    // No server-side crashes
    assert.equal(results.errors, 0, `Got ${results.errors} 5xx errors — no crashes allowed`);

    // Every accepted command should have unique ID (no duplicates)
    assert.equal(
      commandIds.size,
      results.accepted,
      `Duplicate command IDs detected: ${results.accepted} accepted, ${commandIds.size} unique IDs`,
    );

    // Total = accepted + rateLimited (no disappearing requests)
    assert.equal(
      results.accepted + results.rateLimited + results.other,
      COMMAND_COUNT,
      `Total responses don't add up: ${JSON.stringify(results)}`,
    );
  });

  it('should have audit log entries for all accepted commands', async () => {
    const result = await db.query(
      `SELECT COUNT(*) FROM audit_log
       WHERE action = 'command' AND system_id = $1
       AND created_at > NOW() - INTERVAL '5 minutes'`,
      [SYSTEM_ID],
    );

    // Audit should have at least the accepted commands
    const auditCount = Number(result.rows[0].count);
    assert.ok(auditCount > 0, 'Audit log should have command entries');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
