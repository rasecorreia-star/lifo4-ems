/**
 * Optimization Routes
 * All optimization-related endpoints with :systemId parameter
 * FASE 2 CORRECTED: Using proper :systemId in URL paths
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware';
import { UnifiedDecisionController } from '../controllers/optimization/UnifiedDecisionController';
import { ArbitrageController } from '../controllers/optimization/ArbitrageController';
import { PeakShavingController } from '../controllers/optimization/PeakShavingController';
import { GridServicesController } from '../controllers/optimization/GridServicesController';
import { BlackStartController } from '../controllers/optimization/BlackStartController';

const router = Router({ mergeParams: true });

// ============================================================
// Arbitrage — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/arbitrage/evaluate',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  ArbitrageController.evaluateArbitrage
);
router.post('/arbitrage/revenue',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  ArbitrageController.calculateRevenue
);
router.get('/arbitrage/market-signal',
  ArbitrageController.getMarketSignal
);
router.post('/arbitrage/strategy',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  ArbitrageController.getStrategy
);

// ============================================================
// Peak Shaving — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/peak-shaving/evaluate',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  PeakShavingController.evaluatePeakShaving
);
router.post('/peak-shaving/demand-charge-savings',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  PeakShavingController.calculateSavings
);
router.post('/peak-shaving/compliance',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  PeakShavingController.calculateCompliance
);
router.post('/peak-shaving/roi',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  PeakShavingController.calculateROI
);
router.get('/peak-shaving/tariff',
  PeakShavingController.getTariffInfo
);

// ============================================================
// Grid Services — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/grid-services/select-mode',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.selectControlMode
);
router.get('/grid-services/current-mode',
  GridServicesController.getCurrentMode
);
router.post('/grid-services/demand-response',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.processDemandResponse
);
router.post('/grid-services/demand-response/compliance',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.calculateDRCompliance
);
router.get('/grid-services/vpp',
  GridServicesController.getVPPState
);
router.post('/grid-services/vpp/register',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.registerVPPParticipant
);
router.post('/grid-services/vpp/dispatch',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.coordinateVPPDispatch
);
router.get('/grid-services/tariff',
  GridServicesController.getTariffSchedule
);
router.post('/grid-services/load-shedding',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.calculateLoadShedding
);

// ============================================================
// Black Start — Global endpoints (no :systemId) for calculation
// ============================================================
router.post('/grid-services/black-start/process',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  BlackStartController.processBlackout
);
router.get('/grid-services/black-start/state-history',
  BlackStartController.getStateHistory
);
router.post('/grid-services/black-start/island-duration',
  BlackStartController.estimateIslandModeDuration
);
router.post('/grid-services/black-start/capability',
  BlackStartController.getBlackStartCapability
);
router.post('/grid-services/black-start/restoration-time',
  BlackStartController.estimateRestorationTime
);
router.get('/grid-services/black-start/fsm-states',
  BlackStartController.getFSMStates
);
router.post('/grid-services/black-start/reset',
  requireRole(['MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  BlackStartController.resetFSM
);

// ============================================================
// Unified Decision Engine — Global endpoints (no :systemId)
// ============================================================
router.post('/decision',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  UnifiedDecisionController.makeDecision
);
router.post('/decision/batch',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  UnifiedDecisionController.makeDecisionBatch
);
router.get('/decision/priority/:priority',
  UnifiedDecisionController.getPriorityInfo
);
router.get('/config/default',
  UnifiedDecisionController.getDefaultConfigEndpoint
);

// ============================================================
// Unified Decision Engine — :systemId endpoints
// ============================================================
router.get('/:systemId/decision/current', UnifiedDecisionController.getCurrentDecision);
router.get('/:systemId/decision/history', UnifiedDecisionController.getDecisionHistory);
router.post('/:systemId/decision/override',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  UnifiedDecisionController.overrideDecision
);

// ============================================================
// Arbitrage — :systemId endpoints
// ============================================================
router.get('/:systemId/arbitrage/status', ArbitrageController.getStatus);
router.get('/:systemId/arbitrage/config', ArbitrageController.getConfig);
router.put('/:systemId/arbitrage/config',
  requireRole(['MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  ArbitrageController.updateConfig
);

// ============================================================
// Peak Shaving — :systemId endpoints
// ============================================================
router.get('/:systemId/peak-shaving/status', PeakShavingController.getStatus);
router.get('/:systemId/peak-shaving/config', PeakShavingController.getConfig);
router.put('/:systemId/peak-shaving/config',
  requireRole(['MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  PeakShavingController.updateConfig
);

// ============================================================
// Grid Services — :systemId endpoints
// ============================================================
router.get('/:systemId/grid-services/status', GridServicesController.getStatus);
router.get('/:systemId/grid-services/config', GridServicesController.getConfig);
router.put('/:systemId/grid-services/config',
  requireRole(['MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  GridServicesController.updateConfig
);

// ============================================================
// Black Start — :systemId endpoints (sub-resource under grid-services)
// ============================================================
router.get('/:systemId/grid-services/black-start/status', BlackStartController.getStatus);
router.post('/:systemId/grid-services/black-start/engage',
  requireRole(['OPERATOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  BlackStartController.engage
);

export default router;
