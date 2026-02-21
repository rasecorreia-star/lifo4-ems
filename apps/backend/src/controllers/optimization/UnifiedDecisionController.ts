/**
 * Unified Decision Controller
 * REST endpoints for the core decision engine
 */

import { Request, Response } from 'express';
import { UnifiedDecisionEngine } from '../../services/optimization/UnifiedDecisionEngine';
import {
  SystemTelemetry,
  GridState,
  MarketData,
  SystemConstraints,
  OptimizationConfig,
} from '../../../../../packages/shared/src/types/optimization';

export class UnifiedDecisionController {
  // Decision cache: Map<systemId, { decision: any, at: Date }>
  private static decisionCache = new Map<string, { decision: any; at: Date }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Decision history: Map<systemId, Array<{ decision, timestamp }>>
  private static decisionHistory = new Map<string, Array<{ decision: any; timestamp: Date }>>();
  private static readonly MAX_HISTORY_PER_SYSTEM = 1000; // Keep last 1000 decisions per system

  /**
   * POST /api/v1/optimization/decision
   * Make a decision based on current system state
   *
   * Body:
   * {
   *   systemId: string,
   *   telemetry: SystemTelemetry,
   *   gridState: GridState,
   *   marketData: MarketData,
   *   constraints: SystemConstraints,
   *   config: OptimizationConfig
   * }
   */
  static async makeDecision(req: Request, res: Response): Promise<void> {
    try {
      const {
        systemId,
        telemetry,
        gridState,
        marketData,
        constraints,
        config,
      } = req.body;

      // Validate required fields
      if (!systemId || !telemetry || !gridState || !marketData) {
        res.status(400).json({
          error: 'Missing required fields: systemId, telemetry, gridState, marketData',
        });
        return;
      }

      // Initialize engine with constraints and config
      const engine = new UnifiedDecisionEngine(
        systemId,
        constraints || this.getDefaultConstraints(),
        config || this.getDefaultConfig()
      );

      // Make decision
      const decision = await engine.decide(
        telemetry,
        gridState,
        marketData
      );

      // Cache the decision
      const now = new Date();
      this.decisionCache.set(systemId, { decision, at: now });

      // Add to history
      const history = this.decisionHistory.get(systemId) || [];
      history.push({ decision, timestamp: now });
      // Keep only last MAX_HISTORY_PER_SYSTEM entries
      if (history.length > this.MAX_HISTORY_PER_SYSTEM) {
        history.shift();
      }
      this.decisionHistory.set(systemId, history);

      res.json({
        success: true,
        data: {
          systemId,
          decision,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Decision making failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/optimization/decision/batch
   * Make decisions for multiple systems simultaneously
   *
   * Body:
   * {
   *   decisions: Array<{ systemId, telemetry, gridState, marketData, constraints?, config? }>
   * }
   */
  static async makeDecisionBatch(req: Request, res: Response): Promise<void> {
    try {
      const { decisions } = req.body;

      if (!decisions || !Array.isArray(decisions)) {
        res.status(400).json({
          error: 'Invalid input: expected decisions array',
        });
        return;
      }

      const results = await Promise.all(
        decisions.map(async (decision) => {
          try {
            const engine = new UnifiedDecisionEngine(
              decision.systemId,
              decision.constraints || this.getDefaultConstraints(),
              decision.config || this.getDefaultConfig()
            );

            const result = await engine.decide(
              decision.telemetry,
              decision.gridState,
              decision.marketData
            );

            return {
              systemId: decision.systemId,
              success: true,
              decision: result,
            };
          } catch (err) {
            return {
              systemId: decision.systemId,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        })
      );

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: `Batch decision making failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/optimization/decision/priority/:priority
   * Get description of a priority level
   */
  static async getPriorityInfo(req: Request, res: Response): Promise<void> {
    try {
      const { priority } = req.params;

      const priorityInfo: Record<string, any> = {
        SAFETY: {
          name: 'Safety',
          description: 'Hard constraints that never can be violated',
          examples: [
            'Temperature emergency',
            'SOC bounds violation',
            'Current limit exceeded',
          ],
          confidence: 1.0,
          responseTimeMs: 0,
        },
        GRID_CODE: {
          name: 'Grid Code',
          description: 'Regulatory obligations for grid stability',
          examples: [
            'Frequency response (droop control)',
            'Voltage support',
          ],
          confidence: 0.95,
          responseTimeMs: 100,
        },
        CONTRACTUAL: {
          name: 'Contractual',
          description: 'Customer obligations (demand limit, reserved capacity)',
          examples: ['Peak shaving', 'Demand response'],
          confidence: 0.9,
          responseTimeMs: 300,
        },
        ECONOMIC: {
          name: 'Economic',
          description: 'Maximize profit through arbitrage and optimization',
          examples: ['Energy arbitrage', 'Market trading'],
          confidence: 0.85,
          responseTimeMs: 500,
        },
        LONGEVITY: {
          name: 'Longevity',
          description: 'Preserve battery health by avoiding unnecessary cycling',
          examples: ['Maintain SOC in sweet spot (20-80%)'],
          confidence: 0.7,
          responseTimeMs: 1000,
        },
      };

      const info = priorityInfo[priority.toUpperCase()];

      if (!info) {
        res.status(404).json({
          error: 'Priority not found',
          validPriorities: Object.keys(priorityInfo),
        });
        return;
      }

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * GET /api/v1/optimization/config/default
   * Get default configuration for a system
   */
  static async getDefaultConfigEndpoint(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          constraints: this.getDefaultConstraints(),
          config: this.getDefaultConfig(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Default system constraints
   */
  private static getDefaultConstraints(): SystemConstraints {
    return {
      // Safety
      maxTemperature: 55, // °C
      minSOC: 10, // %
      maxSOC: 95, // %
      maxCurrent: 300, // A
      minCellVoltage: 2.5, // V
      maxCellVoltage: 3.65, // V

      // Operational
      maxPower: 200, // kW
      minPower: 10, // kW
      responseTime: 100, // milliseconds

      // Grid
      frequencyDeadband: 0.5, // Hz
      voltageDeadband: 30, // V
    };
  }

  /**
   * Default optimization configuration
   */
  private static getDefaultConfig(): OptimizationConfig {
    return {
      arbitrage: {
        enabled: true,
        buyThreshold: 300, // R$/MWh
        sellThreshold: 400, // R$/MWh
      },
      peakShaving: {
        enabled: true,
        demandLimit: 500, // kW
        triggerThreshold: 80, // %
      },
      selfConsumption: {
        enabled: false,
        targetSOC: 50, // %
      },
      frequencyResponse: {
        enabled: true,
        droop: 0.05, // 5%
      },
      demandResponse: {
        enabled: true,
        maxReduction: 80, // %
      },
    };
  }

  /**
   * GET /api/v1/optimization/:systemId/decision/current
   * Get current decision for a system
   * Returns cached decision if available (TTL 5 minutes)
   */
  static async getCurrentDecision(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      // Check cache first
      const cached = this.decisionCache.get(systemId);
      const now = new Date();

      if (cached && (now.getTime() - cached.at.getTime()) < this.CACHE_TTL_MS) {
        // Cache hit and valid
        res.json({
          success: true,
          data: {
            systemId,
            ...cached.decision,
            source: 'cached',
            cachedAt: cached.at.toISOString(),
          },
          timestamp: now.toISOString(),
        });
        return;
      }

      // Cache miss or expired - return "no data" status
      const decision = {
        systemId,
        action: 'IDLE',
        powerKW: 0,
        priority: 'LONGEVITY',
        reason: 'No recent telemetry received',
        confidence: 0.0,
        source: 'no_data',
      };

      res.json({
        success: true,
        data: decision,
        timestamp: now.toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/v1/optimization/:systemId/decision/history
   * Get decision history for a system
   * Query: ?hours=24
   */
  static async getDecisionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;

      // Get history from memory
      const fullHistory = this.decisionHistory.get(systemId) || [];

      // Filter by time window
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const filtered = fullHistory.filter(h => h.timestamp.getTime() > cutoffTime.getTime());

      // Return recent decisions
      const history = filtered.slice(-100).map(h => ({
        timestamp: h.timestamp.toISOString(),
        action: h.decision.action,
        powerKW: h.decision.powerKW,
        priority: h.decision.priority,
        reason: h.decision.reason,
        confidence: h.decision.confidence,
      }));

      res.json({
        success: true,
        data: {
          systemId,
          history,
          count: history.length,
          source: 'memory',
          message: `Showing ${history.length} decisions from last ${hours} hours`,
        },
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
   * POST /api/v1/optimization/:systemId/decision/override
   * Override decision manually (requires OPERATOR+ role)
   */
  static async overrideDecision(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { action, powerKW, durationMinutes, reason } = req.body;

      // Cache the override decision
      const decision = { action, powerKW, durationMinutes, reason };
      this.decisionCache.set(systemId, { decision, at: new Date() });

      res.json({
        success: true,
        data: {
          systemId,
          action,
          powerKW,
          durationMinutes,
          reason,
          overriddenBy: (req as any).user?.email || 'system',
        },
        message: 'Decision override applied',
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
