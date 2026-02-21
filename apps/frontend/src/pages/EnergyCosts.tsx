import { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle,
  Zap,
  Battery,
  Sun,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Receipt,
  BarChart3,
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
  Cell,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

interface TariffPeriod {
  name: string;
  start: string;
  end: string;
  rate: number;
  type: 'peak' | 'intermediate' | 'off_peak';
}

interface DailyCost {
  date: string;
  gridCost: number;
  savings: number;
  solarValue: number;
  batterySavings: number;
}

interface HourlyCost {
  hour: string;
  gridCost: number;
  tariff: number;
  consumption: number;
  type: 'peak' | 'intermediate' | 'off_peak';
}

interface MonthlyBill {
  month: string;
  withoutBess: number;
  withBess: number;
  savings: number;
  solarCredits: number;
}

// Tariff structure (ANEEL white tariff example)
const tariffPeriods: TariffPeriod[] = [
  { name: 'Fora Ponta', start: '00:00', end: '17:00', rate: 0.45, type: 'off_peak' },
  { name: 'Intermediario', start: '17:00', end: '18:00', rate: 0.68, type: 'intermediate' },
  { name: 'Ponta', start: '18:00', end: '21:00', rate: 1.12, type: 'peak' },
  { name: 'Intermediario', start: '21:00', end: '22:00', rate: 0.68, type: 'intermediate' },
  { name: 'Fora Ponta', start: '22:00', end: '00:00', rate: 0.45, type: 'off_peak' },
];

const generateHourlyCosts = (): HourlyCost[] => {
  const hours: HourlyCost[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = `${i.toString().padStart(2, '0')}:00`;
    let type: 'peak' | 'intermediate' | 'off_peak';
    let tariff: number;

    if (i >= 18 && i < 21) {
      type = 'peak';
      tariff = 1.12;
    } else if ((i >= 17 && i < 18) || (i >= 21 && i < 22)) {
      type = 'intermediate';
      tariff = 0.68;
    } else {
      type = 'off_peak';
      tariff = 0.45;
    }

    const baseConsumption = 30 + Math.sin((i - 6) * Math.PI / 12) * 25;
    const consumption = Math.max(10, baseConsumption + Math.random() * 10);
    const gridCost = consumption * tariff;

    hours.push({
      hour,
      tariff,
      consumption: Math.round(consumption * 10) / 10,
      gridCost: Math.round(gridCost * 100) / 100,
      type,
    });
  }
  return hours;
};

const generateDailyCosts = (): DailyCost[] => {
  const days: DailyCost[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const baseGridCost = isWeekend ? 35 : 55;
    const gridCost = baseGridCost + Math.random() * 15;
    const solarValue = 25 + Math.random() * 15;
    const batterySavings = 12 + Math.random() * 8;
    const savings = solarValue + batterySavings;

    days.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      gridCost: Math.round(gridCost * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      solarValue: Math.round(solarValue * 100) / 100,
      batterySavings: Math.round(batterySavings * 100) / 100,
    });
  }
  return days;
};

const generateMonthlyBills = (): MonthlyBill[] => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months.map((month, index) => {
    const summer = index < 3 || index > 9;
    const baseWithout = 1800 + (summer ? 400 : 0) + Math.random() * 200;
    const solarCredits = 600 + (summer ? 200 : -100) + Math.random() * 100;
    const batterySavings = 250 + Math.random() * 100;
    const withBess = baseWithout - solarCredits - batterySavings;
    const savings = baseWithout - withBess;

    return {
      month,
      withoutBess: Math.round(baseWithout),
      withBess: Math.round(withBess),
      savings: Math.round(savings),
      solarCredits: Math.round(solarCredits),
    };
  });
};

