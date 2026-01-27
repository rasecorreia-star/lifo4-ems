/**
 * Prospect Analysis Routes for Lifo4 EMS
 */

import { Router } from 'express';
import { prospectController } from '../controllers/prospect.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// PROSPECT CRUD
// ============================================

router.post(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.createProspect(req, res, next)
);

router.get(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getProspects(req, res, next)
);

router.get(
  '/statistics',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.getSalesStatistics(req, res, next)
);

router.get(
  '/:prospectId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getProspect(req, res, next)
);

router.put(
  '/:prospectId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.updateProspect(req, res, next)
);

router.put(
  '/:prospectId/stage',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.updatePipelineStage(req, res, next)
);

// ============================================
// ANALYZER KIT MANAGEMENT
// ============================================

router.post(
  '/analyzers',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => prospectController.createAnalyzerKit(req, res, next)
);

router.get(
  '/analyzers/available',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getAvailableAnalyzers(req, res, next)
);

router.get(
  '/analyzers/:kitId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getAnalyzerKit(req, res, next)
);

router.post(
  '/:prospectId/analyzer/assign',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.assignAnalyzer(req, res, next)
);

router.post(
  '/:prospectId/analyzer/installed',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.markAnalyzerInstalled(req, res, next)
);

router.post(
  '/:prospectId/analyzer/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.startMeasurement(req, res, next)
);

router.post(
  '/:prospectId/analyzer/remove',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.removeAnalyzer(req, res, next)
);

// ============================================
// ANALYSIS
// ============================================

router.get(
  '/:prospectId/analysis',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getAnalysis(req, res, next)
);

router.post(
  '/:prospectId/analysis/process',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.processAnalysis(req, res, next)
);

router.get(
  '/:prospectId/recommendations',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getRecommendations(req, res, next)
);

// ============================================
// PROPOSALS
// ============================================

router.post(
  '/:prospectId/proposals',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.createProposal(req, res, next)
);

router.get(
  '/:prospectId/proposals',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getProposals(req, res, next)
);

router.post(
  '/:prospectId/proposals/:proposalId/send',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => prospectController.sendProposal(req, res, next)
);

// ============================================
// NOTES & ACTIVITIES
// ============================================

router.post(
  '/:prospectId/notes',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.addNote(req, res, next)
);

router.get(
  '/:prospectId/notes',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getNotes(req, res, next)
);

router.post(
  '/:prospectId/activities',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.addActivity(req, res, next)
);

router.get(
  '/:prospectId/activities',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  (req, res, next) => prospectController.getActivities(req, res, next)
);

export default router;
