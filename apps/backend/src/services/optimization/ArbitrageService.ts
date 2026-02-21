/**
 * Arbitrage Service - Energy trading optimization
 * Extracts buy/sell logic from frontend EnergyTrading.tsx
 *
 * Core Algorithm:
 * - BUY: When spotPrice < buyThreshold AND SOC < (maxSOC - margin)
 * - SELL: When spotPrice > sellThreshold AND SOC > (minSOC + margin)
 * - Calculate expected profit and required energy
 */

import {
  MarketData,
  SystemTelemetry,
  SystemConstraints,
  ArbitrageOpportunity,
} from '../../../../../packages/shared/src/types/optimization';

export interface ArbitrageConfig {
  enabled: boolean;
  buyThreshold: number; // R$/MWh - buy if price below this
  sellThreshold: number; // R$/MWh - sell if price above this
  minSOCMargin: number; // % - leave this much buffer below minSOC
  maxSOCMargin: number; // % - leave this much buffer above maxSOC
  efficiency: number; // % - round trip efficiency (e.g., 0.92 = 92%)
}

export class ArbitrageService {
  private config: ArbitrageConfig;
  private constraints: SystemConstraints;
  private batteryCapacity: number; // kWh

  constructor(
    config: ArbitrageConfig,
    constraints: SystemConstraints,
    batteryCapacity: number
  ) {
    this.config = config;
    this.constraints = constraints;
    this.batteryCapacity = batteryCapacity;
  }

  /**
   * Evaluate arbitrage opportunity at current market conditions
   */
  public evaluateOpportunity(
    telemetry: SystemTelemetry,
    marketData: MarketData,
    historicalPrices: { low: number; high: number }
  ): ArbitrageOpportunity | null {
    if (!this.config.enabled) return null;

    // BUY: Price is low
    const buyOpportunity = this.evaluateBuyOpportunity(
      telemetry,
      marketData,
      historicalPrices
    );
    if (buyOpportunity) return buyOpportunity;

    // SELL: Price is high
    const sellOpportunity = this.evaluateSellOpportunity(
      telemetry,
      marketData,
      historicalPrices
    );
    return sellOpportunity;
  }

  /**
   * Check if conditions are right to BUY
   */
  private evaluateBuyOpportunity(
    telemetry: SystemTelemetry,
    marketData: MarketData,
    historical: { low: number; high: number }
  ): ArbitrageOpportunity | null {
    const currentPrice = marketData.spotPrice;
    const buyThreshold = this.config.buyThreshold;

    // Condition 1: Price must be below threshold
    if (currentPrice >= buyThreshold) return null;

    // Condition 2: Must have available SOC capacity
    const maxUsableSOC = this.constraints.maxSOC - this.config.maxSOCMargin;
    const availableCapacity = maxUsableSOC - telemetry.soc;

    if (availableCapacity <= 0) return null; // Battery too full

    // Condition 3: Price signal must be strong (at least 10% below threshold)
    const priceSignalStrength = (buyThreshold - currentPrice) / buyThreshold;
    if (priceSignalStrength < 0.1) return null;

    // Calculate expected profit
    const energyToBuy = Math.min(
      (availableCapacity / 100) * this.batteryCapacity, // Available storage
      this.constraints.maxPower * 4 // 4-hour window max
    );

    // Assume sell will happen at average of recent high
    const expectedSellPrice = Math.max(
      this.config.sellThreshold,
      historical.high * 0.95
    );

    const grossProfit =
      energyToBuy * (expectedSellPrice - currentPrice) * 0.001; // Convert MWh to kWh

    const roundTripLoss = energyToBuy * (1 - this.config.efficiency);
    const netProfit = grossProfit - roundTripLoss * (currentPrice * 0.001);

    // Only recommend if profit > R$ 100
    if (netProfit < 100) return null;

    return {
      buyWindow: {
        start: new Date(),
        end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      },
      sellWindow: {
        start: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours later
        end: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours window
      },
      buyPrice: currentPrice,
      sellPrice: expectedSellPrice,
      expectedProfit: netProfit,
      requiredEnergy: energyToBuy,
      confidence: Math.min(0.95, 0.7 + priceSignalStrength),
    };
  }

  /**
   * Check if conditions are right to SELL
   */
  private evaluateSellOpportunity(
    telemetry: SystemTelemetry,
    marketData: MarketData,
    historical: { low: number; high: number }
  ): ArbitrageOpportunity | null {
    const currentPrice = marketData.spotPrice;
    const sellThreshold = this.config.sellThreshold;

    // Condition 1: Price must be above threshold
    if (currentPrice <= sellThreshold) return null;

    // Condition 2: Must have stored energy
    const minUsableSOC = this.constraints.minSOC + this.config.minSOCMargin;
    const availableEnergy = telemetry.soc - minUsableSOC;

    if (availableEnergy <= 0) return null; // Battery too empty

    // Condition 3: Price signal must be strong (at least 10% above threshold)
    const priceSignalStrength = (currentPrice - sellThreshold) / sellThreshold;
    if (priceSignalStrength < 0.1) return null;

    // Calculate expected profit
    const energyToSell = Math.min(
      (availableEnergy / 100) * this.batteryCapacity,
      this.constraints.maxPower * 2 // 2-hour discharge
    );

    // Assume buy happened at average of recent low
    const historicalBuyPrice = Math.min(
      this.config.buyThreshold,
      historical.low * 1.05
    );

    const grossProfit =
      energyToSell * (currentPrice - historicalBuyPrice) * 0.001;

    const roundTripLoss = energyToSell * (1 - this.config.efficiency);
    const netProfit = grossProfit - roundTripLoss * (currentPrice * 0.001);

    if (netProfit < 100) return null;

    return {
      buyWindow: {
        start: new Date(Date.now() - 16 * 60 * 60 * 1000), // 16 hours ago
        end: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      sellWindow: {
        start: new Date(),
        end: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
      buyPrice: historicalBuyPrice,
      sellPrice: currentPrice,
      expectedProfit: netProfit,
      requiredEnergy: energyToSell,
      confidence: Math.min(0.95, 0.7 + priceSignalStrength),
    };
  }

  /**
   * Calculate revenue from completed arbitrage
   * Formula: (sellPrice - buyPrice) * energyArbitraged * efficiency
   */
  public calculateRevenue(
    buyPrice: number,
    sellPrice: number,
    energyArbitraged: number // kWh
  ): number {
    const grossRevenue = (sellPrice - buyPrice) * energyArbitraged * 0.001; // Convert to R$
    return grossRevenue * this.config.efficiency;
  }

  /**
   * Get current market signal strength (0-1)
   * 0 = neutral, 0.5 = moderate opportunity, 1 = strong signal
   */
  public getMarketSignal(
    marketData: MarketData,
    historicalPrices: { low: number; high: number }
  ): number {
    const range = historicalPrices.high - historicalPrices.low;
    if (range === 0) return 0.5;

    const currentPos = marketData.spotPrice - historicalPrices.low;
    const percentile = currentPos / range;

    // Strong signal at extremes
    if (percentile < 0.2) return percentile * 2.5; // Strong buy signal
    if (percentile > 0.8) return (1 - percentile) * 2.5; // Strong sell signal

    return Math.abs(0.5 - percentile) * 2; // Moderate signal in middle
  }
}
