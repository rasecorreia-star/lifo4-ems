/**
 * BMS Configuration Routes for Lifo4 EMS
 */

import { Router } from 'express';
import { bmsConfigController } from '../controllers/bms-config.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/bms-config/:systemId
 * @desc    Get BMS configuration for a system
 * @access  Authenticated (Operator+)
 */
router.get(
  '/:systemId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => bmsConfigController.getConfiguration(req, res, next)
);

/**
 * @route   PUT /api/v1/bms-config/:systemId
 * @desc    Update BMS configuration
 * @access  Technician+
 */
router.put(
  '/:systemId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.updateConfiguration(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/:systemId/preview
 * @desc    Preview configuration changes without applying
 * @access  Technician+
 */
router.post(
  '/:systemId/preview',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.previewChanges(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/validate
 * @desc    Validate a configuration object
 * @access  Technician+
 */
router.post(
  '/validate',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.validateConfiguration(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/:systemId/approve
 * @desc    Approve pending configuration change
 * @access  Admin+
 */
router.post(
  '/:systemId/approve',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => bmsConfigController.approveChange(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/:systemId/reject
 * @desc    Reject pending configuration change
 * @access  Admin+
 */
router.post(
  '/:systemId/reject',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => bmsConfigController.rejectChange(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/:systemId/restore
 * @desc    Restore configuration to a previous version
 * @access  Technician+
 */
router.post(
  '/:systemId/restore',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.restoreVersion(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/:systemId/factory-reset
 * @desc    Restore factory defaults
 * @access  Admin+
 */
router.post(
  '/:systemId/factory-reset',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => bmsConfigController.restoreFactoryDefaults(req, res, next)
);

/**
 * @route   GET /api/v1/bms-config/:systemId/history
 * @desc    Get configuration change history
 * @access  Technician+
 */
router.get(
  '/:systemId/history',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.getHistory(req, res, next)
);

/**
 * @route   GET /api/v1/bms-config/templates
 * @desc    Get available BMS templates
 * @access  Technician+
 */
router.get(
  '/templates',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.getTemplates(req, res, next)
);

/**
 * @route   POST /api/v1/bms-config/:systemId/apply-template
 * @desc    Apply a template to a system
 * @access  Technician+
 */
router.post(
  '/:systemId/apply-template',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => bmsConfigController.applyTemplate(req, res, next)
);

export default router;
