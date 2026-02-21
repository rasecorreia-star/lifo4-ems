/**
 * BMS Configuration Controller for Lifo4 EMS
 */

import { Request, Response, NextFunction } from 'express';
import { bmsConfigService } from '../services/bms-config.service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { UserRole } from '../models/types.js';

export class BMSConfigController {
  /**
   * Get BMS configuration for a system
   */
  async getConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;

      const config = await bmsConfigService.getConfiguration(systemId);

      if (!config) {
        throw new NotFoundError('BMS Configuration');
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update BMS configuration
   */
  async updateConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { updates, reason } = req.body;
      const user = req.user!;

      if (!updates || Object.keys(updates).length === 0) {
        throw new BadRequestError('No updates provided');
      }

      if (!reason || reason.trim().length < 10) {
        throw new BadRequestError('Reason is required (minimum 10 characters)');
      }

      // Check permissions
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN];
      if (!allowedRoles.includes(user.role as UserRole)) {
        throw new ForbiddenError('Insufficient permissions to update BMS configuration');
      }

      const result = await bmsConfigService.updateConfiguration(
        systemId,
        updates,
        user.userId,
        user.role as UserRole,
        reason
      );

      res.json({
        success: true,
        data: {
          config: result.config,
          requiresApproval: result.requiresApproval,
        },
        message: result.requiresApproval
          ? 'Configuration changes require approval from an administrator'
          : 'Configuration updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Preview configuration changes without applying
   */
  async previewChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { updates } = req.body;

      if (!updates || Object.keys(updates).length === 0) {
        throw new BadRequestError('No updates provided');
      }

      const preview = await bmsConfigService.previewChanges(systemId, updates);

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { config } = req.body;

      if (!config) {
        throw new BadRequestError('Configuration is required');
      }

      const validation = bmsConfigService.validateConfiguration(config);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve pending configuration change
   */
  async approveChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const user = req.user!;

      // Only Admin or Super Admin can approve
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only administrators can approve configuration changes');
      }

      const config = await bmsConfigService.approveChange(systemId, user.userId);

      res.json({
        success: true,
        data: config,
        message: 'Configuration change approved and applied',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject pending configuration change
   */
  async rejectChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { reason } = req.body;
      const user = req.user!;

      if (!reason || reason.trim().length < 10) {
        throw new BadRequestError('Rejection reason is required (minimum 10 characters)');
      }

      // Only Admin or Super Admin can reject
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only administrators can reject configuration changes');
      }

      await bmsConfigService.rejectChange(systemId, user.userId, reason);

      res.json({
        success: true,
        message: 'Configuration change rejected',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restore configuration to a previous version
   */
  async restoreVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { version, reason } = req.body;
      const user = req.user!;

      if (typeof version !== 'number' || version < 1) {
        throw new BadRequestError('Valid version number is required');
      }

      if (!reason || reason.trim().length < 10) {
        throw new BadRequestError('Reason is required (minimum 10 characters)');
      }

      const config = await bmsConfigService.restoreConfiguration(
        systemId,
        version,
        user.userId,
        reason
      );

      res.json({
        success: true,
        data: config,
        message: `Configuration restored to version ${version}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restore factory defaults
   */
  async restoreFactoryDefaults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { confirmText, chemistry, cellCount } = req.body;
      const user = req.user!;

      // Require confirmation
      if (confirmText !== 'RESTORE') {
        throw new BadRequestError('Please type RESTORE to confirm factory reset');
      }

      // Only Admin or Super Admin can restore factory defaults
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only administrators can restore factory defaults');
      }

      const config = await bmsConfigService.restoreFactoryDefaults(
        systemId,
        user.userId,
        chemistry || 'LiFePO4',
        cellCount || 16
      );

      res.json({
        success: true,
        data: config,
        message: 'Factory defaults restored successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get configuration change history
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { limit } = req.query;

      const history = await bmsConfigService.getConfigurationHistory(
        systemId,
        limit ? parseInt(limit as string, 10) : 50
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available BMS templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { manufacturer, chemistry } = req.query;

      const templates = await bmsConfigService.getTemplates(
        manufacturer as string | undefined,
        chemistry as string | undefined
      );

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apply a template to a system
   */
  async applyTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId } = req.params;
      const { templateId } = req.body;
      const user = req.user!;

      if (!templateId) {
        throw new BadRequestError('Template ID is required');
      }

      const config = await bmsConfigService.applyTemplate(systemId, templateId, user.userId);

      res.json({
        success: true,
        data: config,
        message: 'Template applied successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const bmsConfigController = new BMSConfigController();
