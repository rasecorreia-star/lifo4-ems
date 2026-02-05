import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Battery,
  AlertTriangle,
  Flame,
  Zap,
  Droplets,
  WifiOff,
  Activity,
  Thermometer,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  Server,
  Cpu,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Radio,
  Gauge,
  CircuitBoard,
  Snowflake,
  Info,
  Play,
  Pause,
  Command,
  Download,
  Upload,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface BESSUnit {
  id: string;
  name: string;
  location: string;
  coordinates: { lat: number; lng: number };
  capacityMWh: number;
  powerMW: number;
  soc: number;
  soh: number;
  status: 'online' | 'offline' | 'warning' | 'critical';
  temperature: number;
  deltaV: number;
  impedance: number;
  latencyMs: number;
  hvacConsumption: number;
  energyDispatched: number;
  cyclesUsed: number;
  cyclesGuaranteed: number;
  firmwareVersion: string;
  edgeAutonomyHours: number;
  lastHeartbeat: Date;
  alarms: Alarm[];
}

interface Alarm {
  id: string;
  timestamp: Date;
  type: 'fire' | 'arc' | 'flood' | 'overvoltage' | 'communication' | 'temperature' | 'soc' | 'deltaV' | 'impedance';
  severity: 1 | 2 | 3; // 1 = Critical (Life/Asset), 2 = High, 3 = Medium
  source: 'PCS' | 'BMS' | 'HVAC' | 'Gateway';
  message: string;
  suppressed?: boolean;
}

interface SOEEvent {
  id: string;
  bessId: string;
  timestamp: Date;
  milliseconds: number;
  source: 'PCS' | 'BMS' | 'Gateway' | 'Breaker';
  event: string;
  rootCause?: boolean;
}

// Simulated data
const generateBESSUnits = (): BESSUnit[] => {
  const locations = [
    { name: 'BESS Teresina Centro', location: 'Teresina, PI', lat: -5.0892, lng: -42.8016 },
    { name: 'BESS Parnaíba Industrial', location: 'Parnaíba, PI', lat: -2.9055, lng: -41.7769 },
    { name: 'BESS Floriano Solar', location: 'Floriano, PI', lat: -6.7670, lng: -43.0222 },
    { name: 'BESS Picos Comercial', location: 'Picos, PI', lat: -7.0769, lng: -41.4669 },
    { name: 'BESS Piripiri Norte', location: 'Piripiri, PI', lat: -4.2728, lng: -41.7768 },
    { name: 'BESS Oeiras Agro', location: 'Oeiras, PI', lat: -7.0244, lng: -42.1311 },
    { name: 'BESS Campo Maior', location: 'Campo Maior, PI', lat: -4.8269, lng: -42.1689 },
    { name: 'BESS Barras', location: 'Barras, PI', lat: -4.2444, lng: -42.2942 },
  ];

  return locations.map((loc, i) => {
    const isOffline = i === 2; // Floriano offline
    const isCritical = i === 3; // Picos critical
    const isWarning = i === 4; // Piripiri warning

    const alarms: Alarm[] = [];

    if (isCritical) {
      alarms.push({
        id: `alarm-${i}-1`,
        timestamp: new Date(Date.now() - 120000),
        type: 'overvoltage',
        severity: 1,
        source: 'BMS',
        message: 'Sobretensão detectada no rack 3 - Célula 47',
      });
    }

    if (isOffline) {
      alarms.push({
        id: `alarm-${i}-2`,
        timestamp: new Date(Date.now() - 300000),
        type: 'communication',
        severity: 1,
        source: 'Gateway',
        message: 'Site Offline - Falha de Telemetria',
        suppressed: false,
      });
    }

    if (isWarning) {
      alarms.push({
        id: `alarm-${i}-3`,
        timestamp: new Date(Date.now() - 60000),
        type: 'deltaV',
        severity: 2,
        source: 'BMS',
        message: 'Desbalanceamento de tensão - ΔV = 85mV',
      });
    }

    return {
      id: `bess-${i + 1}`,
      name: loc.name,
      location: loc.location,
      coordinates: { lat: loc.lat, lng: loc.lng },
      capacityMWh: 2 + Math.random() * 3,
      powerMW: 1 + Math.random() * 2,
      soc: isOffline ? 0 : 20 + Math.random() * 70,
      soh: 85 + Math.random() * 12,
      status: isOffline ? 'offline' : isCritical ? 'critical' : isWarning ? 'warning' : 'online',
      temperature: isOffline ? 0 : 25 + Math.random() * 15,
      deltaV: isWarning ? 85 : 10 + Math.random() * 30,
      impedance: 0.8 + Math.random() * 0.4,
      latencyMs: isOffline ? 9999 : i === 4 ? 520 : 15 + Math.random() * 50,
      hvacConsumption: 8 + Math.random() * 10,
      energyDispatched: 50 + Math.random() * 150,
      cyclesUsed: 500 + Math.floor(Math.random() * 1000),
      cyclesGuaranteed: 6000,
      firmwareVersion: i < 5 ? 'v2.4.1' : 'v2.3.8',
      edgeAutonomyHours: 4 + Math.floor(Math.random() * 8),
      lastHeartbeat: new Date(Date.now() - (isOffline ? 300000 : Math.random() * 3000)),
      alarms,
    };
  });
};

