/**
 * Microgrid Controller for Lifo4 EMS
 */

import { Request, Response, NextFunction } from 'express';
import { microgridService } from '../services/microgrid.service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { MicrogridOperatingMode } from '../models/microgrid.types.js';

export class MicrogridController {
  // ============================================
  // MICROGRID CRUD
  // ============================================

  async createMicrogrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { siteId, ...data } = req.body;

      if (!siteId || !data.name) {
        throw new BadRequestError('Site ID and name are required');
      }

      const microgrid = await microgridService.createMicrogrid(siteId, user.organizationId, data);

      res.status(201).json({
        success: true,
        data: microgrid,
        message: 'Microgrid created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMicrogrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;

      const microgrid = await microgridService.getMicrogrid(microgridId);

      if (!microgrid) {
        throw new NotFoundError('Microgrid');
      }

      res.json({
        success: true,
        data: microgrid,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMicrogridsBySite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;

      const microgrids = await microgridService.getMicrogridsBySite(siteId);

      res.json({
        success: true,
        data: microgrids,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMicrogrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const updates = req.body;

      const microgrid = await microgridService.updateMicrogrid(microgridId, updates);

      res.json({
        success: true,
        data: microgrid,
        message: 'Microgrid updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // COMPONENT MANAGEMENT
  // ============================================

  async addComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const component = req.body;

      if (!component.type || !component.name || component.ratedPower === undefined) {
        throw new BadRequestError('Component type, name, and rated power are required');
      }

      const created = await microgridService.addComponent(microgridId, component);

      res.status(201).json({
        success: true,
        data: created,
        message: 'Component added to microgrid',
      });
    } catch (error) {
      next(error);
    }
  }

  async removeComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId, componentId } = req.params;

      await microgridService.removeComponent(microgridId, componentId);

      res.json({
        success: true,
        message: 'Component removed from microgrid',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateComponentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId, componentId } = req.params;
      const { status } = req.body;

      if (!status) {
        throw new BadRequestError('Status is required');
      }

      await microgridService.updateComponentStatus(microgridId, componentId, status);

      res.json({
        success: true,
        message: 'Component status updated',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // OPERATING MODE CONTROL
  // ============================================

  async setOperatingMode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const { mode } = req.body;
      const user = req.user!;

      if (!mode || !Object.values(MicrogridOperatingMode).includes(mode)) {
        throw new BadRequestError('Valid operating mode is required');
      }

      const state = await microgridService.setOperatingMode(microgridId, mode, user.userId);

      res.json({
        success: true,
        data: state,
        message: `Operating mode set to ${mode}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async getState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;

      const microgrid = await microgridService.getMicrogrid(microgridId);

      if (!microgrid) {
        throw new NotFoundError('Microgrid');
      }

      res.json({
        success: true,
        data: microgrid.state,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ISLANDING CONTROL
  // ============================================

  async initiateIslanding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const { reason } = req.body;
      const user = req.user!;

      if (!reason) {
        throw new BadRequestError('Reason is required for islanding');
      }

      await microgridService.initiateIslanding(microgridId, reason, user.userId);

      res.json({
        success: true,
        message: 'Islanding initiated',
      });
    } catch (error) {
      next(error);
    }
  }

  async reconnectToGrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const user = req.user!;

      await microgridService.reconnectToGrid(microgridId, user.userId);

      res.json({
        success: true,
        message: 'Reconnected to grid',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // BLACK START
  // ============================================

  async initiateBlackStart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const user = req.user!;

      await microgridService.initiateBlackStart(microgridId, user.userId);

      res.json({
        success: true,
        message: 'Black start initiated',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateBlackStartConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const config = req.body;

      const microgrid = await microgridService.updateMicrogrid(microgridId, { blackStartConfig: config });

      res.json({
        success: true,
        data: microgrid.blackStartConfig,
        message: 'Black start configuration updated',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // POWER DISPATCH
  // ============================================

  async dispatchPower(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const dispatch = req.body;

      if (!dispatch.setpoints || dispatch.setpoints.length === 0) {
        throw new BadRequestError('At least one setpoint is required');
      }

      await microgridService.dispatchPower(microgridId, {
        ...dispatch,
        timestamp: new Date(),
        duration: dispatch.duration || 300,
        source: dispatch.source || 'manual',
      });

      res.json({
        success: true,
        message: 'Power dispatch executed',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GRID SERVICES
  // ============================================

  async updateGridServicesConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const config = req.body;

      await microgridService.updateGridServicesConfig(microgridId, config);

      res.json({
        success: true,
        message: 'Grid services configuration updated',
      });
    } catch (error) {
      next(error);
    }
  }

  async getGridServicesConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;

      const microgrid = await microgridService.getMicrogrid(microgridId);

      if (!microgrid) {
        throw new NotFoundError('Microgrid');
      }

      res.json({
        success: true,
        data: microgrid.gridServices,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ENERGY TRADING
  // ============================================

  async createTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const trade = req.body;

      if (!trade.type || !trade.market || !trade.energy) {
        throw new BadRequestError('Trade type, market, and energy are required');
      }

      const created = await microgridService.createTrade(microgridId, trade);

      res.status(201).json({
        success: true,
        data: created,
        message: 'Trade created',
      });
    } catch (error) {
      next(error);
    }
  }

  async submitTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tradeId } = req.params;

      const trade = await microgridService.submitTrade(tradeId);

      res.json({
        success: true,
        data: trade,
        message: 'Trade submitted',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // EVENTS & STATISTICS
  // ============================================

  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const { limit } = req.query;

      const events = await microgridService.getEvents(microgridId, limit ? parseInt(limit as string, 10) : 100);

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await microgridService.getStatistics(
        microgridId,
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

  // ============================================
  // CONTROL LOOP
  // ============================================

  async startControlLoop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;

      microgridService.startControlLoop(microgridId);

      res.json({
        success: true,
        message: 'Control loop started',
      });
    } catch (error) {
      next(error);
    }
  }

  async stopControlLoop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { microgridId } = req.params;

      microgridService.stopControlLoop(microgridId);

      res.json({
        success: true,
        message: 'Control loop stopped',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const microgridController = new MicrogridController();
