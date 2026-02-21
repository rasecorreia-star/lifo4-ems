/**
 * SLA Routes
 * API endpoints for SLA management, monitoring, and compliance
 */

import { Router, Request, Response } from 'express';
import { slaService } from '../services/sla/sla.service.js';
import { SLATier, LatencyMeasurementType } from '../models/sla.types.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * GET /sla/profiles
 * Get all SLA profiles
 */
router.get('/profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = slaService.getProfiles();
    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    logger.error('Error fetching SLA profiles', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
  }
});

/**
 * GET /sla/profiles/:id
 * Get a specific SLA profile
 */
router.get('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = slaService.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error fetching SLA profile', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

/**
 * POST /sla/profiles
 * Create a custom SLA profile
 */
router.post('/profiles', async (req: Request, res: Response) => {
  try {
    const { name, tier, targets, isDefault } = req.body;

    if (!name || !tier || !targets) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, tier, targets',
      });
    }

    const profile = slaService.createProfile(name, tier as SLATier, targets, isDefault);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error creating SLA profile', { error });
    res.status(500).json({ success: false, error: 'Failed to create profile' });
  }
});

/**
 * PUT /sla/profiles/:id
 * Update an SLA profile
 */
router.put('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = slaService.updateProfile(req.params.id, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error updating SLA profile', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// ============================================
// SYSTEM ASSIGNMENT
// ============================================

/**
 * POST /sla/assign
 * Assign SLA profile to a system
 */
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { systemId, profileId, assignedBy, effectiveFrom, effectiveUntil } = req.body;

    if (!systemId || !profileId || !assignedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: systemId, profileId, assignedBy',
      });
    }

    const assignment = slaService.assignToSystem(
      systemId,
      profileId,
      assignedBy,
      effectiveFrom ? new Date(effectiveFrom) : undefined,
      effectiveUntil ? new Date(effectiveUntil) : undefined
    );

    res.json({ success: true, data: assignment });
  } catch (error) {
    logger.error('Error assigning SLA profile', { error });
    res.status(500).json({ success: false, error: 'Failed to assign profile' });
  }
});

/**
 * GET /sla/systems/:systemId/assignment
 * Get SLA assignment for a system
 */
router.get('/systems/:systemId/assignment', async (req: Request, res: Response) => {
  try {
    const assignment = slaService.getSystemAssignment(req.params.systemId);
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'No assignment found' });
    }
    res.json({ success: true, data: assignment });
  } catch (error) {
    logger.error('Error fetching assignment', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch assignment' });
  }
});

// ============================================
// LATENCY TRACKING
// ============================================

/**
 * GET /sla/systems/:systemId/latency
 * Get latency statistics for a system
 */
router.get('/systems/:systemId/latency', async (req: Request, res: Response) => {
  try {
    const { type, periodMinutes } = req.query;

    const stats = slaService.getLatencyStats(
      req.params.systemId,
      type as LatencyMeasurementType | undefined,
      periodMinutes ? parseInt(periodMinutes as string) : undefined
    );

    if (!stats) {
      return res.json({ success: true, data: null, message: 'No latency data available' });
    }

    // Convert Map to object if needed
    const data = stats instanceof Map ? Object.fromEntries(stats) : stats;

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching latency stats', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch latency stats' });
  }
});

/**
 * GET /sla/systems/:systemId/latency/realtime
 * Get real-time latency data
 */
router.get('/systems/:systemId/latency/realtime', async (req: Request, res: Response) => {
  try {
    const data = slaService.getRealTimeLatency(req.params.systemId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching real-time latency', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch real-time latency' });
  }
});

// ============================================
// COMPLIANCE & REPORTING
// ============================================

/**
 * GET /sla/systems/:systemId/report
 * Generate compliance report
 */
