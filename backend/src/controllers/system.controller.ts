import { Request, Response } from 'express';
import { systemService } from '../services/system.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { NotFoundError } from '../utils/errors.js';
import {
  createSystemSchema,
  updateSystemSchema,
  updateProtectionSettingsSchema,
  paginationSchema,
} from '../utils/validation.js';
import { UserRole } from '../models/types.js';

/**
 * Create a new BESS system
 * POST /api/v1/systems
 */
export const createSystem = asyncHandler(async (req: Request, res: Response) => {
  const input = createSystemSchema.parse(req.body);
  const system = await systemService.createSystem(input, req.user!.organizationId);

  res.status(201).json({
    success: true,
    data: system,
  });
});

/**
 * Get all systems (filtered by user permissions)
 * GET /api/v1/systems
 *
 * Access control:
 * - SUPER_ADMIN: All systems
 * - ADMIN/MANAGER/TECHNICIAN/OPERATOR/VIEWER: Organization systems only
 * - USER (end user): Only systems in allowedSystems
 */
export const getSystems = asyncHandler(async (req: Request, res: Response) => {
  const pagination = paginationSchema.parse(req.query);
  const user = req.user!;
  const systemFilter = req.systemFilter;

  let result;

  // Apply filter based on user type
  if (!systemFilter) {
    // Super admin - no filter
    result = await systemService.getAllSystems(pagination);
  } else if (systemFilter.type === 'allowedSystems') {
    // End user - filter by allowed systems
    if (!systemFilter.systemIds || systemFilter.systemIds.length === 0) {
      // User has no systems assigned
      result = { systems: [], total: 0 };
    } else {
      result = await systemService.getSystemsByIds(systemFilter.systemIds, pagination);
    }
  } else {
    // Organization-based filter
    result = await systemService.getSystemsByOrganization(
      systemFilter.organizationId || user.organizationId,
      pagination
    );
  }

  res.status(200).json({
    success: true,
    data: result.systems,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit!),
    },
  });
});

/**
 * Get system by ID
 * GET /api/v1/systems/:systemId
 */
export const getSystemById = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const system = await systemService.getSystemById(systemId);

  if (!system) {
    throw new NotFoundError('System');
  }

  res.status(200).json({
    success: true,
    data: system,
  });
});

/**
 * Update system
 * PATCH /api/v1/systems/:systemId
 */
export const updateSystem = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const input = updateSystemSchema.parse(req.body);

  const system = await systemService.updateSystem(systemId, input);

  res.status(200).json({
    success: true,
    data: system,
  });
});

/**
 * Delete system
 * DELETE /api/v1/systems/:systemId
 */
export const deleteSystem = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  await systemService.deleteSystem(systemId);

  res.status(200).json({
    success: true,
    message: 'System deleted successfully',
  });
});

/**
 * Get systems by site
 * GET /api/v1/sites/:siteId/systems
 */
export const getSystemsBySite = asyncHandler(async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const systems = await systemService.getSystemsBySite(siteId);

  res.status(200).json({
    success: true,
    data: systems,
  });
});

/**
 * Get systems overview/dashboard data
 * GET /api/v1/systems/overview
 *
 * Access control:
 * - SUPER_ADMIN: All systems
 * - Other roles: Organization systems
 * - USER (end user): Only allowed systems
 */
export const getSystemsOverview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const systemFilter = req.systemFilter;

  let overview;

  if (!systemFilter) {
    // Super admin - all systems
    overview = await systemService.getSystemsOverview();
  } else if (systemFilter.type === 'allowedSystems') {
    // End user - only allowed systems
    overview = await systemService.getSystemsOverviewByIds(systemFilter.systemIds || []);
  } else {
    // Organization-based filter
    overview = await systemService.getSystemsOverview(systemFilter.organizationId || user.organizationId);
  }

  res.status(200).json({
    success: true,
    data: overview,
  });
});

/**
 * Get protection settings for a system
 * GET /api/v1/systems/:systemId/protection
 */
export const getProtectionSettings = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const settings = await systemService.getProtectionSettings(systemId);

  if (!settings) {
    throw new NotFoundError('Protection settings');
  }

  res.status(200).json({
    success: true,
    data: settings,
  });
});

/**
 * Update protection settings
 * PATCH /api/v1/systems/:systemId/protection
 */
export const updateProtectionSettings = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const input = updateProtectionSettingsSchema.parse(req.body);

  const settings = await systemService.updateProtectionSettings(
    systemId,
    input,
    req.user!.id
  );

  res.status(200).json({
    success: true,
    data: settings,
  });
});
