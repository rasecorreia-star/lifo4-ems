/**
 * EV Charger Controller for Lifo4 EMS
 */

import { Request, Response, NextFunction } from 'express';
import { evChargerService } from '../services/ev-charger.service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

export class EVChargerController {
  // ============================================
  // CHARGER CRUD
  // ============================================

  async createCharger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = req.body;

      if (!data.name || !data.siteId) {
        throw new BadRequestError('Name and site ID are required');
      }

      const charger = await evChargerService.createCharger(data.siteId, user.organizationId, data);

      res.status(201).json({
        success: true,
        data: charger,
        message: 'EV charger created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCharger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;

      const charger = await evChargerService.getCharger(chargerId);

      if (!charger) {
        throw new NotFoundError('EV Charger');
      }

      res.json({
        success: true,
        data: charger,
      });
    } catch (error) {
      next(error);
    }
  }

  async getChargersBySite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;

      const chargers = await evChargerService.getChargersBySite(siteId);

      res.json({
        success: true,
        data: chargers,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCharger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const updates = req.body;

      const charger = await evChargerService.updateCharger(chargerId, updates);

      res.json({
        success: true,
        data: charger,
        message: 'EV charger updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCharger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;

      await evChargerService.deleteCharger(chargerId);

      res.json({
        success: true,
        message: 'EV charger deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CHARGING OPERATIONS
  // ============================================

  async startCharging(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;
      const { idTag, limitWh, limitMinutes } = req.body;

      if (!idTag) {
        throw new BadRequestError('ID tag is required');
      }

      const session = await evChargerService.startChargingSession(
        chargerId,
        parseInt(connectorId, 10),
        idTag,
        { limitWh, limitMinutes }
      );

      res.status(201).json({
        success: true,
        data: session,
        message: 'Charging session started',
      });
    } catch (error) {
      next(error);
    }
  }

  async stopCharging(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, sessionId } = req.params;

      const session = await evChargerService.stopChargingSession(chargerId, sessionId);

      res.json({
        success: true,
        data: session,
        message: 'Charging session stopped',
      });
    } catch (error) {
      next(error);
    }
  }

  async getActiveSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;

      const session = await evChargerService.getActiveSession(chargerId, parseInt(connectorId, 10));

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const { startDate, endDate, status, limit } = req.query;

      const sessions = await evChargerService.getChargingSessions(chargerId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CONNECTOR STATUS
  // ============================================

  async getConnectorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;

      const connectors = await evChargerService.getConnectorStatus(chargerId);

      res.json({
        success: true,
        data: connectors,
      });
    } catch (error) {
      next(error);
    }
  }

  async unlockConnector(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;

      await evChargerService.unlockConnector(chargerId, parseInt(connectorId, 10));

      res.json({
        success: true,
        message: 'Connector unlock command sent',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // AUTHORIZATION
  // ============================================

  async authorizeTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const { idTag } = req.body;

      if (!idTag) {
        throw new BadRequestError('ID tag is required');
      }

      const result = await evChargerService.authorizeTag(chargerId, idTag);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async addAuthorizedTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const tagData = req.body;

      if (!tagData.idTag || !tagData.userId) {
        throw new BadRequestError('ID tag and user ID are required');
      }

      await evChargerService.addAuthorizedTag(chargerId, tagData);

      res.status(201).json({
        success: true,
        message: 'Tag authorized',
      });
    } catch (error) {
      next(error);
    }
  }

  async removeAuthorizedTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, idTag } = req.params;

      await evChargerService.removeAuthorizedTag(chargerId, idTag);

      res.json({
        success: true,
        message: 'Tag authorization removed',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SMART CHARGING
  // ============================================

  async setChargingProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;
      const profile = req.body;

      if (!profile.purpose || !profile.schedule) {
        throw new BadRequestError('Profile purpose and schedule are required');
      }

      const result = await evChargerService.setChargingProfile(
        chargerId,
        parseInt(connectorId, 10),
        profile
      );

      res.json({
        success: true,
        data: result,
        message: 'Charging profile set',
      });
    } catch (error) {
      next(error);
    }
  }

  async clearChargingProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;

      await evChargerService.clearChargingProfile(chargerId, parseInt(connectorId, 10));

      res.json({
        success: true,
        message: 'Charging profile cleared',
      });
    } catch (error) {
      next(error);
    }
  }

