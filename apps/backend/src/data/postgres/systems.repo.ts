import { getPool, setOrgContext, withTransaction } from './connection';

export interface System {
  id: string;
  organizationId: string;
  name: string;
  siteName?: string;
  serialNumber?: string;
  location?: Record<string, unknown>;
  batterySpec?: Record<string, unknown>;
  connectionConfig?: Record<string, unknown>;
  status: string;
  lastCommunication?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function findSystemsByOrg(orgId: string): Promise<System[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await setOrgContext(client, orgId);
    const result = await client.query(
      `SELECT id, organization_id, name, site_name, serial_number,
              location, battery_spec, connection_config, status,
              last_communication, created_at, updated_at
       FROM systems
       WHERE organization_id = $1
       ORDER BY name`,
      [orgId]
    );
    return result.rows.map(mapRow);
  } finally {
    client.release();
  }
}

export async function findSystemById(id: string, orgId: string): Promise<System | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await setOrgContext(client, orgId);
    const result = await client.query(
      `SELECT * FROM systems WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function createSystem(
  orgId: string,
  data: Partial<System>
): Promise<System> {
  return withTransaction(async (client) => {
    await setOrgContext(client, orgId);
    const result = await client.query(
      `INSERT INTO systems (organization_id, name, site_name, serial_number,
                            location, battery_spec, connection_config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        orgId, data.name, data.siteName, data.serialNumber,
        JSON.stringify(data.location || {}),
        JSON.stringify(data.batterySpec || {}),
        JSON.stringify(data.connectionConfig || {}),
        data.status || 'offline',
      ]
    );
    return mapRow(result.rows[0]);
  });
}

export async function updateSystemStatus(
  id: string,
  status: string,
  lastCommunication?: Date
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE systems SET status = $1, last_communication = $2, updated_at = NOW()
     WHERE id = $3`,
    [status, lastCommunication || new Date(), id]
  );
}

function mapRow(row: Record<string, unknown>): System {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    siteName: row.site_name as string,
    serialNumber: row.serial_number as string,
    location: row.location as Record<string, unknown>,
    batterySpec: row.battery_spec as Record<string, unknown>,
    connectionConfig: row.connection_config as Record<string, unknown>,
    status: row.status as string,
    lastCommunication: row.last_communication as Date,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
