import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  FileJson,
  FileText,
  RotateCcw,
  Ticket,
  Eye,
  EyeOff,
  Filter,
  Settings2,
  Wifi,
  Waves,
  Bell,
  BellOff,
  Calculator,
  LineChart,
  BarChart3,
  PieChart,
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
  sohHistory: number[]; // Para Kalman Filter
  coulombCount: number; // Coulomb Counting
  status: 'online' | 'offline' | 'warning' | 'critical';
  pcsStatus: 'running' | 'standby' | 'fault' | 'offline';
  bmsStatus: 'active' | 'balancing' | 'fault' | 'offline';
  hvacStatus: 'cooling' | 'heating' | 'standby' | 'fault';
  temperature: number;
  temperatureHistory: number[]; // Para média temporal
  deltaV: number;
  deltaVHistory: number[]; // Para filtrar picos momentâneos (5 leituras)
  deltaVAtRest: number; // Delta V em repouso
  impedance: number;
  impedanceBaseline: number; // Para detectar aumento
  latencyMs: number;
  hvacConsumption: number;
  energyDispatched: number;
  cyclesUsed: number;
  cyclesGuaranteed: number;
  firmwareVersion: string;
  firmwareUpdateAvailable: boolean;
  edgeAutonomyHours: number;
  edgeMode: boolean;
  lastHeartbeat: Date;
  lastDataReceived: Date;
  watchdogResetCount: number;
  alarms: Alarm[];
  suppressedAlarms: number;
}

interface Alarm {
  id: string;
  timestamp: Date;
  type: 'fire' | 'arc' | 'flood' | 'overvoltage' | 'communication' | 'temperature' | 'soc' | 'deltaV' | 'impedance' | 'hvac' | 'watchdog';
  severity: 1 | 2 | 3; // 1 = Critical (Life/Asset), 2 = High, 3 = Medium
  source: 'PCS' | 'BMS' | 'HVAC' | 'Gateway' | 'EMS';
  message: string;
  suppressed?: boolean;
  ticketId?: string; // ID do chamado no Jira/similar
  acknowledged?: boolean;
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
  assignee?: string;
  description: string;
}

interface WatchdogStatus {
  bessId: string;
  lastCheck: Date;
  status: 'healthy' | 'warning' | 'resetting' | 'failed';
  consecutiveFailures: number;
  lastResetAttempt?: Date;
}

