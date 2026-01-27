import { Router } from 'express';
import {
  getAlerts,
  getAlertById,
  markAsRead,
  acknowledgeAlert,
  resolveAlert,
  markMultipleAsRead,
  getUnreadCount,
  getAlertsSummary,
} from '../controllers/alert.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { auditLog } from '../middlewares/audit.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Summary and count (must be before :alertId)
router.get('/summary', getAlertsSummary);
router.get('/unread-count', getUnreadCount);

// Bulk operations
router.post('/read-multiple', markMultipleAsRead);

// CRUD
router.get('/', getAlerts);
router.get('/:alertId', getAlertById);

// Actions
router.post('/:alertId/read', markAsRead);

router.post(
  '/:alertId/acknowledge',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR),
  auditLog('ALERT_ACKNOWLEDGE'),
  acknowledgeAlert
);

router.post(
  '/:alertId/resolve',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  auditLog('ALERT_RESOLVE'),
  resolveAlert
);

export default router;
