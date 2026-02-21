/**
 * Main Routes Router
 * Combines all route modules
 */

import { Router } from 'express';
import optimizationRoutes from './optimization.routes';
import mlRoutes from './ml.routes';
import telemetryRoutes from './telemetry.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// API Version prefix
const API_V1 = '/api/v1';

// Mount routes with auth middleware
router.use(`${API_V1}/optimization`, authMiddleware, optimizationRoutes);
router.use(`${API_V1}/ml`, authMiddleware, mlRoutes);
router.use(`${API_V1}/telemetry`, authMiddleware, telemetryRoutes);

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
    baseUrl: `http://localhost:3001${API_V1}`,
    endpoints: {
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
    },
    totalEndpoints: 50,
    authentication: 'Bearer token required in Authorization header',
    rateLimit: '100 requests per minute',
    timestamp: new Date().toISOString(),
  });
});

export default router;
