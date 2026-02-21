/**
 * Prospect Analysis Controller for Lifo4 EMS
 */

import { Request, Response, NextFunction } from 'express';
import { prospectService } from '../services/prospect.service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { PipelineStage } from '../models/prospect.types.js';

export class ProspectController {
  // ============================================
  // PROSPECT CRUD
  // ============================================

  async createProspect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { contact, company, assignedTo } = req.body;

      if (!contact?.name || !contact?.email || !company?.name) {
        throw new BadRequestError('Contact name, email, and company name are required');
      }

      const prospect = await prospectService.createProspect(
        user.organizationId,
        contact,
        company,
        assignedTo || user.userId
      );

      res.status(201).json({
        success: true,
        data: prospect,
        message: 'Prospect created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProspect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const prospect = await prospectService.getProspect(prospectId);

      if (!prospect) {
        throw new NotFoundError('Prospect');
      }

      res.json({
        success: true,
        data: prospect,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProspects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { stage } = req.query;

      const prospects = await prospectService.getProspectsByOrganization(
        user.organizationId,
        stage as PipelineStage | undefined
      );

      res.json({
        success: true,
        data: prospects,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProspect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;
      const updates = req.body;

      const prospect = await prospectService.updateProspect(prospectId, updates);

      res.json({
        success: true,
        data: prospect,
        message: 'Prospect updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;
      const { stage } = req.body;
      const user = req.user!;

      if (!stage || !Object.values(PipelineStage).includes(stage)) {
        throw new BadRequestError('Valid pipeline stage is required');
      }

      const prospect = await prospectService.updatePipelineStage(prospectId, stage, user.userId);

      res.json({
        success: true,
        data: prospect,
        message: `Pipeline stage updated to ${stage}`,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ANALYZER KIT MANAGEMENT
  // ============================================

  async createAnalyzerKit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;

      if (!data.serialNumber || !data.name || !data.hardware) {
        throw new BadRequestError('Serial number, name, and hardware configuration are required');
      }

      const kit = await prospectService.createAnalyzerKit(data);

      res.status(201).json({
        success: true,
        data: kit,
        message: 'Analyzer kit created',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAnalyzerKit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kitId } = req.params;

      const kit = await prospectService.getAnalyzerKit(kitId);

      if (!kit) {
        throw new NotFoundError('Analyzer Kit');
      }

      res.json({
        success: true,
        data: kit,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableAnalyzers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kits = await prospectService.getAvailableAnalyzers();

      res.json({
        success: true,
        data: kits,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignAnalyzer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;
      const { analyzerId, expectedDays } = req.body;

      if (!analyzerId) {
        throw new BadRequestError('Analyzer ID is required');
      }

      await prospectService.assignAnalyzerToProspect(analyzerId, prospectId, expectedDays || 14);

      res.json({
        success: true,
        message: 'Analyzer assigned to prospect',
      });
    } catch (error) {
      next(error);
    }
  }

  async markAnalyzerInstalled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      await prospectService.markAnalyzerInstalled(prospectId);

      res.json({
        success: true,
        message: 'Analyzer marked as installed',
      });
    } catch (error) {
      next(error);
    }
  }

  async startMeasurement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      await prospectService.startMeasurement(prospectId);

      res.json({
        success: true,
        message: 'Measurement started',
      });
    } catch (error) {
      next(error);
    }
  }

  async removeAnalyzer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      await prospectService.removeAnalyzer(prospectId);

      res.json({
        success: true,
        message: 'Analyzer removed from prospect',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ANALYSIS
  // ============================================

  async getAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const prospect = await prospectService.getProspect(prospectId);

      if (!prospect) {
        throw new NotFoundError('Prospect');
      }

      res.json({
        success: true,
        data: prospect.analysis,
      });
    } catch (error) {
      next(error);
    }
  }

  async processAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const analysis = await prospectService.processAnalysisData(prospectId);

      res.json({
        success: true,
        data: analysis,
        message: 'Analysis processing completed',
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const prospect = await prospectService.getProspect(prospectId);

      if (!prospect || !prospect.analysis) {
        throw new NotFoundError('Prospect or Analysis');
      }

      res.json({
        success: true,
        data: prospect.analysis.recommendations,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // PROPOSALS
  // ============================================

  async createProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;
      const { recommendationId, customizations } = req.body;
      const user = req.user!;

      if (!recommendationId) {
        throw new BadRequestError('Recommendation ID is required');
      }

      const proposal = await prospectService.createProposal(
        prospectId,
        recommendationId,
        user.userId,
        customizations
      );

      res.status(201).json({
        success: true,
        data: proposal,
        message: 'Proposal created',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProposals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const prospect = await prospectService.getProspect(prospectId);

      if (!prospect) {
        throw new NotFoundError('Prospect');
      }

      res.json({
        success: true,
        data: prospect.proposals,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId, proposalId } = req.params;

      const proposal = await prospectService.sendProposal(prospectId, proposalId);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal sent',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // NOTES & ACTIVITIES
  // ============================================

  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;
      const { content } = req.body;
      const user = req.user!;

      if (!content) {
        throw new BadRequestError('Note content is required');
      }

      const note = await prospectService.addNote(prospectId, content, user.userId, user.name || 'User');

      res.status(201).json({
        success: true,
        data: note,
        message: 'Note added',
      });
    } catch (error) {
      next(error);
    }
  }

  async getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const prospect = await prospectService.getProspect(prospectId);

      if (!prospect) {
        throw new NotFoundError('Prospect');
      }

      res.json({
        success: true,
        data: prospect.notes,
      });
    } catch (error) {
      next(error);
    }
  }

  async addActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;
      const activityData = req.body;
      const user = req.user!;

      if (!activityData.type || !activityData.title) {
        throw new BadRequestError('Activity type and title are required');
      }

      const activity = await prospectService.addActivity(prospectId, activityData, user.userId);

      res.status(201).json({
        success: true,
        data: activity,
        message: 'Activity added',
      });
    } catch (error) {
      next(error);
    }
  }

  async getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prospectId } = req.params;

      const prospect = await prospectService.getProspect(prospectId);

      if (!prospect) {
        throw new NotFoundError('Prospect');
      }

      res.json({
        success: true,
        data: prospect.activities,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getSalesStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { startDate, endDate } = req.query;

      const stats = await prospectService.getSalesStatistics(
        user.organizationId,
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

export const prospectController = new ProspectController();
