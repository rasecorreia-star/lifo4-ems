/**
 * Microgrid Detail Page
 * Detailed view of microgrid components with management capabilities
 * Includes BESS, Solar, Generator, and load management
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Zap,
  Sun,
  Battery,
  Home,
  Factory,
  Wind,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Power,
  Thermometer,
  Gauge,
  Activity,
  Edit,
  Trash2,
  Plus,
  Play,
  Pause,
  MoreVertical,
  Info,
  Cpu,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { systemsApi, telemetryApi, controlApi } from '@/services/api';

// Types
interface MicrogridComponent {
  id: string;
  name: string;
  type: 'bess' | 'solar' | 'wind' | 'generator' | 'load';
  manufacturer?: string;
  model?: string;
  status: 'online' | 'offline' | 'standby' | 'fault' | 'maintenance';
  isControllable: boolean;
  metrics: {
    power: number;
    capacity: number;
    efficiency?: number;
    temperature?: number;
    soc?: number;
    voltage?: number;
    current?: number;
    frequency?: number;
    runtime?: number;
    fuelLevel?: number;
  };
  lastUpdate: Date;
  alarms: string[];
}

interface LoadGroup {
  id: string;
  name: string;
  priority: number;
  power: number;
  isCritical: boolean;
  isSheddable: boolean;
  status: 'active' | 'shed' | 'scheduled';
}

interface ComponentHistoryData {
  time: string;
  power: number;
  efficiency?: number;
}

// Mock data
const mockComponents: MicrogridComponent[] = [
  {
    id: 'bess-001',
    name: 'BESS Principal',
    type: 'bess',
    manufacturer: 'Lifo4',
    model: 'LFP-200',
    status: 'online',
    isControllable: true,
    metrics: {
      power: -45,
      capacity: 200,
      efficiency: 94.5,
      temperature: 28,
      soc: 72,
      voltage: 384,
      current: -117,
    },
    lastUpdate: new Date(),
    alarms: [],
  },
  {
    id: 'solar-001',
    name: 'Usina Solar Norte',
    type: 'solar',
    manufacturer: 'SunPower',
    model: 'SPR-X22-370',
    status: 'online',
    isControllable: false,
    metrics: {
      power: 85,
      capacity: 150,
      efficiency: 21.2,
      temperature: 45,
      voltage: 480,
      current: 177,
    },
    lastUpdate: new Date(),
    alarms: [],
  },
  {
    id: 'wind-001',
    name: 'Turbina Eolica',
    type: 'wind',
    manufacturer: 'Vestas',
    model: 'V52-850',
    status: 'online',
    isControllable: true,
    metrics: {
      power: 32,
      capacity: 50,
      efficiency: 38,
      temperature: 35,
    },
    lastUpdate: new Date(),
    alarms: [],
  },
  {
    id: 'gen-001',
    name: 'Gerador Diesel',
    type: 'generator',
    manufacturer: 'Cummins',
    model: 'QSK60-G6',
    status: 'standby',
    isControllable: true,
    metrics: {
      power: 0,
      capacity: 100,
      efficiency: 42,
      fuelLevel: 85,
      runtime: 1250,
      temperature: 25,
    },
    lastUpdate: new Date(),
    alarms: [],
  },
];

const mockLoadGroups: LoadGroup[] = [
  { id: 'load-1', name: 'Iluminacao de Emergencia', priority: 1, power: 5, isCritical: true, isSheddable: false, status: 'active' },
  { id: 'load-2', name: 'Sistemas de Seguranca', priority: 2, power: 8, isCritical: true, isSheddable: false, status: 'active' },
  { id: 'load-3', name: 'Servidores TI', priority: 3, power: 25, isCritical: true, isSheddable: false, status: 'active' },
  { id: 'load-4', name: 'HVAC - Area Critica', priority: 4, power: 30, isCritical: false, isSheddable: true, status: 'active' },
  { id: 'load-5', name: 'Producao - Linha 1', priority: 5, power: 45, isCritical: false, isSheddable: true, status: 'active' },
  { id: 'load-6', name: 'Producao - Linha 2', priority: 6, power: 40, isCritical: false, isSheddable: true, status: 'active' },
  { id: 'load-7', name: 'Iluminacao Geral', priority: 7, power: 15, isCritical: false, isSheddable: true, status: 'active' },
  { id: 'load-8', name: 'Carregadores EV', priority: 8, power: 22, isCritical: false, isSheddable: true, status: 'shed' },
];

const generateComponentHistory = (): ComponentHistoryData[] => {
  const data = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(Date.now() - i * 3600000);
    data.push({
      time: hour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      power: 30 + Math.random() * 50,
      efficiency: 90 + Math.random() * 8,
    });
  }
  return data;
};

export default function MicrogridDetail() {
  const { microgridId } = useParams<{ microgridId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [components, setComponents] = useState<MicrogridComponent[]>([]);
  const [loadGroups, setLoadGroups] = useState<LoadGroup[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<MicrogridComponent | null>(null);
  const [componentHistory, setComponentHistory] = useState<ComponentHistoryData[]>([]);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'components' | 'loads'>('components');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Replace with actual API calls
        await new Promise(resolve => setTimeout(resolve, 500));
        setComponents(mockComponents);
        setLoadGroups(mockLoadGroups);
        setComponentHistory(generateComponentHistory());
      } catch (err) {
        setError('Falha ao carregar dados do microgrid');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [microgridId]);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setComponents(prev => prev.map(comp => ({
        ...comp,
        metrics: {
          ...comp.metrics,
          power: comp.status === 'online' ? comp.metrics.power + (Math.random() - 0.5) * 5 : comp.metrics.power,
          temperature: comp.metrics.temperature ? comp.metrics.temperature + (Math.random() - 0.5) * 0.5 : undefined,
        },
        lastUpdate: new Date(),
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleComponentControl = async (componentId: string, action: 'start' | 'stop' | 'standby') => {
    try {
      // await controlApi.sendCommand(componentId, action);
      setComponents(prev => prev.map(comp =>
        comp.id === componentId
          ? { ...comp, status: action === 'start' ? 'online' : action === 'stop' ? 'offline' : 'standby' }
          : comp
      ));
    } catch (err) {
      console.error('Failed to control component:', err);
    }
  };

  const handleLoadShedding = (loadId: string, shed: boolean) => {
    setLoadGroups(prev => prev.map(load =>
      load.id === loadId
        ? { ...load, status: shed ? 'shed' : 'active' }
        : load
    ));
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case 'bess': return Battery;
      case 'solar': return Sun;
      case 'wind': return Wind;
      case 'generator': return Factory;
      case 'load': return Home;
      default: return Power;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      online: 'bg-green-500/20 text-green-400',
      offline: 'bg-gray-500/20 text-gray-400',
      standby: 'bg-yellow-500/20 text-yellow-400',
      fault: 'bg-red-500/20 text-red-400',
      maintenance: 'bg-blue-500/20 text-blue-400',
    };
    const labels = {
      online: 'Online',
      offline: 'Offline',
      standby: 'Standby',
      fault: 'Falha',
      maintenance: 'Manutencao',
    };
    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', styles[status as keyof typeof styles])}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (isLoading) {
    return <MicrogridDetailSkeleton />;
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

  const totalGeneration = components
    .filter(c => c.type !== 'bess' || c.metrics.power > 0)
    .reduce((sum, c) => sum + Math.max(0, c.metrics.power), 0);
  const totalLoad = loadGroups.filter(l => l.status === 'active').reduce((sum, l) => sum + l.power, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/microgrids"
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detalhes do Microgrid</h1>
            <p className="text-foreground-muted mt-1">Gerenciamento de componentes e cargas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Adicionar Componente
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover">
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-5 h-5 text-primary" />
            <span className="text-foreground-muted text-sm">Componentes</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{components.length}</div>
          <div className="text-xs text-success-500 mt-1">
            {components.filter(c => c.status === 'online').length} online
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-foreground-muted text-sm">Geracao Total</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalGeneration.toFixed(1)} kW</div>
          <div className="text-xs text-foreground-muted mt-1">
            Solar + Eolica + Gerador
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-5 h-5 text-purple-400" />
            <span className="text-foreground-muted text-sm">Carga Ativa</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalLoad.toFixed(1)} kW</div>
          <div className="text-xs text-foreground-muted mt-1">
            {loadGroups.filter(l => l.status === 'active').length}/{loadGroups.length} grupos
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="text-foreground-muted text-sm">Balanco</span>
          </div>
          <div className={cn(
            'text-2xl font-bold',
            totalGeneration >= totalLoad ? 'text-green-400' : 'text-orange-400'
          )}>
            {totalGeneration >= totalLoad ? '+' : ''}{(totalGeneration - totalLoad).toFixed(1)} kW
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            {totalGeneration >= totalLoad ? 'Superavit' : 'Deficit'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('components')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'components'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          )}
        >
          Componentes
        </button>
        <button
          onClick={() => setActiveTab('loads')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'loads'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          )}
        >
          Gestao de Cargas
        </button>
      </div>

      {activeTab === 'components' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Components List */}
          <div className="space-y-4">
            {components.map((component) => {
              const Icon = getComponentIcon(component.type);
              return (
                <div
                  key={component.id}
                  className={cn(
                    'bg-surface border rounded-xl p-4 transition-all cursor-pointer',
                    selectedComponent?.id === component.id ? 'border-primary' : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setSelectedComponent(component)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-lg',
                        component.status === 'online' ? 'bg-green-500/20' :
                        component.status === 'standby' ? 'bg-yellow-500/20' :
                        component.status === 'fault' ? 'bg-red-500/20' : 'bg-gray-500/20'
                      )}>
                        <Icon className={cn(
                          'w-6 h-6',
                          component.status === 'online' ? 'text-green-400' :
                          component.status === 'standby' ? 'text-yellow-400' :
                          component.status === 'fault' ? 'text-red-400' : 'text-gray-400'
                        )} />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{component.name}</h3>
                        <p className="text-xs text-foreground-muted">{component.manufacturer} {component.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(component.status)}
                      {component.isControllable && (
                        <div className="relative">
                          <button className="p-1 hover:bg-surface-hover rounded">
                            <MoreVertical className="w-4 h-4 text-foreground-muted" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-foreground-muted">Potencia</p>
                      <p className={cn(
                        'font-medium',
                        component.metrics.power > 0 ? 'text-green-400' :
                        component.metrics.power < 0 ? 'text-orange-400' : 'text-foreground'
                      )}>
                        {component.metrics.power > 0 ? '+' : ''}{component.metrics.power.toFixed(1)} kW
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground-muted">Capacidade</p>
                      <p className="font-medium text-foreground">{component.metrics.capacity} kW</p>
                    </div>
                    {component.metrics.soc !== undefined && (
                      <div>
                        <p className="text-foreground-muted">SOC</p>
                        <p className="font-medium text-foreground">{component.metrics.soc}%</p>
                      </div>
                    )}
                    {component.metrics.efficiency !== undefined && (
                      <div>
                        <p className="text-foreground-muted">Eficiencia</p>
                        <p className="font-medium text-foreground">{component.metrics.efficiency}%</p>
                      </div>
                    )}
                    {component.metrics.temperature !== undefined && (
                      <div>
                        <p className="text-foreground-muted">Temperatura</p>
                        <p className="font-medium text-foreground">{component.metrics.temperature.toFixed(1)}C</p>
                      </div>
                    )}
                    {component.metrics.fuelLevel !== undefined && (
                      <div>
                        <p className="text-foreground-muted">Combustivel</p>
                        <p className="font-medium text-foreground">{component.metrics.fuelLevel}%</p>
                      </div>
                    )}
                  </div>

                  {component.isControllable && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      {component.status === 'online' ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleComponentControl(component.id, 'standby'); }}
                            className="flex-1 px-3 py-2 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30"
                          >
                            Standby
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleComponentControl(component.id, 'stop'); }}
                            className="flex-1 px-3 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                          >
                            Parar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleComponentControl(component.id, 'start'); }}
                          className="flex-1 px-3 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                        >
                          <Play className="w-4 h-4 inline mr-2" />
                          Iniciar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Component Details Panel */}
          <div className="bg-surface border border-border rounded-xl p-6">
            {selectedComponent ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-foreground">{selectedComponent.name}</h3>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-surface-hover rounded-lg">
                      <Edit className="w-4 h-4 text-foreground-muted" />
                    </button>
                    <button className="p-2 hover:bg-surface-hover rounded-lg">
                      <Settings className="w-4 h-4 text-foreground-muted" />
                    </button>
                  </div>
                </div>

                {/* Power History Chart */}
                <div className="h-64 mb-6">
                  <p className="text-sm text-foreground-muted mb-2">Historico de Potencia (24h)</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={componentHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                      <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="power"
                        name="Potencia (kW)"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(selectedComponent.metrics).map(([key, value]) => {
                    if (value === undefined) return null;
                    const labels: Record<string, string> = {
                      power: 'Potencia',
                      capacity: 'Capacidade',
                      efficiency: 'Eficiencia',
                      temperature: 'Temperatura',
                      soc: 'SOC',
                      voltage: 'Tensao',
                      current: 'Corrente',
                      frequency: 'Frequencia',
                      runtime: 'Horas de Uso',
                      fuelLevel: 'Combustivel',
                    };
                    const units: Record<string, string> = {
                      power: 'kW',
                      capacity: 'kW',
                      efficiency: '%',
                      temperature: 'C',
                      soc: '%',
                      voltage: 'V',
                      current: 'A',
                      frequency: 'Hz',
                      runtime: 'h',
                      fuelLevel: '%',
                    };
                    return (
                      <div key={key} className="p-3 bg-surface-hover rounded-lg">
                        <p className="text-xs text-foreground-muted">{labels[key] || key}</p>
                        <p className="text-lg font-medium text-foreground">
                          {typeof value === 'number' ? value.toFixed(1) : value} {units[key] || ''}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Alarms */}
                {selectedComponent.alarms.length > 0 && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Alarmes Ativos
                    </h4>
                    <ul className="space-y-1">
                      {selectedComponent.alarms.map((alarm, i) => (
                        <li key={i} className="text-sm text-foreground">{alarm}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-foreground-muted">
                <Info className="w-12 h-12 mb-4 opacity-50" />
                <p>Selecione um componente para ver detalhes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'loads' && (
        <div className="space-y-6">
          {/* Load Shedding Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-foreground-muted text-sm">Cargas Ativas</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadGroups.filter(l => l.status === 'active').length}
              </div>
              <div className="text-xs text-foreground-muted mt-1">
                {loadGroups.filter(l => l.status === 'active').reduce((sum, l) => sum + l.power, 0).toFixed(1)} kW total
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <span className="text-foreground-muted text-sm">Cargas Cortadas</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadGroups.filter(l => l.status === 'shed').length}
              </div>
              <div className="text-xs text-foreground-muted mt-1">
                {loadGroups.filter(l => l.status === 'shed').reduce((sum, l) => sum + l.power, 0).toFixed(1)} kW economizados
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="text-foreground-muted text-sm">Cargas Criticas</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadGroups.filter(l => l.isCritical).length}
              </div>
              <div className="text-xs text-foreground-muted mt-1">
                Protegidas de corte
              </div>
            </div>
          </div>

          {/* Load Groups Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Grupos de Carga</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                <Plus className="w-4 h-4" />
                Novo Grupo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-hover">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Prioridade</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Nome</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Potencia</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Critico</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {loadGroups.sort((a, b) => a.priority - b.priority).map((load) => (
                    <tr key={load.id} className="border-b border-border hover:bg-surface-hover">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-medium">
                          {load.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-foreground-muted" />
                          <span className="font-medium text-foreground">{load.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">{load.power} kW</td>
                      <td className="py-3 px-4 text-center">
                        {load.isCritical ? (
                          <Shield className="w-5 h-5 text-blue-400 mx-auto" />
                        ) : (
                          <span className="text-foreground-muted">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          load.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          load.status === 'shed' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-blue-500/20 text-blue-400'
                        )}>
                          {load.status === 'active' ? 'Ativo' : load.status === 'shed' ? 'Cortado' : 'Agendado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {load.isSheddable && (
                          <button
                            onClick={() => handleLoadShedding(load.id, load.status === 'active')}
                            className={cn(
                              'px-3 py-1 text-sm rounded-lg transition-colors',
                              load.status === 'active'
                                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            )}
                          >
                            {load.status === 'active' ? 'Cortar' : 'Restaurar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading Skeleton
function MicrogridDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded animate-pulse" />
        <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 border border-border h-48 animate-pulse" />
          ))}
        </div>
        <div className="bg-surface rounded-xl border border-border h-[500px] animate-pulse" />
      </div>
    </div>
  );
}
