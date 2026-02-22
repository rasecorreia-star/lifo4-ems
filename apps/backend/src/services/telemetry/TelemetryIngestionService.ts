/**
 * TelemetryIngestionService
 *
 * Listens on MQTT topics: lifo4/+/telemetry, lifo4/+/alarms, lifo4/+/decisions
 * For each message:
 *  1. Validates the payload
 *  2. Writes telemetry to InfluxDB (batch)
 *  3. Writes alarms/decisions to PostgreSQL
 *  4. Updates system's last_communication in PostgreSQL
 *  5. Emits WebSocket event to frontend
 */
import mqtt from 'mqtt';
import { writeTelemetryPoint } from '../../data/influxdb/telemetry.repo';
import { createAlarm } from '../../data/postgres/alarms.repo';
import { updateSystemStatus } from '../../data/postgres/systems.repo';
import { getPool } from '../../data/postgres/connection';
import { logger } from '../../lib/logger.js';

type SocketServer = {
  to: (room: string) => { emit: (event: string, data: unknown) => void };
  emit: (event: string, data: unknown) => void;
};

interface TelemetryPayload {
  soc: number;
  soh: number;
  voltage: number;
  current: number;
  power_kw: number;
  temp_min: number;
  temp_max: number;
  temp_avg: number;
  frequency: number;
  grid_voltage: number;
  cell_voltage_min?: number;
  cell_voltage_max?: number;
}

export class TelemetryIngestionService {
  private mqttClient: mqtt.MqttClient | null = null;
  private io: SocketServer | null = null;

  constructor(io?: SocketServer) {
    this.io = io || null;
  }

  start(): void {
    const brokerUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
    this.mqttClient = mqtt.connect(brokerUrl, {
      clientId: `ems-ingestion-${Date.now()}`,
      keepalive: 60,
      reconnectPeriod: 5000,
    });

    this.mqttClient.on('connect', () => {
      logger.info('TelemetryIngestion connected to MQTT broker', { brokerUrl });
      this.mqttClient!.subscribe([
        'lifo4/+/telemetry',
        'lifo4/+/alarms',
        'lifo4/+/decisions',
        'lifo4/+/heartbeat',
      ]);
    });

    this.mqttClient.on('message', (topic, payload) => {
      this._handleMessage(topic, payload).catch((err) =>
        logger.error('TelemetryIngestion message processing error', { topic, error: err instanceof Error ? err.message : String(err) })
      );
    });

    this.mqttClient.on('error', (err) => {
      logger.error('TelemetryIngestion MQTT error', { error: err.message });
    });
  }

  stop(): void {
    this.mqttClient?.end();
  }

