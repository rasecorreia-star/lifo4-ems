/**
 * Telemetry Controller
 * Handles telemetry data endpoints — with Zod input validation
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { TelemetryProcessor, RawTelemetryData } from '../services/telemetry/TelemetryProcessor.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const systemIdSchema = z
  .string()
  .min(1, 'systemId is required')
  .max(100, 'systemId too long')
  .regex(/^[\w-]+$/, 'systemId must be alphanumeric with hyphens only');

const historyQuerySchema = z.object({
  hours: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 24))
    .pipe(z.number().int().min(1).max(8760)), // 1h to 1 year
});

const ingestBodySchema = z.object({
  voltage: z.number().min(0).max(10_000),
  current: z.number().min(-10_000).max(10_000),
  soc: z.number().min(0).max(100),
  soh: z.number().min(0).max(100).optional(),
  temperature: z.number().min(-50).max(150),
  power: z.number().optional(),
  cellVoltages: z.array(z.number().min(0).max(10)).max(500).optional(),
  timestamp: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class TelemetryController {
  /**
   * GET /api/v1/telemetry/:systemId/latest
   */
  static async getLatest(req: Request, res: Response) {
    const systemIdResult = systemIdSchema.safeParse(req.params.systemId);
    if (!systemIdResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: systemIdResult.error.errors,
      });
    }

    const { systemId } = req.params;

    try {
      // TODO: Replace with real database query (InfluxDB latest point)
      const mockTelemetry = {
        systemId,
        soc: 65,
        soh: 96,
        temperature: 32,
        voltage: 800,
        current: 150,
        power: 120,
        timestamp: new Date(),
      };

      return res.json({
        success: true,
        data: mockTelemetry,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get latest telemetry', {
        systemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve telemetry data',
      });
    }
  }

  /**
   * GET /api/v1/telemetry/:systemId/history?hours=24
   */
  static async getHistory(req: Request, res: Response) {
    const systemIdResult = systemIdSchema.safeParse(req.params.systemId);
    if (!systemIdResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: systemIdResult.error.errors,
      });
    }

    const queryResult = historyQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: queryResult.error.errors,
      });
    }

    const { systemId } = req.params;
    const { hours } = queryResult.data;

    try {
      // TODO: Replace with InfluxDB range query
      const mockHistory = Array.from({ length: hours }, (_, i) => ({
        timestamp: new Date(Date.now() - (hours - i) * 3_600_000),
        soc: 50 + Math.sin(i / 24) * 15,
        soh: 96,
        temperature: 30 + Math.sin(i / 24) * 5,
        voltage: 800 + Math.cos(i / 24) * 50,
        current: Math.sin(i / 24) * 200,
        power: Math.sin(i / 24) * 150,
      }));

      return res.json({
        success: true,
        data: mockHistory,
        count: mockHistory.length,
        hours,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get telemetry history', {
        systemId,
        hours,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve telemetry history',
      });
    }
  }

  /**
   * POST /api/v1/telemetry/:systemId/ingest
   */
  static async ingestTelemetry(req: Request, res: Response) {
    const systemIdResult = systemIdSchema.safeParse(req.params.systemId);
    if (!systemIdResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: systemIdResult.error.errors,
      });
    }

    const bodyResult = ingestBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: bodyResult.error.errors,
      });
    }

    const { systemId } = req.params;
    const rawData = bodyResult.data as RawTelemetryData;

    try {
      const processor = new TelemetryProcessor(systemId);
      const telemetry = processor.processar(rawData);

      const validation = processor.validar(telemetry);
      if (!validation.valid) {
        return res.status(422).json({
          error: 'Telemetry Validation Failed',
          details: validation.errors,
        });
      }

      logger.info('Telemetry ingested', { systemId, soc: rawData.soc, power: rawData.power });

      // TODO: Persist to InfluxDB

      return res.json({
        success: true,
        data: telemetry,
        message: 'Telemetry data ingested successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Telemetry ingest failed', {
        systemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to ingest telemetry data',
      });
    }
  }
}
