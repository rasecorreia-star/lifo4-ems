/**
 * Peak Shaving Controller
 * REST endpoints for demand management
 */

import { Request, Response } from 'express';
import { PeakShavingService } from '../../services/optimization/PeakShavingService';
import {
  SystemTelemetry,
  MarketData,
  SystemConstraints,
} from '../../../../../packages/shared/src/types/optimization';

export class PeakShavingController {
  /**
   * POST /api/v1/optimization/peak-shaving/evaluate
   * Evaluate if peak shaving is needed
   *
   * Body:
   * {
   *   telemetry: SystemTelemetry,
   *   marketData: MarketData,
   *   currentHour: number,
   *   constraints?: SystemConstraints,
   *   batteryCapacity?: number,
   *   config?: { enabled, demandLimit, triggerThreshold, ... },
   *   tariff?: { demandChargePerkW, peakHours, seasonalFactor }
   * }
   */
  static async evaluatePeakShaving(req: Request, res: Response): Promise<void> {
    try {
      const {
        telemetry,
        marketData,
        currentHour,
        constraints = this.getDefaultConstraints(),
        batteryCapacity = 500,
        config = this.getDefaultConfig(),
        tariff = this.getDefaultTariff(),
      } = req.body;

      if (!telemetry || !marketData || currentHour === undefined) {
        res.status(400).json({
          error: 'Missing required fields: telemetry, marketData, currentHour',
        });
        return;
      }

      const service = new PeakShavingService(
        config,
        constraints,
        tariff,
        batteryCapacity
      );

      const event = service.evaluatePeakShavingNeed(
        telemetry,
        marketData,
        currentHour
      );

      res.json({
        success: true,
        data: {
          needsPeakShaving: !!event,
          event,
          currentHour,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Peak shaving evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/optimization/peak-shaving/demand-charge-savings
   * Calculate demand charge savings from peak shaving
   *
   * Body:
   * {
   *   peakReduction: number (kW),
   *   tariff?: { demandChargePerkW, seasonalFactor }
   * }
   */
  static async calculateSavings(req: Request, res: Response): Promise<void> {
    try {
      const {
        peakReduction,
        tariff = this.getDefaultTariff(),
      } = req.body;

      if (peakReduction === undefined) {
        res.status(400).json({
          error: 'Missing required field: peakReduction',
        });
        return;
      }

      const service = new PeakShavingService(
        this.getDefaultConfig(),
        this.getDefaultConstraints(),
        tariff,
        500
      );

      const savings = service.calculateDemandChargeSavings(peakReduction);

      res.json({
        success: true,
        data: {
          peakReduction: `${peakReduction.toFixed(1)} kW`,
          monthlySavings: `R$ ${savings.toFixed(2)}`,
          annualSavings: `R$ ${(savings * 12).toFixed(2)}`,
          tariffInfo: {
            demandCharge: `R$ ${tariff.demandChargePerkW}/kW/month`,
            seasonalFactor: tariff.seasonalFactor,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Savings calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/optimization/peak-shaving/compliance
   * Calculate compliance rate with demand reduction target
   *
   * Body:
   * {
   *   demandForecast: number,
   *   actualDemand: number,
   *   complianceTarget?: number (default 85%)
   * }
   */
  static async calculateCompliance(req: Request, res: Response): Promise<void> {
    try {
      const {
        demandForecast,
        actualDemand,
        complianceTarget = 85,
      } = req.body;

      if (demandForecast === undefined || actualDemand === undefined) {
        res.status(400).json({
          error: 'Missing required fields: demandForecast, actualDemand',
        });
        return;
      }

      const config = { ...this.getDefaultConfig(), complianceTarget };
      const service = new PeakShavingService(
        config,
        this.getDefaultConstraints(),
        this.getDefaultTariff(),
        500
      );

      const compliance = service.calculateComplianceRate(
        demandForecast,
        actualDemand
      );

      const status =
        compliance >= complianceTarget
          ? 'Compliant'
          : compliance >= 70
          ? 'Partially Compliant'
          : 'Non-Compliant';

      res.json({
        success: true,
        data: {
          demandForecast: `${demandForecast.toFixed(1)} kW`,
          actualDemand: `${actualDemand.toFixed(1)} kW`,
          reduction: `${(demandForecast - actualDemand).toFixed(1)} kW`,
          complianceRate: `${compliance.toFixed(1)}%`,
          complianceTarget: `${complianceTarget}%`,
          status,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Compliance calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/optimization/peak-shaving/roi
   * Calculate ROI of peak shaving investment
   *
   * Body:
   * {
   *   batteryInvestmentCost: number,
   *   peakReductionCapability: number,
   *   operatingCosts?: number,
   *   peakDaysPerYear?: number
   * }
   */
  static async calculateROI(req: Request, res: Response): Promise<void> {
    try {
      const {
        batteryInvestmentCost,
        peakReductionCapability,
        operatingCosts = 5000,
        peakDaysPerYear = 120,
      } = req.body;

      if (batteryInvestmentCost === undefined || peakReductionCapability === undefined) {
        res.status(400).json({
          error: 'Missing required fields: batteryInvestmentCost, peakReductionCapability',
        });
        return;
      }

      const tariff = this.getDefaultTariff();
      const service = new PeakShavingService(
        this.getDefaultConfig(),
        this.getDefaultConstraints(),
        tariff,
        500
      );

      const annualSavings = service.estimateAnnualBenefit(
        peakReductionCapability,
        peakDaysPerYear
      );

      const roi = service.calculateROI(
        annualSavings,
        batteryInvestmentCost,
        operatingCosts
      );

      res.json({
        success: true,
        data: {
          investment: `R$ ${batteryInvestmentCost.toFixed(2)}`,
          peakReductionCapability: `${peakReductionCapability.toFixed(1)} kW`,
          annualSavings: `R$ ${annualSavings.toFixed(2)}`,
          operatingCosts: `R$ ${operatingCosts.toFixed(2)}`,
          netAnnualBenefit: `R$ ${(annualSavings - operatingCosts).toFixed(2)}`,
          paybackPeriod: `${roi.paybackPeriodMonths.toFixed(1)} months`,
          annualROI: `${roi.annualROI.toFixed(1)}%`,
          totalSavings10Years: `R$ ${roi.totalSavings10Years.toFixed(2)}`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `ROI calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/optimization/peak-shaving/tariff
   * Get tariff information for current hour
   *
   * Query:
   * {
   *   hour?: number (default current hour)
   * }
   */
  static async getTariffInfo(req: Request, res: Response): Promise<void> {
    try {
      const hour = req.query.hour
        ? parseInt(req.query.hour as string)
        : new Date().getHours();

      if (hour < 0 || hour > 23) {
        res.status(400).json({
          error: 'Invalid hour: must be 0-23',
        });
        return;
      }

      const tariff = this.getDefaultTariff();
      const isPeakHour =
        hour >= tariff.peakHours.start && hour < tariff.peakHours.end;

      const periods = {
        peak: { hours: '17:00-22:00', factor: 1.5, description: 'Peak tariff' },
        intermediate: {
          hours: '07:00-17:00, 22:00-23:00',
          factor: 1.0,
          description: 'Intermediate tariff',
        },
        offPeak: {
          hours: '23:00-07:00',
          factor: 0.5,
          description: 'Off-peak tariff',
        },
      };

      let currentPeriod = 'offPeak';
      if (hour >= 17 && hour < 22) {
        currentPeriod = 'peak';
      } else if ((hour >= 7 && hour < 17) || hour === 22) {
        currentPeriod = 'intermediate';
      }

      res.json({
        success: true,
        data: {
          currentHour: hour,
          currentPeriod,
          isPeakHour,
          tariffInfo: periods,
          demandChargePerkW: `R$ ${tariff.demandChargePerkW}/kW/month`,
          seasonalFactor: tariff.seasonalFactor,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Tariff info retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private static getDefaultConstraints(): SystemConstraints {
    return {
      maxTemperature: 55,
      minSOC: 10,
      maxSOC: 95,
      maxCurrent: 300,
      minCellVoltage: 2.5,
      maxCellVoltage: 3.65,
      maxPower: 200,
      minPower: 10,
      responseTime: 100,
      frequencyDeadband: 0.5,
      voltageDeadband: 30,
    };
  }

  private static getDefaultConfig() {
    return {
      enabled: true,
      demandLimit: 500,
      triggerThreshold: 80,
      minSOCMargin: 10,
      complianceTarget: 85,
      maxReductionCapability: 80,
    };
  }

  private static getDefaultTariff() {
    return {
      demandChargePerkW: 25, // R$/kW/month
      peakHours: { start: 17, end: 22 }, // 17:00-22:00
      seasonalFactor: 1.0, // Normal season
    };
  }

  /**
   * GET /api/v1/optimization/:systemId/peak-shaving/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      res.json({
        success: true,
        data: {
          systemId,
          enabled: true,
          peakActive: true,
          currentDemand: 450,
          demandLimit: 500,
          shavingRequired: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/optimization/:systemId/peak-shaving/config
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      res.json({
        success: true,
        data: { systemId, ...this.getDefaultConfig() },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/optimization/:systemId/peak-shaving/config
   */
  static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { demandLimit, triggerThreshold } = req.body;
      res.json({
        success: true,
        data: { systemId, demandLimit, triggerThreshold, updated: true },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
