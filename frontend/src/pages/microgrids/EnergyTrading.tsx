/**
 * Energy Trading Page for Microgrids
 * Market participation, P2P trading, and energy arbitrage
 * for microgrid energy management
 */

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Calendar,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Play,
  Pause,
  Settings,
  BarChart3,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Users,
  Building2,
  Globe,
  ShoppingCart,
  Handshake,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { cn } from '@/lib/utils';
import { gridApi, systemsApi } from '@/services/api';

// Types
interface MarketPrice {
  time: string;
  spotPrice: number;
  forecastPrice: number;
  dayAhead: number;
}

interface TradeOrder {
  id: string;
  type: 'buy' | 'sell';
  market: 'spot' | 'day_ahead' | 'p2p' | 'ancillary';
  status: 'pending' | 'executed' | 'cancelled' | 'partial';
  quantity: number;
  price: number;
  total: number;
  counterparty?: string;
  timestamp: Date;
  executedAt?: Date;
}

interface P2PPeer {
  id: string;
  name: string;
  type: 'residential' | 'commercial' | 'industrial';
  distance: number;
  rating: number;
  availableEnergy: number;
  pricePerKwh: number;
  isOnline: boolean;
}

interface TradingStrategy {
  id: string;
  name: string;
  type: 'arbitrage' | 'peak_shaving' | 'green_energy' | 'cost_minimization';
  isActive: boolean;
  parameters: Record<string, number>;
  performance: {
    totalTrades: number;
    profitLoss: number;
    successRate: number;
  };
}

interface RevenueData {
  date: string;
  spotRevenue: number;
  p2pRevenue: number;
  ancillaryRevenue: number;
  totalCost: number;
}

// Mock data generators
const generateMarketPrices = (): MarketPrice[] => {
  const data: MarketPrice[] = [];
  let basePrice = 280;

  for (let i = 0; i < 24; i++) {
    const hour = `${i.toString().padStart(2, '0')}:00`;
    const isPeak = (i >= 17 && i <= 21) || (i >= 7 && i <= 9);
    const multiplier = isPeak ? 1.8 : i >= 0 && i <= 6 ? 0.7 : 1;
    const spotPrice = basePrice * multiplier + (Math.random() - 0.5) * 40;
    const forecastPrice = basePrice * multiplier + (Math.random() - 0.5) * 30;
    const dayAhead = basePrice * multiplier * 0.95 + (Math.random() - 0.5) * 20;

    data.push({
      time: hour,
      spotPrice: Math.round(spotPrice * 100) / 100,
      forecastPrice: Math.round(forecastPrice * 100) / 100,
      dayAhead: Math.round(dayAhead * 100) / 100,
    });

    basePrice += (Math.random() - 0.5) * 8;
  }
  return data;
};

const generateRevenueHistory = (): RevenueData[] => {
  const data: RevenueData[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      spotRevenue: 800 + Math.random() * 600,
      p2pRevenue: 200 + Math.random() * 300,
      ancillaryRevenue: 100 + Math.random() * 200,
      totalCost: 400 + Math.random() * 300,
    });
  }
  return data;
};

const mockPeers: P2PPeer[] = [
  { id: 'peer-1', name: 'Condominio Solar Verde', type: 'residential', distance: 0.5, rating: 4.8, availableEnergy: 45, pricePerKwh: 0.52, isOnline: true },
  { id: 'peer-2', name: 'Industria MetalTech', type: 'industrial', distance: 2.1, rating: 4.5, availableEnergy: 120, pricePerKwh: 0.48, isOnline: true },
  { id: 'peer-3', name: 'Shopping Center Norte', type: 'commercial', distance: 1.8, rating: 4.9, availableEnergy: 80, pricePerKwh: 0.55, isOnline: true },
  { id: 'peer-4', name: 'Fazenda Solar', type: 'commercial', distance: 5.2, rating: 4.7, availableEnergy: 200, pricePerKwh: 0.45, isOnline: false },
  { id: 'peer-5', name: 'Escola Publica Municipal', type: 'commercial', distance: 0.8, rating: 4.6, availableEnergy: 25, pricePerKwh: 0.50, isOnline: true },
];

