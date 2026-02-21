/**
 * Mobile API Routes
 * Optimized endpoints for mobile applications with reduced payloads,
 * push notifications, offline support, and widget data.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { verifyToken } from '../middlewares/auth.middleware';
import { MobileService } from '../services/mobile/mobile.service';
import { pushNotificationService } from '../services/mobile/push-notification.service';
import { offlineSyncService } from '../services/mobile/offline-sync.service';

const router = Router();

// All routes require authentication
router.use(verifyToken);

// Initialize services
const mobileService = new MobileService();

/**
 * @route GET /api/mobile/dashboard
 * @desc Get optimized dashboard data for mobile
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const data = await mobileService.getDashboardData(userId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/mobile/systems/summary
 * @desc Get summarized BESS systems list
 */
router.get('/systems/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const summary = await mobileService.getSystemsSummary(userId);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/mobile/systems/:id/compact
 * @desc Get compact system data (reduced payload)
 */
router.get(
  '/systems/:id/compact',
  param('id').isString(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await mobileService.getCompactSystemData(id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/systems/:id/realtime
 * @desc Get real-time data with minimal payload
 */
router.get(
  '/systems/:id/realtime',
  param('id').isString(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await mobileService.getRealtimeData(id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/widget/data
 * @desc Get data for home screen widgets
 */
router.get('/widget/data', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const widgetType = req.query.type as string || 'summary';
    const data = await mobileService.getWidgetData(userId, widgetType);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/mobile/devices/register
 * @desc Register device for push notifications
 */
router.post(
  '/devices/register',
  body('deviceToken').isString().notEmpty(),
  body('platform').isIn(['ios', 'android']),
  body('deviceId').optional().isString(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { deviceToken, platform, deviceId } = req.body;

      await pushNotificationService.registerDevice(userId, {
        token: deviceToken,
        platform,
        deviceId
      });

      res.json({ success: true, message: 'Device registered for notifications' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route DELETE /api/mobile/devices/:token
 * @desc Unregister device from push notifications
 */
router.delete(
  '/devices/:token',
  param('token').isString(),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { token } = req.params;

      await pushNotificationService.unregisterDevice(userId, token);

      res.json({ success: true, message: 'Device unregistered' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/notifications/settings
 * @desc Get notification settings
 */
router.get('/notifications/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const settings = await pushNotificationService.getSettings(userId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/mobile/notifications/settings
 * @desc Update notification settings
 */
router.put(
  '/notifications/settings',
  body('alerts').optional().isBoolean(),
  body('warnings').optional().isBoolean(),
  body('reports').optional().isBoolean(),
  body('marketing').optional().isBoolean(),
  body('quietHoursStart').optional().isInt({ min: 0, max: 23 }),
  body('quietHoursEnd').optional().isInt({ min: 0, max: 23 }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      await pushNotificationService.updateSettings(userId, req.body);
      res.json({ success: true, message: 'Settings updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/notifications/history
 * @desc Get notification history
 */
router.get(
  '/notifications/history',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await pushNotificationService.getHistory(userId, limit, offset);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route POST /api/mobile/sync/changes
 * @desc Sync offline changes from mobile
 */
router.post(
  '/sync/changes',
  body('changes').isArray(),
  body('lastSyncTimestamp').isISO8601(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { changes, lastSyncTimestamp } = req.body;

      const result = await offlineSyncService.processChanges(
        userId,
        changes,
        new Date(lastSyncTimestamp)
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/sync/status
 * @desc Get sync status
 */
router.get('/sync/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const status = await offlineSyncService.getSyncStatus(userId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/mobile/sync/delta
 * @desc Get delta changes since last sync
 */
router.get(
  '/sync/delta',
  query('since').isISO8601(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const since = new Date(req.query.since as string);

      const delta = await offlineSyncService.getDeltaChanges(userId, since);
      res.json(delta);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route POST /api/mobile/commands/quick
 * @desc Quick command execution from mobile
 */
router.post(
  '/commands/quick',
  body('systemId').isString(),
  body('command').isIn([
    'start_charge', 'stop_charge', 'start_discharge', 'stop_discharge',
    'emergency_stop', 'reset_alarms', 'enable_maintenance', 'disable_maintenance'
  ]),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { systemId, command } = req.body;

      const result = await mobileService.executeQuickCommand(userId, systemId, command);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/alerts/active
 * @desc Get active alerts for mobile
 */
router.get('/alerts/active', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const alerts = await mobileService.getActiveAlerts(userId);
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/mobile/alerts/:id/acknowledge
 * @desc Acknowledge an alert from mobile
 */
router.post(
  '/alerts/:id/acknowledge',
  param('id').isString(),
  body('note').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { id } = req.params;
      const { note } = req.body;

      await mobileService.acknowledgeAlert(userId, id, note);
      res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/charts/:systemId/:metric
 * @desc Get optimized chart data for mobile
 */
router.get(
  '/charts/:systemId/:metric',
  param('systemId').isString(),
  param('metric').isIn(['soc', 'power', 'temperature', 'voltage', 'current', 'efficiency']),
  query('period').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
  query('points').optional().isInt({ min: 10, max: 200 }),
  async (req: Request, res: Response) => {
    try {
      const { systemId, metric } = req.params;
      const period = (req.query.period as string) || '24h';
      const points = parseInt(req.query.points as string) || 50;

      const data = await mobileService.getChartData(systemId, metric, period, points);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/mobile/reports/quick
 * @desc Get quick reports summary
 */
router.get('/reports/quick', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const reports = await mobileService.getQuickReports(userId);
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/mobile/energy/today
 * @desc Get today's energy summary
 */
router.get('/energy/today', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const summary = await mobileService.getTodayEnergySummary(userId);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/mobile/health
 * @desc Health check for mobile API
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    apiVersion: '2.0',
    features: [
      'compact_payloads',
      'push_notifications',
      'offline_sync',
      'widgets',
      'quick_commands'
    ]
  });
});

export default router;
