/**
 * Black Start Page
 * Emergency power management when grid fails
 * Handles automatic transfer, critical load management, and grid reconnection
 */

import { useState, useEffect } from 'react';
import {
  Zap,
  ZapOff,
  Power,
  PowerOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Battery,
  Home,
  Server,
  Lightbulb,
  RefreshCcw,
  Settings,
  Play,
  Square,
  History,
  ArrowRight,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { systemsApi } from '@/services/api';

// Black Start States
type BlackStartState = 'grid_connected' | 'grid_failure_detected' | 'transferring' | 'island_mode' | 'reconnecting' | 'synchronizing';

// Critical Load Types
interface CriticalLoad {
  id: string;
  name: string;
  icon: React.ElementType;
  power: number;
  priority: number;
  status: 'active' | 'shed' | 'standby';
  essential: boolean;
}

// Event Log Entry
interface EventLogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

// Generate mock frequency data
const generateFrequencyData = () => {
  const data = [];
  const now = Date.now();
  for (let i = 60; i >= 0; i--) {
    const isAnomaly = i >= 25 && i <= 35;
    data.push({
      time: new Date(now - i * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      frequency: isAnomaly ? 59.5 + Math.random() * 0.3 : 60 + (Math.random() * 0.1 - 0.05),
      voltage: isAnomaly ? 200 + Math.random() * 10 : 220 + (Math.random() * 4 - 2),
    });
  }
  return data;
};

// Mock critical loads
const initialCriticalLoads: CriticalLoad[] = [
  { id: 'load-1', name: 'Iluminacao de Emergencia', icon: Lightbulb, power: 2.5, priority: 1, status: 'active', essential: true },
  { id: 'load-2', name: 'Servidores TI', icon: Server, power: 8.0, priority: 2, status: 'active', essential: true },
  { id: 'load-3', name: 'Sistemas de Seguranca', icon: Shield, power: 1.5, priority: 3, status: 'active', essential: true },
  { id: 'load-4', name: 'Comunicacoes', icon: Radio, power: 0.8, priority: 4, status: 'active', essential: true },
  { id: 'load-5', name: 'HVAC Critico', icon: Activity, power: 15.0, priority: 5, status: 'active', essential: false },
  { id: 'load-6', name: 'Elevadores', icon: Home, power: 12.0, priority: 6, status: 'standby', essential: false },
];

// Mock event log
const initialEventLog: EventLogEntry[] = [
  { id: 'evt-1', timestamp: new Date(Date.now() - 3600000), type: 'info', message: 'Sistema Black Start inicializado' },
  { id: 'evt-2', timestamp: new Date(Date.now() - 3500000), type: 'success', message: 'Teste de transferencia automatica concluido com sucesso' },
  { id: 'evt-3', timestamp: new Date(Date.now() - 1800000), type: 'info', message: 'Verificacao de cargas criticas realizada' },
  { id: 'evt-4', timestamp: new Date(Date.now() - 900000), type: 'warning', message: 'Flutuacao de tensao detectada na rede (218V)' },
  { id: 'evt-5', timestamp: new Date(Date.now() - 300000), type: 'info', message: 'BESS em standby - SOC: 85%' },
];

export default function BlackStart() {
  const [blackStartState, setBlackStartState] = useState<BlackStartState>('grid_connected');
  const [frequencyData, setFrequencyData] = useState(generateFrequencyData());
  const [criticalLoads, setCriticalLoads] = useState<CriticalLoad[]>(initialCriticalLoads);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>(initialEventLog);
  const [bessSoc, setBessSoc] = useState(85);
  const [selectedSystem, setSelectedSystem] = useState('sys-demo-001');
  const [systems, setSystems] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [transferTime, setTransferTime] = useState(0);
  const [showConfig, setShowConfig] = useState(false);

  // Configuration
  const [config, setConfig] = useState({
    gridLossDetectionTime: 100, // ms
    transferTime: 10, // ms
    minSocForBlackStart: 20, // %
    autoReconnect: true,
    loadSheddingEnabled: true,
    frequencyDeadband: 0.5, // Hz
    voltageDeadband: 10, // V
  });

  // Fetch systems
  useEffect(() => {
    systemsApi.getAll().then((res) => {
      setSystems(res.data.data || []);
    }).catch(console.error);
  }, []);

  // Real-time frequency updates
  useEffect(() => {
    const interval = setInterval(() => {
      setFrequencyData(generateFrequencyData());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Add event to log
  const addEvent = (type: EventLogEntry['type'], message: string) => {
    const newEvent: EventLogEntry = {
      id: `evt-${Date.now()}`,
      timestamp: new Date(),
      type,
      message,
    };
    setEventLog((prev) => [newEvent, ...prev].slice(0, 50));
  };

  // Simulate grid failure
  const simulateGridFailure = async () => {
    setIsSimulating(true);
    addEvent('error', 'FALHA DE REDE DETECTADA - Tensao abaixo do limite');

    // Phase 1: Detection
    setBlackStartState('grid_failure_detected');
    await new Promise((r) => setTimeout(r, 1000));

    // Phase 2: Transfer
    setBlackStartState('transferring');
    addEvent('warning', 'Iniciando transferencia para modo ilha...');

    // Count transfer time
    const startTime = Date.now();
    const transferInterval = setInterval(() => {
      setTransferTime(Date.now() - startTime);
    }, 10);

    await new Promise((r) => setTimeout(r, 2000));
    clearInterval(transferInterval);
    setTransferTime(0);

    // Phase 3: Island Mode
    setBlackStartState('island_mode');
    addEvent('success', 'Transferencia concluida em 15ms - Operando em modo ilha');

    // Load shedding if needed
    if (config.loadSheddingEnabled && bessSoc < 50) {
      setCriticalLoads((prev) =>
        prev.map((load) =>
          !load.essential ? { ...load, status: 'shed' as const } : load
        )
      );
      addEvent('warning', 'Load shedding ativado - Cargas nao essenciais desligadas');
    }

    setIsSimulating(false);
  };

  // Simulate grid reconnection
  const simulateReconnection = async () => {
    setIsSimulating(true);
    addEvent('info', 'Rede eletrica restabelecida - Iniciando sincronizacao');

    // Phase 1: Synchronizing
    setBlackStartState('synchronizing');
    await new Promise((r) => setTimeout(r, 2000));

    // Phase 2: Reconnecting
    setBlackStartState('reconnecting');
    addEvent('info', 'Sincronizacao de frequencia concluida - Reconectando...');
    await new Promise((r) => setTimeout(r, 1500));

    // Phase 3: Connected
    setBlackStartState('grid_connected');
    addEvent('success', 'Reconexao com a rede concluida com sucesso');

    // Restore loads
    setCriticalLoads((prev) =>
      prev.map((load) => ({ ...load, status: 'active' as const }))
    );

    setIsSimulating(false);
  };

  // Manual test
  const runTransferTest = async () => {
    addEvent('info', 'Iniciando teste de transferencia automatica...');
    await simulateGridFailure();
    await new Promise((r) => setTimeout(r, 3000));
    await simulateReconnection();
    addEvent('success', 'Teste de transferencia concluido com sucesso');
  };

  // Get state info
  const getStateInfo = () => {
    switch (blackStartState) {
      case 'grid_connected':
        return { label: 'Conectado a Rede', color: 'green', icon: Zap };
      case 'grid_failure_detected':
        return { label: 'Falha Detectada!', color: 'red', icon: ZapOff };
      case 'transferring':
        return { label: 'Transferindo...', color: 'yellow', icon: RefreshCcw };
      case 'island_mode':
        return { label: 'Modo Ilha', color: 'orange', icon: Shield };
      case 'reconnecting':
        return { label: 'Reconectando...', color: 'blue', icon: RefreshCcw };
      case 'synchronizing':
        return { label: 'Sincronizando...', color: 'purple', icon: Activity };
    }
  };

  const stateInfo = getStateInfo();
  const StateIcon = stateInfo.icon;
  const totalLoadPower = criticalLoads.filter((l) => l.status === 'active').reduce((sum, l) => sum + l.power, 0);
  const availablePower = (bessSoc / 100) * 100; // Assuming 100kWh capacity

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" />
            Black Start
          </h1>
          <p className="text-foreground-muted mt-1">
            Sistema de partida de emergencia e gestao de cargas criticas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground"
          >
            {systems.map((sys) => (
              <option key={sys.id} value={sys.id}>{sys.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Main Status Banner */}
      <div className={cn(
        'p-6 rounded-lg border-2 transition-all',
        blackStartState === 'grid_connected' && 'bg-green-500/10 border-green-500',
        blackStartState === 'grid_failure_detected' && 'bg-red-500/10 border-red-500 animate-pulse',
        blackStartState === 'transferring' && 'bg-yellow-500/10 border-yellow-500',
        blackStartState === 'island_mode' && 'bg-orange-500/10 border-orange-500',
        blackStartState === 'reconnecting' && 'bg-blue-500/10 border-blue-500',
        blackStartState === 'synchronizing' && 'bg-purple-500/10 border-purple-500',
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'p-4 rounded-full',
              `bg-${stateInfo.color}-500/20`
            )}>
              <StateIcon className={cn(
                'w-10 h-10',
                `text-${stateInfo.color}-400`,
                (blackStartState === 'transferring' || blackStartState === 'reconnecting' || blackStartState === 'synchronizing') && 'animate-spin'
              )} />
            </div>
            <div>
              <h2 className={cn('text-2xl font-bold', `text-${stateInfo.color}-400`)}>
                {stateInfo.label}
              </h2>
              <p className="text-foreground-muted">
                {blackStartState === 'grid_connected' && 'Sistema operando normalmente conectado a rede eletrica'}
                {blackStartState === 'grid_failure_detected' && 'Falha na rede detectada - Preparando transferencia'}
                {blackStartState === 'transferring' && `Transferindo para modo ilha... ${transferTime}ms`}
                {blackStartState === 'island_mode' && 'Operando em modo autonomo - Cargas criticas ativas'}
                {blackStartState === 'reconnecting' && 'Reconectando com a rede eletrica'}
                {blackStartState === 'synchronizing' && 'Sincronizando frequencia e fase com a rede'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {blackStartState === 'grid_connected' && (
              <button
                onClick={simulateGridFailure}
                disabled={isSimulating}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
              >
                <ZapOff className="w-4 h-4" />
                Simular Falha
              </button>
            )}
            {blackStartState === 'island_mode' && (
              <button
                onClick={simulateReconnection}
                disabled={isSimulating}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                Reconectar
              </button>
            )}
            <button
              onClick={runTransferTest}
              disabled={isSimulating || blackStartState !== 'grid_connected'}
              className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Teste de Transferencia
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Battery className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">BESS SOC</p>
              <p className="text-xl font-bold text-foreground">{bessSoc}%</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Carga Ativa</p>
              <p className="text-xl font-bold text-foreground">{totalLoadPower.toFixed(1)} kW</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Autonomia</p>
              <p className="text-xl font-bold text-foreground">
                {totalLoadPower > 0 ? (availablePower / totalLoadPower).toFixed(1) : '∞'} h
              </p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              blackStartState === 'grid_connected' ? 'bg-green-500/20' : 'bg-orange-500/20'
            )}>
              {blackStartState === 'grid_connected' ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-orange-400" />
              )}
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Rede</p>
              <p className={cn(
                'text-xl font-bold',
                blackStartState === 'grid_connected' ? 'text-green-400' : 'text-orange-400'
              )}>
                {blackStartState === 'grid_connected' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Frequency & Voltage Chart */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Monitoramento de Rede (Tempo Real)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={frequencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                <YAxis
                  yAxisId="freq"
                  domain={[59, 61]}
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  label={{ value: 'Hz', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <YAxis
                  yAxisId="volt"
                  orientation="right"
                  domain={[200, 240]}
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  label={{ value: 'V', angle: 90, position: 'insideRight', fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#F9FAFB' }}
                />
                <ReferenceLine yAxisId="freq" y={60} stroke="#10B981" strokeDasharray="3 3" label={{ value: '60Hz', fill: '#10B981' }} />
                <ReferenceLine yAxisId="freq" y={59.5} stroke="#EF4444" strokeDasharray="3 3" />
                <ReferenceLine yAxisId="freq" y={60.5} stroke="#EF4444" strokeDasharray="3 3" />
                <Line
                  yAxisId="freq"
                  type="monotone"
                  dataKey="frequency"
                  name="Frequencia"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="volt"
                  type="monotone"
                  dataKey="voltage"
                  name="Tensao"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-foreground-muted">Frequencia (Hz)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span className="text-foreground-muted">Tensao (V)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500" style={{ width: '12px' }} />
              <span className="text-foreground-muted">Limites</span>
            </div>
          </div>
        </div>

        {/* Critical Loads */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Cargas Criticas
          </h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {criticalLoads.map((load) => {
              const LoadIcon = load.icon;
              return (
                <div
                  key={load.id}
                  className={cn(
                    'p-3 rounded-lg border transition-all',
                    load.status === 'active' && 'bg-green-500/10 border-green-500/30',
                    load.status === 'shed' && 'bg-red-500/10 border-red-500/30',
                    load.status === 'standby' && 'bg-gray-500/10 border-gray-500/30',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <LoadIcon className={cn(
                        'w-5 h-5',
                        load.status === 'active' && 'text-green-400',
                        load.status === 'shed' && 'text-red-400',
                        load.status === 'standby' && 'text-gray-400',
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{load.name}</p>
                        <p className="text-xs text-foreground-muted">
                          {load.power} kW | Prioridade {load.priority}
                          {load.essential && ' | Essencial'}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      load.status === 'active' && 'bg-green-500/20 text-green-400',
                      load.status === 'shed' && 'bg-red-500/20 text-red-400',
                      load.status === 'standby' && 'bg-gray-500/20 text-gray-400',
                    )}>
                      {load.status === 'active' && 'Ativo'}
                      {load.status === 'shed' && 'Desligado'}
                      {load.status === 'standby' && 'Standby'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transfer Sequence Diagram */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <RefreshCcw className="w-5 h-5 text-primary" />
          Sequencia de Transferencia
        </h3>
        <div className="flex items-center justify-between px-8 py-6">
          {[
            { step: 1, label: 'Rede Normal', icon: Zap, state: 'grid_connected' },
            { step: 2, label: 'Falha Detectada', icon: AlertTriangle, state: 'grid_failure_detected' },
            { step: 3, label: 'Transferencia', icon: RefreshCcw, state: 'transferring' },
            { step: 4, label: 'Modo Ilha', icon: Shield, state: 'island_mode' },
            { step: 5, label: 'Sincronizacao', icon: Activity, state: 'synchronizing' },
            { step: 6, label: 'Reconexao', icon: CheckCircle, state: 'grid_connected' },
          ].map((item, index, arr) => {
            const StepIcon = item.icon;
            const isActive = blackStartState === item.state ||
              (index === 0 && blackStartState === 'grid_connected') ||
              (index === 5 && blackStartState === 'reconnecting');
            const isPast = ['grid_connected'].includes(blackStartState) ? index === 0 :
              ['grid_failure_detected'].includes(blackStartState) ? index <= 1 :
              ['transferring'].includes(blackStartState) ? index <= 2 :
              ['island_mode'].includes(blackStartState) ? index <= 3 :
              ['synchronizing'].includes(blackStartState) ? index <= 4 :
              ['reconnecting'].includes(blackStartState) ? index <= 5 : false;

            return (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                    isActive && 'bg-primary text-white ring-4 ring-primary/30',
                    isPast && !isActive && 'bg-green-500 text-white',
                    !isPast && !isActive && 'bg-surface-hover text-foreground-muted',
                  )}>
                    <StepIcon className="w-6 h-6" />
                  </div>
                  <span className={cn(
                    'text-xs mt-2 text-center',
                    isActive ? 'text-primary font-medium' : 'text-foreground-muted'
                  )}>
                    {item.label}
                  </span>
                </div>
                {index < arr.length - 1 && (
                  <ArrowRight className={cn(
                    'w-6 h-6 mx-4',
                    isPast ? 'text-green-500' : 'text-foreground-muted'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Log & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Log */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Log de Eventos
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eventLog.map((event) => (
              <div
                key={event.id}
                className={cn(
                  'p-3 rounded-lg border text-sm',
                  event.type === 'info' && 'bg-blue-500/10 border-blue-500/30',
                  event.type === 'success' && 'bg-green-500/10 border-green-500/30',
                  event.type === 'warning' && 'bg-yellow-500/10 border-yellow-500/30',
                  event.type === 'error' && 'bg-red-500/10 border-red-500/30',
                )}
              >
                <div className="flex items-start gap-2">
                  {event.type === 'info' && <Activity className="w-4 h-4 text-blue-400 mt-0.5" />}
                  {event.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />}
                  {event.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />}
                  {event.type === 'error' && <ZapOff className="w-4 h-4 text-red-400 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-foreground">{event.message}</p>
                    <p className="text-xs text-foreground-muted mt-1">
                      {event.timestamp.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configuracoes
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-foreground-muted">Tempo Deteccao (ms)</label>
                <input
                  type="number"
                  value={config.gridLossDetectionTime}
                  onChange={(e) => setConfig({ ...config, gridLossDetectionTime: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="text-sm text-foreground-muted">Tempo Transferencia (ms)</label>
                <input
                  type="number"
                  value={config.transferTime}
                  onChange={(e) => setConfig({ ...config, transferTime: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="text-sm text-foreground-muted">SOC Minimo (%)</label>
                <input
                  type="number"
                  value={config.minSocForBlackStart}
                  onChange={(e) => setConfig({ ...config, minSocForBlackStart: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="text-sm text-foreground-muted">Deadband Freq (Hz)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.frequencyDeadband}
                  onChange={(e) => setConfig({ ...config, frequencyDeadband: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-foreground">Reconexao Automatica</span>
              <button
                onClick={() => setConfig({ ...config, autoReconnect: !config.autoReconnect })}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors',
                  config.autoReconnect ? 'bg-primary' : 'bg-gray-600'
                )}
              >
                <div className={cn(
                  'w-5 h-5 bg-white rounded-full transition-transform',
                  config.autoReconnect ? 'translate-x-6' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-foreground">Load Shedding</span>
              <button
                onClick={() => setConfig({ ...config, loadSheddingEnabled: !config.loadSheddingEnabled })}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors',
                  config.loadSheddingEnabled ? 'bg-primary' : 'bg-gray-600'
                )}
              >
                <div className={cn(
                  'w-5 h-5 bg-white rounded-full transition-transform',
                  config.loadSheddingEnabled ? 'translate-x-6' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
