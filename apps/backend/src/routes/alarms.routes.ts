/**
 * Alarms Routes
 * Fleet-wide and per-system alarm management
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// In-memory alarm store (replace with database queries in production)
const silencedAlarms = new Map<
  string,
  { durationMinutes: number; reason: string; silencedAt: string; silencedBy: string }
>();

// ---------------------------------------------------------------------------
// GET /api/v1/alarms
// List all alarms, optionally filtered by active status
// ---------------------------------------------------------------------------
router.get('/', (req: Request, res: Response) => {
  const activeOnly = req.query['active'] === 'true';

  // Stub data — replace with database query in production
  const alarms = [
    {
      id: 'alarm-001',
      systemId: 'bess-001',
      type: 'OVER_TEMPERATURE',
      severity: 'P1',
      message: 'Battery temperature exceeds 50°C',
      active: true,
      triggeredAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      silenced: silencedAlarms.has('alarm-001'),
    },
    {
      id: 'alarm-002',
      systemId: 'bess-002',
      type: 'SOC_LOW',
      severity: 'P2',
      message: 'State of Charge below 15%',
      active: false,
      triggeredAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      resolvedAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
      silenced: false,
    },
  ];

  const filtered = activeOnly ? alarms.filter((a) => a.active) : alarms;

  return res.json({
    success: true,
    data: filtered,
    total: filtered.length,
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/alarms/system/:systemId
// Get alarms for a specific system
// ---------------------------------------------------------------------------
router.get('/system/:systemId', (req: Request, res: Response) => {
  const activeOnly = req.query['active'] === 'true';
  const { systemId } = req.params;

  // Stub — replace with database query filtered by systemId
  const alarms = [
    {
      id: `alarm-${systemId}-001`,
      systemId,
      type: 'MQTT_DISCONNECTED',
      severity: 'P2',
      message: `System ${systemId} disconnected from MQTT broker`,
      active: true,
      triggeredAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      silenced: silencedAlarms.has(`alarm-${systemId}-001`),
    },
  ];

  const filtered = activeOnly ? alarms.filter((a) => a.active) : alarms;

  return res.json({
    success: true,
    data: filtered,
    total: filtered.length,
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/alarms/:alarmId/silence
// Silence an alarm for a duration (OPERATOR+)
// ---------------------------------------------------------------------------
router.post('/:alarmId/silence', requireRole('OPERATOR'), (req: Request, res: Response) => {
  const { alarmId } = req.params;
  const { durationMinutes, reason } = req.body as {
    durationMinutes?: number;
    reason?: string;
  };

  if (!durationMinutes || durationMinutes <= 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'durationMinutes must be a positive number',
    });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'reason is required',
    });
  }

  silencedAlarms.set(alarmId, {
    durationMinutes,
    reason,
    silencedAt: new Date().toISOString(),
    silencedBy: req.user!.userId,
  });

  return res.json({
    success: true,
    message: `Alarm ${alarmId} silenced for ${durationMinutes} minutes`,
    data: {
      alarmId,
      ...silencedAlarms.get(alarmId),
      expiresAt: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/alarms/:alarmId/silence
// Remove silence from an alarm (TECHNICIAN+)
// ---------------------------------------------------------------------------
router.delete('/:alarmId/silence', requireRole('TECHNICIAN'), (req: Request, res: Response) => {
  const { alarmId } = req.params;

  if (!silencedAlarms.has(alarmId)) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Alarm ${alarmId} is not currently silenced`,
    });
  }

  silencedAlarms.delete(alarmId);

  return res.json({
    success: true,
    message: `Silence removed from alarm ${alarmId}`,
    data: { alarmId, unsilencedAt: new Date().toISOString(), unsilencedBy: req.user!.userId },
  });
});

export default router;
