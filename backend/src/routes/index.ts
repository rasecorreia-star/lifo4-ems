import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes.js';
import systemRoutes from './system.routes.js';
import telemetryRoutes from './telemetry.routes.js';
import controlRoutes from './control.routes.js';
import alertRoutes from './alert.routes.js';
import optimizationRoutes from './optimization.routes.js';
import haRoutes from './ha.routes.js';
import devRoutes from './dev.routes.js';
import bmsConfigRoutes from './bms-config.routes.js';
import fleetRoutes from './fleet.routes.js';
import cameraRoutes from './camera.routes.js';
import evChargerRoutes from './ev-charger.routes.js';
import microgridRoutes from './microgrid.routes.js';
import prospectRoutes from './prospect.routes.js';
import digitalTwinRoutes from './digital-twin.routes.js';
import pcsRoutes from './pcs.routes.js';
import slaRoutes from './sla.routes.js';
import protocolRoutes from './protocol.routes.js';
import mobileRoutes from './mobile.routes.js';
import reportsRoutes from './reports.routes.js';
import gamificationRoutes from './gamification.routes.js';
import { config } from '../config/index.js';

const router = Router();

// API version prefix
const API_PREFIX = `/api/${config.apiVersion}`;

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: config.apiVersion,
    environment: config.env,
  });
});

// Development mock routes (loaded first to intercept in dev mode)
if (config.env === 'development') {
  router.use(`${API_PREFIX}`, devRoutes);
}

// API Routes
router.use(`${API_PREFIX}/auth`, authRoutes);
router.use(`${API_PREFIX}/systems`, systemRoutes);
router.use(`${API_PREFIX}/telemetry`, telemetryRoutes);
router.use(`${API_PREFIX}/control`, controlRoutes);
router.use(`${API_PREFIX}/alerts`, alertRoutes);
router.use(`${API_PREFIX}`, optimizationRoutes);
router.use(`${API_PREFIX}`, haRoutes);
router.use(`${API_PREFIX}/bms-config`, bmsConfigRoutes);
router.use(`${API_PREFIX}/fleet`, fleetRoutes);
router.use(`${API_PREFIX}/cameras`, cameraRoutes);
router.use(`${API_PREFIX}/ev-chargers`, evChargerRoutes);
router.use(`${API_PREFIX}/microgrids`, microgridRoutes);
router.use(`${API_PREFIX}/prospects`, prospectRoutes);
router.use(`${API_PREFIX}/digital-twin`, digitalTwinRoutes);
router.use(`${API_PREFIX}/pcs`, pcsRoutes);
router.use(`${API_PREFIX}/sla`, slaRoutes);
router.use(`${API_PREFIX}/protocol`, protocolRoutes);
router.use(`${API_PREFIX}/mobile`, mobileRoutes);
router.use(`${API_PREFIX}/reports`, reportsRoutes);
router.use(`${API_PREFIX}/gamification`, gamificationRoutes);

// API documentation redirect
router.get(`${API_PREFIX}`, (_req: Request, res: Response) => {
  res.json({
    message: 'Lifo4 EMS API',
    version: config.apiVersion,
    documentation: `${API_PREFIX}/docs`,
    endpoints: {
      auth: `${API_PREFIX}/auth`,
      systems: `${API_PREFIX}/systems`,
      telemetry: `${API_PREFIX}/telemetry`,
      control: `${API_PREFIX}/control`,
      alerts: `${API_PREFIX}/alerts`,
      optimization: `${API_PREFIX}/optimization`,
      blackstart: `${API_PREFIX}/blackstart`,
      grid: `${API_PREFIX}/grid`,
      ha: `${API_PREFIX}/ha`,
      hardware: `${API_PREFIX}/hardware`,
      bmsConfig: `${API_PREFIX}/bms-config`,
      fleet: `${API_PREFIX}/fleet`,
      cameras: `${API_PREFIX}/cameras`,
      evChargers: `${API_PREFIX}/ev-chargers`,
      microgrids: `${API_PREFIX}/microgrids`,
      prospects: `${API_PREFIX}/prospects`,
      digitalTwin: `${API_PREFIX}/digital-twin`,
      pcs: `${API_PREFIX}/pcs`,
      sla: `${API_PREFIX}/sla`,
      protocol: `${API_PREFIX}/protocol`,
      mobile: `${API_PREFIX}/mobile`,
      reports: `${API_PREFIX}/reports`,
      gamification: `${API_PREFIX}/gamification`,
    },
  });
});

export default router;
