import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useGridServices } from '@/hooks/useGridServices';
import {
  Radio,
  Clock,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Calendar,
  TrendingUp,
  TrendingDown,
  Bell,
  Settings,
  BarChart3,
  Target,
  Power,
  Activity,
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
} from 'recharts';
import { cn } from '@/lib/utils';

interface DREvent {
  id: string;
  type: 'scheduled' | 'emergency' | 'economic';
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  startTime: string;
  endTime: string;
  targetReduction: number;
  actualReduction?: number;
  incentive: number;
  source: string;
}

interface PerformanceData {
  month: string;
  eventsParticipated: number;
  totalReduction: number;
  earnings: number;
  compliance: number;
}

interface LoadData {
  time: string;
  baseline: number;
  actual: number;
  target: number;
  drActive: boolean;
}

// Fixed mock data
const loadProfileData: LoadData[] = [
  { time: '00:00', baseline: 85, actual: 83, target: 85, drActive: false },
  { time: '01:00', baseline: 78, actual: 76, target: 78, drActive: false },
  { time: '02:00', baseline: 72, actual: 70, target: 72, drActive: false },
  { time: '03:00', baseline: 68, actual: 66, target: 68, drActive: false },
  { time: '04:00', baseline: 65, actual: 63, target: 65, drActive: false },
  { time: '05:00', baseline: 68, actual: 67, target: 68, drActive: false },
  { time: '06:00', baseline: 75, actual: 74, target: 75, drActive: false },
  { time: '07:00', baseline: 85, actual: 84, target: 85, drActive: false },
  { time: '08:00', baseline: 95, actual: 94, target: 95, drActive: false },
  { time: '09:00', baseline: 105, actual: 103, target: 105, drActive: false },
  { time: '10:00', baseline: 110, actual: 109, target: 110, drActive: false },
  { time: '11:00', baseline: 115, actual: 114, target: 115, drActive: false },
  { time: '12:00', baseline: 120, actual: 119, target: 120, drActive: false },
  { time: '13:00', baseline: 118, actual: 117, target: 118, drActive: false },
  { time: '14:00', baseline: 115, actual: 114, target: 115, drActive: false },
  { time: '15:00', baseline: 112, actual: 111, target: 112, drActive: false },
  { time: '16:00', baseline: 110, actual: 109, target: 110, drActive: false },
  { time: '17:00', baseline: 125, actual: 87, target: 88, drActive: true },
  { time: '18:00', baseline: 128, actual: 88, target: 90, drActive: true },
  { time: '19:00', baseline: 130, actual: 91, target: 91, drActive: true },
  { time: '20:00', baseline: 128, actual: 89, target: 90, drActive: true },
  { time: '21:00', baseline: 115, actual: 113, target: 115, drActive: false },
  { time: '22:00', baseline: 105, actual: 103, target: 105, drActive: false },
  { time: '23:00', baseline: 92, actual: 90, target: 92, drActive: false },
];

const performanceHistoryData: PerformanceData[] = [
  { month: 'Jul', eventsParticipated: 10, totalReduction: 185, earnings: 2650, compliance: 94 },
  { month: 'Ago', eventsParticipated: 9, totalReduction: 172, earnings: 2450, compliance: 92 },
  { month: 'Set', eventsParticipated: 11, totalReduction: 198, earnings: 2850, compliance: 96 },
  { month: 'Out', eventsParticipated: 8, totalReduction: 158, earnings: 2280, compliance: 88 },
  { month: 'Nov', eventsParticipated: 12, totalReduction: 215, earnings: 3100, compliance: 98 },
  { month: 'Dez', eventsParticipated: 10, totalReduction: 180, earnings: 2650, compliance: 93 },
  { month: 'Jan', eventsParticipated: 11, totalReduction: 195, earnings: 2900, compliance: 95 },
];

const drEvents: DREvent[] = [
  {
    id: 'DR-001',
    type: 'scheduled',
    status: 'active',
    startTime: '17:00',
    endTime: '20:00',
    targetReduction: 50,
    actualReduction: 48,
    incentive: 150,
    source: 'CCEE',
  },
  {
    id: 'DR-002',
    type: 'economic',
    status: 'upcoming',
    startTime: 'Amanha 18:00',
    endTime: 'Amanha 21:00',
    targetReduction: 40,
    incentive: 120,
    source: 'Enel',
  },
  {
    id: 'DR-003',
    type: 'emergency',
    status: 'completed',
    startTime: 'Ontem 19:00',
    endTime: 'Ontem 21:00',
    targetReduction: 60,
    actualReduction: 58,
    incentive: 250,
    source: 'ONS',
  },
  {
    id: 'DR-004',
    type: 'scheduled',
    status: 'completed',
    startTime: '22/01 17:30',
    endTime: '22/01 20:30',
    targetReduction: 45,
    actualReduction: 47,
    incentive: 135,
    source: 'CCEE',
  },
];

