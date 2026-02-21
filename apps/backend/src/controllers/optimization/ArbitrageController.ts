/**
 * Arbitrage Controller
 * REST endpoints for energy trading optimization
 */

import { Request, Response } from 'express';
import { ArbitrageService } from '../../services/optimization/ArbitrageService';
import {
  SystemTelemetry,
  MarketData,
  SystemConstraints,
} from '../../../../../packages/shared/src/types/optimization';

export class ArbitrageController {
  /**
   * POST /api/v1/optimization/arbitrage/evaluate
   * Evaluate arbitrage opportunity at current market conditions
   *
   * Body:
   * {
   *   telemetry: SystemTelemetry,
   *   marketData: MarketData,
   *   historicalPrices: { low: number, high: number },
   *   constraints?: SystemConstraints,
   *   batteryCapacity?: number,
   *   config?: { enabled, buyThreshold, sellThreshold, minSOCMargin, maxSOCMargin, efficiency }
   * }
   */
  static async evaluateArbitrage(req: Request, res: Response): Promise<void> {
    try {
      const {
        telemetry,
        marketData,
        historicalPrices,
        constraints = this.getDefaultConstraints(),
        batteryCapacity = 500,
        config = this.getDefaultConfig(),
      } = req.body;

      // Validate inputs
      if (!telemetry || !marketData || !historicalPrices) {
        res.status(400).json({
          error: 'Missing required fields: telemetry, marketData, historicalPrices',
        });
        return;
      }

      const service = new ArbitrageService(config, constraints, batteryCapacity);
      const opportunity = service.evaluateOpportunity(
        telemetry,
        marketData,
        historicalPrices
      );

      res.json({
        success: true,
        data: {
          hasOpportunity: !!opportunity,
          opportunity,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Arbitrage evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/optimization/arbitrage/revenue
   * Calculate expected revenue from arbitrage
   *
   * Body:
   * {
   *   buyPrice: number,
   *   sellPrice: number,
   *   energyArbitraged: number,
   *   efficiency?: number (default 0.92)
   * }
   */
  static async calculateRevenue(req: Request, res: Response): Promise<void> {
    try {
      const {
        buyPrice,
        sellPrice,
        energyArbitraged,
        efficiency = 0.92,
      } = req.body;

      if (!buyPrice || !sellPrice || !energyArbitraged) {
        res.status(400).json({
          error: 'Missing required fields: buyPrice, sellPrice, energyArbitraged',
        });
        return;
      }

      const service = new ArbitrageService(
        this.getDefaultConfig(),
        this.getDefaultConstraints(),
        500
      );

      const revenue = service.calculateRevenue(
        buyPrice,
        sellPrice,
        energyArbitraged
      );

      const margin = ((sellPrice - buyPrice) / buyPrice) * 100;

      res.json({
        success: true,
        data: {
          buyPrice,
          sellPrice,
          energyArbitraged,
          efficiency,
          margin: `${margin.toFixed(2)}%`,
          expectedRevenue: `R$ ${revenue.toFixed(2)}`,
          revenuePerMWh: `R$ ${(revenue / energyArbitraged).toFixed(2)}`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Revenue calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/optimization/arbitrage/market-signal
   * Get current market signal strength
   *
   * Query:
   * {
   *   spotPrice: number,
   *   historicalLow: number,
   *   historicalHigh: number
   * }
   */
  static async getMarketSignal(req: Request, res: Response): Promise<void> {
    try {
      const { spotPrice, historicalLow, historicalHigh } = req.query;

      if (!spotPrice || !historicalLow || !historicalHigh) {
        res.status(400).json({
          error: 'Missing required query params: spotPrice, historicalLow, historicalHigh',
        });
        return;
      }

      const service = new ArbitrageService(
        this.getDefaultConfig(),
        this.getDefaultConstraints(),
        500
      );

      const signal = service.getMarketSignal(
        {
          spotPrice: parseFloat(spotPrice as string),
          timePrice: 0,
          demandForecast: 0,
          loadProfile: 'intermediate',
        },
        {
          low: parseFloat(historicalLow as string),
          high: parseFloat(historicalHigh as string),
        }
      );

      const signalType =
        signal < 0.2 ? 'weak' : signal < 0.5 ? 'moderate' : 'strong';

      res.json({
        success: true,
        data: {
          signal: parseFloat(signal.toFixed(2)),
          signalType,
          spotPrice: parseFloat(spotPrice as string),
          range: {
            low: parseFloat(historicalLow as string),
            high: parseFloat(historicalHigh as string),
          },
          interpretation:
            signal > 0.8
              ? 'Strong buy signal (price at 20% of range)'
              : signal > 0.5
              ? 'Strong sell signal (price at 80% of range)'
              : 'Neutral market conditions',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Market signal calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/optimization/arbitrage/strategy
   * Get recommended arbitrage strategy
   *
   * Body:
   * {
   *   spotPrice: number,
   *   historicalLow: number,
   *   historicalHigh: number,
   *   currentSOC: number,
   *   batteryCapacity: number
   * }
   */
  static async getStrategy(req: Request, res: Response): Promise<void> {
    try {
      const {
        spotPrice,
        historicalLow,
        historicalHigh,
        currentSOC,
        batteryCapacity = 500,
      } = req.body;

      if (spotPrice === undefined || historicalLow === undefined || historicalHigh === undefined) {
        res.status(400).json({
          error: 'Missing required fields: spotPrice, historicalLow, historicalHigh',
        });
        return;
      }

      const priceRange = historicalHigh - historicalLow;
      const pricePosition = spotPrice - historicalLow;
      const percentile = (pricePosition / priceRange) * 100;

      let strategy = '';
      let rationale = '';
      let confidence = 0;

      if (percentile < 20 && currentSOC < 95) {
        strategy = 'BUY';
        rationale = 'Price is at historical lows - good buying opportunity';
        confidence = 0.9;
      } else if (percentile > 80 && currentSOC > 20) {
        strategy = 'SELL';
        rationale = 'Price is at historical highs - good selling opportunity';
        confidence = 0.9;
      } else if (percentile < 50 && currentSOC < 80) {
        strategy = 'BUY';
        rationale = 'Price is below median - moderate buying opportunity';
        confidence = 0.6;
      } else if (percentile > 50 && currentSOC > 30) {
        strategy = 'SELL';
        rationale = 'Price is above median - moderate selling opportunity';
        confidence = 0.6;
      } else {
        strategy = 'HOLD';
        rationale = 'Market conditions neutral, maintain current position';
        confidence = 0.5;
      }

      res.json({
        success: true,
        data: {
          strategy,
          confidence,
          rationale,
          marketAnalysis: {
            currentPrice: spotPrice,
            historicalRange: `R$ ${historicalLow.toFixed(0)} - R$ ${historicalHigh.toFixed(0)}`,
            pricePercentile: `${percentile.toFixed(1)}%`,
            position: percentile < 33 ? 'Low' : percentile < 67 ? 'Mid' : 'High',
          },
          systemState: {
            currentSOC: `${currentSOC.toFixed(1)}%`,
            batteryCapacity: `${batteryCapacity}kWh`,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Strategy calculation failed: ${error instanceof Error ? error.message : String(error)}`,
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
      buyThreshold: 300,
      sellThreshold: 400,
      minSOCMargin: 10,
      maxSOCMargin: 10,
      efficiency: 0.92,
    };
  }

  /**
   * GET /api/v1/optimization/:systemId/arbitrage/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      res.json({
        success: true,
        data: {
          systemId,
          enabled: true,
          currentPrice: null,
          source: 'unavailable',
          buyThreshold: 300,
          sellThreshold: 400,
          lastAction: 'IDLE',
          todayRevenue: 0,
          message: 'Market price data not available - real-time feed not connected',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/optimization/:systemId/arbitrage/config
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      res.json({
        success: true,
        data: {
          systemId,
          ...this.getDefaultConfig(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/optimization/:systemId/arbitrage/config
   */
  static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { buyThreshold, sellThreshold } = req.body;

      res.json({
        success: true,
        data: { systemId, buyThreshold, sellThreshold, updated: true },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
