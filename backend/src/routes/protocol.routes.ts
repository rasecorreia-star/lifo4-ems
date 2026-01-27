/**
 * Protocol Routes
 * API endpoints for universal protocol detection and management
 */

import { Router, Request, Response } from 'express';
import { universalAdapter } from '../services/protocol/universal-adapter.service';
import { protocolLibrary } from '../services/protocol/protocol-library.service';
import { logger } from '../utils/logger';

const router = Router();

// ============================================
// PROTOCOL DETECTION
// ============================================

/**
 * POST /api/v1/protocol/detect
 * Detect protocol from raw data
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const { data, metadata } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Missing data field' });
    }

    const buffer = Buffer.from(data, 'base64');
    const result = await universalAdapter.detectProtocol(buffer, metadata);

    res.json(result);
  } catch (error) {
    logger.error('Protocol detection error:', error);
    res.status(500).json({ error: 'Protocol detection failed' });
  }
});

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * POST /api/v1/protocol/connect
 * Connect to a device
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { connectionId, config, protocol } = req.body;

    if (!connectionId || !config) {
      return res.status(400).json({ error: 'Missing connectionId or config' });
    }

    await universalAdapter.connect(connectionId, config, protocol);

    res.json({
      success: true,
      connectionId,
      status: universalAdapter.getStatus(connectionId)
    });
  } catch (error) {
    logger.error('Connection error:', error);
    res.status(500).json({ error: 'Connection failed' });
  }
});

/**
 * POST /api/v1/protocol/disconnect
 * Disconnect from a device
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ error: 'Missing connectionId' });
    }

    await universalAdapter.disconnect(connectionId);

    res.json({ success: true, connectionId });
  } catch (error) {
    logger.error('Disconnect error:', error);
    res.status(500).json({ error: 'Disconnect failed' });
  }
});

/**
 * GET /api/v1/protocol/status
 * Get all connection statuses
 */
router.get('/status', (req: Request, res: Response) => {
  const statuses = universalAdapter.getAllStatuses();
  res.json(statuses);
});

/**
 * GET /api/v1/protocol/status/:connectionId
 * Get specific connection status
 */
router.get('/status/:connectionId', (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const status = universalAdapter.getStatus(connectionId);

  if (!status) {
    return res.status(404).json({ error: 'Connection not found' });
  }

  res.json(status);
});

// ============================================
// REGISTER OPERATIONS
// ============================================

/**
 * POST /api/v1/protocol/read
 * Read registers from device
 */
router.post('/read', async (req: Request, res: Response) => {
  try {
    const { connectionId, registers } = req.body;

    if (!connectionId || !registers || !Array.isArray(registers)) {
      return res.status(400).json({ error: 'Missing connectionId or registers array' });
    }

    const results = await universalAdapter.readRegisters(connectionId, registers);

    res.json(Object.fromEntries(results));
  } catch (error) {
    logger.error('Read error:', error);
    res.status(500).json({ error: 'Read operation failed' });
  }
});

/**
 * POST /api/v1/protocol/write
 * Write register value
 */
router.post('/write', async (req: Request, res: Response) => {
  try {
    const { connectionId, register, value } = req.body;

    if (!connectionId || !register || value === undefined) {
      return res.status(400).json({ error: 'Missing connectionId, register, or value' });
    }

    await universalAdapter.writeRegister(connectionId, register, value);

    res.json({ success: true, register, value });
  } catch (error) {
    logger.error('Write error:', error);
    res.status(500).json({ error: 'Write operation failed' });
  }
});

/**
 * POST /api/v1/protocol/auto-discover
 * Auto-discover and map registers
 */
router.post('/auto-discover', async (req: Request, res: Response) => {
  try {
    const { connectionId, scanRange } = req.body;

    if (!connectionId) {
      return res.status(400).json({ error: 'Missing connectionId' });
    }

    const range = scanRange || { start: 0, end: 100 };
    const registerMap = await universalAdapter.autoDiscoverRegisters(connectionId, range);

    res.json(registerMap);
  } catch (error) {
    logger.error('Auto-discover error:', error);
    res.status(500).json({ error: 'Auto-discovery failed' });
  }
});

/**
 * POST /api/v1/protocol/set-register-map
 * Set register map for a connection
 */
router.post('/set-register-map', (req: Request, res: Response) => {
  try {
    const { connectionId, registerMap } = req.body;

    if (!connectionId || !registerMap) {
      return res.status(400).json({ error: 'Missing connectionId or registerMap' });
    }

    universalAdapter.setRegisterMap(connectionId, registerMap);

    res.json({ success: true, connectionId });
  } catch (error) {
    logger.error('Set register map error:', error);
    res.status(500).json({ error: 'Failed to set register map' });
  }
});

