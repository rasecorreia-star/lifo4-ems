/**
 * Risk Manager
 * Manages trading risk exposure and ensures compliance with risk limits.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { Order, Trade, Position, OrderSide } from './trading-engine.service';

// ============================================
// TYPES
// ============================================

export interface RiskLimits {
  maxPositionMWh: number;
  maxDailyVolumeMWh: number;
  maxSingleOrderMWh: number;
  maxDailyLoss: number;
  maxDrawdownPercent: number;
  maxVaR: number;
  maxLeverage: number;
  concentrationLimit: number;  // Max % in single market
}

export interface RiskMetrics {
  currentPositionMWh: number;
  dailyVolumeMWh: number;
  dailyPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  maxDrawdown: number;
  currentDrawdown: number;
  var95: number;
  var99: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  exposureByMarket: Map<string, number>;
}

export interface RiskAlert {
  id: string;
  type: 'warning' | 'critical' | 'breach';
  metric: string;
  currentValue: number;
  limitValue: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface RiskAssessment {
  orderAllowed: boolean;
  adjustedQuantity?: number;
  warnings: string[];
  riskScore: number;
  details: {
    positionCheck: { passed: boolean; message: string };
    volumeCheck: { passed: boolean; message: string };
    lossCheck: { passed: boolean; message: string };
    varCheck: { passed: boolean; message: string };
  };
}

// ============================================
// RISK MANAGER
// ============================================

export class RiskManager extends EventEmitter {
  private static instance: RiskManager;

  private limits: Map<string, RiskLimits> = new Map();
  private metrics: Map<string, RiskMetrics> = new Map();
  private alerts: Map<string, RiskAlert> = new Map();
  private tradeHistory: Map<string, Trade[]> = new Map();
  private pnlHistory: Map<string, number[]> = new Map();

  private alertIdCounter = 0;

  private constructor() {
    super();
  }

  static getInstance(): RiskManager {
    if (!RiskManager.instance) {
      RiskManager.instance = new RiskManager();
    }
    return RiskManager.instance;
  }

  /**
   * Set risk limits for a system
   */
  setRiskLimits(systemId: string, limits: RiskLimits): void {
    this.limits.set(systemId, limits);
    this.initializeMetrics(systemId);
    logger.info(`Risk limits set for system ${systemId}`);
    this.emit('limitsUpdated', { systemId, limits });
  }

  /**
   * Get risk limits
   */
  getRiskLimits(systemId: string): RiskLimits | undefined {
    return this.limits.get(systemId);
  }

  /**
   * Initialize metrics for a system
   */
  private initializeMetrics(systemId: string): void {
    if (!this.metrics.has(systemId)) {
      this.metrics.set(systemId, {
        currentPositionMWh: 0,
        dailyVolumeMWh: 0,
        dailyPnL: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        var95: 0,
        var99: 0,
        sharpeRatio: 0,
        winRate: 0,
        profitFactor: 0,
        exposureByMarket: new Map()
      });
    }
  }

  /**
   * Assess risk for an order before submission
   */
  assessOrderRisk(
    systemId: string,
    side: OrderSide,
    quantityMWh: number,
    pricePerMWh: number
  ): RiskAssessment {
    const limits = this.limits.get(systemId);
    const metrics = this.metrics.get(systemId);

    if (!limits) {
      return {
        orderAllowed: true,
        warnings: ['No risk limits configured'],
        riskScore: 0.5,
        details: {
          positionCheck: { passed: true, message: 'No limits' },
          volumeCheck: { passed: true, message: 'No limits' },
          lossCheck: { passed: true, message: 'No limits' },
          varCheck: { passed: true, message: 'No limits' }
        }
      };
    }

    const warnings: string[] = [];
    let adjustedQuantity = quantityMWh;

    // Position limit check
    const newPosition = side === OrderSide.BUY
      ? (metrics?.currentPositionMWh || 0) + quantityMWh
      : (metrics?.currentPositionMWh || 0) - quantityMWh;

    const positionCheck = {
      passed: Math.abs(newPosition) <= limits.maxPositionMWh,
      message: `Position: ${Math.abs(newPosition).toFixed(2)} / ${limits.maxPositionMWh} MWh`
    };

    if (!positionCheck.passed) {
      const maxAllowed = limits.maxPositionMWh - Math.abs(metrics?.currentPositionMWh || 0);
      adjustedQuantity = Math.min(quantityMWh, maxAllowed);
      warnings.push(`Order size reduced to ${adjustedQuantity.toFixed(2)} MWh due to position limit`);
    }

    // Single order limit
    if (quantityMWh > limits.maxSingleOrderMWh) {
      adjustedQuantity = Math.min(adjustedQuantity, limits.maxSingleOrderMWh);
      warnings.push(`Order size reduced to ${adjustedQuantity.toFixed(2)} MWh due to single order limit`);
    }

    // Daily volume check
    const newVolume = (metrics?.dailyVolumeMWh || 0) + quantityMWh;
    const volumeCheck = {
      passed: newVolume <= limits.maxDailyVolumeMWh,
      message: `Daily volume: ${newVolume.toFixed(2)} / ${limits.maxDailyVolumeMWh} MWh`
    };

    if (!volumeCheck.passed) {
      warnings.push('Daily volume limit would be exceeded');
    }

    // Loss limit check
    const potentialLoss = side === OrderSide.BUY ? quantityMWh * pricePerMWh : 0;
    const lossCheck = {
      passed: (metrics?.dailyPnL || 0) - potentialLoss > -limits.maxDailyLoss,
      message: `Daily P&L: ${(metrics?.dailyPnL || 0).toFixed(2)} / -${limits.maxDailyLoss}`
    };

    if (!lossCheck.passed) {
      warnings.push('Daily loss limit at risk');
    }

    // VaR check
    const varCheck = {
      passed: (metrics?.var95 || 0) <= limits.maxVaR,
      message: `VaR 95%: ${(metrics?.var95 || 0).toFixed(2)} / ${limits.maxVaR}`
    };

    if (!varCheck.passed) {
      warnings.push('Value at Risk limit exceeded');
    }

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(metrics, limits, quantityMWh);

    const orderAllowed = positionCheck.passed && volumeCheck.passed &&
                        lossCheck.passed && adjustedQuantity > 0;

    return {
      orderAllowed,
      adjustedQuantity: adjustedQuantity !== quantityMWh ? adjustedQuantity : undefined,
      warnings,
      riskScore,
      details: {
        positionCheck,
        volumeCheck,
        lossCheck,
        varCheck
      }
    };
  }

  /**
   * Record trade and update metrics
   */
  recordTrade(trade: Trade): void {
    const systemId = trade.systemId;
    this.initializeMetrics(systemId);

    const metrics = this.metrics.get(systemId)!;
    const history = this.tradeHistory.get(systemId) || [];

    // Update position
    if (trade.side === OrderSide.BUY) {
      metrics.currentPositionMWh += trade.quantityMWh;
    } else {
      metrics.currentPositionMWh -= trade.quantityMWh;
    }

    // Update volume
    metrics.dailyVolumeMWh += trade.quantityMWh;

    // Update P&L
    metrics.realizedPnL += trade.netValue;
    metrics.dailyPnL += trade.netValue;

    // Update trade history
    history.push(trade);
    this.tradeHistory.set(systemId, history);

    // Update win rate and profit factor
    this.updatePerformanceMetrics(systemId);

    // Update VaR
    this.updateVaR(systemId);

    // Check for alerts
    this.checkLimits(systemId);

    this.emit('tradeRecorded', { systemId, trade, metrics });
  }

  /**
   * Update unrealized P&L
   */
  updateUnrealizedPnL(systemId: string, positions: Position[]): void {
    const metrics = this.metrics.get(systemId);
    if (!metrics) return;

    metrics.unrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    // Update drawdown
    const totalPnL = metrics.realizedPnL + metrics.unrealizedPnL;
    const pnlHistory = this.pnlHistory.get(systemId) || [];
    pnlHistory.push(totalPnL);
    this.pnlHistory.set(systemId, pnlHistory);

    const peak = Math.max(...pnlHistory);
    metrics.currentDrawdown = peak - totalPnL;
    metrics.maxDrawdown = Math.max(metrics.maxDrawdown, metrics.currentDrawdown);

    this.checkLimits(systemId);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(systemId: string): void {
    const history = this.tradeHistory.get(systemId) || [];
    const metrics = this.metrics.get(systemId)!;

    if (history.length === 0) return;

    // Win rate
    const winningTrades = history.filter(t => t.netValue > 0).length;
    metrics.winRate = winningTrades / history.length;

    // Profit factor
    const grossProfit = history.filter(t => t.netValue > 0).reduce((sum, t) => sum + t.netValue, 0);
    const grossLoss = Math.abs(history.filter(t => t.netValue < 0).reduce((sum, t) => sum + t.netValue, 0));
    metrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Sharpe ratio (simplified, using daily returns)
    const returns = history.map(t => t.netValue / Math.abs(t.totalValue));
    if (returns.length > 1) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    }
  }

  /**
   * Update Value at Risk
   */
  private updateVaR(systemId: string): void {
    const history = this.tradeHistory.get(systemId) || [];
    const metrics = this.metrics.get(systemId)!;

    if (history.length < 10) return;

    // Get returns
    const returns = history.map(t => t.netValue);
    returns.sort((a, b) => a - b);

    // VaR 95%
    const var95Index = Math.floor(returns.length * 0.05);
    metrics.var95 = Math.abs(returns[var95Index] || 0);

    // VaR 99%
    const var99Index = Math.floor(returns.length * 0.01);
    metrics.var99 = Math.abs(returns[var99Index] || 0);
  }

  /**
   * Check limits and generate alerts
   */
  private checkLimits(systemId: string): void {
    const limits = this.limits.get(systemId);
    const metrics = this.metrics.get(systemId);

    if (!limits || !metrics) return;

    // Position limit
    if (Math.abs(metrics.currentPositionMWh) > limits.maxPositionMWh * 0.9) {
      this.createAlert(systemId, 'warning', 'position',
        Math.abs(metrics.currentPositionMWh), limits.maxPositionMWh,
        'Position approaching limit');
    }
    if (Math.abs(metrics.currentPositionMWh) > limits.maxPositionMWh) {
      this.createAlert(systemId, 'breach', 'position',
        Math.abs(metrics.currentPositionMWh), limits.maxPositionMWh,
        'Position limit breached');
    }

    // Daily loss limit
    if (metrics.dailyPnL < -limits.maxDailyLoss * 0.8) {
      this.createAlert(systemId, 'warning', 'dailyLoss',
        Math.abs(metrics.dailyPnL), limits.maxDailyLoss,
        'Approaching daily loss limit');
    }
    if (metrics.dailyPnL < -limits.maxDailyLoss) {
      this.createAlert(systemId, 'critical', 'dailyLoss',
        Math.abs(metrics.dailyPnL), limits.maxDailyLoss,
        'Daily loss limit breached - trading should be halted');
    }

    // Drawdown limit
    const drawdownPercent = metrics.maxDrawdown / (metrics.realizedPnL + 10000) * 100;
    if (drawdownPercent > limits.maxDrawdownPercent * 0.8) {
      this.createAlert(systemId, 'warning', 'drawdown',
        drawdownPercent, limits.maxDrawdownPercent,
        'Drawdown approaching limit');
    }

    // VaR limit
    if (metrics.var95 > limits.maxVaR * 0.9) {
      this.createAlert(systemId, 'warning', 'var',
        metrics.var95, limits.maxVaR,
        'VaR approaching limit');
    }
  }

  /**
   * Create risk alert
   */
  private createAlert(
    systemId: string,
    type: RiskAlert['type'],
    metric: string,
    currentValue: number,
    limitValue: number,
    message: string
  ): void {
    const alertId = `ALT-${++this.alertIdCounter}`;

    const alert: RiskAlert = {
      id: alertId,
      type,
      metric,
      currentValue,
      limitValue,
      message: `[${systemId}] ${message}`,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.set(alertId, alert);
    this.emit('riskAlert', alert);

    if (type === 'critical' || type === 'breach') {
      logger.error(`RISK ALERT: ${alert.message}`);
    } else {
      logger.warn(`Risk Warning: ${alert.message}`);
    }
  }

  /**
   * Get risk metrics
   */
  getRiskMetrics(systemId: string): RiskMetrics | undefined {
    return this.metrics.get(systemId);
  }

  /**
   * Get active alerts
   */
  getAlerts(systemId?: string, unacknowledgedOnly: boolean = false): RiskAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (systemId) {
      alerts = alerts.filter(a => a.message.includes(systemId));
    }

    if (unacknowledgedOnly) {
      alerts = alerts.filter(a => !a.acknowledged);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(
    metrics: RiskMetrics | undefined,
    limits: RiskLimits,
    additionalQuantity: number
  ): number {
    if (!metrics) return 0.5;

    let score = 0;

    // Position utilization (0-30%)
    const positionUtil = Math.abs(metrics.currentPositionMWh + additionalQuantity) / limits.maxPositionMWh;
    score += Math.min(0.3, positionUtil * 0.3);

    // Volume utilization (0-20%)
    const volumeUtil = metrics.dailyVolumeMWh / limits.maxDailyVolumeMWh;
    score += Math.min(0.2, volumeUtil * 0.2);

    // Loss proximity (0-25%)
    const lossUtil = Math.abs(metrics.dailyPnL) / limits.maxDailyLoss;
    score += Math.min(0.25, lossUtil * 0.25);

    // VaR utilization (0-25%)
    const varUtil = metrics.var95 / limits.maxVaR;
    score += Math.min(0.25, varUtil * 0.25);

    return Math.min(1, score);
  }

  /**
   * Reset daily metrics
   */
  resetDailyMetrics(systemId: string): void {
    const metrics = this.metrics.get(systemId);
    if (metrics) {
      metrics.dailyVolumeMWh = 0;
      metrics.dailyPnL = 0;
      logger.info(`Daily metrics reset for ${systemId}`);
    }
  }

  /**
   * Get risk summary
   */
  getRiskSummary(systemId: string): {
    status: 'green' | 'yellow' | 'red';
    metrics: RiskMetrics | undefined;
    limits: RiskLimits | undefined;
    activeAlerts: number;
    riskScore: number;
  } {
    const metrics = this.metrics.get(systemId);
    const limits = this.limits.get(systemId);
    const alerts = this.getAlerts(systemId, true);

    const riskScore = limits ? this.calculateRiskScore(metrics, limits, 0) : 0;

    let status: 'green' | 'yellow' | 'red';
    if (alerts.some(a => a.type === 'critical' || a.type === 'breach')) {
      status = 'red';
    } else if (alerts.some(a => a.type === 'warning') || riskScore > 0.7) {
      status = 'yellow';
    } else {
      status = 'green';
    }

    return {
      status,
      metrics,
      limits,
      activeAlerts: alerts.length,
      riskScore
    };
  }
}

// Export singleton
export const riskManager = RiskManager.getInstance();
