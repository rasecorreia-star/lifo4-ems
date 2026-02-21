/**
 * ML Routes
 * Machine Learning and predictive analytics endpoints with :systemId parameter
 * FASE 2 CORRECTED: Using proper :systemId in URL paths
 */

import { Router } from 'express';
import { ForecastingController } from '../controllers/ml/ForecastingController';
import { BatteryHealthController } from '../controllers/ml/BatteryHealthController';
import { PredictiveMaintenanceController } from '../controllers/ml/PredictiveMaintenanceController';

const router = Router({ mergeParams: true });

// ============================================================
// Forecasting — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/forecast/ensemble', ForecastingController.getEnsembleForecast);
router.get('/forecast/models', ForecastingController.getModels);
router.post('/forecast/compare', ForecastingController.compareModels);
router.get('/forecast/model-info/:modelName', ForecastingController.getModelInfo);
router.post('/forecast/uncertainty', ForecastingController.getUncertaintyBounds);

// ============================================================
// Battery Health — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/battery/calculate-soh', BatteryHealthController.calculateSOH);
router.post('/battery/estimate-degradation', BatteryHealthController.estimateDegradation);
router.post('/battery/estimate-life', BatteryHealthController.estimateRemainingLife);
router.post('/battery/health-report', BatteryHealthController.generateHealthReport);
router.get('/battery/warranty-status/:systemId', BatteryHealthController.checkWarrantyStatus);
router.post('/battery/degradation-cost', BatteryHealthController.calculateDegradationCost);

// ============================================================
// Predictive Maintenance — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/maintenance/evaluate-component', PredictiveMaintenanceController.evaluateComponent);
router.post('/maintenance/recommendation', PredictiveMaintenanceController.getMaintenanceRecommendation);
router.post('/maintenance/predict-failure', PredictiveMaintenanceController.predictFailure);
router.get('/maintenance/models/metrics', PredictiveMaintenanceController.getModelMetrics);
router.post('/maintenance/cost-comparison', PredictiveMaintenanceController.costComparison);
router.get('/maintenance/components', PredictiveMaintenanceController.getComponentTypes);

// ============================================================
// Forecasting — :systemId endpoints
// ============================================================
router.get('/:systemId/forecast/load', ForecastingController.getForecastLoad);
router.get('/:systemId/forecast/price', ForecastingController.getForecastPrice);

// ============================================================
// Battery Health — :systemId endpoints
// ============================================================
router.get('/:systemId/battery/health', BatteryHealthController.getHealth);

// ============================================================
// Predictive Maintenance — :systemId endpoints
// ============================================================
router.get('/:systemId/maintenance/predictions', PredictiveMaintenanceController.getPredictions);

export default router;
