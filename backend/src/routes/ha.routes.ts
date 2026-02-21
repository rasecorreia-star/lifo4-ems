/**
 * High Availability Routes
 * API endpoints for HA cluster management and monitoring
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';
import { haService, HAConfig, NodeRole } from '../services/ha/high-availability.service.js';
import { hardwareService, HardwareDevice, Protocol, HardwareType } from '../services/hardware/hardware-abstraction.service.js';

const router = Router();

// ============================================
// HIGH AVAILABILITY
// ============================================

/**
 * Initialize HA for this node
 */
router.post('/ha/init', authenticate, requireRole(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const config: HAConfig = {
      clusterId: req.body.clusterId || 'default',
      nodeId: req.body.nodeId || `node_${Date.now()}`,
      role: req.body.role || NodeRole.SECONDARY,
      peerNodes: req.body.peerNodes || [],
      virtualIp: req.body.virtualIp,
      healthChecks: req.body.healthChecks || [
        {
          id: 'mqtt',
          name: 'MQTT Broker',
          type: 'mqtt',
          target: '',
          interval: 5000,
          timeout: 3000,
          healthyThreshold: 2,
          unhealthyThreshold: 3,
          lastCheck: new Date(),
          status: 'healthy',
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          latency: 0,
        },
        {
          id: 'database',
          name: 'Firebase',
          type: 'database',
          target: '',
          interval: 10000,
          timeout: 5000,
          healthyThreshold: 2,
          unhealthyThreshold: 3,
          lastCheck: new Date(),
          status: 'healthy',
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          latency: 0,
        },
      ],
      autoFailover: req.body.autoFailover ?? true,
      preemption: req.body.preemption ?? false,
      syncReplication: req.body.syncReplication ?? true,
    };

    await haService.initialize(config);

    res.json({
      success: true,
      message: 'HA service initialized',
      data: {
        nodeId: config.nodeId,
        clusterId: config.clusterId,
        role: config.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get cluster status
 */
router.get('/ha/cluster', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const cluster = haService.getClusterStatus();

    res.json({
      success: true,
      data: cluster,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get health checks
 */
router.get('/ha/health', authenticate, async (req, res, next) => {
  try {
    const healthChecks = haService.getHealthChecks();
    const nodeMetrics = haService.getNodeMetrics();
    const isPrimary = haService.isPrimary();

    res.json({
      success: true,
      data: {
        isPrimary,
        healthChecks,
        metrics: nodeMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger manual failover
 */
router.post('/ha/failover', authenticate, requireRole(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { targetNodeId } = req.body;

    await haService.manualFailover(targetNodeId);

    res.json({
      success: true,
      message: `Failover to ${targetNodeId} initiated`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get failover history
 */
router.get('/ha/failover/history', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await haService.getFailoverHistory(limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Graceful shutdown
 */
router.post('/ha/shutdown', authenticate, requireRole(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    await haService.shutdown();

    res.json({
      success: true,
      message: 'Shutdown initiated',
    });

    // Actually shutdown after response
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    next(error);
  }
});

// ============================================
// HARDWARE ABSTRACTION
// ============================================

/**
 * Register hardware device
 */
router.post('/hardware/devices', authenticate, requireRole(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const device: HardwareDevice = {
      id: req.body.id || `dev_${Date.now()}`,
      systemId: req.body.systemId,
      type: req.body.type,
      manufacturer: req.body.manufacturer,
      model: req.body.model,
      serialNumber: req.body.serialNumber,
      firmwareVersion: req.body.firmwareVersion,
      protocol: req.body.protocol,
      connectionConfig: req.body.connectionConfig,
      registerMap: req.body.registerMap,
      status: 'configuring',
      capabilities: req.body.capabilities || [],
      metadata: req.body.metadata,
    };

    await hardwareService.registerDevice(device);

    res.json({
      success: true,
      message: 'Device registered',
      data: { deviceId: device.id },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get device
 */
router.get('/hardware/devices/:deviceId', authenticate, async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = hardwareService.getDevice(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Device not found' },
      });
    }

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get devices for system
 */
router.get('/hardware/systems/:systemId/devices', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const devices = hardwareService.getSystemDevices(systemId);

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Send command to device
 */
router.post('/hardware/devices/:deviceId/command', authenticate, requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { command, params } = req.body;

    const result = await hardwareService.sendCommand(deviceId, command, params || {});

    res.json({
      success: result,
      message: result ? 'Command sent' : 'Command failed',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update register map
 */
router.put('/hardware/devices/:deviceId/registermap', authenticate, requireRole(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { registerMap } = req.body;

    await hardwareService.updateRegisterMap(deviceId, registerMap);

    res.json({
      success: true,
      message: 'Register map updated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Auto-detect device
 */
router.post('/hardware/autodetect', authenticate, requireRole(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { connectionConfig, protocol } = req.body;

    const result = await hardwareService.autoDetect(connectionConfig, protocol);

    if (result) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.json({
        success: false,
        message: 'Device not recognized',
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Unregister device
 */
router.delete('/hardware/devices/:deviceId', authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    await hardwareService.unregisterDevice(deviceId);

    res.json({
      success: true,
      message: 'Device unregistered',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get supported devices
 */
router.get('/hardware/supported', authenticate, (req, res) => {
  const supported = hardwareService.getSupportedDevices();

  res.json({
    success: true,
    data: supported,
  });
});

/**
 * Get available protocols
 */
router.get('/hardware/protocols', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: Protocol.MODBUS_RTU, name: 'Modbus RTU', description: 'Serial Modbus over RS485' },
      { id: Protocol.MODBUS_TCP, name: 'Modbus TCP', description: 'Modbus over TCP/IP' },
      { id: Protocol.CANBUS, name: 'CAN Bus', description: 'Controller Area Network' },
      { id: Protocol.RS485, name: 'RS485', description: 'Generic RS485 serial' },
      { id: Protocol.SUNSPEC, name: 'SunSpec', description: 'SunSpec Alliance protocol' },
      { id: Protocol.MQTT, name: 'MQTT', description: 'MQTT message protocol' },
      { id: Protocol.REST_API, name: 'REST API', description: 'HTTP REST API' },
    ],
  });
});

/**
 * Get hardware types
 */
router.get('/hardware/types', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: HardwareType.BMS, name: 'Battery Management System' },
      { id: HardwareType.INVERTER, name: 'Inverter / PCS' },
      { id: HardwareType.METER, name: 'Energy Meter' },
      { id: HardwareType.PCS, name: 'Power Conversion System' },
      { id: HardwareType.HVAC, name: 'HVAC / Thermal' },
      { id: HardwareType.FIRE_SUPPRESSION, name: 'Fire Suppression' },
      { id: HardwareType.CONTACTOR, name: 'Contactor / Relay' },
      { id: HardwareType.SENSOR, name: 'Generic Sensor' },
    ],
  });
});

export default router;
