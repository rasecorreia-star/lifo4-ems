/**
 * Microgrid Dashboard Page
 * Overview dashboard with power flow diagram, operating status,
 * and real-time microgrid monitoring
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
  Power,
  Gauge,
  TrendingUp,
  TrendingDown,
  Shield,
  Wifi,
  WifiOff,
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
} from 'recharts';
import { cn } from '@/lib/utils';
import { systemsApi, telemetryApi, gridApi } from '@/services/api';

// Types
interface MicrogridStatus {
  id: string;
  name: string;
  operatingMode: 'grid_connected' | 'islanded' | 'black_start' | 'transitioning';
  totalCapacity: number;
  currentLoad: number;
  frequency: number;
  voltage: number;
  powerFactor: number;
  isHealthy: boolean;
}

interface PowerFlowData {
  solarPower: number;
  windPower: number;
  bessPower: number;
  generatorPower: number;
  gridPower: number;
  loadPower: number;
  bessSoc: number;
  selfConsumptionRate: number;
}

interface ComponentStatus {
  id: string;
  name: string;
  type: 'bess' | 'solar' | 'wind' | 'generator' | 'grid';
  status: 'online' | 'offline' | 'warning' | 'fault';
  power: number;
  capacity: number;
}

interface EnergyDistribution {
  name: string;
  value: number;
  color: string;
}

// Mock data generators
const generatePowerHistory = () => {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    const isSolarHour = hour.getHours() >= 6 && hour.getHours() <= 18;
    data.push({
      time: hour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      solar: isSolarHour ? Math.sin((hour.getHours() - 6) / 12 * Math.PI) * 150 + Math.random() * 20 : 0,
      wind: 20 + Math.random() * 40,
      bess: Math.random() > 0.5 ? -(20 + Math.random() * 30) : (15 + Math.random() * 25),
      generator: Math.random() > 0.8 ? 50 + Math.random() * 30 : 0,
      load: 100 + Math.random() * 80,
    });
  }
  return data;
};

const OPERATING_MODE_COLORS = {
  grid_connected: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' },
  islanded: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500' },
  black_start: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500' },
  transitioning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' },
};

const OPERATING_MODE_LABELS = {
  grid_connected: 'Conectado a Rede',
  islanded: 'Modo Ilha',
  black_start: 'Black Start',
  transitioning: 'Em Transicao',
};

export default function MicrogridDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedMicrogrid, setSelectedMicrogrid] = useState<string>('mg-001');

  // Mock states
  const [microgridStatus, setMicrogridStatus] = useState<MicrogridStatus>({
    id: 'mg-001',
    name: 'Microgrid Principal',
    operatingMode: 'grid_connected',
    totalCapacity: 500,
    currentLoad: 180,
    frequency: 60.02,
    voltage: 220.5,
    powerFactor: 0.98,
    isHealthy: true,
  });

  const [powerFlow, setPowerFlow] = useState<PowerFlowData>({
    solarPower: 85,
    windPower: 32,
    bessPower: -25,
    generatorPower: 0,
    gridPower: 88,
    loadPower: 180,
    bessSoc: 72,
    selfConsumptionRate: 78,
  });

  const [components, setComponents] = useState<ComponentStatus[]>([
    { id: 'bess-001', name: 'BESS Principal', type: 'bess', status: 'online', power: 25, capacity: 200 },
    { id: 'solar-001', name: 'Usina Solar', type: 'solar', status: 'online', power: 85, capacity: 150 },
    { id: 'wind-001', name: 'Turbina Eolica', type: 'wind', status: 'online', power: 32, capacity: 50 },
    { id: 'gen-001', name: 'Gerador Diesel', type: 'generator', status: 'offline', power: 0, capacity: 100 },
    { id: 'grid-001', name: 'Conexao Rede', type: 'grid', status: 'online', power: 88, capacity: 500 },
  ]);

  const [powerHistory] = useState(generatePowerHistory());

  // Energy distribution for pie chart
  const energyDistribution: EnergyDistribution[] = useMemo(() => [
    { name: 'Solar', value: powerFlow.solarPower, color: '#FBBF24' },
    { name: 'Eolica', value: powerFlow.windPower, color: '#60A5FA' },
    { name: 'BESS', value: Math.max(0, powerFlow.bessPower), color: '#34D399' },
    { name: 'Gerador', value: powerFlow.generatorPower, color: '#F87171' },
    { name: 'Rede', value: Math.max(0, powerFlow.gridPower), color: '#A78BFA' },
  ].filter(item => item.value > 0), [powerFlow]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // In production, replace with actual API calls
        // const status = await gridApi.getMicrogridStatus(selectedMicrogrid);
        await new Promise(resolve => setTimeout(resolve, 500));
        setLastUpdate(new Date());
      } catch (err) {
        setError('Falha ao carregar dados do microgrid');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedMicrogrid]);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time power flow updates
      setPowerFlow(prev => ({
        ...prev,
        solarPower: Math.max(0, prev.solarPower + (Math.random() - 0.5) * 10),
        windPower: Math.max(0, prev.windPower + (Math.random() - 0.5) * 5),
        bessPower: prev.bessPower + (Math.random() - 0.5) * 5,
        gridPower: Math.max(0, prev.gridPower + (Math.random() - 0.5) * 8),
        loadPower: Math.max(0, prev.loadPower + (Math.random() - 0.5) * 6),
        bessSoc: Math.max(0, Math.min(100, prev.bessSoc + (Math.random() - 0.5) * 0.5)),
      }));

      setMicrogridStatus(prev => ({
        ...prev,
        frequency: 60 + (Math.random() - 0.5) * 0.1,
        voltage: 220 + (Math.random() - 0.5) * 2,
        currentLoad: 180 + (Math.random() - 0.5) * 20,
      }));

      setLastUpdate(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLastUpdate(new Date());
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case 'bess': return Battery;
      case 'solar': return Sun;
      case 'wind': return Wind;
      case 'generator': return Factory;
      case 'grid': return Zap;
      default: return Power;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'offline': return 'text-gray-400';
      case 'warning': return 'text-yellow-400';
      case 'fault': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return <MicrogridDashboardSkeleton />;
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

  const modeColors = OPERATING_MODE_COLORS[microgridStatus.operatingMode];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard do Microgrid</h1>
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
            onClick={handleRefresh}
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
        modeColors.bg,
        modeColors.border
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn('p-4 rounded-full', modeColors.bg)}>
              {microgridStatus.operatingMode === 'grid_connected' ? (
                <Zap className={cn('w-8 h-8', modeColors.text)} />
              ) : microgridStatus.operatingMode === 'islanded' ? (
                <Shield className={cn('w-8 h-8', modeColors.text)} />
              ) : (
                <Power className={cn('w-8 h-8', modeColors.text)} />
              )}
            </div>
            <div>
              <h2 className={cn('text-2xl font-bold', modeColors.text)}>
                {OPERATING_MODE_LABELS[microgridStatus.operatingMode]}
              </h2>
              <p className="text-foreground-muted">
                {microgridStatus.name} - {microgridStatus.isHealthy ? 'Sistema Saudavel' : 'Atencao Necessaria'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm text-foreground-muted">Frequencia</p>
              <p className="text-xl font-bold text-foreground">{microgridStatus.frequency.toFixed(2)} Hz</p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Tensao</p>
              <p className="text-xl font-bold text-foreground">{microgridStatus.voltage.toFixed(1)} V</p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Fator de Potencia</p>
              <p className="text-xl font-bold text-foreground">{microgridStatus.powerFactor.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Carga Total</span>
            <Home className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{powerFlow.loadPower.toFixed(1)} kW</div>
          <div className="text-xs text-foreground-muted mt-1">
            {((powerFlow.loadPower / microgridStatus.totalCapacity) * 100).toFixed(0)}% da capacidade
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Geracao Renovavel</span>
            <Sun className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {(powerFlow.solarPower + powerFlow.windPower).toFixed(1)} kW
          </div>
          <div className="flex items-center gap-1 text-xs text-success-500 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>{powerFlow.selfConsumptionRate.toFixed(0)}% autoconsumo</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">BESS SOC</span>
            <Battery className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{powerFlow.bessSoc.toFixed(0)}%</div>
          <div className={cn(
            'text-xs mt-1',
            powerFlow.bessPower < 0 ? 'text-green-400' : 'text-orange-400'
          )}>
            {powerFlow.bessPower < 0 ? 'Carregando' : 'Descarregando'}: {Math.abs(powerFlow.bessPower).toFixed(1)} kW
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Fluxo da Rede</span>
            <Zap className={cn('w-5 h-5', powerFlow.gridPower > 0 ? 'text-blue-400' : 'text-green-400')} />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {powerFlow.gridPower > 0 ? '+' : ''}{powerFlow.gridPower.toFixed(1)} kW
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            {powerFlow.gridPower > 0 ? 'Importando' : 'Exportando'}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Power Flow Visualization */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Fluxo de Potencia (24h)</h3>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="h-80">
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
                <Area
                  type="monotone"
                  dataKey="solar"
                  name="Solar"
                  fill="#FBBF24"
                  fillOpacity={0.6}
                  stroke="#FBBF24"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="wind"
                  name="Eolica"
                  fill="#60A5FA"
                  fillOpacity={0.6}
                  stroke="#60A5FA"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="generator"
                  name="Gerador"
                  fill="#F87171"
                  fillOpacity={0.6}
                  stroke="#F87171"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="load"
                  name="Carga"
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Distribution Pie Chart */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuicao de Energia</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={energyDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {energyDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)} kW`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
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

      {/* Components Status */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Status dos Componentes</h3>
          <Link
            to="/microgrids/detail"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver detalhes <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {components.map((component) => {
            const Icon = getComponentIcon(component.type);
            return (
              <div
                key={component.id}
                className={cn(
                  'p-4 rounded-lg border transition-all',
                  component.status === 'online' ? 'bg-green-500/10 border-green-500/30' :
                  component.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  component.status === 'fault' ? 'bg-red-500/10 border-red-500/30' :
                  'bg-gray-500/10 border-gray-500/30'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Icon className={cn('w-6 h-6', getStatusColor(component.status))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{component.name}</p>
                    <p className={cn('text-xs capitalize', getStatusColor(component.status))}>
                      {component.status === 'online' ? 'Online' :
                       component.status === 'offline' ? 'Offline' :
                       component.status === 'warning' ? 'Alerta' : 'Falha'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-muted">Potencia</span>
                    <span className="text-foreground font-medium">{component.power} kW</span>
                  </div>
                  <div className="w-full bg-surface-hover rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        component.status === 'online' ? 'bg-green-500' :
                        component.status === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
                      )}
                      style={{ width: `${(component.power / component.capacity) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-foreground-muted text-right">
                    {component.capacity} kW max
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          to="/microgrids/detail"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <Gauge className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-foreground">Detalhes do Microgrid</p>
            <p className="text-xs text-foreground-muted">Gerenciar componentes</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>

        <Link
          to="/microgrids/grid-services"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <Activity className="w-6 h-6 text-blue-400" />
          <div>
            <p className="font-medium text-foreground">Servicos de Rede</p>
            <p className="text-xs text-foreground-muted">FCR, aFRR, Voltage</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>

        <Link
          to="/microgrids/islanding"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <Shield className="w-6 h-6 text-orange-400" />
          <div>
            <p className="font-medium text-foreground">Controle de Ilhamento</p>
            <p className="text-xs text-foreground-muted">Black start e transicao</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>

        <Link
          to="/microgrids/trading"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <TrendingUp className="w-6 h-6 text-green-400" />
          <div>
            <p className="font-medium text-foreground">Comercializacao</p>
            <p className="text-xs text-foreground-muted">Mercado de energia</p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted ml-auto" />
        </Link>
      </div>
    </div>
  );
}

// Loading Skeleton
function MicrogridDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      <div className="h-32 bg-surface rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border">
            <div className="h-4 w-20 bg-surface-hover rounded mb-2 animate-pulse" />
            <div className="h-8 w-24 bg-surface-hover rounded mb-1 animate-pulse" />
            <div className="h-3 w-32 bg-surface-hover rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-surface rounded-xl animate-pulse" />
        <div className="h-96 bg-surface rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
