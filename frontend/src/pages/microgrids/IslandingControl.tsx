/**
 * Islanding Control Page
 * Manages microgrid islanding operations, black start procedures,
 * and grid reconnection with seamless transfer capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  ZapOff,
  Power,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Play,
  Pause,
  Square,
  Activity,
  Battery,
  Sun,
  Wind,
  Factory,
  Home,
  ArrowRight,
  Settings,
  History,
  Radio,
  Wifi,
  WifiOff,
  Loader2,
  TrendingUp,
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
import { blackStartApi, systemsApi, controlApi } from '@/services/api';

// Types
type OperatingMode = 'grid_connected' | 'transitioning_to_island' | 'islanded' | 'black_start' | 'transitioning_to_grid' | 'synchronizing';

interface GridParameters {
  voltage: number;
  frequency: number;
  phaseAngle: number;
  isStable: boolean;
}

interface MicrogridParameters {
  voltage: number;
  frequency: number;
  phaseAngle: number;
  activePower: number;
  reactivePower: number;
  isStable: boolean;
}

interface CriticalLoad {
  id: string;
  name: string;
  power: number;
  priority: number;
  status: 'active' | 'shed' | 'pending';
  isEssential: boolean;
}

interface DERStatus {
  id: string;
  name: string;
  type: 'bess' | 'solar' | 'wind' | 'generator';
  status: 'online' | 'offline' | 'starting' | 'stopping';
  power: number;
  available: boolean;
}

interface TransferEvent {
  id: string;
  timestamp: Date;
  type: 'grid_loss' | 'island_transition' | 'grid_restore' | 'black_start' | 'load_shed' | 'der_start' | 'sync_complete';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

// Mock data generators
const generateFrequencyHistory = () => {
  const data = [];
  const now = Date.now();
  for (let i = 59; i >= 0; i--) {
    const time = new Date(now - i * 1000);
    const anomaly = i >= 30 && i <= 40;
    data.push({
      time: time.toLocaleTimeString('pt-BR', { second: '2-digit' }),
      gridFreq: anomaly ? null : 60 + (Math.random() - 0.5) * 0.05,
      mgFreq: 60 + (Math.random() - 0.5) * (anomaly ? 0.3 : 0.08),
    });
  }
  return data;
};

const initialDERs: DERStatus[] = [
  { id: 'bess-001', name: 'BESS Principal', type: 'bess', status: 'online', power: 50, available: true },
  { id: 'solar-001', name: 'Usina Solar', type: 'solar', status: 'online', power: 85, available: true },
  { id: 'wind-001', name: 'Turbina Eolica', type: 'wind', status: 'online', power: 32, available: true },
  { id: 'gen-001', name: 'Gerador Diesel', type: 'generator', status: 'offline', power: 0, available: true },
];

const initialLoads: CriticalLoad[] = [
  { id: 'load-1', name: 'Iluminacao Emergencia', power: 5, priority: 1, status: 'active', isEssential: true },
  { id: 'load-2', name: 'Seguranca/CFTV', power: 8, priority: 2, status: 'active', isEssential: true },
  { id: 'load-3', name: 'Servidores TI', power: 25, priority: 3, status: 'active', isEssential: true },
  { id: 'load-4', name: 'Comunicacoes', power: 3, priority: 4, status: 'active', isEssential: true },
  { id: 'load-5', name: 'HVAC Critico', power: 30, priority: 5, status: 'active', isEssential: false },
  { id: 'load-6', name: 'Producao Linha 1', power: 45, priority: 6, status: 'active', isEssential: false },
  { id: 'load-7', name: 'Producao Linha 2', power: 40, priority: 7, status: 'active', isEssential: false },
  { id: 'load-8', name: 'Iluminacao Geral', power: 15, priority: 8, status: 'active', isEssential: false },
];

const MODE_INFO = {
  grid_connected: {
    label: 'Conectado a Rede',
    color: 'green',
    icon: Zap,
    description: 'Sistema operando normalmente conectado a rede eletrica',
  },
  transitioning_to_island: {
    label: 'Transicao para Ilha',
    color: 'yellow',
    icon: Loader2,
    description: 'Desconectando da rede e estabilizando microgrid',
  },
  islanded: {
    label: 'Modo Ilha',
    color: 'orange',
    icon: Shield,
    description: 'Operando de forma autonoma, desconectado da rede',
  },
  black_start: {
    label: 'Black Start',
    color: 'red',
    icon: Power,
    description: 'Iniciando sistema a partir de condicao desenergizada',
  },
  transitioning_to_grid: {
    label: 'Reconectando',
    color: 'blue',
    icon: Loader2,
    description: 'Sincronizando e reconectando com a rede eletrica',
  },
  synchronizing: {
    label: 'Sincronizando',
    color: 'purple',
    icon: Activity,
    description: 'Ajustando frequencia e fase para sincronismo',
  },
};

export default function IslandingControl() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('grid_connected');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transferTime, setTransferTime] = useState(0);

  const [gridParams, setGridParams] = useState<GridParameters>({
    voltage: 220.5,
    frequency: 60.02,
    phaseAngle: 0,
    isStable: true,
  });

  const [mgParams, setMgParams] = useState<MicrogridParameters>({
    voltage: 220.3,
    frequency: 60.01,
    phaseAngle: 2.5,
    activePower: 150,
    reactivePower: 25,
    isStable: true,
  });

  const [ders, setDers] = useState<DERStatus[]>(initialDERs);
  const [loads, setLoads] = useState<CriticalLoad[]>(initialLoads);
  const [frequencyHistory, setFrequencyHistory] = useState(generateFrequencyHistory());
  const [events, setEvents] = useState<TransferEvent[]>([]);

  // Configuration
  const [config, setConfig] = useState({
    gridLossDetectionMs: 100,
    transferTimeMs: 15,
    minSocForIsland: 30,
    autoReconnect: true,
    loadSheddingEnabled: true,
    frequencyDeadband: 0.5,
    voltageDeadband: 10,
    syncWindow: { freq: 0.1, voltage: 5, phase: 10 },
  });

  // Initialize
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        addEvent('info', 'Sistema de controle de ilhamento inicializado');
      } catch (err) {
        setError('Falha ao inicializar sistema de ilhamento');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setFrequencyHistory(generateFrequencyHistory());

      if (operatingMode === 'grid_connected') {
        setGridParams(prev => ({
          ...prev,
          voltage: 220 + (Math.random() - 0.5) * 2,
          frequency: 60 + (Math.random() - 0.5) * 0.05,
        }));
      }

      setMgParams(prev => ({
        ...prev,
        voltage: 220 + (Math.random() - 0.5) * 3,
        frequency: 60 + (Math.random() - 0.5) * (operatingMode === 'islanded' ? 0.15 : 0.05),
        activePower: 150 + (Math.random() - 0.5) * 20,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [operatingMode]);

  const addEvent = useCallback((severity: TransferEvent['severity'], message: string, type: TransferEvent['type'] = 'info' as TransferEvent['type']) => {
    const newEvent: TransferEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date(),
      type,
      message,
      severity,
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 100));
  }, []);

  // Simulate grid failure
  const simulateGridFailure = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    addEvent('error', 'FALHA DE REDE DETECTADA - Tensao abaixo do limite', 'grid_loss');
    setOperatingMode('transitioning_to_island');

    // Count transfer time
    const startTime = Date.now();
    const transferInterval = setInterval(() => {
      setTransferTime(Date.now() - startTime);
    }, 1);

    // Simulate transfer sequence
    await new Promise(r => setTimeout(r, 500));
    addEvent('warning', 'Abrindo disjuntor de interconexao...', 'island_transition');

    await new Promise(r => setTimeout(r, 500));
    addEvent('info', 'BESS assumindo controle V/f...', 'island_transition');

    await new Promise(r => setTimeout(r, 500));
    clearInterval(transferInterval);
    setTransferTime(0);

    // Check if load shedding needed
    const totalGeneration = ders.filter(d => d.status === 'online').reduce((sum, d) => sum + d.power, 0);
    const totalLoad = loads.filter(l => l.status === 'active').reduce((sum, l) => sum + l.power, 0);

    if (config.loadSheddingEnabled && totalGeneration < totalLoad) {
      addEvent('warning', 'Iniciando load shedding...', 'load_shed');

      // Shed non-essential loads by priority (highest priority first)
      const sortedLoads = [...loads].filter(l => !l.isEssential).sort((a, b) => b.priority - a.priority);
      let loadToShed = totalLoad - totalGeneration + 10; // Add margin

      for (const load of sortedLoads) {
        if (loadToShed > 0 && load.status === 'active') {
          setLoads(prev => prev.map(l =>
            l.id === load.id ? { ...l, status: 'shed' } : l
          ));
          addEvent('warning', `Carga desconectada: ${load.name} (${load.power} kW)`, 'load_shed');
          loadToShed -= load.power;
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }

    // Start backup generator if needed
    const bessSoc = 65; // Mock SOC
    if (bessSoc < 50) {
      addEvent('info', 'Iniciando gerador de backup...', 'der_start');
      setDers(prev => prev.map(d =>
        d.type === 'generator' ? { ...d, status: 'starting' } : d
      ));
      await new Promise(r => setTimeout(r, 2000));
      setDers(prev => prev.map(d =>
        d.type === 'generator' ? { ...d, status: 'online', power: 80 } : d
      ));
      addEvent('success', 'Gerador de backup online', 'der_start');
    }

    setOperatingMode('islanded');
    addEvent('success', 'Transferencia concluida - Operando em modo ilha', 'island_transition');
    setIsTransitioning(false);
  };

  // Simulate grid restore and reconnection
  const initiateReconnection = async () => {
    if (isTransitioning || operatingMode !== 'islanded') return;
    setIsTransitioning(true);

    addEvent('info', 'Rede eletrica detectada - Iniciando processo de reconexao', 'grid_restore');
    setOperatingMode('synchronizing');

    // Synchronization process
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const freqDiff = Math.abs(gridParams.frequency - mgParams.frequency);
      const voltDiff = Math.abs(gridParams.voltage - mgParams.voltage);
      addEvent('info', `Sincronizando... Freq: ${freqDiff.toFixed(3)}Hz, V: ${voltDiff.toFixed(1)}V`, 'sync_complete');
    }

    setOperatingMode('transitioning_to_grid');
    addEvent('info', 'Sincronismo alcancado - Fechando disjuntor...', 'sync_complete');

    await new Promise(r => setTimeout(r, 1000));

    // Restore shed loads
    const shedLoads = loads.filter(l => l.status === 'shed');
    for (const load of shedLoads.sort((a, b) => a.priority - b.priority)) {
      setLoads(prev => prev.map(l =>
        l.id === load.id ? { ...l, status: 'active' } : l
      ));
      addEvent('info', `Carga restaurada: ${load.name}`, 'grid_restore');
      await new Promise(r => setTimeout(r, 300));
    }

    // Stop generator if running
    const runningGen = ders.find(d => d.type === 'generator' && d.status === 'online');
    if (runningGen) {
      setDers(prev => prev.map(d =>
        d.type === 'generator' ? { ...d, status: 'stopping' } : d
      ));
      await new Promise(r => setTimeout(r, 1000));
      setDers(prev => prev.map(d =>
        d.type === 'generator' ? { ...d, status: 'offline', power: 0 } : d
      ));
      addEvent('info', 'Gerador de backup desligado', 'der_start');
    }

    setOperatingMode('grid_connected');
    addEvent('success', 'Reconexao concluida - Sistema conectado a rede', 'grid_restore');
    setIsTransitioning(false);
  };

  // Black start procedure
  const initiateBlackStart = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    addEvent('warning', 'Iniciando procedimento de Black Start...', 'black_start');
    setOperatingMode('black_start');

    // All DERs offline initially
    setDers(prev => prev.map(d => ({ ...d, status: 'offline', power: 0 })));
    setLoads(prev => prev.map(l => ({ ...l, status: 'shed' })));

    // Start BESS first (grid forming)
    await new Promise(r => setTimeout(r, 1000));
    addEvent('info', 'Energizando BESS (grid forming)...', 'black_start');
    setDers(prev => prev.map(d =>
      d.type === 'bess' ? { ...d, status: 'starting' } : d
    ));

    await new Promise(r => setTimeout(r, 2000));
    setDers(prev => prev.map(d =>
      d.type === 'bess' ? { ...d, status: 'online', power: 20 } : d
    ));
    addEvent('success', 'BESS online - Tensao e frequencia estabelecidas', 'black_start');

    // Energize essential loads
    const essentialLoads = loads.filter(l => l.isEssential).sort((a, b) => a.priority - b.priority);
    for (const load of essentialLoads) {
      await new Promise(r => setTimeout(r, 500));
      setLoads(prev => prev.map(l =>
        l.id === load.id ? { ...l, status: 'active' } : l
      ));
      addEvent('info', `Carga essencial energizada: ${load.name}`, 'black_start');
    }

    // Start solar/wind if available
    await new Promise(r => setTimeout(r, 1000));
    addEvent('info', 'Conectando fontes renovaveis...', 'black_start');
    setDers(prev => prev.map(d =>
      (d.type === 'solar' || d.type === 'wind') && d.available
        ? { ...d, status: 'online', power: d.type === 'solar' ? 60 : 25 }
        : d
    ));

    // Transition to islanded mode
    await new Promise(r => setTimeout(r, 1000));
    setOperatingMode('islanded');
    addEvent('success', 'Black Start concluido - Sistema operando em modo ilha', 'black_start');
    setIsTransitioning(false);
  };

  // Manual load control
  const toggleLoadShedding = (loadId: string) => {
    setLoads(prev => prev.map(load => {
      if (load.id === loadId && !load.isEssential) {
        const newStatus = load.status === 'active' ? 'shed' : 'active';
        addEvent(
          newStatus === 'shed' ? 'warning' : 'info',
          `Carga ${newStatus === 'shed' ? 'desconectada' : 'restaurada'}: ${load.name}`
        );
        return { ...load, status: newStatus };
      }
      return load;
    }));
  };

  const modeInfo = MODE_INFO[operatingMode];
  const ModeIcon = modeInfo.icon;

  const totalGeneration = ders.filter(d => d.status === 'online').reduce((sum, d) => sum + d.power, 0);
  const totalLoad = loads.filter(l => l.status === 'active').reduce((sum, l) => sum + l.power, 0);
  const powerBalance = totalGeneration - totalLoad;

  if (isLoading) {
    return <IslandingControlSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="w-12 h-12 text-danger-500 mb-4" />
        <p className="text-foreground-muted">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" />
            Controle de Ilhamento
          </h1>
          <p className="text-foreground-muted mt-1">
            Gestao de transicao ilha/rede e black start
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFrequencyHistory(generateFrequencyHistory())}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover">
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Operating Mode Banner */}
      <div className={cn(
        'p-6 rounded-xl border-2 transition-all',
        `bg-${modeInfo.color}-500/10 border-${modeInfo.color}-500`,
        isTransitioning && 'animate-pulse'
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full bg-${modeInfo.color}-500/20`}>
              <ModeIcon className={cn(
                `w-10 h-10 text-${modeInfo.color}-400`,
                isTransitioning && 'animate-spin'
              )} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold text-${modeInfo.color}-400`}>
                {modeInfo.label}
              </h2>
              <p className="text-foreground-muted">{modeInfo.description}</p>
              {transferTime > 0 && (
                <p className="text-sm text-yellow-400 mt-1">
                  Tempo de transferencia: {transferTime}ms
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {operatingMode === 'grid_connected' && (
              <>
                <button
                  onClick={simulateGridFailure}
                  disabled={isTransitioning}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                >
                  <ZapOff className="w-4 h-4" />
                  Simular Falha
                </button>
                <button
                  onClick={initiateBlackStart}
                  disabled={isTransitioning}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 disabled:opacity-50"
                >
                  <Power className="w-4 h-4" />
                  Black Start
                </button>
              </>
            )}
            {operatingMode === 'islanded' && (
              <button
                onClick={initiateReconnection}
                disabled={isTransitioning}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                Reconectar a Rede
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-foreground-muted text-sm">Freq. Microgrid</span>
          </div>
          <div className={cn(
            'text-2xl font-bold',
            Math.abs(mgParams.frequency - 60) > 0.2 ? 'text-orange-400' : 'text-foreground'
          )}>
            {mgParams.frequency.toFixed(2)} Hz
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-foreground-muted text-sm">Tensao</span>
          </div>
          <div className={cn(
            'text-2xl font-bold',
            Math.abs(mgParams.voltage - 220) > 10 ? 'text-orange-400' : 'text-foreground'
          )}>
            {mgParams.voltage.toFixed(1)} V
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-foreground-muted text-sm">Geracao</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{totalGeneration.toFixed(0)} kW</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-5 h-5 text-purple-400" />
            <span className="text-foreground-muted text-sm">Carga</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalLoad.toFixed(0)} kW</div>
          <div className={cn(
            'text-xs mt-1',
            powerBalance >= 0 ? 'text-green-400' : 'text-orange-400'
          )}>
            Balanco: {powerBalance >= 0 ? '+' : ''}{powerBalance.toFixed(0)} kW
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Frequency Monitoring */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Monitoramento de Frequencia
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={frequencyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                <YAxis domain={[59.5, 60.5]} stroke="var(--foreground-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | null) => value ? [`${value.toFixed(3)} Hz`] : ['N/A']}
                />
                <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="3 3" label="60Hz" />
                <ReferenceLine y={59.7} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine y={60.3} stroke="#ef4444" strokeDasharray="3 3" />
                {operatingMode === 'grid_connected' && (
                  <Line
                    type="monotone"
                    dataKey="gridFreq"
                    name="Rede"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="mgFreq"
                  name="Microgrid"
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
              <span className="text-foreground-muted">Rede</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span className="text-foreground-muted">Microgrid</span>
            </div>
          </div>
        </div>

        {/* DER Status */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recursos Energeticos</h3>
          <div className="space-y-3">
            {ders.map((der) => {
              const icons = { bess: Battery, solar: Sun, wind: Wind, generator: Factory };
              const Icon = icons[der.type];
              return (
                <div
                  key={der.id}
                  className={cn(
                    'p-3 rounded-lg border transition-all',
                    der.status === 'online' ? 'bg-green-500/10 border-green-500/30' :
                    der.status === 'starting' || der.status === 'stopping' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-gray-500/10 border-gray-500/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={cn(
                        'w-5 h-5',
                        der.status === 'online' ? 'text-green-400' :
                        der.status === 'starting' || der.status === 'stopping' ? 'text-yellow-400' :
                        'text-gray-400'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{der.name}</p>
                        <p className={cn(
                          'text-xs',
                          der.status === 'online' ? 'text-green-400' :
                          der.status === 'starting' ? 'text-yellow-400' :
                          'text-gray-400'
                        )}>
                          {der.status === 'online' ? 'Online' :
                           der.status === 'starting' ? 'Iniciando...' :
                           der.status === 'stopping' ? 'Parando...' : 'Offline'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{der.power} kW</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Load Management and Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Loads */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Gestao de Cargas
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loads.sort((a, b) => a.priority - b.priority).map((load) => (
              <div
                key={load.id}
                className={cn(
                  'p-3 rounded-lg border transition-all',
                  load.status === 'active' ? 'bg-green-500/10 border-green-500/30' :
                  load.status === 'shed' ? 'bg-orange-500/10 border-orange-500/30' :
                  'bg-blue-500/10 border-blue-500/30'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-medium">
                      {load.priority}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        {load.name}
                        {load.isEssential && (
                          <Shield className="w-3 h-3 text-blue-400" />
                        )}
                      </p>
                      <p className="text-xs text-foreground-muted">{load.power} kW</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      load.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      load.status === 'shed' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-blue-500/20 text-blue-400'
                    )}>
                      {load.status === 'active' ? 'Ativo' : load.status === 'shed' ? 'Desligado' : 'Pendente'}
                    </span>
                    {!load.isEssential && (
                      <button
                        onClick={() => toggleLoadShedding(load.id)}
                        className={cn(
                          'px-2 py-1 text-xs rounded transition-colors',
                          load.status === 'active'
                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        )}
                      >
                        {load.status === 'active' ? 'Cortar' : 'Restaurar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Log de Eventos
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-center text-foreground-muted py-8">Nenhum evento registrado</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'p-3 rounded-lg border text-sm',
                    event.severity === 'info' && 'bg-blue-500/10 border-blue-500/30',
                    event.severity === 'success' && 'bg-green-500/10 border-green-500/30',
                    event.severity === 'warning' && 'bg-yellow-500/10 border-yellow-500/30',
                    event.severity === 'error' && 'bg-red-500/10 border-red-500/30',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {event.severity === 'info' && <Activity className="w-4 h-4 text-blue-400 mt-0.5" />}
                    {event.severity === 'success' && <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />}
                    {event.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />}
                    {event.severity === 'error' && <ZapOff className="w-4 h-4 text-red-400 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-foreground">{event.message}</p>
                      <p className="text-xs text-foreground-muted mt-1">
                        {event.timestamp.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transfer Sequence Diagram */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Sequencia de Transferencia</h3>
        <div className="flex items-center justify-between px-4 py-6 overflow-x-auto">
          {[
            { step: 1, label: 'Rede Normal', mode: 'grid_connected' },
            { step: 2, label: 'Falha Detectada', mode: 'transitioning_to_island' },
            { step: 3, label: 'Modo Ilha', mode: 'islanded' },
            { step: 4, label: 'Sincronizacao', mode: 'synchronizing' },
            { step: 5, label: 'Reconexao', mode: 'transitioning_to_grid' },
            { step: 6, label: 'Conectado', mode: 'grid_connected' },
          ].map((item, index, arr) => {
            const isActive = operatingMode === item.mode;
            const isPast = (() => {
              const modeOrder = ['grid_connected', 'transitioning_to_island', 'islanded', 'synchronizing', 'transitioning_to_grid'];
              const currentIndex = modeOrder.indexOf(operatingMode);
              const itemIndex = modeOrder.indexOf(item.mode as OperatingMode);
              return itemIndex < currentIndex;
            })();

            return (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all text-sm font-medium',
                    isActive && 'bg-primary text-white ring-4 ring-primary/30',
                    isPast && !isActive && 'bg-green-500 text-white',
                    !isPast && !isActive && 'bg-surface-hover text-foreground-muted',
                  )}>
                    {item.step}
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
                    'w-5 h-5 mx-2 flex-shrink-0',
                    isPast ? 'text-green-500' : 'text-foreground-muted'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function IslandingControlSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      <div className="h-40 bg-surface rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border h-80 animate-pulse" />
        <div className="bg-surface rounded-xl border border-border h-80 animate-pulse" />
      </div>
    </div>
  );
}
