import { Request, Response } from 'express';
import { telemetryService } from '../services/telemetry.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { NotFoundError } from '../utils/errors.js';
import { telemetryQuerySchema, dateRangeSchema } from '../utils/validation.js';

/**
 * Get current telemetry for a system
 * GET /api/v1/telemetry/:systemId/current
 */
export const getCurrentTelemetry = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const telemetry = await telemetryService.getCurrentTelemetry(systemId);

  if (!telemetry) {
    throw new NotFoundError('Telemetry data');
  }

  res.status(200).json({
    success: true,
    data: telemetry,
  });
});

/**
 * Get historical telemetry data
 * GET /api/v1/telemetry/:systemId/history
 */
export const getHistoricalTelemetry = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const query = telemetryQuerySchema.parse({ ...req.query, systemId });

  const data = await telemetryService.getHistoricalTelemetry(query);

  res.status(200).json({
    success: true,
    data,
    meta: {
      count: data.length,
      resolution: query.resolution,
      startDate: query.startDate,
      endDate: query.endDate,
    },
  });
});

/**
 * Get cell data for a system
 * GET /api/v1/telemetry/:systemId/cells
 */
export const getCellData = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const cells = await telemetryService.getCellData(systemId);

  res.status(200).json({
    success: true,
    data: cells,
  });
});

/**
 * Get telemetry for date range (for charts)
 * GET /api/v1/telemetry/:systemId/range
 */
export const getTelemetryRange = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const resolution = (req.query.resolution as string) || '5m';

  const data = await telemetryService.getHistoricalTelemetry({
    systemId,
    startDate,
    endDate,
    resolution: resolution as '1m' | '5m' | '15m' | '1h' | '1d',
  });

  // Format data for charts
  const chartData = {
    timestamps: data.map(d => d.timestamp),
    soc: data.map(d => d.soc),
    voltage: data.map(d => d.totalVoltage),
    current: data.map(d => d.current),
    power: data.map(d => d.power),
    temperature: {
      min: data.map(d => d.temperature.min),
      max: data.map(d => d.temperature.max),
      avg: data.map(d => d.temperature.average),
    },
  };

  res.status(200).json({
    success: true,
    data: chartData,
    meta: {
      count: data.length,
      startDate,
      endDate,
      resolution,
    },
  });
});

/**
 * Get SOC history (for charts)
 * GET /api/v1/telemetry/:systemId/soc
 */
export const getSocHistory = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const period = (req.query.period as string) || '24h';

  // Calculate date range based on period
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setHours(startDate.getHours() - 24);
  }

  const resolution = period === '24h' ? '5m' : period === '7d' ? '1h' : '1d';

  const data = await telemetryService.getHistoricalTelemetry({
    systemId,
    startDate,
    endDate,
    resolution: resolution as '5m' | '1h' | '1d',
  });

  res.status(200).json({
    success: true,
    data: data.map(d => ({
      timestamp: d.timestamp,
      soc: d.soc,
    })),
    meta: {
      period,
      count: data.length,
    },
  });
});

/**
 * Get power/energy statistics
 * GET /api/v1/telemetry/:systemId/energy
 */
export const getEnergyStats = asyncHandler(async (req: Request, res: Response) => {
  const { systemId } = req.params;
  const { startDate, endDate } = dateRangeSchema.parse(req.query);

  const data = await telemetryService.getHistoricalTelemetry({
    systemId,
    startDate,
    endDate,
    resolution: '1h',
  });

  // Calculate energy statistics
  let energyCharged = 0;
  let energyDischarged = 0;

  for (const point of data) {
    const energyKwh = Math.abs(point.power) / 1000; // Convert W to kWh

    if (point.isCharging) {
      energyCharged += energyKwh;
    } else if (point.isDischarging) {
      energyDischarged += energyKwh;
    }
  }

  const efficiency = energyCharged > 0
    ? (energyDischarged / energyCharged) * 100
    : 0;

  res.status(200).json({
    success: true,
    data: {
      energyCharged: Math.round(energyCharged * 100) / 100,
      energyDischarged: Math.round(energyDischarged * 100) / 100,
      netEnergy: Math.round((energyCharged - energyDischarged) * 100) / 100,
      efficiency: Math.round(efficiency * 10) / 10,
      period: {
        start: startDate,
        end: endDate,
      },
    },
  });
});