export default function EnergyCosts() {
  const [selectedView, setSelectedView] = useState<'daily' | 'monthly' | 'tariffs'>('daily');

  const hourlyCosts = useMemo(() => generateHourlyCosts(), []);
  const dailyCosts = useMemo(() => generateDailyCosts(), []);
  const monthlyBills = useMemo(() => generateMonthlyBills(), []);

  // Calculate totals
  const totals = useMemo(() => {
    const dailyTotal = dailyCosts.reduce((sum, d) => sum + d.gridCost, 0);
    const totalSavings = dailyCosts.reduce((sum, d) => sum + d.savings, 0);
    const avgDaily = dailyTotal / dailyCosts.length;
    const yearlyProjection = avgDaily * 365;
    const yearlySavings = (totalSavings / dailyCosts.length) * 365;

    return {
      monthlyTotal: Math.round(dailyTotal),
      monthlyAvg: Math.round(avgDaily * 30),
      totalSavings: Math.round(totalSavings),
      avgDailySavings: Math.round(totalSavings / dailyCosts.length),
      yearlyProjection: Math.round(yearlyProjection),
      yearlySavings: Math.round(yearlySavings),
      savingsPercent: Math.round((totalSavings / (dailyTotal + totalSavings)) * 100),
    };
  }, [dailyCosts]);

  // Get tariff color
  const getTariffColor = (type: 'peak' | 'intermediate' | 'off_peak') => {
    switch (type) {
      case 'peak':
        return '#ef4444';
      case 'intermediate':
        return '#f59e0b';
      case 'off_peak':
        return '#22c55e';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Custos de Energia</h1>
          <p className="text-foreground-muted mt-1">
            Analise custos, tarifas e economia com BESS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
            {(['daily', 'monthly', 'tariffs'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  selectedView === view
                    ? 'bg-primary text-white'
                    : 'text-foreground-muted hover:text-foreground'
                )}
              >
                {view === 'daily' ? 'Diario' : view === 'monthly' ? 'Mensal' : 'Tarifas'}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Custo Mensal (Rede)</span>
            <Receipt className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {totals.monthlyTotal.toLocaleString('pt-BR')}
          </div>
          <div className="flex items-center gap-1 text-xs text-danger-500 mt-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+5.2% vs mes anterior</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Economia Total</span>
            <PiggyBank className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-success-500">
            R$ {totals.totalSavings.toLocaleString('pt-BR')}
          </div>
          <div className="flex items-center gap-1 text-xs text-success-500 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>{totals.savingsPercent}% de reducao</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Economia Media/Dia</span>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {totals.avgDailySavings.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            Solar + Bateria combinados
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Projecao Anual</span>
            <BarChart3 className="w-5 h-5 text-warning-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {totals.yearlySavings.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            de economia estimada
          </div>
        </div>
      </div>

      {/* Main Content Based on Selected View */}
      {selectedView === 'daily' && (
        <>
          {/* Hourly Costs Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Custo por Hora (Hoje)</h2>
                <p className="text-sm text-foreground-muted">Consumo x Tarifa ao longo do dia</p>
              </div>
              <Clock className="w-5 h-5 text-foreground-muted" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyCosts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis yAxisId="cost" stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                  <YAxis yAxisId="tariff" orientation="right" stroke="var(--foreground-muted)" fontSize={12} unit=" R$/kWh" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'Tarifa' ? `R$ ${value.toFixed(2)}/kWh` : `R$ ${value.toFixed(2)}`,
                      name
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="cost" dataKey="gridCost" name="Custo">
                    {hourlyCosts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getTariffColor(entry.type)} fillOpacity={0.7} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="tariff"
                    type="stepAfter"
                    dataKey="tariff"
                    name="Tarifa"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Costs Trend */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Custos e Economia (30 dias)</h2>
                <p className="text-sm text-foreground-muted">Evolucao diaria de custos e economia</p>
              </div>
              <Calendar className="w-5 h-5 text-foreground-muted" />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyCosts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
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
                    dataKey="gridCost"
                    name="Custo Rede"
                    fill="#ef4444"
                    fillOpacity={0.3}
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    name="Economia"
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

      {selectedView === 'monthly' && (
        <>
          {/* Monthly Comparison */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Comparativo Mensal</h2>
                <p className="text-sm text-foreground-muted">Fatura com e sem sistema BESS</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBills} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                  />
                  <Legend />
                  <Bar dataKey="withoutBess" name="Sem BESS" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="withBess" name="Com BESS" fill="#22c55e" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Savings Breakdown */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Composicao da Economia</h2>
                <p className="text-sm text-foreground-muted">Solar + Bateria por mes</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyBills}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="solarCredits"
                    name="Creditos Solar"
                    stackId="1"
                    fill="#eab308"
                    fillOpacity={0.6}
                    stroke="#eab308"
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    name="Economia Total"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Annual Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-danger-500/20 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-danger-500" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Gasto Anual (Sem BESS)</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {monthlyBills.reduce((sum, m) => sum + m.withoutBess, 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-success-500/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-success-500" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Gasto Anual (Com BESS)</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {monthlyBills.reduce((sum, m) => sum + m.withBess, 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <PiggyBank className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Economia Anual</p>
                  <p className="text-2xl font-bold text-success-500">
                    R$ {monthlyBills.reduce((sum, m) => sum + m.savings, 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedView === 'tariffs' && (
        <>
          {/* Tariff Structure */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Estrutura Tarifaria</h2>
                <p className="text-sm text-foreground-muted">Tarifa Branca (ANEEL)</p>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                <Settings className="w-4 h-4" />
                Configurar
              </button>
            </div>

            {/* Visual Timeline */}
            <div className="mb-6">
              <div className="flex h-12 rounded-lg overflow-hidden">
                {/* Off-peak morning (0-17) */}
                <div
                  className="bg-success-500/30 flex items-center justify-center text-success-500 text-sm font-medium"
                  style={{ width: `${(17 / 24) * 100}%` }}
                >
                  Fora Ponta
                </div>
                {/* Intermediate (17-18) */}
                <div
                  className="bg-warning-500/30 flex items-center justify-center text-warning-500 text-sm font-medium"
                  style={{ width: `${(1 / 24) * 100}%` }}
                >
                </div>
                {/* Peak (18-21) */}
                <div
                  className="bg-danger-500/30 flex items-center justify-center text-danger-500 text-sm font-medium"
                  style={{ width: `${(3 / 24) * 100}%` }}
                >
                  Ponta
                </div>
                {/* Intermediate (21-22) */}
                <div
                  className="bg-warning-500/30 flex items-center justify-center text-warning-500 text-sm font-medium"
                  style={{ width: `${(1 / 24) * 100}%` }}
                >
                </div>
                {/* Off-peak night (22-24) */}
                <div
                  className="bg-success-500/30 flex items-center justify-center text-success-500 text-sm font-medium"
                  style={{ width: `${(2 / 24) * 100}%` }}
                >
                </div>
              </div>
              <div className="flex justify-between text-xs text-foreground-muted mt-2">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* Tariff Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Periodo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Horario</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Tarifa (R$/kWh)</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">vs Ponta</th>
                  </tr>
                </thead>
                <tbody>
                  {tariffPeriods.map((period, index) => (
                    <tr key={index} className="border-b border-border hover:bg-surface-hover">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full',
                              period.type === 'peak' && 'bg-danger-500',
                              period.type === 'intermediate' && 'bg-warning-500',
                              period.type === 'off_peak' && 'bg-success-500'
                            )}
                          />
                          <span className="font-medium text-foreground">{period.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground-muted">
                        {period.start} - {period.end}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">
                        R$ {period.rate.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {period.type === 'peak' ? (
                          <span className="text-danger-500">Referencia</span>
                        ) : (
                          <span className="text-success-500">
                            -{Math.round((1 - period.rate / 1.12) * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optimization Strategy */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Estrategia de Carregamento</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-success-500/10 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center flex-shrink-0">
                    <Battery className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Carregar (Fora Ponta)</p>
                    <p className="text-sm text-foreground-muted mt-1">
                      22:00 - 06:00: Carregar bateria com tarifa minima (R$ 0.45/kWh)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-warning-500/10 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-5 h-5 text-warning-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Solar (Intermediario)</p>
                    <p className="text-sm text-foreground-muted mt-1">
                      06:00 - 17:00: Autoconsumo solar + excedente para bateria
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-danger-500/10 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-danger-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-danger-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Descarregar (Ponta)</p>
                    <p className="text-sm text-foreground-muted mt-1">
                      18:00 - 21:00: Descarregar bateria para evitar tarifa maxima (R$ 1.12/kWh)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Impacto Financeiro</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success-500" />
                    <span className="text-foreground">Arbitragem Tarifaria</span>
                  </div>
                  <span className="font-semibold text-success-500">R$ 180/mes</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success-500" />
                    <span className="text-foreground">Autoconsumo Solar</span>
                  </div>
                  <span className="font-semibold text-success-500">R$ 650/mes</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success-500" />
                    <span className="text-foreground">Peak Shaving</span>
                  </div>
                  <span className="font-semibold text-success-500">R$ 120/mes</span>
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Economia Total Estimada</span>
                    <span className="text-xl font-bold text-success-500">R$ 950/mes</span>
                  </div>
                  <p className="text-sm text-foreground-muted mt-2">
                    ROI estimado do sistema BESS: 4.2 anos
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Aviso de Bandeira Tarifaria</p>
                <p className="text-sm text-foreground-muted mt-1">
                  Bandeira Vermelha ativa este mes. Adicional de R$ 0.0649/kWh.
                  Considere aumentar o uso da bateria durante horarios de ponta para maximizar economia.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
