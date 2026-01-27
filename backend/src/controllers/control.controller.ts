import { Request, Response } from 'express';
import { controlService } from '../services/control.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  sendCommandSchema,
  setOperationModeSchema,
  createScheduleSchema,
} from '../utils/validation.js';

/**
 * Send command to system
 * POST /api/v1/control/command
 */
export const sendCommand = asyncHandler(async (req: Request, res: Response) => {
  const { systemId, command, params } = sendCommandSchema.parse(req.body);
  const result = await controlService.sendCommand(systemId, command, params || {}, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Set operation mode
 * POST /api/v1/control/:systemId/mode
 */
export const setOperationMode = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { mode } = setOperationModeSchema.parse({ ...req.body, systemId });

  const result = await controlService.setOperationMode(systemId, mode as any, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Emergency stop
 * POST /api/v1/control/:systemId/emergency-stop
 */
export const emergencyStop = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { reason } = req.body;

  const result = await controlService.emergencyStop(systemId, req.user!.id, reason || 'Manual emergency stop');

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Start charging
 * POST /api/v1/control/:systemId/charge/start
 */
export const startCharge = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { targetSoc, maxCurrent } = req.body;

  const result = await controlService.startCharge(systemId, req.user!.id, {
    targetSoc,
    maxCurrent,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Stop charging
 * POST /api/v1/control/:systemId/charge/stop
 */
export const stopCharge = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const result = await controlService.stopCharge(systemId, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Start discharging
 * POST /api/v1/control/:systemId/discharge/start
 */
export const startDischarge = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { targetSoc, maxCurrent, power } = req.body;

  const result = await controlService.startDischarge(systemId, req.user!.id, {
    targetSoc,
    maxCurrent,
    power,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Stop discharging
 * POST /api/v1/control/:systemId/discharge/stop
 */
export const stopDischarge = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const result = await controlService.stopDischarge(systemId, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Reset alarms
 * POST /api/v1/control/:systemId/reset-alarms
 */
export const resetAlarms = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const result = await controlService.resetAlarms(systemId, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Start cell balancing
 * POST /api/v1/control/:systemId/balance/start
 */
export const startBalance = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const result = await controlService.startBalance(systemId, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Stop cell balancing
 * POST /api/v1/control/:systemId/balance/stop
 */
export const stopBalance = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const result = await controlService.stopBalance(systemId, req.user!.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Calibrate SOC
 * POST /api/v1/control/:systemId/calibrate-soc
 */
export const calibrateSoc = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { actualSoc } = req.body;

  const result = await controlService.calibrateSoc(systemId, req.user!.id, actualSoc);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// SCHEDULES
// ============================================

/**
 * Create schedule
 * POST /api/v1/control/schedules
 */
export const createSchedule = asyncHandler(async (req: Request, res: Response) => {
  const input = createScheduleSchema.parse(req.body);
  const schedule = await controlService.createSchedule(input as any);

  res.status(201).json({
    success: true,
    data: schedule,
  });
});

/**
 * Get schedules for a system
 * GET /api/v1/control/:systemId/schedules
 */
export const getSchedules = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const schedules = await controlService.getSchedules(systemId);

  res.status(200).json({
    success: true,
    data: schedules,
  });
});

/**
 * Update schedule
 * PATCH /api/v1/control/schedules/:scheduleId
 */
export const updateSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { scheduleId } = req.params;
  const schedule = await controlService.updateSchedule(scheduleId, req.body);

  res.status(200).json({
    success: true,
    data: schedule,
  });
});

/**
 * Delete schedule
 * DELETE /api/v1/control/schedules/:scheduleId
 */
export const deleteSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { scheduleId } = req.params;
  await controlService.deleteSchedule(scheduleId);

  res.status(200).json({
    success: true,
    message: 'Schedule deleted successfully',
  });
});
