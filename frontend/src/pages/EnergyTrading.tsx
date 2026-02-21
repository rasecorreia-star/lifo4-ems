import { useState, useMemo } from 'react';
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
} from 'recharts';
import { cn } from '@/lib/utils';

interface PriceData {
  time: string;
  spotPrice: number;
  forecastPrice: number;
  action: 'buy' | 'sell' | 'hold';
}

interface TradeOrder {
  id: string;
  type: 'buy' | 'sell';
  status: 'pending' | 'executed' | 'cancelled';
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
  market: string;
}

interface DailyRevenue {
  date: string;
  bought: number;
  sold: number;
  netRevenue: number;
  avgBuyPrice: number;
  avgSellPrice: number;
}

// Mock data generators
const generatePriceData = (): PriceData[] => {
  const data: PriceData[] = [];
  let basePrice = 280; // R$/MWh

  for (let i = 0; i < 24; i++) {
    const hour = `${i.toString().padStart(2, '0')}:00`;

    // Price varies with demand - higher during peak hours
    const peakMultiplier = i >= 17 && i <= 21 ? 1.8 : i >= 11 && i <= 14 ? 1.3 : 1;
    const randomVariation = (Math.random() - 0.5) * 40;
    const spotPrice = basePrice * peakMultiplier + randomVariation;
    const forecastPrice = basePrice * peakMultiplier + (Math.random() - 0.5) * 20;

    // Determine action based on price
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    if (spotPrice < 250) action = 'buy';
    else if (spotPrice > 400) action = 'sell';

    data.push({
      time: hour,
      spotPrice: Math.round(spotPrice * 100) / 100,
      forecastPrice: Math.round(forecastPrice * 100) / 100,
      action,
    });

    basePrice += (Math.random() - 0.5) * 10;
  }
  return data;
};

const generateRevenueHistory = (): DailyRevenue[] => {
  const data: DailyRevenue[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const bought = 50 + Math.random() * 100;
    const sold = 80 + Math.random() * 120;
    const avgBuyPrice = 220 + Math.random() * 60;
    const avgSellPrice = 350 + Math.random() * 100;
    const netRevenue = (sold * avgSellPrice - bought * avgBuyPrice) / 1000;

    data.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      bought: Math.round(bought),
      sold: Math.round(sold),
      netRevenue: Math.round(netRevenue * 100) / 100,
      avgBuyPrice: Math.round(avgBuyPrice),
      avgSellPrice: Math.round(avgSellPrice),
    });
  }
  return data;
};

const recentOrders: TradeOrder[] = [
  { id: 'ORD-001', type: 'sell', status: 'executed', quantity: 25, price: 485, total: 12125, timestamp: '19:45', market: 'CCEE Spot' },
  { id: 'ORD-002', type: 'sell', status: 'executed', quantity: 30, price: 462, total: 13860, timestamp: '18:30', market: 'CCEE Spot' },
  { id: 'ORD-003', type: 'buy', status: 'executed', quantity: 40, price: 215, total: 8600, timestamp: '03:15', market: 'CCEE Spot' },
  { id: 'ORD-004', type: 'buy', status: 'executed', quantity: 35, price: 228, total: 7980, timestamp: '02:00', market: 'CCEE Spot' },
  { id: 'ORD-005', type: 'sell', status: 'pending', quantity: 20, price: 450, total: 9000, timestamp: '20:00', market: 'CCEE Spot' },
];

