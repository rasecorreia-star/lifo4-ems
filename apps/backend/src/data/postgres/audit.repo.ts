import { getPool } from './connection';

export interface AuditEntry {
  action: string;
  userId?: string;
  organizationId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}

/** Insert-only audit log. No UPDATE or DELETE allowed at DB level. */
export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_log
       (action, user_id, organization_id, resource_type, resource_id,
        details, ip_address, user_agent, success)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.action,
      entry.userId || null,
      entry.organizationId || null,
      entry.resourceType || null,
      entry.resourceId || null,
      JSON.stringify(entry.details || {}),
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.success !== false,
    ]
  );
}

export async function getAuditLog(
  orgId: string,
  options: { limit?: number; offset?: number; resourceType?: string }
): Promise<unknown[]> {
  const pool = getPool();
  const { limit = 100, offset = 0, resourceType } = options;

  let query = `SELECT * FROM audit_log WHERE organization_id = $1`;
  const params: unknown[] = [orgId];

  if (resourceType) {
    params.push(resourceType);
    query += ` AND resource_type = $${params.length}`;
  }

  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}
