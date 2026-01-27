/**
 * Camera & AI Routes for Lifo4 EMS
 */

import { Router } from 'express';
import { cameraController } from '../controllers/camera.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/types.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CAMERA CRUD
// ============================================

router.post(
  '/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => cameraController.createCamera(req, res, next)
);

router.get(
  '/site/:siteId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getCamerasBySite(req, res, next)
);

router.get(
  '/:cameraId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getCamera(req, res, next)
);

router.put(
  '/:cameraId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.updateCamera(req, res, next)
);

router.delete(
  '/:cameraId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => cameraController.deleteCamera(req, res, next)
);

// ============================================
// CONNECTION & STATUS
// ============================================

router.post(
  '/:cameraId/test',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.testConnection(req, res, next)
);

router.get(
  '/:cameraId/snapshot',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getSnapshot(req, res, next)
);

router.get(
  '/:cameraId/stream',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getStreamUrl(req, res, next)
);

// ============================================
// PTZ CONTROL
// ============================================

router.post(
  '/:cameraId/ptz/move',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.movePtz(req, res, next)
);

router.post(
  '/:cameraId/ptz/preset/:presetId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.goToPreset(req, res, next)
);

router.post(
  '/:cameraId/ptz/preset',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.savePreset(req, res, next)
);

// ============================================
// SECURITY ZONES
// ============================================

router.post(
  '/:cameraId/zones',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.createSecurityZone(req, res, next)
);

router.get(
  '/:cameraId/zones',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getSecurityZones(req, res, next)
);

router.put(
  '/:cameraId/zones/:zoneId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.updateSecurityZone(req, res, next)
);

router.delete(
  '/:cameraId/zones/:zoneId',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  (req, res, next) => cameraController.deleteSecurityZone(req, res, next)
);

// ============================================
// AI DETECTION
// ============================================

router.put(
  '/:cameraId/ai-settings',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.updateAISettings(req, res, next)
);

router.get(
  '/:cameraId/events',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getDetectionEvents(req, res, next)
);

// ============================================
// VOICE & TALKBACK
// ============================================

router.post(
  '/:cameraId/voice/play',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.playVoiceMessage(req, res, next)
);

router.get(
  '/:cameraId/voice/messages',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getVoiceMessages(req, res, next)
);

router.post(
  '/:cameraId/voice/messages',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN]),
  (req, res, next) => cameraController.createVoiceMessage(req, res, next)
);

router.post(
  '/:cameraId/talkback/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.startTalkback(req, res, next)
);

router.post(
  '/:cameraId/talkback/:sessionId/stop',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.stopTalkback(req, res, next)
);

// ============================================
// RECORDINGS
// ============================================

router.get(
  '/:cameraId/recordings',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.getRecordings(req, res, next)
);

router.post(
  '/:cameraId/recordings/start',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.startRecording(req, res, next)
);

router.post(
  '/:cameraId/recordings/:recordingId/stop',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.OPERATOR]),
  (req, res, next) => cameraController.stopRecording(req, res, next)
);

// ============================================
// STATISTICS
// ============================================

router.get(
  '/:cameraId/statistics',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  (req, res, next) => cameraController.getStatistics(req, res, next)
);

export default router;
