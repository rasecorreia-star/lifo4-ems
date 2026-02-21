import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Battery,
  Gauge,
  TrendingUp,
  TrendingDown,
  Settings,
  RefreshCw,
  AlertTriangle,
  Activity,
  Power,
  BarChart3,
  Layers,
  Clock,
  Target,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Sun,
  Moon,
  Thermometer,
  DollarSign,
  Calendar,
  FileText,
} from 'lucide-react';
import { cn, formatPower, formatCurrency, formatNumber } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface LoadGroup {
  id: string;
  name: string;
  maxPowerKw: number;
  currentPowerKw: number;
  chargersCount: number;
  activeChargers: number;
  priority: 'high' | 'medium' | 'low';
  mode: 'fifo' | 'soc' | 'equal' | 'custom';
  status: 'active' | 'limited' | 'curtailed';
}

interface PowerSchedule {
  id: string;
  name: string;
  maxPowerKw: number;
  startTime: string;
  endTime: string;
  days: string[];
  isActive: boolean;
  reason: string;
}

interface BESSIntegration {
  id: string;
  name: string;
  capacityKwh: number;
  currentSocPercent: number;
  powerKw: number;
  status: 'charging' | 'discharging' | 'standby' | 'offline';
  mode: 'peak_shaving' | 'arbitrage' | 'backup' | 'manual';
  lastUpdate: string;
}

interface GridSignal {
  timestamp: string;
  price: number;
  demand: number;
  renewable: number;
  co2Intensity: number;
}

// ============================================
// MOCK DATA
// ============================================

const mockLoadGroups: LoadGroup[] = [
  { id: '1', name: 'São Paulo - DC Fast', maxPowerKw: 500, currentPowerKw: 385, chargersCount: 8, activeChargers: 5, priority: 'high', mode: 'soc', status: 'active' },
  { id: '2', name: 'São Paulo - AC', maxPowerKw: 200, currentPowerKw: 132, chargersCount: 15, activeChargers: 6, priority: 'medium', mode: 'equal', status: 'active' },
  { id: '3', name: 'Rio de Janeiro - All', maxPowerKw: 400, currentPowerKw: 400, chargersCount: 10, activeChargers: 8, priority: 'high', mode: 'fifo', status: 'limited' },
  { id: '4', name: 'Curitiba - Hub', maxPowerKw: 300, currentPowerKw: 75, chargersCount: 6, activeChargers: 2, priority: 'low', mode: 'equal', status: 'active' },
  { id: '5', name: 'Miami - Superchargers', maxPowerKw: 1000, currentPowerKw: 680, chargersCount: 12, activeChargers: 8, priority: 'high', mode: 'soc', status: 'active' },
];

const mockSchedules: PowerSchedule[] = [
  { id: '1', name: 'Horário de Pico', maxPowerKw: 600, startTime: '18:00', endTime: '21:00', days: ['seg', 'ter', 'qua', 'qui', 'sex'], isActive: true, reason: 'Redução de demanda contratada' },
  { id: '2', name: 'Período Noturno', maxPowerKw: 1200, startTime: '22:00', endTime: '06:00', days: ['todos'], isActive: true, reason: 'Tarifa reduzida / BESS carregando' },
  { id: '3', name: 'Fim de Semana', maxPowerKw: 800, startTime: '00:00', endTime: '23:59', days: ['sab', 'dom'], isActive: true, reason: 'Demanda comercial reduzida' },
];

const mockBESS: BESSIntegration[] = [
  { id: '1', name: 'BESS São Paulo Principal', capacityKwh: 2000, currentSocPercent: 72, powerKw: -150, status: 'charging', mode: 'arbitrage', lastUpdate: new Date(Date.now() - 30000).toISOString() },
  { id: '2', name: 'BESS Rio Backup', capacityKwh: 500, currentSocPercent: 95, powerKw: 0, status: 'standby', mode: 'backup', lastUpdate: new Date(Date.now() - 60000).toISOString() },
  { id: '3', name: 'BESS Miami Hub', capacityKwh: 3000, currentSocPercent: 45, powerKw: 250, status: 'discharging', mode: 'peak_shaving', lastUpdate: new Date(Date.now() - 15000).toISOString() },
];

