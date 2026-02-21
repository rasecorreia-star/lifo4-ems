import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useForecast } from '@/hooks/useForecast';
import {
  Activity,
  Calendar,
  Clock,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  Zap,
  Sun,
  Moon,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Target,
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
} from 'recharts';
import { cn } from '@/lib/utils';

interface LoadData {
  hour: string;
  load: number;
  solar: number;
  grid: number;
  battery: number;
  predicted: number;
}

interface DailyPattern {
  day: string;
  peakLoad: number;
  avgLoad: number;
  minLoad: number;
  peakHour: string;
  solarGeneration: number;
  batteryUsage: number;
}

interface SeasonalData {
  month: string;
  avgLoad: number;
  peakLoad: number;
  solarAvg: number;
}

// Fixed mock data
const hourlyData: LoadData[] = [
  { hour: '00:00', load: 45.2, solar: 0, grid: 45.2, battery: 0, predicted: 48 },
  { hour: '01:00', load: 42.8, solar: 0, grid: 42.8, battery: 0, predicted: 45 },
  { hour: '02:00', load: 40.1, solar: 0, grid: 40.1, battery: 0, predicted: 42 },
  { hour: '03:00', load: 38.5, solar: 0, grid: 38.5, battery: 0, predicted: 40 },
  { hour: '04:00', load: 37.2, solar: 0, grid: 37.2, battery: 0, predicted: 39 },
  { hour: '05:00', load: 40.5, solar: 5, grid: 35.5, battery: 0, predicted: 42 },
  { hour: '06:00', load: 55.3, solar: 20, grid: 35.3, battery: 0, predicted: 58 },
  { hour: '07:00', load: 72.5, solar: 45, grid: 27.5, battery: 0, predicted: 75 },
  { hour: '08:00', load: 88.2, solar: 68, grid: 20.2, battery: 0, predicted: 90 },
  { hour: '09:00', load: 98.5, solar: 78, grid: 20.5, battery: 0, predicted: 100 },
  { hour: '10:00', load: 105.3, solar: 82, grid: 23.3, battery: 0, predicted: 105 },
  { hour: '11:00', load: 110.2, solar: 85, grid: 25.2, battery: 0, predicted: 108 },
  { hour: '12:00', load: 115.4, solar: 88, grid: 27.4, battery: 0, predicted: 112 },
  { hour: '13:00', load: 112.8, solar: 86, grid: 26.8, battery: 0, predicted: 110 },
  { hour: '14:00', load: 108.5, solar: 80, grid: 28.5, battery: 0, predicted: 105 },
  { hour: '15:00', load: 102.3, solar: 70, grid: 32.3, battery: 0, predicted: 100 },
  { hour: '16:00', load: 95.2, solar: 55, grid: 40.2, battery: 0, predicted: 92 },
  { hour: '17:00', load: 118.5, solar: 32, grid: 86.5, battery: -0.5, predicted: 120 },
  { hour: '18:00', load: 125.8, solar: 12, grid: 113.8, battery: -0.5, predicted: 128 },
  { hour: '19:00', load: 128.2, solar: 2, grid: 126.2, battery: 0, predicted: 130 },
  { hour: '20:00', load: 122.5, solar: 0, grid: 122.5, battery: 0, predicted: 125 },
  { hour: '21:00', load: 105.3, solar: 0, grid: 105.3, battery: 0, predicted: 108 },
  { hour: '22:00', load: 85.2, solar: 0, grid: 85.2, battery: 0, predicted: 88 },
  { hour: '23:00', load: 62.5, solar: 0, grid: 62.5, battery: 0, predicted: 65 },
];

const weeklyPatternData: DailyPattern[] = [
  { day: 'Dom', peakLoad: 92, avgLoad: 58, minLoad: 32, peakHour: '14:00', solarGeneration: 380, batteryUsage: 95 },
  { day: 'Seg', peakLoad: 118, avgLoad: 72, minLoad: 38, peakHour: '18:00', solarGeneration: 420, batteryUsage: 110 },
  { day: 'Ter', peakLoad: 120, avgLoad: 74, minLoad: 40, peakHour: '18:00', solarGeneration: 430, batteryUsage: 115 },
  { day: 'Qua', peakLoad: 119, avgLoad: 73, minLoad: 39, peakHour: '17:00', solarGeneration: 425, batteryUsage: 112 },
  { day: 'Qui', peakLoad: 121, avgLoad: 75, minLoad: 41, peakHour: '18:00', solarGeneration: 435, batteryUsage: 118 },
  { day: 'Sex', peakLoad: 125, avgLoad: 78, minLoad: 42, peakHour: '18:00', solarGeneration: 440, batteryUsage: 120 },
  { day: 'Sab', peakLoad: 95, avgLoad: 60, minLoad: 34, peakHour: '15:00', solarGeneration: 390, batteryUsage: 98 },
];

