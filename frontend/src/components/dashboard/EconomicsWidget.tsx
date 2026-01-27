/**
 * Economics Widget
 * Shows financial metrics, savings, and ROI for the BESS system
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  PiggyBank,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Wallet,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface EconomicsData {
  dailySavings: number;
  monthlySavings: number;
  yearlySavings: number;
  totalSavings: number;
  arbitrageRevenue: number;
  peakShavingSavings: number;
  demandChargeSavings: number;
  systemCost: number;
  paybackYears: number;
  roi: number;
}

interface EconomicsWidgetProps {
  systemId?: string;
  className?: string;
}

// Generate mock economics data
const generateEconomicsData = (): EconomicsData => {
  const dailySavings = 150 + Math.random() * 100;
  const monthlySavings = dailySavings * 30;
  const yearlySavings = monthlySavings * 12;
  const systemCost = 450000; // R$ 450k for a typical commercial BESS

  return {
    dailySavings,
    monthlySavings,
    yearlySavings,
    totalSavings: yearlySavings * 2.5 + Math.random() * 50000, // Simulated accumulated
    arbitrageRevenue: dailySavings * 0.4,
    peakShavingSavings: dailySavings * 0.35,
    demandChargeSavings: dailySavings * 0.25,
    systemCost,
    paybackYears: systemCost / yearlySavings,
    roi: ((yearlySavings * 10 - systemCost) / systemCost) * 100,
  };
};

// Generate monthly savings trend
const generateMonthlySavings = () => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentMonth = new Date().getMonth();

  return months.map((month, index) => {
    const isPast = index <= currentMonth;
    const baseSavings = 4000 + Math.random() * 2000;
    const seasonalFactor = index >= 4 && index <= 9 ? 1.2 : 0.9; // Higher in winter months

    return {
      month,
      savings: isPast ? baseSavings * seasonalFactor : 0,
      projected: baseSavings * seasonalFactor,
    };
  });
};

const COLORS = ['#10B981', '#3B82F6', '#F59E0B'];

export default function EconomicsWidget({ systemId, className }: EconomicsWidgetProps) {
  const [data, setData] = useState<EconomicsData | null>(null);
  const [monthlySavings, setMonthlySavings] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'month' | 'year'>('month');

  useEffect(() => {
    setData(generateEconomicsData());
    setMonthlySavings(generateMonthlySavings());
  }, [systemId]);

  if (!data) return null;

  const savingsBreakdown = [
    { name: 'Arbitragem', value: data.arbitrageRevenue, color: '#10B981' },
    { name: 'Peak Shaving', value: data.peakShavingSavings, color: '#3B82F6' },
    { name: 'Demanda', value: data.demandChargeSavings, color: '#F59E0B' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className={cn('bg-surface rounded-xl border border-border p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-green-400" />
          Analise Economica
        </h3>
        <div className="flex gap-1 bg-surface-hover rounded-lg p-1">
          {(['day', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                timeRange === range
                  ? 'bg-primary text-white'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              {range === 'day' ? 'Dia' : range === 'month' ? 'Mes' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-green-500/10 rounded-lg">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">Economia {timeRange === 'day' ? 'Hoje' : timeRange === 'month' ? 'Mes' : 'Ano'}</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(
              timeRange === 'day'
                ? data.dailySavings
                : timeRange === 'month'
                ? data.monthlySavings
                : data.yearlySavings
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
            <ArrowUpRight className="w-3 h-3" />
            +12% vs periodo anterior
          </div>
        </div>

        <div className="p-4 bg-blue-500/10 rounded-lg">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-xs">Total Acumulado</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {formatCurrency(data.totalSavings)}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            desde a instalacao
          </div>
        </div>

        <div className="p-4 bg-purple-500/10 rounded-lg">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">Payback</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {data.paybackYears.toFixed(1)} anos
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            {formatCurrency(data.systemCost)} investido
          </div>
        </div>

        <div className="p-4 bg-yellow-500/10 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs">ROI (10 anos)</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {data.roi.toFixed(0)}%
          </div>
          <div className="flex items-center gap-1 text-xs text-yellow-400 mt-1">
            <TrendingUp className="w-3 h-3" />
            Retorno positivo
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly Trend */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-medium text-foreground mb-4">Economia Mensal</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySavings}>
                <XAxis
                  dataKey="month"
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                />
                <YAxis
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value)]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="savings"
                  name="Realizado"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projetado"
                  stroke="#6B7280"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Savings Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-4">Composicao</h4>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={savingsBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {savingsBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {savingsBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-foreground-muted">{item.name}</span>
                </div>
                <span className="font-medium text-foreground">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with projection */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground-muted">
            Projecao anual baseada no desempenho atual
          </span>
          <div className="flex items-center gap-2 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">
              {formatCurrency(data.yearlySavings)} economia estimada
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
