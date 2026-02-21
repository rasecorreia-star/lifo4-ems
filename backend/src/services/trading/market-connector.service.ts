/**
 * Market Connector Service
 * Connects to Brazilian energy markets (CCEE, ACL) and other trading platforms.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export enum BrazilianMarket {
  CCEE = 'ccee',           // Câmara de Comercialização de Energia Elétrica
  ACL = 'acl',             // Ambiente de Contratação Livre
  ACR = 'acr',             // Ambiente de Contratação Regulada
  MCP = 'mcp',             // Mercado de Curto Prazo
  BBCE = 'bbce'            // Balcão Brasileiro de Comercialização de Energia
}

export enum ProductType {
  CONVENTIONAL = 'conventional',
  INCENTIVIZED_50 = 'incentivized_50',
  INCENTIVIZED_100 = 'incentivized_100',
  RENEWABLE = 'renewable',
  I_REC = 'i_rec'
}

export enum SubmarketRegion {
  SUDESTE_CENTRO_OESTE = 'SE/CO',
  SUL = 'S',
  NORDESTE = 'NE',
  NORTE = 'N'
}

export interface MarketCredentials {
  market: BrazilianMarket;
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  certificate?: string;
  environment: 'sandbox' | 'production';
}

export interface PLDPrice {
  timestamp: Date;
  submarket: SubmarketRegion;
  pricePerMWh: number;
  weekNumber: number;
  year: number;
  type: 'hourly' | 'weekly';
}

export interface EnergyContract {
  id: string;
  market: BrazilianMarket;
  product: ProductType;
  submarket: SubmarketRegion;
  buyer: string;
  seller: string;
  quantityMWh: number;
  pricePerMWh: number;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'cancelled';
  flexibility: number; // Percentage
  modulation: boolean;
  seasonality: boolean;
}

export interface MarketQuote {
  market: BrazilianMarket;
  product: ProductType;
  submarket: SubmarketRegion;
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  spread: number;
  volume: number;
  timestamp: Date;
  deliveryPeriod: string;
}

export interface ConnectionStatus {
  market: BrazilianMarket;
  connected: boolean;
  latencyMs: number;
  lastHeartbeat: Date;
  error?: string;
}

// ============================================
// MARKET CONNECTOR SERVICE
// ============================================

export class MarketConnectorService extends EventEmitter {
  private static instance: MarketConnectorService;

  private credentials: Map<BrazilianMarket, MarketCredentials> = new Map();
  private connections: Map<BrazilianMarket, ConnectionStatus> = new Map();
  private pldPrices: Map<SubmarketRegion, PLDPrice[]> = new Map();
  private quotes: Map<string, MarketQuote> = new Map();
  private contracts: Map<string, EnergyContract> = new Map();

  private heartbeatInterval: NodeJS.Timeout | null = null;
  private priceUpdateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.initializePLDData();
  }

  static getInstance(): MarketConnectorService {
    if (!MarketConnectorService.instance) {
      MarketConnectorService.instance = new MarketConnectorService();
    }
    return MarketConnectorService.instance;
  }

  private initializePLDData(): void {
    // Initialize with simulated PLD data for each submarket
    const submarkets = [
      SubmarketRegion.SUDESTE_CENTRO_OESTE,
      SubmarketRegion.SUL,
      SubmarketRegion.NORDESTE,
      SubmarketRegion.NORTE
    ];

    for (const submarket of submarkets) {
      const prices: PLDPrice[] = [];
      const basePrice = this.getBasePriceForSubmarket(submarket);

      // Generate 24 hours of PLD data
      for (let hour = 0; hour < 24; hour++) {
        const hourlyVariation = Math.sin(hour * Math.PI / 12) * 50;
        prices.push({
          timestamp: new Date(Date.now() - (24 - hour) * 3600000),
          submarket,
          pricePerMWh: basePrice + hourlyVariation + (Math.random() - 0.5) * 20,
          weekNumber: this.getWeekNumber(),
          year: new Date().getFullYear(),
          type: 'hourly'
        });
      }

      this.pldPrices.set(submarket, prices);
    }
  }

  private getBasePriceForSubmarket(submarket: SubmarketRegion): number {
    // Base prices vary by region
    const basePrices: Record<SubmarketRegion, number> = {
      [SubmarketRegion.SUDESTE_CENTRO_OESTE]: 180,
      [SubmarketRegion.SUL]: 170,
      [SubmarketRegion.NORDESTE]: 150,
      [SubmarketRegion.NORTE]: 160
    };
    return basePrices[submarket];
  }

  private getWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }

  /**
   * Register market credentials
   */
  registerCredentials(credentials: MarketCredentials): void {
    this.credentials.set(credentials.market, credentials);
    logger.info(`Credentials registered for ${credentials.market}`);
  }

  /**
   * Connect to market
   */
  async connect(market: BrazilianMarket): Promise<ConnectionStatus> {
    const credentials = this.credentials.get(market);

    if (!credentials) {
      logger.warn(`No credentials for ${market}, using simulation mode`);
    }

    // Simulate connection
    const status: ConnectionStatus = {
      market,
      connected: true,
      latencyMs: Math.random() * 50 + 10,
      lastHeartbeat: new Date()
    };

    this.connections.set(market, status);
    this.emit('marketConnected', status);
    logger.info(`Connected to ${market}`);

    // Start heartbeat
    this.startHeartbeat(market);

    return status;
  }

  /**
   * Disconnect from market
   */
  disconnect(market: BrazilianMarket): void {
    const status = this.connections.get(market);
    if (status) {
      status.connected = false;
      this.emit('marketDisconnected', status);
      logger.info(`Disconnected from ${market}`);
    }
  }

  /**
   * Start heartbeat for market connection
   */
  private startHeartbeat(market: BrazilianMarket): void {
    setInterval(() => {
      const status = this.connections.get(market);
      if (status && status.connected) {
        status.lastHeartbeat = new Date();
        status.latencyMs = Math.random() * 50 + 10;
        this.emit('heartbeat', status);
      }
    }, 30000);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(market: BrazilianMarket): ConnectionStatus | undefined {
    return this.connections.get(market);
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses(): ConnectionStatus[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get current PLD price
   */
  getCurrentPLD(submarket: SubmarketRegion): PLDPrice | undefined {
    const prices = this.pldPrices.get(submarket);
    return prices?.[prices.length - 1];
  }

  /**
   * Get PLD history
   */
  getPLDHistory(submarket: SubmarketRegion, hours: number = 24): PLDPrice[] {
    const prices = this.pldPrices.get(submarket) || [];
    return prices.slice(-hours);
  }

  /**
   * Get all current PLD prices
   */
  getAllCurrentPLD(): Map<SubmarketRegion, PLDPrice | undefined> {
    const result = new Map<SubmarketRegion, PLDPrice | undefined>();
    for (const [submarket] of this.pldPrices) {
      result.set(submarket, this.getCurrentPLD(submarket));
    }
    return result;
  }

  /**
   * Request quote from market
   */
  async requestQuote(
    market: BrazilianMarket,
    product: ProductType,
    submarket: SubmarketRegion,
    quantityMWh: number,
    deliveryPeriod: string
  ): Promise<MarketQuote> {
    const pld = this.getCurrentPLD(submarket);
    const basePrice = pld?.pricePerMWh || 150;

    // Simulate market quote
    const spread = basePrice * 0.02; // 2% spread
    const quote: MarketQuote = {
      market,
      product,
      submarket,
      bidPrice: basePrice - spread / 2,
      askPrice: basePrice + spread / 2,
      midPrice: basePrice,
      spread,
      volume: quantityMWh,
      timestamp: new Date(),
      deliveryPeriod
    };

    const quoteKey = `${market}-${product}-${submarket}-${deliveryPeriod}`;
    this.quotes.set(quoteKey, quote);

    this.emit('quoteReceived', quote);
    return quote;
  }

  /**
   * Submit contract to market
   */
  async submitContract(contract: Omit<EnergyContract, 'id' | 'status'>): Promise<EnergyContract> {
    const id = `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const fullContract: EnergyContract = {
      ...contract,
      id,
      status: 'pending'
    };

    this.contracts.set(id, fullContract);

    // Simulate contract approval
    setTimeout(() => {
      fullContract.status = 'active';
      this.emit('contractApproved', fullContract);
    }, 2000);

    this.emit('contractSubmitted', fullContract);
    logger.info(`Contract submitted: ${id}`);

    return fullContract;
  }

  /**
   * Get contract by ID
   */
  getContract(contractId: string): EnergyContract | undefined {
    return this.contracts.get(contractId);
  }

  /**
   * Get all contracts
   */
  getContracts(status?: EnergyContract['status']): EnergyContract[] {
    const contracts = Array.from(this.contracts.values());
    return status ? contracts.filter(c => c.status === status) : contracts;
  }

  /**
   * Cancel contract
   */
  cancelContract(contractId: string): EnergyContract | undefined {
    const contract = this.contracts.get(contractId);
    if (contract && (contract.status === 'draft' || contract.status === 'pending')) {
      contract.status = 'cancelled';
      this.emit('contractCancelled', contract);
      return contract;
    }
    return undefined;
  }

  /**
   * Get market hours
   */
  isMarketOpen(market: BrazilianMarket): boolean {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Markets closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    // CCEE/ACL trading hours (Brazilian time)
    const tradingHours: Record<BrazilianMarket, { start: number; end: number }> = {
      [BrazilianMarket.CCEE]: { start: 9, end: 18 },
      [BrazilianMarket.ACL]: { start: 8, end: 20 },
      [BrazilianMarket.ACR]: { start: 9, end: 17 },
      [BrazilianMarket.MCP]: { start: 0, end: 24 }, // 24/7
      [BrazilianMarket.BBCE]: { start: 9, end: 18 }
    };

    const hours = tradingHours[market];
    return hour >= hours.start && hour < hours.end;
  }

  /**
   * Calculate settlement for period
   */
  calculateSettlement(
    submarket: SubmarketRegion,
    quantityMWh: number,
    contractPrice: number,
    settlementPeriod: string
  ): {
    pldAverage: number;
    contractValue: number;
    spotValue: number;
    difference: number;
    netSettlement: number;
  } {
    const pldHistory = this.getPLDHistory(submarket, 24);
    const pldAverage = pldHistory.length > 0
      ? pldHistory.reduce((sum, p) => sum + p.pricePerMWh, 0) / pldHistory.length
      : 150;

    const contractValue = quantityMWh * contractPrice;
    const spotValue = quantityMWh * pldAverage;
    const difference = contractValue - spotValue;

    return {
      pldAverage,
      contractValue,
      spotValue,
      difference,
      netSettlement: difference
    };
  }

  /**
   * Get arbitrage opportunities between submarkets
   */
  getSubmarketArbitrageOpportunities(): Array<{
    buySubmarket: SubmarketRegion;
    sellSubmarket: SubmarketRegion;
    spreadPerMWh: number;
  }> {
    const opportunities: Array<{
      buySubmarket: SubmarketRegion;
      sellSubmarket: SubmarketRegion;
      spreadPerMWh: number;
    }> = [];

    const submarkets = Array.from(this.pldPrices.keys());

    for (let i = 0; i < submarkets.length; i++) {
      for (let j = i + 1; j < submarkets.length; j++) {
        const pld1 = this.getCurrentPLD(submarkets[i]);
        const pld2 = this.getCurrentPLD(submarkets[j]);

        if (pld1 && pld2) {
          const spread = pld2.pricePerMWh - pld1.pricePerMWh;
          if (Math.abs(spread) > 10) { // Minimum spread threshold
            opportunities.push({
              buySubmarket: spread > 0 ? submarkets[i] : submarkets[j],
              sellSubmarket: spread > 0 ? submarkets[j] : submarkets[i],
              spreadPerMWh: Math.abs(spread)
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.spreadPerMWh - a.spreadPerMWh);
  }

  /**
   * Start price update simulation
   */
  startPriceUpdates(intervalMs: number = 60000): void {
    if (this.priceUpdateInterval) return;

    this.priceUpdateInterval = setInterval(() => {
      for (const [submarket, prices] of this.pldPrices) {
        const lastPrice = prices[prices.length - 1];
        const change = (Math.random() - 0.5) * 10;
        const newPrice: PLDPrice = {
          timestamp: new Date(),
          submarket,
          pricePerMWh: Math.max(50, Math.min(500, lastPrice.pricePerMWh + change)),
          weekNumber: this.getWeekNumber(),
          year: new Date().getFullYear(),
          type: 'hourly'
        };

        prices.push(newPrice);
        if (prices.length > 168) { // Keep 1 week of hourly data
          prices.shift();
        }

        this.emit('pldUpdated', newPrice);
      }
    }, intervalMs);

    logger.info('Price updates started');
  }

  /**
   * Stop price updates
   */
  stopPriceUpdates(): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
      logger.info('Price updates stopped');
    }
  }
}

// Export singleton
export const marketConnectorService = MarketConnectorService.getInstance();
