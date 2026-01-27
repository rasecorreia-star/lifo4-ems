import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Battery,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  WifiOff,
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
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
          onClick={fetchData}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sistemas Online"
          value={overview?.online || 0}
          total={overview?.total || 0}
          icon={Battery}
          color="success"
        />
        <StatCard
          title="Carregando"
          value={overview?.charging || 0}
          icon={TrendingUp}
          color="secondary"
        />
        <StatCard
          title="Descarregando"
          value={overview?.discharging || 0}
          icon={TrendingDown}
          color="warning"
        />
        <StatCard
          title="Alertas Ativos"
          value={alertsSummary?.unread || 0}
          icon={AlertTriangle}
          color={alertsSummary?.critical ? 'danger' : 'primary'}
          highlight={alertsSummary?.critical ? alertsSummary.critical > 0 : false}
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
              systems.map((system) => {
                const telemetry = telemetryMap[system.id];
                return (
                  <SystemRow key={system.id} system={system} telemetry={telemetry} />
                );
              })
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
              recentAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
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

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  color: 'success' | 'danger' | 'warning' | 'secondary' | 'primary';
  highlight?: boolean;
}

function StatCard({ title, value, total, icon: Icon, color, highlight }: StatCardProps) {
  const colorClasses = {
    success: 'text-success-500 bg-success-500/10',
    danger: 'text-danger-500 bg-danger-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    secondary: 'text-secondary bg-secondary/10',
    primary: 'text-primary bg-primary/10',
  };

  return (
    <div
      className={cn(
        'bg-surface rounded-xl p-4 border transition-all',
        highlight ? 'border-danger-500 shadow-glow-red' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {highlight && (
          <span className="px-2 py-0.5 bg-danger-500/20 text-danger-500 text-xs font-medium rounded-full animate-pulse">
            Crítico
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">
        {value}
        {total !== undefined && (
          <span className="text-foreground-muted font-normal">/{total}</span>
        )}
      </p>
      <p className="text-sm text-foreground-muted">{title}</p>
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

  return (
    <Link
      to={`/systems/${system.id}`}
      className="flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors"
    >
      {/* Status indicator */}
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          isOnline ? 'bg-primary/10' : 'bg-surface-active'
        )}
      >
        {isOnline ? (
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
