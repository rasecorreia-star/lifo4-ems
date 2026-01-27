/**
 * PCS Routes
 * API endpoints for Power Conversion System management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pcsService, PCSDevice, PCSManufacturer } from '../services/pcs/pcs.service.js';
import { PCSProtocol } from '../services/pcs/drivers/base-pcs-driver.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/pcs/manufacturers
 * Get supported manufacturers
 */
router.get('/manufacturers', async (_req: Request, res: Response) => {
  const manufacturers = pcsService.getSupportedManufacturers();
  res.json({
    success: true,
    manufacturers,
  });
});

/**
 * GET /api/pcs/devices
 * Get all PCS devices
 */
router.get('/devices', async (req: Request, res: Response) => {
  const { systemId } = req.query;

  let devices;
  if (systemId && typeof systemId === 'string') {
    devices = pcsService.getSystemDevices(systemId);
  } else {
    devices = Array.from((pcsService as any).devices.values());
  }

  res.json({
    success: true,
    devices,
  });
});

/**
 * GET /api/pcs/devices/:deviceId
 * Get specific PCS device
 */
router.get('/devices/:deviceId', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const device = pcsService.getDevice(deviceId);

  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found',
    });
  }

  res.json({
    success: true,
    device,
  });
});

/**
 * POST /api/pcs/devices
 * Register a new PCS device
 */
router.post('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, systemId, manufacturer, model, connectionConfig } = req.body;

    if (!id || !systemId || !manufacturer || !connectionConfig) {
      return res.status(400).json({
        success: false,
        error: 'id, systemId, manufacturer, and connectionConfig are required',
      });
    }

    const device: PCSDevice = {
      id,
      systemId,
      manufacturer: manufacturer as PCSManufacturer,
      model: model || 'Unknown',
      connectionConfig: {
        protocol: connectionConfig.protocol as PCSProtocol,
        host: connectionConfig.host,
        port: connectionConfig.port,
        slaveId: connectionConfig.slaveId,
        iedName: connectionConfig.iedName,
        timeout: connectionConfig.timeout || 5000,
        retries: connectionConfig.retries || 3,
      },
      status: 'offline',
    };

    await pcsService.registerDevice(device);

    res.json({
      success: true,
      device: pcsService.getDevice(id),
    });
  } catch (error) {
    logger.error('Register PCS device error', { error });
    next(error);
  }
});

/**
 * DELETE /api/pcs/devices/:deviceId
 * Unregister a PCS device
 */
router.delete('/devices/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    await pcsService.unregisterDevice(deviceId);

    res.json({
      success: true,
      message: 'Device unregistered',
    });
  } catch (error) {
    logger.error('Unregister PCS device error', { error });
    next(error);
  }
});

/**
 * GET /api/pcs/devices/:deviceId/telemetry
 * Get current telemetry for a device
 */
router.get('/devices/:deviceId/telemetry', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const telemetry = pcsService.getTelemetry(deviceId);

  if (!telemetry) {
    return res.status(404).json({
      success: false,
      error: 'No telemetry available',
    });
  }

  res.json({
    success: true,
    telemetry,
  });
});

/**
 * POST /api/pcs/devices/:deviceId/power
 * Set power setpoint for a device
 */
router.post('/devices/:deviceId/power', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const { powerKw } = req.body;

    if (powerKw === undefined) {
      return res.status(400).json({
        success: false,
        error: 'powerKw is required',
      });
    }

    const result = await pcsService.setPowerSetpoint(deviceId, powerKw);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Set power error', { error });
    next(error);
  }
});

/**
 * POST /api/pcs/devices/:deviceId/start
 * Start a PCS device
 */
router.post('/devices/:deviceId/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const result = await pcsService.startDevice(deviceId);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Start device error', { error });
    next(error);
  }
});

/**
 * POST /api/pcs/devices/:deviceId/stop
 * Stop a PCS device
 */
router.post('/devices/:deviceId/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const result = await pcsService.stopDevice(deviceId);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Stop device error', { error });
    next(error);
  }
});

/**
 * POST /api/pcs/devices/:deviceId/reset
 * Reset faults on a device
 */
router.post('/devices/:deviceId/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const result = await pcsService.resetFaults(deviceId);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Reset faults error', { error });
    next(error);
  }
});

/**
 * GET /api/pcs/fleet/status
 * Get fleet status
 */
router.get('/fleet/status', async (req: Request, res: Response) => {
  const { systemId } = req.query;
  const status = pcsService.getFleetStatus(systemId as string | undefined);

  res.json({
    success: true,
    status,
  });
});

/**
 * POST /api/pcs/fleet/power
 * Set system-wide power setpoint (distributed across all PCS)
 */
router.post('/fleet/power', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemId, powerKw } = req.body;

    if (!systemId || powerKw === undefined) {
      return res.status(400).json({
        success: false,
        error: 'systemId and powerKw are required',
      });
    }

    const results = await pcsService.setSystemPowerSetpoint(systemId, powerKw);

    res.json({
      success: results.every(r => r.success),
      results,
    });
  } catch (error) {
    logger.error('Set fleet power error', { error });
    next(error);
  }
});

/**
 * POST /api/pcs/devices/:deviceId/command
 * Send a command to a device
 */
router.post('/devices/:deviceId/command', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const { type, parameters } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'command type is required',
      });
    }

    const result = await pcsService.sendCommand(deviceId, {
      type,
      parameters: parameters || {},
    });

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Send command error', { error });
    next(error);
  }
});

export default router;
