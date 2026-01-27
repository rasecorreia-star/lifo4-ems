import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  RefreshCw,
  Battery,
  Zap,
  Thermometer,
  Activity,
  ChevronDown,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { cn, formatPercent, formatPower, formatVoltage, formatTemperature } from '@/lib/utils';
import { systemsApi, telemetryApi } from '@/services/api';
import { BessSystem, TelemetryData } from '@/types';

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';
type ChartType = 'soc' | 'power' | 'voltage' | 'temperature' | 'cells';

interface ChartDataPoint {
  timestamp: string;
  time: string;
  soc?: number;
  soh?: number;
  power?: number;
  current?: number;
  voltage?: number;
  tempMin?: number;
  tempMax?: number;
  tempAvg?: number;
  [key: string]: string | number | undefined;
}

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const systemIdParam = searchParams.get('systemId');

  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>(systemIdParam || '');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [activeChart, setActiveChart] = useState<ChartType>('soc');
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSystemDropdown, setShowSystemDropdown] = useState(false);

  // Custom date range
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Fetch systems
  useEffect(() => {
    const fetchSystems = async () => {
      try {
        const res = await systemsApi.getAll();
        setSystems(res.data.data || []);
        if (!selectedSystem && res.data.data?.length) {
          setSelectedSystem(res.data.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch systems:', error);
      }
    };
    fetchSystems();
  }, []);

  // Fetch telemetry history
  const fetchHistory = async () => {
    if (!selectedSystem) return;

    setIsLoading(true);
    try {
      const params = getDateParams();
      const res = await telemetryApi.getHistory(selectedSystem, params);
      setTelemetryHistory(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch telemetry history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHistory, 300000);
    return () => clearInterval(interval);
  }, [selectedSystem, timeRange, customStartDate, customEndDate]);

  // Get date params based on time range
  const getDateParams = () => {
    const now = new Date();
    let startDate: Date;
    let resolution = '1m';

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        resolution = '1m';
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        resolution = '5m';
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        resolution = '15m';
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        resolution = '1h';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        resolution = '6h';
        break;
      case 'custom':
        return {
          startDate: customStartDate,
          endDate: customEndDate,
          resolution: '1h',
        };
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      resolution,
    };
  };

  // Transform data for charts
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return telemetryHistory.map((t) => {
      const date = new Date(t.timestamp);
      const point: ChartDataPoint = {
        timestamp: date.toISOString(),
        time: formatTimeLabel(date, timeRange),
        soc: t.soc,
        soh: t.soh,
        power: t.power,
        current: t.current,
        voltage: t.totalVoltage,
        tempMin: t.temperature?.min,
        tempMax: t.temperature?.max,
        tempAvg: t.temperature?.average,
      };

      // Add cell voltages
      if (t.cells) {
        t.cells.forEach((cell, idx) => {
          point[`cell${idx + 1}`] = cell.voltage;
        });
      }

      return point;
    });
  }, [telemetryHistory, timeRange]);

  // Get cell count
  const cellCount = telemetryHistory[0]?.cells?.length || 16;

  // Selected system info
  const systemInfo = systems.find((s) => s.id === selectedSystem);

  // Time range options
  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '1h', label: '1 hora' },
    { value: '6h', label: '6 horas' },
    { value: '24h', label: '24 horas' },
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: 'custom', label: 'Personalizado' },
  ];

  // Chart tabs
  const chartTabs: { id: ChartType; label: string; icon: React.ElementType }[] = [
    { id: 'soc', label: 'SOC/SOH', icon: Battery },
    { id: 'power', label: 'Potência', icon: Zap },
    { id: 'voltage', label: 'Tensão', icon: Activity },
    { id: 'temperature', label: 'Temperatura', icon: Thermometer },
    { id: 'cells', label: 'Células', icon: TrendingUp },
  ];

  // Update URL when system changes
  const handleSystemChange = (systemId: string) => {
    setSelectedSystem(systemId);
    setSearchParams({ systemId });
    setShowSystemDropdown(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-foreground-muted text-sm">
              Visualize o histórico de dados do seu sistema BESS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* System Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSystemDropdown(!showSystemDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors min-w-[200px]"
            >
              <Battery className="w-4 h-4 text-primary" />
              <span className="flex-1 text-left text-foreground truncate">
                {systemInfo?.name || 'Selecione um sistema'}
              </span>
              <ChevronDown className="w-4 h-4 text-foreground-muted" />
            </button>

            {showSystemDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSystemDropdown(false)}
                />
                <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                  {systems.map((system) => (
                    <button
                      key={system.id}
                      onClick={() => handleSystemChange(system.id)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left hover:bg-surface-hover transition-colors',
                        selectedSystem === system.id && 'bg-primary/10 text-primary'
                      )}
                    >
                      <p className="font-medium text-sm">{system.name}</p>
                      <p className="text-xs text-foreground-muted">{system.model}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Time Range */}
          <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
            {timeRanges.slice(0, 5).map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors',
                  timeRange === range.value
                    ? 'bg-primary text-white'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                )}
              >
                {range.label}
              </button>
            ))}
            <button
              onClick={() => setTimeRange('custom')}
              className={cn(
                'px-3 py-2 transition-colors',
                timeRange === 'custom'
                  ? 'bg-primary text-white'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
              )}
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>

          {/* Export */}
          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      {timeRange === 'custom' && (
        <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground-muted">De:</label>
            <input
              type="datetime-local"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground-muted">Até:</label>
            <input
              type="datetime-local"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}

      {/* Stats Summary */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="SOC Médio"
            value={formatPercent(calculateAverage(chartData, 'soc'), 1)}
            icon={Battery}
            color="primary"
          />
          <StatCard
            title="Potência Máx"
            value={formatPower(Math.max(...chartData.map((d) => Math.abs(d.power || 0))))}
            icon={Zap}
            color="warning"
          />
          <StatCard
            title="Tensão Média"
            value={formatVoltage(calculateAverage(chartData, 'voltage'))}
            icon={Activity}
            color="secondary"
          />
          <StatCard
            title="Temp. Máx"
            value={formatTemperature(Math.max(...chartData.map((d) => d.tempMax || 0)))}
            icon={Thermometer}
            color="danger"
          />
          <StatCard
            title="Pontos de Dados"
            value={chartData.length.toString()}
            icon={TrendingUp}
            color="success"
          />
        </div>
      )}

      {/* Chart Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {chartTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveChart(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeChart === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-foreground-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="bg-surface rounded-xl border border-border p-6">
        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-foreground-muted">
            <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Sem dados disponíveis</p>
            <p className="text-sm">Selecione um sistema e período para visualizar os dados</p>
          </div>
        ) : (
          <>
            {activeChart === 'soc' && <SocChart data={chartData} />}
            {activeChart === 'power' && <PowerChart data={chartData} />}
            {activeChart === 'voltage' && <VoltageChart data={chartData} />}
            {activeChart === 'temperature' && <TemperatureChart data={chartData} />}
            {activeChart === 'cells' && <CellsChart data={chartData} cellCount={cellCount} />}
          </>
        )}
      </div>

      {/* Chart Legend Info */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Informações</h3>
        <div className="text-xs text-foreground-muted space-y-1">
          {activeChart === 'soc' && (
            <>
              <p><strong>SOC (State of Charge):</strong> Percentual de carga atual da bateria</p>
              <p><strong>SOH (State of Health):</strong> Saúde geral da bateria comparada à capacidade original</p>
            </>
          )}
          {activeChart === 'power' && (
            <>
              <p><strong>Potência positiva:</strong> Carga (energia entrando na bateria)</p>
              <p><strong>Potência negativa:</strong> Descarga (energia saindo da bateria)</p>
            </>
          )}
          {activeChart === 'voltage' && (
            <p><strong>Tensão:</strong> Tensão total do pack de baterias e corrente de operação</p>
          )}
          {activeChart === 'temperature' && (
            <p><strong>Temperatura:</strong> Leituras mínima, máxima e média dos sensores de temperatura</p>
          )}
          {activeChart === 'cells' && (
            <p><strong>Células:</strong> Tensão individual de cada célula do pack (ideal: todas próximas)</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper: Format time label
function formatTimeLabel(date: Date, range: TimeRange): string {
  if (range === '1h' || range === '6h') {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '24h') {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return date.toLocaleDateString('pt-BR', { weekday: 'short', hour: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// Helper: Calculate average
function calculateAverage(data: ChartDataPoint[], field: keyof ChartDataPoint): number {
  const values = data.map((d) => d[field]).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    danger: 'text-danger-500 bg-danger-500/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-foreground-muted">{title}</p>
        </div>
      </div>
    </div>
  );
}

// SOC/SOH Chart
function SocChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="socGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="sohGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={20} stroke="hsl(var(--danger-500))" strokeDasharray="5 5" label="Mín" />
        <ReferenceLine y={80} stroke="hsl(var(--success-500))" strokeDasharray="5 5" label="Máx" />
        <Area
          type="monotone"
          dataKey="soc"
          name="SOC (%)"
          stroke="hsl(var(--primary))"
          fill="url(#socGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="soh"
          name="SOH (%)"
          stroke="hsl(var(--secondary))"
          fill="url(#sohGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Power Chart
function PowerChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="powerPositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--success-500))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--success-500))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="powerNegative" x1="0" y1="1" x2="0" y2="0">
            <stop offset="5%" stopColor="hsl(var(--warning-500))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--warning-500))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v}W`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={0} stroke="hsl(var(--foreground-subtle))" />
        <Area
          type="monotone"
          dataKey="power"
          name="Potência (W)"
          stroke="hsl(var(--primary))"
          fill="url(#powerPositive)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Voltage Chart
function VoltageChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          yAxisId="voltage"
          orientation="left"
          stroke="hsl(var(--primary))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v}V`}
        />
        <YAxis
          yAxisId="current"
          orientation="right"
          stroke="hsl(var(--secondary))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v}A`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          yAxisId="voltage"
          type="monotone"
          dataKey="voltage"
          name="Tensão (V)"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="current"
          type="monotone"
          dataKey="current"
          name="Corrente (A)"
          stroke="hsl(var(--secondary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Temperature Chart
function TemperatureChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--warning-500))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--warning-500))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v}°C`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={45} stroke="hsl(var(--danger-500))" strokeDasharray="5 5" label="Limite" />
        <Area
          type="monotone"
          dataKey="tempMax"
          name="Máx (°C)"
          stroke="hsl(var(--danger-500))"
          fill="none"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="tempAvg"
          name="Média (°C)"
          stroke="hsl(var(--warning-500))"
          fill="url(#tempGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="tempMin"
          name="Mín (°C)"
          stroke="hsl(var(--success-500))"
          fill="none"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Cells Chart
function CellsChart({ data, cellCount }: { data: ChartDataPoint[]; cellCount: number }) {
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--success-500))',
    'hsl(var(--warning-500))',
    'hsl(210, 90%, 60%)',
    'hsl(280, 70%, 60%)',
    'hsl(330, 70%, 60%)',
    'hsl(30, 80%, 55%)',
    'hsl(180, 60%, 50%)',
    'hsl(240, 60%, 60%)',
    'hsl(60, 70%, 50%)',
    'hsl(120, 50%, 50%)',
    'hsl(0, 60%, 55%)',
    'hsl(200, 70%, 55%)',
    'hsl(300, 50%, 55%)',
    'hsl(150, 60%, 45%)',
  ];

  return (
    <ResponsiveContainer width="100%" height={500}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          domain={['auto', 'auto']}
          stroke="hsl(var(--foreground-muted))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v.toFixed(2)}V`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        <ReferenceLine y={3.65} stroke="hsl(var(--danger-500))" strokeDasharray="3 3" />
        <ReferenceLine y={2.5} stroke="hsl(var(--danger-500))" strokeDasharray="3 3" />
        {Array.from({ length: cellCount }).map((_, idx) => (
          <Line
            key={idx}
            type="monotone"
            dataKey={`cell${idx + 1}`}
            name={`Célula ${idx + 1}`}
            stroke={colors[idx % colors.length]}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  return (
    <div className="bg-surface border border-border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground-muted">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
