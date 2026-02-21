import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Plug,
  ArrowLeft,
  RefreshCw,
  Zap,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  Power,
  Clock,
  DollarSign,
  Car,
  Battery,
  MapPin,
  Play,
  Square,
  RotateCcw,
  Unlock,
  Lock,
  Thermometer,
  Activity,
  TrendingUp,
} from 'lucide-react';
import {
  cn,
  formatPower,
  formatEnergy,
  formatRelativeTime,
  formatCurrency,
  formatDate,
  formatNumber,
} from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

export type EVChargerStatus = 'online' | 'offline' | 'available' | 'charging' | 'faulted' | 'unavailable';
export type ConnectorStatus = 'available' | 'occupied' | 'reserved' | 'faulted' | 'unavailable';
export type ConnectorType = 'Type1' | 'Type2' | 'CCS1' | 'CCS2' | 'CHAdeMO' | 'Tesla';
export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface EVConnector {
  id: string;
  connectorId: number;
  type: ConnectorType;
  maxPowerKw: number;
  status: ConnectorStatus;
  currentPowerKw?: number;
  sessionId?: string;
  meterValueKwh?: number;
  temperature?: number;
}

export interface ChargingSession {
  id: string;
  chargerId: string;
  connectorId: number;
  userId?: string;
  vehicleId?: string;
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  energyKwh: number;
  durationMinutes: number;
  cost: number;
  tariffId: string;
  maxPowerKw: number;
  averagePowerKw: number;
  stopReason?: string;
  meterStart: number;
  meterEnd?: number;
}