const mockOrders: TradeOrder[] = [
  { id: 'ORD-001', type: 'sell', market: 'spot', status: 'executed', quantity: 35, price: 485, total: 16975, timestamp: new Date(Date.now() - 1800000), executedAt: new Date(Date.now() - 1750000) },
  { id: 'ORD-002', type: 'sell', market: 'ancillary', status: 'executed', quantity: 20, price: 520, total: 10400, timestamp: new Date(Date.now() - 3600000), executedAt: new Date(Date.now() - 3550000) },
  { id: 'ORD-003', type: 'buy', market: 'day_ahead', status: 'executed', quantity: 50, price: 245, total: 12250, timestamp: new Date(Date.now() - 7200000), executedAt: new Date(Date.now() - 7150000) },
  { id: 'ORD-004', type: 'sell', market: 'p2p', status: 'pending', quantity: 25, price: 0.52, total: 13, counterparty: 'Condominio Solar Verde', timestamp: new Date() },
  { id: 'ORD-005', type: 'buy', market: 'spot', status: 'cancelled', quantity: 40, price: 280, total: 11200, timestamp: new Date(Date.now() - 14400000) },
];

const mockStrategies: TradingStrategy[] = [
  {
    id: 'strat-1',
    name: 'Arbitragem Temporal',
    type: 'arbitrage',
    isActive: true,
    parameters: { buyThreshold: 250, sellThreshold: 400, minSpread: 50 },
    performance: { totalTrades: 245, profitLoss: 28500, successRate: 87 },
  },
  {
    id: 'strat-2',
    name: 'Peak Shaving',
    type: 'peak_shaving',
    isActive: true,
    parameters: { peakThreshold: 150, targetReduction: 30 },
    performance: { totalTrades: 62, profitLoss: 12300, successRate: 95 },
  },
  {
    id: 'strat-3',
    name: 'Energia Verde Premium',
    type: 'green_energy',
    isActive: false,
    parameters: { premiumMultiplier: 1.15, minCertification: 80 },
    performance: { totalTrades: 18, profitLoss: 4200, successRate: 100 },
  },
];

const MARKET_COLORS = {
  spot: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500' },
  day_ahead: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' },
  p2p: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500' },
  ancillary: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500' },
};

