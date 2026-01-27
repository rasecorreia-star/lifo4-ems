/**
 * Grid Services Page
 * Configuration and monitoring of grid services including:
 * - Frequency Regulation (FCR, aFRR, mFRR)
 * - Voltage Support (Reactive Power)
 * - Peak Shaving
 * - Demand Response
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Play,
  Pause,
  BarChart3,
  Gauge,
  Power,
  Info,
  DollarSign,
  Calendar,
  Target,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { gridApi, systemsApi } from '@/services/api';

// Types
interface GridService {
  id: string;
  name: string;
  type: 'fcr' | 'afrr' | 'mfrr' | 'voltage' | 'peak_shaving' | 'demand_response';
  status: 'active' | 'standby' | 'disabled' | 'triggered';
  isEnabled: boolean;
  config: {
    responseTime?: number;
    capacity?: number;
    deadband?: number;
    droopRate?: number;
    minPower?: number;
    maxPower?: number;
    targetValue?: number;
    triggerThreshold?: number;
  };
  metrics: {
    activations24h: number;
    energyDelivered: number;
    revenue: number;
    availability: number;
    performance: number;
  };
  lastActivation?: Date;
}

interface FrequencyData {
  time: string;
  frequency: number;
  setpoint: number;
  response: number;
}

interface VoltageData {
  time: string;
  voltage: number;
  reactivePower: number;
}

// Mock data generators
const generateFrequencyData = (): FrequencyData[] => {
  const data: FrequencyData[] = [];
  const now = Date.now();
  for (let i = 59; i >= 0; i--) {
    const time = new Date(now - i * 1000);
    const anomaly = i >= 25 && i <= 35;
    const frequency = anomaly
      ? 59.7 + Math.random() * 0.2
      : 60 + (Math.random() - 0.5) * 0.05;
    const response = anomaly ? (60 - frequency) * 20 : 0;
    data.push({
      time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      frequency,
      setpoint: 60,
      response,
    });
  }
  return data;
};

const generateVoltageData = (): VoltageData[] => {
  const data: VoltageData[] = [];
  const now = Date.now();
  for (let i = 59; i >= 0; i--) {
    const time = new Date(now - i * 60000);
    data.push({
      time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      voltage: 220 + (Math.random() - 0.5) * 10,
      reactivePower: (Math.random() - 0.5) * 50,
    });
  }
  return data;
};

const mockGridServices: GridService[] = [
  {
    id: 'fcr-001',
    name: 'FCR - Controle de Frequencia Primario',
    type: 'fcr',
    status: 'active',
    isEnabled: true,
    config: {
      responseTime: 30,
      capacity: 50,
      deadband: 0.02,
      droopRate: 4,
      minPower: -50,
      maxPower: 50,
    },
    metrics: {
      activations24h: 156,
      energyDelivered: 245,
      revenue: 1850,
      availability: 99.2,
      performance: 97.5,
    },
    lastActivation: new Date(Date.now() - 300000),
  },
  {
    id: 'afrr-001',
    name: 'aFRR - Regulacao Automatica de Frequencia',
    type: 'afrr',
    status: 'standby',
    isEnabled: true,
    config: {
      responseTime: 300,
      capacity: 30,
      minPower: -30,
      maxPower: 30,
    },
    metrics: {
      activations24h: 48,
      energyDelivered: 180,
      revenue: 2200,
      availability: 98.5,
      performance: 96.8,
    },
    lastActivation: new Date(Date.now() - 7200000),
  },
  {
    id: 'voltage-001',
    name: 'Suporte de Tensao',
    type: 'voltage',
    status: 'active',
    isEnabled: true,
    config: {
      targetValue: 220,
      deadband: 5,
      minPower: -100,
      maxPower: 100,
    },
    metrics: {
      activations24h: 89,
      energyDelivered: 0,
      revenue: 450,
      availability: 99.8,
      performance: 98.2,
    },
    lastActivation: new Date(Date.now() - 60000),
  },
  {
    id: 'peak-001',
    name: 'Peak Shaving',
    type: 'peak_shaving',
    status: 'standby',
    isEnabled: true,
    config: {
      triggerThreshold: 150,
      targetValue: 120,
      capacity: 80,
    },
    metrics: {
      activations24h: 3,
      energyDelivered: 95,
      revenue: 380,
      availability: 100,
      performance: 99.1,
    },
    lastActivation: new Date(Date.now() - 14400000),
  },
  {
    id: 'dr-001',
    name: 'Demand Response',
    type: 'demand_response',
    status: 'disabled',
    isEnabled: false,
    config: {
      responseTime: 900,
      capacity: 100,
    },
    metrics: {
      activations24h: 0,
      energyDelivered: 0,
      revenue: 0,
      availability: 0,
      performance: 0,
    },
  },
];

const SERVICE_COLORS = {
  fcr: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500' },
  afrr: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' },
  mfrr: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500' },
  voltage: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' },
  peak_shaving: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500' },
  demand_response: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500' },
};

export default function GridServices() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<GridService[]>([]);
  const [frequencyData, setFrequencyData] = useState<FrequencyData[]>([]);
  const [voltageData, setVoltageData] = useState<VoltageData[]>([]);
  const [selectedService, setSelectedService] = useState<GridService | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'frequency' | 'voltage'>('overview');

  // Current grid metrics
  const [gridMetrics, setGridMetrics] = useState({
    frequency: 60.02,
    voltage: 221.5,
    powerFactor: 0.98,
    activePower: 125,
    reactivePower: -15,
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setServices(mockGridServices);
        setFrequencyData(generateFrequencyData());
        setVoltageData(generateVoltageData());
      } catch (err) {
        setError('Falha ao carregar servicos de rede');
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
      setFrequencyData(generateFrequencyData());
      setGridMetrics(prev => ({
        ...prev,
        frequency: 60 + (Math.random() - 0.5) * 0.1,
        voltage: 220 + (Math.random() - 0.5) * 5,
        activePower: 120 + Math.random() * 20,
        reactivePower: (Math.random() - 0.5) * 30,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleServiceToggle = (serviceId: string) => {
    setServices(prev => prev.map(service =>
      service.id === serviceId
        ? { ...service, isEnabled: !service.isEnabled, status: service.isEnabled ? 'disabled' : 'standby' }
        : service
    ));
  };

  // Calculate totals
  const totals = useMemo(() => {
    const activeServices = services.filter(s => s.isEnabled);
    return {
      totalRevenue: activeServices.reduce((sum, s) => sum + s.metrics.revenue, 0),
      totalEnergy: activeServices.reduce((sum, s) => sum + s.metrics.energyDelivered, 0),
      avgAvailability: activeServices.length > 0
        ? activeServices.reduce((sum, s) => sum + s.metrics.availability, 0) / activeServices.length
        : 0,
      avgPerformance: activeServices.length > 0
        ? activeServices.reduce((sum, s) => sum + s.metrics.performance, 0) / activeServices.length
        : 0,
    };
  }, [services]);

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'fcr':
      case 'afrr':
      case 'mfrr':
        return Activity;
      case 'voltage':
        return Zap;
      case 'peak_shaving':
        return TrendingDown;
      case 'demand_response':
        return Power;
      default:
        return Gauge;
    }
  };

  if (isLoading) {
    return <GridServicesSkeleton />;
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
          <h1 className="text-2xl font-bold text-foreground">Servicos de Rede</h1>
          <p className="text-foreground-muted mt-1">
            Configuracao de regulacao de frequencia e suporte de tensao
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFrequencyData(generateFrequencyData())}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Current Grid Status */}
      <div className="bg-gradient-to-r from-blue-500/20 to-green-500/20 border border-blue-500/30 rounded-xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="text-center">
            <p className="text-sm text-foreground-muted mb-1">Frequencia</p>
            <p className={cn(
              'text-3xl font-bold',
              Math.abs(gridMetrics.frequency - 60) > 0.1 ? 'text-orange-400' : 'text-green-400'
            )}>
              {gridMetrics.frequency.toFixed(2)} Hz
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground-muted mb-1">Tensao</p>
            <p className={cn(
              'text-3xl font-bold',
              Math.abs(gridMetrics.voltage - 220) > 10 ? 'text-orange-400' : 'text-green-400'
            )}>
              {gridMetrics.voltage.toFixed(1)} V
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground-muted mb-1">Fator de Potencia</p>
            <p className="text-3xl font-bold text-foreground">{gridMetrics.powerFactor.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground-muted mb-1">Potencia Ativa</p>
            <p className="text-3xl font-bold text-blue-400">{gridMetrics.activePower.toFixed(1)} kW</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground-muted mb-1">Potencia Reativa</p>
            <p className={cn(
              'text-3xl font-bold',
              gridMetrics.reactivePower > 0 ? 'text-orange-400' : 'text-green-400'
            )}>
              {gridMetrics.reactivePower.toFixed(1)} kVAr
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Receita (24h)</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">R$ {totals.totalRevenue.toLocaleString()}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Energia Entregue</span>
            <Zap className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totals.totalEnergy.toFixed(0)} kWh</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Disponibilidade</span>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totals.avgAvailability.toFixed(1)}%</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Performance</span>
            <Target className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totals.avgPerformance.toFixed(1)}%</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {(['overview', 'frequency', 'voltage'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            {tab === 'overview' ? 'Visao Geral' : tab === 'frequency' ? 'Regulacao de Frequencia' : 'Suporte de Tensao'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services List */}
          <div className="space-y-4">
            {services.map((service) => {
              const Icon = getServiceIcon(service.type);
              const colors = SERVICE_COLORS[service.type];
              return (
                <div
                  key={service.id}
                  className={cn(
                    'bg-surface border rounded-xl p-4 transition-all',
                    service.isEnabled ? colors.border : 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-3 rounded-lg', colors.bg)}>
                        <Icon className={cn('w-6 h-6', colors.text)} />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{service.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            service.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            service.status === 'triggered' ? 'bg-blue-500/20 text-blue-400' :
                            service.status === 'standby' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          )}>
                            {service.status === 'active' ? 'Ativo' :
                             service.status === 'triggered' ? 'Acionado' :
                             service.status === 'standby' ? 'Standby' : 'Desativado'}
                          </span>
                          {service.lastActivation && (
                            <span className="text-xs text-foreground-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Ultimo: {new Date(service.lastActivation).toLocaleTimeString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleServiceToggle(service.id)}
                      className={cn(
                        'relative w-12 h-6 rounded-full transition-colors',
                        service.isEnabled ? 'bg-primary' : 'bg-gray-600'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                          service.isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-foreground-muted">Ativacoes (24h)</p>
                      <p className="font-medium text-foreground">{service.metrics.activations24h}</p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Energia</p>
                      <p className="font-medium text-foreground">{service.metrics.energyDelivered} kWh</p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Receita</p>
                      <p className="font-medium text-green-400">R$ {service.metrics.revenue}</p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Performance</p>
                      <p className="font-medium text-foreground">{service.metrics.performance}%</p>
                    </div>
                  </div>

                  {service.config.capacity && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex justify-between text-xs text-foreground-muted mb-1">
                        <span>Capacidade Reservada</span>
                        <span>{service.config.capacity} kW</span>
                      </div>
                      <div className="w-full bg-surface-hover rounded-full h-2">
                        <div
                          className={cn('h-2 rounded-full', colors.bg.replace('/20', ''))}
                          style={{ width: '60%' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Real-time Frequency Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Frequencia em Tempo Real
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={frequencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                  <YAxis
                    domain={[59.5, 60.5]}
                    stroke="var(--foreground-muted)"
                    fontSize={12}
                    tickFormatter={(v) => `${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(3)} Hz`]}
                  />
                  <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="3 3" label="60Hz" />
                  <ReferenceLine y={59.8} stroke="#ef4444" strokeDasharray="3 3" />
                  <ReferenceLine y={60.2} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="frequency"
                    name="Frequencia"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-foreground-muted">Frequencia</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-green-500" style={{ width: '12px' }} />
                <span className="text-foreground-muted">Setpoint (60Hz)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-red-500" style={{ width: '12px' }} />
                <span className="text-foreground-muted">Limites</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'frequency' && (
        <div className="space-y-6">
          {/* Frequency Response Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Resposta de Frequencia (FCR/aFRR)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={frequencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                  <YAxis yAxisId="freq" domain={[59.5, 60.5]} stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis yAxisId="power" orientation="right" stroke="var(--foreground-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <ReferenceLine yAxisId="freq" y={60} stroke="#22c55e" strokeDasharray="3 3" />
                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="response"
                    name="Resposta (kW)"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                    stroke="#3B82F6"
                  />
                  <Line
                    yAxisId="freq"
                    type="monotone"
                    dataKey="frequency"
                    name="Frequencia (Hz)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FCR Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Configuracao FCR
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Tempo de Resposta</span>
                  <span className="font-medium text-foreground">30 segundos</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Capacidade Reservada</span>
                  <span className="font-medium text-foreground">50 kW</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Deadband</span>
                  <span className="font-medium text-foreground">+/- 0.02 Hz</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Droop Rate</span>
                  <span className="font-medium text-foreground">4%</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Configuracao aFRR
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Tempo de Resposta</span>
                  <span className="font-medium text-foreground">5 minutos</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Capacidade Reservada</span>
                  <span className="font-medium text-foreground">30 kW</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Potencia Minima</span>
                  <span className="font-medium text-foreground">-30 kW</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Potencia Maxima</span>
                  <span className="font-medium text-foreground">+30 kW</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'voltage' && (
        <div className="space-y-6">
          {/* Voltage Chart */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Suporte de Tensao e Potencia Reativa</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={voltageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                  <YAxis yAxisId="voltage" domain={[200, 240]} stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis yAxisId="reactive" orientation="right" domain={[-100, 100]} stroke="var(--foreground-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <ReferenceLine yAxisId="voltage" y={220} stroke="#22c55e" strokeDasharray="3 3" label="220V" />
                  <Line
                    yAxisId="voltage"
                    type="monotone"
                    dataKey="voltage"
                    name="Tensao (V)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="reactive"
                    type="monotone"
                    dataKey="reactivePower"
                    name="Pot. Reativa (kVAr)"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Voltage Support Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Configuracao de Tensao</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Tensao Alvo</span>
                  <span className="font-medium text-foreground">220 V</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Deadband</span>
                  <span className="font-medium text-foreground">+/- 5 V</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Capacidade Reativa</span>
                  <span className="font-medium text-foreground">+/- 100 kVAr</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <span className="text-foreground">Modo Q(V)</span>
                  <span className="font-medium text-green-400">Ativo</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Curva Q(V)</h3>
              <div className="h-48 flex items-center justify-center border border-border rounded-lg">
                <div className="text-center text-foreground-muted">
                  <Gauge className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Visualizacao da curva Q(V)</p>
                  <p className="text-xs">Em desenvolvimento</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading Skeleton
function GridServicesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      <div className="h-32 bg-surface rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 border border-border h-40 animate-pulse" />
          ))}
        </div>
        <div className="bg-surface rounded-xl border border-border h-96 animate-pulse" />
      </div>
    </div>
  );
}
