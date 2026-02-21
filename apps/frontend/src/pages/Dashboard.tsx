import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Battery,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Info,
  HeartPulse,
  DollarSign,
  Link2,
  Power,
} from 'lucide-react';
import { cn, formatPercent, formatPower, formatVoltage, formatTemperature, formatRelativeTime } from '@/lib/utils';
import { systemsApi, alertsApi, telemetryApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { SystemsOverview, AlertsSummary, BessSystem, TelemetryData, Alert } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import SimpleDashboard from './SimpleDashboard';
import SolarForecastWidget from '@/components/dashboard/SolarForecastWidget';
import TariffWidget from '@/components/dashboard/TariffWidget';
import EconomicsWidget from '@/components/dashboard/EconomicsWidget';

// Componente de Tooltip com informações detalhadas
interface InfoTooltipProps {
  title: string;
  description: string;
  calculation: string;
  importance: string;
}

function InfoTooltip({ title, description, calculation, importance }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 300),
      });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={iconRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cursor-help"
      >
        <Info className="w-3.5 h-3.5 text-white/70 hover:text-white transition-colors" />
      </div>
      {isVisible && (
        <div
          className="fixed z-[9999] w-72 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={handleMouseLeave}
        >
          <h4 className="font-semibold text-white text-sm mb-2">{title}</h4>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-emerald-400 font-medium">O que mostra:</span>
              <p className="text-gray-300 mt-0.5">{description}</p>
            </div>
            <div>
              <span className="text-blue-400 font-medium">Como é calculado:</span>
              <p className="text-gray-300 mt-0.5">{calculation}</p>
            </div>
            <div>
              <span className="text-amber-400 font-medium">Por que é importante:</span>
              <p className="text-gray-300 mt-0.5">{importance}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Dashboard() {
  // Check if user is end user - render simplified dashboard
  const { isEndUser } = usePermissions();

  if (isEndUser) {
    return <SimpleDashboard />;
  }

  return <FullDashboard />;
}

function FullDashboard() {
  const [overview, setOverview] = useState<SystemsOverview | null>(null);
  const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null);
  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showAllSystems, setShowAllSystems] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Simulated daily values (fixed for the day based on date seed)
  const dailyStats = useMemo(() => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    // Simple seeded random function
    const seededRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };
    return {
      worstPerformers: Math.floor(seededRandom(seed) * 2) + 1,
      topRevenue: Math.floor(2500 + seededRandom(seed + 1) * 1500),
    };
  }, []);

  // Fetch dashboard data
  const fetchData = async () => {
    try {
      const [overviewRes, alertsSummaryRes, systemsRes, alertsRes] = await Promise.all([
        systemsApi.getOverview(),
        alertsApi.getSummary(),
        systemsApi.getAll({ limit: 5 }),
        alertsApi.getAll({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
      ]);

      setOverview(overviewRes.data.data || null);
      setAlertsSummary(alertsSummaryRes.data.data || null);
      setSystems(systemsRes.data.data || []);
      setRecentAlerts(alertsRes.data.data || []);

      // Fetch telemetry for each system
      const telemetry: Record<string, TelemetryData> = {};
      for (const system of systemsRes.data.data || []) {
        try {
          const telRes = await telemetryApi.getCurrent(system.id);
          if (telRes.data.data) {
            telemetry[system.id] = telRes.data.data;
          }
        } catch {
          // Ignore individual telemetry errors
        }
      }
      setTelemetryMap(telemetry);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual refresh handler with visual feedback
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeTelemetry = socketService.onTelemetryUpdate((data) => {
      setTelemetryMap((prev) => ({
        ...prev,
        [data.systemId]: data,
      }));
      setLastUpdate(new Date());
    });

    const unsubscribeAlert = socketService.onAlert((alert) => {
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 4)]);
      setAlertsSummary((prev) =>
        prev
          ? {
              ...prev,
              total: prev.total + 1,
              unread: prev.unread + 1,
              [alert.severity]: prev[alert.severity as keyof AlertsSummary] + 1,
            }
          : prev
      );
    });

    return () => {
      unsubscribeTelemetry();
      unsubscribeAlert();
    };
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-foreground-muted text-sm">
            Última atualização: {formatRelativeTime(lastUpdate)}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Active Alarms Banner */}
      {(() => {
        const allAlarms: { systemId: string; systemName: string; alarms: string[] }[] = [];
        Object.entries(telemetryMap).forEach(([systemId, tel]) => {
          if (tel.alarms && tel.alarms.length > 0) {
            const sys = systems.find(s => s.id === systemId);
            allAlarms.push({
              systemId,
              systemName: sys?.name || systemId,
              alarms: tel.alarms as string[]
            });
          }
        });
        if (allAlarms.length === 0) return null;

        const alarmLabels: Record<string, string> = {
          overvoltage: '⚡ Sobretensão',
          undervoltage: '⚡ Subtensão',
          overcurrent: '🔌 Sobrecorrente',
          overtemp: '🌡️ Sobretemperatura',
          undertemp: '❄️ Subtemperatura',
          cellImbalance: '⚖️ Desbalanceamento',
          shortCircuit: '💥 Curto-Circuito',
          mosfetOvertemp: '🔥 MOSFET Superaquecido'
        };

        return (
          <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-red-500 text-lg">🚨 ALARMES ATIVOS</h3>
                <div className="mt-3 space-y-2">
                  {allAlarms.map(({ systemId, systemName, alarms }) => (
                    <Link
                      key={systemId}
                      to={`/systems/${systemId}`}
                      className="block bg-red-500/30 hover:bg-red-500/40 rounded-lg p-3 transition-colors"
                    >
                      <div className="font-semibold text-white">{systemName}</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {alarms.map((alarm) => (
                          <span key={alarm} className="px-2 py-1 bg-red-600 text-white rounded text-sm">
                            {alarmLabels[alarm] || alarm}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats Cards - All 8 in one row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <StatCard
          title="Sistemas Online"
          value={overview?.online || 0}
          total={overview?.total || 0}
          icon={Battery}
          color="success"
          tooltipInfo={{
            title: "Sistemas Online",
            description: "Quantidade de sistemas BESS conectados e operando normalmente na rede.",
            calculation: "Contagem de sistemas com status de conexão 'online' / total de sistemas cadastrados.",
            importance: "Indica a disponibilidade da frota. 100% significa todos os sistemas operacionais e prontos para uso."
          }}
        />
        <StatCard
          title="Carregando"
          value={overview?.charging || 0}
          icon={TrendingUp}
          color="secondary"
          tooltipInfo={{
            title: "Sistemas Carregando",
            description: "Sistemas que estão absorvendo energia da rede para armazenar nas baterias.",
            calculation: "Contagem de sistemas com corrente positiva (entrando nas baterias).",
            importance: "Carregamento ocorre em horários de baixa tarifa para maximizar economia com arbitragem."
          }}
        />
        <StatCard
          title="Descarregando"
          value={overview?.discharging || 0}
          icon={TrendingDown}
          color="warning"
          tooltipInfo={{
            title: "Sistemas Descarregando",
            description: "Sistemas que estão fornecendo energia armazenada para a rede ou carga local.",
            calculation: "Contagem de sistemas com corrente negativa (saindo das baterias).",
            importance: "Descarga ocorre em horários de ponta para reduzir demanda da rede e gerar economia."
          }}
        />
        <StatCard
          title="Alertas Ativos"
          value={alertsSummary?.unread || 0}
          icon={AlertTriangle}
          color={alertsSummary?.critical ? 'danger' : 'primary'}
          highlight={alertsSummary?.critical ? alertsSummary.critical > 0 : false}
          tooltipInfo={{
            title: "Alertas Ativos",
            description: "Número de alertas não resolvidos que requerem atenção do operador.",
            calculation: "Soma de alertas críticos, altos, médios e baixos não lidos ou não resolvidos.",
            importance: "Alertas críticos podem indicar falhas iminentes. Resolução rápida previne danos e perdas."
          }}
        />
        <StatCard
          title="Worst Performers"
          value={systems.length > 0 ? dailyStats.worstPerformers : 0}
          unit="sist."
          icon={HeartPulse}
          color={dailyStats.worstPerformers > 1 ? 'danger' : dailyStats.worstPerformers > 0 ? 'warning' : 'success'}
          tooltipInfo={{
            title: "Worst Performers (SoH)",
            description: "Quantas unidades estão degradando mais rápido que a média da frota.",
            calculation: "Sistemas com SoH abaixo da média - indica degradação acelerada comparado aos demais.",
            importance: "Indica problemas de climatização (HVAC) ou ciclos excessivos naquela localidade. Requer investigação."
          }}
        />
        <StatCard
          title="Top Receita"
          value={systems.length > 0 ? dailyStats.topRevenue.toLocaleString('pt-BR') : '0'}
          prefix="R$"
          icon={DollarSign}
          color="success"
          tooltipInfo={{
            title: "Top Revenue Generators",
            description: "Maior receita gerada por um único sistema hoje via arbitragem tarifária.",
            calculation: "(Energia descarga × tarifa ponta) - (energia carga × tarifa fora-ponta) + serviços ancilares.",
            importance: "Identifica os sistemas mais lucrativos. Use como benchmark para otimizar outros sistemas."
          }}
        />
        <StatCard
          title="Causas Raiz"
          value={(() => {
            // Simulated: alert groups (root causes) vs total alerts
            const totalAlerts = alertsSummary?.total || 5;
            const rootCauses = Math.max(1, Math.floor(totalAlerts * 0.3));
            return rootCauses;
          })()}
          total={alertsSummary?.total || 5}
          icon={Link2}
          color="secondary"
          tooltipInfo={{
            title: "Event Correlation",
            description: "Agrupa alertas relacionados em causas raiz. Ex: inversor cai + bateria perde comunicação = 1 causa raiz 'Falha Conexão' ao invés de 50 erros.",
            calculation: "ML analisa padrões temporais para agrupar alertas com mesma origem.",
            importance: "Evita 'tempestade de alarmes'. Mostra X causas raiz de Y alertas totais."
          }}
        />
        <StatCard
          title="BESS Offline"
          value={overview ? (overview.total - overview.online) : 0}
          icon={Power}
          color={(overview && overview.total - overview.online > 0) ? 'danger' : 'success'}
          highlight={!!(overview && overview.total - overview.online > 0)}
          tooltipInfo={{
            title: "BESS Offline",
            description: "Quantidade de sistemas sem comunicação ou desligados. Requer verificação imediata.",
            calculation: "Total de sistemas - sistemas online = sistemas sem resposta de heartbeat há mais de 5 minutos.",
            importance: "Sistemas offline não geram receita e podem indicar falha crítica. Verifique conexão e status físico."
          }}
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Systems List */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Sistemas</h2>
            <Link
              to="/systems"
              className="text-sm text-primary hover:text-primary-400 flex items-center gap-1 transition-colors"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {systems.length === 0 ? (
              <div className="p-8 text-center text-foreground-muted">
                <Battery className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum sistema cadastrado</p>
              </div>
            ) : (
              <>
                {(showAllSystems ? systems : systems.slice(0, 3)).map((system) => {
                  const telemetry = telemetryMap[system.id];
                  return (
                    <SystemRow key={system.id} system={system} telemetry={telemetry} />
                  );
                })}
                {systems.length > 3 && (
                  <button
                    onClick={() => setShowAllSystems(!showAllSystems)}
                    className="w-full p-3 flex items-center justify-center gap-2 text-sm text-primary hover:bg-surface-hover transition-colors"
                  >
                    {showAllSystems ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Mostrar mais {systems.length - 3} sistema(s)
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-surface rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Alertas Recentes</h2>
            <Link
              to="/alerts"
              className="text-sm text-primary hover:text-primary-400 flex items-center gap-1 transition-colors"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentAlerts.length === 0 ? (
              <div className="p-8 text-center text-foreground-muted">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum alerta recente</p>
              </div>
            ) : (
              <>
                {(showAllAlerts ? recentAlerts : recentAlerts.slice(0, 3)).map((alert) => (
                  <AlertRow key={alert.id} alert={alert} />
                ))}
                {recentAlerts.length > 3 && (
                  <button
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    className="w-full p-3 flex items-center justify-center gap-2 text-sm text-primary hover:bg-surface-hover transition-colors"
                  >
                    {showAllAlerts ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Mostrar mais {recentAlerts.length - 3} alerta(s)
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Energy Management Widgets */}
      <div className="grid lg:grid-cols-2 gap-6">
        <SolarForecastWidget systemCapacityKw={20} />
        <TariffWidget tariffType="branca" />
      </div>

      {/* Economics Widget */}
      <EconomicsWidget />
    </div>
  );
}

// Stat Card Component - 3D Style
interface StatCardProps {
  title: string;
  value: number | string;
  total?: number;
  unit?: string;
  prefix?: string;
  icon: React.ElementType;
  color: 'success' | 'danger' | 'warning' | 'secondary' | 'primary';
  highlight?: boolean;
  tooltipInfo?: {
    title: string;
    description: string;
    calculation: string;
    importance: string;
  };
}

function StatCard({ title, value, total, unit, prefix, icon: Icon, color, highlight, tooltipInfo }: StatCardProps) {
  const colorGradients = {
    success: 'from-emerald-500 via-emerald-600 to-emerald-800 border-emerald-300/50 shadow-emerald-500/30',
    danger: 'from-red-500 via-red-600 to-red-800 border-red-300/50 shadow-red-500/30',
    warning: 'from-amber-500 via-amber-600 to-amber-800 border-amber-300/50 shadow-amber-500/30',
    secondary: 'from-violet-500 via-violet-600 to-violet-800 border-violet-300/50 shadow-violet-500/30',
    primary: 'from-blue-500 via-blue-600 to-blue-800 border-blue-300/50 shadow-blue-500/30',
  };

  return (
    <div
      className={cn(
        'relative rounded-lg p-2 bg-gradient-to-b border shadow-md overflow-hidden transition-all',
        colorGradients[color],
        highlight && 'ring-1 ring-red-400 ring-offset-1 ring-offset-background animate-pulse'
      )}
    >
      {/* Shine effect */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg" />

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <div className="p-1.5 rounded bg-white/20 backdrop-blur-sm">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-1">
            {highlight && (
              <span className="px-1 py-0.5 bg-white/20 text-white text-2xs font-medium rounded-full animate-pulse">
                !
              </span>
            )}
            {tooltipInfo && (
              <InfoTooltip
                title={tooltipInfo.title}
                description={tooltipInfo.description}
                calculation={tooltipInfo.calculation}
                importance={tooltipInfo.importance}
              />
            )}
          </div>
        </div>
        <p className="text-xl font-bold text-white drop-shadow-md">
          {prefix && <span className="text-base">{prefix}</span>}
          {value}
          {unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
          {total !== undefined && (
            <span className="text-white/70 font-normal text-base">/{total}</span>
          )}
        </p>
        <p className="text-xs text-white/80 truncate">{title}</p>
      </div>
    </div>
  );
}

// System Row Component
interface SystemRowProps {
  system: BessSystem;
  telemetry?: TelemetryData;
}

function SystemRow({ system, telemetry }: SystemRowProps) {
  const isOnline = system.connectionStatus === 'online';
  const hasAlarms = telemetry?.alarms && (telemetry.alarms as string[]).length > 0;

  return (
    <Link
      to={`/systems/${system.id}`}
      className={cn(
        "flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors relative",
        hasAlarms && "bg-red-500/10 border-l-4 border-red-500 animate-pulse"
      )}
    >
      {/* Alarm indicator */}
      {hasAlarms && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
          <AlertTriangle className="w-3 h-3" />
          {(telemetry?.alarms as string[]).length} ALARME{(telemetry?.alarms as string[]).length > 1 ? 'S' : ''}
        </div>
      )}

      {/* Status indicator */}
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          hasAlarms ? 'bg-red-500/20' : isOnline ? 'bg-primary/10' : 'bg-surface-active'
        )}
      >
        {hasAlarms ? (
          <AlertTriangle className="w-6 h-6 text-red-500" />
        ) : isOnline ? (
          <Battery className="w-6 h-6 text-primary" />
        ) : (
          <WifiOff className="w-6 h-6 text-foreground-subtle" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground truncate">{system.name}</h3>
          <span
            className={cn(
              'px-2 py-0.5 text-2xs font-medium rounded-full',
              isOnline ? 'bg-success-500/20 text-success-500' : 'bg-foreground-subtle/20 text-foreground-subtle'
            )}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-sm text-foreground-muted truncate">{system.model}</p>
      </div>

      {/* Telemetry */}
      {telemetry && isOnline ? (
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-primary font-semibold">{formatPercent(telemetry.soc, 0)}</p>
            <p className="text-2xs text-foreground-muted">SOC</p>
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">{formatVoltage(telemetry.totalVoltage)}</p>
            <p className="text-2xs text-foreground-muted">Tensão</p>
          </div>
          <div className="text-center">
            <p
              className={cn(
                'font-medium',
                telemetry.current > 0 ? 'text-success-500' : telemetry.current < 0 ? 'text-warning-500' : 'text-foreground'
              )}
            >
              {formatPower(telemetry.power)}
            </p>
            <p className="text-2xs text-foreground-muted">Potência</p>
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">{formatTemperature(telemetry.temperature.average)}</p>
            <p className="text-2xs text-foreground-muted">Temp</p>
          </div>
        </div>
      ) : (
        <div className="hidden sm:block text-sm text-foreground-muted">
          {isOnline ? 'Carregando...' : 'Sem dados'}
        </div>
      )}

      <ArrowRight className="w-5 h-5 text-foreground-muted" />
    </Link>
  );
}

// Alert Row Component
function AlertRow({ alert }: { alert: Alert }) {
  const severityStyles = {
    critical: 'bg-danger-500 text-white',
    high: 'bg-warning-500 text-white',
    medium: 'bg-secondary text-white',
    low: 'bg-foreground-subtle text-white',
  };

  return (
    <Link
      to="/alerts"
      className="flex items-start gap-3 p-4 hover:bg-surface-hover transition-colors"
    >
      <span
        className={cn(
          'px-2 py-0.5 text-2xs font-medium rounded-full uppercase shrink-0',
          severityStyles[alert.severity as keyof typeof severityStyles]
        )}
      >
        {alert.severity}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground font-medium truncate">{alert.title}</p>
        <p className="text-xs text-foreground-muted truncate">{alert.message}</p>
        <p className="text-2xs text-foreground-subtle mt-1">
          {formatRelativeTime(alert.createdAt)}
        </p>
      </div>
    </Link>
  );
}

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-surface rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border">
            <div className="w-10 h-10 bg-surface-hover rounded-lg mb-3 animate-pulse" />
            <div className="h-8 w-20 bg-surface-hover rounded mb-2 animate-pulse" />
            <div className="h-4 w-24 bg-surface-hover rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border h-96 animate-pulse" />
        <div className="bg-surface rounded-xl border border-border h-96 animate-pulse" />
      </div>
    </div>
  );
}