const powerHistory = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const isPeak = hour >= 18 && hour <= 21;
  const isNight = hour >= 22 || hour <= 6;
  const basePower = isPeak ? 600 : isNight ? 200 : 450;

  return {
    time: `${hour.toString().padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
    power: basePower + Math.floor(Math.random() * 150) - 75,
    limit: isPeak ? 600 : isNight ? 1200 : 900,
    grid: basePower * 0.7 + Math.floor(Math.random() * 100),
    bess: isPeak ? 100 + Math.floor(Math.random() * 50) : isNight ? -50 - Math.floor(Math.random() * 30) : 0,
  };
});

const gridSignals: GridSignal[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: `${i.toString().padStart(2, '0')}:00`,
  price: i >= 18 && i <= 21 ? 0.85 + Math.random() * 0.3 : i >= 22 || i <= 6 ? 0.35 + Math.random() * 0.1 : 0.55 + Math.random() * 0.2,
  demand: i >= 18 && i <= 21 ? 85 + Math.random() * 15 : i >= 22 || i <= 6 ? 30 + Math.random() * 15 : 55 + Math.random() * 20,
  renewable: i >= 10 && i <= 16 ? 60 + Math.random() * 25 : i >= 22 || i <= 6 ? 15 + Math.random() * 10 : 30 + Math.random() * 15,
  co2Intensity: i >= 18 && i <= 21 ? 450 + Math.random() * 100 : i >= 10 && i <= 16 ? 180 + Math.random() * 50 : 300 + Math.random() * 80,
}));

// ============================================
// MAIN COMPONENT
// ============================================

export default function CPMSEnergyManagement() {
  const [loadGroups] = useState<LoadGroup[]>(mockLoadGroups);
  const [schedules] = useState<PowerSchedule[]>(mockSchedules);
  const [bessUnits] = useState<BESSIntegration[]>(mockBESS);
  const [activeTab, setActiveTab] = useState<'dlm' | 'schedules' | 'bess' | 'grid'>('dlm');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dlmMode, setDlmMode] = useState<'auto' | 'manual'>('auto');

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalMaxPower = loadGroups.reduce((sum, g) => sum + g.maxPowerKw, 0);
    const totalCurrentPower = loadGroups.reduce((sum, g) => sum + g.currentPowerKw, 0);
    const totalChargers = loadGroups.reduce((sum, g) => sum + g.chargersCount, 0);
    const activeChargers = loadGroups.reduce((sum, g) => sum + g.activeChargers, 0);
    const limitedGroups = loadGroups.filter(g => g.status === 'limited' || g.status === 'curtailed').length;
    const totalBESSCapacity = bessUnits.reduce((sum, b) => sum + b.capacityKwh, 0);
    const totalBESSEnergy = bessUnits.reduce((sum, b) => sum + (b.capacityKwh * b.currentSocPercent / 100), 0);
    const bessDischarging = bessUnits.filter(b => b.status === 'discharging').reduce((sum, b) => sum + b.powerKw, 0);

    return {
      totalMaxPower,
      totalCurrentPower,
      powerUtilization: (totalCurrentPower / totalMaxPower) * 100,
      totalChargers,
      activeChargers,
      limitedGroups,
      totalBESSCapacity,
      totalBESSEnergy,
      bessDischarging,
      currentGridPrice: 0.72, // R$/kWh
      peakReduction: 125, // kW saved through DLM
    };
  }, [loadGroups, bessUnits]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestão Energética</h1>
              <p className="text-foreground-muted text-sm">
                Dynamic Load Management, Power Sharing & BESS Integration
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* DLM Mode Toggle */}
          <div className="flex bg-surface border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setDlmMode('auto')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
                dlmMode === 'auto' ? 'bg-primary text-white' : 'hover:bg-surface-hover'
              )}
            >
              <Play className="w-4 h-4" />
              Auto
            </button>
            <button
              onClick={() => setDlmMode('manual')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
                dlmMode === 'manual' ? 'bg-warning-500 text-white' : 'hover:bg-surface-hover'
              )}
            >
              <Sliders className="w-4 h-4" />
              Manual
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
          </button>

          <button className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KPICard
          title="Potência Atual"
          value={`${(kpis.totalCurrentPower / 1000).toFixed(1)} MW`}
          subtitle={`de ${(kpis.totalMaxPower / 1000).toFixed(1)} MW`}
          icon={Gauge}
          color="warning"
          progress={kpis.powerUtilization}
        />
        <KPICard
          title="Carregadores Ativos"
          value={`${kpis.activeChargers}/${kpis.totalChargers}`}
          subtitle={`${((kpis.activeChargers / kpis.totalChargers) * 100).toFixed(0)}% utilização`}
          icon={Power}
          color="primary"
        />
        <KPICard
          title="Grupos Limitados"
          value={kpis.limitedGroups.toString()}
          subtitle={kpis.limitedGroups > 0 ? 'DLM ativo' : 'Sem restrições'}
          icon={Layers}
          color={kpis.limitedGroups > 0 ? 'warning' : 'success'}
        />
        <KPICard
          title="BESS Disponível"
          value={`${(kpis.totalBESSEnergy / 1000).toFixed(1)} MWh`}
          subtitle={`${(kpis.bessDischarging / 1000).toFixed(1)} MW descarga`}
          icon={Battery}
          color="blue"
        />
        <KPICard
          title="Preço Grid"
          value={`R$ ${kpis.currentGridPrice.toFixed(2)}/kWh`}
          subtitle="Tarifa atual"
          icon={DollarSign}
          color="emerald"
        />
        <KPICard
          title="Economia DLM"
          value={`${kpis.peakReduction} kW`}
          subtitle="Redução de pico"
          icon={TrendingDown}
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-8">
          {[
            { id: 'dlm', label: 'Load Management', icon: Layers },
            { id: 'schedules', label: 'Agendamentos', icon: Calendar },
            { id: 'bess', label: 'BESS Integration', icon: Battery },
            { id: 'grid', label: 'Grid Signals', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dlm' && (
        <div className="space-y-6">
          {/* Power Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Potência vs Limite (Últimas 24h)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={powerHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <defs>
                  <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="power"
                  name="Potência Total (kW)"
                  stroke="#f59e0b"
                  fill="url(#powerGradient)"
                  strokeWidth={2}
                />
                <Line
                  type="stepAfter"
                  dataKey="limit"
                  name="Limite DLM (kW)"
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
                <Bar dataKey="bess" name="BESS (kW)" fill="#3b82f6" opacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Load Groups */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Grupos de Carga (Load Groups)
              </h3>
              <button className="text-primary text-sm hover:underline">
                Adicionar Grupo
              </button>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {loadGroups.map((group) => (
                <LoadGroupCard key={group.id} group={group} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Agendamentos de Potência
            </h3>
            <button className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Novo Agendamento
            </button>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {schedules.map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </div>

          {/* Weekly Schedule Visualization */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h4 className="font-medium text-foreground mb-4">Visualização Semanal</h4>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header */}
                <div className="grid grid-cols-8 gap-1 mb-2">
                  <div className="text-xs font-medium text-foreground-muted">Hora</div>
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                    <div key={day} className="text-xs font-medium text-center text-foreground-muted">{day}</div>
                  ))}
                </div>
                {/* Hours */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="grid grid-cols-8 gap-1 mb-1">
                    <div className="text-xs text-foreground-muted">{hour.toString().padStart(2, '0')}:00</div>
                    {Array.from({ length: 7 }, (_, day) => {
                      const isPeak = hour >= 18 && hour <= 21 && day < 5;
                      const isNight = hour >= 22 || hour <= 6;
                      const isWeekend = day >= 5;

                      return (
                        <div
                          key={day}
                          className={cn(
                            'h-4 rounded text-center text-2xs flex items-center justify-center',
                            isPeak && 'bg-danger-500/30 text-danger-500',
                            !isPeak && isNight && 'bg-success-500/30 text-success-500',
                            !isPeak && !isNight && isWeekend && 'bg-blue-500/30 text-blue-500',
                            !isPeak && !isNight && !isWeekend && 'bg-surface-active'
                          )}
                        >
                          {isPeak && '600'}
                          {!isPeak && isNight && '1.2k'}
                          {!isPeak && !isNight && isWeekend && '800'}
                          {!isPeak && !isNight && !isWeekend && '900'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-danger-500/30" />
                <span className="text-foreground-muted">Horário Pico (600 kW)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-success-500/30" />
                <span className="text-foreground-muted">Noturno (1.2 MW)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/30" />
                <span className="text-foreground-muted">Fim de Semana (800 kW)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-surface-active" />
                <span className="text-foreground-muted">Normal (900 kW)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bess' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bessUnits.map((bess) => (
              <BESSCard key={bess.id} bess={bess} />
            ))}
          </div>

          {/* BESS Power Flow */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Fluxo de Potência BESS (Últimas 24h)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={powerHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <ReferenceLine y={0} stroke="var(--color-border)" />
                <defs>
                  <linearGradient id="bessPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="bessNegative" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="bess"
                  name="BESS (kW)"
                  stroke="#3b82f6"
                  fill="url(#bessPositive)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-foreground-muted text-center mt-2">
              Valores positivos = descarga (fornecendo energia) | Valores negativos = carga (armazenando energia)
            </p>
          </div>
        </div>
      )}

      {activeTab === 'grid' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Price Signal */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Preço da Energia (R$/kWh)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={gridSignals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Preço']}
                  />
                  <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} />
                  <ReferenceLine y={0.55} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Média', fill: '#f59e0b', fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Renewable Mix */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-500" />
                Mix Renovável (%)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={gridSignals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)}%`, 'Renovável']}
                  />
                  <defs>
                    <linearGradient id="renewableGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="renewable" stroke="#eab308" fill="url(#renewableGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* CO2 Intensity */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-red-500" />
                Intensidade CO2 (gCO2/kWh)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={gridSignals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)} gCO2/kWh`, 'Emissões']}
                  />
                  <defs>
                    <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="co2Intensity" stroke="#ef4444" fill="url(#co2Gradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Grid Demand */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Demanda da Rede (%)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={gridSignals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)}%`, 'Demanda']}
                  />
                  <defs>
                    <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="demand" stroke="#3b82f6" fill="url(#demandGradient)" strokeWidth={2} />
                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Crítico', fill: '#ef4444', fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Recomendações de Otimização
            </h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <RecommendationCard
                title="Carregar BESS"
                description="Preço baixo e alta geração renovável"
                timeWindow="22:00 - 06:00"
                savings="+R$ 450/dia"
                priority="high"
              />
              <RecommendationCard
                title="Peak Shaving"
                description="Utilizar BESS durante pico de preço"
                timeWindow="18:00 - 21:00"
                savings="+R$ 280/dia"
                priority="high"
              />
              <RecommendationCard
                title="Reduzir DLM"
                description="Demanda da rede está baixa"
                timeWindow="Agora"
                savings="Aumentar limite em 100kW"
                priority="medium"
              />
              <RecommendationCard
                title="Manutenção BESS"
                description="BESS Rio com SOC alto prolongado"
                timeWindow="Próximas 24h"
                savings="Evitar degradação"
                priority="low"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'warning' | 'primary' | 'success' | 'blue' | 'emerald' | 'purple';
  progress?: number;
}

