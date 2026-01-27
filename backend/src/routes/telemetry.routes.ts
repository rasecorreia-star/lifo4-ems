import { Router } from 'express';
import {
  getCurrentTelemetry,
  getHistoricalTelemetry,
  getCellData,
  getTelemetryRange,
  getSocHistory,
  getEnergyStats,
} from '../controllers/telemetry.controller.js';
import { authenticate, requireSystemAccess } from '../middlewares/auth.middleware.js';
import { telemetryLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Apply telemetry-specific rate limiting
router.use(telemetryLimiter);

// Current telemetry
router.get('/:systemId/current', requireSystemAccess, getCurrentTelemetry);

// Cell data
router.get('/:systemId/cells', requireSystemAccess, getCellData);

// Historical data
router.get('/:systemId/history', requireSystemAccess, getHistoricalTelemetry);

// Range data (for charts)
router.get('/:systemId/range', requireSystemAccess, getTelemetryRange);

// SOC history
router.get('/:systemId/soc', requireSystemAccess, getSocHistory);

// Energy statistics
router.get('/:systemId/energy', requireSystemAccess, getEnergyStats);

export default router;
