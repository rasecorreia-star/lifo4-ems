/**
 * Digital Twin Routes
 * API endpoints for battery simulation and prediction
 */

import { Router, Request, Response, NextFunction } from 'express';
import { digitalTwinService } from '../services/simulation/digital-twin.service.js';
import { simulationScheduler } from '../services/simulation/simulation-scheduler.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ============================================
// Simulation Routes
// ============================================

/**
 * POST /api/digital-twin/simulate
 * Run a battery simulation
 */
router.post('/simulate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId, config } = req.body;

    if (!systemId || !config) {
      return res.status(400).json({
        success: false,
        error: 'systemId and config are required',
      });
    }

    const result = await digitalTwinService.simulate(systemId, {
      nominalCapacity: config.nominalCapacity || 100,
      nominalVoltage: config.nominalVoltage || 51.2,
      cellsInSeries: config.cellsInSeries || 16,
      cellsInParallel: config.cellsInParallel || 1,
      initialSoc: config.initialSoc || 0.5,
      temperature: config.temperature || 25,
      cRate: config.cRate || 0.5,
      simulationTime: config.simulationTime || 3600,
      timeStep: config.timeStep || 60,
      currentProfile: config.currentProfile,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error('Simulation error', { error });
    next(error);
  }
});

/**
 * POST /api/digital-twin/predict-cycles
 * Predict remaining battery cycles
 */
router.post('/predict-cycles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId, currentSoh, usagePattern } = req.body;

    if (!systemId || currentSoh === undefined) {
      return res.status(400).json({
        success: false,
        error: 'systemId and currentSoh are required',
      });
    }

    const prediction = await digitalTwinService.predictCycles(
      systemId,
      currentSoh,
      {
        avgDod: usagePattern?.avgDod || 0.8,
        avgCRate: usagePattern?.avgCRate || 0.5,
        avgTemperature: usagePattern?.avgTemperature || 25,
        cyclesPerDay: usagePattern?.cyclesPerDay || 1,
      }
    );

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    logger.error('Cycle prediction error', { error });
    next(error);
  }
});

/**
 * POST /api/digital-twin/compare
 * Compare simulation with real data
 */
router.post('/compare/:systemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId } = req.params;
    const { config, realData } = req.body;

    if (!config || !realData) {
      return res.status(400).json({
        success: false,
        error: 'config and realData are required',
      });
    }

    const comparison = await digitalTwinService.compareWithReal(
      systemId,
      config,
      realData
    );

    res.json({
      success: true,
      comparison,
    });
  } catch (error) {
    logger.error('Comparison error', { error });
    next(error);
  }
});

// ============================================
// State Estimation Routes
// ============================================

/**
 * POST /api/digital-twin/state/update
 * Update state estimate with new telemetry
 */
router.post('/state/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId, voltage, current, temperature, dt } = req.body;

    if (!systemId || voltage === undefined || current === undefined) {
      return res.status(400).json({
        success: false,
        error: 'systemId, voltage, and current are required',
      });
    }

    const state = await digitalTwinService.updateState(
      systemId,
      voltage,
      current,
      temperature,
      dt || 1.0
    );

    res.json({
      success: true,
      state,
    });
  } catch (error) {
    logger.error('State update error', { error });
    next(error);
  }
});

/**
 * GET /api/digital-twin/state/:systemId
 * Get current state estimate
 */
router.get('/state/:systemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId } = req.params;
    const twin = digitalTwinService.getTwinStatus(systemId);

    if (!twin || !twin.stateEstimate) {
      return res.json({
        success: true,
        state: null,
        message: 'No state data available',
      });
    }

    res.json({
      success: true,
      state: twin.stateEstimate,
    });
  } catch (error) {
    logger.error('Get state error', { error });
    next(error);
  }
});

// ============================================
// Degradation Prediction Routes
// ============================================

/**
 * POST /api/digital-twin/degradation/predict
 * Predict battery degradation
 */
