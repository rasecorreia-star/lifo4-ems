/**
 * Telemetry Controller
 * Handles telemetry data endpoints
 */

import { Request, Response } from 'express';
import { TelemetryProcessor, RawTelemetryData } from '../services/telemetry/TelemetryProcessor';

export class TelemetryController {
  /**
   * GET /api/v1/telemetry/:systemId/latest
   * Get latest telemetry reading for a system
   */
  static async getLatest(req: Request, res: Response) {
    try {
      const { systemId } = req.params;

      // TODO: Replace with database query
      // For now, return mock data
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

      res.json({
        success: true,
        data: mockTelemetry,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/v1/telemetry/:systemId/history
   * Get telemetry history for a system
   * Query: ?hours=24 (default 24)
   */
  static async getHistory(req: Request, res: Response) {
    try {
      const { systemId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;

      // TODO: Replace with database query for historical data
      // For now, return mock data
      const mockHistory = Array.from({ length: hours }, (_, i) => ({
        timestamp: new Date(Date.now() - (hours - i) * 3600000),
        soc: 50 + Math.sin(i / 24) * 15,
        soh: 96,
        temperature: 30 + Math.sin(i / 24) * 5,
        voltage: 800 + Math.cos(i / 24) * 50,
        current: Math.sin(i / 24) * 200,
        power: Math.sin(i / 24) * 150,
      }));

      res.json({
        success: true,
        data: mockHistory,
        count: mockHistory.length,
        hours,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/v1/telemetry/:systemId/ingest
   * Ingest raw telemetry data from hardware
   * Body: RawTelemetryData
   */
  static async ingestTelemetry(req: Request, res: Response) {
    try {
      const { systemId } = req.params;
      const rawData = req.body as RawTelemetryData;

      const processor = new TelemetryProcessor(systemId);

      // Process raw data
      const telemetry = processor.processar(rawData);

      // Validate
      const validation = processor.validar(telemetry);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Telemetry validation failed',
          details: validation.errors,
        });
      }

      // TODO: Save to database
      console.log(`[Telemetry] Ingested data for ${systemId}:`, telemetry);

      return res.json({
        success: true,
        data: telemetry,
        message: 'Telemetry data ingested successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