const seasonalData: SeasonalData[] = [
  { month: 'Jan', avgLoad: 68, peakLoad: 115, solarAvg: 380 },
  { month: 'Fev', avgLoad: 66, peakLoad: 112, solarAvg: 375 },
  { month: 'Mar', avgLoad: 64, peakLoad: 110, solarAvg: 360 },
  { month: 'Abr', avgLoad: 58, peakLoad: 98, solarAvg: 310 },
  { month: 'Mai', avgLoad: 54, peakLoad: 92, solarAvg: 280 },
  { month: 'Jun', avgLoad: 52, peakLoad: 90, solarAvg: 270 },
  { month: 'Jul', avgLoad: 53, peakLoad: 91, solarAvg: 275 },
  { month: 'Ago', avgLoad: 56, peakLoad: 95, solarAvg: 300 },
  { month: 'Set', avgLoad: 60, peakLoad: 102, solarAvg: 330 },
  { month: 'Out', avgLoad: 65, peakLoad: 110, solarAvg: 365 },
  { month: 'Nov', avgLoad: 67, peakLoad: 113, solarAvg: 375 },
  { month: 'Dez', avgLoad: 69, peakLoad: 116, solarAvg: 385 },
];

export default function LoadProfile() {
  const { systemId } = useParams<{ systemId: string }>();
  const currentSystemId = systemId || 'sys-demo-001';

  const { data: forecastData, isLoading, isError } = useForecast(currentSystemId);

  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [showPrediction, setShowPrediction] = useState(true);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">Carregando perfil de carga...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger-500">Erro ao carregar perfil de carga</div>
      </div>
    );
  }

  const hourlyDataMemo = useMemo(() => forecastData?.hourly || hourlyData, [forecastData?.hourly]);
  const weeklyPatternMemo = useMemo(() => forecastData?.weekly || weeklyPatternData, [forecastData?.weekly]);
  const seasonalDataMemo = useMemo(() => forecastData?.seasonal || seasonalData, [forecastData?.seasonal]);

  // Calculate statistics
  const stats = useMemo(() => {
    const loads = hourlyDataMemo.map((d: LoadData) => d.load);
    const solarGen = hourlyDataMemo.reduce((sum: number, d: LoadData) => sum + d.solar, 0);
    const gridUsage = hourlyDataMemo.reduce((sum: number, d: LoadData) => sum + d.grid, 0);
    const batteryNet = hourlyDataMemo.reduce((sum: number, d: LoadData) => sum + d.battery, 0);

    return {
      peakLoad: Math.max(...loads),
      minLoad: Math.min(...loads),
      avgLoad: loads.reduce((a: number, b: number) => a + b, 0) / loads.length,
      peakHour: hourlyData.find(d => d.load === Math.max(...loads))?.hour || '14:00',
      totalSolar: solarGen,
      totalGrid: gridUsage,
      batteryNet: batteryNet,
      selfConsumption: ((solarGen - Math.abs(batteryNet)) / solarGen) * 100,
    };
  }, [hourlyDataMemo]);

  // Identify peak hours
  const peakHours = useMemo(() => {
    const threshold = stats.avgLoad * 1.3;
    return hourlyDataMemo.filter((d: LoadData) => d.load > threshold).map((d: LoadData) => d.hour);
  }, [hourlyDataMemo, stats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil de Carga</h1>
          <p className="text-foreground-muted mt-1">
            Analise padroes de consumo e otimize o uso de energia
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
            {(['today', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  selectedPeriod === period
                    ? 'bg-primary text-white'
                    : 'text-foreground-muted hover:text-foreground'
                )}
              >
                {period === 'today' ? 'Hoje' : period === 'week' ? 'Semana' : 'Mes'}
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
            <span className="text-foreground-muted text-sm">Pico de Carga</span>
            <TrendingUp className="w-5 h-5 text-danger-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.peakLoad.toFixed(1)} kW</div>
          <div className="text-xs text-foreground-muted mt-1">
            <Clock className="w-3 h-3 inline mr-1" />
            Horario: {stats.peakHour}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Carga Media</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.avgLoad.toFixed(1)} kW</div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className="text-success-500">Min: {stats.minLoad.toFixed(1)} kW</span>
            <span className="text-danger-500">Max: {stats.peakLoad.toFixed(1)} kW</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Geracao Solar</span>
            <Sun className="w-5 h-5 text-warning-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalSolar.toFixed(0)} kWh</div>
          <div className="text-xs text-success-500 mt-1">
            Autoconsumo: {stats.selfConsumption.toFixed(1)}%
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Uso da Rede</span>
            <Zap className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalGrid.toFixed(0)} kWh</div>
          <div className="text-xs text-foreground-muted mt-1">
            {stats.batteryNet < 0 ? 'Bateria carregou: ' : 'Bateria descarregou: '}
            {Math.abs(stats.batteryNet).toFixed(0)} kWh
          </div>
        </div>
      </div>

      {/* Main Chart - Daily Load Profile */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Perfil de Carga Diario</h2>
            <p className="text-sm text-foreground-muted">Consumo, geracao solar e uso da bateria por hora</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrediction}
              onChange={(e) => setShowPrediction(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground-muted">Mostrar previsao</span>
          </label>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyDataMemo}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kW" />
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
                dataKey="solar"
                name="Solar"
                fill="#eab308"
                fillOpacity={0.3}
                stroke="#eab308"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="load"
                name="Carga"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              {showPrediction && (
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="Previsao"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
              <Bar dataKey="battery" name="Bateria" fill="#22c55e" radius={[2, 2, 0, 0]} />
              <ReferenceLine y={stats.avgLoad} stroke="#6b7280" strokeDasharray="3 3" label="Media" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Pattern */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Padrao Semanal</h2>
              <p className="text-sm text-foreground-muted">Variacao de carga por dia da semana</p>
            </div>
            <Calendar className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPatternMemo}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--foreground-muted)" fontSize={12} />
                <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kW" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="peakLoad" name="Pico" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgLoad" name="Media" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minLoad" name="Minimo" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Analysis */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Horarios de Pico</h2>
              <p className="text-sm text-foreground-muted">Periodos de maior consumo identificados</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-warning-500" />
          </div>

          <div className="space-y-4">
            {/* Peak Period Visualization */}
            <div className="grid grid-cols-24 gap-0.5">
              {Array.from({ length: 24 }, (_, i) => {
                const hour = `${i.toString().padStart(2, '0')}:00`;
                const isPeak = peakHours.includes(hour);
                const isOffPeak = i >= 22 || i < 6;
                return (
                  <div
                    key={i}
                    className={cn(
                      'h-8 rounded-sm flex items-center justify-center text-xs font-medium',
                      isPeak
                        ? 'bg-danger-500/30 text-danger-500'
                        : isOffPeak
                        ? 'bg-success-500/30 text-success-500'
                        : 'bg-surface-hover text-foreground-muted'
                    )}
                    title={hour}
                  >
                    {i % 4 === 0 ? i : ''}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-danger-500/30" />
                <span className="text-foreground-muted">Pico</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-success-500/30" />
                <span className="text-foreground-muted">Fora de Pico</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-surface-hover" />
                <span className="text-foreground-muted">Intermediario</span>
              </div>
            </div>

            {/* Peak Hours List */}
            <div className="space-y-2 mt-4">
              <p className="text-sm font-medium text-foreground">Horarios identificados como pico:</p>
              <div className="flex flex-wrap gap-2">
                {peakHours.map((hour: string) => (
                  <span
                    key={hour}
                    className="px-2 py-1 bg-danger-500/20 text-danger-500 rounded-md text-sm font-medium"
                  >
                    {hour}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-4 p-4 bg-primary/10 rounded-lg">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Recomendacao</p>
                  <p className="text-sm text-foreground-muted mt-1">
                    Considere programar a bateria para descarregar entre 14:00-18:00 para reduzir
                    o consumo da rede durante o horario de ponta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seasonal Analysis */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Analise Sazonal</h2>
            <p className="text-sm text-foreground-muted">Variacao de carga e geracao solar ao longo do ano</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-warning-500" />
              <span className="text-foreground-muted">Verao</span>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-primary" />
              <span className="text-foreground-muted">Inverno</span>
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={seasonalDataMemo}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis yAxisId="load" stroke="var(--foreground-muted)" fontSize={12} unit=" kW" />
              <YAxis yAxisId="solar" orientation="right" stroke="var(--foreground-muted)" fontSize={12} unit=" kWh" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                yAxisId="load"
                type="monotone"
                dataKey="peakLoad"
                name="Pico de Carga"
                fill="#ef4444"
                fillOpacity={0.3}
                stroke="#ef4444"
                strokeWidth={2}
              />
              <Area
                yAxisId="load"
                type="monotone"
                dataKey="avgLoad"
                name="Carga Media"
                fill="#3b82f6"
                fillOpacity={0.3}
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                yAxisId="solar"
                type="monotone"
                dataKey="solarAvg"
                name="Solar Media"
                stroke="#eab308"
                strokeWidth={2}
                dot={{ fill: '#eab308', r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Otimizacao Ativa</h3>
              <p className="text-sm text-foreground-muted">Bateria configurada corretamente</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            O sistema esta programado para carregar durante horario fora de ponta (22:00-06:00)
            e descarregar durante ponta (17:00-21:00).
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Tendencia de Aumento</h3>
              <p className="text-sm text-foreground-muted">Carga crescendo 5% este mes</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            O consumo medio aumentou em comparacao ao mes anterior. Considere verificar
            novos equipamentos ou mudancas de comportamento.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Potencial de Economia</h3>
              <p className="text-sm text-foreground-muted">R$ 450/mes estimado</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            Aumentando a capacidade da bateria em 20%, voce pode reduzir ainda mais
            o consumo da rede durante horarios de ponta.
          </p>
        </div>
      </div>
    </div>
  );
}
