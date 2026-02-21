/**
 * Grid Services Controller
 * REST endpoints for grid integration and Virtual Power Plant
 */

import { Request, Response } from 'express';
import { GridServicesOrchestrator } from '../../services/optimization/GridServicesOrchestrator';

export class GridServicesController {
  private static orchestrator = new GridServicesOrchestrator();

  /**
   * POST /api/v1/grid-services/select-mode
   * Select optimal control mode based on grid conditions
   *
   * Body:
   * {
   *   gridState: { frequency, voltage, gridConnected }
   * }
   */
  static async selectControlMode(req: Request, res: Response): Promise<void> {
    try {
      const { gridState } = req.body;

      if (!gridState) {
        res.status(400).json({
          error: 'Missing required field: gridState',
        });
        return;
      }

      const mode = this.orchestrator.selectControlMode(gridState);
      this.orchestrator.setControlMode(mode);

      const modeInfo: Record<string, string> = {
        grid_following: 'Follows grid voltage and frequency (standard mode)',
        grid_forming: 'Creates its own voltage/frequency reference (high stability)',
        islanding: 'Operates independently when grid unavailable',
        black_start: 'Helps restore grid after blackout',
        synchronizing: 'Synchronizing with grid after island mode',
      };

      res.json({
        success: true,
        data: {
          currentMode: mode,
          description: modeInfo[mode],
          gridConditions: {
            frequency: gridState.frequency,
            voltage: gridState.voltage,
            gridConnected: gridState.gridConnected,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Mode selection failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/grid-services/current-mode
   * Get current control mode
   */
  static async getCurrentMode(req: Request, res: Response): Promise<void> {
    try {
      const mode = this.orchestrator.getCurrentMode();

      res.json({
        success: true,
        data: {
          currentMode: mode,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Mode retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/demand-response
   * Process demand response event
   *
   * Body:
   * {
   *   type: 'FREQUENCY_RESPONSE' | 'VOLTAGE_SUPPORT' | 'DEMAND_RESPONSE' | 'PEAK_SHAVING',
   *   powerRequired: number (kW),
   *   durationMinutes: number,
   *   compensation?: number (R$)
   * }
   */
  static async processDemandResponse(req: Request, res: Response): Promise<void> {
    try {
      const { type, powerRequired, durationMinutes, compensation } = req.body;

      if (!type || powerRequired === undefined || !durationMinutes) {
        res.status(400).json({
          error: 'Missing required fields: type, powerRequired, durationMinutes',
        });
        return;
      }

      const event = this.orchestrator.processDemandResponseEvent({
        type: type as any,
        priority: 1,
        powerRequired,
        durationMinutes,
        compensation,
      });

      res.json({
        success: true,
        data: {
          eventId: event.eventId,
          status: event.status,
          requiredReduction: `${event.requiredReduction.toFixed(1)} kW`,
          duration: `${event.durationMinutes} minutes`,
          compensation: compensation ? `R$ ${compensation}` : 'No compensation',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `DR event processing failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/demand-response/compliance
   * Calculate compliance with demand response
   *
   * Body:
   * {
   *   eventId: string,
   *   actualReduction: number (kW)
   * }
   */
  static async calculateDRCompliance(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, actualReduction } = req.body;

      if (!eventId || actualReduction === undefined) {
        res.status(400).json({
          error: 'Missing required fields: eventId, actualReduction',
        });
        return;
      }

      const compliance = this.orchestrator.calculateDRCompliance(
        eventId,
        actualReduction
      );

      const status =
        compliance >= 85
          ? 'Compliant'
          : compliance >= 70
          ? 'Partially Compliant'
          : 'Non-Compliant';

      res.json({
        success: true,
        data: {
          eventId,
          actualReduction: `${actualReduction.toFixed(1)} kW`,
          complianceRate: `${compliance.toFixed(1)}%`,
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
   * GET /api/v1/grid-services/vpp
   * Get Virtual Power Plant aggregated state
   */
  static async getVPPState(req: Request, res: Response): Promise<void> {
    try {
      const state = this.orchestrator.getVPPState();

      res.json({
        success: true,
        data: {
          participantCount: state.participantCount,
          aggregated: {
            totalCapacity: `${state.totalCapacity.toFixed(1)} kW`,
            availableCapacity: `${state.availableCapacity.toFixed(1)} kW`,
            averageSOC: `${state.averageSOC.toFixed(1)}%`,
            averageSOH: `${state.averageSOH.toFixed(1)}%`,
            dispatchingPower: `${state.dispatchingPower.toFixed(1)} kW`,
          },
          gridConditions: {
            frequency: `${state.frequency.toFixed(2)} Hz`,
            voltage: `${state.voltage.toFixed(1)} V`,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `VPP state retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/vpp/register
   * Register system as VPP participant
   *
   * Body:
   * {
   *   systemId: string,
   *   telemetry: SystemTelemetry
   * }
   */
  static async registerVPPParticipant(req: Request, res: Response): Promise<void> {
    try {
      const { systemId, telemetry } = req.body;

      if (!systemId || !telemetry) {
        res.status(400).json({
          error: 'Missing required fields: systemId, telemetry',
        });
        return;
      }

      this.orchestrator.registerVPPParticipant(systemId, telemetry);

      res.json({
        success: true,
        data: {
          systemId,
          registered: true,
          message: `System ${systemId} registered as VPP participant`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `VPP registration failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/vpp/dispatch
   * Coordinate VPP dispatch
   *
   * Body:
   * {
   *   totalDispatchPower: number (kW, negative=charge, positive=discharge)
   * }
   */
  static async coordinateVPPDispatch(req: Request, res: Response): Promise<void> {
    try {
      const { totalDispatchPower } = req.body;

      if (totalDispatchPower === undefined) {
        res.status(400).json({
          error: 'Missing required field: totalDispatchPower',
        });
        return;
      }

      const dispatch = this.orchestrator.coordinateVPPDispatch(
        totalDispatchPower
      );

      const dispatchArray = Array.from(dispatch.entries()).map(([systemId, power]) => ({
        systemId,
        power: `${power.toFixed(1)} kW`,
        action: power > 10 ? 'DISCHARGE' : power < -10 ? 'CHARGE' : 'IDLE',
      }));

      res.json({
        success: true,
        data: {
          totalDispatchPower: `${totalDispatchPower.toFixed(1)} kW`,
          participantsDispatched: dispatchArray.length,
          dispatch: dispatchArray,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Dispatch coordination failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/grid-services/tariff
   * Get tariff schedule for a specific hour
   *
   * Query:
   * {
   *   hour?: number (default current hour)
   * }
   */
  static async getTariffSchedule(req: Request, res: Response): Promise<void> {
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

      const tariff = this.orchestrator.getTariffSchedule(hour);

      const schedule = [
        { period: 'Peak', hours: '17:00-22:00', rate: '0.85 R$/kWh', factor: 1.5 },
        { period: 'Intermediate', hours: '07:00-17:00, 22:00-23:00', rate: '0.60 R$/kWh', factor: 1.0 },
        { period: 'Off-peak', hours: '23:00-07:00', rate: '0.30 R$/kWh', factor: 0.5 },
      ];

      res.json({
        success: true,
        data: {
          currentHour: hour,
          currentPeriod: tariff.period,
          currentRate: `R$ ${tariff.rate}`,
          currentFactor: tariff.factor,
          schedule,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Tariff retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * POST /api/v1/grid-services/load-shedding
   * Calculate load shedding requirement
   *
   * Body:
   * {
   *   currentSOC: number (%),
   *   socThreshold?: number (default 50)
   * }
   */
  static async calculateLoadShedding(req: Request, res: Response): Promise<void> {
    try {
      const { currentSOC, socThreshold = 50 } = req.body;

      if (currentSOC === undefined) {
        res.status(400).json({
          error: 'Missing required field: currentSOC',
        });
        return;
      }

      const result = this.orchestrator.calculateLoadShedding(currentSOC, socThreshold);

      res.json({
        success: true,
        data: {
          currentSOC: `${currentSOC.toFixed(1)}%`,
          socThreshold: `${socThreshold}%`,
          shouldShed: result.shouldShed,
          essentialLoadsOnly: result.essentialLoadsOnly,
          reductionTarget: `${result.reductionTarget.toFixed(1)}%`,
          status: result.shouldShed ? 'Load shedding required' : 'Normal operation',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: `Load shedding calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * GET /api/v1/optimization/:systemId/grid-services/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      res.json({
        success: true,
        data: {
          systemId,
          frequency: 60.0,
          voltage: 380,
          gridConnected: true,
          drMode: 'available',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/optimization/:systemId/grid-services/config
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      res.json({
        success: true,
        data: { systemId, drEnabled: true, vppEnabled: true },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/optimization/:systemId/grid-services/config
   */
  static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { drEnabled, vppEnabled } = req.body;
      res.json({
        success: true,
        data: { systemId, drEnabled, vppEnabled, updated: true },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
