import { Router } from 'express';
import {
  sendCommand,
  setOperationMode,
  emergencyStop,
  startCharge,
  stopCharge,
  startDischarge,
  stopDischarge,
  resetAlarms,
  startBalance,
  stopBalance,
  calibrateSoc,
  createSchedule,
  getSchedules,
  updateSchedule,
  deleteSchedule,
} from '../controllers/control.controller.js';
import { authenticate, requireRole, requireSystemAccess } from '../middlewares/auth.middleware.js';
import { controlLimiter } from '../middlewares/rateLimit.middleware.js';
import { auditLog } from '../middlewares/audit.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Control requires at least operator role
const requireOperator = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.TECHNICIAN,
  UserRole.OPERATOR
);

// Apply control-specific rate limiting
router.use(controlLimiter);

// Generic command endpoint
router.post(
  '/command',
  requireOperator,
  auditLog('CONTROL_COMMAND'),
  sendCommand
);

// Operation mode
router.post(
  '/:systemId/mode',
  requireOperator,
  requireSystemAccess,
  auditLog('SET_OPERATION_MODE'),
  setOperationMode
);

// Emergency stop (critical - requires admin)
router.post(
  '/:systemId/emergency-stop',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  requireSystemAccess,
  auditLog('EMERGENCY_STOP'),
  emergencyStop
);

// Charging control
router.post(
  '/:systemId/charge/start',
  requireOperator,
  requireSystemAccess,
  auditLog('START_CHARGE'),
  startCharge
);

router.post(
  '/:systemId/charge/stop',
  requireOperator,
  requireSystemAccess,
  auditLog('STOP_CHARGE'),
  stopCharge
);

// Discharging control
router.post(
  '/:systemId/discharge/start',
  requireOperator,
  requireSystemAccess,
  auditLog('START_DISCHARGE'),
  startDischarge
);

router.post(
  '/:systemId/discharge/stop',
  requireOperator,
  requireSystemAccess,
  auditLog('STOP_DISCHARGE'),
  stopDischarge
);

// Alarms
router.post(
  '/:systemId/reset-alarms',
  requireOperator,
  requireSystemAccess,
  auditLog('RESET_ALARMS'),
  resetAlarms
);

// Balancing
router.post(
  '/:systemId/balance/start',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  requireSystemAccess,
  auditLog('START_BALANCE'),
  startBalance
);

router.post(
  '/:systemId/balance/stop',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  requireSystemAccess,
  auditLog('STOP_BALANCE'),
  stopBalance
);

// SOC Calibration (requires technician+)
router.post(
  '/:systemId/calibrate-soc',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  requireSystemAccess,
  auditLog('CALIBRATE_SOC'),
  calibrateSoc
);

// Schedules
router.post(
  '/schedules',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  auditLog('CREATE_SCHEDULE'),
  createSchedule
);

router.get(
  '/:systemId/schedules',
  requireSystemAccess,
  getSchedules
);

router.patch(
  '/schedules/:scheduleId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  auditLog('UPDATE_SCHEDULE'),
  updateSchedule
);

router.delete(
  '/schedules/:scheduleId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN),
  auditLog('DELETE_SCHEDULE'),
  deleteSchedule
);

export default router;
