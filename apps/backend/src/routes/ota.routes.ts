/**
 * OTA (Over-The-Air) Update Routes
 * Canary deployment management for edge controllers
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// In-memory store for active deployments (backed by DeploymentRepository in production)
// Key: deploymentId, Value: deployment state snapshot
const deployments = new Map<string, Record<string, unknown>>();

// ---------------------------------------------------------------------------
// POST /api/v1/ota/deploy
// Start a canary deployment (SUPER_ADMIN only)
// ---------------------------------------------------------------------------
router.post('/deploy', requireRole('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { version, downloadUrl, checksum, signature, releaseNotes, skipCanary, force, targetEdgeIds } =
    req.body as {
      version?: string;
      downloadUrl?: string;
      checksum?: string;
      signature?: string;
      releaseNotes?: string;
      skipCanary?: boolean;
      force?: boolean;
      targetEdgeIds?: string[];
    };

  if (!version || !downloadUrl || !checksum) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'version, downloadUrl, and checksum are required',
    });
  }

  const deploymentId = `deploy-${version}-${Date.now()}`;
  const now = new Date().toISOString();

  const deployment = {
    deploymentId,
    version,
    downloadUrl,
    checksum,
    signature: signature ?? null,
    releaseNotes: releaseNotes ?? '',
    skipCanary: skipCanary ?? false,
    force: force ?? false,
    targetEdgeIds: targetEdgeIds ?? [],
    status: 'IN_PROGRESS',
    currentStage: 0,
    stages: skipCanary
      ? [{ percentage: 100, status: 'IN_PROGRESS' }]
      : [
          { percentage: 5,   status: 'IN_PROGRESS' },
          { percentage: 25,  status: 'PENDING' },
          { percentage: 50,  status: 'PENDING' },
          { percentage: 100, status: 'PENDING' },
        ],
    startedAt: now,
    startedBy: req.user!.userId,
  };

  deployments.set(deploymentId, deployment);

  return res.status(202).json({
    success: true,
    message: `Canary deployment started for v${version}`,
    data: deployment,
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/ota/deployments/latest
// Get the most recent active or completed deployment
// ---------------------------------------------------------------------------
router.get('/deployments/latest', requireRole('ADMIN'), (_req: Request, res: Response) => {
  if (deployments.size === 0) {
    return res.json({ success: true, data: null, message: 'No deployments found' });
  }

  const all = Array.from(deployments.values()) as Array<{ startedAt: string }>;
  const latest = all.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )[0];

  return res.json({ success: true, data: latest });
});

// ---------------------------------------------------------------------------
// GET /api/v1/ota/deployments/:deploymentId
// Get status of a specific deployment
// ---------------------------------------------------------------------------
router.get('/deployments/:deploymentId', requireRole('ADMIN'), (req: Request, res: Response) => {
  const deployment = deployments.get(req.params.deploymentId);

  if (!deployment) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Deployment ${req.params.deploymentId} not found`,
    });
  }

  return res.json({ success: true, data: deployment });
});

// ---------------------------------------------------------------------------
// POST /api/v1/ota/deployments/:deploymentId/rollback
// Manually trigger rollback for a deployment (SUPER_ADMIN only)
// ---------------------------------------------------------------------------
router.post(
  '/deployments/:deploymentId/rollback',
  requireRole('SUPER_ADMIN'),
  (req: Request, res: Response) => {
    const deployment = deployments.get(req.params.deploymentId) as
      | { status: string; rolledBackAt: string; rolledBackBy: string }
      | undefined;

    if (!deployment) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Deployment ${req.params.deploymentId} not found`,
      });
    }

    if (deployment.status === 'ROLLED_BACK') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Deployment has already been rolled back',
      });
    }

    deployment.status = 'ROLLED_BACK';
    deployment.rolledBackAt = new Date().toISOString();
    deployment.rolledBackBy = req.user!.userId;

    return res.json({
      success: true,
      message: `Rollback initiated for deployment ${req.params.deploymentId}`,
      data: deployment,
    });
  },
);

// ---------------------------------------------------------------------------
// PUT /api/v1/systems/:systemId/maintenance-window
// Configure OTA maintenance window for a system (ADMIN+)
// ---------------------------------------------------------------------------
router.put(
  '/systems/:systemId/maintenance-window',
  requireRole('ADMIN'),
  (req: Request, res: Response) => {
    const { startHour, endHour } = req.body as { startHour?: number; endHour?: number };

    if (startHour === undefined || endHour === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'startHour and endHour are required (0-23)',
      });
    }

    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'startHour and endHour must be between 0 and 23',
      });
    }

    return res.json({
      success: true,
      message: `Maintenance window updated for system ${req.params.systemId}`,
      data: {
        systemId: req.params.systemId,
        maintenanceWindow: { startHour, endHour },
        updatedAt: new Date().toISOString(),
        updatedBy: req.user!.userId,
      },
    });
  },
);

export default router;
