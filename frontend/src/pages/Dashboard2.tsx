import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Info,
  Play,
  Pause,
  Command,
  Download,
  Upload,
  Globe,
  FileJson,
  FileText,
  RotateCcw,
  Ticket,
  Eye,
  Filter,
  Wifi,
  Waves,
  BellOff,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface BESSUnit {
  id: string;
  name: string;
  location: string;
  region: string;
  coordinates: { lat: number; lng: number };
  capacityMWh: number;
  powerMW: number;
  soc: number;
  soh: number;
  sohHistory: number[];
  coulombCount: number;
  status: 'online' | 'offline' | 'warning' | 'critical';
  pcsStatus: 'running' | 'standby' | 'fault' | 'offline';
  bmsStatus: 'active' | 'balancing' | 'fault' | 'offline';
  hvacStatus: 'cooling' | 'heating' | 'standby' | 'fault';
  temperature: number;
  deltaV: number;
  deltaVHistory: number[];
  deltaVAtRest: number;
  impedance: number;
  impedanceBaseline: number;
  latencyMs: number;
  hvacConsumption: number;
  energyDispatched: number;
  cyclesUsed: number;
  cyclesGuaranteed: number;
  firmwareVersion: string;
  firmwareUpdateAvailable: boolean;
  edgeAutonomyHours: number;
  lastHeartbeat: Date;
  lastDataReceived: Date;
  watchdogResetCount: number;
  alarms: Alarm[];
  suppressedAlarms: number;
}

interface Alarm {
  id: string;
  timestamp: Date;
  type: string;
  severity: 1 | 2 | 3;
  source: string;
  message: string;
  suppressed?: boolean;
  ticketId?: string;
}

interface SOEEvent {
  id: string;
  bessId: string;
  timestamp: Date;
  milliseconds: number;
  source: string;
  event: string;
  rootCause?: boolean;
}

interface JiraTicket {
  id: string;
  bessId: string;
  bessName: string;
  alarmId: string;
  type: string;
  severity: number;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: Date;
  description: string;
}

interface WatchdogStatus {
  bessId: string;
  lastCheck: Date;
  status: 'healthy' | 'warning' | 'resetting' | 'failed';
  consecutiveFailures: number;
}

