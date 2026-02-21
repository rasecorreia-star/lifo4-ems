/**
 * Telemetry Routes
 * Raw telemetry data ingestion and retrieval
 */

import { Router } from 'express';
import { TelemetryController } from '../controllers/TelemetryController';

const router = Router({ mergeParams: true });

// Telemetry endpoints with :systemId
router.get('/:systemId/latest', TelemetryController.getLatest);
router.get('/:systemId/history', TelemetryController.getHistory);
router.post('/:systemId/ingest', TelemetryController.ingestTelemetry);

export default router;
