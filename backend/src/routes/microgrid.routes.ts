/**
 * Microgrid Routes for Lifo4 EMS
 */

import { Router } from 'express';
import { microgridController } from '../controllers/microgrid.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// MICROGRID CRUD
// ============================================

router.post(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.createMicrogrid(req, res, next)
);

router.get(
  '/site/:siteId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => microgridController.getMicrogridsBySite(req, res, next)
);

router.get(
  '/:microgridId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => microgridController.getMicrogrid(req, res, next)
);

router.put(
  '/:microgridId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => microgridController.updateMicrogrid(req, res, next)
);

// ============================================
// COMPONENT MANAGEMENT
// ============================================

router.post(
  '/:microgridId/components',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.addComponent(req, res, next)
);

router.delete(
  '/:microgridId/components/:componentId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.removeComponent(req, res, next)
);

router.put(
  '/:microgridId/components/:componentId/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => microgridController.updateComponentStatus(req, res, next)
);

// ============================================
// OPERATING MODE CONTROL
// ============================================

router.put(
  '/:microgridId/mode',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.setOperatingMode(req, res, next)
);

router.get(
  '/:microgridId/state',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => microgridController.getState(req, res, next)
);

// ============================================
// ISLANDING CONTROL
// ============================================

router.post(
  '/:microgridId/island',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.initiateIslanding(req, res, next)
);

router.post(
  '/:microgridId/reconnect',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.reconnectToGrid(req, res, next)
);

// ============================================
// BLACK START
// ============================================

router.post(
  '/:microgridId/blackstart',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.initiateBlackStart(req, res, next)
);

router.put(
  '/:microgridId/blackstart/config',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.updateBlackStartConfig(req, res, next)
);

// ============================================
// POWER DISPATCH
// ============================================

router.post(
  '/:microgridId/dispatch',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => microgridController.dispatchPower(req, res, next)
);

// ============================================
// GRID SERVICES
// ============================================

router.get(
  '/:microgridId/grid-services',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => microgridController.getGridServicesConfig(req, res, next)
);

router.put(
  '/:microgridId/grid-services',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.updateGridServicesConfig(req, res, next)
);

// ============================================
// ENERGY TRADING
// ============================================

router.post(
  '/:microgridId/trades',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.createTrade(req, res, next)
);

router.post(
  '/trades/:tradeId/submit',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.submitTrade(req, res, next)
);

// ============================================
// EVENTS & STATISTICS
// ============================================

router.get(
  '/:microgridId/events',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => microgridController.getEvents(req, res, next)
);

router.get(
  '/:microgridId/statistics',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => microgridController.getStatistics(req, res, next)
);

// ============================================
// CONTROL LOOP
// ============================================

router.post(
  '/:microgridId/control/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.startControlLoop(req, res, next)
);

router.post(
  '/:microgridId/control/stop',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => microgridController.stopControlLoop(req, res, next)
);

export default router;