router.post('/degradation/predict', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId, factors } = req.body;

    if (!systemId || !factors) {
      return res.status(400).json({
        success: false,
        error: 'systemId and factors are required',
      });
    }

    const prediction = await digitalTwinService.predictDegradation(
      systemId,
      {
        avgDod: factors.avgDod || 0.8,
        avgCRateCharge: factors.avgCRateCharge || 0.5,
        avgCRateDischarge: factors.avgCRateDischarge || 0.5,
        avgTemperature: factors.avgTemperature || 25,
        maxTemperature: factors.maxTemperature || 35,
        minTemperature: factors.minTemperature || 15,
        timeAtHighSoc: factors.timeAtHighSoc || 0.1,
        timeAtLowSoc: factors.timeAtLowSoc || 0.1,
        calendarDays: factors.calendarDays || 0,
        cycleCount: factors.cycleCount || 0,
      }
    );

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    logger.error('Degradation prediction error', { error });
    next(error);
  }
});

/**
 * POST /api/digital-twin/degradation/trajectory
 * Get degradation trajectory for charting
 */
router.post('/degradation/trajectory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { factors, years } = req.body;

    if (!factors) {
      return res.status(400).json({
        success: false,
        error: 'factors are required',
      });
    }

    const trajectory = await digitalTwinService.getDegradationTrajectory(
      factors,
      years || 10
    );

    res.json({
      success: true,
      trajectory,
    });
  } catch (error) {
    logger.error('Trajectory error', { error });
    next(error);
  }
});

// ============================================
// Scheduled Simulation Routes
// ============================================

/**
 * GET /api/digital-twin/schedules
 * Get all scheduled simulations
 */
router.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedules = await simulationScheduler.getScheduledSimulations();
    res.json({
      success: true,
      schedules,
    });
  } catch (error) {
    logger.error('Get schedules error', { error });
    next(error);
  }
});

/**
 * GET /api/digital-twin/schedules/:systemId
 * Get scheduled simulations for a system
 */
router.get('/schedules/:systemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId } = req.params;
    const schedules = await simulationScheduler.getSystemSimulations(systemId);
    res.json({
      success: true,
      schedules,
    });
  } catch (error) {
    logger.error('Get system schedules error', { error });
    next(error);
  }
});

/**
 * POST /api/digital-twin/schedules
 * Create a scheduled simulation
 */
router.post('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId, name, schedule, config } = req.body;

    if (!systemId || !name || !schedule || !config) {
      return res.status(400).json({
        success: false,
        error: 'systemId, name, schedule, and config are required',
      });
    }

    const simulation = await simulationScheduler.createScheduledSimulation(
      systemId,
      name,
      schedule,
      config
    );

    res.json({
      success: true,
      simulation,
    });
  } catch (error) {
    logger.error('Create schedule error', { error });
    next(error);
  }
});

/**
 * POST /api/digital-twin/schedules/:id/trigger
 * Trigger a scheduled simulation manually
 */
router.post('/schedules/:id/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await simulationScheduler.triggerSimulation(id);
    res.json({
      success: true,
      message: 'Simulation triggered',
    });
  } catch (error) {
    logger.error('Trigger schedule error', { error });
    next(error);
  }
});

/**
 * PATCH /api/digital-twin/schedules/:id
 * Enable/disable a scheduled simulation
 */
router.patch('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled field is required',
      });
    }

    await simulationScheduler.setEnabled(id, enabled);
    res.json({
      success: true,
      message: `Scheduled simulation ${enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    logger.error('Update schedule error', { error });
    next(error);
  }
});

/**
 * DELETE /api/digital-twin/schedules/:id
 * Delete a scheduled simulation
 */
router.delete('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await simulationScheduler.deleteSimulation(id);
    res.json({
      success: true,
      message: 'Scheduled simulation deleted',
    });
  } catch (error) {
    logger.error('Delete schedule error', { error });
    next(error);
  }
});

// ============================================
// Model Library Routes
// ============================================

/**
 * GET /api/digital-twin/models
 * Get available battery models
 */
router.get('/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await digitalTwinService.getAvailableModels();
    res.json({
      success: true,
      models,
    });
  } catch (error) {
    logger.error('Get models error', { error });
    next(error);
  }
});

/**
 * GET /api/digital-twin/health
 * Health check for digital twin services
 */
router.get('/health', async (req: Request, res: Response) => {
  const healthy = await digitalTwinService.checkHealth();
  res.json({
    success: true,
    status: healthy ? 'healthy' : 'degraded',
    aiService: healthy,
  });
});

export default router;