export default function DemandResponse() {
  const { systemId } = useParams<{ systemId: string }>();
  const currentSystemId = systemId || 'sys-demo-001';

  const { data: gridData, isLoading, isError } = useGridServices(currentSystemId);

  const [autoResponse, setAutoResponse] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'events' | 'performance' | 'settings'>('events');

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">Carregando dados de resposta à demanda...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger-500">Erro ao carregar dados de resposta à demanda</div>
      </div>
    );
  }

  const loadProfile = useMemo(() => loadProfileData, []);
  const performanceHistory = useMemo(() => performanceHistoryData, []);

  // Calculate stats
  const stats = useMemo(() => {
    const completedEvents = drEvents.filter(e => e.status === 'completed');
    const totalEarnings = completedEvents.reduce((sum, e) => sum + e.incentive, 0);
    const avgCompliance = completedEvents.length > 0
      ? completedEvents.reduce((sum, e) => sum + ((e.actualReduction || 0) / e.targetReduction) * 100, 0) / completedEvents.length
      : 0;
    const totalReduction = completedEvents.reduce((sum, e) => sum + (e.actualReduction || 0), 0);

    return {
      activeEvents: drEvents.filter(e => e.status === 'active').length,
      upcomingEvents: drEvents.filter(e => e.status === 'upcoming').length,
      completedEvents: completedEvents.length,
      totalEarnings,
      avgCompliance: Math.round(avgCompliance),
      totalReduction,
      monthlyEarnings: performanceHistory.reduce((sum, p) => sum + p.earnings, 0),
    };
  }, [performanceHistory]);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'emergency':
        return 'bg-danger-500/20 text-danger-500';
      case 'economic':
        return 'bg-success-500/20 text-success-500';
      case 'scheduled':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-foreground-muted/20 text-foreground-muted';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-500 text-white';
      case 'upcoming':
        return 'bg-warning-500/20 text-warning-500';
      case 'completed':
        return 'bg-foreground-muted/20 text-foreground-muted';
      case 'cancelled':
        return 'bg-danger-500/20 text-danger-500';
      default:
        return 'bg-surface-hover text-foreground-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resposta a Demanda</h1>
          <p className="text-foreground-muted mt-1">
            Programas de reducao de carga e incentivos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg">
            <Radio className={cn('w-4 h-4', autoResponse ? 'text-success-500' : 'text-foreground-muted')} />
            <span className="text-sm text-foreground">Auto-resposta</span>
            <button
              onClick={() => setAutoResponse(!autoResponse)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                autoResponse ? 'bg-success-500' : 'bg-foreground-muted/30'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                  autoResponse ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Active Event Alert */}
      {stats.activeEvents > 0 && (
        <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success-500/20 flex items-center justify-center animate-pulse">
              <Zap className="w-6 h-6 text-success-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Evento DR Ativo</h3>
                <span className="px-2 py-0.5 bg-success-500 text-white text-xs font-medium rounded-full">
                  AO VIVO
                </span>
              </div>
              <p className="text-sm text-foreground-muted mt-1">
                Reducao de carga em andamento: 17:00 - 20:00 | Meta: 50 kW | Atual: 48 kW
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-success-500">R$ 150</p>
              <p className="text-xs text-foreground-muted">Incentivo estimado</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Eventos Ativos</span>
            <Activity className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.activeEvents}</div>
          <div className="text-xs text-foreground-muted mt-1">
            {stats.upcomingEvents} programados
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Compliance Medio</span>
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.avgCompliance}%</div>
          <div className="flex items-center gap-1 text-xs text-success-500 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>Acima da meta</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Reducao Total</span>
            <TrendingDown className="w-5 h-5 text-warning-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalReduction} kWh</div>
          <div className="text-xs text-foreground-muted mt-1">
            Este mes
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Ganhos Totais</span>
            <DollarSign className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-success-500">
            R$ {stats.monthlyEarnings.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            Ultimos 6 meses
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {(['events', 'performance', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              selectedTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            {tab === 'events' ? 'Eventos' : tab === 'performance' ? 'Desempenho' : 'Configuracoes'}
          </button>
        ))}
      </div>

      {selectedTab === 'events' && (
        <>
          {/* Load Profile Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Perfil de Carga - Hoje</h2>
                <p className="text-sm text-foreground-muted">Baseline vs Atual durante evento DR</p>
              </div>
              <Clock className="w-5 h-5 text-foreground-muted" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loadProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kW" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <ReferenceLine x="17:00" stroke="#22c55e" strokeDasharray="3 3" label="Inicio DR" />
                  <ReferenceLine x="20:00" stroke="#ef4444" strokeDasharray="3 3" label="Fim DR" />
                  <Area
                    type="monotone"
                    dataKey="baseline"
                    name="Baseline"
                    fill="#6b7280"
                    fillOpacity={0.2}
                    stroke="#6b7280"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Meta"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Consumo Real"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Events List */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Eventos de Demanda</h2>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                <Bell className="w-4 h-4" />
                Configurar Alertas
              </button>
            </div>
            <div className="space-y-4">
              {drEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-colors',
                    event.status === 'active'
                      ? 'bg-success-500/5 border-success-500/30'
                      : 'bg-surface-hover border-transparent'
                  )}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    event.type === 'emergency' && 'bg-danger-500/20',
                    event.type === 'economic' && 'bg-success-500/20',
                    event.type === 'scheduled' && 'bg-primary/20'
                  )}>
                    {event.type === 'emergency' && <AlertTriangle className="w-6 h-6 text-danger-500" />}
                    {event.type === 'economic' && <DollarSign className="w-6 h-6 text-success-500" />}
                    {event.type === 'scheduled' && <Calendar className="w-6 h-6 text-primary" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{event.id}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getEventTypeColor(event.type))}>
                        {event.type === 'emergency' ? 'Emergencia' : event.type === 'economic' ? 'Economico' : 'Programado'}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(event.status))}>
                        {event.status === 'active' ? 'Ativo' : event.status === 'upcoming' ? 'Programado' : event.status === 'completed' ? 'Concluido' : 'Cancelado'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-muted mt-1">
                      {event.startTime} - {event.endTime} | Fonte: {event.source}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-foreground-muted">Meta</p>
                    <p className="font-semibold text-foreground">{event.targetReduction} kW</p>
                  </div>

                  {event.actualReduction !== undefined && (
                    <div className="text-center">
                      <p className="text-sm text-foreground-muted">Real</p>
                      <p className={cn(
                        'font-semibold',
                        event.actualReduction >= event.targetReduction ? 'text-success-500' : 'text-warning-500'
                      )}>
                        {event.actualReduction} kW
                      </p>
                    </div>
                  )}

                  <div className="text-right">
                    <p className="text-sm text-foreground-muted">Incentivo</p>
                    <p className="font-semibold text-success-500">R$ {event.incentive}</p>
                  </div>

                  {event.status === 'active' && (
                    <button className="p-2 bg-danger-500/20 text-danger-500 rounded-lg hover:bg-danger-500/30 transition-colors">
                      <Pause className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedTab === 'performance' && (
        <>
          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Participacao em Eventos</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                    <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="eventsParticipated" name="Eventos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Ganhos Mensais</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                    <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" R$" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="earnings"
                      name="Ganhos"
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

          {/* Compliance Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Taxa de Compliance</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis domain={[70, 100]} stroke="var(--foreground-muted)" fontSize={12} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="3 3" label="Meta (85%)" />
                  <Line
                    type="monotone"
                    dataKey="compliance"
                    name="Compliance"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {selectedTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Auto Response Settings */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Configuracoes de Auto-Resposta</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Eventos Programados</p>
                  <p className="text-sm text-foreground-muted">Participar automaticamente</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Eventos Economicos</p>
                  <p className="text-sm text-foreground-muted">Participar se incentivo &gt; R$ 100</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-hover rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Eventos de Emergencia</p>
                  <p className="text-sm text-foreground-muted">Sempre participar</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-border" />
              </div>

              <div className="p-4 bg-surface-hover rounded-lg">
                <p className="font-medium text-foreground mb-2">Reducao Maxima</p>
                <p className="text-sm text-foreground-muted mb-3">Limite de carga que pode ser reduzida</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="20"
                    max="80"
                    defaultValue="50"
                    className="flex-1"
                  />
                  <span className="w-16 text-center font-medium text-foreground">50%</span>
                </div>
              </div>

              <div className="p-4 bg-surface-hover rounded-lg">
                <p className="font-medium text-foreground mb-2">SOC Minimo</p>
                <p className="text-sm text-foreground-muted mb-3">Manter bateria acima de</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="50"
                    defaultValue="20"
                    className="flex-1"
                  />
                  <span className="w-16 text-center font-medium text-foreground">20%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Program Enrollments */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Programas Inscritos</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-success-500/30 bg-success-500/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">CCEE - Resposta da Demanda</p>
                    <p className="text-sm text-foreground-muted">Programa nacional</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-success-500/20 text-success-500 rounded-full text-sm font-medium">
                  Ativo
                </span>
              </div>

              <div className="flex items-center justify-between p-4 border border-success-500/30 bg-success-500/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Enel - Tarifa Branca</p>
                    <p className="text-sm text-foreground-muted">Programa regional</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-success-500/20 text-success-500 rounded-full text-sm font-medium">
                  Ativo
                </span>
              </div>

              <div className="flex items-center justify-between p-4 border border-border bg-surface-hover rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-foreground-muted/20 flex items-center justify-center">
                    <Power className="w-5 h-5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">ONS - Reserva Operativa</p>
                    <p className="text-sm text-foreground-muted">Servicos ancilares</p>
                  </div>
                </div>
                <button className="px-3 py-1 border border-primary text-primary rounded-full text-sm font-medium hover:bg-primary/10 transition-colors">
                  Inscrever
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-border bg-surface-hover rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-foreground-muted/20 flex items-center justify-center">
                    <Power className="w-5 h-5 text-foreground-muted" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Regulacao de Frequencia</p>
                    <p className="text-sm text-foreground-muted">Servicos ancilares</p>
                  </div>
                </div>
                <button className="px-3 py-1 border border-primary text-primary rounded-full text-sm font-medium hover:bg-primary/10 transition-colors">
                  Inscrever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
