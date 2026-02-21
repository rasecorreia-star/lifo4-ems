/**
 * Optimization Routes
 * API endpoints for energy optimization and AI-driven dispatch
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';
import {
  energyOptimizerService,
  OptimizationStrategy,
  OptimizationConfig,
} from '../services/optimization/energy-optimizer.service.js';
import { blackStartService, BlackStartConfig } from '../services/grid/blackstart.service.js';
import {
  gridIntegrationService,
  HybridSystemConfig,
  HybridControlMode,
} from '../services/grid/grid-integration.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// ENERGY OPTIMIZATION
// ============================================

/**
 * Start optimization for a system
 */
router.post('/optimization/:systemId/start', authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const config: OptimizationConfig = {
      systemId,
      strategy: req.body.strategy || OptimizationStrategy.VALUE_STACKING,
      constraints: {
        minSoc: req.body.minSoc || 20,
        maxSoc: req.body.maxSoc || 95,
        maxCyclesToday: req.body.maxCyclesToday || 2,
        reserveCapacity: req.body.reserveCapacity || 10,
        maxChargeRate: req.body.maxChargeRate || 0.5,
        maxDischargeRate: req.body.maxDischargeRate || 0.5,
        gridExportLimit: req.body.gridExportLimit,
        gridImportLimit: req.body.gridImportLimit,
      },
      objectives: req.body.objectives || [
        { type: 'cost', weight: 0.4 },
        { type: 'self_consumption', weight: 0.3 },
        { type: 'peak_reduction', weight: 0.3 },
      ],
      forecastHorizon: req.body.forecastHorizon || 24,
      updateInterval: req.body.updateInterval || 15,
    };

    await energyOptimizerService.startOptimization(config);

    res.json({
      success: true,
      message: 'Optimization started',
      data: { systemId, strategy: config.strategy },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Stop optimization for a system
 */
router.post('/optimization/:systemId/stop', authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    energyOptimizerService.stopOptimization(systemId);

    res.json({
      success: true,
      message: 'Optimization stopped',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current dispatch schedule
 */
router.get('/optimization/:systemId/schedule', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const schedule = energyOptimizerService.getDispatchSchedule(systemId);

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current dispatch recommendation
 */
router.get('/optimization/:systemId/recommendation', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const recommendation = energyOptimizerService.getDispatchRecommendation(systemId);

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available optimization strategies
 */
router.get('/optimization/strategies', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: OptimizationStrategy.ARBITRAGE,
        name: 'Energy Arbitrage',
        description: 'Buy low, sell high based on time-of-use tariffs',
      },
      {
        id: OptimizationStrategy.PEAK_SHAVING,
        name: 'Peak Shaving',
        description: 'Reduce demand peaks to lower demand charges',
      },
      {
        id: OptimizationStrategy.VALUE_STACKING,
        name: 'Value Stacking',
        description: 'Combine multiple revenue streams for maximum value',
      },
      {
        id: OptimizationStrategy.LOAD_LEVELING,
        name: 'Load Leveling',
        description: 'Smooth out load variations for stable operation',
      },
      {
        id: OptimizationStrategy.FREQUENCY_RESPONSE,
        name: 'Frequency Response',
        description: 'Fast response to grid frequency deviations',
      },
      {
        id: OptimizationStrategy.SELF_CONSUMPTION,
        name: 'Self-Consumption',
        description: 'Maximize use of self-generated solar',
      },
    ],
  });
});

// ============================================
// BLACK START
// ============================================

/**
 * Initialize black start capability
 */
router.post('/blackstart/:systemId/init', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const config: BlackStartConfig = {
      systemId,
      enabled: true,
      gridLossDetectionTime: req.body.gridLossDetectionTime || 100,
      transferTime: req.body.transferTime || 500,
      minSocForBlackStart: req.body.minSocForBlackStart || 30,
      resyncVoltageWindow: req.body.resyncVoltageWindow || 5,
      resyncFrequencyWindow: req.body.resyncFrequencyWindow || 0.5,
      resyncPhaseWindow: req.body.resyncPhaseWindow || 10,
      criticalLoads: req.body.criticalLoads || [],
      loadSheddingEnabled: req.body.loadSheddingEnabled ?? true,
      autoReconnect: req.body.autoReconnect ?? true,
    };

    await blackStartService.initialize(config);

    res.json({
      success: true,
      message: 'Black start initialized',
      data: { systemId },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger manual black start
 */
router.post('/blackstart/:systemId/trigger', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const userId = (req as any).user.id;

    await blackStartService.triggerManualBlackStart(systemId, userId);

    res.json({
      success: true,
      message: 'Black start triggered',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger manual grid reconnection
 */
router.post('/blackstart/:systemId/reconnect', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const userId = (req as any).user.id;

    await blackStartService.triggerManualReconnect(systemId, userId);

    res.json({
      success: true,
      message: 'Reconnection initiated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get island status
 */
router.get('/blackstart/:systemId/status', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const status = blackStartService.getIslandStatus(systemId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get black start history
 */
router.get('/blackstart/:systemId/history', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await blackStartService.getBlackStartHistory(systemId, limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GRID INTEGRATION
// ============================================

/**
 * Initialize hybrid system (Solar + BESS + Grid)
 */
router.post('/grid/:systemId/init', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const config: HybridSystemConfig = {
      systemId,
      solarCapacity: req.body.solarCapacity,
      bessCapacity: req.body.bessCapacity,
      gridConnectionCapacity: req.body.gridConnectionCapacity,
      exportLimit: req.body.exportLimit,
      importLimit: req.body.importLimit,
      meterIds: req.body.meterIds,
      controlMode: req.body.controlMode || HybridControlMode.AUTO,
      priorityOrder: req.body.priorityOrder || ['solar', 'bess', 'grid'],
    };

    await gridIntegrationService.initialize(config);

    res.json({
      success: true,
      message: 'Grid integration initialized',
      data: { systemId },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get power flow status
 */
router.get('/grid/:systemId/powerflow', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const status = gridIntegrationService.getPowerFlowStatus(systemId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Set control mode
 */
router.post('/grid/:systemId/mode', authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const { mode } = req.body;

    await gridIntegrationService.setControlMode(systemId, mode);

    res.json({
      success: true,
      message: `Control mode set to ${mode}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available control modes
 */
router.get('/grid/modes', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: HybridControlMode.AUTO,
        name: 'Automatic',
        description: 'AI-driven intelligent dispatch based on all factors',
      },
      {
        id: HybridControlMode.SELF_CONSUMPTION,
        name: 'Self-Consumption',
        description: 'Maximize use of solar, minimize grid exchange',
      },
      {
        id: HybridControlMode.ZERO_EXPORT,
        name: 'Zero Export',
        description: 'Never export to grid, curtail if necessary',
      },
      {
        id: HybridControlMode.TIME_OF_USE,
        name: 'Time-of-Use',
        description: 'Optimize based on tariff schedule',
      },
      {
        id: HybridControlMode.BACKUP,
        name: 'Backup Priority',
        description: 'Keep BESS charged for backup power',
      },
      {
        id: HybridControlMode.ECONOMIC,
        name: 'Economic',
        description: 'Maximize cost savings',
      },
    ],
  });
});

/**
 * Get energy history
 */
router.get('/grid/:systemId/history', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const startDate = new Date(req.query.start as string);
    const endDate = new Date(req.query.end as string);

    const history = await gridIntegrationService.getEnergyHistory(systemId, startDate, endDate);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
