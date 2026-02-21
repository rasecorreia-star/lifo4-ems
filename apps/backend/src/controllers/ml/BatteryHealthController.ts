/**
 * Battery Health Controller
 * REST endpoints for SOH monitoring and degradation tracking
 */

import { Request, Response } from 'express';
import { BatteryHealthService } from '../../services/ml/BatteryHealthService';

export class BatteryHealthController {
  /**
   * POST /api/v1/ml/battery-health/calculate-soh
   * Calculate current State of Health
   *
   * Body:
   * {
   *   currentCapacity: number (kWh),
   *   nominalCapacity: number (kWh)
   * }
   */
  static async calculateSOH(req: Request, res: Response): Promise<void> {
    try {
      const { currentCapacity, nominalCapacity } = req.body;

      if (currentCapacity === undefined || nominalCapacity === undefined) {
        res.status(400).json({
          error: 'Missing required fields: currentCapacity, nominalCapacity',
        });
        return;
      }

      const service = new BatteryHealthService();
      const soh = service.calculateSOH(currentCapacity, nominalCapacity);

      const status =
        soh > 90
          ? 'Excellent'
          : soh > 80
          ? 'Good'
          : soh > 70
          ? 'Fair'
          : soh > 50
          ? 'Poor'
          : 'Critical';

      res.json({
        success: true,
        data: {
          currentCapacity,
          nominalCapacity,
          soh: `${soh.toFixed(2)}%`,
          status,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `SOH calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/battery-health/estimate-degradation
   * Estimate degradation from temperature and cycling
   *
   * Body:
   * {
   *   cycleCount: number,
   *   operatingHoursPerDay: number,
   *   averageTemperature: number (°C),
   *   daysOfOperation: number
   * }
   */
  static async estimateDegradation(req: Request, res: Response): Promise<void> {
    try {
      const {
        cycleCount,
        operatingHoursPerDay,
        averageTemperature,
        daysOfOperation,
      } = req.body;

      if (
        cycleCount === undefined ||
        operatingHoursPerDay === undefined ||
        averageTemperature === undefined ||
        daysOfOperation === undefined
      ) {
        res.status(400).json({
          error:
            'Missing fields: cycleCount, operatingHoursPerDay, averageTemperature, daysOfOperation',
        });
        return;
      }

      const service = new BatteryHealthService();

      const calendarDeg = service.estimateDegradationFromTemperature(
        operatingHoursPerDay,
        averageTemperature,
        daysOfOperation
      );

      const cyclicDeg = service.estimateDegradationFromCycles(cycleCount);
      const totalDeg = calendarDeg + cyclicDeg;

      res.json({
        success: true,
        data: {
          cycleCount,
          daysOfOperation,
          averageTemperature: `${averageTemperature}°C`,
          calendarDegradation: `${(calendarDeg * 100).toFixed(3)}%`,
          cyclicDegradation: `${(cyclicDeg * 100).toFixed(3)}%`,
          totalDegradation: `${(totalDeg * 100).toFixed(3)}%`,
          breakdown: {
            calendarPercent: `${(calendarDeg / totalDeg * 100).toFixed(1)}%`,
            cyclicPercent: `${(cyclicDeg / totalDeg * 100).toFixed(1)}%`,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Degradation estimation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/battery-health/remaining-life
   * Estimate remaining useful life
   *
   * Body:
   * {
   *   currentSOH: number (%),
   *   cycleCount: number,
   *   maxCycles: number,
   *   monthlyDegradationRate?: number (default 0.002 = 0.2%)
   * }
   */
  static async estimateRemainingLife(req: Request, res: Response): Promise<void> {
    try {
      const {
        currentSOH,
        cycleCount,
        maxCycles,
        monthlyDegradationRate = 0.002,
      } = req.body;

      if (
        currentSOH === undefined ||
        cycleCount === undefined ||
        maxCycles === undefined
      ) {
        res.status(400).json({
          error:
            'Missing required fields: currentSOH, cycleCount, maxCycles',
        });
        return;
      }

      const service = new BatteryHealthService();

      const rul = service.estimateRemainingLife(
        currentSOH,
        cycleCount,
        maxCycles,
        monthlyDegradationRate
      );

      const years = rul.estimatedMonths / 12;

      res.json({
        success: true,
        data: {
          currentSOH: `${currentSOH.toFixed(1)}%`,
          estimatedMonths: `${rul.estimatedMonths.toFixed(1)} months`,
          estimatedYears: `${years.toFixed(2)} years`,
          estimatedCycles: rul.estimatedCycles,
          cycleUtilization: `${(cycleCount / maxCycles * 100).toFixed(1)}%`,
          confidence: `${(rul.confidence * 100).toFixed(1)}%`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `RUL estimation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/battery-health/report
   * Generate comprehensive health report
   *
   * Body: (all BatteryHealthService.generateHealthReport params)
   */
  static async generateHealthReport(req: Request, res: Response): Promise<void> {
    try {
      const {
        systemId,
        nominalCapacity,
        currentCapacity,
        cycleCount,
        maxCycles,
        operatingHoursPerDay,
        averageTemperature,
        daysOfOperation,
        warrantyEndDate,
      } = req.body;

      if (!systemId || nominalCapacity === undefined || currentCapacity === undefined) {
        res.status(400).json({
          error: 'Missing required fields: systemId, nominalCapacity, currentCapacity',
        });
        return;
      }

      const service = new BatteryHealthService();

      const report = service.generateHealthReport(
        systemId,
        nominalCapacity,
        currentCapacity,
        cycleCount || 0,
        maxCycles || 6000,
        operatingHoursPerDay || 12,
        averageTemperature || 30,
        daysOfOperation || 365,
        new Date(warrantyEndDate || new Date().getTime() + 5 * 365 * 24 * 60 * 60 * 1000)
      );

      const healthScore = service.getHealthScore(
        report.soh,
        report.cycleCount,
        report.maxCycles,
        daysOfOperation / 30
      );

      res.json({
        success: true,
        data: {
          ...report,
          healthScore: `${healthScore}/100`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Report generation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/battery-health/warranty/:systemId
   * Check warranty status
   *
   * Query:
   * {
   *   soh?: number,
   *   currentCapacity?: number,
   *   nominalCapacity?: number
   * }
   */
  static async checkWarrantyStatus(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const soh = req.query.soh
        ? parseFloat(req.query.soh as string)
        : parseFloat(
            ((parseFloat(req.query.currentCapacity as string) /
              parseFloat(req.query.nominalCapacity as string)) *
            100).toFixed(2)
          );

      if (!systemId || soh === undefined || isNaN(soh)) {
        res.status(400).json({
          error: 'Missing required params: systemId, and either soh or (currentCapacity/nominalCapacity)',
        });
        return;
      }

      const warrantyEndDate = new Date();
      warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + 5);

      const service = new BatteryHealthService();
      const status = service.checkWarrantyStatus(
        soh,
        80, // Target 80% SOH
        warrantyEndDate
      );

      res.json({
        success: true,
        data: {
          systemId,
          soh: `${soh.toFixed(1)}%`,
          warrantyTargetSOH: '80%',
          warrantyEndDate: warrantyEndDate.toISOString().split('T')[0],
          status,
          statusDescription:
            status === 'active'
              ? 'Warranty is active and healthy'
              : status === 'expiring_soon'
              ? 'Warranty expiring in less than 90 days or SOH approaching threshold'
              : 'Warranty expired',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Warranty check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/battery-health/cost-of-degradation
   * Calculate cost of degradation
   *
   * Body:
   * {
   *   degradationPercent: number,
   *   batteryCapacityKWh: number,
   *   costPerKWh?: number (default 8000)
   * }
   */
  static async calculateDegradationCost(req: Request, res: Response): Promise<void> {
    try {
      const {
        degradationPercent,
        batteryCapacityKWh,
        costPerKWh = 8000,
      } = req.body;

      if (degradationPercent === undefined || batteryCapacityKWh === undefined) {
        res.status(400).json({
          error: 'Missing required fields: degradationPercent, batteryCapacityKWh',
        });
        return;
      }

      const service = new BatteryHealthService();

      const cost = service.calculateDegradationCost(
        degradationPercent,
        batteryCapacityKWh,
        costPerKWh
      );

      res.json({
        success: true,
        data: {
          degradationPercent: `${degradationPercent.toFixed(2)}%`,
          batteryCapacity: `${batteryCapacityKWh}kWh`,
          lostCapacity: `${cost.lostCapacityKWh.toFixed(1)}kWh`,
          costPerKWh: `R$ ${costPerKWh}`,
          estimatedCost: `R$ ${cost.estimatedCostR.toFixed(2)}`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Cost calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/:systemId/battery/health
   * Get battery health status for a system
   */
  static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      // Mock data for now
      const health = {
        soh: 96,
        soc: 65,
        temperature: 32,
        health_score: 96,
        status: 'healthy',
        cycles: 1200,
        estimated_life_years: 8.5,
      };

      res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
