/**
 * SimpleDashboard
 * TODO: [FASE 1] This page exists but is not routed in App.tsx.
 * Decision pending: Add route, keep for future use, or remove.
 * Created: 2026-02-21
 */
import { useEffect, useState } from 'react';
import {
  Battery,
  Zap,
  TrendingUp,
  Calendar,
  AlertCircle,
  Sun,
  Moon,
  Download,
  RefreshCw,
  Leaf,
  CircleDollarSign,
  ThermometerSun,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { systemsApi, telemetryApi, alertsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { socketService } from '@/services/socket';
import { BessSystem, TelemetryData, Alert, AlertSeverity } from '@/types';

/**
 * Simplified Dashboard for End Users (USER role)
 * Shows only essential information:
 * - SOC (State of Charge)
 * - Monthly savings
 * - Non-technical alerts
 * - Energy status
 */
export default function SimpleDashboard() {
  const { user } = useAuthStore();
  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryData>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Mock data for demonstration (replace with real API calls)
  const [savingsData] = useState({
    monthlyKwh: 245.8,
    monthlySavings: 312.50,
    co2Avoided: 123.4,
    peakShavingHours: 48,
  });

  // Fetch data
  const fetchData = async () => {
    try {
      // Get only allowed systems for this user
      const systemsRes = await systemsApi.getAll();
      const userSystems = user?.allowedSystems
        ? (systemsRes.data.data || []).filter((s) => user.allowedSystems?.includes(s.id))
        : systemsRes.data.data || [];

      setSystems(userSystems);

      // Fetch telemetry for each system
      const telemetry: Record<string, TelemetryData> = {};
      for (const system of userSystems) {
        try {
          const telRes = await telemetryApi.getCurrent(system.id);
          if (telRes.data.data) {
            telemetry[system.id] = telRes.data.data;
          }
        } catch {
          // Ignore individual errors
        }
      }
      setTelemetryMap(telemetry);

      // Fetch alerts (non-technical ones only)
      const alertsRes = await alertsApi.getAll({ limit: 5 });
      const userAlerts = (alertsRes.data.data || [])
        .filter((a) => user?.allowedSystems?.includes(a.systemId))
        .filter((a) => a.severity === AlertSeverity.MEDIUM || a.severity === AlertSeverity.LOW);
      setAlerts(userAlerts);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = socketService.onTelemetryUpdate((data) => {
      if (user?.allowedSystems?.includes(data.systemId)) {
        setTelemetryMap((prev) => ({
          ...prev,
          [data.systemId]: data,
        }));
        setLastUpdate(new Date());
      }
    });

    return () => unsubscribe();
  }, [user]);

  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 20 || currentHour < 6;

  if (isLoading) {
    return <SimpleDashboardSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-foreground-muted text-sm flex items-center gap-2">
            {isNightTime ? (
              <>
                <Moon className="w-4 h-4" /> Boa noite
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" /> {currentHour < 12 ? 'Bom dia' : 'Boa tarde'}
              </>
            )}
            {' • '} Atualizado {formatRelativeTime(lastUpdate)}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Main Battery Status Card */}
      {systems.map((system) => {
        const telemetry = telemetryMap[system.id];
        const soc = telemetry?.soc || 0;
        const isCharging = telemetry?.isCharging || false;
        const isDischarging = telemetry?.isDischarging || false;

        return (
          <div key={system.id} className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-foreground">{system.name}</h2>
              <span
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded-full',
                  system.connectionStatus === 'online'
                    ? 'bg-success-500/20 text-success-500'
                    : 'bg-foreground-subtle/20 text-foreground-subtle'
                )}
              >
                {system.connectionStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Large SOC Display */}
            <div className="flex items-center justify-center mb-8">
              <div className="relative w-48 h-48">
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-surface-active"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={552.92}
                    strokeDashoffset={552.92 * (1 - soc / 100)}
                    className={cn(
                      'transition-all duration-1000',
                      soc > 60 ? 'text-success-500' : soc > 30 ? 'text-warning-500' : 'text-danger-500'
                    )}
                  />
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Battery
                    className={cn(
                      'w-8 h-8 mb-1',
                      isCharging ? 'text-success-500' : isDischarging ? 'text-warning-500' : 'text-foreground-muted'
                    )}
                  />
                  <span className="text-4xl font-bold text-foreground">{Math.round(soc)}%</span>
                  <span className="text-sm text-foreground-muted">
                    {isCharging ? 'Carregando' : isDischarging ? 'Em uso' : 'Standby'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex items-center justify-center gap-4">
              {isCharging && (
                <div className="flex items-center gap-2 px-4 py-2 bg-success-500/10 text-success-500 rounded-full">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">Carregando</span>
                </div>
              )}
              {isDischarging && (
                <div className="flex items-center gap-2 px-4 py-2 bg-warning-500/10 text-warning-500 rounded-full">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Economizando energia</span>
                </div>
              )}
              {!isCharging && !isDischarging && telemetry && (
                <div className="flex items-center gap-2 px-4 py-2 bg-foreground-subtle/10 text-foreground-muted rounded-full">
                  <Battery className="w-4 h-4" />
                  <span className="text-sm font-medium">Sistema em standby</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Savings Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <SavingsCard
          icon={CircleDollarSign}
          title="Economia este mês"
          value={`R$ ${savingsData.monthlySavings.toFixed(2)}`}
          subtitle={`${savingsData.monthlyKwh.toFixed(1)} kWh economizados`}
          color="success"
        />
        <SavingsCard
          icon={Leaf}
          title="CO₂ evitado"
          value={`${savingsData.co2Avoided.toFixed(0)} kg`}
          subtitle="Contribuição ambiental"
          color="secondary"
        />
      </div>

      {/* Simple Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ThermometerSun className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-foreground-muted">Temperatura</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {systems.length > 0 && telemetryMap[systems[0].id]
              ? `${telemetryMap[systems[0].id].temperature.average.toFixed(1)}°C`
              : '--'}
          </p>
          <p className="text-xs text-success-500">Normal</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Calendar className="w-5 h-5 text-secondary" />
            </div>
            <span className="text-sm text-foreground-muted">Horário de ponta</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {savingsData.peakShavingHours}h
          </p>
          <p className="text-xs text-foreground-muted">Economizadas este mês</p>
        </div>
      </div>

      {/* Alerts Section (simplified) */}
      {alerts.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-foreground-muted" />
              Notificações
            </h3>
          </div>
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 flex items-start gap-3">
                <div
                  className={cn(
                    'p-2 rounded-full shrink-0',
                    alert.severity === AlertSeverity.MEDIUM
                      ? 'bg-warning-500/10 text-warning-500'
                      : 'bg-foreground-subtle/10 text-foreground-subtle'
                  )}
                >
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-foreground-muted">{formatRelativeTime(alert.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Report Button */}
      <div className="bg-surface rounded-xl border border-border p-6 text-center">
        <Calendar className="w-10 h-10 mx-auto mb-3 text-primary" />
        <h3 className="font-semibold text-foreground mb-2">Relatório Mensal</h3>
        <p className="text-sm text-foreground-muted mb-4">
          Baixe o relatório completo de economia e consumo do mês.
        </p>
        <button className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          Baixar PDF
        </button>
      </div>

      {/* Help Text */}
      <p className="text-center text-sm text-foreground-muted">
        Dúvidas? Entre em contato com o suporte pelo WhatsApp.
      </p>
    </div>
  );
}

// Savings Card Component
interface SavingsCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
  color: 'success' | 'secondary' | 'primary' | 'warning';
}

function SavingsCard({ icon: Icon, title, value, subtitle, color }: SavingsCardProps) {
  const colorClasses = {
    success: 'bg-success-500/10 text-success-500',
    secondary: 'bg-secondary/10 text-secondary',
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-warning-500/10 text-warning-500',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-foreground-muted">{title}</span>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted">{subtitle}</p>
    </div>
  );
}

// Loading Skeleton
function SimpleDashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-surface rounded animate-pulse" />
      </div>
      <div className="bg-surface rounded-2xl border border-border p-6 h-80 animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
        <div className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
      </div>
    </div>
  );
}
