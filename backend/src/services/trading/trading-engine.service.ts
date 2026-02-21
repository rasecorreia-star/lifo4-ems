/**
 * Trading Engine Service
 * Manages energy trading operations for BESS in wholesale and retail markets.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export enum MarketType {
  DAY_AHEAD = 'day_ahead',
  INTRADAY = 'intraday',
  REAL_TIME = 'real_time',
  ANCILLARY = 'ancillary',
  CAPACITY = 'capacity'
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit'
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

export enum OrderStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  PARTIAL = 'partial',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export enum TradingStrategy {
  ARBITRAGE = 'arbitrage',
  PEAK_SHAVING = 'peak_shaving',
  FREQUENCY_REGULATION = 'frequency_regulation',
  DEMAND_RESPONSE = 'demand_response',
  CAPACITY_MARKET = 'capacity_market',
  HYBRID = 'hybrid'
}

export interface MarketData {
  timestamp: Date;
  market: MarketType;
  pricePerMWh: number;
  volumeMW: number;
  bidPrice: number;
  askPrice: number;
  spread: number;
  volatility: number;
}

export interface Order {
  id: string;
  systemId: string;
  market: MarketType;
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  quantityMWh: number;
  filledQuantityMWh: number;
  pricePerMWh: number;
  limitPrice?: number;
  stopPrice?: number;
  createdAt: Date;
  submittedAt?: Date;
  filledAt?: Date;
  expiresAt?: Date;
  settlementPeriod: string;
  notes?: string;
}

export interface Trade {
  id: string;
  orderId: string;
  systemId: string;
  market: MarketType;
  side: OrderSide;
  quantityMWh: number;
  pricePerMWh: number;
  totalValue: number;
  fees: number;
  netValue: number;
  executedAt: Date;
  settlementDate: Date;
  counterparty?: string;
}

export interface Position {
  systemId: string;
  market: MarketType;
  settlementPeriod: string;
  longQuantityMWh: number;
  shortQuantityMWh: number;
  netPositionMWh: number;
  averagePrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface TradingSession {
  id: string;
  systemId: string;
  strategy: TradingStrategy;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'paused' | 'stopped';
  totalTrades: number;
  totalVolumeMWh: number;
  totalPnL: number;
  winRate: number;
}

export interface TradingConfig {
  systemId: string;
  strategy: TradingStrategy;
  maxOrderSizeMWh: number;
  maxDailyVolumeMWh: number;
  maxPositionMWh: number;
  minSpreadForArbitrage: number;
  riskLimitPercent: number;
  autoTradingEnabled: boolean;
  markets: MarketType[];
  tradingHours: { start: number; end: number };
}

// ============================================
// TRADING ENGINE SERVICE
// ============================================

export class TradingEngineService extends EventEmitter {
  private static instance: TradingEngineService;

  private orders: Map<string, Order> = new Map();
  private trades: Map<string, Trade> = new Map();
  private positions: Map<string, Position> = new Map();
  private sessions: Map<string, TradingSession> = new Map();
  private configs: Map<string, TradingConfig> = new Map();
  private marketData: Map<MarketType, MarketData> = new Map();

  private orderIdCounter = 0;
  private tradeIdCounter = 0;

  private constructor() {
    super();
    this.initializeMarketData();
  }

  static getInstance(): TradingEngineService {
    if (!TradingEngineService.instance) {
      TradingEngineService.instance = new TradingEngineService();
    }
    return TradingEngineService.instance;
  }

  private initializeMarketData(): void {
    // Initialize with simulated market data
    const markets = [
      MarketType.DAY_AHEAD,
      MarketType.INTRADAY,
      MarketType.REAL_TIME,
      MarketType.ANCILLARY
    ];

    for (const market of markets) {
      this.marketData.set(market, {
        timestamp: new Date(),
        market,
        pricePerMWh: 150 + Math.random() * 100,
        volumeMW: 1000 + Math.random() * 500,
        bidPrice: 145 + Math.random() * 100,
        askPrice: 155 + Math.random() * 100,
        spread: 10,
        volatility: 0.1 + Math.random() * 0.1
      });
    }
  }

  /**
   * Configure trading for a system
   */
  configureTrading(config: TradingConfig): void {
    this.configs.set(config.systemId, config);
    logger.info(`Trading configured for system ${config.systemId}`);
    this.emit('tradingConfigured', config);
  }

  /**
   * Get trading configuration
   */
  getConfig(systemId: string): TradingConfig | undefined {
    return this.configs.get(systemId);
  }

  /**
   * Start trading session
   */
  startSession(systemId: string, strategy: TradingStrategy): TradingSession {
    const sessionId = `session-${systemId}-${Date.now()}`;

    const session: TradingSession = {
      id: sessionId,
      systemId,
      strategy,
      startedAt: new Date(),
      status: 'active',
      totalTrades: 0,
      totalVolumeMWh: 0,
      totalPnL: 0,
      winRate: 0
    };

    this.sessions.set(sessionId, session);
    logger.info(`Trading session started: ${sessionId}`);
    this.emit('sessionStarted', session);

    return session;
  }

  /**
   * Stop trading session
   */
  stopSession(sessionId: string): TradingSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      session.endedAt = new Date();
      this.emit('sessionStopped', session);
    }
    return session;
  }

  /**
   * Submit order to market
   */
  async submitOrder(
    systemId: string,
    market: MarketType,
    side: OrderSide,
    quantityMWh: number,
    type: OrderType = OrderType.MARKET,
    limitPrice?: number
  ): Promise<Order> {
    const config = this.configs.get(systemId);

    // Validate order
    if (config) {
      if (quantityMWh > config.maxOrderSizeMWh) {
        throw new Error(`Order size ${quantityMWh} MWh exceeds max ${config.maxOrderSizeMWh} MWh`);
      }

      if (!config.markets.includes(market)) {
        throw new Error(`Market ${market} not enabled for system ${systemId}`);
      }
    }

    const orderId = `ORD-${++this.orderIdCounter}`;
    const marketData = this.marketData.get(market);
    const price = limitPrice || (side === OrderSide.BUY ? marketData?.askPrice : marketData?.bidPrice) || 150;

    const order: Order = {
      id: orderId,
      systemId,
      market,
      type,
      side,
      status: OrderStatus.PENDING,
      quantityMWh,
      filledQuantityMWh: 0,
      pricePerMWh: price,
      limitPrice,
      createdAt: new Date(),
      settlementPeriod: this.getCurrentSettlementPeriod()
    };

    this.orders.set(orderId, order);

    // Simulate order processing
    await this.processOrder(order);

    return order;
  }

  /**
   * Process order (simulate exchange interaction)
   */
  private async processOrder(order: Order): Promise<void> {
    order.status = OrderStatus.SUBMITTED;
    order.submittedAt = new Date();
    this.emit('orderSubmitted', order);

    // Simulate market execution
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // High fill rate for simulation
    const fillRate = 0.9 + Math.random() * 0.1;
    order.filledQuantityMWh = order.quantityMWh * fillRate;
    order.status = order.filledQuantityMWh >= order.quantityMWh * 0.99
      ? OrderStatus.FILLED
      : OrderStatus.PARTIAL;
    order.filledAt = new Date();

    // Create trade
    if (order.filledQuantityMWh > 0) {
      await this.createTrade(order);
    }

    this.emit('orderFilled', order);
  }

  /**
   * Create trade from filled order
   */
  private async createTrade(order: Order): Promise<Trade> {
    const tradeId = `TRD-${++this.tradeIdCounter}`;
    const totalValue = order.filledQuantityMWh * order.pricePerMWh;
    const fees = totalValue * 0.001; // 0.1% fee

    const trade: Trade = {
      id: tradeId,
      orderId: order.id,
      systemId: order.systemId,
      market: order.market,
      side: order.side,
      quantityMWh: order.filledQuantityMWh,
      pricePerMWh: order.pricePerMWh,
      totalValue,
      fees,
      netValue: order.side === OrderSide.SELL ? totalValue - fees : -(totalValue + fees),
      executedAt: new Date(),
      settlementDate: this.getSettlementDate(order.market)
    };

    this.trades.set(tradeId, trade);

    // Update position
    this.updatePosition(trade);

    // Update session
    this.updateSession(order.systemId, trade);

    this.emit('tradeExecuted', trade);
    logger.info(`Trade executed: ${tradeId} - ${trade.side} ${trade.quantityMWh} MWh @ ${trade.pricePerMWh}/MWh`);

    return trade;
  }

  /**
   * Update position after trade
   */
  private updatePosition(trade: Trade): void {
    const positionKey = `${trade.systemId}-${trade.market}-${this.getCurrentSettlementPeriod()}`;
    let position = this.positions.get(positionKey);

    if (!position) {
      position = {
        systemId: trade.systemId,
        market: trade.market,
        settlementPeriod: this.getCurrentSettlementPeriod(),
        longQuantityMWh: 0,
        shortQuantityMWh: 0,
        netPositionMWh: 0,
        averagePrice: 0,
        unrealizedPnL: 0,
        realizedPnL: 0
      };
    }

    if (trade.side === OrderSide.BUY) {
      const totalCost = position.longQuantityMWh * position.averagePrice + trade.totalValue;
      position.longQuantityMWh += trade.quantityMWh;
      position.averagePrice = totalCost / position.longQuantityMWh;
    } else {
      position.shortQuantityMWh += trade.quantityMWh;
      position.realizedPnL += trade.netValue;
    }

    position.netPositionMWh = position.longQuantityMWh - position.shortQuantityMWh;
    this.positions.set(positionKey, position);
    this.emit('positionUpdated', position);
  }

  /**
   * Update trading session stats
   */
  private updateSession(systemId: string, trade: Trade): void {
    for (const session of this.sessions.values()) {
      if (session.systemId === systemId && session.status === 'active') {
        session.totalTrades++;
        session.totalVolumeMWh += trade.quantityMWh;
        session.totalPnL += trade.netValue;
        // Simple win rate: positive trades
        if (trade.netValue > 0) {
          session.winRate = (session.winRate * (session.totalTrades - 1) + 1) / session.totalTrades;
        } else {
          session.winRate = (session.winRate * (session.totalTrades - 1)) / session.totalTrades;
        }
        break;
      }
    }
  }

  /**
   * Cancel order
   */
  cancelOrder(orderId: string): Order | undefined {
    const order = this.orders.get(orderId);
    if (order && order.status === OrderStatus.PENDING || order?.status === OrderStatus.SUBMITTED) {
      order.status = OrderStatus.CANCELLED;
      this.emit('orderCancelled', order);
      return order;
    }
    return undefined;
  }

  /**
   * Get current market data
   */
  getMarketData(market: MarketType): MarketData | undefined {
    return this.marketData.get(market);
  }

  /**
   * Update market data
   */
  updateMarketData(data: MarketData): void {
    this.marketData.set(data.market, data);
    this.emit('marketDataUpdated', data);
  }

  /**
   * Get all market data
   */
  getAllMarketData(): MarketData[] {
    return Array.from(this.marketData.values());
  }

  /**
   * Get orders for system
   */
  getOrders(systemId: string, status?: OrderStatus): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.systemId === systemId && (!status || o.status === status));
  }

  /**
   * Get trades for system
   */
  getTrades(systemId: string, startDate?: Date, endDate?: Date): Trade[] {
    return Array.from(this.trades.values())
      .filter(t => {
        if (t.systemId !== systemId) return false;
        if (startDate && t.executedAt < startDate) return false;
        if (endDate && t.executedAt > endDate) return false;
        return true;
      });
  }

  /**
   * Get positions for system
   */
  getPositions(systemId: string): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.systemId === systemId);
  }

  /**
   * Get trading summary
   */
  getTradingSummary(systemId: string): {
    totalTrades: number;
    totalVolumeMWh: number;
    totalPnL: number;
    avgTradeSize: number;
    winRate: number;
    bestTrade: Trade | null;
    worstTrade: Trade | null;
  } {
    const trades = this.getTrades(systemId);

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalVolumeMWh: 0,
        totalPnL: 0,
        avgTradeSize: 0,
        winRate: 0,
        bestTrade: null,
        worstTrade: null
      };
    }

    const totalVolume = trades.reduce((sum, t) => sum + t.quantityMWh, 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.netValue, 0);
    const winningTrades = trades.filter(t => t.netValue > 0).length;

    const sortedByPnL = [...trades].sort((a, b) => b.netValue - a.netValue);

    return {
      totalTrades: trades.length,
      totalVolumeMWh: totalVolume,
      totalPnL,
      avgTradeSize: totalVolume / trades.length,
      winRate: winningTrades / trades.length,
      bestTrade: sortedByPnL[0],
      worstTrade: sortedByPnL[sortedByPnL.length - 1]
    };
  }

  /**
   * Execute arbitrage opportunity
   */
  async executeArbitrage(
    systemId: string,
    buyMarket: MarketType,
    sellMarket: MarketType,
    quantityMWh: number
  ): Promise<{ buyOrder: Order; sellOrder: Order; profit: number }> {
    const buyData = this.marketData.get(buyMarket);
    const sellData = this.marketData.get(sellMarket);

    if (!buyData || !sellData) {
      throw new Error('Market data not available');
    }

    const spread = sellData.bidPrice - buyData.askPrice;
    if (spread <= 0) {
      throw new Error(`No arbitrage opportunity: spread is ${spread}`);
    }

    // Execute both sides
    const buyOrder = await this.submitOrder(systemId, buyMarket, OrderSide.BUY, quantityMWh);
    const sellOrder = await this.submitOrder(systemId, sellMarket, OrderSide.SELL, quantityMWh);

    const profit = (sellOrder.filledQuantityMWh * sellOrder.pricePerMWh) -
                   (buyOrder.filledQuantityMWh * buyOrder.pricePerMWh);

    logger.info(`Arbitrage executed: profit = ${profit.toFixed(2)}`);
    this.emit('arbitrageExecuted', { buyOrder, sellOrder, profit });

    return { buyOrder, sellOrder, profit };
  }

  private getCurrentSettlementPeriod(): string {
    const now = new Date();
    const hour = now.getHours();
    return `${now.toISOString().slice(0, 10)}-H${hour.toString().padStart(2, '0')}`;
  }

  private getSettlementDate(market: MarketType): Date {
    const date = new Date();
    switch (market) {
      case MarketType.DAY_AHEAD:
        date.setDate(date.getDate() + 1);
        break;
      case MarketType.INTRADAY:
        break;
      case MarketType.REAL_TIME:
        break;
      default:
        date.setDate(date.getDate() + 30);
    }
    return date;
  }
}

// Export singleton
export const tradingEngineService = TradingEngineService.getInstance();
