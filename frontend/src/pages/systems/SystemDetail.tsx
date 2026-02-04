import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Battery,
  ArrowLeft,
  RefreshCw,
  Zap,
  Thermometer,
  Activity,
  Settings,
  Sliders,
  Play,
  Square,
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Calendar,
  Server,
  Microscope,
  Gamepad2,
} from 'lucide-react';
import {
  cn,
  formatPercent,
  formatPower,
  formatVoltage,
  formatCurrent,
  formatTemperature,
  formatRelativeTime,
  getOperationModeLabel,
} from '@/lib/utils';
import { systemsApi, telemetryApi, controlApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { BessSystem, TelemetryData, CellData } from '@/types';

export default function SystemDetail() {
  const { systemId } = useParams<{ systemId: string }>();
  const [system, setSystem] = useState<BessSystem | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCells, setShowCells] = useState(true);
  const [controlLoading, setControlLoading] = useState<string | null>(null);

  // Fetch system data
  const fetchData = async () => {
    if (!systemId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [systemRes, telemetryRes] = await Promise.all([
        systemsApi.getById(systemId),
        telemetryApi.getCurrent(systemId).catch(() => null),
      ]);

      setSystem(systemRes.data.data || null);
      setTelemetry(telemetryRes?.data.data || null);
    } catch (err) {
      setError('Falha ao carregar dados do sistema');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [systemId]);

  // Auto-refresh polling (every 1 second)
  useEffect(() => {
    if (!systemId) return;

    const interval = setInterval(async () => {
      try {
        const [systemRes, telemetryRes] = await Promise.all([
          systemsApi.getById(systemId),
          telemetryApi.getCurrent(systemId).catch(() => null),
        ]);
        setSystem(systemRes.data.data || null);
        setTelemetry(telemetryRes?.data.data || null);
      } catch (err) {
        // Silent fail on auto-refresh
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [systemId]);

  // Real-time updates via WebSocket (fallback)
  useEffect(() => {
    if (!systemId) return;

    socketService.subscribeToSystem(systemId);

    const unsubscribe = socketService.onTelemetryUpdate((data) => {
      if (data.systemId === systemId) {
        setTelemetry(data);
      }
    });

    return () => {
      socketService.unsubscribeFromSystem(systemId);
      unsubscribe();
    };
  }, [systemId]);

  // Control functions
  const handleStartCharge = async () => {
    if (!systemId) return;
    console.log('[Control] Starting charge for:', systemId);
    setControlLoading('charge');
    try {
      const res = await controlApi.startCharge(systemId);
      console.log('[Control] Charge started:', res.data);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Failed to start charge:', err);
    } finally {
      setControlLoading(null);
    }
  };

  const handleStopCharge = async () => {
    if (!systemId) return;
    console.log('[Control] Stopping charge for:', systemId);
    setControlLoading('stopCharge');
    try {
      const res = await controlApi.stopCharge(systemId);
      console.log('[Control] Charge stopped:', res.data);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Failed to stop charge:', err);
    } finally {
      setControlLoading(null);
    }
  };

  const handleStartDischarge = async () => {
    if (!systemId) return;
    console.log('[Control] Starting discharge for:', systemId);
    setControlLoading('discharge');
    try {
      const res = await controlApi.startDischarge(systemId);
      console.log('[Control] Discharge started:', res.data);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Failed to start discharge:', err);
    } finally {
      setControlLoading(null);
    }
  };

  const handleStopDischarge = async () => {
    if (!systemId) return;
    console.log('[Control] Stopping discharge for:', systemId);
    setControlLoading('stopDischarge');
    try {
      const res = await controlApi.stopDischarge(systemId);
      console.log('[Control] Discharge stopped:', res.data);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Failed to stop discharge:', err);
    } finally {
      setControlLoading(null);
    }
  };

  const handleEmergencyStop = async () => {
    if (!systemId) return;
    if (!confirm('Tem certeza que deseja executar a parada de emergência?')) return;
    setControlLoading('emergency');
    try {
      await controlApi.emergencyStop(systemId, 'User initiated emergency stop');
    } catch (err) {
      console.error('Failed to emergency stop:', err);
    } finally {
      setControlLoading(null);
    }
  };

  const handleConnect = async () => {
    if (!systemId) return;
    setControlLoading('connect');
    try {
      await controlApi.connect(systemId);
      fetchData(); // Refresh data after connect
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setControlLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (!systemId) return;
    if (!confirm('Tem certeza que deseja desconectar o sistema?')) return;
    setControlLoading('disconnect');
    try {
      await controlApi.disconnect(systemId);
      fetchData(); // Refresh data after disconnect
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setControlLoading(null);
    }
  };

  if (isLoading) {
    return <SystemDetailSkeleton />;
  }

  if (error || !system) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Sistema não encontrado'}
        </h2>
        <Link
          to="/systems"
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para sistemas
        </Link>
      </div>
    );
  }

  const isOnline = system.connectionStatus === 'online';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/systems"
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{system.name}</h1>
              <span
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full',
                  isOnline
                    ? 'bg-success-500/20 text-success-500'
                    : 'bg-foreground-subtle/20 text-foreground-subtle'
                )}
              >
                {isOnline ? (
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Offline
                  </span>
                )}
              </span>
            </div>
            <p className="text-foreground-muted text-sm">
              {system.model} • Serial: {system.serialNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5 text-foreground-muted" />
          </button>
          <Link
            to={`/analytics?systemId=${systemId}`}
            className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            title="Ver gráficos históricos"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Analytics</span>
          </Link>
          <Link
            to={`/systems/${systemId}/schedules`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Agendamentos"
          >
            <Calendar className="w-5 h-5 text-foreground-muted" />
          </Link>
          <Link
            to={`/systems/${systemId}/bms-config`}
            className="flex items-center gap-2 px-3 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors"
            title="Configuracao BMS"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">BMS Config</span>
          </Link>
          <Link
            to={`/systems/${systemId}/hardware`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Hardware Modbus"
          >
            <Server className="w-5 h-5 text-foreground-muted" />
          </Link>
          <Link
            to={`/systems/${systemId}/diagnostics`}
            className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
            title="Diagnostico de Bateria"
          >
            <Microscope className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Diagnostico</span>
          </Link>
          <Link
            to={`/systems/${systemId}/control`}
            className="flex items-center gap-2 px-3 py-2 bg-success-500/10 hover:bg-success-500/20 text-success-500 rounded-lg transition-colors"
            title="Painel de Controle"
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Controle</span>
          </Link>
          <Link
            to={`/systems/${systemId}/settings`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Configuracoes de Protecao"
          >
            <Settings className="w-5 h-5 text-foreground-muted" />
          </Link>
        </div>
      </div>

      {/* Connection Control - Always visible */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-foreground">Status de Conexão</h3>
            <span className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full',
              isOnline ? 'bg-success-500/20 text-success-500' : 'bg-red-500/20 text-red-400'
            )}>
              {isOnline ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <div className="flex gap-2">
            {isOnline ? (
              <button
                onClick={handleDisconnect}
                disabled={controlLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <WifiOff className="w-4 h-4" />
                {controlLoading === 'disconnect' ? 'Desconectando...' : 'Desconectar'}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={controlLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Wifi className="w-4 h-4" />
                {controlLoading === 'connect' ? 'Conectando...' : 'Conectar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alarm Banner */}
      {telemetry && telemetry.alarms && telemetry.alarms.length > 0 && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="font-bold text-red-500">ALARMES ATIVOS</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {telemetry.alarms.map((alarm: string) => (
                  <span key={alarm} className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium uppercase">
                    {alarm === 'overvoltage' && '⚡ Sobretensão'}
                    {alarm === 'undervoltage' && '⚡ Subtensão'}
                    {alarm === 'overcurrent' && '🔌 Sobrecorrente'}
                    {alarm === 'overtemp' && '🌡️ Sobretemperatura'}
                    {alarm === 'undertemp' && '❄️ Subtemperatura'}
                    {alarm === 'cellImbalance' && '⚖️ Desbalanceamento'}
                    {alarm === 'shortCircuit' && '💥 Curto-Circuito'}
                    {alarm === 'mosfetOvertemp' && '🔥 MOSFET Superaquecido'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats */}
      {telemetry && isOnline ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* SOC */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-foreground-muted text-sm">Estado de Carga</span>
                <Battery className="w-5 h-5 text-primary" />
              </div>
              <div className="relative w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, telemetry.soc || 0))}%`,
                    backgroundColor: telemetry.soc > 20 ? '#10b981' : '#ef4444'
                  }}
                />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatPercent(telemetry.soc, 1)}
              </p>
            </div>

            {/* Power */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-foreground-muted text-sm">Potência</span>
                <Zap
                  className={cn(
                    'w-5 h-5',
                    telemetry.isCharging
                      ? 'text-success-500'
                      : telemetry.isDischarging
                      ? 'text-warning-500'
                      : 'text-foreground-muted'
                  )}
                />
              </div>
              <p
                className={cn(
                  'text-3xl font-bold',
                  telemetry.isCharging
                    ? 'text-success-500'
                    : telemetry.isDischarging
                    ? 'text-warning-500'
                    : 'text-foreground'
                )}
              >
                {formatPower(telemetry.power)}
              </p>
              <p className="text-sm text-foreground-muted">
                {telemetry.isCharging ? 'Carregando' : telemetry.isDischarging ? 'Descarregando' : 'Ocioso'}
              </p>
            </div>

            {/* Voltage */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-foreground-muted text-sm">Tensão Total</span>
                <Activity className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatVoltage(telemetry.totalVoltage)}
              </p>
              <p className="text-sm text-foreground-muted">
                {formatCurrent(telemetry.current)} corrente
              </p>
            </div>

            {/* Temperature */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-foreground-muted text-sm">Temperatura</span>
                <Thermometer
                  className={cn(
                    'w-5 h-5',
                    telemetry.temperature.max > 45
                      ? 'text-danger-500'
                      : telemetry.temperature.max > 35
                      ? 'text-warning-500'
                      : 'text-success-500'
                  )}
                />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatTemperature(telemetry.temperature.average)}
              </p>
              <p className="text-sm text-foreground-muted">
                Min: {formatTemperature(telemetry.temperature.min)} / Max:{' '}
                {formatTemperature(telemetry.temperature.max)}
              </p>
            </div>
          </div>

          {/* Control Panel */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Controle</h3>
              <div className="flex gap-2">
                {isOnline ? (
                  <button
                    onClick={handleDisconnect}
                    disabled={controlLoading !== null}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    <WifiOff className="w-4 h-4" />
                    {controlLoading === 'disconnect' ? 'Desconectando...' : 'Desconectar'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={controlLoading !== null}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Wifi className="w-4 h-4" />
                    {controlLoading === 'connect' ? 'Conectando...' : 'Conectar'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStartCharge}
                disabled={controlLoading !== null || telemetry.isCharging}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  telemetry.isCharging
                    ? 'bg-success-500/20 text-success-500 cursor-not-allowed'
                    : 'bg-success-500 hover:bg-success-600 text-white'
                )}
              >
                <Play className="w-4 h-4" />
                {controlLoading === 'charge' ? 'Iniciando...' : 'Iniciar Carga'}
              </button>

              <button
                onClick={handleStopCharge}
                disabled={controlLoading !== null || !telemetry.isCharging}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Square className="w-4 h-4" />
                {controlLoading === 'stopCharge' ? 'Parando...' : 'Parar Carga'}
              </button>

              <button
                onClick={handleStartDischarge}
                disabled={controlLoading !== null || telemetry.isDischarging}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  telemetry.isDischarging
                    ? 'bg-warning-500/20 text-warning-500 cursor-not-allowed'
                    : 'bg-warning-500 hover:bg-warning-600 text-white'
                )}
              >
                <Zap className="w-4 h-4" />
                {controlLoading === 'discharge' ? 'Iniciando...' : 'Iniciar Descarga'}
              </button>

              <button
                onClick={handleStopDischarge}
                disabled={controlLoading !== null || !telemetry.isDischarging}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Square className="w-4 h-4" />
                {controlLoading === 'stopDischarge' ? 'Parando...' : 'Parar Descarga'}
              </button>

              <button
                onClick={handleEmergencyStop}
                disabled={controlLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white rounded-lg font-medium transition-colors ml-auto"
              >
                <AlertTriangle className="w-4 h-4" />
                {controlLoading === 'emergency' ? 'Parando...' : 'Parada de Emergência'}
              </button>
            </div>
          </div>

          {/* Cells Grid */}
          <div className="bg-surface rounded-xl border border-border">
            <button
              onClick={() => setShowCells(!showCells)}
              className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-colors rounded-t-xl"
            >
              <h3 className="font-semibold text-foreground">
                Células ({telemetry.cells?.length || 0})
              </h3>
              {showCells ? (
                <ChevronUp className="w-5 h-5 text-foreground-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-foreground-muted" />
              )}
            </button>
            {showCells && telemetry.cells && (
              <div className="p-4 pt-0">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {telemetry.cells.map((cell, index) => (
                    <CellCard key={index} cell={cell} index={index} />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-success-500" />
                    <span className="text-foreground-muted">Normal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-warning-500" />
                    <span className="text-foreground-muted">Atenção</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-danger-500" />
                    <span className="text-foreground-muted">Crítico</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-secondary" />
                    <span className="text-foreground-muted">Balanceando</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* System Info */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4">Informações do Sistema</h3>
              <dl className="space-y-3">
                <InfoRow label="Fabricante" value={system.manufacturer} />
                <InfoRow label="Modelo" value={system.model} />
                <InfoRow label="Serial" value={system.serialNumber} />
                <InfoRow label="Firmware" value={system.firmwareVersion || 'N/A'} />
                <InfoRow label="Device ID" value={system.deviceId} />
                <InfoRow
                  label="Modo de Operação"
                  value={getOperationModeLabel(system.operationMode || 'auto')}
                />
              </dl>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4">Especificações da Bateria</h3>
              <dl className="space-y-3">
                <InfoRow label="Química" value={system.batterySpec.chemistry} />
                <InfoRow
                  label="Capacidade"
                  value={`${system.batterySpec.nominalCapacity}Ah / ${system.batterySpec.energyCapacity}kWh`}
                />
                <InfoRow label="Tensão Nominal" value={`${system.batterySpec.nominalVoltage}V`} />
                <InfoRow label="Células" value={`${system.batterySpec.cellCount}S${system.batterySpec.cellsInParallel}P`} />
                <InfoRow
                  label="Corrente Máx Carga"
                  value={`${system.batterySpec.maxChargeCurrent}A`}
                />
                <InfoRow
                  label="Corrente Máx Descarga"
                  value={`${system.batterySpec.maxDischargeCurrent}A`}
                />
              </dl>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <p className="text-foreground-muted text-sm mb-1">SOH</p>
              <p className="text-2xl font-bold text-foreground">{formatPercent(telemetry.soh, 1)}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <p className="text-foreground-muted text-sm mb-1">Ciclos</p>
              <p className="text-2xl font-bold text-foreground">{telemetry.cycleCount}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <p className="text-foreground-muted text-sm mb-1">Energia Restante</p>
              <p className="text-2xl font-bold text-foreground">
                {telemetry.energyRemaining.toFixed(2)} kWh
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <p className="text-foreground-muted text-sm mb-1">Cap. de Carga</p>
              <p className="text-2xl font-bold text-foreground">
                {telemetry.chargeCapacity.toFixed(1)} Ah
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <WifiOff className="w-16 h-16 mx-auto mb-4 text-foreground-subtle" />
          <h3 className="text-lg font-medium text-foreground mb-2">Sistema Offline</h3>
          <p className="text-foreground-muted">
            Não foi possível obter dados de telemetria. Verifique a conexão do dispositivo.
          </p>
          {system.lastCommunication && (
            <p className="text-sm text-foreground-subtle mt-2">
              Última comunicação: {formatRelativeTime(system.lastCommunication)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Cell Card
function CellCard({ cell, index }: { cell: CellData; index: number }) {
  const statusColor = {
    normal: 'bg-success-500/20 border-success-500/30',
    attention: 'bg-warning-500/20 border-warning-500/30',
    critical: 'bg-danger-500/20 border-danger-500/30',
    unknown: 'bg-surface-hover border-border',
  };

  return (
    <div
      className={cn(
        'rounded-lg p-2 text-center border transition-all',
        cell.isBalancing ? 'bg-secondary/20 border-secondary/30' : statusColor[cell.status]
      )}
    >
      <p className="text-2xs text-foreground-muted mb-0.5">C{index + 1}</p>
      <p className="text-sm font-semibold text-foreground">{cell.voltage.toFixed(3)}V</p>
      {cell.isBalancing && <Zap className="w-3 h-3 mx-auto mt-1 text-secondary" />}
    </div>
  );
}

// Info Row
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <dt className="text-foreground-muted text-sm">{label}</dt>
      <dd className="text-foreground font-medium text-sm">{value}</dd>
    </div>
  );
}

// Loading Skeleton
function SystemDetailSkeleton() {
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
