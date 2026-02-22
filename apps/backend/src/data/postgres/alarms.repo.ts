import { getPool } from './connection';

export interface Alarm {
  id: string;
  systemId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message?: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export async function createAlarm(
  systemId: string,
  alarm: Omit<Alarm, 'id' | 'acknowledged' | 'resolved' | 'createdAt'>
): Promise<Alarm> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO alarms (system_id, severity, type, message, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [systemId, alarm.severity, alarm.type, alarm.message, JSON.stringify(alarm.metadata || {})]
  );
  return mapRow(result.rows[0]);
}

export async function getActiveAlarms(systemId: string): Promise<Alarm[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM alarms
     WHERE system_id = $1 AND resolved = FALSE
     ORDER BY created_at DESC`,
    [systemId]
  );
  return result.rows.map(mapRow);
}

export async function acknowledgeAlarm(
  alarmId: string,
  userId: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE alarms
     SET acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
     WHERE id = $2`,
    [userId, alarmId]
  );
}

export async function resolveAlarm(alarmId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE alarms
     SET resolved = TRUE, resolved_at = NOW(), auto_resolved = TRUE
     WHERE id = $1`,
    [alarmId]
  );
}

function mapRow(row: Record<string, unknown>): Alarm {
  return {
    id: row.id as string,
    systemId: row.system_id as string,
    severity: row.severity as Alarm['severity'],
    type: row.type as string,
    message: row.message as string,
    metadata: row.metadata as Record<string, unknown>,
    acknowledged: row.acknowledged as boolean,
    acknowledgedBy: row.acknowledged_by as string,
    acknowledgedAt: row.acknowledged_at as Date,
    resolved: row.resolved as boolean,
    resolvedAt: row.resolved_at as Date,
    createdAt: row.created_at as Date,
  };
}
