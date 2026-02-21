/**
 * Camera & AI Controller for Lifo4 EMS
 */

import { Request, Response, NextFunction } from 'express';
import { cameraService } from '../services/camera.service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

export class CameraController {
  // ============================================
  // CAMERA CRUD
  // ============================================

  async createCamera(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = req.body;

      if (!data.name || !data.siteId) {
        throw new BadRequestError('Name and site ID are required');
      }

      const camera = await cameraService.createCamera(data.siteId, user.organizationId, data);

      res.status(201).json({
        success: true,
        data: camera,
        message: 'Camera created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCamera(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      const camera = await cameraService.getCamera(cameraId);

      if (!camera) {
        throw new NotFoundError('Camera');
      }

      res.json({
        success: true,
        data: camera,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCamerasBySite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;

      const cameras = await cameraService.getCamerasBySite(siteId);

      res.json({
        success: true,
        data: cameras,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCamera(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const updates = req.body;

      const camera = await cameraService.updateCamera(cameraId, updates);

      res.json({
        success: true,
        data: camera,
        message: 'Camera updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCamera(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      await cameraService.deleteCamera(cameraId);

      res.json({
        success: true,
        message: 'Camera deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CONNECTION & STATUS
  // ============================================

  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      const result = await cameraService.testConnection(cameraId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      const snapshot = await cameraService.getSnapshot(cameraId);

      res.json({
        success: true,
        data: { image: snapshot },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStreamUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      const url = await cameraService.getStreamUrl(cameraId);

      res.json({
        success: true,
        data: { url },
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // PTZ CONTROL
  // ============================================

  async movePtz(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { pan, tilt, zoom } = req.body;

      await cameraService.movePtz(cameraId, pan || 0, tilt || 0, zoom || 0);

      res.json({
        success: true,
        message: 'PTZ command sent',
      });
    } catch (error) {
      next(error);
    }
  }

  async goToPreset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId, presetId } = req.params;

      await cameraService.goToPreset(cameraId, presetId);

      res.json({
        success: true,
        message: 'Moving to preset',
      });
    } catch (error) {
      next(error);
    }
  }

  async savePreset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { name } = req.body;

      if (!name) {
        throw new BadRequestError('Preset name is required');
      }

      const preset = await cameraService.savePreset(cameraId, name);

      res.status(201).json({
        success: true,
        data: preset,
        message: 'Preset saved',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SECURITY ZONES
  // ============================================

  async createSecurityZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const zone = req.body;

      if (!zone.name || !zone.polygon) {
        throw new BadRequestError('Zone name and polygon are required');
      }

      const created = await cameraService.createSecurityZone(cameraId, zone);

      res.status(201).json({
        success: true,
        data: created,
        message: 'Security zone created',
      });
    } catch (error) {
      next(error);
    }
  }

  async getSecurityZones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      const zones = await cameraService.getSecurityZones(cameraId);

      res.json({
        success: true,
        data: zones,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSecurityZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId, zoneId } = req.params;
      const updates = req.body;

      const zone = await cameraService.updateSecurityZone(cameraId, zoneId, updates);

      res.json({
        success: true,
        data: zone,
        message: 'Security zone updated',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteSecurityZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId, zoneId } = req.params;

      await cameraService.deleteSecurityZone(cameraId, zoneId);

      res.json({
        success: true,
        message: 'Security zone deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // AI DETECTION
  // ============================================

  async updateAISettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const settings = req.body;

      const camera = await cameraService.updateAISettings(cameraId, settings);

      res.json({
        success: true,
        data: camera,
        message: 'AI settings updated',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDetectionEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { startDate, endDate, type, limit } = req.query;

      const events = await cameraService.getDetectionEvents(cameraId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        type: type as string,
        limit: limit ? parseInt(limit as string, 10) : 100,
      });

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // VOICE & TALKBACK
  // ============================================

  async playVoiceMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { messageId, text } = req.body;

      if (messageId) {
        await cameraService.playPresetMessage(cameraId, messageId);
      } else if (text) {
        await cameraService.playTTSMessage(cameraId, text);
      } else {
        throw new BadRequestError('Message ID or text is required');
      }

      res.json({
        success: true,
        message: 'Voice message played',
      });
    } catch (error) {
      next(error);
    }
  }

  async getVoiceMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;

      const messages = await cameraService.getVoiceMessages(cameraId);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      next(error);
    }
  }

  async createVoiceMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const message = req.body;

      if (!message.name || !message.text) {
        throw new BadRequestError('Message name and text are required');
      }

      const created = await cameraService.createVoiceMessage(cameraId, message);

      res.status(201).json({
        success: true,
        data: created,
        message: 'Voice message created',
      });
    } catch (error) {
      next(error);
    }
  }

  async startTalkback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const user = req.user!;

      const session = await cameraService.startTalkbackSession(cameraId, user.userId);

      res.json({
        success: true,
        data: session,
        message: 'Talkback session started',
      });
    } catch (error) {
      next(error);
    }
  }

  async stopTalkback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId, sessionId } = req.params;

      await cameraService.stopTalkbackSession(cameraId, sessionId);

      res.json({
        success: true,
        message: 'Talkback session ended',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // RECORDINGS
  // ============================================

  async getRecordings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { startDate, endDate, limit } = req.query;

      const recordings = await cameraService.getRecordings(cameraId, {
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.json({
        success: true,
        data: recordings,
      });
    } catch (error) {
      next(error);
    }
  }

  async startRecording(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { reason } = req.body;

      const recording = await cameraService.startManualRecording(cameraId, reason);

      res.status(201).json({
        success: true,
        data: recording,
        message: 'Recording started',
      });
    } catch (error) {
      next(error);
    }
  }

  async stopRecording(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId, recordingId } = req.params;

      await cameraService.stopManualRecording(cameraId, recordingId);

      res.json({
        success: true,
        message: 'Recording stopped',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cameraId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await cameraService.getStatistics(
        cameraId,
        startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate ? new Date(endDate as string) : new Date()
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cameraController = new CameraController();
