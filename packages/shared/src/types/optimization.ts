/**
 * Shared types for optimization engine
 * Used by both frontend and backend
 */

// Decision Engine
export type DecisionPriority = 'SAFETY' | 'GRID_CODE' | 'CONTRACTUAL' | 'ECONOMIC' | 'LONGEVITY';
export type DecisionAction = 'CHARGE' | 'DISCHARGE' | 'IDLE' | 'EMERGENCY_STOP' | 'GRID_SUPPORT' | 'FREQUENCY_RESPONSE';

export interface DecisionResult {
  action: DecisionAction;
  powerKW: number; // Positive = discharge, negative = charge
  durationMinutes: number;
  priority: DecisionPriority;
  reason: string; // Human-readable explanation
  confidence: number; // 0-1
  timestamp: Date;
  nextReviewAt: Date;
  metadata?: {
    arbitragePrice?: number;
    gridFrequency?: number;
    gridVoltage?: number;
    demandForecast?: number;
  };
}

// System State
export interface SystemTelemetry {
  systemId: string;
  soc: number; // 0-100 %
  soh: number; // 0-100 %
  temperature: number; // °C
  voltage: number; // V
  current: number; // A
  power: number; // kW (positive = discharge)
  timestamp: Date;
}

export interface GridState {
  frequency: number; // Hz
  voltage: number; // V
  gridConnected: boolean;
  timeToNextEvent?: number; // milliseconds
}

export interface MarketData {
  spotPrice: number; // R$/MWh
  timePrice: number; // Tariff-based price R$/kWh
  demandForecast: number; // kW
  loadProfile: 'offPeak' | 'intermediate' | 'peak';
}

// Configuration
export interface SystemConstraints {
  // Safety
  maxTemperature: number; // °C
  minSOC: number; // %
  maxSOC: number; // %
  maxCurrent: number; // A
  minCellVoltage: number; // V per cell
  maxCellVoltage: number; // V per cell

  // Operational
  maxPower: number; // kW
  minPower: number; // kW
  responseTime: number; // milliseconds

  // Grid
  frequencyDeadband: number; // Hz
  voltageDeadband: number; // V
}

export interface OptimizationConfig {
  arbitrage?: {
    enabled: boolean;
    buyThreshold: number; // R$/MWh
    sellThreshold: number; // R$/MWh
  };
  peakShaving?: {
    enabled: boolean;
    demandLimit: number; // kW
    triggerThreshold: number; // % of limit
  };
  selfConsumption?: {
    enabled: boolean;
    targetSOC: number; // %
  };
  frequencyResponse?: {
    enabled: boolean;
    droop: number; // %
  };
  demandResponse?: {
    enabled: boolean;
    maxReduction: number; // % of power
  };
}

// Arbitrage
export interface ArbitrageOpportunity {
  buyWindow: { start: Date; end: Date };
  sellWindow: { start: Date; end: Date };
  buyPrice: number; // R$/MWh
  sellPrice: number; // R$/MWh
  expectedProfit: number; // R$
  requiredEnergy: number; // kWh
  confidence: number; // 0-1
}

// Peak Shaving
export interface PeakShavingEvent {
  systemId: string;
  demandForecast: number; // kW
  demandLimit: number; // kW
  excessPower: number; // kW above limit
  recommendedAction: DecisionAction;
  requiredEnergy: number; // kWh
}

// Grid Services
export interface GridServiceRequest {
  type: 'FREQUENCY_RESPONSE' | 'VOLTAGE_SUPPORT' | 'DEMAND_RESPONSE' | 'PEAK_SHAVING';
  priority: number;
  powerRequired: number; // kW
  durationMinutes: number;
  compensation?: number; // R$ if applicable
}

// Black Start (Grid Restoration)
export type BlackStartState =
  | 'grid_connected'
  | 'blackout_detected'
  | 'transferring'
  | 'island_mode'
  | 'synchronizing'
  | 'resynchronized';

export interface BlackStartEvent {
  systemId: string;
  fromState: BlackStartState;
  toState: BlackStartState;
  timestamp: Date;
  reason: string;
}

// Forecast
export interface EnergyForecast {
  timestamp: Date;
  demandForecast: number; // kW
  priceForecast: number; // R$/MWh
  solarForecast: number; // kW
  confidence: number; // 0-1
  horizonHours: number;
}

// Analytics
export interface OptimizationMetrics {
  systemId: string;
  period: { start: Date; end: Date };
  totalSavings: number; // R$
  energyArbitraged: number; // kWh
  peakReduction: number; // kW average
  selfConsumptionRate: number; // %
  co2Avoided: number; // tons
  batteryDegradation: number; // % of capacity lost
}
