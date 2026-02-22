/**
 * Main Routes Router
 * Combines all route modules
 */

import { Router } from 'express';
import optimizationRoutes from './optimization.routes';
import mlRoutes from './ml.routes';
import telemetryRoutes from './telemetry.routes';
import financialRoutes from './financial.routes';
import otaRoutes from './ota.routes';
import alarmsRoutes from './alarms.routes';
import authRoutes from './auth.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// API Version prefix
const API_V1 = '/api/v1';

// Public auth routes (login, 2FA setup/verify after first login)
router.use(`${API_V1}/auth`, authRoutes);

// Protected routes with auth middleware
router.use(`${API_V1}/optimization`, authMiddleware, optimizationRoutes);
router.use(`${API_V1}/ml`, authMiddleware, mlRoutes);
router.use(`${API_V1}/telemetry`, authMiddleware, telemetryRoutes);
router.use(`${API_V1}/financial`, authMiddleware, financialRoutes);
router.use(`${API_V1}/alarms`, authMiddleware, alarmsRoutes);
// OTA deploy — per-endpoint SUPER_ADMIN check inside the router
router.use(`${API_V1}/ota`, authMiddleware, otaRoutes);

// Health check endpoint
router.get(`${API_V1}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'EMS API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation endpoint
router.get(`${API_V1}/docs`, (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    title: 'LIFO4 EMS - Energy Management System API',
    description:
      'Comprehensive REST API for battery energy storage system optimization, grid services, and predictive maintenance',
    baseUrl: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}${API_V1}`,
    endpoints: {
      auth: {
        path: '/auth',
        modules: ['login', '2fa/setup', '2fa/verify', '2fa/disable'],
      },
      optimization: {
        path: '/optimization',
        modules: [
          'decision (unified decision engine)',
          'arbitrage (energy trading)',
          'peak-shaving (demand management)',
          'grid-services (grid integration & VPP)',
          'black-start (grid restoration)',
        ],
      },
      ml: {
        path: '/ml',
        modules: [
          'forecasting (demand & price prediction with 5 ML models)',
          'battery-health (SOH monitoring & RUL)',
          'maintenance (failure prediction & scheduling)',
        ],
      },
      financial: {
        path: '/financial',
        modules: [
          'tax/optimization (regime classification + accelerated depreciation)',
          'reports/monthly (full monthly report)',
          'depreciation/report (accountant-ready depreciation report)',
          'roi (return on investment summary)',
        ],
      },
      ota: {
        path: '/ota',
        modules: ['deploy', 'deployments/latest', 'deployments/:id', 'deployments/:id/rollback', 'systems/:id/maintenance-window'],
      },
      alarms: {
        path: '/alarms',
        modules: ['list', 'system/:systemId', ':alarmId/silence (POST)', ':alarmId/silence (DELETE)'],
      },
    },
    totalEndpoints: 32,
    authentication: 'Bearer token required in Authorization header',
    rateLimit: '100 requests per minute',
    timestamp: new Date().toISOString(),
  });
});

export default router;
