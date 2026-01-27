/**
 * Fleet Management Routes for Lifo4 EMS
 */

import { Router } from 'express';
import { fleetController } from '../controllers/fleet.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// FLEET CRUD
// ============================================

/**
 * @route   POST /api/v1/fleet
 * @desc    Create a new fleet
 * @access  Admin+
 */
router.post(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.createFleet(req, res, next)
);

/**
 * @route   GET /api/v1/fleet
 * @desc    Get all fleets for organization
 * @access  Manager+
 */
router.get(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.getFleets(req, res, next)
);

/**
 * @route   GET /api/v1/fleet/:fleetId
 * @desc    Get fleet by ID
 * @access  Manager+
 */
router.get(
  '/:fleetId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.getFleet(req, res, next)
);

/**
 * @route   POST /api/v1/fleet/:fleetId/refresh
 * @desc    Update fleet status
 * @access  Manager+
 */
router.post(
  '/:fleetId/refresh',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.updateFleetStatus(req, res, next)
);

/**
 * @route   POST /api/v1/fleet/:fleetId/systems
 * @desc    Add systems to fleet
 * @access  Admin+
 */
router.post(
  '/:fleetId/systems',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.addSystems(req, res, next)
);

/**
 * @route   DELETE /api/v1/fleet/:fleetId/systems
 * @desc    Remove systems from fleet
 * @access  Admin+
 */
router.delete(
  '/:fleetId/systems',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.removeSystems(req, res, next)
);

// ============================================
// SLA MANAGEMENT
// ============================================

/**
 * @route   POST /api/v1/fleet/:fleetId/sla
 * @desc    Create SLA configuration
 * @access  Admin+
 */
router.post(
  '/:fleetId/sla',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.createSLAConfig(req, res, next)
);

/**
 * @route   GET /api/v1/fleet/sla/:slaId
 * @desc    Get SLA configuration
 * @access  Manager+
 */
router.get(
  '/sla/:slaId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.getSLAConfig(req, res, next)
);

/**
 * @route   POST /api/v1/fleet/sla/:slaId/report
 * @desc    Generate SLA report
 * @access  Manager+
 */
router.post(
  '/sla/:slaId/report',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.generateSLAReport(req, res, next)
);

/**
 * @route   POST /api/v1/fleet/sla/incident
 * @desc    Record SLA incident
 * @access  Technician+
 */
router.post(
  '/sla/incident',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => fleetController.recordIncident(req, res, next)
);

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * @route   POST /api/v1/fleet/bulk-operation
 * @desc    Create bulk operation
 * @access  Admin+
 */
router.post(
  '/bulk-operation',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.createBulkOperation(req, res, next)
);

/**
 * @route   POST /api/v1/fleet/bulk-operation/:operationId/execute
 * @desc    Execute bulk operation
 * @access  Admin+
 */
router.post(
  '/bulk-operation/:operationId/execute',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.executeBulkOperation(req, res, next)
);

// ============================================
// ANALYTICS
// ============================================

/**
 * @route   GET /api/v1/fleet/:fleetId/analytics
 * @desc    Get fleet analytics
 * @access  Manager+
 */
router.get(
  '/:fleetId/analytics',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.getFleetAnalytics(req, res, next)
);

/**
 * @route   GET /api/v1/fleet/:fleetId/benchmarks
 * @desc    Get system benchmarks
 * @access  Manager+
 */
router.get(
  '/:fleetId/benchmarks',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => fleetController.getSystemBenchmarks(req, res, next)
);

// ============================================
// FIRMWARE MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/fleet/firmware
 * @desc    Get firmware versions
 * @access  Technician+
 */
router.get(
  '/firmware',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => fleetController.getFirmwareVersions(req, res, next)
);

/**
 * @route   POST /api/v1/fleet/firmware/update
 * @desc    Schedule firmware update
 * @access  Admin+
 */
router.post(
  '/firmware/update',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => fleetController.scheduleFirmwareUpdate(req, res, next)
);

// ============================================
// MAINTENANCE
// ============================================

/**
 * @route   POST /api/v1/fleet/maintenance
 * @desc    Create maintenance schedule
 * @access  Technician+
 */
router.post(
  '/maintenance',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => fleetController.createMaintenanceSchedule(req, res, next)
);

/**
 * @route   GET /api/v1/fleet/:fleetId/maintenance
 * @desc    Get upcoming maintenance
 * @access  Technician+
 */
router.get(
  '/:fleetId/maintenance',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => fleetController.getUpcomingMaintenance(req, res, next)
);

export default router;