// Generate simulated data
const generateBESSUnits = (): BESSUnit[] => {
  const locations = [
    { name: 'BESS Teresina Centro', location: 'Teresina, PI', region: 'Norte', lat: -5.0892, lng: -42.8016 },
    { name: 'BESS Parnaíba Industrial', location: 'Parnaíba, PI', region: 'Norte', lat: -2.9055, lng: -41.7769 },
    { name: 'BESS Floriano Solar', location: 'Floriano, PI', region: 'Sul', lat: -6.7670, lng: -43.0222 },
    { name: 'BESS Picos Comercial', location: 'Picos, PI', region: 'Sul', lat: -7.0769, lng: -41.4669 },
    { name: 'BESS Piripiri Norte', location: 'Piripiri, PI', region: 'Norte', lat: -4.2728, lng: -41.7768 },
    { name: 'BESS Oeiras Agro', location: 'Oeiras, PI', region: 'Sul', lat: -7.0244, lng: -42.1311 },
    { name: 'BESS Campo Maior', location: 'Campo Maior, PI', region: 'Norte', lat: -4.8269, lng: -42.1689 },
    { name: 'BESS Barras', location: 'Barras, PI', region: 'Norte', lat: -4.2444, lng: -42.2942 },
  ];

  return locations.map((loc, i) => {
    const isOffline = i === 2;
    const isCritical = i === 3;
    const isWarning = i === 4;
    const hasHighImpedance = i === 5;
    const hasHvacIssue = i === 6;

    const alarms: Alarm[] = [];
    let suppressedCount = 0;

    if (isCritical) {
      alarms.push({
        id: `alarm-${i}-1`,
        timestamp: new Date(Date.now() - 120000),
        type: 'overvoltage',
        severity: 1,
        source: 'BMS',
        message: 'Sobretensão detectada no rack 3 - Célula 47',
        ticketId: 'BESS-2024-001',
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
        ticketId: 'BESS-2024-002',
      });
      suppressedCount = 12;
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

    if (hasHighImpedance) {
      alarms.push({
        id: `alarm-${i}-4`,
        timestamp: new Date(Date.now() - 180000),
        type: 'impedance',
        severity: 2,
        source: 'BMS',
        message: 'Aumento de impedância - Verificar conexões',
      });
    }

    if (hasHvacIssue) {
      alarms.push({
        id: `alarm-${i}-5`,
        timestamp: new Date(Date.now() - 240000),
        type: 'hvac',
        severity: 3,
        source: 'HVAC',
        message: 'Consumo HVAC > 15% - Verificar isolamento',
      });
    }

    const baseSoH = 85 + Math.random() * 12;
    const baseImpedance = hasHighImpedance ? 1.3 : 0.8 + Math.random() * 0.3;
    const baseDeltaV = isWarning ? 85 : 10 + Math.random() * 30;

    return {
      id: `bess-${i + 1}`,
      name: loc.name,
      location: loc.location,
      region: loc.region,
      coordinates: { lat: loc.lat, lng: loc.lng },
      capacityMWh: 2 + Math.random() * 3,
      powerMW: 1 + Math.random() * 2,
      soc: isOffline ? 0 : 20 + Math.random() * 70,
      soh: baseSoH,
      sohHistory: Array.from({ length: 30 }, () => baseSoH + (Math.random() - 0.5)),
      coulombCount: 95 + Math.random() * 5,
      status: isOffline ? 'offline' : isCritical ? 'critical' : isWarning ? 'warning' : 'online',
      pcsStatus: isOffline ? 'offline' : isCritical ? 'fault' : 'running',
      bmsStatus: isOffline ? 'offline' : isWarning ? 'balancing' : 'active',
      hvacStatus: isOffline ? 'fault' : hasHvacIssue ? 'cooling' : 'standby',
      temperature: isOffline ? 0 : hasHvacIssue ? 38 : 25 + Math.random() * 10,
      deltaV: baseDeltaV,
      deltaVHistory: Array.from({ length: 5 }, () => baseDeltaV + (Math.random() - 0.5) * 10),
      deltaVAtRest: isWarning ? 82 : baseDeltaV - 5,
      impedance: baseImpedance,
      impedanceBaseline: 0.85,
      latencyMs: isOffline ? 9999 : i === 4 ? 520 : 15 + Math.random() * 50,
      hvacConsumption: hasHvacIssue ? 35 : 8 + Math.random() * 10,
      energyDispatched: 50 + Math.random() * 150,
      cyclesUsed: 500 + Math.floor(Math.random() * 1000),
      cyclesGuaranteed: 6000,
      firmwareVersion: i < 5 ? 'v2.4.1' : 'v2.3.8',
      firmwareUpdateAvailable: i >= 5,
      edgeAutonomyHours: 4 + Math.floor(Math.random() * 8),
      lastHeartbeat: new Date(Date.now() - (isOffline ? 300000 : Math.random() * 3000)),
      lastDataReceived: new Date(Date.now() - (isOffline ? 300000 : Math.random() * 1000)),
      watchdogResetCount: isOffline ? 3 : 0,
      alarms,
      suppressedAlarms: suppressedCount,
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

// Kalman Filter for SoH
function kalmanFilterSoH(measurements: number[]): number {
  if (measurements.length === 0) return 0;
  let estimate = measurements[0];
  let errorEstimate = 1;
  const errorMeasurement = 0.5;
  const processNoise = 0.01;

  for (const measurement of measurements) {
    const kalmanGain = errorEstimate / (errorEstimate + errorMeasurement);
    estimate = estimate + kalmanGain * (measurement - estimate);
    errorEstimate = (1 - kalmanGain) * errorEstimate + processNoise;
  }
  return estimate;
}

// Coulomb Counting SoH
function coulombCountingSoH(cyclesUsed: number, cyclesGuaranteed: number, coulombEfficiency: number): number {
  const degradationPerCycle = 100 / cyclesGuaranteed;
  const currentDegradation = cyclesUsed * degradationPerCycle;
  return Math.max(0, (100 - currentDegradation) * (coulombEfficiency / 100));
}

// Delta V Filter
function filterDeltaV(history: number[], atRestValue: number, threshold: number) {
  if (history.length < 3) return { alert: false, avgDeltaV: history[0] || 0, persistentAtRest: false };
  const avgDeltaV = history.reduce((a, b) => a + b, 0) / history.length;
  const persistentAtRest = atRestValue > threshold;
  const alert = avgDeltaV > threshold && persistentAtRest;
  return { alert, avgDeltaV, persistentAtRest };
}

// InfoTooltip Component
function InfoTooltip({ title, description }: { title: string; description: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 280) });
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

// Main Dashboard Component
export default function Dashboard2() {
  const [bessUnits, setBessUnits] = useState<BESSUnit[]>([]);
  const [soeEvents, setSoeEvents] = useState<SOEEvent[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [watchdogStatuses, setWatchdogStatuses] = useState<Map<string, WatchdogStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showOnlyExceptions, setShowOnlyExceptions] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [deltaVThreshold, setDeltaVThreshold] = useState(50);
  const [showSOE, setShowSOE] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showSoHPanel, setShowSoHPanel] = useState(false);
  const [globalCommand, setGlobalCommand] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(true);

  // Load data
  useEffect(() => {
    const loadData = () => {
      const units = generateBESSUnits();
      setBessUnits(units);
      setSoeEvents(generateSOEEvents());
      setLastUpdate(new Date());
      setIsLoading(false);

      const initialTickets: JiraTicket[] = [];
      units.forEach(unit => {
        unit.alarms.filter(a => a.severity === 1 && a.ticketId).forEach(alarm => {
          initialTickets.push({
            id: alarm.ticketId!,
            bessId: unit.id,
            bessName: unit.name,
            alarmId: alarm.id,
            type: alarm.type,
            severity: alarm.severity,
            status: 'open',
            createdAt: alarm.timestamp,
            description: alarm.message,
          });
        });
      });
      setJiraTickets(initialTickets);
    };

    loadData();

    // Real-time updates (WebSocket/SSE simulation)
    const interval = setInterval(() => {
      setBessUnits(prev => prev.map(unit => {
        if (unit.status === 'offline') return unit;
        const newDeltaV = unit.deltaV + (Math.random() - 0.5) * 5;
        return {
          ...unit,
          soc: Math.max(10, Math.min(95, unit.soc + (Math.random() - 0.5) * 2)),
          temperature: Math.max(20, Math.min(45, unit.temperature + (Math.random() - 0.5) * 0.5)),
          deltaV: newDeltaV,
          deltaVHistory: [...unit.deltaVHistory.slice(-4), newDeltaV],
          latencyMs: Math.max(10, Math.min(100, unit.latencyMs + (Math.random() - 0.5) * 10)),
          lastHeartbeat: new Date(),
          lastDataReceived: new Date(),
        };
      }));
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Fleet Stats
  const fleetStats = useMemo(() => {
    const onlineUnits = bessUnits.filter(u => u.status !== 'offline');
    const totalCapacity = bessUnits.reduce((sum, u) => sum + u.capacityMWh, 0);
    const availablePower = onlineUnits.reduce((sum, u) => sum + u.powerMW, 0);
    const availability = bessUnits.length > 0 ? (onlineUnits.length / bessUnits.length) * 100 : 0;
    const avgSoH = onlineUnits.length > 0 ? onlineUnits.reduce((sum, u) => sum + u.soh, 0) / onlineUnits.length : 0;
    const criticalAlarms = bessUnits.reduce((sum, u) => sum + u.alarms.filter(a => a.severity === 1).length, 0);
    return { totalCapacity, availablePower, availability, avgSoH, criticalAlarms, total: bessUnits.length, online: onlineUnits.length };
  }, [bessUnits]);

  // Filtered Units
  const filteredUnits = useMemo(() => {
    let units = bessUnits;
    if (selectedRegion !== 'all') units = units.filter(u => u.region === selectedRegion);
    if (showOnlyExceptions) {
      units = units.filter(u => {
        const deltaVAlert = filterDeltaV(u.deltaVHistory, u.deltaVAtRest, deltaVThreshold);
        const hvacEfficiency = (u.hvacConsumption / u.energyDispatched) * 100;
        return u.status !== 'online' || u.alarms.length > 0 || deltaVAlert.alert || u.temperature > 35 || u.latencyMs > 500 || hvacEfficiency > 15;
      });
    }
    return [...units].sort((a, b) => {
      const order = { critical: 0, offline: 1, warning: 2, online: 3 };
      return order[a.status] - order[b.status];
    });
  }, [bessUnits, showOnlyExceptions, selectedRegion, deltaVThreshold]);

  // Severity 1 Alarms
  const severity1Alarms = useMemo(() => {
    return bessUnits.flatMap(unit =>
      unit.alarms.filter(a => a.severity === 1 && !a.suppressed).map(a => ({ ...a, bessName: unit.name, bessId: unit.id }))
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [bessUnits]);

  // Cycle Cost Calculation
  const calculateCycleCost = useCallback((unit: BESSUnit) => {
    const capex = 150000;
    const dod = 0.8;
    const baseCycleCost = capex / (unit.cyclesGuaranteed * dod);
    const tempPenalty = unit.temperature > 35 ? 1.2 : 1.0;
    return baseCycleCost * tempPenalty;
  }, []);

  const calculateArbitrageDecision = useCallback((unit: BESSUnit) => {
    const cycleCost = calculateCycleCost(unit);
    const estimatedProfit = 45;
    const isGoDecision = estimatedProfit > cycleCost;
    return {
      cycleCost: cycleCost.toFixed(2),
      estimatedProfit,
      isGoDecision,
      preservationMode: !isGoDecision,
      reason: !isGoDecision ? 'Custo de ciclo > Lucro estimado' : 'Arbitragem viável',
    };
  }, [calculateCycleCost]);

  // Load Balancing Suggestion
  const loadBalancingSuggestion = useMemo(() => {
    const onlineUnits = bessUnits.filter(u => u.status === 'online');
    if (onlineUnits.length < 2) return null;
    const sorted = [...onlineUnits].sort((a, b) => (a.cyclesUsed + (a.temperature > 30 ? 100 : 0)) - (b.cyclesUsed + (b.temperature > 30 ? 100 : 0)));
    const recommended = sorted[0];
    const avoid = sorted[sorted.length - 1];
    if (recommended.id !== avoid.id) {
      return { recommended, avoid, reason: `${recommended.name} tem menos ciclos e temperatura menor` };
    }
    return null;
  }, [bessUnits]);

  // SoH Report Generation
  const generateSoHReport = useCallback((unit: BESSUnit) => {
    const kalmanSoH = kalmanFilterSoH(unit.sohHistory);
    const coulombSoH = coulombCountingSoH(unit.cyclesUsed, unit.cyclesGuaranteed, unit.coulombCount);
    const combinedSoH = kalmanSoH * 0.6 + coulombSoH * 0.4;
    return { kalmanSoH, coulombSoH, combinedSoH };
  }, []);

  // Export Report
  const exportSoHReport = useCallback((format: 'pdf' | 'json') => {
    const reports = bessUnits.map(unit => {
      const soh = generateSoHReport(unit);
      return { name: unit.name, ...soh, cyclesUsed: unit.cyclesUsed };
    });
    const content = format === 'json' ? JSON.stringify(reports, null, 2) : reports.map(r => `${r.name}: SoH ${r.combinedSoH.toFixed(1)}%`).join('\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soh-report.${format === 'json' ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bessUnits, generateSoHReport]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Avançado de Frota</h1>
          <p className="text-foreground-muted text-sm flex items-center gap-2">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            <span className={cn('flex items-center gap-1', wsConnected ? 'text-emerald-500' : 'text-red-500')}>
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wsConnected ? 'WebSocket Ativo' : 'Reconectando...'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="px-3 py-2 rounded-lg text-sm bg-surface border border-border">
            <option value="all">Todas Regiões</option>
            <option value="Norte">Região Norte</option>
            <option value="Sul">Região Sul</option>
          </select>
          <button onClick={() => setShowOnlyExceptions(!showOnlyExceptions)} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1', showOnlyExceptions ? 'bg-amber-500 text-white' : 'bg-surface border border-border')}>
            <Filter className="w-3 h-3" />
            {showOnlyExceptions ? 'Exceções' : 'Todos'}
          </button>
          <button onClick={() => setShowSOE(!showSOE)} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', showSOE ? 'bg-primary text-white' : 'bg-surface border border-border')}>
            SOE Log
          </button>
          <button onClick={() => setShowTickets(!showTickets)} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', showTickets ? 'bg-violet-500 text-white' : 'bg-surface border border-border')}>
            Chamados ({jiraTickets.length})
          </button>
          <button onClick={() => setShowSoHPanel(!showSoHPanel)} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', showSoHPanel ? 'bg-cyan-500 text-white' : 'bg-surface border border-border')}>
            SoH Lab
          </button>
        </div>
      </div>

      {/* Severity 1 Alarms Banner */}
      {severity1Alarms.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-4 border-2 border-red-400 animate-pulse">
          <div className="flex items-center gap-3">
            <Flame className="w-6 h-6 text-white" />
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">ALARMES SEVERIDADE 1</h3>
              {severity1Alarms.map(alarm => (
                <div key={alarm.id} className="flex items-center gap-2 text-white/90 text-sm mt-1">
                  <span className="font-medium">{alarm.bessName}:</span>
                  <span>{alarm.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fleet Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <FleetStatCard title="Capacidade" value={fleetStats.totalCapacity.toFixed(1)} unit="MWh" icon={Battery} color="blue" tooltip="Capacidade total da frota" />
        <FleetStatCard title="Potência" value={fleetStats.availablePower.toFixed(1)} unit="MW" icon={Zap} color="emerald" tooltip="Potência disponível" />
        <FleetStatCard title="Disponibilidade" value={fleetStats.availability.toFixed(0)} unit="%" icon={Activity} color={fleetStats.availability >= 90 ? 'emerald' : 'amber'} tooltip="Sistemas online vs total" />
        <FleetStatCard title="SoH Médio" value={fleetStats.avgSoH.toFixed(0)} unit="%" icon={Shield} color={fleetStats.avgSoH >= 85 ? 'emerald' : 'amber'} tooltip="Coulomb + Kalman Filter" />
        <FleetStatCard title="Alarmes Críticos" value={fleetStats.criticalAlarms} icon={AlertTriangle} color={fleetStats.criticalAlarms > 0 ? 'red' : 'emerald'} tooltip="Severidade 1" />
        <FleetStatCard title="Online" value={fleetStats.online} total={fleetStats.total} icon={Server} color="cyan" tooltip="Sistemas com heartbeat" />
        <FleetStatCard title="ΔV Threshold" value={deltaVThreshold} unit="mV" icon={Gauge} color="violet" tooltip="Limite de desbalanceamento" />
      </div>

      {/* Tickets Panel */}
      {showTickets && jiraTickets.length > 0 && (
        <div className="bg-surface rounded-xl border border-violet-500/30 p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-violet-400" />
            Chamados Automáticos (API Jira)
          </h3>
          <div className="space-y-2">
            {jiraTickets.map(ticket => (
              <div key={ticket.id} className="p-3 bg-surface-hover rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-violet-400">{ticket.id}</span>
                  <p className="text-sm text-foreground">{ticket.bessName} - {ticket.type}</p>
                </div>
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Aberto</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SoH Lab Panel */}
      {showSoHPanel && (
        <div className="bg-surface rounded-xl border border-cyan-500/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              SoH Lab - Coulomb Counting + Kalman Filter
            </h3>
            <div className="flex gap-2">
              <button onClick={() => exportSoHReport('json')} className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">JSON</button>
              <button onClick={() => exportSoHReport('pdf')} className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">PDF</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {bessUnits.filter(u => u.status !== 'offline').slice(0, 4).map(unit => {
              const report = generateSoHReport(unit);
              return (
                <div key={unit.id} className="p-3 bg-surface-hover rounded-lg">
                  <h4 className="font-medium text-sm truncate">{unit.name.replace('BESS ', '')}</h4>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-foreground-muted">Coulomb:</span><span className="text-cyan-400">{report.coulombSoH.toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-foreground-muted">Kalman:</span><span className="text-cyan-400">{report.kalmanSoH.toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-foreground-muted">Combinado:</span><span className="font-semibold text-emerald-400">{report.combinedSoH.toFixed(1)}%</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Commands */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Command className="w-4 h-4" />
          Comandos Globais / Grupo
        </h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setGlobalCommand('conservation-norte')} className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm">Conservação - Norte</button>
          <button onClick={() => setGlobalCommand('peak-shaving')} className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm">Peak Shaving - Todos</button>
          <button onClick={() => setGlobalCommand('firmware')} className="px-3 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm flex items-center gap-1">
            <Upload className="w-3 h-3" />Firmware OTA
          </button>
          <button onClick={() => setGlobalCommand('watchdog')} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />Reset Gateway
          </button>
        </div>
        {globalCommand && (
          <div className="mt-3 p-2 bg-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Comando "{globalCommand}" enviado...
          </div>
        )}
      </div>

      {/* Load Balancing Suggestion */}
      {loadBalancingSuggestion && (
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <div>
              <h4 className="font-medium text-foreground">Sugestão de Balanceamento</h4>
              <p className="text-sm text-foreground-muted mt-1">
                Priorize <span className="text-emerald-400 font-medium">{loadBalancingSuggestion.recommended.name}</span> ao invés de <span className="text-amber-400 font-medium">{loadBalancingSuggestion.avoid.name}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* BESS List */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold text-foreground">{showOnlyExceptions ? 'Sistemas com Exceções' : 'Todos'} ({filteredUnits.length})</h3>
          {filteredUnits.length === 0 ? (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-400 font-medium">Todos operando normalmente</p>
            </div>
          ) : (
            filteredUnits.map(unit => <BESSCard key={unit.id} unit={unit} deltaVThreshold={deltaVThreshold} calculateArbitrage={calculateArbitrageDecision} />)
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Heartbeat Monitor */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Radio className="w-4 h-4" />Heartbeat Monitor</h3>
            <div className="space-y-2">
              {bessUnits.map(unit => (
                <div key={unit.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                  <span className={cn('font-mono', unit.latencyMs > 1000 ? 'text-red-500' : unit.latencyMs > 500 ? 'text-amber-500' : 'text-emerald-500')}>
                    {unit.latencyMs > 5000 ? 'OFFLINE' : `${unit.latencyMs.toFixed(0)}ms`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Firmware */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Cpu className="w-4 h-4" />Firmware</h3>
            <div className="space-y-2">
              {Object.entries(bessUnits.reduce((acc, u) => { acc[u.firmwareVersion] = (acc[u.firmwareVersion] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([v, c]) => (
                <div key={v} className="flex items-center justify-between text-sm">
                  <span className={cn('font-mono', v === 'v2.4.1' ? 'text-emerald-500' : 'text-amber-500')}>{v}</span>
                  <span className="text-foreground-muted">{c} sistemas</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edge Autonomy */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Globe className="w-4 h-4" />Autonomia Edge</h3>
            <div className="space-y-2">
              {bessUnits.filter(u => u.status !== 'offline').slice(0, 5).map(unit => (
                <div key={unit.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                  <span className="text-cyan-400">{unit.edgeAutonomyHours}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Impedance */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><CircuitBoard className="w-4 h-4" />Impedância</h3>
            <div className="space-y-2">
              {bessUnits.filter(u => u.status !== 'offline').map(unit => {
                const increase = ((unit.impedance - unit.impedanceBaseline) / unit.impedanceBaseline) * 100;
                return (
                  <div key={unit.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                    <span className={cn('font-mono', increase > 20 ? 'text-red-400' : 'text-foreground')}>{unit.impedance.toFixed(2)}mΩ</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SOE Log */}
          {showSOE && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />SOE (ms)</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {soeEvents.map(event => (
                  <div key={event.id} className={cn('p-2 rounded text-xs', event.rootCause ? 'bg-red-500/20 border border-red-500/30' : 'bg-surface-hover')}>
                    <div className="flex justify-between">
                      <span className={event.rootCause ? 'text-red-400 font-medium' : 'text-foreground'}>{event.rootCause && '🎯 '}{event.source}</span>
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

      {/* Map */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" />Mapa Georreferenciado - Piauí</h3>
        <div className="relative h-64 rounded-lg overflow-hidden bg-gradient-to-br from-blue-900 to-blue-950">
          {bessUnits.map((unit) => {
            const positions: Record<string, { x: number; y: number }> = {
              'bess-1': { x: 45, y: 35 }, 'bess-2': { x: 25, y: 15 }, 'bess-3': { x: 40, y: 65 }, 'bess-4': { x: 65, y: 55 },
              'bess-5': { x: 35, y: 25 }, 'bess-6': { x: 55, y: 70 }, 'bess-7': { x: 50, y: 30 }, 'bess-8': { x: 40, y: 20 },
            };
            const pos = positions[unit.id] || { x: 50, y: 50 };
            return (
              <div key={unit.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                <div className={cn('w-5 h-5 rounded-full border-2 border-white shadow-lg', unit.status === 'online' ? 'bg-emerald-500' : unit.status === 'warning' ? 'bg-amber-500' : unit.status === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-gray-500')} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white p-2 rounded-lg shadow-xl text-xs whitespace-nowrap">
                    <div className="font-bold">{unit.name}</div>
                    <div>SOC: {unit.soc.toFixed(0)}% | SoH: {unit.soh.toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            );
          })}
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
function FleetStatCard({ title, value, unit, total, icon: Icon, color, tooltip }: { title: string; value: number | string; unit?: string; total?: number; icon: React.ElementType; color: string; tooltip: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 via-blue-600 to-blue-800 border-blue-300/50',
    emerald: 'from-emerald-500 via-emerald-600 to-emerald-800 border-emerald-300/50',
    amber: 'from-amber-500 via-amber-600 to-amber-800 border-amber-300/50',
    red: 'from-red-500 via-red-600 to-red-800 border-red-300/50',
    cyan: 'from-cyan-500 via-cyan-600 to-cyan-800 border-cyan-300/50',
    violet: 'from-violet-500 via-violet-600 to-violet-800 border-violet-300/50',
  };
  return (
    <div className={cn('relative rounded-lg p-2 bg-gradient-to-b border shadow-md overflow-hidden', colors[color])}>
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg" />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <div className="p-1 rounded bg-white/20"><Icon className="w-3.5 h-3.5 text-white" /></div>
          <InfoTooltip title={title} description={tooltip} />
        </div>
        <p className="text-lg font-bold text-white drop-shadow-md">
          {value}{unit && <span className="text-xs font-normal ml-0.5">{unit}</span>}
          {total !== undefined && <span className="text-white/70 font-normal text-sm">/{total}</span>}
        </p>
        <p className="text-2xs text-white/80 truncate">{title}</p>
      </div>
    </div>
  );
}

// BESS Card
function BESSCard({ unit, deltaVThreshold, calculateArbitrage }: { unit: BESSUnit; deltaVThreshold: number; calculateArbitrage: (u: BESSUnit) => { cycleCost: string; estimatedProfit: number; isGoDecision: boolean; preservationMode: boolean; reason: string } }) {
  const [expanded, setExpanded] = useState(false);
  const arbitrage = calculateArbitrage(unit);
  const hvacEfficiency = (unit.hvacConsumption / unit.energyDispatched) * 100;
  const deltaVAnalysis = filterDeltaV(unit.deltaVHistory, unit.deltaVAtRest, deltaVThreshold);
  const impedanceIncrease = ((unit.impedance - unit.impedanceBaseline) / unit.impedanceBaseline) * 100;

  const statusColors = { online: 'border-emerald-500/30 bg-emerald-500/5', warning: 'border-amber-500/30 bg-amber-500/5', critical: 'border-red-500/30 bg-red-500/10 animate-pulse', offline: 'border-gray-500/30 bg-gray-500/5' };

  return (
    <div className={cn('rounded-xl border p-4 transition-all', statusColors[unit.status])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', unit.status === 'critical' ? 'bg-red-500/20' : unit.status === 'offline' ? 'bg-gray-500/20' : unit.status === 'warning' ? 'bg-amber-500/20' : 'bg-emerald-500/20')}>
            {unit.status === 'offline' ? <WifiOff className="w-5 h-5 text-gray-400" /> : unit.status === 'critical' ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <Battery className="w-5 h-5 text-emerald-400" />}
          </div>
          <div>
            <h4 className="font-medium text-foreground">{unit.name}</h4>
            <p className="text-xs text-foreground-muted">{unit.location} | {unit.region}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 text-xs rounded-full', unit.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : unit.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : unit.status === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400')}>
            {unit.status.toUpperCase()}
          </span>
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-surface-hover rounded">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {unit.status !== 'offline' && (
        <>
          <div className="flex items-center gap-3 mt-3 text-xs">
            <span className="text-foreground-muted">PCS: <span className={unit.pcsStatus === 'running' ? 'text-emerald-400' : 'text-red-400'}>{unit.pcsStatus}</span></span>
            <span className="text-foreground-muted">BMS: <span className={unit.bmsStatus === 'active' ? 'text-emerald-400' : 'text-cyan-400'}>{unit.bmsStatus}</span></span>
            <span className="text-foreground-muted">HVAC: <span className={unit.hvacStatus === 'standby' ? 'text-emerald-400' : 'text-cyan-400'}>{unit.hvacStatus}</span></span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">SOC</p>
              <p className="font-semibold text-primary">{unit.soc.toFixed(0)}%</p>
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">SoH</p>
              <p className={cn('font-semibold', unit.soh < 80 ? 'text-red-400' : unit.soh < 90 ? 'text-amber-400' : 'text-emerald-400')}>{unit.soh.toFixed(0)}%</p>
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Temp</p>
              <p className={cn('font-semibold', unit.temperature > 35 ? 'text-red-400' : 'text-foreground')}>{unit.temperature.toFixed(1)}°C</p>
              {unit.temperature > 35 && <p className="text-2xs text-red-400">1.2x</p>}
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">ΔV</p>
              <p className={cn('font-semibold', deltaVAnalysis.alert ? 'text-red-400' : 'text-foreground')}>{deltaVAnalysis.avgDeltaV.toFixed(0)}mV</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Latência</p>
              <p className={cn('font-semibold text-sm', unit.latencyMs > 500 ? 'text-amber-400' : 'text-foreground')}>{unit.latencyMs.toFixed(0)}ms</p>
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Impedância</p>
              <p className={cn('font-semibold text-sm', impedanceIncrease > 20 ? 'text-red-400' : 'text-foreground')}>{unit.impedance.toFixed(2)}mΩ</p>
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">HVAC</p>
              <p className={cn('font-semibold text-sm', hvacEfficiency > 15 ? 'text-red-400' : 'text-foreground')}>{hvacEfficiency.toFixed(1)}%</p>
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Edge</p>
              <p className="font-semibold text-sm text-cyan-400">{unit.edgeAutonomyHours}h</p>
            </div>
          </div>
        </>
      )}

      {unit.suppressedAlarms > 0 && (
        <div className="mt-2 px-2 py-1 bg-gray-500/20 rounded text-xs text-gray-400 flex items-center gap-1">
          <BellOff className="w-3 h-3" />{unit.suppressedAlarms} alarmes suprimidos (cascata)
        </div>
      )}

      {unit.alarms.length > 0 && (
        <div className="mt-3 space-y-1">
          {unit.alarms.map(alarm => (
            <div key={alarm.id} className={cn('p-2 rounded text-sm flex items-center gap-2', alarm.severity === 1 ? 'bg-red-500/20 text-red-300' : alarm.severity === 2 ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300')}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{alarm.message}</span>
              {alarm.ticketId && <span className="text-xs opacity-70">{alarm.ticketId}</span>}
            </div>
          ))}
        </div>
      )}

      {unit.status === 'online' && (
        <div className={cn('mt-3 p-2 rounded-lg flex items-center justify-between text-sm', arbitrage.preservationMode ? 'bg-amber-500/20' : 'bg-emerald-500/20')}>
          <div className="flex items-center gap-2">
            {arbitrage.preservationMode ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
            <span className={arbitrage.preservationMode ? 'text-amber-400' : 'text-emerald-400'}>
              {arbitrage.preservationMode ? 'Preservação de Ativo' : 'GO - Arbitragem Viável'}
            </span>
          </div>
          <span className="text-xs text-foreground-muted">R${arbitrage.cycleCost}/MWh</span>
        </div>
      )}

      {expanded && unit.status !== 'offline' && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-foreground-muted">Ciclos</p><p className="font-medium">{unit.cyclesUsed} / {unit.cyclesGuaranteed}</p></div>
            <div><p className="text-foreground-muted">Firmware</p><p className={cn('font-mono text-xs', unit.firmwareUpdateAvailable && 'text-amber-400')}>{unit.firmwareVersion}</p></div>
            <div><p className="text-foreground-muted">Lucro Estimado</p><p className="text-emerald-400 font-medium">R$ {(arbitrage.estimatedProfit * unit.capacityMWh).toFixed(0)}</p></div>
            <div><p className="text-foreground-muted">Custo Degradação</p><p className={cn('font-medium', arbitrage.preservationMode ? 'text-red-400' : '')}> R$ {(parseFloat(arbitrage.cycleCost) * unit.capacityMWh).toFixed(0)}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
