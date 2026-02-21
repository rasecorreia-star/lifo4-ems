import { useState, useMemo } from 'react';
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
  ReferenceLine,
} from 'recharts';
import { format, subHours, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TelemetryData } from '@/types';
import { Clock, Zap, Battery, Thermometer, Activity } from 'lucide-react';

interface TelemetryChartsProps {
  history: TelemetryData[];
  isLoading?: boolean;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';
type ChartType = 'power' | 'soc' | 'voltage' | 'temperature' | 'current';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1 hora' },
  { value: '6h', label: '6 horas' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

const CHART_TYPES: { value: ChartType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'power', label: 'Potencia', icon: Zap, color: '#8b5cf6' },
  { value: 'soc', label: 'SOC', icon: Battery, color: '#06b6d4' },
  { value: 'voltage', label: 'Tensao', icon: Activity, color: '#f59e0b' },
  { value: 'temperature', label: 'Temperatura', icon: Thermometer, color: '#ef4444' },
  { value: 'current', label: 'Corrente', icon: Zap, color: '#22c55e' },
];

export default function TelemetryCharts({ history, isLoading }: TelemetryChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [activeCharts, setActiveCharts] = useState<ChartType[]>(['power', 'soc']);

  const toggleChart = (chart: ChartType) => {
    setActiveCharts(prev =>
      prev.includes(chart)
        ? prev.filter(c => c !== chart)
        : [...prev, chart]
    );
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case '1h':
        cutoff = subHours(now, 1);
        break;
      case '6h':
        cutoff = subHours(now, 6);
        break;
      case '24h':
        cutoff = subHours(now, 24);
        break;
      case '7d':
        cutoff = subDays(now, 7);
        break;
      case '30d':
        cutoff = subDays(now, 30);
        break;
      default:
        cutoff = subHours(now, 24);
    }

    return history
      .filter(t => new Date(t.timestamp) >= cutoff)
      .map(t => ({
        ...t,
        timestamp: new Date(t.timestamp).getTime(),
        formattedTime: format(new Date(t.timestamp),
          timeRange === '1h' || timeRange === '6h' ? 'HH:mm' :
          timeRange === '24h' ? 'HH:mm' :
          'dd/MM HH:mm',
          { locale: ptBR }
        ),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [history, timeRange]);

  const formatXAxis = (timestamp: number) => {
    if (timeRange === '1h' || timeRange === '6h') {
      return format(timestamp, 'HH:mm');
    } else if (timeRange === '24h') {
      return format(timestamp, 'HH:mm');
    } else {
      return format(timestamp, 'dd/MM');
    }
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-surface border border-border rounded-lg shadow-lg p-3">
        <p className="text-foreground-muted text-sm mb-2">
          {label ? format(label, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }) : ''}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground-muted">{entry.name}:</span>
            <span className="font-semibold text-foreground">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-surface-hover rounded-lg animate-pulse" />
        <div className="h-80 bg-surface-hover rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-foreground-muted" />
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TIME_RANGES.map(range => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  timeRange === range.value
                    ? 'bg-primary text-white'
                    : 'bg-surface hover:bg-surface-hover text-foreground-muted'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Type Toggles */}
        <div className="flex flex-wrap gap-2">
          {CHART_TYPES.map(chart => {
            const Icon = chart.icon;
            const isActive = activeCharts.includes(chart.value);
            return (
              <button
                key={chart.value}
                onClick={() => toggleChart(chart.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'text-white'
                    : 'bg-surface border border-border text-foreground-muted hover:bg-surface-hover'
                )}
                style={isActive ? { backgroundColor: chart.color } : {}}
              >
                <Icon className="w-4 h-4" />
                {chart.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      {filteredData.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 text-foreground-subtle" />
          <p className="text-foreground-muted">Sem dados para o periodo selecionado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Power Chart */}
          {activeCharts.includes('power') && (
            <ChartCard title="Potencia (kW)" color="#8b5cf6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatXAxis}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="power"
                    name="Potencia"
                    stroke="#8b5cf6"
                    fill="url(#powerGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* SOC Chart */}
          {activeCharts.includes('soc') && (
            <ChartCard title="Estado de Carga (%)" color="#06b6d4">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="socGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatXAxis}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Min', fill: '#ef4444', fontSize: 10 }} />
                  <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Max', fill: '#22c55e', fontSize: 10 }} />
                  <Area
                    type="monotone"
                    dataKey="soc"
                    name="SOC"
                    stroke="#06b6d4"
                    fill="url(#socGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Voltage Chart */}
          {activeCharts.includes('voltage') && (
            <ChartCard title="Tensao (V)" color="#f59e0b">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatXAxis}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="totalVoltage"
                    name="Tensao Total"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Temperature Chart */}
          {activeCharts.includes('temperature') && (
            <ChartCard title="Temperatura (C)" color="#ef4444">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatXAxis}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <ReferenceLine y={45} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Limite', fill: '#ef4444', fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="temperature.min"
                    name="Minima"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature.average"
                    name="Media"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature.max"
                    name="Maxima"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Current Chart */}
          {activeCharts.includes('current') && (
            <ChartCard title="Corrente (A)" color="#22c55e">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatXAxis}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="current"
                    name="Corrente"
                    stroke="#22c55e"
                    fill="url(#currentGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

// Chart Card Wrapper
function ChartCard({
  title,
  color,
  children
}: {
  title: string;
  color: string;
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-1 h-6 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Cell Voltage Trend Chart
interface CellVoltageTrendProps {
  cellHistory: Array<{
    timestamp: Date;
    cells: Array<{ voltage: number }>;
  }>;
  cellCount: number;
}

export function CellVoltageTrendChart({ cellHistory, cellCount }: CellVoltageTrendProps) {
  const COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  ];

  const formattedData = useMemo(() => {
    return cellHistory.map(entry => {
      const dataPoint: Record<string, unknown> = {
        timestamp: new Date(entry.timestamp).getTime(),
      };
      entry.cells.forEach((cell, idx) => {
        dataPoint[`cell${idx + 1}`] = cell.voltage;
      });
      return dataPoint;
    });
  }, [cellHistory]);

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="font-semibold text-foreground mb-4">Tendencia de Tensao por Celula</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => format(ts, 'HH:mm')}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            domain={['auto', 'auto']}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <Tooltip
            labelFormatter={(ts) => format(Number(ts), 'dd/MM HH:mm:ss')}
            formatter={(value: number) => [`${value.toFixed(3)}V`, '']}
          />
          <Legend />
          {Array.from({ length: cellCount }, (_, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`cell${i + 1}`}
              name={`C${i + 1}`}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Energy Flow Chart
interface EnergyFlowData {
  timestamp: Date;
  charged: number;
  discharged: number;
}

export function EnergyFlowChart({ data }: { data: EnergyFlowData[] }) {
  const formattedData = useMemo(() => {
    return data.map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp).getTime(),
      net: entry.charged - entry.discharged,
    }));
  }, [data]);

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="font-semibold text-foreground mb-4">Fluxo de Energia (kWh)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={formattedData}>
          <defs>
            <linearGradient id="chargedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dischargedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => format(ts, 'dd/MM')}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip
            labelFormatter={(ts) => format(Number(ts), 'dd/MM/yyyy')}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="charged"
            name="Carregado"
            stroke="#22c55e"
            fill="url(#chargedGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="discharged"
            name="Descarregado"
            stroke="#f59e0b"
            fill="url(#dischargedGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
