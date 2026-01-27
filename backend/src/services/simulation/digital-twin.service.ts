/**
 * Digital Twin Service
 * Backend integration for battery simulation and prediction
 */

import { getFirestore } from '../../config/firebase.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';

// ============================================
// TYPES
// ============================================

export interface SimulationConfig {
  nominalCapacity: number;
  nominalVoltage: number;
  cellsInSeries: number;
  cellsInParallel: number;
  initialSoc: number;
  temperature: number;
  cRate: number;
  simulationTime: number;
  timeStep: number;
  currentProfile?: Array<{ time: number; current: number }>;
}

export interface SimulationResult {
  time: number[];
  voltage: number[];
  current: number[];
  soc: number[];
  temperature: number[];
  power: number[];
  internalResistance: number[];
  metadata: Record<string, unknown>;
}

export interface StateEstimate {
  soc: number;
  soh: number;
  sopCharge: number;
  sopDischarge: number;
  internalResistance: number;
  temperature: number;
  timestamp: string;
  confidence: number;
}

export interface DegradationPrediction {
  currentSoh: number;
  predictedSoh: {
    oneYear: number;
    threeYears: number;
    fiveYears: number;
  };
  remainingLife: {
    cycles: number;
    years: number;
    eolDate: string;
  };
  degradationRatePerYear: number;
  primaryStressor: string;
  recommendations: string[];
  confidence: number;
}

export interface DigitalTwinState {
  systemId: string;
  lastUpdate: Date;
  simulationResult?: SimulationResult;
  stateEstimate?: StateEstimate;
  degradationPrediction?: DegradationPrediction;
  comparisonMetrics?: {
    voltageError: number;
    currentError: number;
    socError: number;
    overallAccuracy: number;
  };
}

// ============================================
// DIGITAL TWIN SERVICE
// ============================================