router.get('/systems/:systemId/report', async (req: Request, res: Response) => {
  try {
    const { periodMinutes } = req.query;

    const report = slaService.generateReport(
      req.params.systemId,
      periodMinutes ? parseInt(periodMinutes as string) : undefined
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Cannot generate report - no SLA profile assigned',
      });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Error generating report', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

/**
 * GET /sla/systems/:systemId/dashboard
 * Get dashboard data for UI
 */
router.get('/systems/:systemId/dashboard', async (req: Request, res: Response) => {
  try {
    const data = slaService.getDashboardData(req.params.systemId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'No dashboard data available',
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching dashboard data', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /sla/systems/:systemId/health
 * Get system health based on SLA
 */
router.get('/systems/:systemId/health', async (req: Request, res: Response) => {
  try {
    const health = slaService.getSystemHealth(req.params.systemId);
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error('Error fetching system health', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch system health' });
  }
});

/**
 * GET /sla/systems/:systemId/compliance/trend
 * Get compliance trend over time
 */
router.get('/systems/:systemId/compliance/trend', async (req: Request, res: Response) => {
  try {
    const { periodDays, intervalHours } = req.query;

    const trend = slaService.getComplianceTrend(
      req.params.systemId,
      periodDays ? parseInt(periodDays as string) : undefined,
      intervalHours ? parseInt(intervalHours as string) : undefined
    );

    res.json({ success: true, data: trend });
  } catch (error) {
    logger.error('Error fetching compliance trend', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch compliance trend' });
  }
});

// ============================================
// VIOLATIONS
// ============================================

/**
 * GET /sla/systems/:systemId/violations
 * Get violations for a system
 */
router.get('/systems/:systemId/violations', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, metric, severity, acknowledged, resolved } = req.query;

    const violations = slaService.getViolations(req.params.systemId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      metric: metric as keyof typeof import('../models/sla.types.js').DEFAULT_SLA_PROFILES[0]['targets'],
    });

    res.json({ success: true, data: violations });
  } catch (error) {
    logger.error('Error fetching violations', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch violations' });
  }
});

/**
 * GET /sla/systems/:systemId/violations/active
 * Get active (unresolved) violations
 */
router.get('/systems/:systemId/violations/active', async (req: Request, res: Response) => {
  try {
    const violations = slaService.getActiveViolations(req.params.systemId);
    res.json({ success: true, data: violations });
  } catch (error) {
    logger.error('Error fetching active violations', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch active violations' });
  }
});

/**
 * GET /sla/systems/:systemId/violations/summary
 * Get violation summary
 */
router.get('/systems/:systemId/violations/summary', async (req: Request, res: Response) => {
  try {
    const { periodDays } = req.query;

    const summary = slaService.getViolationSummary(
      req.params.systemId,
      periodDays ? parseInt(periodDays as string) : undefined
    );

    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching violation summary', { error, systemId: req.params.systemId });
    res.status(500).json({ success: false, error: 'Failed to fetch violation summary' });
  }
});

/**
 * POST /sla/violations/:id/acknowledge
 * Acknowledge a violation
 */
router.post('/violations/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { acknowledgedBy } = req.body;

    if (!acknowledgedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: acknowledgedBy',
      });
    }

    const success = slaService.acknowledgeViolation(req.params.id, acknowledgedBy);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }

    res.json({ success: true, message: 'Violation acknowledged' });
  } catch (error) {
    logger.error('Error acknowledging violation', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to acknowledge violation' });
  }
});

// ============================================
// QUEUE STATS
// ============================================

/**
 * GET /sla/queue/stats
 * Get priority queue statistics
 */
router.get('/queue/stats', async (_req: Request, res: Response) => {
  try {
    const stats = slaService.getQueueStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching queue stats', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch queue stats' });
  }
});

// ============================================
// ALL VIOLATIONS
// ============================================

/**
 * GET /sla/violations/active
 * Get all active violations across all systems
 */
router.get('/violations/active', async (_req: Request, res: Response) => {
  try {
    const violations = slaService.getActiveViolations();
    res.json({ success: true, data: violations });
  } catch (error) {
    logger.error('Error fetching all active violations', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch active violations' });
  }
});

export default router;
