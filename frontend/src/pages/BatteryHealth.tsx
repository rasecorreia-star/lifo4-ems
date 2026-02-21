import { useState, useMemo } from 'react';
import {
  Battery,
  BatteryWarning,
  Heart,
  TrendingDown,
  TrendingUp,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Thermometer,
  Zap,
  RefreshCw,
  Download,
  Activity,
  Target,
  Shield,
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
  ReferenceLine,
  ComposedChart,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  description: string;
}

interface DegradationData {
  month: string;
  soh: number;
  capacity: number;
  cycles: number;
  predicted: number;
}

interface CycleData {
  date: string;
  fullCycles: number;
  partialCycles: number;
  dod: number;
  efficiency: number;
}

interface TemperatureEvent {
  date: string;
  maxTemp: number;
  avgTemp: number;
  minTemp: number;
  duration: number;
  impact: 'none' | 'low' | 'medium' | 'high';
}

// Generate mock data
const generateDegradationHistory = (): DegradationData[] => {
  const data: DegradationData[] = [];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  let soh = 100;
  let cycles = 0;

  for (let year = 0; year < 2; year++) {
    for (let m = 0; m < 12; m++) {
      const monthIndex = year * 12 + m;
      if (monthIndex > 18) break; // 18 months of data

      // Simulate degradation (about 2-3% per year)
      const degradation = 0.15 + Math.random() * 0.1;
      soh = Math.max(70, soh - degradation);
      cycles += 25 + Math.floor(Math.random() * 10);

      // Linear prediction
      const predicted = 100 - (monthIndex * 0.2);

      data.push({
        month: `${months[m % 12]}/${year === 0 ? '24' : '25'}`,
        soh: Math.round(soh * 100) / 100,
        capacity: Math.round((soh / 100) * 500 * 10) / 10,
        cycles,
        predicted: Math.round(predicted * 100) / 100,
      });
    }
  }
  return data;
};

const generateCycleHistory = (): CycleData[] => {
  const data: CycleData[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      fullCycles: Math.random() > 0.7 ? 1 : 0,
      partialCycles: 1 + Math.floor(Math.random() * 3),
      dod: 40 + Math.floor(Math.random() * 40),
      efficiency: 92 + Math.random() * 6,
    });
  }
  return data;
};

const generateTemperatureEvents = (): TemperatureEvent[] => {
  return [
    { date: '20/01/2026', maxTemp: 42, avgTemp: 35, minTemp: 28, duration: 4, impact: 'medium' },
    { date: '15/01/2026', maxTemp: 38, avgTemp: 32, minTemp: 26, duration: 2, impact: 'low' },
    { date: '10/01/2026', maxTemp: 36, avgTemp: 30, minTemp: 24, duration: 1, impact: 'none' },
    { date: '05/01/2026', maxTemp: 44, avgTemp: 38, minTemp: 30, duration: 6, impact: 'high' },
    { date: '28/12/2025', maxTemp: 40, avgTemp: 34, minTemp: 28, duration: 3, impact: 'medium' },
  ];
};

const healthMetrics: HealthMetric[] = [
  {
    name: 'State of Health (SOH)',
    value: 96.8,
    unit: '%',
    status: 'good',
    trend: 'down',
    description: 'Capacidade atual vs capacidade nominal',
  },
  {
    name: 'Capacidade Disponivel',
    value: 484,
    unit: 'kWh',
    status: 'good',
    trend: 'stable',
    description: 'Capacidade real de armazenamento',
  },
  {
    name: 'Ciclos Totais',
    value: 487,
    unit: 'ciclos',
    status: 'good',
    trend: 'up',
    description: 'Equivalente a ciclos completos',
  },
  {
    name: 'Resistencia Interna',
    value: 12.4,
    unit: 'mΩ',
    status: 'good',
    trend: 'stable',
    description: 'Resistencia media das celulas',
  },
  {
    name: 'Desbalanceamento',
    value: 45,
    unit: 'mV',
    status: 'warning',
    trend: 'up',
    description: 'Diferenca max entre celulas',
  },
  {
    name: 'Eficiencia Round-Trip',
    value: 94.2,
    unit: '%',
    status: 'good',
    trend: 'stable',
    description: 'Eficiencia de carga/descarga',
  },
];

