/**
 * Unit Tests for UnifiedDecisionEngine
 */

import { UnifiedDecisionEngine } from '../src/services/optimization/UnifiedDecisionEngine';
import {
  SystemTelemetry,
  GridState,
  MarketData,
  SystemConstraints,
  OptimizationConfig,
} from '../../packages/shared/src/types/optimization';

describe('UnifiedDecisionEngine', () => {
  let engine: UnifiedDecisionEngine;
  let constraints: SystemConstraints;
  let config: OptimizationConfig;

  beforeEach(() => {
    constraints = {
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

    config = {
      arbitrage: { enabled: true, buyThreshold: 300, sellThreshold: 400 },
      peakShaving: { enabled: true, demandLimit: 500, triggerThreshold: 80 },
    };

    engine = new UnifiedDecisionEngine('test-system', constraints, config);
  });

  describe('Priority Hierarchy', () => {
    it('should prioritize SAFETY over all others', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 5, // Below minimum
        soh: 100,
        temperature: 35,
        voltage: 800,
        current: 100,
        power: 50,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 60,
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 350,
        timePrice: 0.6,
        demandForecast: 400,
        loadProfile: 'peak',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.priority).toBe('SAFETY');
      expect(decision.action).toBe('IDLE');
    });

    it('should trigger GRID_CODE when frequency deviates', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 50,
        soh: 100,
        temperature: 30,
        voltage: 800,
        current: 100,
        power: 50,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 59.0, // Below nominal (60Hz)
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 350,
        timePrice: 0.6,
        demandForecast: 400,
        loadProfile: 'intermediate',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.priority).toBe('GRID_CODE');
      expect(decision.action).toBe('DISCHARGE');
    });

    it('should use ECONOMIC priority for arbitrage', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 30, // Low SOC, good for buying
        soh: 100,
        temperature: 30,
        voltage: 800,
        current: 0,
        power: 0,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 60,
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 280, // Below buyThreshold of 300
        timePrice: 0.5,
        demandForecast: 400,
        loadProfile: 'offPeak',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.priority).toBe('ECONOMIC');
      expect(decision.action).toBe('CHARGE');
    });
  });

  describe('Safety Checks', () => {
    it('should stop on temperature emergency', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 50,
        soh: 100,
        temperature: 60, // Above max of 55
        voltage: 800,
        current: 200,
        power: 150,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 60,
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 350,
        timePrice: 0.6,
        demandForecast: 400,
        loadProfile: 'peak',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.action).toBe('EMERGENCY_STOP');
      expect(decision.priority).toBe('SAFETY');
    });

    it('should prevent discharge when SOC too low', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 8, // Below minimum of 10
        soh: 100,
        temperature: 30,
        voltage: 700,
        current: -100,
        power: -75,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 60,
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 450, // Very high, normally would discharge
        timePrice: 0.8,
        demandForecast: 600,
        loadProfile: 'peak',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.action).toBe('IDLE');
      expect(decision.priority).toBe('SAFETY');
    });
  });

  describe('Confidence Levels', () => {
    it('should have high confidence for safety decisions', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 5,
        soh: 100,
        temperature: 35,
        voltage: 800,
        current: 100,
        power: 50,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 60,
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 350,
        timePrice: 0.6,
        demandForecast: 400,
        loadProfile: 'peak',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.confidence).toBe(1.0);
    });

    it('should have moderate confidence for economic decisions', async () => {
      const telemetry: SystemTelemetry = {
        systemId: 'test',
        soc: 30,
        soh: 100,
        temperature: 30,
        voltage: 800,
        current: 0,
        power: 0,
        timestamp: new Date(),
      };

      const gridState: GridState = {
        frequency: 60,
        voltage: 380,
        gridConnected: true,
      };

      const marketData: MarketData = {
        spotPrice: 280,
        timePrice: 0.5,
        demandForecast: 400,
        loadProfile: 'offPeak',
      };

      const decision = await engine.decide(telemetry, gridState, marketData);

      expect(decision.confidence).toBeGreaterThan(0.7);
      expect(decision.confidence).toBeLessThanOrEqual(0.95);
    });
  });
});
