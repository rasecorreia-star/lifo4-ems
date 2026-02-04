/**
 * Microgrid Dashboard Page - Enterprise Grade
 * Complete microgrid management with grid-forming control,
 * islanding management, and grid services
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Sun,
  Battery,
  Home,
  Factory,
  Wind,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Power,
  Gauge,
  TrendingUp,
  TrendingDown,
  Shield,
  Wifi,
  WifiOff,
  Settings,
  Play,
  Pause,
  AlertCircle,
  Thermometer,
  Droplets,
  CloudSun,
  Moon,
  Waves,
  CircleDot,
  Target,
  Radio,
  ToggleLeft,
  ToggleRight,
  Plug,
  Unplug,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

// Types
interface MicrogridStatus {
  id: string;
  name: string;
  operatingMode: 'grid_connected' | 'islanded' | 'black_start' | 'transitioning';
  connectionState: 'connected' | 'disconnected' | 'syncing';
  totalCapacity: number;
  currentLoad: number;
  frequency: number;
  targetFrequency: number;
  voltage: number;
  targetVoltage: number;
  powerFactor: number;
  isHealthy: boolean;
  gridFormingActive: boolean;
  lastModeChange: string;
}

interface PowerFlowData {
  solarPower: number;
  solarCapacity: number;
  windPower: number;
  windCapacity: number;
  bessPower: number;
  bessCapacity: number;
  bessSoc: number;
  generatorPower: number;
  generatorCapacity: number;
  generatorFuel: number;
  gridPower: number;
  gridLimit: number;
  loadPower: number;
  criticalLoad: number;
  sheddableLoad: number;
  selfConsumptionRate: number;
  renewableShare: number;
}

interface GridService {
  id: string;
  name: string;
  type: 'fcr' | 'afrr' | 'voltage' | 'black_start' | 'peak_shaving';
  status: 'active' | 'standby' | 'disabled' | 'triggered';
  allocation: number;
  response?: number;
  revenue?: number;
}

interface ComponentStatus {
  id: string;
  name: string;
  type: 'bess' | 'solar' | 'wind' | 'generator' | 'grid' | 'load';
  status: 'online' | 'offline' | 'warning' | 'fault' | 'standby';
  power: number;
  capacity: number;
  isGridForming?: boolean;
}

interface WeatherForecast {
  time: string;
  solarIrradiance: number;
  windSpeed: number;
  temperature: number;
  cloudCover: number;
}

// Constants
const OPERATING_MODE_CONFIG = {
  grid_connected: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500',
    icon: Plug,
    label: 'Conectado a Rede',
    description: 'Sistema sincronizado com a rede eletrica'
  },
  islanded: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500',
    icon: Shield,
    label: 'Modo Ilha',
    description: 'Operando independente da rede'
  },
  black_start: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500',
    icon: Power,
    label: 'Black Start',
    description: 'Restauracao autonoma em andamento'
  },
  transitioning: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500',
    icon: Radio,
    label: 'Em Transicao',
    description: 'Alterando modo de operacao...'
  },
};

// Generate mock data
const generatePowerHistory = () => {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    const isSolarHour = hour.getHours() >= 6 && hour.getHours() <= 18;
    const solarFactor = isSolarHour ? Math.sin((hour.getHours() - 6) / 12 * Math.PI) : 0;
    data.push({
      time: hour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      solar: solarFactor * 150 + Math.random() * 10,
      wind: 20 + Math.random() * 40,
      bess: Math.random() > 0.5 ? -(20 + Math.random() * 30) : (15 + Math.random() * 25),
      generator: Math.random() > 0.9 ? 50 + Math.random() * 30 : 0,
      grid: 50 + Math.random() * 50 - 25,
      load: 100 + Math.random() * 80,
    });
  }
  return data;
};

const generateFrequencyHistory = () => {
  const data = [];
  for (let i = 59; i >= 0; i--) {
    data.push({
      time: `${i}s`,
      frequency: 60 + (Math.random() - 0.5) * 0.15,
      target: 60,
    });
  }
  return data;
};

const generateWeatherForecast = (): WeatherForecast[] => {
  const data: WeatherForecast[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now.getTime() + i * 3600000);
    const hourOfDay = hour.getHours();
    const isSolarHour = hourOfDay >= 6 && hourOfDay <= 18;
    data.push({
      time: hour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      solarIrradiance: isSolarHour ? Math.sin((hourOfDay - 6) / 12 * Math.PI) * 800 + Math.random() * 100 : 0,
      windSpeed: 5 + Math.random() * 10,
      temperature: 22 + Math.sin((hourOfDay - 6) / 12 * Math.PI) * 8,
      cloudCover: Math.random() * 50,
    });
  }
  return data;
};

export default function MicrogridDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedMicrogrid, setSelectedMicrogrid] = useState<string>('mg-001');
  const [activeTab, setActiveTab] = useState<'overview' | 'grid_services' | 'forecast'>('overview');

  // State
  const [microgridStatus, setMicrogridStatus] = useState<MicrogridStatus>({
    id: 'mg-001',
    name: 'Microgrid Principal',
    operatingMode: 'grid_connected',
    connectionState: 'connected',
    totalCapacity: 500,
    currentLoad: 180,
    frequency: 60.02,
    targetFrequency: 60.00,
    voltage: 220.5,
    targetVoltage: 220.0,
    powerFactor: 0.98,
    isHealthy: true,
    gridFormingActive: true,
    lastModeChange: new Date(Date.now() - 86400000).toISOString(),
  });

  const [powerFlow, setPowerFlow] = useState<PowerFlowData>({
    solarPower: 85,
    solarCapacity: 150,
    windPower: 32,
    windCapacity: 50,
    bessPower: -25,
    bessCapacity: 200,
    bessSoc: 72,
    generatorPower: 0,
    generatorCapacity: 100,
    generatorFuel: 85,
    gridPower: 88,
    gridLimit: 500,
    loadPower: 180,
    criticalLoad: 50,
    sheddableLoad: 130,
    selfConsumptionRate: 78,
    renewableShare: 65,
  });

  const [gridServices, setGridServices] = useState<GridService[]>([
    { id: 'fcr', name: 'FCR - Reserva Primaria', type: 'fcr', status: 'active', allocation: 20, response: 0.8, revenue: 1250 },
    { id: 'afrr', name: 'aFRR - Reserva Secundaria', type: 'afrr', status: 'standby', allocation: 30, response: 0, revenue: 890 },
    { id: 'voltage', name: 'Controle de Tensao', type: 'voltage', status: 'active', allocation: 15, revenue: 450 },
    { id: 'peak', name: 'Peak Shaving', type: 'peak_shaving', status: 'active', allocation: 50, revenue: 2100 },
    { id: 'blackstart', name: 'Black Start', type: 'black_start', status: 'standby', allocation: 100 },
  ]);

  const [components, setComponents] = useState<ComponentStatus[]>([
    { id: 'bess-001', name: 'BESS Principal', type: 'bess', status: 'online', power: 25, capacity: 200, isGridForming: true },
    { id: 'solar-001', name: 'Usina Solar', type: 'solar', status: 'online', power: 85, capacity: 150 },
    { id: 'wind-001', name: 'Turbina Eolica', type: 'wind', status: 'online', power: 32, capacity: 50 },
    { id: 'gen-001', name: 'Gerador Diesel', type: 'generator', status: 'standby', power: 0, capacity: 100 },
    { id: 'grid-001', name: 'Conexao Rede', type: 'grid', status: 'online', power: 88, capacity: 500 },
  ]);

  const [powerHistory] = useState(generatePowerHistory());
  const [frequencyHistory, setFrequencyHistory] = useState(generateFrequencyHistory());
  const [weatherForecast] = useState(generateWeatherForecast());

  // Energy distribution for pie chart
  const energyDistribution = useMemo(() => [
    { name: 'Solar', value: powerFlow.solarPower, color: '#FBBF24' },
    { name: 'Eolica', value: powerFlow.windPower, color: '#60A5FA' },
    { name: 'BESS', value: Math.max(0, -powerFlow.bessPower), color: '#34D399' },
    { name: 'Gerador', value: powerFlow.generatorPower, color: '#F87171' },
    { name: 'Rede', value: Math.max(0, powerFlow.gridPower), color: '#A78BFA' },
  ].filter(item => item.value > 0), [powerFlow]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setLastUpdate(new Date());
      setIsLoading(false);
    };
    loadData();
  }, [selectedMicrogrid]);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update power flow
      setPowerFlow(prev => ({
        ...prev,
        solarPower: Math.max(0, prev.solarPower + (Math.random() - 0.5) * 5),
        windPower: Math.max(0, prev.windPower + (Math.random() - 0.5) * 3),
        bessPower: prev.bessPower + (Math.random() - 0.5) * 5,
        gridPower: prev.gridPower + (Math.random() - 0.5) * 8,
        loadPower: Math.max(0, prev.loadPower + (Math.random() - 0.5) * 4),
        bessSoc: Math.max(0, Math.min(100, prev.bessSoc + (prev.bessPower < 0 ? 0.02 : -0.02))),
      }));

      // Update frequency
      setMicrogridStatus(prev => ({
        ...prev,
        frequency: 60 + (Math.random() - 0.5) * 0.08,
        voltage: 220 + (Math.random() - 0.5) * 1.5,
        currentLoad: 180 + (Math.random() - 0.5) * 15,
      }));

      // Update frequency history
      setFrequencyHistory(prev => {
        const newData = [...prev.slice(1), {
          time: '0s',
          frequency: 60 + (Math.random() - 0.5) * 0.1,
          target: 60,
        }];
        return newData;
      });

      setLastUpdate(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Mode change handler
  const handleModeChange = async (newMode: MicrogridStatus['operatingMode']) => {
    if (newMode === microgridStatus.operatingMode) return;

    setMicrogridStatus(prev => ({
      ...prev,
      operatingMode: 'transitioning',
    }));

    // Simulate transition
    await new Promise(resolve => setTimeout(resolve, 3000));

    setMicrogridStatus(prev => ({
      ...prev,
      operatingMode: newMode,
      connectionState: newMode === 'islanded' || newMode === 'black_start' ? 'disconnected' : 'connected',
      lastModeChange: new Date().toISOString(),
    }));
  };

  const modeConfig = OPERATING_MODE_CONFIG[microgridStatus.operatingMode];
  const ModeIcon = modeConfig.icon;

  // Calculate power balance
  const totalGeneration = powerFlow.solarPower + powerFlow.windPower +
    (powerFlow.bessPower < 0 ? 0 : powerFlow.bessPower) + powerFlow.generatorPower +
    (powerFlow.gridPower > 0 ? powerFlow.gridPower : 0);
  const powerBalance = totalGeneration - powerFlow.loadPower;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" />
            Dashboard do Microgrid
          </h1>
          <p className="text-foreground-muted mt-1">
            Ultima atualizacao: {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMicrogrid}
            onChange={(e) => setSelectedMicrogrid(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary"
          >
            <option value="mg-001">Microgrid Principal</option>
            <option value="mg-002">Microgrid Industrial</option>
            <option value="mg-003">Microgrid Residencial</option>
          </select>
          <button
            onClick={() => setLastUpdate(new Date())}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Operating Mode Banner */}
      <div className={cn(
        'p-6 rounded-xl border-2 transition-all',
        modeConfig.bg,
        modeConfig.border
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={cn('p-4 rounded-full', modeConfig.bg)}>
              <ModeIcon className={cn('w-8 h-8', modeConfig.text)} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className={cn('text-2xl font-bold', modeConfig.text)}>
                  {modeConfig.label}
                </h2>
                {microgridStatus.gridFormingActive && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    Grid-Forming Ativo
                  </span>
                )}
              </div>
              <p className="text-foreground-muted">{modeConfig.description}</p>
              <p className="text-xs text-foreground-subtle mt-1">
                {microgridStatus.name} | {microgridStatus.isHealthy ? 'Sistema Saudavel' : 'Atencao Necessaria'}
              </p>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            <div className="text-center">
              <p className="text-sm text-foreground-muted">Frequencia</p>
              <p className={cn(
                'text-xl font-bold',
                Math.abs(microgridStatus.frequency - 60) < 0.05 ? 'text-green-400' :
                Math.abs(microgridStatus.frequency - 60) < 0.1 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {microgridStatus.frequency.toFixed(3)} Hz
              </p>
              <p className="text-xs text-foreground-subtle">Meta: {microgridStatus.targetFrequency.toFixed(2)} Hz</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground-muted">Tensao</p>
              <p className="text-xl font-bold text-foreground">{microgridStatus.voltage.toFixed(1)} V</p>
              <p className="text-xs text-foreground-subtle">Meta: {microgridStatus.targetVoltage.toFixed(0)} V</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground-muted">Fator de Potencia</p>
              <p className="text-xl font-bold text-foreground">{microgridStatus.powerFactor.toFixed(2)}</p>
              <p className="text-xs text-foreground-subtle">Ideal: 1.00</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground-muted">Carga</p>
              <p className="text-xl font-bold text-foreground">{microgridStatus.currentLoad.toFixed(0)} kW</p>
              <p className="text-xs text-foreground-subtle">{((microgridStatus.currentLoad / microgridStatus.totalCapacity) * 100).toFixed(0)}% capacidade</p>
            </div>
          </div>

          {/* Mode Controls */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-foreground-muted text-center">Mudar Modo</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange('grid_connected')}
                disabled={microgridStatus.operatingMode === 'transitioning'}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  microgridStatus.operatingMode === 'grid_connected'
                    ? 'bg-green-500 text-white'
                    : 'bg-surface hover:bg-surface-hover text-foreground-muted'
                )}
                title="Conectado a Rede"
              >
                <Plug className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleModeChange('islanded')}
                disabled={microgridStatus.operatingMode === 'transitioning'}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  microgridStatus.operatingMode === 'islanded'
                    ? 'bg-orange-500 text-white'
                    : 'bg-surface hover:bg-surface-hover text-foreground-muted'
                )}
                title="Modo Ilha"
              >
                <Shield className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleModeChange('black_start')}
                disabled={microgridStatus.operatingMode === 'transitioning'}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  microgridStatus.operatingMode === 'black_start'
                    ? 'bg-red-500 text-white'
                    : 'bg-surface hover:bg-surface-hover text-foreground-muted'
                )}
                title="Black Start"
              >
                <Power className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {[
          { id: 'overview', label: 'Visao Geral', icon: Gauge },
          { id: 'grid_services', label: 'Servicos de Rede', icon: Activity },
          { id: 'forecast', label: 'Previsao', icon: CloudSun },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Power Flow Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <PowerCard
              label="Solar"
              value={powerFlow.solarPower}
              capacity={powerFlow.solarCapacity}
              icon={Sun}
              color="yellow"
            />
            <PowerCard
              label="Eolica"
              value={powerFlow.windPower}
              capacity={powerFlow.windCapacity}
              icon={Wind}
              color="blue"
            />
            <PowerCard
              label="BESS"
              value={Math.abs(powerFlow.bessPower)}
              capacity={powerFlow.bessCapacity}
              icon={Battery}
              color="green"
              isCharging={powerFlow.bessPower < 0}
              soc={powerFlow.bessSoc}
            />
            <PowerCard
              label="Gerador"
              value={powerFlow.generatorPower}
              capacity={powerFlow.generatorCapacity}
              icon={Factory}
              color="red"
              fuelLevel={powerFlow.generatorFuel}
            />
            <PowerCard
              label="Rede"
              value={Math.abs(powerFlow.gridPower)}
              capacity={powerFlow.gridLimit}
              icon={Zap}
              color="purple"
              isExporting={powerFlow.gridPower < 0}
            />
            <PowerCard
              label="Carga"
              value={powerFlow.loadPower}
              capacity={microgridStatus.totalCapacity}
              icon={Home}
              color="gray"
              criticalLoad={powerFlow.criticalLoad}
            />
          </div>

          {/* Power Balance Indicator */}
          <div className={cn(
            'p-4 rounded-xl border flex items-center justify-between',
            powerBalance >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          )}>
            <div className="flex items-center gap-3">
              {powerBalance >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-500" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-500" />
              )}
              <div>
                <p className="font-medium text-foreground">Balanco de Potencia</p>
                <p className="text-sm text-foreground-muted">
                  {powerBalance >= 0 ? 'Superavit de energia' : 'Deficit de energia'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-2xl font-bold',
                powerBalance >= 0 ? 'text-green-500' : 'text-red-500'
              )}>
                {powerBalance >= 0 ? '+' : ''}{powerBalance.toFixed(1)} kW
              </p>
              <p className="text-xs text-foreground-muted">
                Renovavel: {powerFlow.renewableShare.toFixed(0)}% | Autoconsumo: {powerFlow.selfConsumptionRate.toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Power Flow Chart */}
            <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Fluxo de Potencia (24h)</h3>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={powerHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                    <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kW" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="solar" name="Solar" fill="#FBBF24" fillOpacity={0.6} stroke="#FBBF24" stackId="1" />
                    <Area type="monotone" dataKey="wind" name="Eolica" fill="#60A5FA" fillOpacity={0.6} stroke="#60A5FA" stackId="1" />
                    <Area type="monotone" dataKey="generator" name="Gerador" fill="#F87171" fillOpacity={0.6} stroke="#F87171" stackId="1" />
                    <Line type="monotone" dataKey="load" name="Carga" stroke="#A78BFA" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Energy Distribution */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Distribuicao</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={energyDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {energyDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)} kW`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {energyDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <span className="text-foreground-muted">{item.value.toFixed(1)} kW</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Frequency Monitoring */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Monitoramento de Frequencia</h3>
                <p className="text-sm text-foreground-muted">Ultimo minuto - Atualizacao em tempo real</p>
              </div>
              <div className="text-right">
                <p className={cn(
                  'text-2xl font-bold',
                  Math.abs(microgridStatus.frequency - 60) < 0.05 ? 'text-green-400' : 'text-yellow-400'
                )}>
                  {microgridStatus.frequency.toFixed(3)} Hz
                </p>
                <p className="text-xs text-foreground-muted">Desvio: {((microgridStatus.frequency - 60) * 1000).toFixed(1)} mHz</p>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={frequencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                  <YAxis domain={[59.9, 60.1]} stroke="var(--foreground-muted)" fontSize={10} />
                  <ReferenceLine y={60} stroke="var(--primary)" strokeDasharray="3 3" />
                  <ReferenceLine y={59.95} stroke="#f97316" strokeDasharray="3 3" />
                  <ReferenceLine y={60.05} stroke="#f97316" strokeDasharray="3 3" />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(3)} Hz`]} />
                  <Line type="monotone" dataKey="frequency" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Components Status */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Status dos Componentes</h3>
              <Link to="/microgrids/detail" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver detalhes <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {components.map((component) => (
                <ComponentCard key={component.id} component={component} />
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'grid_services' && (
        <div className="space-y-6">
          {/* Grid Services Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-sm text-foreground-muted">Servicos Ativos</p>
              <p className="text-2xl font-bold text-foreground">
                {gridServices.filter(s => s.status === 'active').length}
              </p>
              <p className="text-xs text-success-500">de {gridServices.length} configurados</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-sm text-foreground-muted">Capacidade Alocada</p>
              <p className="text-2xl font-bold text-foreground">
                {gridServices.filter(s => s.status === 'active').reduce((sum, s) => sum + s.allocation, 0)} kW
              </p>
              <p className="text-xs text-foreground-muted">para servicos ancilares</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-sm text-foreground-muted">Resposta FCR</p>
              <p className="text-2xl font-bold text-primary">
                {(gridServices.find(s => s.type === 'fcr')?.response || 0).toFixed(1)} kW
              </p>
              <p className="text-xs text-foreground-muted">ativado agora</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-sm text-foreground-muted">Receita Estimada</p>
              <p className="text-2xl font-bold text-green-500">
                R$ {gridServices.reduce((sum, s) => sum + (s.revenue || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-foreground-muted">este mes</p>
            </div>
          </div>

          {/* Grid Services List */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Servicos Ancilares de Rede</h3>
            </div>
            <div className="divide-y divide-border">
              {gridServices.map(service => (
                <div key={service.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'p-2 rounded-lg',
                      service.status === 'active' ? 'bg-green-500/20' :
                      service.status === 'triggered' ? 'bg-blue-500/20' :
                      service.status === 'standby' ? 'bg-yellow-500/20' : 'bg-gray-500/20'
                    )}>
                      {service.type === 'fcr' && <Waves className="w-5 h-5 text-blue-500" />}
                      {service.type === 'afrr' && <Activity className="w-5 h-5 text-purple-500" />}
                      {service.type === 'voltage' && <Gauge className="w-5 h-5 text-orange-500" />}
                      {service.type === 'peak_shaving' && <TrendingDown className="w-5 h-5 text-green-500" />}
                      {service.type === 'black_start' && <Power className="w-5 h-5 text-red-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{service.name}</p>
                      <p className="text-sm text-foreground-muted">Alocacao: {service.allocation} kW</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {service.response !== undefined && (
                      <div className="text-center">
                        <p className="text-sm text-foreground-muted">Resposta</p>
                        <p className="font-medium text-foreground">{service.response.toFixed(1)} kW</p>
                      </div>
                    )}
                    {service.revenue !== undefined && (
                      <div className="text-center">
                        <p className="text-sm text-foreground-muted">Receita</p>
                        <p className="font-medium text-green-500">R$ {service.revenue.toLocaleString()}</p>
                      </div>
                    )}
                    <span className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      service.status === 'active' ? 'bg-green-500/20 text-green-500' :
                      service.status === 'triggered' ? 'bg-blue-500/20 text-blue-500' :
                      service.status === 'standby' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-gray-500/20 text-gray-500'
                    )}>
                      {service.status === 'active' ? 'Ativo' :
                       service.status === 'triggered' ? 'Acionado' :
                       service.status === 'standby' ? 'Standby' : 'Desativado'}
                    </span>
                    <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
                      <Settings className="w-4 h-4 text-foreground-muted" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-6">
          {/* Weather Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-foreground-muted">Irradiancia</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {weatherForecast[0]?.solarIrradiance.toFixed(0)} W/m2
              </p>
              <p className="text-xs text-foreground-muted">atual</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-foreground-muted">Vento</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {weatherForecast[0]?.windSpeed.toFixed(1)} m/s
              </p>
              <p className="text-xs text-foreground-muted">atual</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-foreground-muted">Temperatura</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {weatherForecast[0]?.temperature.toFixed(1)}C
              </p>
              <p className="text-xs text-foreground-muted">atual</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CloudSun className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-foreground-muted">Nebulosidade</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {weatherForecast[0]?.cloudCover.toFixed(0)}%
              </p>
              <p className="text-xs text-foreground-muted">atual</p>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Previsao de Geracao (24h)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weatherForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                  <YAxis yAxisId="irr" stroke="#FBBF24" fontSize={10} />
                  <YAxis yAxisId="wind" orientation="right" stroke="#60A5FA" fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="irr"
                    type="monotone"
                    dataKey="solarIrradiance"
                    name="Irradiancia (W/m2)"
                    fill="#FBBF24"
                    fillOpacity={0.6}
                    stroke="#FBBF24"
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="windSpeed"
                    name="Vento (m/s)"
                    stroke="#60A5FA"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          to="/microgrids/detail"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <Gauge className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-foreground">Detalhes</p>
            <p className="text-xs text-foreground-muted">Gerenciar componentes</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>

        <Link
          to="/blackstart"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <Power className="w-6 h-6 text-red-500" />
          <div>
            <p className="font-medium text-foreground">Black Start</p>
            <p className="text-xs text-foreground-muted">Restauracao de rede</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>

        <Link
          to="/trading-dashboard"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <TrendingUp className="w-6 h-6 text-green-500" />
          <div>
            <p className="font-medium text-foreground">Trading</p>
            <p className="text-xs text-foreground-muted">Mercado de energia</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>

        <Link
          to="/demand-response"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <Activity className="w-6 h-6 text-blue-500" />
          <div>
            <p className="font-medium text-foreground">Demand Response</p>
            <p className="text-xs text-foreground-muted">Gestao de demanda</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>
      </div>
    </div>
  );
}

// Power Card Component
interface PowerCardProps {
  label: string;
  value: number;
  capacity: number;
  icon: React.ElementType;
  color: 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'gray';
  isCharging?: boolean;
  isExporting?: boolean;
  soc?: number;
  fuelLevel?: number;
  criticalLoad?: number;
}

function PowerCard({ label, value, capacity, icon: Icon, color, isCharging, isExporting, soc, fuelLevel, criticalLoad }: PowerCardProps) {
  const colorMap = {
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-500', fill: 'bg-yellow-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-500', fill: 'bg-blue-500' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-500', fill: 'bg-green-500' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500', fill: 'bg-red-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-500', fill: 'bg-purple-500' },
    gray: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-500', fill: 'bg-gray-500' },
  };

  const c = colorMap[color];
  const percentage = (value / capacity) * 100;

  return (
    <div className={cn('rounded-xl border p-4', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-foreground-muted">{label}</span>
        <Icon className={cn('w-5 h-5', c.text)} />
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-bold text-foreground">{value.toFixed(1)}</span>
        <span className="text-sm text-foreground-muted">kW</span>
      </div>
      {(isCharging !== undefined || isExporting !== undefined) && (
        <p className="text-xs text-foreground-muted mb-2">
          {isCharging ? 'Carregando' : isExporting ? 'Exportando' : 'Descarregando/Importando'}
        </p>
      )}
      <div className="w-full bg-background rounded-full h-1.5 mb-1">
        <div className={cn('h-1.5 rounded-full transition-all', c.fill)} style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
      <div className="flex justify-between text-xs text-foreground-muted">
        <span>{percentage.toFixed(0)}%</span>
        <span>{capacity} kW</span>
      </div>
      {soc !== undefined && (
        <p className="text-xs text-foreground-muted mt-1">SOC: {soc.toFixed(0)}%</p>
      )}
      {fuelLevel !== undefined && (
        <p className="text-xs text-foreground-muted mt-1">Combustivel: {fuelLevel}%</p>
      )}
      {criticalLoad !== undefined && (
        <p className="text-xs text-foreground-muted mt-1">Critica: {criticalLoad} kW</p>
      )}
    </div>
  );
}

// Component Card
function ComponentCard({ component }: { component: ComponentStatus }) {
  const iconMap = {
    bess: Battery,
    solar: Sun,
    wind: Wind,
    generator: Factory,
    grid: Zap,
    load: Home,
  };
  const Icon = iconMap[component.type];

  const statusColors = {
    online: 'bg-green-500/10 border-green-500/30 text-green-500',
    offline: 'bg-gray-500/10 border-gray-500/30 text-gray-500',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
    fault: 'bg-red-500/10 border-red-500/30 text-red-500',
    standby: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  };

  return (
    <div className={cn('p-4 rounded-xl border', statusColors[component.status].split(' ').slice(0, 2).join(' '))}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className={cn('w-5 h-5', statusColors[component.status].split(' ')[2])} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{component.name}</p>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs capitalize', statusColors[component.status].split(' ')[2])}>
              {component.status}
            </span>
            {component.isGridForming && (
              <span className="text-xs text-purple-400">GFM</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-foreground-muted">Potencia</span>
        <span className="font-medium text-foreground">{component.power} kW</span>
      </div>
      <div className="w-full bg-background rounded-full h-1 mt-2">
        <div
          className={cn('h-1 rounded-full', statusColors[component.status].split(' ')[2].replace('text-', 'bg-'))}
          style={{ width: `${(component.power / component.capacity) * 100}%` }}
        />
      </div>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      <div className="h-40 bg-surface rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border h-32 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-surface rounded-xl animate-pulse" />
        <div className="h-80 bg-surface rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