export default function BatteryHealth() {
  const [selectedSystem, setSelectedSystem] = useState('BESS-001');
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | '2y' | 'all'>('1y');

  const degradationData = useMemo(() => generateDegradationHistory(), []);
  const cycleData = useMemo(() => generateCycleHistory(), []);
  const temperatureEvents = useMemo(() => generateTemperatureEvents(), []);

  // Calculate summary stats
  const stats = useMemo(() => {
    const currentSOH = degradationData[degradationData.length - 1]?.soh || 100;
    const initialSOH = degradationData[0]?.soh || 100;
    const totalDegradation = initialSOH - currentSOH;
    const monthlyRate = totalDegradation / degradationData.length;
    const yearsRemaining = (currentSOH - 70) / (monthlyRate * 12);
    const totalCycles = degradationData[degradationData.length - 1]?.cycles || 0;
    const avgDOD = cycleData.reduce((sum, c) => sum + c.dod, 0) / cycleData.length;

    return {
      currentSOH,
      totalDegradation: Math.round(totalDegradation * 100) / 100,
      monthlyRate: Math.round(monthlyRate * 1000) / 1000,
      yearsRemaining: Math.round(yearsRemaining * 10) / 10,
      totalCycles,
      avgDOD: Math.round(avgDOD),
      warrantyStatus: currentSOH > 80 ? 'covered' : 'expired',
    };
  }, [degradationData, cycleData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-success-500';
      case 'warning':
        return 'text-warning-500';
      case 'critical':
        return 'text-danger-500';
      default:
        return 'text-foreground-muted';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-success-500/20';
      case 'warning':
        return 'bg-warning-500/20';
      case 'critical':
        return 'bg-danger-500/20';
      default:
        return 'bg-surface-hover';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saude da Bateria</h1>
          <p className="text-foreground-muted mt-1">
            Monitoramento de degradacao e metricas de saude
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
          >
            <option value="BESS-001">BESS-001 - Teresina Centro</option>
            <option value="BESS-002">BESS-002 - Picos Industrial</option>
            <option value="BESS-003">BESS-003 - Parnaiba Solar</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <Download className="w-4 h-4" />
            Relatorio
          </button>
        </div>
      </div>

      {/* SOH Overview Card */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main SOH Display */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center">
            <div className="relative">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="12"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke={stats.currentSOH > 90 ? '#22c55e' : stats.currentSOH > 80 ? '#eab308' : '#ef4444'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.currentSOH / 100) * 440} 440`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-foreground">{stats.currentSOH}%</span>
                <span className="text-sm text-foreground-muted">SOH</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-foreground-muted">Vida util restante estimada</p>
              <p className="text-xl font-semibold text-foreground">{stats.yearsRemaining} anos</p>
            </div>
          </div>

          {/* Key Stats */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-warning-500" />
                <span className="text-sm text-foreground-muted">Degradacao Total</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.totalDegradation}%</div>
              <div className="text-xs text-foreground-muted mt-1">
                {stats.monthlyRate}%/mes
              </div>
            </div>

            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground-muted">Ciclos Totais</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.totalCycles}</div>
              <div className="text-xs text-foreground-muted mt-1">
                de 6000 garantidos
              </div>
            </div>

            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-success-500" />
                <span className="text-sm text-foreground-muted">DOD Medio</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.avgDOD}%</div>
              <div className="text-xs text-foreground-muted mt-1">
                Profundidade de descarga
              </div>
            </div>

            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-success-500" />
                <span className="text-sm text-foreground-muted">Garantia</span>
              </div>
              <div className="text-2xl font-bold text-success-500">Ativa</div>
              <div className="text-xs text-foreground-muted mt-1">
                Ate Dez/2033 ou 80% SOH
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthMetrics.map((metric) => (
          <div key={metric.name} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm text-foreground-muted">{metric.name}</span>
              <div className={cn('p-1.5 rounded-lg', getStatusBg(metric.status))}>
                {metric.status === 'good' && <CheckCircle className={cn('w-4 h-4', getStatusColor(metric.status))} />}
                {metric.status === 'warning' && <AlertTriangle className={cn('w-4 h-4', getStatusColor(metric.status))} />}
                {metric.status === 'critical' && <BatteryWarning className={cn('w-4 h-4', getStatusColor(metric.status))} />}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{metric.value}</span>
              <span className="text-sm text-foreground-muted">{metric.unit}</span>
              {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-warning-500" />}
              {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-foreground-muted mt-2">{metric.description}</p>
          </div>
        ))}
      </div>

      {/* Degradation Chart */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Curva de Degradacao</h2>
            <p className="text-sm text-foreground-muted">Historico de SOH e capacidade</p>
          </div>
          <div className="flex items-center gap-2 bg-surface-hover rounded-lg p-1">
            {(['6m', '1y', '2y', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  timeRange === range
                    ? 'bg-primary text-white'
                    : 'text-foreground-muted hover:text-foreground'
                )}
              >
                {range === '6m' ? '6M' : range === '1y' ? '1A' : range === '2y' ? '2A' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={degradationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis yAxisId="soh" domain={[85, 100]} stroke="var(--foreground-muted)" fontSize={12} unit="%" />
              <YAxis yAxisId="capacity" orientation="right" domain={[425, 500]} stroke="var(--foreground-muted)" fontSize={12} unit=" kWh" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <ReferenceLine yAxisId="soh" y={80} stroke="#ef4444" strokeDasharray="5 5" label="Garantia (80%)" />
              <Area
                yAxisId="soh"
                type="monotone"
                dataKey="soh"
                name="SOH Real"
                fill="#22c55e"
                fillOpacity={0.3}
                stroke="#22c55e"
                strokeWidth={2}
              />
              <Line
                yAxisId="soh"
                type="monotone"
                dataKey="predicted"
                name="SOH Previsto"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
              <Line
                yAxisId="capacity"
                type="monotone"
                dataKey="capacity"
                name="Capacidade"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cycle History */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Historico de Ciclos</h2>
              <p className="text-sm text-foreground-muted">Ultimos 30 dias</p>
            </div>
            <RefreshCw className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cycleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={10} interval={4} />
                <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="fullCycles" name="Ciclos Completos" stackId="a" fill="#3b82f6" />
                <Bar dataKey="partialCycles" name="Ciclos Parciais" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Trend */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Eficiencia Round-Trip</h2>
              <p className="text-sm text-foreground-muted">Ultimos 30 dias</p>
            </div>
            <Zap className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cycleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={10} interval={4} />
                <YAxis domain={[90, 100]} stroke="var(--foreground-muted)" fontSize={12} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Eficiencia']}
                />
                <ReferenceLine y={92} stroke="#eab308" strokeDasharray="3 3" label="Min. Esperado" />
                <Area
                  type="monotone"
                  dataKey="efficiency"
                  name="Eficiencia"
                  fill="#22c55e"
                  fillOpacity={0.3}
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Temperature Events */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Eventos de Temperatura</h2>
            <p className="text-sm text-foreground-muted">Ocorrencias que podem impactar a vida util</p>
          </div>
          <Thermometer className="w-5 h-5 text-foreground-muted" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Data</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Temp. Max</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Temp. Media</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Duracao</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {temperatureEvents.map((event, index) => (
                <tr key={index} className="border-b border-border hover:bg-surface-hover">
                  <td className="py-3 px-4 font-medium text-foreground">{event.date}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'font-medium',
                      event.maxTemp > 40 ? 'text-danger-500' : event.maxTemp > 35 ? 'text-warning-500' : 'text-foreground'
                    )}>
                      {event.maxTemp}°C
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-foreground">{event.avgTemp}°C</td>
                  <td className="py-3 px-4 text-center text-foreground-muted">{event.duration}h</td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      event.impact === 'none' && 'bg-success-500/20 text-success-500',
                      event.impact === 'low' && 'bg-primary/20 text-primary',
                      event.impact === 'medium' && 'bg-warning-500/20 text-warning-500',
                      event.impact === 'high' && 'bg-danger-500/20 text-danger-500'
                    )}>
                      {event.impact === 'none' ? 'Nenhum' : event.impact === 'low' ? 'Baixo' : event.impact === 'medium' ? 'Medio' : 'Alto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Status Geral</h3>
              <p className="text-sm text-success-500">Excelente</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            A bateria esta operando dentro dos parametros esperados.
            Degradacao esta 15% abaixo da curva prevista pelo fabricante.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Atencao</h3>
              <p className="text-sm text-warning-500">Desbalanceamento</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            Diferenca de 45mV entre celulas detectada. Considere executar
            ciclo de balanceamento ativo na proxima manutencao.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Recomendacao</h3>
              <p className="text-sm text-primary">Otimizacao</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            Reduzir DOD maximo para 70% pode estender vida util em
            aproximadamente 18 meses, com impacto minimo na operacao.
          </p>
        </div>
      </div>
    </div>
  );
}