export class DigitalTwinService {
  private db = getFirestore();
  private aiServiceUrl: string;
  private twins: Map<string, DigitalTwinState> = new Map();

  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  }

  /**
   * Create or get a digital twin for a system
   */
  async getOrCreateTwin(systemId: string): Promise<DigitalTwinState> {
    let twin = this.twins.get(systemId);

    if (!twin) {
      // Try to load from database
      const doc = await this.db.collection('digital_twins').doc(systemId).get();

      if (doc.exists) {
        twin = doc.data() as DigitalTwinState;
      } else {
        twin = {
          systemId,
          lastUpdate: new Date(),
        };
      }

      this.twins.set(systemId, twin);
    }

    return twin;
  }

  /**
   * Run battery simulation
   */
  async simulate(
    systemId: string,
    config: SimulationConfig
  ): Promise<SimulationResult> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/digital-twin/simulate`,
        {
          nominal_capacity: config.nominalCapacity,
          nominal_voltage: config.nominalVoltage,
          cells_in_series: config.cellsInSeries,
          cells_in_parallel: config.cellsInParallel,
          initial_soc: config.initialSoc,
          temperature: config.temperature,
          c_rate: config.cRate,
          simulation_time: config.simulationTime,
          time_step: config.timeStep,
          current_profile: config.currentProfile,
        },
        { timeout: 60000 }
      );

      if (response.data.success) {
        const result = response.data.simulation as SimulationResult;

        // Update twin state
        const twin = await this.getOrCreateTwin(systemId);
        twin.simulationResult = result;
        twin.lastUpdate = new Date();
        this.twins.set(systemId, twin);

        // Store in database
        await this.saveTwin(twin);

        logger.info(`Simulation completed for system ${systemId}`);
        return result;
      }

      throw new Error('Simulation failed');
    } catch (error) {
      logger.error(`Simulation error for system ${systemId}`, { error });
      throw error;
    }
  }

  /**
   * Predict remaining battery cycles
   */
  async predictCycles(
    systemId: string,
    currentSoh: number,
    usagePattern: {
      avgDod: number;
      avgCRate: number;
      avgTemperature: number;
      cyclesPerDay: number;
    }
  ): Promise<{
    totalCyclesExpected: number;
    cyclesUsed: number;
    cyclesRemaining: number;
    daysRemaining: number;
    eolDate: string;
    confidence: number;
  }> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/digital-twin/predict-cycles`,
        {
          current_soh: currentSoh,
          avg_dod: usagePattern.avgDod,
          avg_c_rate: usagePattern.avgCRate,
          avg_temperature: usagePattern.avgTemperature,
          cycles_per_day: usagePattern.cyclesPerDay,
        },
        { timeout: 30000 }
      );

      if (response.data.success) {
        const prediction = response.data.prediction;
        return {
          totalCyclesExpected: prediction.total_cycles_expected,
          cyclesUsed: prediction.cycles_used_estimated,
          cyclesRemaining: prediction.cycles_remaining,
          daysRemaining: prediction.days_remaining,
          eolDate: prediction.eol_date_estimated,
          confidence: prediction.confidence,
        };
      }

      throw new Error('Prediction failed');
    } catch (error) {
      logger.error(`Cycle prediction error for system ${systemId}`, { error });
      throw error;
    }
  }

  /**
   * Compare simulation with real telemetry
   */
  async compareWithReal(
    systemId: string,
    config: SimulationConfig,
    realData: {
      time: number[];
      voltage: number[];
      current: number[];
      soc: number[];
    }
  ): Promise<{
    voltage: { mae: number; rmse: number; correlation: number };
    current: { mae: number; rmse: number; correlation: number };
    soc: { mae: number; rmse: number; correlation: number };
    overallAccuracy: number;
    modelValid: boolean;
  }> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/digital-twin/compare`,
        {
          simulation_config: {
            nominal_capacity: config.nominalCapacity,
            nominal_voltage: config.nominalVoltage,
            cells_in_series: config.cellsInSeries,
            cells_in_parallel: config.cellsInParallel,
            initial_soc: config.initialSoc,
            temperature: config.temperature,
            c_rate: config.cRate,
            simulation_time: config.simulationTime,
            time_step: config.timeStep,
          },
          real_data: realData,
        },
        { timeout: 60000 }
      );

      if (response.data.success) {
        const comparison = response.data.comparison;

        // Update twin state
        const twin = await this.getOrCreateTwin(systemId);
        twin.comparisonMetrics = {
          voltageError: comparison.voltage.mae,
          currentError: comparison.current.mae,
          socError: comparison.soc.mae,
          overallAccuracy: comparison.overall_accuracy,
        };
        twin.lastUpdate = new Date();
        this.twins.set(systemId, twin);

        await this.saveTwin(twin);

        return {
          voltage: comparison.voltage,
          current: comparison.current,
          soc: comparison.soc,
          overallAccuracy: comparison.overall_accuracy,
          modelValid: comparison.model_valid,
        };
      }

      throw new Error('Comparison failed');
    } catch (error) {
      logger.error(`Comparison error for system ${systemId}`, { error });
      throw error;
    }
  }

  /**
   * Update state estimate with telemetry
   */
  async updateState(
    systemId: string,
    voltage: number,
    current: number,
    temperature?: number,
    dt: number = 1.0
  ): Promise<StateEstimate> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/digital-twin/state/update`,
        {
          voltage,
          current,
          temperature,
          dt,
        },
        { timeout: 10000 }
      );

      if (response.data.success) {
        const state = response.data.state;

        const estimate: StateEstimate = {
          soc: state.soc,
          soh: state.soh,
          sopCharge: state.sop_charge_kw,
          sopDischarge: state.sop_discharge_kw,
          internalResistance: state.internal_resistance_mohm / 1000,
          temperature: state.temperature_c,
          timestamp: state.timestamp,
          confidence: state.confidence,
        };

        // Update twin state
        const twin = await this.getOrCreateTwin(systemId);
        twin.stateEstimate = estimate;
        twin.lastUpdate = new Date();
        this.twins.set(systemId, twin);

        return estimate;
      }

      throw new Error('State update failed');
    } catch (error) {
      logger.error(`State update error for system ${systemId}`, { error });
      throw error;
    }
  }

  /**
   * Get degradation prediction
   */
  async predictDegradation(
    systemId: string,
    factors: {
      avgDod: number;
      avgCRateCharge: number;
      avgCRateDischarge: number;
      avgTemperature: number;
      maxTemperature: number;
      minTemperature: number;
      timeAtHighSoc: number;
      timeAtLowSoc: number;
      calendarDays: number;
      cycleCount: number;
    }
  ): Promise<DegradationPrediction> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/digital-twin/degradation/predict`,
        {
          avg_dod: factors.avgDod,
          avg_c_rate_charge: factors.avgCRateCharge,
          avg_c_rate_discharge: factors.avgCRateDischarge,
          avg_temperature: factors.avgTemperature,
          max_temperature: factors.maxTemperature,
          min_temperature: factors.minTemperature,
          time_at_high_soc: factors.timeAtHighSoc,
          time_at_low_soc: factors.timeAtLowSoc,
          calendar_days: factors.calendarDays,
          cycle_count: factors.cycleCount,
        },
        { timeout: 30000 }
      );

      if (response.data.success) {
        const pred = response.data.prediction;

        const prediction: DegradationPrediction = {
          currentSoh: pred.current_soh,
          predictedSoh: {
            oneYear: pred.predicted_soh['1_year'],
            threeYears: pred.predicted_soh['3_years'],
            fiveYears: pred.predicted_soh['5_years'],
          },
          remainingLife: {
            cycles: pred.remaining_life.cycles,
            years: pred.remaining_life.years,
            eolDate: pred.remaining_life.eol_date,
          },
          degradationRatePerYear: pred.degradation_rate_percent_per_year,
          primaryStressor: pred.primary_stressor,
          recommendations: pred.recommendations,
          confidence: pred.confidence_percent,
        };

        // Update twin state
        const twin = await this.getOrCreateTwin(systemId);
        twin.degradationPrediction = prediction;
        twin.lastUpdate = new Date();
        this.twins.set(systemId, twin);

        await this.saveTwin(twin);

        return prediction;
      }

      throw new Error('Degradation prediction failed');
    } catch (error) {
      logger.error(`Degradation prediction error for system ${systemId}`, { error });
      throw error;
    }
  }

  /**
   * Get degradation trajectory for charting
   */
  async getDegradationTrajectory(
    factors: {
      avgDod: number;
      avgCRateCharge: number;
      avgCRateDischarge: number;
      avgTemperature: number;
      maxTemperature: number;
      minTemperature: number;
      timeAtHighSoc: number;
      timeAtLowSoc: number;
      calendarDays: number;
      cycleCount: number;
    },
    years: number = 10
  ): Promise<{
    dates: string[];
    soh: number[];
    cycles: number[];
    eolThreshold: number;
  }> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/v1/digital-twin/degradation/trajectory?years=${years}`,
        {
          avg_dod: factors.avgDod,
          avg_c_rate_charge: factors.avgCRateCharge,
          avg_c_rate_discharge: factors.avgCRateDischarge,
          avg_temperature: factors.avgTemperature,
          max_temperature: factors.maxTemperature,
          min_temperature: factors.minTemperature,
          time_at_high_soc: factors.timeAtHighSoc,
          time_at_low_soc: factors.timeAtLowSoc,
          calendar_days: factors.calendarDays,
          cycle_count: factors.cycleCount,
        },
        { timeout: 30000 }
      );

      if (response.data.success) {
        return response.data.trajectory;
      }

      throw new Error('Trajectory prediction failed');
    } catch (error) {
      logger.error('Trajectory prediction error', { error });
      throw error;
    }
  }

  /**
   * Get available battery models
   */
  async getAvailableModels(): Promise<{
    cells: string[];
    packs: string[];
  }> {
    try {
      const [cellsResponse, packsResponse] = await Promise.all([
        axios.get(`${this.aiServiceUrl}/api/v1/digital-twin/models/cells`),
        axios.get(`${this.aiServiceUrl}/api/v1/digital-twin/models/packs`),
      ]);

      return {
        cells: cellsResponse.data.cells,
        packs: packsResponse.data.packs,
      };
    } catch (error) {
      logger.error('Error getting available models', { error });
      throw error;
    }
  }

  /**
   * Save twin state to database
   */
  private async saveTwin(twin: DigitalTwinState): Promise<void> {
    await this.db.collection('digital_twins').doc(twin.systemId).set({
      ...twin,
      updatedAt: new Date(),
    }, { merge: true });
  }

  /**
   * Get twin status
   */
  getTwinStatus(systemId: string): DigitalTwinState | null {
    return this.twins.get(systemId) || null;
  }

  /**
   * Check AI service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.aiServiceUrl}/api/v1/digital-twin/health`,
        { timeout: 5000 }
      );
      return response.data.status === 'ok';
    } catch {
      return false;
    }
  }
}

// Singleton export
export const digitalTwinService = new DigitalTwinService();