const generateSOEEvents = (): SOEEvent[] => {
  return [
    { id: 'soe-1', bessId: 'bess-3', timestamp: new Date(Date.now() - 300000), milliseconds: 0, source: 'Gateway', event: 'Heartbeat timeout', rootCause: true },
    { id: 'soe-2', bessId: 'bess-3', timestamp: new Date(Date.now() - 299950), milliseconds: 50, source: 'BMS', event: 'Communication lost' },
    { id: 'soe-3', bessId: 'bess-3', timestamp: new Date(Date.now() - 299900), milliseconds: 100, source: 'PCS', event: 'Grid disconnect' },
    { id: 'soe-4', bessId: 'bess-4', timestamp: new Date(Date.now() - 120000), milliseconds: 0, source: 'BMS', event: 'Cell overvoltage detected', rootCause: true },
    { id: 'soe-5', bessId: 'bess-4', timestamp: new Date(Date.now() - 119980), milliseconds: 20, source: 'BMS', event: 'Rack protection activated' },
    { id: 'soe-6', bessId: 'bess-4', timestamp: new Date(Date.now() - 119950), milliseconds: 50, source: 'PCS', event: 'Power reduction commanded' },
  ];
};

// InfoTooltip Component
function InfoTooltip({ title, description }: { title: string; description: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 280),
      });
    }
    setIsVisible(true);
  };

  return (
    <>
      <div ref={iconRef} onMouseEnter={handleMouseEnter} onMouseLeave={() => setIsVisible(false)} className="cursor-help">
        <Info className="w-3.5 h-3.5 text-white/70 hover:text-white transition-colors" />
      </div>
      {isVisible && (
        <div className="fixed z-[9999] w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl" style={{ top: position.top, left: position.left }}>
          <h4 className="font-semibold text-white text-sm mb-1">{title}</h4>
          <p className="text-xs text-gray-300">{description}</p>
        </div>
      )}
    </>
  );
}

