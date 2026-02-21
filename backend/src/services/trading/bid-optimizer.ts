/**
 * Bid Optimizer
 * Optimizes bids for energy trading based on market conditions and battery state.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { MarketType, OrderSide } from './trading-engine.service';
import { SubmarketRegion } from './market-connector.service';

// ============================================
// TYPES
// ============================================

export interface BidStrategy {
  name: string;
  description: string;
  minSpread: number;
  maxPositionMWh: number;
  riskTolerance: 'low' | 'medium' | 'high';
  targetProfit: number;
  stopLoss: number;
}

export interface BatteryState {
  soc: number;           // State of charge (0-100)
  availableCapacityMWh: number;
  maxChargeMW: number;
  maxDischargeMW: number;
  efficiency: number;
  currentCostPerMWh: number;  // Average cost of stored energy
}

export interface MarketConditions {
  currentPrice: number;
  priceHistory: number[];
  volatility: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  spread: number;
  liquidity: number;
}

export interface OptimalBid {
  side: OrderSide;
  quantityMWh: number;
  price: number;
  confidence: number;
  expectedProfit: number;
  riskScore: number;
  rationale: string;
  validUntil: Date;
}

export interface BidResult {
  bids: OptimalBid[];
  marketAnalysis: {
    trend: string;
    volatility: number;
    recommendation: string;
  };
  batteryAnalysis: {
    optimalSOC: number;
    chargeOpportunity: boolean;
    dischargeOpportunity: boolean;
  };
  timestamp: Date;
}

// ============================================
// BID OPTIMIZER
// ============================================

export class BidOptimizer extends EventEmitter {
  private static instance: BidOptimizer;

  private strategies: Map<string, BidStrategy> = new Map();
  private activeStrategy: BidStrategy;

  private constructor() {
    super();
    this.initializeStrategies();
    this.activeStrategy = this.strategies.get('balanced')!;
  }

  static getInstance(): BidOptimizer {
    if (!BidOptimizer.instance) {
      BidOptimizer.instance = new BidOptimizer();
    }
    return BidOptimizer.instance;
  }

  private initializeStrategies(): void {
    this.strategies.set('conservative', {
      name: 'Conservative',
      description: 'Low risk, stable returns',
      minSpread: 15,
      maxPositionMWh: 50,
      riskTolerance: 'low',
      targetProfit: 0.05,
      stopLoss: 0.02
    });

    this.strategies.set('balanced', {
      name: 'Balanced',
      description: 'Moderate risk, balanced returns',
      minSpread: 10,
      maxPositionMWh: 100,
      riskTolerance: 'medium',
      targetProfit: 0.10,
      stopLoss: 0.05
    });

    this.strategies.set('aggressive', {
      name: 'Aggressive',
      description: 'Higher risk, higher potential returns',
      minSpread: 5,
      maxPositionMWh: 200,
      riskTolerance: 'high',
      targetProfit: 0.20,
      stopLoss: 0.10
    });
  }

  /**
   * Set active strategy
   */
  setStrategy(strategyName: string): void {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      this.activeStrategy = strategy;
      logger.info(`Bid strategy set to: ${strategyName}`);
      this.emit('strategyChanged', strategy);
    }
  }

  /**
   * Get available strategies
   */
  getStrategies(): BidStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Optimize bids based on current conditions
   */
  optimizeBids(
    batteryState: BatteryState,
    marketConditions: MarketConditions,
    targetMarket: MarketType
  ): BidResult {
    const bids: OptimalBid[] = [];

    // Analyze market
    const marketAnalysis = this.analyzeMarket(marketConditions);

    // Analyze battery
    const batteryAnalysis = this.analyzeBattery(batteryState, marketConditions);

    // Generate charge bid if opportunity exists
    if (batteryAnalysis.chargeOpportunity) {
      const chargeBid = this.generateChargeBid(batteryState, marketConditions);
      if (chargeBid) bids.push(chargeBid);
    }

    // Generate discharge bid if opportunity exists
    if (batteryAnalysis.dischargeOpportunity) {
      const dischargeBid = this.generateDischargeBid(batteryState, marketConditions);
      if (dischargeBid) bids.push(dischargeBid);
    }

    // Generate arbitrage bids
    const arbitrageBids = this.generateArbitrageBids(batteryState, marketConditions);
    bids.push(...arbitrageBids);

    // Sort by expected profit
    bids.sort((a, b) => b.expectedProfit - a.expectedProfit);

    const result: BidResult = {
      bids,
      marketAnalysis,
      batteryAnalysis,
      timestamp: new Date()
    };

    this.emit('bidsOptimized', result);
    return result;
  }

  /**
   * Analyze market conditions
   */
  private analyzeMarket(conditions: MarketConditions): {
    trend: string;
    volatility: number;
    recommendation: string;
  } {
    const { priceHistory, volatility, trend, spread } = conditions;

    // Calculate price momentum
    const recentPrices = priceHistory.slice(-5);
    const oldPrices = priceHistory.slice(-10, -5);
    const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const oldAvg = oldPrices.length > 0
      ? oldPrices.reduce((a, b) => a + b, 0) / oldPrices.length
      : recentAvg;

    const momentum = (recentAvg - oldAvg) / oldAvg;

    let recommendation: string;
    if (volatility > 0.15) {
      recommendation = 'High volatility - consider reducing position sizes';
    } else if (trend === 'bullish' && momentum > 0.02) {
      recommendation = 'Strong upward trend - favor sell positions';
    } else if (trend === 'bearish' && momentum < -0.02) {
      recommendation = 'Strong downward trend - favor buy positions';
    } else if (spread < this.activeStrategy.minSpread) {
      recommendation = 'Spread too tight - wait for better opportunities';
    } else {
      recommendation = 'Normal conditions - execute balanced strategy';
    }

    return {
      trend: trend,
      volatility,
      recommendation
    };
  }

  /**
   * Analyze battery state
   */
  private analyzeBattery(
    battery: BatteryState,
    market: MarketConditions
  ): {
    optimalSOC: number;
    chargeOpportunity: boolean;
    dischargeOpportunity: boolean;
  } {
    // Optimal SOC based on market conditions
    let optimalSOC: number;
    if (market.trend === 'bullish') {
      optimalSOC = 80; // Keep more energy for selling
    } else if (market.trend === 'bearish') {
      optimalSOC = 40; // Keep capacity for buying
    } else {
      optimalSOC = 60; // Neutral
    }

    // Charge opportunity: price below cost and SOC below optimal
    const chargeOpportunity = market.currentPrice < battery.currentCostPerMWh * 0.95
      && battery.soc < optimalSOC + 10;

    // Discharge opportunity: price above cost with margin and SOC above minimum
    const dischargeOpportunity = market.currentPrice > battery.currentCostPerMWh * (1 + this.activeStrategy.targetProfit)
      && battery.soc > 30;

    return {
      optimalSOC,
      chargeOpportunity,
      dischargeOpportunity
    };
  }

  /**
   * Generate charge bid
   */
  private generateChargeBid(
    battery: BatteryState,
    market: MarketConditions
  ): OptimalBid | null {
    if (battery.soc >= 90) return null;

    // Calculate optimal charge quantity
    const availableCapacity = (90 - battery.soc) / 100 * battery.availableCapacityMWh;
    const maxByPower = battery.maxChargeMW;
    const maxByStrategy = this.activeStrategy.maxPositionMWh;

    const quantity = Math.min(availableCapacity, maxByPower, maxByStrategy);
    if (quantity < 1) return null;

    // Calculate optimal price
    const targetPrice = market.currentPrice * 0.98; // Bid slightly below market
    const expectedCost = quantity * targetPrice;
    const expectedProfit = (battery.currentCostPerMWh - targetPrice) * quantity / battery.currentCostPerMWh;

    // Calculate confidence and risk
    const confidence = this.calculateConfidence(market, 'buy');
    const riskScore = this.calculateRiskScore(market, quantity, 'buy');

    if (riskScore > this.getRiskThreshold()) {
      return null; // Too risky
    }

    return {
      side: OrderSide.BUY,
      quantityMWh: quantity,
      price: targetPrice,
      confidence,
      expectedProfit: expectedProfit * quantity,
      riskScore,
      rationale: `Charge opportunity: current price ${market.currentPrice.toFixed(2)} below cost ${battery.currentCostPerMWh.toFixed(2)}`,
      validUntil: new Date(Date.now() + 300000) // 5 minutes
    };
  }

  /**
   * Generate discharge bid
   */
  private generateDischargeBid(
    battery: BatteryState,
    market: MarketConditions
  ): OptimalBid | null {
    if (battery.soc <= 20) return null;

    // Calculate optimal discharge quantity
    const availableEnergy = (battery.soc - 20) / 100 * battery.availableCapacityMWh;
    const maxByPower = battery.maxDischargeMW;
    const maxByStrategy = this.activeStrategy.maxPositionMWh;

    const quantity = Math.min(availableEnergy, maxByPower, maxByStrategy);
    if (quantity < 1) return null;

    // Calculate optimal price
    const minPrice = battery.currentCostPerMWh * (1 + this.activeStrategy.targetProfit) / battery.efficiency;
    const targetPrice = Math.max(minPrice, market.currentPrice * 1.01); // Ask slightly above market

    const revenue = quantity * targetPrice;
    const cost = quantity * battery.currentCostPerMWh;
    const expectedProfit = (revenue - cost) * battery.efficiency;

    // Calculate confidence and risk
    const confidence = this.calculateConfidence(market, 'sell');
    const riskScore = this.calculateRiskScore(market, quantity, 'sell');

    if (riskScore > this.getRiskThreshold() || expectedProfit < 0) {
      return null;
    }

    return {
      side: OrderSide.SELL,
      quantityMWh: quantity,
      price: targetPrice,
      confidence,
      expectedProfit,
      riskScore,
      rationale: `Discharge opportunity: target price ${targetPrice.toFixed(2)} provides ${(expectedProfit / cost * 100).toFixed(1)}% profit`,
      validUntil: new Date(Date.now() + 300000)
    };
  }

  /**
   * Generate arbitrage bids
   */
  private generateArbitrageBids(
    battery: BatteryState,
    market: MarketConditions
  ): OptimalBid[] {
    const bids: OptimalBid[] = [];

    // Only consider arbitrage if spread is sufficient
    if (market.spread < this.activeStrategy.minSpread) {
      return bids;
    }

    // Spread arbitrage: buy at bid, sell at ask
    const spreadProfit = market.spread * battery.efficiency - (market.currentPrice * 0.002); // Account for fees
    if (spreadProfit > 0) {
      const quantity = Math.min(
        battery.availableCapacityMWh * 0.1, // Use 10% of capacity
        this.activeStrategy.maxPositionMWh * 0.5
      );

      bids.push({
        side: OrderSide.BUY,
        quantityMWh: quantity,
        price: market.currentPrice - market.spread / 2,
        confidence: 0.6,
        expectedProfit: spreadProfit * quantity,
        riskScore: 0.3,
        rationale: `Spread arbitrage: ${market.spread.toFixed(2)}/MWh spread`,
        validUntil: new Date(Date.now() + 60000) // 1 minute
      });
    }

    return bids;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(market: MarketConditions, side: 'buy' | 'sell'): number {
    let confidence = 0.5;

    // Trend alignment
    if ((side === 'buy' && market.trend === 'bearish') ||
        (side === 'sell' && market.trend === 'bullish')) {
      confidence += 0.2;
    }

    // Volatility penalty
    confidence -= market.volatility * 0.5;

    // Liquidity bonus
    if (market.liquidity > 100) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    market: MarketConditions,
    quantity: number,
    side: 'buy' | 'sell'
  ): number {
    let risk = 0.2;

    // Volatility risk
    risk += market.volatility * 0.5;

    // Position size risk
    risk += (quantity / this.activeStrategy.maxPositionMWh) * 0.2;

    // Counter-trend risk
    if ((side === 'buy' && market.trend === 'bullish') ||
        (side === 'sell' && market.trend === 'bearish')) {
      risk += 0.2;
    }

    return Math.min(1, risk);
  }

  /**
   * Get risk threshold based on strategy
   */
  private getRiskThreshold(): number {
    switch (this.activeStrategy.riskTolerance) {
      case 'low': return 0.3;
      case 'medium': return 0.5;
      case 'high': return 0.7;
      default: return 0.5;
    }
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  calculateVaR(
    positionMWh: number,
    priceHistory: number[],
    confidenceLevel: number = 0.95
  ): number {
    if (priceHistory.length < 2) return 0;

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < priceHistory.length; i++) {
      returns.push((priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1]);
    }

    // Sort returns
    returns.sort((a, b) => a - b);

    // Get VaR percentile
    const index = Math.floor(returns.length * (1 - confidenceLevel));
    const varReturn = returns[index] || returns[0];

    // Calculate VaR in currency
    const currentPrice = priceHistory[priceHistory.length - 1];
    return Math.abs(varReturn * positionMWh * currentPrice);
  }
}

// Export singleton
export const bidOptimizer = BidOptimizer.getInstance();