/**
 * GET /api/v1/protocol/register-map/:connectionId
 * Get register map for a connection
 */
router.get('/register-map/:connectionId', (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const registerMap = universalAdapter.getRegisterMap(connectionId);

  if (!registerMap) {
    return res.status(404).json({ error: 'Register map not found' });
  }

  res.json(registerMap);
});

// ============================================
// PROTOCOL LIBRARY
// ============================================

/**
 * GET /api/v1/protocol/library/protocols
 * Get all protocol definitions
 */
router.get('/library/protocols', (req: Request, res: Response) => {
  const protocols = protocolLibrary.getProtocols();
  res.json(protocols);
});

/**
 * GET /api/v1/protocol/library/protocols/:id
 * Get protocol by ID
 */
router.get('/library/protocols/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const protocol = protocolLibrary.getProtocol(id);

  if (!protocol) {
    return res.status(404).json({ error: 'Protocol not found' });
  }

  res.json(protocol);
});

/**
 * GET /api/v1/protocol/library/devices
 * Get all device profiles
 */
router.get('/library/devices', (req: Request, res: Response) => {
  const { manufacturer, deviceType, protocol, capability } = req.query;

  if (manufacturer || deviceType || protocol || capability) {
    const devices = protocolLibrary.searchDevices({
      manufacturer: manufacturer as string,
      deviceType: deviceType as any,
      protocol: protocol as any,
      capability: capability as string
    });
    return res.json(devices);
  }

  const devices = protocolLibrary.getDevices();
  res.json(devices);
});

/**
 * GET /api/v1/protocol/library/devices/:id
 * Get device profile by ID
 */
router.get('/library/devices/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const device = protocolLibrary.getDevice(id);

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  res.json(device);
});

/**
 * POST /api/v1/protocol/library/devices
 * Add custom device profile
 */
router.post('/library/devices', (req: Request, res: Response) => {
  try {
    const device = req.body;

    if (!device.id || !device.manufacturer || !device.model) {
      return res.status(400).json({ error: 'Missing required fields: id, manufacturer, model' });
    }

    protocolLibrary.addDevice(device);

    res.status(201).json(device);
  } catch (error) {
    logger.error('Add device error:', error);
    res.status(500).json({ error: 'Failed to add device' });
  }
});

/**
 * DELETE /api/v1/protocol/library/devices/:id
 * Delete device profile
 */
router.delete('/library/devices/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = protocolLibrary.deleteDevice(id);

  if (!deleted) {
    return res.status(400).json({ error: 'Cannot delete device (may be built-in)' });
  }

  res.json({ success: true, id });
});

/**
 * POST /api/v1/protocol/library/devices/import
 * Import device profile from JSON
 */
router.post('/library/devices/import', (req: Request, res: Response) => {
  try {
    const { json } = req.body;

    if (!json) {
      return res.status(400).json({ error: 'Missing json field' });
    }

    const device = protocolLibrary.importDevice(json);

    res.status(201).json(device);
  } catch (error) {
    logger.error('Import device error:', error);
    res.status(500).json({ error: 'Failed to import device' });
  }
});

/**
 * GET /api/v1/protocol/library/devices/:id/export
 * Export device profile as JSON
 */
router.get('/library/devices/:id/export', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const json = protocolLibrary.exportDevice(id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
    res.send(json);
  } catch (error) {
    logger.error('Export device error:', error);
    res.status(500).json({ error: 'Failed to export device' });
  }
});

/**
 * POST /api/v1/protocol/library/devices/:id/clone
 * Clone device profile
 */
router.post('/library/devices/:id/clone', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newId, modifications } = req.body;

    if (!newId) {
      return res.status(400).json({ error: 'Missing newId' });
    }

    const cloned = protocolLibrary.cloneDevice(id, newId, modifications);

    res.status(201).json(cloned);
  } catch (error) {
    logger.error('Clone device error:', error);
    res.status(500).json({ error: 'Failed to clone device' });
  }
});

/**
 * GET /api/v1/protocol/library/statistics
 * Get library statistics
 */
router.get('/library/statistics', (req: Request, res: Response) => {
  const statistics = protocolLibrary.getStatistics();
  res.json(statistics);
});

/**
 * GET /api/v1/protocol/library/match
 * Find matching device profile
 */
router.get('/library/match', (req: Request, res: Response) => {
  const { manufacturer, model, deviceType } = req.query;

  if (!manufacturer) {
    return res.status(400).json({ error: 'Missing manufacturer parameter' });
  }

  const device = protocolLibrary.findMatchingDevice(
    manufacturer as string,
    model as string,
    deviceType as any
  );

  if (!device) {
    return res.status(404).json({ error: 'No matching device found' });
  }

  res.json(device);
});

export default router;