export interface EVCharger {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  ocppVersion: '1.6' | '2.0.1';
  status: EVChargerStatus;
  connectors: EVConnector[];
  location?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  lastHeartbeat?: string;
  firmwareVersion?: string;
  totalEnergyKwh: number;
  totalSessions: number;
  ocppEndpoint?: string;
  chargePointVendor?: string;
  chargePointModel?: string;
  iccid?: string;
  imsi?: string;
  bootNotification?: {
    timestamp: string;
    status: string;
    interval: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API FUNCTIONS
// ============================================

const evChargersApi = {
  getById: (chargerId: string) =>
    api.get<{ success: boolean; data: EVCharger }>(`/ev-chargers/${chargerId}`),

  getActiveSessions: (chargerId: string) =>
    api.get<{ success: boolean; data: ChargingSession[] }>(`/ev-chargers/${chargerId}/sessions/active`),

  getRecentSessions: (chargerId: string, limit?: number) =>
    api.get<{ success: boolean; data: ChargingSession[] }>(`/ev-chargers/${chargerId}/sessions`, { params: { limit } }),

  sendCommand: (chargerId: string, command: string, params?: Record<string, unknown>) =>
    api.post(`/ev-chargers/${chargerId}/command`, { command, params }),

  remoteStartTransaction: (chargerId: string, connectorId: number, idTag: string) =>
    api.post(`/ev-chargers/${chargerId}/remote-start`, { connectorId, idTag }),

  remoteStopTransaction: (chargerId: string, transactionId: string) =>
    api.post(`/ev-chargers/${chargerId}/remote-stop`, { transactionId }),

  unlockConnector: (chargerId: string, connectorId: number) =>
    api.post(`/ev-chargers/${chargerId}/unlock`, { connectorId }),

  reset: (chargerId: string, type: 'Soft' | 'Hard') =>
    api.post(`/ev-chargers/${chargerId}/reset`, { type }),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function EVChargerDetail() {
  const { chargerId } = useParams<{ chargerId: string }>();
  const [charger, setCharger] = useState<EVCharger | null>(null);
  const [activeSessions, setActiveSessions] = useState<ChargingSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<ChargingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandLoading, setCommandLoading] = useState<string | null>(null);

  // Fetch charger data
  const fetchData = async () => {
    if (!chargerId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [chargerRes, activeRes, recentRes] = await Promise.all([
        evChargersApi.getById(chargerId).catch(() => null),
        evChargersApi.getActiveSessions(chargerId).catch(() => null),
        evChargersApi.getRecentSessions(chargerId, 10).catch(() => null),
      ]);

      if (chargerRes?.data.data) {
        setCharger(chargerRes.data.data);
      } else {
        // Use mock data for development
        setCharger(getMockCharger(chargerId));
      }

      setActiveSessions(activeRes?.data.data || getMockActiveSessions(chargerId));
      setRecentSessions(recentRes?.data.data || getMockRecentSessions(chargerId));
    } catch (err) {
      setError('Falha ao carregar dados do carregador');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [chargerId]);

  // Command handlers
  const handleReset = async (type: 'Soft' | 'Hard') => {
    if (!chargerId) return;
    if (type === 'Hard' && !confirm('Tem certeza que deseja fazer um reset completo?')) return;

    setCommandLoading('reset');
    try {
      await evChargersApi.reset(chargerId, type);
      fetchData();
    } catch (err) {
      console.error('Failed to reset charger:', err);
    } finally {
      setCommandLoading(null);
    }
  };

  const handleUnlock = async (connectorId: number) => {
    if (!chargerId) return;
    setCommandLoading(`unlock-${connectorId}`);
    try {
      await evChargersApi.unlockConnector(chargerId, connectorId);
      fetchData();
    } catch (err) {
      console.error('Failed to unlock connector:', err);
    } finally {
      setCommandLoading(null);
    }
  };

  const handleRemoteStart = async (connectorId: number) => {
    if (!chargerId) return;
    setCommandLoading(`start-${connectorId}`);
    try {
      await evChargersApi.remoteStartTransaction(chargerId, connectorId, 'DEFAULT');
      fetchData();
    } catch (err) {
      console.error('Failed to start transaction:', err);
    } finally {
      setCommandLoading(null);
    }
  };

  const handleRemoteStop = async (transactionId: string) => {
    if (!chargerId) return;
    setCommandLoading(`stop-${transactionId}`);
    try {
      await evChargersApi.remoteStopTransaction(chargerId, transactionId);
      fetchData();
    } catch (err) {
      console.error('Failed to stop transaction:', err);
    } finally {
      setCommandLoading(null);
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !charger) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Carregador nao encontrado'}
        </h2>
        <Link
          to="/ev-chargers"
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para carregadores
        </Link>
      </div>
    );
  }

  const isOnline = charger.status !== 'offline' && charger.status !== 'faulted';
  const isCharging = charger.status === 'charging';
  const hasFault = charger.status === 'faulted';

  // Calculate totals
  const totalPower = charger.connectors.reduce((sum, conn) => sum + (conn.currentPowerKw || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/ev-chargers"
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{charger.name}</h1>
              <StatusBadge status={charger.status} />
            </div>
            <p className="text-foreground-muted text-sm">
              {charger.manufacturer} {charger.model} - Serial: {charger.serialNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
          <Link
            to={`/ev-chargers/${chargerId}/sessions`}
            className="flex items-center gap-2 px-3 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Historico</span>
          </Link>
          <Link
            to={`/ev-chargers/${chargerId}/smart-charging`}
            className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Smart Charging</span>
          </Link>
          <Link
            to={`/ev-chargers/${chargerId}/config`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Configuracoes"
          >
            <Settings className="w-5 h-5 text-foreground-muted" />
          </Link>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-foreground-muted text-sm">Potencia Atual</span>
            <Zap className={cn('w-5 h-5', isCharging ? 'text-warning-500' : 'text-foreground-muted')} />
          </div>
          <p className={cn('text-3xl font-bold', isCharging ? 'text-warning-500' : 'text-foreground')}>
            {formatPower(totalPower * 1000)}
          </p>
          <p className="text-sm text-foreground-muted">
            {isCharging ? 'Em uso' : 'Ocioso'}
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-foreground-muted text-sm">Energia Total</span>
            <Battery className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {formatEnergy(charger.totalEnergyKwh)}
          </p>
          <p className="text-sm text-foreground-muted">
            Desde instalacao
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-foreground-muted text-sm">Sessoes</span>
            <Car className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {charger.totalSessions}
          </p>
          <p className="text-sm text-foreground-muted">
            {activeSessions.length} ativa(s)
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-foreground-muted text-sm">Status</span>
            {isOnline ? (
              <Wifi className="w-5 h-5 text-success-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-foreground-subtle" />
            )}
          </div>
          <p className="text-3xl font-bold text-foreground">
            OCPP {charger.ocppVersion}
          </p>
          <p className="text-sm text-foreground-muted">
            FW: {charger.firmwareVersion || 'N/A'}
          </p>
        </div>
      </div>

      {/* Connectors */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-4">Conectores</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {charger.connectors.map((connector) => {
            const activeSession = activeSessions.find(s => s.connectorId === connector.connectorId);
            return (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                session={activeSession}
                commandLoading={commandLoading}
                onUnlock={() => handleUnlock(connector.connectorId)}
                onRemoteStart={() => handleRemoteStart(connector.connectorId)}
                onRemoteStop={activeSession ? () => handleRemoteStop(activeSession.id) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-4">Controle do Carregador</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleReset('Soft')}
            disabled={commandLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {commandLoading === 'reset' ? 'Reiniciando...' : 'Soft Reset'}
          </button>

          <button
            onClick={() => handleReset('Hard')}
            disabled={commandLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            Hard Reset
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4">Sessoes Ativas</h3>
          <div className="space-y-3">
            {activeSessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                onStop={() => handleRemoteStop(session.id)}
                isLoading={commandLoading === `stop-${session.id}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Sessoes Recentes</h3>
          <Link
            to={`/ev-chargers/${chargerId}/sessions`}
            className="text-sm text-primary hover:text-primary-400"
          >
            Ver todas
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <p className="text-foreground-muted text-center py-8">Nenhuma sessao recente</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Inicio</th>
                  <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Conector</th>
                  <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Duracao</th>
                  <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Energia</th>
                  <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Custo</th>
                  <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr key={session.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="py-2 px-3 text-foreground text-sm">{formatDate(session.startTime)}</td>
                    <td className="py-2 px-3 text-foreground text-sm">#{session.connectorId}</td>
                    <td className="py-2 px-3 text-foreground text-sm">{session.durationMinutes} min</td>
                    <td className="py-2 px-3 text-foreground text-sm">{session.energyKwh.toFixed(2)} kWh</td>
                    <td className="py-2 px-3 text-foreground text-sm">{formatCurrency(session.cost)}</td>
                    <td className="py-2 px-3">
                      <SessionStatusBadge status={session.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charger Info */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4">Informacoes do Carregador</h3>
          <dl className="space-y-3">
            <InfoRow label="Fabricante" value={charger.manufacturer} />
            <InfoRow label="Modelo" value={charger.model} />
            <InfoRow label="Serial" value={charger.serialNumber} />
            <InfoRow label="Firmware" value={charger.firmwareVersion || 'N/A'} />
            <InfoRow label="Versao OCPP" value={charger.ocppVersion} />
            <InfoRow label="Vendor OCPP" value={charger.chargePointVendor || 'N/A'} />
          </dl>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4">Conexao</h3>
          <dl className="space-y-3">
            <InfoRow label="Endpoint OCPP" value={charger.ocppEndpoint || 'N/A'} />
            <InfoRow label="ICCID" value={charger.iccid || 'N/A'} />
            <InfoRow label="IMSI" value={charger.imsi || 'N/A'} />
            <InfoRow
              label="Ultimo Heartbeat"
              value={charger.lastHeartbeat ? formatRelativeTime(charger.lastHeartbeat) : 'N/A'}
            />
            {charger.bootNotification && (
              <>
                <InfoRow
                  label="Boot Status"
                  value={charger.bootNotification.status}
                />
                <InfoRow
                  label="Heartbeat Interval"
                  value={`${charger.bootNotification.interval}s`}
                />
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Location */}
      {charger.location && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Localizacao
          </h3>
          <p className="text-foreground">{charger.location.address}</p>
          <p className="text-foreground-muted text-sm">
            {charger.location.latitude.toFixed(6)}, {charger.location.longitude.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// STATUS BADGE COMPONENT
// ============================================

interface StatusBadgeProps {
  status: EVChargerStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusColors: Record<EVChargerStatus, string> = {
    online: 'bg-success-500/20 text-success-500',
    offline: 'bg-foreground-subtle/20 text-foreground-subtle',
    available: 'bg-secondary/20 text-secondary',
    charging: 'bg-warning-500/20 text-warning-500',
    faulted: 'bg-danger-500/20 text-danger-500',
    unavailable: 'bg-foreground-subtle/20 text-foreground-subtle',
  };

  const statusLabels: Record<EVChargerStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    available: 'Disponivel',
    charging: 'Carregando',
    faulted: 'Falha',
    unavailable: 'Indisponivel',
  };

  const statusIcons: Record<EVChargerStatus, React.ReactNode> = {
    online: <Wifi className="w-3 h-3" />,
    offline: <WifiOff className="w-3 h-3" />,
    available: <Power className="w-3 h-3" />,
    charging: <Zap className="w-3 h-3" />,
    faulted: <AlertTriangle className="w-3 h-3" />,
    unavailable: <WifiOff className="w-3 h-3" />,
  };

  return (
    <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1', statusColors[status])}>
      {statusIcons[status]}
      {statusLabels[status]}
    </span>
  );
}

// ============================================
// CONNECTOR CARD COMPONENT
// ============================================

interface ConnectorCardProps {
  connector: EVConnector;
  session?: ChargingSession;
  commandLoading: string | null;
  onUnlock: () => void;
  onRemoteStart: () => void;
  onRemoteStop?: () => void;
}

function ConnectorCard({ connector, session, commandLoading, onUnlock, onRemoteStart, onRemoteStop }: ConnectorCardProps) {
  const connectorStatusColors: Record<ConnectorStatus, string> = {
    available: 'border-success-500/50 bg-success-500/5',
    occupied: 'border-warning-500/50 bg-warning-500/5',
    reserved: 'border-secondary/50 bg-secondary/5',
    faulted: 'border-danger-500/50 bg-danger-500/5',
    unavailable: 'border-border bg-surface-hover',
  };

  const connectorStatusLabels: Record<ConnectorStatus, string> = {
    available: 'Disponivel',
    occupied: 'Ocupado',
    reserved: 'Reservado',
    faulted: 'Falha',
    unavailable: 'Indisponivel',
  };

  return (
    <div className={cn('border rounded-xl p-4', connectorStatusColors[connector.status])}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <Power className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Conector #{connector.connectorId}</h4>
            <p className="text-sm text-foreground-muted">{connector.type} - {connector.maxPowerKw}kW</p>
          </div>
        </div>
        <span className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full',
          connector.status === 'available' ? 'bg-success-500/20 text-success-500' :
          connector.status === 'occupied' ? 'bg-warning-500/20 text-warning-500' :
          connector.status === 'faulted' ? 'bg-danger-500/20 text-danger-500' :
          'bg-foreground-subtle/20 text-foreground-subtle'
        )}>
          {connectorStatusLabels[connector.status]}
        </span>
      </div>

      {/* Real-time data */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <Zap className="w-4 h-4 mx-auto mb-1 text-foreground-muted" />
          <p className="text-sm font-medium text-foreground">
            {connector.currentPowerKw ? `${connector.currentPowerKw.toFixed(1)} kW` : '0 kW'}
          </p>
          <p className="text-2xs text-foreground-muted">Potencia</p>
        </div>
        <div className="text-center">
          <Battery className="w-4 h-4 mx-auto mb-1 text-foreground-muted" />
          <p className="text-sm font-medium text-foreground">
            {connector.meterValueKwh ? `${connector.meterValueKwh.toFixed(1)} kWh` : '0 kWh'}
          </p>
          <p className="text-2xs text-foreground-muted">Energia</p>
        </div>
        <div className="text-center">
          <Thermometer className="w-4 h-4 mx-auto mb-1 text-foreground-muted" />
          <p className="text-sm font-medium text-foreground">
            {connector.temperature ? `${connector.temperature}C` : 'N/A'}
          </p>
          <p className="text-2xs text-foreground-muted">Temp</p>
        </div>
      </div>

      {/* Session info */}
      {session && (
        <div className="bg-surface rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground-muted">Sessao ativa</span>
            <span className="text-sm font-medium text-foreground">{session.energyKwh.toFixed(2)} kWh</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">Duracao</span>
            <span className="text-sm font-medium text-foreground">{session.durationMinutes} min</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {connector.status === 'available' && (
          <button
            onClick={onRemoteStart}
            disabled={commandLoading !== null}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-success-500 hover:bg-success-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {commandLoading === `start-${connector.connectorId}` ? 'Iniciando...' : 'Iniciar'}
          </button>
        )}

        {connector.status === 'occupied' && onRemoteStop && (
          <button
            onClick={onRemoteStop}
            disabled={commandLoading !== null}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Square className="w-4 h-4" />
            Parar
          </button>
        )}

        <button
          onClick={onUnlock}
          disabled={commandLoading !== null || connector.status === 'available'}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-surface-hover hover:bg-surface-active text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Unlock className="w-4 h-4" />
          {commandLoading === `unlock-${connector.connectorId}` ? 'Desbloq...' : 'Desbloquear'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// ACTIVE SESSION CARD
// ============================================

interface ActiveSessionCardProps {
  session: ChargingSession;
  onStop: () => void;
  isLoading: boolean;
}

function ActiveSessionCard({ session, onStop, isLoading }: ActiveSessionCardProps) {
  return (
    <div className="bg-warning-500/5 border border-warning-500/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-warning-500" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Conector #{session.connectorId}</h4>
            <p className="text-sm text-foreground-muted">Iniciado {formatRelativeTime(session.startTime)}</p>
          </div>
        </div>
        <button
          onClick={onStop}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Square className="w-4 h-4" />
          {isLoading ? 'Parando...' : 'Parar'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{session.energyKwh.toFixed(2)}</p>
          <p className="text-xs text-foreground-muted">kWh</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{session.durationMinutes}</p>
          <p className="text-xs text-foreground-muted">min</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{session.averagePowerKw.toFixed(1)}</p>
          <p className="text-xs text-foreground-muted">kW med</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{formatCurrency(session.cost)}</p>
          <p className="text-xs text-foreground-muted">Custo</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SESSION STATUS BADGE
// ============================================

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const statusColors: Record<SessionStatus, string> = {
    active: 'bg-warning-500/20 text-warning-500',
    completed: 'bg-success-500/20 text-success-500',
    failed: 'bg-danger-500/20 text-danger-500',
    cancelled: 'bg-foreground-subtle/20 text-foreground-subtle',
  };

  const statusLabels: Record<SessionStatus, string> = {
    active: 'Ativa',
    completed: 'Concluida',
    failed: 'Falha',
    cancelled: 'Cancelada',
  };

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[status])}>
      {statusLabels[status]}
    </span>
  );
}

// ============================================
// INFO ROW
// ============================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <dt className="text-foreground-muted text-sm">{label}</dt>
      <dd className="text-foreground font-medium text-sm truncate max-w-[60%]">{value}</dd>
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-32 animate-pulse" />
        ))}
      </div>
      <div className="bg-surface rounded-xl border border-border h-64 animate-pulse" />
    </div>
  );
}

// ============================================
// MOCK DATA
// ============================================

function getMockCharger(chargerId: string): EVCharger {
  return {
    id: chargerId,
    name: 'Carregador Estacionamento A1',
    model: 'ABB Terra 54',
    manufacturer: 'ABB',
    serialNumber: 'ABB-54-001',
    ocppVersion: '1.6',
    status: 'charging',
    connectors: [
      { id: 'conn-1', connectorId: 1, type: 'CCS2', maxPowerKw: 50, status: 'occupied', currentPowerKw: 45.5, meterValueKwh: 12.3, temperature: 42 },
      { id: 'conn-2', connectorId: 2, type: 'CHAdeMO', maxPowerKw: 50, status: 'available', meterValueKwh: 0 },
    ],
    location: { address: 'Av. Paulista, 1000', latitude: -23.5629, longitude: -46.6544 },
    lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
    firmwareVersion: '2.1.0',
    totalEnergyKwh: 15420,
    totalSessions: 1250,
    ocppEndpoint: 'wss://ocpp.lifo4.com/ocpp/ABB-54-001',
    chargePointVendor: 'ABB',
    chargePointModel: 'Terra 54',
    iccid: '8955123456789012345',
    imsi: '234567891234567',
    bootNotification: {
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      status: 'Accepted',
      interval: 300,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getMockActiveSessions(chargerId: string): ChargingSession[] {
  return [
    {
      id: 'session-active-001',
      chargerId,
      connectorId: 1,
      status: 'active',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      energyKwh: 12.3,
      durationMinutes: 60,
      cost: 18.45,
      tariffId: 'tariff-001',
      maxPowerKw: 50,
      averagePowerKw: 12.3,
      meterStart: 15407.7,
    },
  ];
}

function getMockRecentSessions(chargerId: string): ChargingSession[] {
  return [
    {
      id: 'session-001',
      chargerId,
      connectorId: 1,
      status: 'completed',
      startTime: new Date(Date.now() - 7200000).toISOString(),
      endTime: new Date(Date.now() - 3600000).toISOString(),
      energyKwh: 25.4,
      durationMinutes: 60,
      cost: 38.10,
      tariffId: 'tariff-001',
      maxPowerKw: 50,
      averagePowerKw: 25.4,
      stopReason: 'EVDisconnected',
      meterStart: 15382.3,
      meterEnd: 15407.7,
    },
    {
      id: 'session-002',
      chargerId,
      connectorId: 2,
      status: 'completed',
      startTime: new Date(Date.now() - 14400000).toISOString(),
      endTime: new Date(Date.now() - 10800000).toISOString(),
      energyKwh: 18.2,
      durationMinutes: 60,
      cost: 27.30,
      tariffId: 'tariff-001',
      maxPowerKw: 50,
      averagePowerKw: 18.2,
      stopReason: 'Local',
      meterStart: 15364.1,
      meterEnd: 15382.3,
    },
    {
      id: 'session-003',
      chargerId,
      connectorId: 1,
      status: 'failed',
      startTime: new Date(Date.now() - 86400000).toISOString(),
      endTime: new Date(Date.now() - 85800000).toISOString(),
      energyKwh: 0.5,
      durationMinutes: 10,
      cost: 0.75,
      tariffId: 'tariff-001',
      maxPowerKw: 50,
      averagePowerKw: 3.0,
      stopReason: 'PowerLoss',
      meterStart: 15363.6,
      meterEnd: 15364.1,
    },
  ];
}