export default function EnergyTrading() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoTrading, setAutoTrading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'markets' | 'p2p' | 'strategies'>('overview');

  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<RevenueData[]>([]);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [peers, setPeers] = useState<P2PPeer[]>([]);
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);

  // Current market state
  const [currentPrice, setCurrentPrice] = useState(320);
  const [priceChange, setPriceChange] = useState(12);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setMarketPrices(generateMarketPrices());
        setRevenueHistory(generateRevenueHistory());
        setOrders(mockOrders);
        setPeers(mockPeers);
        setStrategies(mockStrategies);
      } catch (err) {
        setError('Falha ao carregar dados de trading');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 10;
        setPriceChange(change);
        return Math.max(200, Math.min(500, prev + change));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const today = revenueHistory[revenueHistory.length - 1] || { spotRevenue: 0, p2pRevenue: 0, ancillaryRevenue: 0, totalCost: 0 };
    const todayRevenue = today.spotRevenue + today.p2pRevenue + today.ancillaryRevenue;
    const todayProfit = todayRevenue - today.totalCost;

    const monthRevenue = revenueHistory.reduce((sum, d) => sum + d.spotRevenue + d.p2pRevenue + d.ancillaryRevenue, 0);
    const monthCost = revenueHistory.reduce((sum, d) => sum + d.totalCost, 0);
    const monthProfit = monthRevenue - monthCost;

    const executedOrders = orders.filter(o => o.status === 'executed');
    const avgPrice = executedOrders.length > 0
      ? executedOrders.reduce((sum, o) => sum + o.price, 0) / executedOrders.length
      : 0;

    return {
      currentPrice,
      priceChange,
      todayRevenue,
      todayProfit,
      monthRevenue,
      monthProfit,
      totalOrders: orders.length,
      executedOrders: executedOrders.length,
      avgPrice,
      onlinePeers: peers.filter(p => p.isOnline).length,
    };
  }, [currentPrice, priceChange, revenueHistory, orders, peers]);

  // Revenue distribution for pie chart
  const revenueDistribution = useMemo(() => {
    const totals = revenueHistory.reduce(
      (acc, d) => ({
        spot: acc.spot + d.spotRevenue,
        p2p: acc.p2p + d.p2pRevenue,
        ancillary: acc.ancillary + d.ancillaryRevenue,
      }),
      { spot: 0, p2p: 0, ancillary: 0 }
    );

    return [
      { name: 'Mercado Spot', value: totals.spot, color: '#3B82F6' },
      { name: 'P2P Trading', value: totals.p2p, color: '#8B5CF6' },
      { name: 'Servicos Ancilares', value: totals.ancillary, color: '#F59E0B' },
    ];
  }, [revenueHistory]);

  const handleStrategyToggle = (strategyId: string) => {
    setStrategies(prev => prev.map(s =>
      s.id === strategyId ? { ...s, isActive: !s.isActive } : s
    ));
  };

  const handleP2PBuy = (peerId: string, quantity: number) => {
    const peer = peers.find(p => p.id === peerId);
    if (!peer) return;

    const newOrder: TradeOrder = {
      id: `ORD-${Date.now()}`,
      type: 'buy',
      market: 'p2p',
      status: 'pending',
      quantity,
      price: peer.pricePerKwh,
      total: quantity * peer.pricePerKwh,
      counterparty: peer.name,
      timestamp: new Date(),
    };

    setOrders(prev => [newOrder, ...prev]);
  };

  if (isLoading) {
    return <EnergyTradingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="w-12 h-12 text-danger-500 mb-4" />
        <p className="text-foreground-muted">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comercializacao de Energia</h1>
          <p className="text-foreground-muted mt-1">
            Trading de energia no mercado livre e P2P
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg">
            <Activity className={cn('w-4 h-4', autoTrading ? 'text-success-500' : 'text-foreground-muted')} />
            <span className="text-sm text-foreground">Auto-trading</span>
            <button
              onClick={() => setAutoTrading(!autoTrading)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                autoTrading ? 'bg-success-500' : 'bg-foreground-muted/30'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                  autoTrading ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
          <button
            onClick={() => setMarketPrices(generateMarketPrices())}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Current Price Banner */}
      <div className="bg-gradient-to-r from-primary/20 to-success-500/20 border border-primary/30 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-foreground-muted mb-1">Preco Spot Atual</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">R$ {stats.currentPrice.toFixed(0)}</span>
              <span className="text-foreground-muted">/MWh</span>
            </div>
            <div className={cn(
              'flex items-center gap-1 mt-2',
              stats.priceChange >= 0 ? 'text-success-500' : 'text-danger-500'
            )}>
              {stats.priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm">{stats.priceChange >= 0 ? '+' : ''}{stats.priceChange.toFixed(1)}% vs anterior</span>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <p className="text-xs text-foreground-muted">Receita Hoje</p>
              <p className="text-xl font-bold text-green-400">R$ {stats.todayRevenue.toFixed(0)}</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <p className="text-xs text-foreground-muted">Lucro Hoje</p>
              <p className={cn('text-xl font-bold', stats.todayProfit >= 0 ? 'text-green-400' : 'text-red-400')}>
                R$ {stats.todayProfit.toFixed(0)}
              </p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <p className="text-xs text-foreground-muted">Lucro Mensal</p>
              <p className={cn('text-xl font-bold', stats.monthProfit >= 0 ? 'text-green-400' : 'text-red-400')}>
                R$ {stats.monthProfit.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Receita Mensal</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">R$ {(stats.monthRevenue / 1000).toFixed(1)}k</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Ordens Executadas</span>
            <CheckCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.executedOrders}/{stats.totalOrders}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Preco Medio</span>
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">R$ {stats.avgPrice.toFixed(0)}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Peers Online</span>
            <Users className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.onlinePeers}/{peers.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {(['overview', 'markets', 'p2p', 'strategies'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            {tab === 'overview' ? 'Visao Geral' :
             tab === 'markets' ? 'Mercados' :
             tab === 'p2p' ? 'P2P Trading' : 'Estrategias'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Price Chart */}
            <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Precos de Mercado (24h)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={marketPrices}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                    <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <ReferenceLine y={250} stroke="#22c55e" strokeDasharray="3 3" label="Comprar" />
                    <ReferenceLine y={400} stroke="#ef4444" strokeDasharray="3 3" label="Vender" />
                    <Area
                      type="monotone"
                      dataKey="spotPrice"
                      name="Spot"
                      fill="#3B82F6"
                      fillOpacity={0.3}
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="dayAhead"
                      name="Day-Ahead"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecastPrice"
                      name="Previsao"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Distribution */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Distribuicao de Receita</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {revenueDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(0)}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {revenueDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <span className="text-foreground-muted">R$ {item.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue History Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Historico de Receita (30 dias)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={10} interval={4} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(0)}`]}
                  />
                  <Legend />
                  <Bar dataKey="spotRevenue" name="Spot" fill="#3B82F6" stackId="revenue" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="p2pRevenue" name="P2P" fill="#8B5CF6" stackId="revenue" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="ancillaryRevenue" name="Ancilares" fill="#F59E0B" stackId="revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Ordens Recentes</h3>
              <button className="text-sm text-primary hover:underline">Ver todas</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Mercado</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Qtd</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Preco</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Total</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order) => {
                    const marketColors = MARKET_COLORS[order.market];
                    return (
                      <tr key={order.id} className="border-b border-border hover:bg-surface-hover">
                        <td className="py-3 px-4 font-medium text-foreground">{order.id}</td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            order.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          )}>
                            {order.type === 'buy' ? 'Compra' : 'Venda'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded-full text-xs font-medium', marketColors.bg, marketColors.text)}>
                            {order.market === 'spot' ? 'Spot' :
                             order.market === 'day_ahead' ? 'Day-Ahead' :
                             order.market === 'p2p' ? 'P2P' : 'Ancilar'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            order.status === 'executed' && 'bg-green-500/20 text-green-400',
                            order.status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
                            order.status === 'cancelled' && 'bg-gray-500/20 text-gray-400',
                            order.status === 'partial' && 'bg-blue-500/20 text-blue-400'
                          )}>
                            {order.status === 'executed' ? 'Executada' :
                             order.status === 'pending' ? 'Pendente' :
                             order.status === 'cancelled' ? 'Cancelada' : 'Parcial'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">{order.quantity} kWh</td>
                        <td className="py-3 px-4 text-right text-foreground">
                          R$ {order.price.toFixed(order.market === 'p2p' ? 2 : 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-foreground">
                          R$ {order.total.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-foreground-muted text-sm">
                          {order.timestamp.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'markets' && (
        <div className="space-y-6">
          {/* Market Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Mercado Spot', icon: Zap, color: 'blue', price: stats.currentPrice, change: 5.2, volume: '1.2 MW' },
              { name: 'Day-Ahead', icon: Calendar, color: 'green', price: stats.currentPrice * 0.95, change: -2.1, volume: '2.5 MW' },
              { name: 'Servicos Ancilares', icon: Activity, color: 'orange', price: stats.currentPrice * 1.3, change: 8.5, volume: '0.5 MW' },
              { name: 'Mercado de Capacidade', icon: Target, color: 'purple', price: stats.currentPrice * 0.2, change: 0.5, volume: '5.0 MW' },
            ].map((market, index) => {
              const Icon = market.icon;
              return (
                <div
                  key={index}
                  className={cn('bg-surface border rounded-xl p-4', `border-${market.color}-500/30`)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-${market.color}-500/20`}>
                      <Icon className={`w-5 h-5 text-${market.color}-400`} />
                    </div>
                    <span className="font-medium text-foreground">{market.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">R$ {market.price.toFixed(0)}/MWh</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn(
                      'flex items-center gap-1',
                      market.change >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {market.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {market.change >= 0 ? '+' : ''}{market.change}%
                    </span>
                    <span className="text-foreground-muted">Vol: {market.volume}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trading Signals */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Sinais de Trading (24h)</h3>
            <div className="grid grid-cols-24 gap-1">
              {marketPrices.map((data, index) => {
                const action = data.spotPrice < 250 ? 'buy' : data.spotPrice > 400 ? 'sell' : 'hold';
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center"
                    title={`${data.time}: R$ ${data.spotPrice}/MWh - ${action.toUpperCase()}`}
                  >
                    <div
                      className={cn(
                        'w-full h-8 rounded-sm',
                        action === 'buy' && 'bg-success-500/50',
                        action === 'sell' && 'bg-danger-500/50',
                        action === 'hold' && 'bg-foreground-muted/20'
                      )}
                    />
                    <span className="text-xs text-foreground-muted mt-1">
                      {index % 4 === 0 ? data.time.split(':')[0] : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-success-500/50" />
                <span className="text-foreground-muted">Comprar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-danger-500/50" />
                <span className="text-foreground-muted">Vender</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-foreground-muted/20" />
                <span className="text-foreground-muted">Manter</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'p2p' && (
        <div className="space-y-6">
          {/* P2P Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span className="text-foreground-muted text-sm">Peers Disponiveis</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{peers.filter(p => p.isOnline).length}</div>
              <div className="text-xs text-foreground-muted mt-1">
                {peers.filter(p => p.isOnline).reduce((sum, p) => sum + p.availableEnergy, 0)} kWh disponivel
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Handshake className="w-5 h-5 text-green-400" />
                <span className="text-foreground-muted text-sm">Transacoes P2P</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {orders.filter(o => o.market === 'p2p').length}
              </div>
              <div className="text-xs text-foreground-muted mt-1">Ultimos 30 dias</div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                <span className="text-foreground-muted text-sm">Economia P2P</span>
              </div>
              <div className="text-2xl font-bold text-green-400">R$ 2.350</div>
              <div className="text-xs text-foreground-muted mt-1">vs. Mercado Spot</div>
            </div>
          </div>

          {/* Peer List */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Peers Disponiveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  className={cn(
                    'p-4 rounded-lg border transition-all',
                    peer.isOnline ? 'border-green-500/30 bg-green-500/5' : 'border-gray-500/30 bg-gray-500/5 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        peer.type === 'residential' ? 'bg-blue-500/20' :
                        peer.type === 'commercial' ? 'bg-purple-500/20' : 'bg-orange-500/20'
                      )}>
                        {peer.type === 'residential' ? <Home className="w-5 h-5 text-blue-400" /> :
                         peer.type === 'commercial' ? <Building2 className="w-5 h-5 text-purple-400" /> :
                         <Factory className="w-5 h-5 text-orange-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{peer.name}</p>
                        <p className="text-xs text-foreground-muted">{peer.distance} km de distancia</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">{'*'.repeat(Math.floor(peer.rating))}</span>
                      <span className="text-sm text-foreground-muted">{peer.rating}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-foreground-muted">Energia Disponivel</p>
                      <p className="font-medium text-foreground">{peer.availableEnergy} kWh</p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Preco</p>
                      <p className="font-medium text-green-400">R$ {peer.pricePerKwh}/kWh</p>
                    </div>
                  </div>

                  {peer.isOnline && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleP2PBuy(peer.id, 10)}
                        className="flex-1 px-3 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                      >
                        <ShoppingCart className="w-4 h-4 inline mr-2" />
                        Comprar 10 kWh
                      </button>
                      <button className="px-3 py-2 text-sm bg-surface-hover text-foreground rounded-lg hover:bg-surface-active">
                        Negociar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'strategies' && (
        <div className="space-y-6">
          {/* Active Strategies */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className={cn(
                  'bg-surface border rounded-xl p-4 transition-all',
                  strategy.isActive ? 'border-primary' : 'border-border'
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-foreground">{strategy.name}</h3>
                    <p className="text-xs text-foreground-muted capitalize">{strategy.type.replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={() => handleStrategyToggle(strategy.id)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      strategy.isActive ? 'bg-primary' : 'bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                        strategy.isActive ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-muted">Total de Trades</span>
                    <span className="text-foreground">{strategy.performance.totalTrades}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-muted">Lucro/Prejuizo</span>
                    <span className={cn(
                      'font-medium',
                      strategy.performance.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      R$ {strategy.performance.profitLoss.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-muted">Taxa de Sucesso</span>
                    <span className="text-foreground">{strategy.performance.successRate}%</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-foreground-muted mb-2">Parametros</p>
                  <div className="space-y-1">
                    {Object.entries(strategy.parameters).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-foreground-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Strategy Settings */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configuracoes de Trading
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Limites de Preco</h4>
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground">Limite de Compra</span>
                    <span className="font-bold text-green-400">R$ 250/MWh</span>
                  </div>
                  <p className="text-xs text-foreground-muted">Comprar quando preco abaixo deste valor</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground">Limite de Venda</span>
                    <span className="font-bold text-red-400">R$ 400/MWh</span>
                  </div>
                  <p className="text-xs text-foreground-muted">Vender quando preco acima deste valor</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Restricoes</h4>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground">SOC Minimo Reserva</span>
                    <span className="font-medium text-foreground">20%</span>
                  </div>
                </div>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground">Volume Maximo/Hora</span>
                    <span className="font-medium text-foreground">100 kWh</span>
                  </div>
                </div>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground">Exposicao Maxima</span>
                    <span className="font-medium text-foreground">R$ 50.000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading Skeleton
function EnergyTradingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      <div className="h-32 bg-surface rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border h-80 animate-pulse" />
        <div className="bg-surface rounded-xl border border-border h-80 animate-pulse" />
      </div>
    </div>
  );
}