  private async _handleMessage(topic: string, raw: Buffer): Promise<void> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      logger.warn('TelemetryIngestion received invalid JSON', { topic });
      return;
    }

    // Extract siteId from topic: lifo4/{siteId}/...
    const parts = topic.split('/');
    const siteId = parts[1];
    const messageType = parts[2];

    if (!siteId || !messageType) return;

    switch (messageType) {
      case 'telemetry':
        await this._processTelemetry(siteId, payload as TelemetryPayload);
        break;
      case 'alarms':
        await this._processAlarm(siteId, payload);
        break;
      case 'decisions':
        await this._processDecision(siteId, payload);
        break;
      case 'heartbeat':
        await this._processHeartbeat(siteId, payload);
        break;
    }
  }

  private async _processTelemetry(siteId: string, data: TelemetryPayload): Promise<void> {
    // Resolve system UUID from siteId
    const systemId = await this._resolveSystemId(siteId);
    if (!systemId) return;

    const { orgId } = await this._getSystemOrg(systemId);

    // 1. Write to InfluxDB (async batch)
    writeTelemetryPoint({
      systemId,
      organizationId: orgId,
      soc: data.soc,
      soh: data.soh ?? 100,
      voltage: data.voltage,
      current: data.current,
      powerKw: data.power_kw,
      tempMin: data.temp_min,
      tempMax: data.temp_max,
      tempAvg: data.temp_avg,
      frequency: data.frequency,
      gridVoltage: data.grid_voltage,
      cellVoltageMin: data.cell_voltage_min,
      cellVoltageMax: data.cell_voltage_max,
    });

    // 2. Update latest snapshot in PostgreSQL
    const pool = getPool();
    await pool.query(
      `INSERT INTO telemetry_latest
         (system_id, soc, soh, voltage, current, power_kw,
          temp_min, temp_max, temp_avg, frequency, grid_voltage,
          cell_voltage_min, cell_voltage_max, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (system_id) DO UPDATE SET
         soc = EXCLUDED.soc, soh = EXCLUDED.soh, voltage = EXCLUDED.voltage,
         current = EXCLUDED.current, power_kw = EXCLUDED.power_kw,
         temp_min = EXCLUDED.temp_min, temp_max = EXCLUDED.temp_max,
         temp_avg = EXCLUDED.temp_avg, frequency = EXCLUDED.frequency,
         grid_voltage = EXCLUDED.grid_voltage,
         cell_voltage_min = EXCLUDED.cell_voltage_min,
         cell_voltage_max = EXCLUDED.cell_voltage_max,
         updated_at = NOW()`,
      [
        systemId, data.soc, data.soh ?? 100, data.voltage, data.current, data.power_kw,
        data.temp_min, data.temp_max, data.temp_avg, data.frequency, data.grid_voltage,
        data.cell_voltage_min ?? null, data.cell_voltage_max ?? null,
      ]
    );

    // 3. Update system status
    await updateSystemStatus(systemId, this._determineStatus(data), new Date());

    // 4. Emit WebSocket event to frontend
    this.io?.to(`system:${systemId}`).emit('telemetry:update', {
      systemId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  private async _processAlarm(siteId: string, data: Record<string, unknown>): Promise<void> {
    const systemId = await this._resolveSystemId(siteId);
    if (!systemId) return;

    await createAlarm(systemId, {
      severity: (data.severity as 'critical' | 'high' | 'medium' | 'low') || 'medium',
      type: data.type as string || 'UNKNOWN',
      message: data.message as string,
      metadata: data.metadata as Record<string, unknown>,
      acknowledged: false,
      resolved: false,
    });

    this.io?.emit('alarm:triggered', { systemId, ...data });
  }

  private async _processDecision(siteId: string, data: Record<string, unknown>): Promise<void> {
    const systemId = await this._resolveSystemId(siteId);
    if (!systemId) return;

    const pool = getPool();
    await pool.query(
      `INSERT INTO decisions (system_id, action, power_kw, duration_minutes,
                              priority, reason, confidence, mode, soc_at_decision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        systemId, data.action, data.power_kw, data.duration_min,
        data.priority, data.reason, data.confidence, data.mode, data.soc,
      ]
    );

    this.io?.to(`system:${systemId}`).emit('decision:logged', { systemId, ...data });
  }

  private async _processHeartbeat(siteId: string, data: Record<string, unknown>): Promise<void> {
    const systemId = await this._resolveSystemId(siteId);
    if (!systemId) return;

    const status = data.state === 'SAFE_MODE' ? 'fault' : 'online';
    await updateSystemStatus(systemId, status, new Date());
  }

  private async _resolveSystemId(siteId: string): Promise<string | null> {
    const pool = getPool();
    // Try by site_id in connection_config JSONB
    const result = await pool.query(
      `SELECT id FROM systems WHERE connection_config->>'site_id' = $1 LIMIT 1`,
      [siteId]
    );
    return result.rows[0]?.id || null;
  }

  private async _getSystemOrg(systemId: string): Promise<{ orgId: string }> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT organization_id FROM systems WHERE id = $1`,
      [systemId]
    );
    return { orgId: result.rows[0]?.organization_id || '' };
  }

  private _determineStatus(data: TelemetryPayload): string {
    if (data.power_kw > 0.5) return 'charging';
    if (data.power_kw < -0.5) return 'discharging';
    return 'idle';
  }
}