// Main Dashboard 2 Component
export default function Dashboard2() {
  const [bessUnits, setBessUnits] = useState<BESSUnit[]>([]);
  const [soeEvents, setSoeEvents] = useState<SOEEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showOnlyExceptions, setShowOnlyExceptions] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [deltaVThreshold, setDeltaVThreshold] = useState(50); // mV
  const [showSOE, setShowSOE] = useState(false);
  const [globalCommand, setGlobalCommand] = useState<string | null>(null);

  // Simulate WebSocket/SSE data updates
  useEffect(() => {
    const loadData = () => {
      setBessUnits(generateBESSUnits());
      setSoeEvents(generateSOEEvents());
      setLastUpdate(new Date());
      setIsLoading(false);
    };

    loadData();

    // Simulate real-time updates via delta changes only
    const interval = setInterval(() => {
      setBessUnits(prev => prev.map(unit => {
        if (unit.status === 'offline') return unit;
        return {
          ...unit,
          soc: Math.max(10, Math.min(95, unit.soc + (Math.random() - 0.5) * 2)),
          temperature: Math.max(20, Math.min(45, unit.temperature + (Math.random() - 0.5) * 0.5)),
          latencyMs: Math.max(10, Math.min(100, unit.latencyMs + (Math.random() - 0.5) * 10)),
          lastHeartbeat: new Date(),
        };
      }));
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Aggregated Fleet Stats
  const fleetStats = useMemo(() => {
    const onlineUnits = bessUnits.filter(u => u.status !== 'offline');
    const totalCapacity = bessUnits.reduce((sum, u) => sum + u.capacityMWh, 0);
    const availablePower = onlineUnits.reduce((sum, u) => sum + u.powerMW, 0);
    const availability = bessUnits.length > 0 ? (onlineUnits.length / bessUnits.length) * 100 : 0;
    const avgSoH = onlineUnits.length > 0 ? onlineUnits.reduce((sum, u) => sum + u.soh, 0) / onlineUnits.length : 0;
    const criticalAlarms = bessUnits.reduce((sum, u) => sum + u.alarms.filter(a => a.severity === 1).length, 0);

    return { totalCapacity, availablePower, availability, avgSoH, criticalAlarms, total: bessUnits.length, online: onlineUnits.length };
  }, [bessUnits]);

  // Filter units by exception (only show problematic ones)
  const filteredUnits = useMemo(() => {
    let units = bessUnits;

    if (showOnlyExceptions) {
      units = units.filter(u => u.status !== 'online' || u.alarms.length > 0 || u.deltaV > deltaVThreshold || u.temperature > 35 || u.latencyMs > 500);
    }

    // Sort by severity: Critical > Offline > Warning > Online
    units = [...units].sort((a, b) => {
      const severityOrder = { critical: 0, offline: 1, warning: 2, online: 3 };
      return severityOrder[a.status] - severityOrder[b.status];
    });

    return units;
  }, [bessUnits, showOnlyExceptions, deltaVThreshold]);

  // Severity 1 Alarms (Life/Asset Safety)
  const severity1Alarms = useMemo(() => {
    return bessUnits.flatMap(unit =>
      unit.alarms
        .filter(a => a.severity === 1 && !a.suppressed)
        .map(a => ({ ...a, bessName: unit.name, bessId: unit.id }))
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [bessUnits]);

  // Calculate cycle cost and Go/No-Go
  const calculateCycleCost = useCallback((unit: BESSUnit) => {
    const capex = 150000; // R$ per MWh (example)
    const dod = 0.8; // Depth of Discharge
    const baseCycleCost = capex / (unit.cyclesGuaranteed * dod);
    const tempPenalty = unit.temperature > 35 ? 1.2 : 1.0;
    return baseCycleCost * tempPenalty;
  }, []);

  const calculateArbitrageDecision = useCallback((unit: BESSUnit) => {
    const cycleCost = calculateCycleCost(unit);
    const estimatedProfit = 45; // R$/MWh (example market price)
    const isGoDecision = estimatedProfit > cycleCost;
    const preservationMode = !isGoDecision;

    return {
      cycleCost: cycleCost.toFixed(2),
      estimatedProfit,
      isGoDecision,
      preservationMode,
      reason: preservationMode ? 'Custo de ciclo > Lucro estimado' : 'Arbitragem viável',
    };
  }, [calculateCycleCost]);

  // Fleet Load Balancing Suggestion
  const loadBalancingSuggestion = useMemo(() => {
    const onlineUnits = bessUnits.filter(u => u.status === 'online');
    if (onlineUnits.length < 2) return null;

    const sorted = [...onlineUnits].sort((a, b) => {
      const scoreA = a.cyclesUsed + (a.temperature > 30 ? 100 : 0);
      const scoreB = b.cyclesUsed + (b.temperature > 30 ? 100 : 0);
      return scoreA - scoreB;
    });

    const recommended = sorted[0];
    const avoid = sorted[sorted.length - 1];

    if (recommended.id !== avoid.id) {
      return {
        recommended,
        avoid,
        reason: `${recommended.name} tem menos ciclos (${recommended.cyclesUsed}) e temperatura menor (${recommended.temperature.toFixed(1)}°C)`,
      };
    }
    return null;
  }, [bessUnits]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Avançado de Frota</h1>
          <p className="text-foreground-muted text-sm">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')} • WebSocket Ativo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnlyExceptions(!showOnlyExceptions)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showOnlyExceptions ? 'bg-amber-500 text-white' : 'bg-surface border border-border'
            )}
          >
            {showOnlyExceptions ? 'Gestão por Exceção' : 'Todos os Sistemas'}
          </button>
          <button
            onClick={() => setShowSOE(!showSOE)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showSOE ? 'bg-primary text-white' : 'bg-surface border border-border'
            )}
          >
            SOE Log
          </button>
        </div>
      </div>

      {/* Severity 1 Alarms Banner */}
      {severity1Alarms.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-4 border-2 border-red-400 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">ALARMES DE SEVERIDADE 1 - SEGURANÇA</h3>
              <div className="mt-2 space-y-1">
                {severity1Alarms.map(alarm => (
                  <div key={alarm.id} className="flex items-center gap-2 text-white/90 text-sm">
                    {alarm.type === 'fire' && <Flame className="w-4 h-4" />}
                    {alarm.type === 'arc' && <Zap className="w-4 h-4" />}
                    {alarm.type === 'flood' && <Droplets className="w-4 h-4" />}
                    {alarm.type === 'overvoltage' && <AlertTriangle className="w-4 h-4" />}
                    {alarm.type === 'communication' && <WifiOff className="w-4 h-4" />}
                    <span className="font-medium">{alarm.bessName}:</span>
                    <span>{alarm.message}</span>
                    <span className="text-white/60 text-xs ml-auto">{alarm.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aggregated Fleet Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <FleetStatCard
          title="Capacidade Total"
          value={fleetStats.totalCapacity.toFixed(1)}
          unit="MWh"
          icon={Battery}
          color="blue"
          tooltip="Soma da capacidade de armazenamento de todos os BESS da frota."
        />
        <FleetStatCard
          title="Potência Disponível"
          value={fleetStats.availablePower.toFixed(1)}
          unit="MW"
          icon={Zap}
          color="emerald"
          tooltip="Potência total disponível para despacho dos sistemas online."
        />
        <FleetStatCard
          title="Disponibilidade"
          value={fleetStats.availability.toFixed(0)}
          unit="%"
          icon={Activity}
          color={fleetStats.availability >= 90 ? 'emerald' : fleetStats.availability >= 70 ? 'amber' : 'red'}
          tooltip="Percentual de sistemas online vs total da frota."
        />
        <FleetStatCard
          title="SoH Médio"
          value={fleetStats.avgSoH.toFixed(0)}
          unit="%"
          icon={Shield}
          color={fleetStats.avgSoH >= 85 ? 'emerald' : fleetStats.avgSoH >= 70 ? 'amber' : 'red'}
          tooltip="State of Health médio da frota. Calculado via Coulomb Counting + Kalman Filter."
        />
        <FleetStatCard
          title="Alarmes Críticos"
          value={fleetStats.criticalAlarms}
          icon={AlertTriangle}
          color={fleetStats.criticalAlarms > 0 ? 'red' : 'emerald'}
          tooltip="Alarmes de Severidade 1 (Incêndio, Arco, Inundação, Sobretensão)."
        />
        <FleetStatCard
          title="Online"
          value={fleetStats.online}
          total={fleetStats.total}
          icon={Server}
          color="cyan"
          tooltip="Sistemas com heartbeat ativo nos últimos 5 minutos."
        />
        <FleetStatCard
          title="Threshold ΔV"
          value={deltaVThreshold}
          unit="mV"
          icon={Gauge}
          color="violet"
          tooltip="Limite configurável para alerta de desbalanceamento de tensão."
          editable
          onEdit={setDeltaVThreshold}
        />
      </div>

      {/* Global Commands Panel */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Command className="w-4 h-4" />
            Comandos Globais / Grupo
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGlobalCommand('conservation')}
            className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
          >
            Modo Conservação - Região Norte
          </button>
          <button
            onClick={() => setGlobalCommand('peak-shaving')}
            className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
          >
            Peak Shaving - Todos
          </button>
          <button
            onClick={() => setGlobalCommand('firmware')}
            className="px-3 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-colors flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            Firmware OTA - v2.4.2
          </button>
          <button
            onClick={() => setGlobalCommand('export')}
            className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Exportar Relatório SoH (PDF)
          </button>
        </div>
        {globalCommand && (
          <div className="mt-3 p-2 bg-primary/20 rounded-lg text-sm text-primary">
            Comando "{globalCommand}" enviado para a frota. Aguardando confirmação...
          </div>
        )}
      </div>

      {/* Load Balancing Suggestion */}
      {loadBalancingSuggestion && (
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <div>
              <h4 className="font-medium text-foreground">Sugestão de Balanceamento de Carga</h4>
              <p className="text-sm text-foreground-muted mt-1">
                Priorize <span className="text-emerald-400 font-medium">{loadBalancingSuggestion.recommended.name}</span> ao invés de{' '}
                <span className="text-amber-400 font-medium">{loadBalancingSuggestion.avoid.name}</span>.{' '}
                {loadBalancingSuggestion.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* BESS Units List */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold text-foreground">
            {showOnlyExceptions ? 'Sistemas com Exceções' : 'Todos os Sistemas'} ({filteredUnits.length})
          </h3>

          {filteredUnits.length === 0 ? (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-400 font-medium">Todos os sistemas operando normalmente</p>
            </div>
          ) : (
            filteredUnits.map(unit => (
              <BESSCard
                key={unit.id}
                unit={unit}
                deltaVThreshold={deltaVThreshold}
                calculateArbitrage={calculateArbitrageDecision}
              />
            ))
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Heartbeat Monitor */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Heartbeat Monitor
            </h3>
            <div className="space-y-2">
              {bessUnits.map(unit => (
                <div key={unit.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                  <span className={cn(
                    'font-mono',
                    unit.latencyMs > 1000 ? 'text-red-500' : unit.latencyMs > 500 ? 'text-amber-500' : 'text-emerald-500'
                  )}>
                    {unit.latencyMs > 5000 ? 'OFFLINE' : `${unit.latencyMs.toFixed(0)}ms`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Firmware Status */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Firmware Management
            </h3>
            <div className="space-y-2">
              {Object.entries(
                bessUnits.reduce((acc, u) => {
                  acc[u.firmwareVersion] = (acc[u.firmwareVersion] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([version, count]) => (
                <div key={version} className="flex items-center justify-between text-sm">
                  <span className={cn(
                    'font-mono',
                    version === 'v2.4.1' ? 'text-emerald-500' : 'text-amber-500'
                  )}>
                    {version}
                  </span>
                  <span className="text-foreground-muted">{count} sistemas</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-foreground-muted mt-2">Última versão: v2.4.2</p>
          </div>

          {/* Edge Autonomy */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Autonomia Offline (Edge)
            </h3>
            <div className="space-y-2">
              {bessUnits.filter(u => u.status !== 'offline').slice(0, 5).map(unit => (
                <div key={unit.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                  <span className="text-cyan-400">{unit.edgeAutonomyHours}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* SOE Log */}
          {showSOE && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Sequência de Eventos (SOE)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {soeEvents.map(event => (
                  <div key={event.id} className={cn(
                    'p-2 rounded text-xs',
                    event.rootCause ? 'bg-red-500/20 border border-red-500/30' : 'bg-surface-hover'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'font-medium',
                        event.rootCause ? 'text-red-400' : 'text-foreground'
                      )}>
                        {event.rootCause && '🎯 '}{event.source}
                      </span>
                      <span className="text-foreground-muted font-mono">+{event.milliseconds}ms</span>
                    </div>
                    <p className="text-foreground-muted mt-1">{event.event}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Mapa de Calor Georreferenciado
        </h3>
        <div className="relative h-64 bg-surface-hover rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
            Mapa interativo com Leaflet/Mapbox
          </div>
          {/* Simulated map markers */}
          {bessUnits.map((unit, i) => (
            <div
              key={unit.id}
              className={cn(
                'absolute w-4 h-4 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2',
                unit.status === 'online' ? 'bg-emerald-500' :
                unit.status === 'warning' ? 'bg-amber-500' :
                unit.status === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
              )}
              style={{
                left: `${15 + (i % 4) * 20}%`,
                top: `${20 + Math.floor(i / 4) * 40}%`,
              }}
              title={unit.name}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Online</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500" /> Alerta</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /> Crítico</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-500" /> Offline</div>
        </div>
      </div>
    </div>
  );
}

// Fleet Stat Card
interface FleetStatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  total?: number;
  icon: React.ElementType;
  color: string;
  tooltip: string;
  editable?: boolean;
  onEdit?: (value: number) => void;
}

function FleetStatCard({ title, value, unit, total, icon: Icon, color, tooltip, editable, onEdit }: FleetStatCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 via-blue-600 to-blue-800 border-blue-300/50 shadow-blue-500/30',
    emerald: 'from-emerald-500 via-emerald-600 to-emerald-800 border-emerald-300/50 shadow-emerald-500/30',
    amber: 'from-amber-500 via-amber-600 to-amber-800 border-amber-300/50 shadow-amber-500/30',
    red: 'from-red-500 via-red-600 to-red-800 border-red-300/50 shadow-red-500/30',
    cyan: 'from-cyan-500 via-cyan-600 to-cyan-800 border-cyan-300/50 shadow-cyan-500/30',
    violet: 'from-violet-500 via-violet-600 to-violet-800 border-violet-300/50 shadow-violet-500/30',
  };

  return (
    <div className={cn(
      'relative rounded-lg p-2 bg-gradient-to-b border shadow-md overflow-hidden',
      colorClasses[color]
    )}>
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg" />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <div className="p-1 rounded bg-white/20">
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <InfoTooltip title={title} description={tooltip} />
        </div>
        <p className="text-lg font-bold text-white drop-shadow-md">
          {value}
          {unit && <span className="text-xs font-normal ml-0.5">{unit}</span>}
          {total !== undefined && <span className="text-white/70 font-normal text-sm">/{total}</span>}
        </p>
        <p className="text-2xs text-white/80 truncate">{title}</p>
      </div>
    </div>
  );
}

// BESS Card Component
interface BESSCardProps {
  unit: BESSUnit;
  deltaVThreshold: number;
  calculateArbitrage: (unit: BESSUnit) => {
    cycleCost: string;
    estimatedProfit: number;
    isGoDecision: boolean;
    preservationMode: boolean;
    reason: string;
  };
}

function BESSCard({ unit, deltaVThreshold, calculateArbitrage }: BESSCardProps) {
  const [expanded, setExpanded] = useState(false);
  const arbitrage = calculateArbitrage(unit);
  const hvacEfficiency = (unit.hvacConsumption / unit.energyDispatched) * 100;
  const hvacAlert = hvacEfficiency > 15;

  const statusColors = {
    online: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    critical: 'border-red-500/30 bg-red-500/10 animate-pulse',
    offline: 'border-gray-500/30 bg-gray-500/5',
  };

  const statusBadges = {
    online: <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Online</span>,
    warning: <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Alerta</span>,
    critical: <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full animate-pulse">Crítico</span>,
    offline: <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">Offline</span>,
  };

  return (
    <div className={cn('rounded-xl border p-4 transition-all', statusColors[unit.status])}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            unit.status === 'critical' ? 'bg-red-500/20' :
            unit.status === 'offline' ? 'bg-gray-500/20' :
            unit.status === 'warning' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
          )}>
            {unit.status === 'offline' ? (
              <WifiOff className="w-5 h-5 text-gray-400" />
            ) : unit.status === 'critical' ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <Battery className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <h4 className="font-medium text-foreground">{unit.name}</h4>
            <p className="text-xs text-foreground-muted">{unit.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadges[unit.status]}
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-surface-hover rounded">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {unit.status !== 'offline' && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center p-2 bg-surface rounded-lg">
            <p className="text-xs text-foreground-muted">SOC</p>
            <p className="font-semibold text-primary">{unit.soc.toFixed(0)}%</p>
          </div>
          <div className="text-center p-2 bg-surface rounded-lg">
            <p className="text-xs text-foreground-muted">SoH</p>
            <p className={cn('font-semibold', unit.soh < 80 ? 'text-red-400' : unit.soh < 90 ? 'text-amber-400' : 'text-emerald-400')}>
              {unit.soh.toFixed(0)}%
            </p>
          </div>
          <div className="text-center p-2 bg-surface rounded-lg">
            <p className="text-xs text-foreground-muted">Temp</p>
            <p className={cn('font-semibold', unit.temperature > 35 ? 'text-red-400' : unit.temperature > 30 ? 'text-amber-400' : 'text-foreground')}>
              {unit.temperature.toFixed(1)}°C
            </p>
          </div>
          <div className="text-center p-2 bg-surface rounded-lg">
            <p className="text-xs text-foreground-muted">ΔV</p>
            <p className={cn('font-semibold', unit.deltaV > deltaVThreshold ? 'text-red-400' : 'text-foreground')}>
              {unit.deltaV.toFixed(0)}mV
            </p>
          </div>
        </div>
      )}

      {/* Alarms */}
      {unit.alarms.length > 0 && (
        <div className="mt-3 space-y-1">
          {unit.alarms.map(alarm => (
            <div key={alarm.id} className={cn(
              'p-2 rounded text-sm flex items-center gap-2',
              alarm.severity === 1 ? 'bg-red-500/20 text-red-300' :
              alarm.severity === 2 ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
            )}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{alarm.message}</span>
              <span className="text-xs opacity-70">{alarm.source}</span>
            </div>
          ))}
        </div>
      )}

      {/* Go/No-Go Indicator */}
      {unit.status === 'online' && (
        <div className={cn(
          'mt-3 p-2 rounded-lg flex items-center justify-between text-sm',
          arbitrage.preservationMode ? 'bg-amber-500/20' : 'bg-emerald-500/20'
        )}>
          <div className="flex items-center gap-2">
            {arbitrage.preservationMode ? (
              <Pause className="w-4 h-4 text-amber-400" />
            ) : (
              <Play className="w-4 h-4 text-emerald-400" />
            )}
            <span className={arbitrage.preservationMode ? 'text-amber-400' : 'text-emerald-400'}>
              {arbitrage.preservationMode ? 'Preservação de Ativo' : 'GO - Arbitragem Viável'}
            </span>
          </div>
          <span className="text-xs text-foreground-muted">
            C.ciclo: R${arbitrage.cycleCost}/MWh
          </span>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && unit.status !== 'offline' && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Detailed Metrics */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-foreground-muted">Impedância Interna</p>
              <p className={cn('font-medium', unit.impedance > 1.0 ? 'text-amber-400' : 'text-foreground')}>
                {unit.impedance.toFixed(2)}mΩ {unit.impedance > 1.0 && '⚠️'}
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">Latência</p>
              <p className={cn('font-medium', unit.latencyMs > 500 ? 'text-amber-400' : 'text-foreground')}>
                {unit.latencyMs.toFixed(0)}ms
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">Ciclos Usados</p>
              <p className="font-medium">{unit.cyclesUsed} / {unit.cyclesGuaranteed}</p>
            </div>
            <div>
              <p className="text-foreground-muted">Consumo HVAC</p>
              <p className={cn('font-medium', hvacAlert ? 'text-red-400' : 'text-foreground')}>
                {hvacEfficiency.toFixed(1)}% {hvacAlert && '🔥 Verificar isolamento'}
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">Firmware</p>
              <p className={cn('font-mono text-xs', unit.firmwareVersion !== 'v2.4.1' && 'text-amber-400')}>
                {unit.firmwareVersion}
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">Autonomia Edge</p>
              <p className="font-medium">{unit.edgeAutonomyHours}h</p>
            </div>
          </div>

          {/* Cost Analysis */}
          <div className="p-3 bg-surface rounded-lg">
            <h5 className="text-sm font-medium text-foreground mb-2">Análise de Custo de Oportunidade</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-foreground-muted">Lucro Imediato (estimado)</p>
                <p className="text-emerald-400 font-medium">R$ {(arbitrage.estimatedProfit * unit.capacityMWh).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Custo de Degradação</p>
                <p className={cn('font-medium', arbitrage.preservationMode ? 'text-red-400' : 'text-foreground')}>
                  R$ {(parseFloat(arbitrage.cycleCost) * unit.capacityMWh).toFixed(0)}
                </p>
              </div>
            </div>
            {unit.temperature > 35 && (
              <p className="text-xs text-amber-400 mt-2">
                ⚠️ Fator térmico 1.2x aplicado (temp &gt; 35°C)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
