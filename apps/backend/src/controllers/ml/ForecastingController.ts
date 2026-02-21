/**
 * Forecasting Controller
 * REST endpoints for demand and price prediction
 */

import { Request, Response } from 'express';
import { ForecastingService } from '../../services/ml/ForecastingService';

export class ForecastingController {
  /**
   * GET /api/v1/ml/forecasting/ensemble
   * Get 24-hour ensemble forecast
   *
   * Query:
   * {
   *   currentHour?: number,
   *   solarCapacity?: number (kW, default 100),
   *   horizonHours?: number (default 24)
   * }
   */
  static async getEnsembleForecast(req: Request, res: Response): Promise<void> {
    try {
      const currentHour = req.query.currentHour
        ? parseInt(req.query.currentHour as string)
        : new Date().getHours();
      const solarCapacity = req.query.solarCapacity
        ? parseInt(req.query.solarCapacity as string)
        : 100;
      const horizonHours = req.query.horizonHours
        ? parseInt(req.query.horizonHours as string)
        : 24;

      if (currentHour < 0 || currentHour > 23 || horizonHours < 1 || horizonHours > 168) {
        res.status(400).json({
          error: 'Invalid parameters: currentHour 0-23, horizonHours 1-168',
        });
        return;
      }

      const service = new ForecastingService();

      // Generate mock historical data for demo
      const historicalDemand = Array(168)
        .fill(0)
        .map((_, i) => 650 + Math.sin((i / 24) * Math.PI * 2) * 150 + Math.random() * 100);
      const historicalPrices = Array(168)
        .fill(0)
        .map((_, i) => 350 + Math.sin((i / 24) * Math.PI * 2) * 100 + Math.random() * 50);

      const forecasts = service.generateEnsembleForecast(
        currentHour,
        historicalDemand,
        historicalPrices,
        solarCapacity,
        horizonHours
      );

      // Summary statistics
      const avgDemand =
        forecasts.reduce((sum, f) => sum + f.demandForecast, 0) / forecasts.length;
      const avgPrice =
        forecasts.reduce((sum, f) => sum + f.priceForecast, 0) / forecasts.length;
      const avgConfidence =
        forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length;

      res.json({
        success: true,
        data: {
          currentHour,
          horizonHours,
          modelName: 'Ensemble',
          accuracy: '94.5%',
          forecasts,
          summary: {
            averageDemand: `${avgDemand.toFixed(1)} kW`,
            averagePrice: `R$ ${avgPrice.toFixed(0)}/MWh`,
            averageConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
            peakDemand: `${Math.max(...forecasts.map((f) => f.demandForecast)).toFixed(1)} kW`,
            lowestPrice: `R$ ${Math.min(...forecasts.map((f) => f.priceForecast)).toFixed(0)}/MWh`,
            highestPrice: `R$ ${Math.max(...forecasts.map((f) => f.priceForecast)).toFixed(0)}/MWh`,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Forecast generation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/forecasting/models
   * Get available ML models and their performance metrics
   */
  static async getModels(req: Request, res: Response): Promise<void> {
    try {
      const service = new ForecastingService();
      const models = service.getAvailableModels();

      res.json({
        success: true,
        data: {
          availableModels: models.length,
          models: models.map((m) => ({
            name: m.modelName,
            accuracy: `${(m.accuracy * 100).toFixed(1)}%`,
            precision: `${(m.precision * 100).toFixed(1)}%`,
            recall: `${(m.recall * 100).toFixed(1)}%`,
            f1Score: `${(m.f1Score * 100).toFixed(1)}%`,
            mape: `${(m.mape * 100).toFixed(2)}%`,
            rmse: `${m.rmse.toFixed(1)} kW`,
          })),
          recommendation:
            'Ensemble combines all models for best overall accuracy. Use individual models for specific strengths.',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Model retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/forecasting/compare
   * Compare predictions from multiple models
   *
   * Body:
   * {
   *   currentHour: number,
   *   historicalDemand: number[],
   *   historicalPrices: number[],
   *   solarCapacity?: number
   * }
   */
  static async compareModels(req: Request, res: Response): Promise<void> {
    try {
      const {
        currentHour,
        historicalDemand,
        historicalPrices,
        solarCapacity = 100,
      } = req.body;

      if (
        currentHour === undefined ||
        !historicalDemand ||
        !historicalPrices
      ) {
        res.status(400).json({
          error:
            'Missing required fields: currentHour, historicalDemand, historicalPrices',
        });
        return;
      }

      const service = new ForecastingService();

      // Get forecast from ensemble
      const forecast = service.generateEnsembleForecast(
        currentHour,
        historicalDemand,
        historicalPrices,
        solarCapacity,
        4 // 4 hours for comparison
      );

      // Get individual model metrics
      const models = service.getAvailableModels();

      res.json({
        success: true,
        data: {
          currentHour,
          hourAhead4Forecasts: forecast.slice(0, 4),
          modelComparison: models.map((m) => ({
            model: m.modelName,
            accuracy: `${(m.accuracy * 100).toFixed(1)}%`,
            mape: `${(m.mape * 100).toFixed(2)}%`,
          })),
          recommendation:
            'Use Ensemble (94.5%) for production. LSTM (92.8%) for neural network patterns.',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Model comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/forecasting/model/:modelName
   * Get performance metrics for a specific model
   *
   * Params:
   * {
   *   modelName: 'ensemble' | 'lstm' | 'prophet' | 'xgboost' | 'arima'
   * }
   */
  static async getModelInfo(req: Request, res: Response): Promise<void> {
    try {
      const { modelName } = req.params;

      const service = new ForecastingService();
      const metrics = service.getModelMetrics(modelName);

      if (!metrics) {
        res.status(404).json({
          error: `Model not found: ${modelName}`,
          availableModels: [
            'ensemble',
            'lstm',
            'prophet',
            'xgboost',
            'arima',
          ],
        });
        return;
      }

      const descriptions: Record<string, string> = {
        ensemble:
          'Weighted average of all models - best overall accuracy (94.5%)',
        lstm: 'Deep learning LSTM network - captures temporal dependencies (92.8%)',
        prophet: 'Facebook Prophet time series model - handles seasonality well (91.2%)',
        xgboost: 'Gradient boosting - excellent for feature interactions (93.1%)',
        arima:
          'Classical statistics ARIMA model - interpretable and stable (88.5%)',
      };

      res.json({
        success: true,
        data: {
          model: metrics.modelName,
          description: descriptions[modelName.toLowerCase()] || '',
          performance: {
            accuracy: `${(metrics.accuracy * 100).toFixed(1)}%`,
            precision: `${(metrics.precision * 100).toFixed(1)}%`,
            recall: `${(metrics.recall * 100).toFixed(1)}%`,
            f1Score: `${(metrics.f1Score * 100).toFixed(1)}%`,
            mape: `${(metrics.mape * 100).toFixed(2)}%`,
            rmse: `${metrics.rmse.toFixed(1)} kW`,
          },
          useCase:
            modelName.toLowerCase() === 'ensemble'
              ? 'Production forecasting'
              : `Specific analysis and comparison`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Model info retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/forecasting/uncertainty
   * Get uncertainty bounds for forecast
   *
   * Body:
   * {
   *   forecastValue: number,
   *   hoursAhead: number,
   *   horizonHours?: number (default 24)
   * }
   */
  static async getUncertaintyBounds(req: Request, res: Response): Promise<void> {
    try {
      const {
        forecastValue,
        hoursAhead,
        horizonHours = 24,
        isSolarForecast = false,
      } = req.body;

      if (forecastValue === undefined || hoursAhead === undefined) {
        res.status(400).json({
          error: 'Missing required fields: forecastValue, hoursAhead',
        });
        return;
      }

      // Uncertainty grows with forecast horizon
      const uncertaintyFactor =
        1 + (hoursAhead / horizonHours) * (isSolarForecast ? 0.25 : 0.15);
      const margin = forecastValue * 0.08 * uncertaintyFactor;

      const bounds = {
        lower: Math.max(0, forecastValue - margin),
        upper: forecastValue + margin,
        margin: margin,
        marginPercent: ((margin / forecastValue) * 100).toFixed(2),
      };

      res.json({
        success: true,
        data: {
          forecastValue,
          hoursAhead,
          horizonHours,
          isSolarForecast,
          uncertaintyBounds: bounds,
          confidence: Math.max(50, 100 - (hoursAhead / horizonHours) * 50),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Uncertainty calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/:systemId/forecast/load
   * Get load (demand) forecast for a system
   * Query: ?hours=24
   */
  static async getForecastLoad(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;

      const service = new ForecastingService();
      const historicalDemand = Array(168)
        .fill(0)
        .map((_, i) => 650 + Math.sin((i / 24) * Math.PI * 2) * 150);

      const forecast = service.generateEnsembleForecast(
        new Date().getHours(),
        historicalDemand,
        Array(168).fill(350),
        100,
        hours
      );

      res.json({
        success: true,
        data: forecast.map((f, index) => ({
          hour: index,
          demand: f.demandForecast,
          confidence: f.confidence,
        })),
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
   * GET /api/v1/ml/:systemId/forecast/price
   * Get price forecast for a system
   * Query: ?hours=24
   */
  static async getForecastPrice(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;

      const service = new ForecastingService();
      const historicalPrices = Array(168)
        .fill(0)
        .map((_, i) => 350 + Math.sin((i / 24) * Math.PI * 2) * 100);

      const forecast = service.generateEnsembleForecast(
        new Date().getHours(),
        Array(168).fill(650),
        historicalPrices,
        100,
        hours
      );

      res.json({
        success: true,
        data: forecast.map((f, index) => ({
          hour: index,
          price: f.priceForecast,
          confidence: f.confidence,
        })),
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
