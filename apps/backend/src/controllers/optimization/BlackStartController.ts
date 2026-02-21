/**
 * Black Start Controller
 * REST endpoints for grid restoration after blackouts
 */

import { Request, Response } from 'express';
import { BlackStartService } from '../../services/optimization/BlackStartService';

// Store active FSM instances per systemId to maintain state across requests
const blackStartInstances = new Map<string, BlackStartService>();

export class BlackStartController {
  /**
   * POST /api/v1/grid-services/black-start/process
   * Process blackout and transition through FSM
   *
   * Body:
   * {
   *   systemId: string,
   *   gridState: { frequency, voltage, gridConnected },
   *   telemetry: SystemTelemetry
   * }
   */
  static async processBlackout(req: Request, res: Response): Promise<void> {
    try {
      const { systemId, gridState, telemetry } = req.body;

      if (!systemId || !gridState || !telemetry) {
        res.status(400).json({
          error: 'Missing required fields: systemId, gridState, telemetry',
        });
        return;
      }

      // Get or create FSM instance for this system (maintains state across requests)
      let service = blackStartInstances.get(systemId);
      if (!service) {
        service = new BlackStartService();
        blackStartInstances.set(systemId, service);
      }

      const status = service.processBlackout(gridState, telemetry, systemId);

      res.json({
        success: true,
        data: {
          systemId,
          ...status,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Blackout processing failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/grid-services/black-start/state-history
   * Get state transition history for all systems
   * Returns empty if no history recorded yet
   */
  static async getStateHistory(req: Request, res: Response): Promise<void> {
    try {
      // Get all service instances and their histories
      const allHistory: any[] = [];
      blackStartInstances.forEach((service, systemId) => {
        const history = service.getStateHistory();
        allHistory.push(...history.map(e => ({ ...e, systemId })));
      });

      // Sort by timestamp descending
      allHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      res.json({
        success: true,
        data: {
          totalTransitions: allHistory.length,
          recentTransitions: allHistory.slice(0, 20).map((event) => ({
            systemId: event.systemId,
            timestamp: event.timestamp.toISOString(),
            from: event.fromState,
            to: event.toState,
            reason: event.reason,
          })),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `History retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/black-start/island-duration
   * Estimate how long system can operate in island mode
   *
   * Body:
   * {
   *   batteryCapacityKWh: number,
   *   currentSOC: number (%),
   *   averageLoadKW: number
   * }
   */
  static async estimateIslandModeDuration(req: Request, res: Response): Promise<void> {
    try {
      const {
        batteryCapacityKWh,
        currentSOC,
        averageLoadKW,
      } = req.body;

      if (batteryCapacityKWh === undefined || currentSOC === undefined || averageLoadKW === undefined) {
        res.status(400).json({
          error: 'Missing required fields: batteryCapacityKWh, currentSOC, averageLoadKW',
        });
        return;
      }

      const service = new BlackStartService();

      const telemetry = {
        systemId: 'temp',
        soc: currentSOC,
        soh: 100,
        temperature: 30,
        voltage: 380,
        current: 0,
        power: 0,
        timestamp: new Date(),
      };

      const duration = service.estimateIslandModeDuration(
        batteryCapacityKWh,
        telemetry,
        averageLoadKW
      );

      const hours = Math.floor(duration.durationHours);
      const minutes = Math.round((duration.durationHours % 1) * 60);

      res.json({
        success: true,
        data: {
          batteryCapacity: `${batteryCapacityKWh}kWh`,
          currentSOC: `${currentSOC.toFixed(1)}%`,
          averageLoad: `${averageLoadKW}kW`,
          estimatedDuration: `${hours}h ${minutes}m`,
          durationHours: duration.durationHours.toFixed(2),
          shutdownSOC: `${duration.shutdownSOC}%`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Duration estimation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/black-start/capability
   * Check black start capability of system
   *
   * Body:
   * {
   *   telemetry: SystemTelemetry,
   *   gridState: GridState
   * }
   */
  static async getBlackStartCapability(req: Request, res: Response): Promise<void> {
    try {
      const { telemetry, gridState } = req.body;

      if (!telemetry || !gridState) {
        res.status(400).json({
          error: 'Missing required fields: telemetry, gridState',
        });
        return;
      }

      const service = new BlackStartService();
      const capability = service.getBlackStartCapability(telemetry, gridState);

      res.json({
        success: true,
        data: {
          capable: capability.capable,
          confidence: `${(capability.confidence * 100).toFixed(1)}%`,
          limitingFactor: capability.limitingFactor,
          status: capability.capable ? 'Ready for black start' : 'Not ready',
          recommendations: capability.capable
            ? ['System is ready to support grid restoration']
            : [
                `Cannot perform black start: ${capability.limitingFactor}`,
                'Address limiting factor to enable black start capability',
              ],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Capability check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/black-start/restoration-time
   * Estimate grid restoration time
   *
   * Body:
   * {
   *   gridState: GridState,
   *   telemetry: SystemTelemetry
   * }
   */
  static async estimateRestorationTime(req: Request, res: Response): Promise<void> {
    try {
      const { gridState, telemetry } = req.body;

      if (!gridState || !telemetry) {
        res.status(400).json({
          error: 'Missing required fields: gridState, telemetry',
        });
        return;
      }

      const service = new BlackStartService();
      const estimation = service.estimateRestorationTime(gridState, telemetry);

      const minutes = Math.floor(estimation.estimatedMinutes);
      const seconds = Math.round((estimation.estimatedMinutes % 1) * 60);

      res.json({
        success: true,
        data: {
          estimatedTime: `${minutes}m ${seconds}s`,
          estimatedMinutes: estimation.estimatedMinutes.toFixed(2),
          confidence: `${(estimation.confidence * 100).toFixed(1)}%`,
          stages: estimation.stages,
          gridConditions: {
            frequency: `${gridState.frequency.toFixed(2)} Hz`,
            voltage: `${gridState.voltage.toFixed(1)} V`,
            frequencyDeviation: `${Math.abs(gridState.frequency - 60).toFixed(2)} Hz`,
          },
          systemState: {
            soc: `${telemetry.soc.toFixed(1)}%`,
            temperature: `${telemetry.temperature}°C`,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Restoration time estimation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/grid-services/black-start/fsm-states
   * Get available FSM states
   */
  static async getFSMStates(req: Request, res: Response): Promise<void> {
    try {
      const states = {
        grid_connected: {
          description: 'Normal grid-connected operation',
          nextStates: ['blackout_detected'],
        },
        blackout_detected: {
          description: 'Blackout detected, preparing for transfer',
          nextStates: ['transferring'],
        },
        transferring: {
          description: 'Transferring to battery power',
          nextStates: ['island_mode'],
        },
        island_mode: {
          description: 'Operating independently (islanded)',
          nextStates: ['synchronizing'],
        },
        synchronizing: {
          description: 'Attempting to synchronize with restored grid',
          nextStates: ['resynchronized', 'island_mode'],
        },
        resynchronized: {
          description: 'Successfully synchronized, confirming',
          nextStates: ['grid_connected'],
        },
      };

      res.json({
        success: true,
        data: {
          totalStates: Object.keys(states).length,
          states,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `FSM states retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/black-start/reset
   * Reset FSM to initial state (after service)
   *
   * Body:
   * {
   *   systemId: string
   * }
   */
  static async resetFSM(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.body;

      if (!systemId) {
        res.status(400).json({
          error: 'Missing required field: systemId',
        });
        return;
      }

      // Get or create service instance
      let service = blackStartInstances.get(systemId);
      if (!service) {
        service = new BlackStartService();
        blackStartInstances.set(systemId, service);
      }

      service.resetFSM();

      res.json({
        success: true,
        data: {
          systemId,
          message: 'FSM reset to grid_connected state',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `FSM reset failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/optimization/:systemId/grid-services/black-start/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      res.json({
        success: true,
        data: {
          systemId,
          state: 'grid_connected',
          capable: true,
          soc: 65,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/optimization/:systemId/grid-services/black-start/engage
   */
  static async engage(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      res.json({
        success: true,
        data: { systemId, state: 'blackout_detected', engaged: true },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
