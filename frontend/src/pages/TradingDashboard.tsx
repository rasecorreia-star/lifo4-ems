/**
 * Trading Dashboard
 * Advanced energy trading interface with Deep RL integration
 * Using Tailwind CSS + Lucide Icons + Recharts
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  BarChart3,
  Zap,
  ArrowRightLeft,
  Bot,
  PlayCircle,
  PauseCircle,
  X,
  Clock,
  Target,
  AlertTriangle
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar
} from 'recharts';

// Types
interface MarketPrice {
  timestamp: string;
  price: number;
  volume: number;
  prediction?: number;
}

interface TradingPosition {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: 'open' | 'closed' | 'pending';
}

interface ArbitrageOpportunity {
  id: string;
  buyMarket: string;
  sellMarket: string;
  spread: number;
  spreadPercent: number;
  maxQuantity: number;
  estimatedProfit: number;
  confidence: number;
}

interface AIRecommendation {
  action: 'buy' | 'sell' | 'hold';
  market: string;
  quantity: number;
  targetPrice: number;
  confidence: number;
  reason: string;
}

// Mock data
const generatePriceHistory = (): MarketPrice[] => {
  const data: MarketPrice[] = [];
  let price = 150 + Math.random() * 50;

  for (let i = 47; i >= 0; i--) {
    const time = new Date(Date.now() - i * 30 * 60 * 1000);
    price = price + (Math.random() - 0.5) * 10;
    price = Math.max(100, Math.min(250, price));

    data.push({
      timestamp: time.toISOString(),
      price: price,
      volume: 100 + Math.random() * 500,
      prediction: i < 12 ? price + (Math.random() - 0.3) * 15 : undefined
    });
  }

  return data;
};

const generatePositions = (): TradingPosition[] => {
  const markets = ['CCEE-SE', 'CCEE-S', 'CCEE-NE', 'ACL-SP', 'ACL-RJ'];
  return markets.slice(0, 5).map((market, i) => {
    const type = Math.random() > 0.5 ? 'buy' : 'sell';
    const entryPrice = 140 + Math.random() * 40;
    const currentPrice = entryPrice + (Math.random() - 0.5) * 30;
    const quantity = 50 + Math.floor(Math.random() * 200);
    const pnl = (currentPrice - entryPrice) * quantity * (type === 'buy' ? 1 : -1);

    return {
      id: `POS-${String(i + 1).padStart(4, '0')}`,
      type,
      market,
      quantity,
      entryPrice,
      currentPrice,
      pnl,
      pnlPercent: (pnl / (entryPrice * quantity)) * 100,
      status: Math.random() > 0.2 ? 'open' : 'pending'
    };
  });
};

const generateArbitrage = (): ArbitrageOpportunity[] => {
  return [
    { id: 'ARB-001', buyMarket: 'CCEE-SE', sellMarket: 'CCEE-S', spread: 12.5, spreadPercent: 7.8, maxQuantity: 250, estimatedProfit: 3125, confidence: 85 },
    { id: 'ARB-002', buyMarket: 'CCEE-NE', sellMarket: 'CCEE-SE', spread: 8.3, spreadPercent: 5.2, maxQuantity: 180, estimatedProfit: 1494, confidence: 72 },
    { id: 'ARB-003', buyMarket: 'ACL-SP', sellMarket: 'ACL-RJ', spread: 5.7, spreadPercent: 3.6, maxQuantity: 300, estimatedProfit: 1710, confidence: 68 }
  ];
};

const generateRecommendations = (): AIRecommendation[] => {
  return [
    { action: 'buy', market: 'CCEE-SE', quantity: 150, targetPrice: 165.50, confidence: 87, reason: 'Previsao de aumento de demanda nas proximas 4h.' },
    { action: 'sell', market: 'CCEE-S', quantity: 100, targetPrice: 142.30, confidence: 72, reason: 'Excesso de geracao solar previsto.' },
    { action: 'hold', market: 'ACL-SP', quantity: 0, targetPrice: 158.00, confidence: 65, reason: 'Mercado volatil. Aguardar estabilizacao.' }
  ];
};

// Components
const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color = 'text-primary' }) => (
  <div className="bg-surface border border-border rounded-lg p-4">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm text-foreground-muted">{title}</p>
        <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
        {subtitle && <p className="text-xs text-foreground-muted mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 mt-2 text-sm', trend >= 0 ? 'text-success-500' : 'text-danger-500')}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{trend >= 0 ? '+' : ''}{trend.toFixed(2)}%</span>
          </div>
        )}
      </div>
      <div className={cn('p-2 rounded-lg bg-primary/10', color)}>{icon}</div>
    </div>
  </div>
);

// Main Component
const TradingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [autoTrading, setAutoTrading] = useState(false);
  const [priceHistory] = useState<MarketPrice[]>(generatePriceHistory());
  const [positions] = useState<TradingPosition[]>(generatePositions());
  const [arbitrage] = useState<ArbitrageOpportunity[]>(generateArbitrage());
  const [recommendations] = useState<AIRecommendation[]>(generateRecommendations());
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = 68.5;
  const sharpeRatio = 1.85;
  const activePositions = positions.filter(p => p.status === 'open').length;

  const chartData = priceHistory.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    price: d.price,
    prediction: d.prediction,
    volume: d.volume
  }));

  const tabs = ['Mercado', 'Posicoes', 'Arbitragem', 'IA Insights'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Trading Dashboard
          </h1>
          <p className="text-sm text-foreground-muted">Mercado de Energia - CCEE / ACL</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoTrading(!autoTrading)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              autoTrading ? 'bg-success-500 text-white' : 'bg-surface-hover'
            )}
          >
            {autoTrading ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
            Auto-Trading
          </button>
          <button
            onClick={() => setShowOrderDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            Nova Ordem
          </button>
          <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Auto Trading Alert */}
      {autoTrading && (
        <div className="flex items-center gap-3 p-4 bg-success-500/10 border border-success-500/30 rounded-lg">
          <Bot className="w-5 h-5 text-success-500" />
          <div>
            <p className="font-medium text-success-500">Modo Auto-Trading Ativo</p>
            <p className="text-sm text-foreground-muted">O agente Deep RL esta operando autonomamente.</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="P&L Total (Hoje)"
          value={`R$ ${totalPnl.toFixed(0)}`}
          icon={<DollarSign className="w-5 h-5" />}
          color={totalPnl >= 0 ? 'text-success-500' : 'text-danger-500'}
          trend={totalPnl / 10000 * 100}
        />
        <StatCard
          title="Taxa de Acerto"
          value={`${winRate}%`}
          subtitle="47 trades"
          icon={<Target className="w-5 h-5" />}
          color={winRate > 60 ? 'text-success-500' : 'text-foreground'}
        />
        <StatCard
          title="Sharpe Ratio"
          value={sharpeRatio.toFixed(2)}
          subtitle="Max DD: -8.3%"
          icon={<BarChart3 className="w-5 h-5" />}
          color={sharpeRatio > 1 ? 'text-success-500' : 'text-foreground'}
        />
        <StatCard
          title="Posicoes Ativas"
          value={String(activePositions)}
          subtitle={`${positions.filter(p => p.status === 'pending').length} pendentes`}
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === i
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Preco de Energia - CCEE-SE (R$/MWh)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis yAxisId="price" className="text-xs" />
                <YAxis yAxisId="volume" orientation="right" className="text-xs" />
                <Tooltip />
                <Legend />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke="#FF9800" strokeWidth={2} dot={false} name="Preco Real" />
                <Line yAxisId="price" type="monotone" dataKey="prediction" stroke="#2196F3" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Previsao IA" />
                <Bar yAxisId="volume" dataKey="volume" fill="#9C27B0" opacity={0.3} name="Volume" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Recomendacoes da IA
            </h3>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-3 rounded-lg border',
                    rec.action === 'buy' ? 'bg-success-500/10 border-success-500/30' :
                    rec.action === 'sell' ? 'bg-danger-500/10 border-danger-500/30' :
                    'bg-surface-hover border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      'font-medium',
                      rec.action === 'buy' ? 'text-success-500' :
                      rec.action === 'sell' ? 'text-danger-500' :
                      'text-foreground-muted'
                    )}>
                      {rec.action.toUpperCase()} - {rec.market}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-surface rounded">
                      {rec.confidence}% conf.
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted">{rec.reason}</p>
                  {rec.action !== 'hold' && (
                    <button className="mt-2 text-xs px-3 py-1 border border-current rounded hover:bg-surface-hover transition-colors">
                      Aceitar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Mercado</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Qtd (MWh)</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Entrada</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Atual</th>
                <th className="px-4 py-3 text-right text-sm font-medium">P&L</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => (
                <tr key={pos.id} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-sm">{pos.id}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded',
                      pos.type === 'buy' ? 'bg-success-500/20 text-success-500' : 'bg-danger-500/20 text-danger-500'
                    )}>
                      {pos.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{pos.market}</td>
                  <td className="px-4 py-3 text-sm text-right">{pos.quantity}</td>
                  <td className="px-4 py-3 text-sm text-right">R$ {pos.entryPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right">R$ {pos.currentPrice.toFixed(2)}</td>
                  <td className={cn('px-4 py-3 text-sm text-right', pos.pnl >= 0 ? 'text-success-500' : 'text-danger-500')}>
                    {pos.pnl >= 0 ? '+' : ''}R$ {pos.pnl.toFixed(2)}
                    <span className="text-xs ml-1">({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded',
                      pos.status === 'open' ? 'bg-success-500/20 text-success-500' : 'bg-warning-500/20 text-warning-500'
                    )}>
                      {pos.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {arbitrage.map(arb => (
            <div key={arb.id} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  <span className="font-medium">{arb.buyMarket} → {arb.sellMarket}</span>
                </div>
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded',
                  arb.confidence > 80 ? 'bg-success-500/20 text-success-500' :
                  arb.confidence > 60 ? 'bg-warning-500/20 text-warning-500' :
                  'bg-surface-hover'
                )}>
                  {arb.confidence}% conf.
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Spread</span>
                  <span>R$ {arb.spread.toFixed(2)} ({arb.spreadPercent.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Max Qtd</span>
                  <span>{arb.maxQuantity} MWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Lucro Est.</span>
                  <span className="text-success-500 font-medium">+R$ {arb.estimatedProfit.toFixed(0)}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="flex-1 px-3 py-2 bg-success-500 text-white text-sm rounded-lg hover:bg-success-600 transition-colors">
                  Executar
                </button>
                <button className="flex-1 px-3 py-2 border border-border text-sm rounded-lg hover:bg-surface-hover transition-colors">
                  Simular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Recomendacoes da IA (Deep RL)
            </h3>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-4 rounded-lg border',
                    rec.action === 'buy' ? 'bg-success-500/10 border-success-500/30' :
                    rec.action === 'sell' ? 'bg-danger-500/10 border-danger-500/30' :
                    'bg-surface-hover border-border'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {rec.action === 'buy' ? <TrendingUp className="w-5 h-5 text-success-500" /> :
                     rec.action === 'sell' ? <TrendingDown className="w-5 h-5 text-danger-500" /> :
                     <Clock className="w-5 h-5 text-foreground-muted" />}
                    <span className="font-medium">
                      {rec.action.toUpperCase()} - {rec.market}
                      {rec.quantity > 0 && ` (${rec.quantity} MWh @ R$${rec.targetPrice.toFixed(2)})`}
                    </span>
                  </div>
                  <p className="text-sm text-foreground-muted mb-3">{rec.reason}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded',
                      rec.confidence > 80 ? 'bg-success-500/20 text-success-500' :
                      rec.confidence > 60 ? 'bg-warning-500/20 text-warning-500' :
                      'bg-surface-hover'
                    )}>
                      {rec.confidence}% confianca
                    </span>
                    {rec.action !== 'hold' && (
                      <button className="px-3 py-1 text-xs border border-current rounded hover:bg-surface-hover transition-colors">
                        Aceitar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Performance do Modelo
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Precisao de Previsao</span>
                  <span>87.3%</span>
                </div>
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-success-500 rounded-full" style={{ width: '87.3%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Retorno vs Mercado</span>
                  <span>+12.5%</span>
                </div>
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '62.5%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Tempo de Resposta</span>
                  <span>45ms</span>
                </div>
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '95%' }} />
                </div>
              </div>
              <div className="pt-4 border-t border-border text-sm text-foreground-muted space-y-1">
                <p>Modelo: Deep RL (PPO + LSTM)</p>
                <p>Ultima atualizacao: {new Date().toLocaleString('pt-BR')}</p>
                <p>Episodios de treino: 150,000+</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Dialog */}
      {showOrderDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nova Ordem</h3>
              <button onClick={() => setShowOrderDialog(false)} className="p-1 hover:bg-surface-hover rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mercado</label>
                <select className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option>CCEE-SE</option>
                  <option>CCEE-S</option>
                  <option>CCEE-NE</option>
                  <option>ACL-SP</option>
                  <option>ACL-RJ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option>Compra</option>
                  <option>Venda</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade (MWh)</label>
                <input type="number" className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="100" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preco Limite (R$)</label>
                <input type="number" className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="150.00" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowOrderDialog(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowOrderDialog(false)}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Enviar Ordem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingDashboard;