interface SoHReport {
  bessId: string;
  bessName: string;
  generatedAt: Date;
  period: string;
  avgSoH: number;
  sohTrend: 'stable' | 'declining' | 'improving';
  coulombCountingResult: number;
  kalmanFilterResult: number;
  cyclesThisMonth: number;
  degradationRate: number; // % per month
  estimatedEOL: Date;
  recommendations: string[];
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
    const isOffline = i === 2; // Floriano offline
    const isCritical = i === 3; // Picos critical
    const isWarning = i === 4; // Piripiri warning
    const hasHighImpedance = i === 5; // Oeiras com impedância alta
    const hasHvacIssue = i === 6; // Campo Maior com HVAC alto

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
      // Site offline - alarme consolidado, suprime individuais
      alarms.push({
        id: `alarm-${i}-2`,
        timestamp: new Date(Date.now() - 300000),
        type: 'communication',
        severity: 1,
        source: 'Gateway',
        message: 'Site Offline - Falha de Telemetria',
        suppressed: false,
        ticketId: 'BESS-2024-002',
      });
      suppressedCount = 12; // 12 alarmes individuais suprimidos
    }

    if (isWarning) {
      alarms.push({
        id: `alarm-${i}-3`,
        timestamp: new Date(Date.now() - 60000),
        type: 'deltaV',
        severity: 2,
        source: 'BMS',
        message: 'Desbalanceamento de tensão persistente em repouso - ΔV = 85mV',
      });
    }

    if (hasHighImpedance) {
      alarms.push({
        id: `alarm-${i}-4`,
        timestamp: new Date(Date.now() - 180000),
        type: 'impedance',
        severity: 2,
        source: 'BMS',
        message: 'Aumento de impedância detectado - Verificar conexões e degradação',
      });
    }

    if (hasHvacIssue) {
      alarms.push({
        id: `alarm-${i}-5`,
        timestamp: new Date(Date.now() - 240000),
        type: 'hvac',
        severity: 3,
        source: 'HVAC',
        message: 'Consumo HVAC > 15% da energia despachada - Verificar isolamento térmico',
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
      sohHistory: Array.from({ length: 30 }, (_, j) => baseSoH + 0.5 - Math.random()), // 30 dias de histórico
      coulombCount: 95 + Math.random() * 5,
      status: isOffline ? 'offline' : isCritical ? 'critical' : isWarning ? 'warning' : 'online',
      pcsStatus: isOffline ? 'offline' : isCritical ? 'fault' : 'running',
      bmsStatus: isOffline ? 'offline' : isWarning ? 'balancing' : 'active',
      hvacStatus: isOffline ? 'fault' : hasHvacIssue ? 'cooling' : 'standby',
      temperature: isOffline ? 0 : hasHvacIssue ? 38 : 25 + Math.random() * 10,
      temperatureHistory: Array.from({ length: 24 }, () => 25 + Math.random() * 15),
      deltaV: baseDeltaV,
      deltaVHistory: Array.from({ length: 5 }, () => baseDeltaV + (Math.random() - 0.5) * 10), // 5 leituras para média
      deltaVAtRest: isWarning ? 82 : baseDeltaV - 5, // Delta V quando em repouso
      impedance: baseImpedance,
      impedanceBaseline: 0.85, // Valor de referência do commissioning
      latencyMs: isOffline ? 9999 : i === 4 ? 520 : 15 + Math.random() * 50,
      hvacConsumption: hasHvacIssue ? 35 : 8 + Math.random() * 10,
      energyDispatched: 50 + Math.random() * 150,
      cyclesUsed: 500 + Math.floor(Math.random() * 1000),
      cyclesGuaranteed: 6000,
      firmwareVersion: i < 5 ? 'v2.4.1' : 'v2.3.8',
      firmwareUpdateAvailable: i >= 5,
      edgeAutonomyHours: 4 + Math.floor(Math.random() * 8),
      edgeMode: isOffline,
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

// Kalman Filter for SoH estimation
function kalmanFilterSoH(measurements: number[]): number {
  if (measurements.length === 0) return 0;

  // Simplified Kalman Filter implementation
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

// Coulomb Counting SoH estimation
function coulombCountingSoH(cyclesUsed: number, cyclesGuaranteed: number, coulombEfficiency: number): number {
  const degradationPerCycle = 100 / cyclesGuaranteed;
  const currentDegradation = cyclesUsed * degradationPerCycle;
  return Math.max(0, (100 - currentDegradation) * (coulombEfficiency / 100));
}

// Delta V Filter - ignore momentary spikes, alert only if persistent at rest
function filterDeltaV(history: number[], atRestValue: number, threshold: number): {
  alert: boolean;
  avgDeltaV: number;
  persistentAtRest: boolean
} {
  if (history.length < 3) return { alert: false, avgDeltaV: history[0] || 0, persistentAtRest: false };

  // Calculate moving average
  const avgDeltaV = history.reduce((a, b) => a + b, 0) / history.length;

  // Check if at rest value persistently exceeds threshold
  const persistentAtRest = atRestValue > threshold;

  // Only alert if average AND rest value exceed threshold
  const alert = avgDeltaV > threshold && persistentAtRest;

  return { alert, avgDeltaV, persistentAtRest };
}

// Main Dashboard 2 Component
export default function Dashboard2() {
  const [bessUnits, setBessUnits] = useState<BESSUnit[]>([]);
  const [soeEvents, setSoeEvents] = useState<SOEEvent[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [watchdogStatuses, setWatchdogStatuses] = useState<Map<string, WatchdogStatus>>(new Map());
  const [sohReports, setSohReports] = useState<SoHReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showOnlyExceptions, setShowOnlyExceptions] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [deltaVThreshold, setDeltaVThreshold] = useState(50); // mV
  const [showSOE, setShowSOE] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showSoHPanel, setShowSoHPanel] = useState(false);
  const [globalCommand, setGlobalCommand] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(true);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'json'>('pdf');
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Watchdog Script - monitors data reception and attempts gateway reset
  const runWatchdog = useCallback((units: BESSUnit[]) => {
    const now = new Date();
    const newStatuses = new Map<string, WatchdogStatus>();

    units.forEach(unit => {
      const timeSinceData = now.getTime() - unit.lastDataReceived.getTime();
      const currentStatus = watchdogStatuses.get(unit.id);

      let status: WatchdogStatus['status'] = 'healthy';
      let consecutiveFailures = currentStatus?.consecutiveFailures || 0;
      let lastResetAttempt = currentStatus?.lastResetAttempt;

      if (timeSinceData > 60000) { // > 1 minute without data
        consecutiveFailures++;

        if (consecutiveFailures >= 3) {
          // Attempt automatic gateway reset
          if (!lastResetAttempt || now.getTime() - lastResetAttempt.getTime() > 300000) { // 5 min cooldown
            status = 'resetting';
            lastResetAttempt = now;
            console.log(`[Watchdog] Attempting gateway reset for ${unit.name}`);
            // In real implementation, would send reset command via API
          } else {
            status = 'failed';
          }
        } else {
          status = 'warning';
        }
      } else {
        consecutiveFailures = 0;
        status = 'healthy';
      }

      newStatuses.set(unit.id, {
        bessId: unit.id,
        lastCheck: now,
        status,
        consecutiveFailures,
        lastResetAttempt,
      });
    });

    setWatchdogStatuses(newStatuses);
  }, [watchdogStatuses]);

  // Auto-create Jira ticket for severity 1 alarms
  const createJiraTicket = useCallback((unit: BESSUnit, alarm: Alarm) => {
    if (alarm.ticketId) return; // Already has ticket

    const newTicket: JiraTicket = {
      id: `BESS-${Date.now()}`,
      bessId: unit.id,
      bessName: unit.name,
      alarmId: alarm.id,
      type: alarm.type,
      severity: alarm.severity,
      status: 'open',
      createdAt: new Date(),
      description: `
        Alarme de Severidade ${alarm.severity} detectado.
        Sistema: ${unit.name}
        Local: ${unit.location}
        Tipo: ${alarm.type}
        Fonte: ${alarm.source}
        Mensagem: ${alarm.message}
        Temperatura: ${unit.temperature}°C
        SOC: ${unit.soc}%
        Delta V: ${unit.deltaV}mV
        Impedância: ${unit.impedance}mΩ
      `.trim(),
    };

    setJiraTickets(prev => [...prev, newTicket]);
    return newTicket.id;
  }, []);

  // Simulate WebSocket/SSE data updates - only deltas
  useEffect(() => {
    const loadData = () => {
      const units = generateBESSUnits();
      setBessUnits(units);
      setSoeEvents(generateSOEEvents());
      setLastUpdate(new Date());
      setIsLoading(false);

      // Initialize Jira tickets for existing severity 1 alarms
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
            description: `Alarme automático: ${alarm.message}`,
          });
        });
      });
      setJiraTickets(initialTickets);
    };

    loadData();

    // Simulate real-time updates via delta changes only (WebSocket/SSE pattern)
    const dataInterval = setInterval(() => {
      setBessUnits(prev => prev.map(unit => {
        if (unit.status === 'offline') return unit;

        // Update delta V history (rolling window of 5)
        const newDeltaV = unit.deltaV + (Math.random() - 0.5) * 5;
        const newDeltaVHistory = [...unit.deltaVHistory.slice(-4), newDeltaV];

        // Update temperature history
        const newTemp = Math.max(20, Math.min(45, unit.temperature + (Math.random() - 0.5) * 0.5));
        const newTempHistory = [...unit.temperatureHistory.slice(-23), newTemp];

        return {
          ...unit,
          soc: Math.max(10, Math.min(95, unit.soc + (Math.random() - 0.5) * 2)),
          temperature: newTemp,
          temperatureHistory: newTempHistory,
          deltaV: newDeltaV,
          deltaVHistory: newDeltaVHistory,
          latencyMs: Math.max(10, Math.min(100, unit.latencyMs + (Math.random() - 0.5) * 10)),
          lastHeartbeat: new Date(),
          lastDataReceived: new Date(),
        };
      }));
      setLastUpdate(new Date());
    }, 3000);

    // Watchdog interval - checks every 30 seconds
    watchdogIntervalRef.current = setInterval(() => {
      setBessUnits(prev => {
        runWatchdog(prev);
        return prev;
      });
    }, 30000);

    // Simulate occasional WS disconnect/reconnect
    const wsInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        setWsConnected(false);
        setTimeout(() => setWsConnected(true), 2000);
      }
    }, 10000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(wsInterval);
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    };
  }, [runWatchdog]);

  // Generate SoH Report with Coulomb Counting + Kalman Filter
  const generateSoHReport = useCallback((unit: BESSUnit): SoHReport => {
    const kalmanSoH = kalmanFilterSoH(unit.sohHistory);
    const coulombSoH = coulombCountingSoH(unit.cyclesUsed, unit.cyclesGuaranteed, unit.coulombCount);

    // Combined estimate (weighted average)
    const combinedSoH = kalmanSoH * 0.6 + coulombSoH * 0.4;

    // Calculate degradation rate (% per month)
    const firstSoH = unit.sohHistory[0] || 100;
    const lastSoH = unit.sohHistory[unit.sohHistory.length - 1] || combinedSoH;
    const degradationRate = (firstSoH - lastSoH) / (unit.sohHistory.length / 30);

    // Estimate End of Life (when SoH reaches 70%)
    const monthsToEOL = degradationRate > 0 ? (combinedSoH - 70) / degradationRate : 999;
    const estimatedEOL = new Date();
    estimatedEOL.setMonth(estimatedEOL.getMonth() + Math.floor(monthsToEOL));

    const recommendations: string[] = [];
    if (combinedSoH < 80) recommendations.push('Considerar substituição preventiva nos próximos 12 meses');
    if (unit.impedance > unit.impedanceBaseline * 1.3) recommendations.push('Verificar conexões - impedância aumentou 30%+');
    if (degradationRate > 1) recommendations.push('Taxa de degradação acima do esperado - investigar condições operacionais');
    if (unit.temperatureHistory.some(t => t > 40)) recommendations.push('Picos de temperatura detectados - revisar sistema de refrigeração');

    return {
      bessId: unit.id,
      bessName: unit.name,
      generatedAt: new Date(),
      period: 'Últimos 30 dias',
      avgSoH: combinedSoH,
      sohTrend: degradationRate < 0.1 ? 'stable' : degradationRate > 0.5 ? 'declining' : 'improving',
      coulombCountingResult: coulombSoH,
      kalmanFilterResult: kalmanSoH,
      cyclesThisMonth: Math.floor(unit.cyclesUsed * 0.05),
      degradationRate,
      estimatedEOL,
      recommendations,
    };
  }, []);

  // Export SoH Report as PDF or JSON
  const exportSoHReport = useCallback((format: 'pdf' | 'json') => {
    const reports = bessUnits.map(generateSoHReport);

    if (format === 'json') {
      const jsonData = JSON.stringify(reports, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soh-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // PDF generation would use jsPDF or similar
      // For demo, we'll create a simple text version
      let pdfContent = 'RELATÓRIO DE SAÚDE DAS BATERIAS (SoH)\n';
      pdfContent += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
      pdfContent += '='.repeat(50) + '\n\n';

      reports.forEach(report => {
        pdfContent += `SISTEMA: ${report.bessName}\n`;
        pdfContent += `-`.repeat(40) + '\n';
        pdfContent += `SoH Médio: ${report.avgSoH.toFixed(1)}%\n`;
        pdfContent += `Tendência: ${report.sohTrend === 'stable' ? 'Estável' : report.sohTrend === 'declining' ? 'Declinando' : 'Melhorando'}\n`;
        pdfContent += `Coulomb Counting: ${report.coulombCountingResult.toFixed(1)}%\n`;
        pdfContent += `Kalman Filter: ${report.kalmanFilterResult.toFixed(1)}%\n`;
        pdfContent += `Ciclos este mês: ${report.cyclesThisMonth}\n`;
        pdfContent += `Taxa de degradação: ${report.degradationRate.toFixed(2)}%/mês\n`;
        pdfContent += `EOL Estimado: ${report.estimatedEOL.toLocaleDateString('pt-BR')}\n`;
        if (report.recommendations.length > 0) {
          pdfContent += `Recomendações:\n`;
          report.recommendations.forEach(r => pdfContent += `  • ${r}\n`);
        }
        pdfContent += '\n';
      });

      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soh-report-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setSohReports(reports);
  }, [bessUnits, generateSoHReport]);

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

  // Filter units by exception and region
  const filteredUnits = useMemo(() => {
    let units = bessUnits;

    // Filter by region
    if (selectedRegion !== 'all') {
      units = units.filter(u => u.region === selectedRegion);
    }

    if (showOnlyExceptions) {
      units = units.filter(u => {
        // Check delta V with filter (ignore momentary spikes)
        const deltaVAlert = filterDeltaV(u.deltaVHistory, u.deltaVAtRest, deltaVThreshold);

        // Check HVAC efficiency
        const hvacEfficiency = (u.hvacConsumption / u.energyDispatched) * 100;
        const hvacAlert = hvacEfficiency > 15;

        // Check impedance increase
        const impedanceAlert = u.impedance > u.impedanceBaseline * 1.2;

        return u.status !== 'online' ||
          u.alarms.length > 0 ||
          deltaVAlert.alert ||
          u.temperature > 35 ||
          u.latencyMs > 500 ||
          hvacAlert ||
          impedanceAlert;
      });
    }

    // Sort by severity: Critical > Offline > Warning > Online
    // Then by life/asset safety alarms first
    units = [...units].sort((a, b) => {
      const severityOrder = { critical: 0, offline: 1, warning: 2, online: 3 };
      const statusDiff = severityOrder[a.status] - severityOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // Secondary sort: units with severity 1 alarms first
      const aHasSev1 = a.alarms.some(al => al.severity === 1);
      const bHasSev1 = b.alarms.some(al => al.severity === 1);
      if (aHasSev1 && !bHasSev1) return -1;
      if (!aHasSev1 && bHasSev1) return 1;

      return 0;
    });

    return units;
  }, [bessUnits, showOnlyExceptions, selectedRegion, deltaVThreshold]);

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
          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-surface border border-border"
          >
            <option value="all">Todas Regiões</option>
            <option value="Norte">Região Norte</option>
            <option value="Sul">Região Sul</option>
          </select>

          <button
            onClick={() => setShowOnlyExceptions(!showOnlyExceptions)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              showOnlyExceptions ? 'bg-amber-500 text-white' : 'bg-surface border border-border'
            )}
          >
            <Filter className="w-3 h-3" />
            {showOnlyExceptions ? 'Gestão por Exceção' : 'Todos os Sistemas'}
          </button>

          <button
            onClick={() => setShowSOE(!showSOE)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              showSOE ? 'bg-primary text-white' : 'bg-surface border border-border'
            )}
          >
            <Clock className="w-3 h-3" />
            SOE Log
          </button>

          <button
            onClick={() => setShowTickets(!showTickets)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              showTickets ? 'bg-violet-500 text-white' : 'bg-surface border border-border'
            )}
          >
            <Ticket className="w-3 h-3" />
            Chamados ({jiraTickets.length})
          </button>

          <button
            onClick={() => setShowSoHPanel(!showSoHPanel)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              showSoHPanel ? 'bg-cyan-500 text-white' : 'bg-surface border border-border'
            )}
          >
            <Calculator className="w-3 h-3" />
            SoH Lab
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

      {/* Jira Tickets Panel */}
      {showTickets && jiraTickets.length > 0 && (
        <div className="bg-surface rounded-xl border border-violet-500/30 p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-violet-400" />
            Chamados Automáticos (API Integration)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {jiraTickets.map(ticket => (
              <div key={ticket.id} className="p-3 bg-surface-hover rounded-lg flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-violet-400">{ticket.id}</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs',
                      ticket.status === 'open' ? 'bg-red-500/20 text-red-400' :
                      ticket.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    )}>
                      {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Andamento' : 'Resolvido'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{ticket.bessName} - {ticket.type}</p>
                  <p className="text-xs text-foreground-muted">{ticket.createdAt.toLocaleString('pt-BR')}</p>
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  ticket.severity === 1 ? 'bg-red-500/20' : ticket.severity === 2 ? 'bg-amber-500/20' : 'bg-blue-500/20'
                )}>
                  <span className="text-xs font-bold">S{ticket.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SoH Lab Panel - Coulomb Counting + Kalman Filter */}
      {showSoHPanel && (
        <div className="bg-surface rounded-xl border border-cyan-500/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              SoH Lab - Calculador em Tempo Real
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'json')}
                className="px-2 py-1 text-xs rounded bg-surface-hover border border-border"
              >
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
              <button
                onClick={() => exportSoHReport(exportFormat)}
                className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Exportar Relatório
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {bessUnits.filter(u => u.status !== 'offline').slice(0, 4).map(unit => {
              const report = generateSoHReport(unit);
              return (
                <div key={unit.id} className="p-3 bg-surface-hover rounded-lg">
                  <h4 className="font-medium text-sm text-foreground truncate">{unit.name.replace('BESS ', '')}</h4>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Coulomb Counting:</span>
                      <span className="text-cyan-400">{report.coulombCountingResult.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Kalman Filter:</span>
                      <span className="text-cyan-400">{report.kalmanFilterResult.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">SoH Combinado:</span>
                      <span className={cn(
                        'font-semibold',
                        report.avgSoH >= 85 ? 'text-emerald-400' : report.avgSoH >= 70 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {report.avgSoH.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Taxa Degradação:</span>
                      <span className={cn(report.degradationRate > 0.5 ? 'text-red-400' : 'text-foreground')}>
                        {report.degradationRate.toFixed(2)}%/mês
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">EOL Estimado:</span>
                      <span className="text-foreground">{report.estimatedEOL.toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  {report.recommendations.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-500/10 rounded text-xs text-amber-400">
                      {report.recommendations[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-foreground-muted mt-3">
            Algoritmos: Coulomb Counting (integração de corrente) + Kalman Filter (fusão de sensores) para estimativa de precisão laboratorial
          </p>
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
          <span className="text-xs text-foreground-muted">
            {selectedRegion === 'all' ? 'Aplicável a todos' : `Aplicável à ${selectedRegion}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGlobalCommand('conservation-norte')}
            className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors flex items-center gap-1"
          >
            <Shield className="w-3 h-3" />
            Modo Conservação - Norte
          </button>
          <button
            onClick={() => setGlobalCommand('conservation-sul')}
            className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors flex items-center gap-1"
          >
            <Shield className="w-3 h-3" />
            Modo Conservação - Sul
          </button>
          <button
            onClick={() => setGlobalCommand('peak-shaving')}
            className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors flex items-center gap-1"
          >
            <TrendingDown className="w-3 h-3" />
            Peak Shaving - Todos
          </button>
          <button
            onClick={() => setGlobalCommand('frequency-reg')}
            className="px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
          >
            <Waves className="w-3 h-3" />
            Regulação de Frequência
          </button>
          <button
            onClick={() => setGlobalCommand('firmware')}
            className="px-3 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-colors flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            Firmware OTA - v2.4.2 ({bessUnits.filter(u => u.firmwareUpdateAvailable).length} pendentes)
          </button>
          <button
            onClick={() => setGlobalCommand('watchdog-reset')}
            className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Gateway - Offline
          </button>
          <button
            onClick={() => exportSoHReport('pdf')}
            className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            Relatório SoH (PDF)
          </button>
          <button
            onClick={() => exportSoHReport('json')}
            className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
          >
            <FileJson className="w-3 h-3" />
            Relatório SoH (JSON)
          </button>
          <button
            onClick={() => setGlobalCommand('alarm-suppress')}
            className="px-3 py-2 bg-gray-500/20 text-gray-400 rounded-lg text-sm hover:bg-gray-500/30 transition-colors flex items-center gap-1"
          >
            <BellOff className="w-3 h-3" />
            Suprimir Alarmes Cascata
          </button>
        </div>
        {globalCommand && (
          <div className="mt-3 p-2 bg-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Comando "{globalCommand}" enviado para a frota. Aguardando confirmação de {bessUnits.filter(u => u.status !== 'offline').length} sistemas...
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
                  <div className="flex items-center gap-2">
                    {unit.edgeMode && <span className="text-xs px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded">EDGE</span>}
                    <span className="text-cyan-400">{unit.edgeAutonomyHours}h</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-foreground-muted mt-2">
              Capacidade de operação inteligente sem internet
            </p>
          </div>

          {/* Watchdog Status */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Watchdog Monitor
            </h3>
            <div className="space-y-2">
              {bessUnits.map(unit => {
                const wdStatus = watchdogStatuses.get(unit.id);
                return (
                  <div key={unit.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                    <span className={cn(
                      'flex items-center gap-1 text-xs',
                      !wdStatus || wdStatus.status === 'healthy' ? 'text-emerald-500' :
                      wdStatus.status === 'warning' ? 'text-amber-500' :
                      wdStatus.status === 'resetting' ? 'text-blue-500' : 'text-red-500'
                    )}>
                      {wdStatus?.status === 'resetting' && <RotateCcw className="w-3 h-3 animate-spin" />}
                      {wdStatus?.status === 'failed' && <XCircle className="w-3 h-3" />}
                      {(!wdStatus || wdStatus.status === 'healthy') ? 'OK' :
                       wdStatus.status === 'warning' ? `${wdStatus.consecutiveFailures} falhas` :
                       wdStatus.status === 'resetting' ? 'Resetando...' : 'Falhou'}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-foreground-muted mt-2">
              Auto-reset de gateway após 3 falhas consecutivas
            </p>
          </div>

          {/* Impedance Monitor */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <CircuitBoard className="w-4 h-4" />
              Impedância Interna
            </h3>
            <div className="space-y-2">
              {bessUnits.filter(u => u.status !== 'offline').map(unit => {
                const impedanceIncrease = ((unit.impedance - unit.impedanceBaseline) / unit.impedanceBaseline) * 100;
                const isAlert = impedanceIncrease > 20;
                return (
                  <div key={unit.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground-muted truncate">{unit.name.replace('BESS ', '')}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono', isAlert ? 'text-red-400' : 'text-foreground')}>
                        {unit.impedance.toFixed(2)}mΩ
                      </span>
                      {isAlert && (
                        <span className="text-xs text-red-400">+{impedanceIncrease.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-foreground-muted mt-2">
              Baseline: 0.85mΩ | Alerta: +20%
            </p>
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

      {/* Georeferenced Heat Map with Leaflet */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Mapa de Calor Georreferenciado
        </h3>
        <div className="relative h-80 rounded-lg overflow-hidden">
          <MapContainer
            center={[-5.5, -42.5]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
            className="rounded-lg"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {bessUnits.map((unit) => {
              const statusColor = unit.status === 'online' ? '#10b981' :
                unit.status === 'warning' ? '#f59e0b' :
                unit.status === 'critical' ? '#ef4444' : '#6b7280';

              const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `
                  <div style="
                    width: 24px;
                    height: 24px;
                    background: ${statusColor};
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                    ${unit.status === 'critical' ? 'animation: pulse 1s infinite;' : ''}
                  "></div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              });

              return (
                <Marker
                  key={unit.id}
                  position={[unit.coordinates.lat, unit.coordinates.lng]}
                  icon={customIcon}
                >
                  <Popup>
                    <div className="p-2 min-w-48">
                      <h4 className="font-bold text-sm">{unit.name}</h4>
                      <p className="text-xs text-gray-600">{unit.location}</p>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <span className={`ml-1 font-medium ${
                            unit.status === 'online' ? 'text-emerald-600' :
                            unit.status === 'warning' ? 'text-amber-600' :
                            unit.status === 'critical' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {unit.status.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">SOC:</span>
                          <span className="ml-1 font-medium">{unit.soc.toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">SoH:</span>
                          <span className="ml-1 font-medium">{unit.soh.toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Temp:</span>
                          <span className={`ml-1 font-medium ${unit.temperature > 35 ? 'text-red-600' : ''}`}>
                            {unit.temperature.toFixed(1)}°C
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Potência:</span>
                          <span className="ml-1 font-medium">{unit.powerMW.toFixed(1)} MW</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Latência:</span>
                          <span className={`ml-1 font-medium ${unit.latencyMs > 500 ? 'text-amber-600' : ''}`}>
                            {unit.latencyMs > 5000 ? 'OFFLINE' : `${unit.latencyMs.toFixed(0)}ms`}
                          </span>
                        </div>
                      </div>
                      {unit.alarms.length > 0 && (
                        <div className="mt-2 p-1 bg-red-50 rounded text-xs text-red-700">
                          {unit.alarms[0].message}
                        </div>
                      )}
                      <Link
                        to={`/systems/${unit.id}`}
                        className="mt-2 block text-center text-xs text-blue-600 hover:underline"
                      >
                        Ver detalhes →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Online</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500" /> Alerta</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Crítico</div>
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

  // Delta V filter - ignore momentary spikes
  const deltaVAnalysis = filterDeltaV(unit.deltaVHistory, unit.deltaVAtRest, deltaVThreshold);

  // Impedance analysis
  const impedanceIncrease = ((unit.impedance - unit.impedanceBaseline) / unit.impedanceBaseline) * 100;
  const impedanceAlert = impedanceIncrease > 20;

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

  const pcsStatusColors = {
    running: 'text-emerald-400',
    standby: 'text-amber-400',
    fault: 'text-red-400',
    offline: 'text-gray-400',
  };

  const bmsStatusColors = {
    active: 'text-emerald-400',
    balancing: 'text-cyan-400',
    fault: 'text-red-400',
    offline: 'text-gray-400',
  };

  const hvacStatusColors = {
    cooling: 'text-cyan-400',
    heating: 'text-orange-400',
    standby: 'text-emerald-400',
    fault: 'text-red-400',
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
        <>
          {/* Component Status Row */}
          <div className="flex items-center gap-3 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-foreground-muted">PCS:</span>
              <span className={pcsStatusColors[unit.pcsStatus]}>{unit.pcsStatus}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground-muted">BMS:</span>
              <span className={bmsStatusColors[unit.bmsStatus]}>{unit.bmsStatus}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground-muted">HVAC:</span>
              <span className={hvacStatusColors[unit.hvacStatus]}>{unit.hvacStatus}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground-muted">Região:</span>
              <span className="text-foreground">{unit.region}</span>
            </div>
          </div>

          {/* Main Stats Grid */}
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
              {unit.temperature > 35 && <p className="text-2xs text-red-400">Fator 1.2x</p>}
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">ΔV</p>
              <p className={cn('font-semibold', deltaVAnalysis.alert ? 'text-red-400' : 'text-foreground')}>
                {deltaVAnalysis.avgDeltaV.toFixed(0)}mV
              </p>
              {deltaVAnalysis.persistentAtRest && <p className="text-2xs text-amber-400">Em repouso</p>}
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Latência</p>
              <p className={cn('font-semibold text-sm', unit.latencyMs > 500 ? 'text-amber-400' : unit.latencyMs > 1000 ? 'text-red-400' : 'text-foreground')}>
                {unit.latencyMs.toFixed(0)}ms
              </p>
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Impedância</p>
              <p className={cn('font-semibold text-sm', impedanceAlert ? 'text-red-400' : 'text-foreground')}>
                {unit.impedance.toFixed(2)}mΩ
              </p>
              {impedanceAlert && <p className="text-2xs text-red-400">+{impedanceIncrease.toFixed(0)}%</p>}
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">HVAC</p>
              <p className={cn('font-semibold text-sm', hvacAlert ? 'text-red-400' : 'text-foreground')}>
                {hvacEfficiency.toFixed(1)}%
              </p>
              {hvacAlert && <p className="text-2xs text-red-400">Verificar</p>}
            </div>
            <div className="text-center p-2 bg-surface rounded-lg">
              <p className="text-xs text-foreground-muted">Edge</p>
              <p className="font-semibold text-sm text-cyan-400">{unit.edgeAutonomyHours}h</p>
            </div>
          </div>
        </>
      )}

      {/* Suppressed Alarms Notice */}
      {unit.suppressedAlarms > 0 && (
        <div className="mt-2 px-2 py-1 bg-gray-500/20 rounded text-xs text-gray-400 flex items-center gap-1">
          <BellOff className="w-3 h-3" />
          {unit.suppressedAlarms} alarmes individuais suprimidos (cascata)
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
