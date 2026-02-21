/**
 * Fleet Management Controller for Lifo4 EMS
 */

import { Request, Response, NextFunction } from 'express';
import { fleetService } from '../services/fleet.service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { UserRole } from '../models/types.js';
import { BulkOperationType } from '../models/fleet.types.js';

export class FleetController {
  /**
   * Create a new fleet
   */
  async createFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, systemIds, config } = req.body;
      const user = req.user!;

      if (!name || !systemIds || systemIds.length === 0) {
        throw new BadRequestError('Name and at least one system ID are required');
      }

      const fleet = await fleetService.createFleet(
        user.organizationId,
        name,
        systemIds,
        config
      );

      res.status(201).json({
        success: true,
        data: fleet,
        message: 'Fleet created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fleet by ID
   */
  async getFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;

      const fleet = await fleetService.getFleet(fleetId);

      if (!fleet) {
        throw new NotFoundError('Fleet');
      }

      res.json({
        success: true,
        data: fleet,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fleets for organization
   */
  async getFleets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;

      const fleets = await fleetService.getFleetsByOrganization(user.organizationId);

      res.json({
        success: true,
        data: fleets,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update fleet status
   */
  async updateFleetStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;

      const status = await fleetService.updateFleetStatus(fleetId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add systems to fleet
   */
  async addSystems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;
      const { systemIds } = req.body;

      if (!systemIds || systemIds.length === 0) {
        throw new BadRequestError('At least one system ID is required');
      }

      const fleet = await fleetService.addSystemsToFleet(fleetId, systemIds);

      res.json({
        success: true,
        data: fleet,
        message: `${systemIds.length} system(s) added to fleet`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove systems from fleet
   */
  async removeSystems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;
      const { systemIds } = req.body;

      if (!systemIds || systemIds.length === 0) {
        throw new BadRequestError('At least one system ID is required');
      }

      const fleet = await fleetService.removeSystemsFromFleet(fleetId, systemIds);

      res.json({
        success: true,
        data: fleet,
        message: `${systemIds.length} system(s) removed from fleet`,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SLA MANAGEMENT
  // ============================================

  /**
   * Create SLA configuration
   */
  async createSLAConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;
      const config = req.body;

      const slaConfig = await fleetService.createSLAConfig({
        ...config,
        fleetId,
      });

      res.status(201).json({
        success: true,
        data: slaConfig,
        message: 'SLA configuration created',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get SLA configuration
   */
  async getSLAConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slaId } = req.params;

      const config = await fleetService.getSLAConfig(slaId);

      if (!config) {
        throw new NotFoundError('SLA Configuration');
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
   * Generate SLA report
   */
  async generateSLAReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slaId } = req.params;
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        throw new BadRequestError('Start date and end date are required');
      }

      const report = await fleetService.calculateSLAReport(
        slaId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record SLA incident
   */
  async recordIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const incident = req.body;

      if (!incident.type || !incident.severity || !incident.startTime) {
        throw new BadRequestError('Incident type, severity, and start time are required');
      }

      const recorded = await fleetService.recordIncident({
        ...incident,
        startTime: new Date(incident.startTime),
        endTime: incident.endTime ? new Date(incident.endTime) : undefined,
      });

      res.status(201).json({
        success: true,
        data: recorded,
        message: 'Incident recorded',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Create bulk operation
   */
  async createBulkOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, targetSystemIds, payload, strategy } = req.body;
      const user = req.user!;

      if (!type || !targetSystemIds || targetSystemIds.length === 0) {
        throw new BadRequestError('Operation type and target systems are required');
      }

      // Validate operation type
      if (!Object.values(BulkOperationType).includes(type)) {
        throw new BadRequestError('Invalid operation type');
      }

      const operation = await fleetService.createBulkOperation(
        user.organizationId,
        type,
        targetSystemIds,
        payload || {},
        strategy || 'staged',
        user.userId
      );

      res.status(201).json({
        success: true,
        data: operation,
        message: 'Bulk operation created',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Execute bulk operation
   */
  async executeBulkOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operationId } = req.params;
      const user = req.user!;

      // Only Admin+ can execute bulk operations
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only administrators can execute bulk operations');
      }

      // Start execution (async)
      fleetService.executeBulkOperation(operationId).catch(error => {
        logger.error(`Bulk operation execution failed: ${operationId}`, { error });
      });

      res.json({
        success: true,
        message: 'Bulk operation execution started',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get fleet analytics
   */
  async getFleetAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const analytics = await fleetService.getFleetAnalytics(fleetId, start, end);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get system benchmarks
   */
  async getSystemBenchmarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;

      const benchmarks = await fleetService.getSystemBenchmarks(fleetId);

      res.json({
        success: true,
        data: benchmarks,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // FIRMWARE MANAGEMENT
  // ============================================

  /**
   * Get firmware versions
   */
  async getFirmwareVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { model } = req.query;

      const versions = await fleetService.getFirmwareVersions(model as string | undefined);

      res.json({
        success: true,
        data: versions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule firmware update
   */
  async scheduleFirmwareUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { systemId, firmwareVersionId, scheduledAt } = req.body;
      const user = req.user!;

      if (!systemId || !firmwareVersionId) {
        throw new BadRequestError('System ID and firmware version ID are required');
      }

      const update = await fleetService.scheduleFirmwareUpdate(
        systemId,
        firmwareVersionId,
        scheduledAt ? new Date(scheduledAt) : new Date(),
        user.userId
      );

      res.status(201).json({
        success: true,
        data: update,
        message: 'Firmware update scheduled',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // MAINTENANCE
  // ============================================

  /**
   * Create maintenance schedule
   */
  async createMaintenanceSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = req.body;
      const user = req.user!;

      if (!schedule.type || !schedule.systemId || !schedule.scheduledStart) {
        throw new BadRequestError('Type, system ID, and scheduled start are required');
      }

      const created = await fleetService.createMaintenanceSchedule({
        ...schedule,
        organizationId: user.organizationId,
        createdBy: user.userId,
        scheduledStart: new Date(schedule.scheduledStart),
        scheduledEnd: new Date(schedule.scheduledEnd),
      });

      res.status(201).json({
        success: true,
        data: created,
        message: 'Maintenance scheduled',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming maintenance
   */
  async getUpcomingMaintenance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fleetId } = req.params;
      const { days } = req.query;

      const schedules = await fleetService.getUpcomingMaintenance(
        fleetId,
        days ? parseInt(days as string, 10) : 30
      );

      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const fleetController = new FleetController();
