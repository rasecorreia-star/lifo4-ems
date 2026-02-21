/**
 * EV Charger Routes for Lifo4 EMS
 */

import { Router } from 'express';
import { evChargerController } from '../controllers/ev-charger.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CHARGER CRUD
// ============================================

router.post(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.createCharger(req, res, next)
);

router.get(
  '/site/:siteId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.getChargersBySite(req, res, next)
);

router.get(
  '/site/:siteId/statistics',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => evChargerController.getSiteStatistics(req, res, next)
);

router.get(
  '/:chargerId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.getCharger(req, res, next)
);

router.put(
  '/:chargerId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.updateCharger(req, res, next)
);

router.delete(
  '/:chargerId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.deleteCharger(req, res, next)
);

// ============================================
// CHARGING OPERATIONS
// ============================================

router.post(
  '/:chargerId/connectors/:connectorId/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.startCharging(req, res, next)
);

router.post(
  '/:chargerId/sessions/:sessionId/stop',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.stopCharging(req, res, next)
);

router.get(
  '/:chargerId/connectors/:connectorId/session',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.getActiveSession(req, res, next)
);

router.get(
  '/:chargerId/sessions',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.getSessions(req, res, next)
);

// ============================================
// CONNECTOR STATUS
// ============================================

router.get(
  '/:chargerId/connectors',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.getConnectorStatus(req, res, next)
);

router.post(
  '/:chargerId/connectors/:connectorId/unlock',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.unlockConnector(req, res, next)
);

// ============================================
// AUTHORIZATION
// ============================================

router.post(
  '/:chargerId/authorize',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.authorizeTag(req, res, next)
);

router.post(
  '/:chargerId/tags',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.addAuthorizedTag(req, res, next)
);

router.delete(
  '/:chargerId/tags/:idTag',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.removeAuthorizedTag(req, res, next)
);

// ============================================
// SMART CHARGING
// ============================================

router.post(
  '/:chargerId/connectors/:connectorId/profile',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.setChargingProfile(req, res, next)
);

router.delete(
  '/:chargerId/connectors/:connectorId/profile',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.clearChargingProfile(req, res, next)
);

router.get(
  '/:chargerId/profiles',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.getChargingProfiles(req, res, next)
);

// ============================================
// LOAD BALANCING
// ============================================

router.get(
  '/site/:siteId/load-balancing',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.getLoadBalancingConfig(req, res, next)
);

router.put(
  '/site/:siteId/load-balancing',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.updateLoadBalancingConfig(req, res, next)
);

// ============================================
// RESERVATIONS
// ============================================

router.post(
  '/:chargerId/connectors/:connectorId/reservations',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR, UserRole.USER]),
  (req, res, next) => evChargerController.createReservation(req, res, next)
);

router.get(
  '/:chargerId/reservations',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => evChargerController.getReservations(req, res, next)
);

router.delete(
  '/:chargerId/reservations/:reservationId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR, UserRole.USER]),
  (req, res, next) => evChargerController.cancelReservation(req, res, next)
);

// ============================================
// TARIFFS
// ============================================

router.get(
  '/site/:siteId/tariffs',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR, UserRole.USER]),
  (req, res, next) => evChargerController.getTariffs(req, res, next)
);

router.put(
  '/site/:siteId/tariffs',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.updateTariffs(req, res, next)
);

// ============================================
// OCPP COMMANDS
// ============================================

router.post(
  '/:chargerId/reset',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.reset(req, res, next)
);

router.post(
  '/:chargerId/connectors/:connectorId/availability',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.changeAvailability(req, res, next)
);

router.get(
  '/:chargerId/configuration',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.getConfiguration(req, res, next)
);

router.put(
  '/:chargerId/configuration',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => evChargerController.changeConfiguration(req, res, next)
);

router.post(
  '/:chargerId/trigger',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => evChargerController.triggerMessage(req, res, next)
);

// ============================================
// STATISTICS
// ============================================

router.get(
  '/:chargerId/statistics',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => evChargerController.getStatistics(req, res, next)
);

export default router;
