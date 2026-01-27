import { Router } from 'express';
import {
  createSystem,
  getSystems,
  getSystemById,
  updateSystem,
  deleteSystem,
  getSystemsBySite,
  getSystemsOverview,
  getProtectionSettings,
  updateProtectionSettings,
} from '../controllers/system.controller.js';
import { authenticate, requireRole, requireSystemAccess, filterSystemsForUser } from '../middlewares/auth.middleware.js';
import { auditLog } from '../middlewares/audit.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Overview route (must be before :systemId to avoid conflict)
// Uses filterSystemsForUser to ensure users only see their allowed systems
router.get('/overview', filterSystemsForUser, getSystemsOverview);

// CRUD routes
router.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  auditLog('SYSTEM_CREATE'),
  createSystem
);

// List systems - filtered by user permissions
router.get('/', filterSystemsForUser, getSystems);

router.get(
  '/:systemId',
  requireSystemAccess,
  getSystemById
);

router.patch(
  '/:systemId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  requireSystemAccess,
  auditLog('SYSTEM_UPDATE'),
  updateSystem
);

router.delete(
  '/:systemId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  requireSystemAccess,
  auditLog('SYSTEM_DELETE'),
  deleteSystem
);

// Protection settings
router.get(
  '/:systemId/protection',
  requireSystemAccess,
  getProtectionSettings
);

router.patch(
  '/:systemId/protection',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  requireSystemAccess,
  auditLog('PROTECTION_SETTINGS_UPDATE'),
  updateProtectionSettings
);

export default router;