export default function EnergyTrading() {
  const [autoTrading, setAutoTrading] = useState(true);
  const [selectedView, setSelectedView] = useState<'realtime' | 'history' | 'orders'>('realtime');

  const priceData = useMemo(() => generatePriceData(), []);
  const revenueHistory = useMemo(() => generateRevenueHistory(), []);

  // Calculate stats
  const stats = useMemo(() => {
    const currentPrice = priceData[new Date().getHours()]?.spotPrice || 300;
    const avgPrice = priceData.reduce((sum, p) => sum + p.spotPrice, 0) / priceData.length;
    const maxPrice = Math.max(...priceData.map(p => p.spotPrice));
    const minPrice = Math.min(...priceData.map(p => p.spotPrice));

    const todayRevenue = revenueHistory[revenueHistory.length - 1]?.netRevenue || 0;
    const monthRevenue = revenueHistory.reduce((sum, d) => sum + d.netRevenue, 0);
    const totalSold = revenueHistory.reduce((sum, d) => sum + d.sold, 0);
    const totalBought = revenueHistory.reduce((sum, d) => sum + d.bought, 0);

    return {
      currentPrice: Math.round(currentPrice),
      avgPrice: Math.round(avgPrice),
      maxPrice: Math.round(maxPrice),
      minPrice: Math.round(minPrice),
      todayRevenue,
      monthRevenue: Math.round(monthRevenue * 100) / 100,
      totalSold,
      totalBought,
      netEnergy: totalSold - totalBought,
    };
  }, [priceData, revenueHistory]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy':
        return '#22c55e';
      case 'sell':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comercializacao de Energia</h1>
          <p className="text-foreground-muted mt-1">
            Compra e venda de energia no mercado livre
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
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Current Price Banner */}
      <div className="bg-gradient-to-r from-primary/20 to-success-500/20 border border-primary/30 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            <p className="text-sm text-foreground-muted mb-1">Preco Spot Atual</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">R$ {stats.currentPrice}</span>
              <span className="text-foreground-muted">/MWh</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-success-500">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">+12% vs hora anterior</span>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <p className="text-xs text-foreground-muted">Minimo Hoje</p>
              <p className="text-xl font-bold text-success-500">R$ {stats.minPrice}</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <p className="text-xs text-foreground-muted">Media Hoje</p>
              <p className="text-xl font-bold text-foreground">R$ {stats.avgPrice}</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <p className="text-xs text-foreground-muted">Maximo Hoje</p>
              <p className="text-xl font-bold text-danger-500">R$ {stats.maxPrice}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Receita Hoje</span>
            <DollarSign className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-success-500">
            R$ {(stats.todayRevenue * 1000).toLocaleString('pt-BR')}
          </div>
          <div className="flex items-center gap-1 text-xs text-success-500 mt-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+8% vs ontem</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Receita Mensal</span>
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {(stats.monthRevenue * 1000).toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            Ultimos 30 dias
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Energia Vendida</span>
            <ArrowUpRight className="w-5 h-5 text-danger-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalSold} kWh</div>
          <div className="text-xs text-foreground-muted mt-1">
            Este mes
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Energia Comprada</span>
            <ArrowDownRight className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalBought} kWh</div>
          <div className="text-xs text-foreground-muted mt-1">
            Este mes
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {(['realtime', 'history', 'orders'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedView(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              selectedView === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            {tab === 'realtime' ? 'Tempo Real' : tab === 'history' ? 'Historico' : 'Ordens'}
          </button>
        ))}
      </div>

      {selectedView === 'realtime' && (
        <>
          {/* Price Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Precos do Mercado Spot</h2>
                <p className="text-sm text-foreground-muted">Preco atual vs previsao - CCEE</p>
              </div>
              <Clock className="w-5 h-5 text-foreground-muted" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={priceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [`R$ ${value.toFixed(2)}/MWh`, name]}
                  />
                  <Legend />
                  <ReferenceLine y={250} stroke="#22c55e" strokeDasharray="3 3" label="Comprar" />
                  <ReferenceLine y={400} stroke="#ef4444" strokeDasharray="3 3" label="Vender" />
                  <Area
                    type="monotone"
                    dataKey="spotPrice"
                    name="Preco Spot"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecastPrice"
                    name="Previsao"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trading Signals */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Sinais de Trading</h2>
            <div className="grid grid-cols-24 gap-1">
              {priceData.map((data, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center"
                  title={`${data.time}: R$ ${data.spotPrice}/MWh - ${data.action.toUpperCase()}`}
                >
                  <div
                    className={cn(
                      'w-full h-8 rounded-sm',
                      data.action === 'buy' && 'bg-success-500/50',
                      data.action === 'sell' && 'bg-danger-500/50',
                      data.action === 'hold' && 'bg-foreground-muted/20'
                    )}
                  />
                  <span className="text-xs text-foreground-muted mt-1">
                    {index % 4 === 0 ? data.time.split(':')[0] : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-success-500/50" />
                <span className="text-foreground-muted">Comprar (preco baixo)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-danger-500/50" />
                <span className="text-foreground-muted">Vender (preco alto)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-foreground-muted/20" />
                <span className="text-foreground-muted">Manter</span>
              </div>
            </div>
          </div>

          {/* Strategy Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Estrategia de Compra</h3>
              <div className="space-y-4">
                <div className="p-4 bg-success-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">Preco Limite de Compra</span>
                    <span className="text-success-500 font-bold">R$ 250/MWh</span>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    Comprar energia quando preco spot estiver abaixo deste valor
                  </p>
                </div>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">Horario Preferencial</span>
                    <span className="text-foreground font-medium">00:00 - 06:00</span>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    Priorizar compras durante madrugada (precos mais baixos)
                  </p>
                </div>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">Volume Maximo</span>
                    <span className="text-foreground font-medium">100 kWh/hora</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Estrategia de Venda</h3>
              <div className="space-y-4">
                <div className="p-4 bg-danger-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">Preco Limite de Venda</span>
                    <span className="text-danger-500 font-bold">R$ 400/MWh</span>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    Vender energia quando preco spot estiver acima deste valor
                  </p>
                </div>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">Horario Preferencial</span>
                    <span className="text-foreground font-medium">17:00 - 21:00</span>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    Priorizar vendas durante horario de ponta
                  </p>
                </div>
                <div className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">SOC Minimo Reserva</span>
                    <span className="text-foreground font-medium">20%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedView === 'history' && (
        <>
          {/* Revenue Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Receita Liquida Diaria</h2>
                <p className="text-sm text-foreground-muted">Ultimos 30 dias</p>
              </div>
              <Calendar className="w-5 h-5 text-foreground-muted" />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={10} interval={4} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`R$ ${(value * 1000).toLocaleString('pt-BR')}`, '']}
                  />
                  <Bar dataKey="netRevenue" name="Receita Liquida" radius={[4, 4, 0, 0]}>
                    {revenueHistory.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.netRevenue >= 0 ? '#22c55e' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Buy/Sell Volume */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Volume de Transacoes</h2>
                <p className="text-sm text-foreground-muted">Compra vs Venda</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={10} interval={4} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kWh" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sold"
                    name="Vendido"
                    fill="#ef4444"
                    fillOpacity={0.3}
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="bought"
                    name="Comprado"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {selectedView === 'orders' && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Ordens Recentes</h2>
            <button className="text-sm text-primary hover:underline">Ver todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Qtd (kWh)</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Preco</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Horario</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Mercado</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-surface-hover">
                    <td className="py-3 px-4 font-medium text-foreground">{order.id}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        order.type === 'buy' ? 'bg-success-500/20 text-success-500' : 'bg-danger-500/20 text-danger-500'
                      )}>
                        {order.type === 'buy' ? 'Compra' : 'Venda'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        order.status === 'executed' && 'bg-success-500/20 text-success-500',
                        order.status === 'pending' && 'bg-warning-500/20 text-warning-500',
                        order.status === 'cancelled' && 'bg-foreground-muted/20 text-foreground-muted'
                      )}>
                        {order.status === 'executed' ? 'Executada' : order.status === 'pending' ? 'Pendente' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-foreground">{order.quantity}</td>
                    <td className="py-3 px-4 text-right text-foreground">R$ {order.price}</td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">
                      R$ {order.total.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-foreground-muted">{order.timestamp}</td>
                    <td className="py-3 px-4 text-foreground-muted">{order.market}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