function KPICard({ title, value, subtitle, icon: Icon, color, progress }: KPICardProps) {
  const colorClasses = {
    warning: 'text-warning-500 bg-warning-500/10',
    primary: 'text-primary bg-primary/10',
    success: 'text-success-500 bg-success-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted">{title}</p>
      <p className="text-xs text-foreground-subtle mt-0.5">{subtitle}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-surface-active rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              progress > 90 ? 'bg-danger-500' : progress > 70 ? 'bg-warning-500' : 'bg-success-500'
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function LoadGroupCard({ group }: { group: LoadGroup }) {
  const utilizationPercent = (group.currentPowerKw / group.maxPowerKw) * 100;

  const modeLabels = {
    fifo: 'FIFO',
    soc: 'Por SOC',
    equal: 'Igual',
    custom: 'Custom',
  };

  const priorityColors = {
    high: 'bg-danger-500/20 text-danger-500',
    medium: 'bg-warning-500/20 text-warning-500',
    low: 'bg-blue-500/20 text-blue-500',
  };

  const statusColors = {
    active: 'bg-success-500/20 text-success-500',
    limited: 'bg-warning-500/20 text-warning-500',
    curtailed: 'bg-danger-500/20 text-danger-500',
  };

  return (
    <div className={cn(
      'bg-surface rounded-xl border p-4',
      group.status === 'limited' && 'border-warning-500/50',
      group.status === 'curtailed' && 'border-danger-500/50',
      group.status === 'active' && 'border-border'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{group.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', priorityColors[group.priority])}>
              {group.priority === 'high' ? 'Alta' : group.priority === 'medium' ? 'Média' : 'Baixa'}
            </span>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[group.status])}>
              {group.status === 'active' ? 'Ativo' : group.status === 'limited' ? 'Limitado' : 'Cortado'}
            </span>
          </div>
        </div>
        <button className="p-1.5 hover:bg-surface-hover rounded">
          <Settings className="w-4 h-4 text-foreground-muted" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Power Usage */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-foreground-muted">Potência</span>
            <span className="font-medium">
              {group.currentPowerKw} / {group.maxPowerKw} kW
            </span>
          </div>
          <div className="h-2 bg-surface-active rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                utilizationPercent > 95 ? 'bg-danger-500' :
                utilizationPercent > 80 ? 'bg-warning-500' : 'bg-primary'
              )}
              style={{ width: `${utilizationPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-hover rounded-lg p-2 text-center">
            <p className="text-sm font-semibold text-foreground">{group.activeChargers}/{group.chargersCount}</p>
            <p className="text-xs text-foreground-muted">Ativos</p>
          </div>
          <div className="bg-surface-hover rounded-lg p-2 text-center">
            <p className="text-sm font-semibold text-foreground">{modeLabels[group.mode]}</p>
            <p className="text-xs text-foreground-muted">Modo</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
        <button className="text-xs text-primary hover:underline">Ver carregadores</button>
        <button className="text-xs text-foreground-muted hover:text-foreground">Ajustar limite</button>
      </div>
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: PowerSchedule }) {
  return (
    <div className={cn(
      'bg-surface rounded-xl border p-4',
      schedule.isActive ? 'border-border' : 'border-border opacity-60'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{schedule.name}</h3>
          <p className="text-sm text-foreground-muted mt-1">{schedule.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          {schedule.isActive ? (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success-500/20 text-success-500">
              Ativo
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-surface-active text-foreground-muted">
              Inativo
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-surface-hover rounded-lg p-2">
          <div className="flex items-center gap-2 text-xs text-foreground-muted mb-1">
            <Clock className="w-3 h-3" />
            Horário
          </div>
          <p className="font-semibold text-foreground">{schedule.startTime} - {schedule.endTime}</p>
        </div>
        <div className="bg-surface-hover rounded-lg p-2">
          <div className="flex items-center gap-2 text-xs text-foreground-muted mb-1">
            <Gauge className="w-3 h-3" />
            Limite
          </div>
          <p className="font-semibold text-foreground">{schedule.maxPowerKw} kW</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {schedule.days.map((day) => (
          <span key={day} className="text-xs bg-surface-active px-2 py-0.5 rounded text-foreground-muted">
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

function BESSCard({ bess }: { bess: BESSIntegration }) {
  const modeLabels = {
    peak_shaving: 'Peak Shaving',
    arbitrage: 'Arbitragem',
    backup: 'Backup',
    manual: 'Manual',
  };

  const statusColors = {
    charging: 'bg-blue-500/20 text-blue-500',
    discharging: 'bg-warning-500/20 text-warning-500',
    standby: 'bg-success-500/20 text-success-500',
    offline: 'bg-gray-500/20 text-gray-400',
  };

  const statusLabels = {
    charging: 'Carregando',
    discharging: 'Descarregando',
    standby: 'Standby',
    offline: 'Offline',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            bess.status === 'charging' && 'bg-blue-500/10',
            bess.status === 'discharging' && 'bg-warning-500/10',
            bess.status === 'standby' && 'bg-success-500/10',
            bess.status === 'offline' && 'bg-surface-active'
          )}>
            <Battery className={cn(
              'w-5 h-5',
              bess.status === 'charging' && 'text-blue-500',
              bess.status === 'discharging' && 'text-warning-500',
              bess.status === 'standby' && 'text-success-500',
              bess.status === 'offline' && 'text-foreground-muted'
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{bess.name}</h3>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[bess.status])}>
              {statusLabels[bess.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* SOC Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-foreground-muted">SOC</span>
            <span className="font-medium">{bess.currentSocPercent}%</span>
          </div>
          <div className="h-3 bg-surface-active rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                bess.currentSocPercent > 80 ? 'bg-success-500' :
                bess.currentSocPercent > 30 ? 'bg-warning-500' : 'bg-danger-500'
              )}
              style={{ width: `${bess.currentSocPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-hover rounded-lg p-2 text-center">
            <p className="text-sm font-semibold text-foreground">{(bess.capacityKwh / 1000).toFixed(1)}</p>
            <p className="text-2xs text-foreground-muted">MWh Cap.</p>
          </div>
          <div className="bg-surface-hover rounded-lg p-2 text-center">
            <p className={cn(
              'text-sm font-semibold',
              bess.powerKw > 0 ? 'text-warning-500' : bess.powerKw < 0 ? 'text-blue-500' : 'text-foreground'
            )}>
              {bess.powerKw > 0 ? '+' : ''}{bess.powerKw}
            </p>
            <p className="text-2xs text-foreground-muted">kW</p>
          </div>
          <div className="bg-surface-hover rounded-lg p-2 text-center">
            <p className="text-sm font-semibold text-foreground">{modeLabels[bess.mode]}</p>
            <p className="text-2xs text-foreground-muted">Modo</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
        <p className="text-xs text-foreground-muted">
          Atualizado: {new Date(bess.lastUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <Link to={`/digital-twin/${bess.id}`} className="text-xs text-primary hover:underline">
          Ver detalhes
        </Link>
      </div>
    </div>
  );
}

function RecommendationCard({ title, description, timeWindow, savings, priority }: {
  title: string;
  description: string;
  timeWindow: string;
  savings: string;
  priority: 'high' | 'medium' | 'low';
}) {
  const priorityColors = {
    high: 'border-l-success-500',
    medium: 'border-l-warning-500',
    low: 'border-l-blue-500',
  };

  return (
    <div className={cn('bg-surface-hover rounded-lg p-4 border-l-4', priorityColors[priority])}>
      <h4 className="font-medium text-foreground mb-1">{title}</h4>
      <p className="text-xs text-foreground-muted mb-2">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs bg-surface-active px-2 py-0.5 rounded text-foreground-muted">{timeWindow}</span>
        <span className="text-xs font-medium text-success-500">{savings}</span>
      </div>
    </div>
  );
}
