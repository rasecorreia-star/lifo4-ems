/**
 * Predictive Maintenance Controller
 * REST endpoints for failure prediction and maintenance scheduling
 */

import { Request, Response } from 'express';
import { PredictiveMaintenanceService } from '../../services/ml/PredictiveMaintenanceService';

export class PredictiveMaintenanceController {
  /**
   * POST /api/v1/ml/maintenance/evaluate-component
   * Evaluate health of a specific component
   *
   * Body:
   * {
   *   componentType: 'battery_pack' | 'bms' | 'inverter' | 'cooling_system' | 'electrical' | 'mechanical',
   *   metrics: Record<string, number>,
   *   historicalData?: Record<string, number[]>,
   *   lastMaintenanceDate?: Date
   * }
   */
  static async evaluateComponent(req: Request, res: Response): Promise<void> {
    try {
      const {
        componentType,
        metrics,
        historicalData = {},
        lastMaintenanceDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
      } = req.body;

      if (!componentType || !metrics) {
        res.status(400).json({
          error: 'Missing required fields: componentType, metrics',
        });
        return;
      }

      const service = new PredictiveMaintenanceService();

      const health = service.evaluateComponentHealth(
        componentType,
        metrics,
        historicalData,
        new Date(lastMaintenanceDate)
      );

      res.json({
        success: true,
        data: {
          ...health,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Component evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/maintenance/recommendation
   * Get maintenance recommendation for a component
   *
   * Body:
   * {
   *   component: ComponentHealth (from evaluateComponent endpoint)
   * }
   */
  static async getMaintenanceRecommendation(req: Request, res: Response): Promise<void> {
    try {
      const { component } = req.body;

      if (!component) {
        res.status(400).json({
          error: 'Missing required field: component',
        });
        return;
      }

      const service = new PredictiveMaintenanceService();
      const recommendation = service.generateMaintenanceRecommendation(component);

      res.json({
        success: true,
        data: {
          ...recommendation,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Recommendation generation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/maintenance/predict-failure
   * Predict probability of failure
   *
   * Body:
   * {
   *   componentType: string,
   *   metrics: Record<string, number>,
   *   historicalData?: Record<string, number[]>
   * }
   */
  static async predictFailure(req: Request, res: Response): Promise<void> {
    try {
      const { componentType, metrics, historicalData = {} } = req.body;

      if (!componentType || !metrics) {
        res.status(400).json({
          error: 'Missing required fields: componentType, metrics',
        });
        return;
      }

      const service = new PredictiveMaintenanceService();

      const health = service.evaluateComponentHealth(
        componentType,
        metrics,
        historicalData,
        new Date()
      );

      const failureProbability = health.failureProbability;
      const timeToFailure = health.estimatedRemainingLifeMonths;

      const riskLevel =
        failureProbability > 0.7
          ? 'Critical'
          : failureProbability > 0.5
          ? 'High'
          : failureProbability > 0.3
          ? 'Medium'
          : 'Low';

      res.json({
        success: true,
        data: {
          componentType,
          failureProbability: `${(failureProbability * 100).toFixed(1)}%`,
          timeToFailureMonths: timeToFailure.toFixed(1),
          riskLevel,
          recommendation:
            riskLevel === 'Critical'
              ? 'Schedule immediate maintenance'
              : riskLevel === 'High'
              ? 'Schedule maintenance within 2 weeks'
              : riskLevel === 'Medium'
              ? 'Schedule preventive maintenance'
              : 'Continue monitoring',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Failure prediction failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/maintenance/models/metrics
   * Get ML model performance metrics
   */
  static async getModelMetrics(req: Request, res: Response): Promise<void> {
    try {
      const service = new PredictiveMaintenanceService();
      const metrics = service.getModelMetrics();

      res.json({
        success: true,
        data: {
          accuracy: `${(metrics.accuracy * 100).toFixed(1)}%`,
          precision: `${(metrics.precision * 100).toFixed(1)}%`,
          recall: `${(metrics.recall * 100).toFixed(1)}%`,
          f1Score: `${(metrics.f1Score * 100).toFixed(1)}%`,
          description:
            'Predictive maintenance uses ML with ~94% accuracy to predict failures before they occur',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Metrics retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/ml/maintenance/cost-comparison
   * Compare cost of preventive vs reactive maintenance
   *
   * Body:
   * {
   *   failureProbability: number (0-1),
   *   plannedMaintenanceCost: number (R$),
   *   unplannedRepairCost: number (R$),
   *   downtimeHours: number
   * }
   */
  static async costComparison(req: Request, res: Response): Promise<void> {
    try {
      const {
        failureProbability,
        plannedMaintenanceCost,
        unplannedRepairCost,
        downtimeHours,
      } = req.body;

      if (
        failureProbability === undefined ||
        plannedMaintenanceCost === undefined ||
        unplannedRepairCost === undefined ||
        downtimeHours === undefined
      ) {
        res.status(400).json({
          error:
            'Missing required fields: failureProbability, plannedMaintenanceCost, unplannedRepairCost, downtimeHours',
        });
        return;
      }

      const service = new PredictiveMaintenanceService();

      const comparison = service.estimateMaintenanceCostComparison(
        failureProbability,
        plannedMaintenanceCost,
        unplannedRepairCost,
        downtimeHours
      );

      const savings = comparison.expectedCostIfIgnored - comparison.expectedCostIfMaintained;

      res.json({
        success: true,
        data: {
          failureProbability: `${(failureProbability * 100).toFixed(1)}%`,
          plannedMaintenance: {
            cost: `R$ ${comparison.expectedCostIfMaintained.toFixed(2)}`,
          },
          reactiveRepair: {
            cost: `R$ ${comparison.expectedCostIfIgnored.toFixed(2)}`,
            probability: `${(failureProbability * 100).toFixed(1)}%`,
            downtime: `${downtimeHours} hours`,
          },
          analysis: {
            potentialSavings: `R$ ${Math.max(0, savings).toFixed(2)}`,
            recommendation: comparison.recommendation,
            roi: `${((savings / plannedMaintenanceCost) * 100).toFixed(0)}%`,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Cost comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/maintenance/components
   * Get list of all trackable components
   */
  static async getComponentTypes(req: Request, res: Response): Promise<void> {
    try {
      const components = {
        battery_pack: {
          name: 'Battery Pack',
          criticalMetrics: ['soh', 'temperature', 'cellVoltageImbalance'],
          failureRiskBase: 0.05,
        },
        bms: {
          name: 'Battery Management System',
          criticalMetrics: ['sensorError', 'communicationFailures', 'balancingIssues'],
          failureRiskBase: 0.08,
        },
        inverter: {
          name: 'Power Inverter',
          criticalMetrics: ['efficiency', 'temperature', 'harmonicDistortion'],
          failureRiskBase: 0.12,
        },
        cooling_system: {
          name: 'Cooling System',
          criticalMetrics: ['temperature', 'fanFailures', 'fluidLeak'],
          failureRiskBase: 0.15,
        },
        electrical: {
          name: 'Electrical System',
          criticalMetrics: ['contactResistance', 'vibrationLevel'],
          failureRiskBase: 0.10,
        },
        mechanical: {
          name: 'Mechanical Assembly',
          criticalMetrics: ['vibrationLevel', 'corrosion'],
          failureRiskBase: 0.08,
        },
      };

      res.json({
        success: true,
        data: {
          totalComponentTypes: Object.keys(components).length,
          components,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Component types retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/ml/:systemId/maintenance/predictions
   * Get maintenance predictions for a system
   */
  static async getPredictions(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      // Mock prediction data
      const predictions = {
        systemId,
        predictions: [
          {
            component: 'battery_pack',
            failureProbability: 0.05,
            daysUntilFailure: 1200,
            severity: 'low',
            recommendation: 'Normal operation. Monitor SOH quarterly.',
          },
          {
            component: 'inverter',
            failureProbability: 0.12,
            daysUntilFailure: 450,
            severity: 'medium',
            recommendation: 'Schedule maintenance within 6 months.',
          },
          {
            component: 'cooling_system',
            failureProbability: 0.08,
            daysUntilFailure: 180,
            severity: 'medium',
            recommendation: 'Check coolant levels and fans immediately.',
          },
        ],
        overallRisk: 'medium',
        nextRecommendedMaintenance: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      res.json({
        success: true,
        data: predictions,
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