  async getChargingProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;

      const profiles = await evChargerService.getChargingProfiles(chargerId);

      res.json({
        success: true,
        data: profiles,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // LOAD BALANCING
  // ============================================

  async getLoadBalancingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;

      const config = await evChargerService.getLoadBalancingConfig(siteId);

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLoadBalancingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;
      const config = req.body;

      const updated = await evChargerService.updateLoadBalancingConfig(siteId, config);

      res.json({
        success: true,
        data: updated,
        message: 'Load balancing configuration updated',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // RESERVATIONS
  // ============================================

  async createReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;
      const { idTag, startTime, duration } = req.body;

      if (!idTag || !startTime) {
        throw new BadRequestError('ID tag and start time are required');
      }

      const reservation = await evChargerService.createReservation(
        chargerId,
        parseInt(connectorId, 10),
        idTag,
        new Date(startTime),
        duration || 60
      );

      res.status(201).json({
        success: true,
        data: reservation,
        message: 'Reservation created',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, reservationId } = req.params;

      await evChargerService.cancelReservation(chargerId, reservationId);

      res.json({
        success: true,
        message: 'Reservation cancelled',
      });
    } catch (error) {
      next(error);
    }
  }

  async getReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;

      const reservations = await evChargerService.getReservations(chargerId);

      res.json({
        success: true,
        data: reservations,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TARIFFS
  // ============================================

  async getTariffs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;

      const tariffs = await evChargerService.getTariffs(siteId);

      res.json({
        success: true,
        data: tariffs,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTariffs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;
      const tariffs = req.body;

      if (!Array.isArray(tariffs)) {
        throw new BadRequestError('Tariffs must be an array');
      }

      const updated = await evChargerService.updateTariffs(siteId, tariffs);

      res.json({
        success: true,
        data: updated,
        message: 'Tariffs updated',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // OCPP COMMANDS
  // ============================================

  async reset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const { type } = req.body;

      await evChargerService.reset(chargerId, type || 'Soft');

      res.json({
        success: true,
        message: `${type || 'Soft'} reset command sent`,
      });
    } catch (error) {
      next(error);
    }
  }

  async changeAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId, connectorId } = req.params;
      const { type } = req.body;

      if (!type || !['Operative', 'Inoperative'].includes(type)) {
        throw new BadRequestError('Type must be Operative or Inoperative');
      }

      await evChargerService.changeAvailability(chargerId, parseInt(connectorId, 10), type);

      res.json({
        success: true,
        message: `Availability changed to ${type}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const { keys } = req.query;

      const config = await evChargerService.getConfiguration(
        chargerId,
        keys ? (keys as string).split(',') : undefined
      );

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  async changeConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const { key, value } = req.body;

      if (!key || value === undefined) {
        throw new BadRequestError('Key and value are required');
      }

      await evChargerService.changeConfiguration(chargerId, key, value);

      res.json({
        success: true,
        message: 'Configuration changed',
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chargerId } = req.params;
      const { requestedMessage, connectorId } = req.body;

      if (!requestedMessage) {
        throw new BadRequestError('Requested message type is required');
      }

      await evChargerService.triggerMessage(chargerId, requestedMessage, connectorId);

      res.json({
        success: true,
        message: 'Message triggered',
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
      const { chargerId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await evChargerService.getStatistics(
        chargerId,
        startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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

  async getSiteStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await evChargerService.getSiteStatistics(
        siteId,
        startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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

export const evChargerController = new EVChargerController();
