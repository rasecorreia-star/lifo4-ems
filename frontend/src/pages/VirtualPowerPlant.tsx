import { useState, useMemo, useEffect } from 'react';
import {
  Network,
  Battery,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Settings,
  Map,
  BarChart3,
  Activity,
  DollarSign,
  Clock,
  Power,
  Target,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
} from 'recharts';

interface VPPAsset {
  id: string;
  name: string;
  location: string;
  capacity: number;
  currentPower: number;
  soc: number;
  status: 'online' | 'offline' | 'maintenance' | 'dispatching';
  dispatchable: boolean;
}

interface DispatchEvent {
  id: string;
  type: 'demand_response' | 'frequency_regulation' | 'peak_shaving' | 'arbitrage';
  startTime: string;
  duration: number;
  power: number;
  revenue: number;
  status: 'scheduled' | 'active' | 'completed';
}

export default function VirtualPowerPlant() {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'dispatch' | 'analytics'>('overview');
  const [vppMode, setVppMode] = useState<'auto' | 'manual'>('auto');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const assets: VPPAsset[] = useMemo(() => [
    { id: '1', name: 'BESS Teresina Centro', location: 'Teresina, PI', capacity: 5000, currentPower: 1250, soc: 72, status: 'dispatching', dispatchable: true },
    { id: '2', name: 'BESS Parnaiba Sul', location: 'Parnaiba, PI', capacity: 2000, currentPower: 0, soc: 85, status: 'online', dispatchable: true },
    { id: '3', name: 'BESS Floriano Centro', location: 'Floriano, PI', capacity: 1000, currentPower: -500, soc: 45, status: 'online', dispatchable: true },
    { id: '4', name: 'BESS Picos Industrial', location: 'Picos, PI', capacity: 3000, currentPower: 750, soc: 68, status: 'dispatching', dispatchable: true },
    { id: '5', name: 'BESS Piripiri Norte', location: 'Piripiri, PI', capacity: 1500, currentPower: 0, soc: 90, status: 'maintenance', dispatchable: false },
    { id: '6', name: 'BESS Oeiras Solar', location: 'Oeiras, PI', capacity: 2500, currentPower: 1000, soc: 55, status: 'dispatching', dispatchable: true },
  ], []);

  const dispatchEvents: DispatchEvent[] = useMemo(() => [
    { id: '1', type: 'demand_response', startTime: '2025-01-25T18:00', duration: 3, power: 3500, revenue: 4200, status: 'active' },
    { id: '2', type: 'frequency_regulation', startTime: '2025-01-25T14:00', duration: 4, power: 1500, revenue: 1800, status: 'completed' },
    { id: '3', type: 'peak_shaving', startTime: '2025-01-25T19:00', duration: 2, power: 4000, revenue: 3200, status: 'scheduled' },
    { id: '4', type: 'arbitrage', startTime: '2025-01-26T06:00', duration: 4, power: -3000, revenue: 2100, status: 'scheduled' },
  ], []);

  const aggregatedStats = useMemo(() => {
    const totalCapacity = assets.reduce((sum, a) => sum + a.capacity, 0);
    const currentPower = assets.reduce((sum, a) => sum + a.currentPower, 0);
    const avgSoc = assets.reduce((sum, a) => sum + a.soc, 0) / assets.length;
    const onlineAssets = assets.filter(a => a.status !== 'offline' && a.status !== 'maintenance').length;
    const dispatchingPower = assets.filter(a => a.status === 'dispatching').reduce((sum, a) => sum + Math.abs(a.currentPower), 0);
    return { totalCapacity, currentPower, avgSoc, onlineAssets, dispatchingPower };
  }, [assets]);

  const [realtimeData, setRealtimeData] = useState<{ time: string; power: number; price: number }[]>([]);

  useEffect(() => {
    const initialData = Array.from({ length: 24 }, (_, i) => ({
      time: `${i.toString().padStart(2, '0')}:00`,
      power: Math.floor(Math.random() * 3000) - 1000,
      price: 150 + Math.floor(Math.random() * 100),
    }));
    setRealtimeData(initialData);
  }, []);

  const capacityByLocation = useMemo(() => {
    const locationObj: Record<string, number> = {};
    assets.forEach(asset => {
      const city = asset.location.split(',')[0];
      locationObj[city] = (locationObj[city] || 0) + asset.capacity;
    });
    return Object.entries(locationObj).map(([name, value]) => ({ name, value }));
  }, [assets]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const getStatusColor = (status: VPPAsset['status']) => {
    switch (status) {
      case 'online': return 'text-success-500';
      case 'dispatching': return 'text-primary';
      case 'maintenance': return 'text-warning-500';
      case 'offline': return 'text-danger-500';
    }
  };

  const getStatusBadge = (status: VPPAsset['status']) => {
    switch (status) {
      case 'online':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500"><CheckCircle className="w-3 h-3" /> Online</span>;
      case 'dispatching':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/20 text-primary"><Zap className="w-3 h-3" /> Despachando</span>;
      case 'maintenance':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500"><Settings className="w-3 h-3" /> Manutencao</span>;
      case 'offline':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500"><AlertTriangle className="w-3 h-3" /> Offline</span>;
    }
  };

  const getEventTypeLabel = (type: DispatchEvent['type']) => {
    switch (type) {
      case 'demand_response': return 'Resp. Demanda';
      case 'frequency_regulation': return 'Reg. Frequencia';
      case 'peak_shaving': return 'Peak Shaving';
      case 'arbitrage': return 'Arbitragem';
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev =>
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Virtual Power Plant</h1>
          <p className="text-foreground-muted">Agregacao e despacho coordenado de ativos</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
            <span className="text-sm text-foreground-muted">Modo:</span>
            <button
              onClick={() => setVppMode('auto')}
              className={`px-3 py-1 text-sm rounded ${
                vppMode === 'auto' ? 'bg-primary text-white' : 'bg-surface-hover text-foreground'
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => setVppMode('manual')}
              className={`px-3 py-1 text-sm rounded ${
                vppMode === 'manual' ? 'bg-primary text-white' : 'bg-surface-hover text-foreground'
              }`}
            >
              Manual
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Capacidade Total</p>
              <p className="text-xl font-bold text-foreground">{(aggregatedStats.totalCapacity / 1000).toFixed(1)} MW</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Potencia Atual</p>
              <p className={`text-xl font-bold ${aggregatedStats.currentPower >= 0 ? 'text-success-500' : 'text-primary'}`}>
                {aggregatedStats.currentPower >= 0 ? '+' : ''}{(aggregatedStats.currentPower / 1000).toFixed(2)} MW
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Battery className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">SOC Medio</p>
              <p className="text-xl font-bold text-foreground">{aggregatedStats.avgSoc.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Ativos Online</p>
              <p className="text-xl font-bold text-foreground">{aggregatedStats.onlineAssets}/{assets.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Em Despacho</p>
              <p className="text-xl font-bold text-foreground">{(aggregatedStats.dispatchingPower / 1000).toFixed(2)} MW</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Network className="w-4 h-4 inline mr-2" />
          Visao Geral
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'assets'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Battery className="w-4 h-4 inline mr-2" />
          Ativos
        </button>
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'dispatch'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Despacho
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Analytics
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Power/Price Chart */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Despacho e Preco de Energia</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={realtimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--foreground-muted))', fontSize: 10 }} />
                <YAxis yAxisId="power" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <YAxis yAxisId="price" orientation="right" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar yAxisId="power" dataKey="power" fill="#3b82f6" fillOpacity={0.3} />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Capacity by Location */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Capacidade por Cidade</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={capacityByLocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {capacityByLocation.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${(value / 1000).toFixed(1)} MW`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Active Events */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Eventos Ativos e Agendados</h3>
            <div className="space-y-3">
              {dispatchEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    event.status === 'active' ? 'bg-primary/10 border border-primary/30' :
                    event.status === 'scheduled' ? 'bg-surface-hover' : 'bg-surface-hover opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      event.status === 'active' ? 'bg-primary/20' : 'bg-surface-hover'
                    }`}>
                      {event.power >= 0 ? (
                        <TrendingUp className={`w-5 h-5 ${event.status === 'active' ? 'text-primary' : 'text-foreground-muted'}`} />
                      ) : (
                        <Battery className={`w-5 h-5 ${event.status === 'active' ? 'text-primary' : 'text-foreground-muted'}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{getEventTypeLabel(event.type)}</p>
                      <p className="text-sm text-foreground-muted">
                        {new Date(event.startTime).toLocaleString('pt-BR')} - {event.duration}h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Potencia</p>
                      <p className={`font-semibold ${event.power >= 0 ? 'text-success-500' : 'text-primary'}`}>
                        {event.power >= 0 ? '+' : ''}{(event.power / 1000).toFixed(1)} MW
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Receita Est.</p>
                      <p className="font-semibold text-foreground">
                        R$ {event.revenue.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      {event.status === 'active' && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">
                          <Activity className="w-3 h-3 animate-pulse" /> Ativo
                        </span>
                      )}
                      {event.status === 'scheduled' && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">
                          <Clock className="w-3 h-3" /> Agendado
                        </span>
                      )}
                      {event.status === 'completed' && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-surface-hover text-foreground-muted">
                          <CheckCircle className="w-3 h-3" /> Concluido
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Resumo do Dia</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-success-500" />
                  <span className="text-sm text-foreground">Receita Hoje</span>
                </div>
                <span className="font-bold text-success-500">R$ 8.200</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">Energia Despachada</span>
                </div>
                <span className="font-bold text-foreground">12.5 MWh</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-warning-500" />
                  <span className="text-sm text-foreground">Eventos Respondidos</span>
                </div>
                <span className="font-bold text-foreground">3/3</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-foreground-muted" />
                  <span className="text-sm text-foreground">Prox. Despacho</span>
                </div>
                <span className="font-bold text-foreground">19:00</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {/* Bulk Actions */}
          {selectedAssets.length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-xl">
              <span className="text-sm text-foreground">{selectedAssets.length} ativos selecionados</span>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-success-500 text-white text-sm rounded-lg hover:bg-success-500/90">
                <Play className="w-4 h-4" /> Iniciar Despacho
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-warning-500 text-white text-sm rounded-lg hover:bg-warning-500/90">
                <Pause className="w-4 h-4" /> Parar
              </button>
              <button
                onClick={() => setSelectedAssets([])}
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                Limpar selecao
              </button>
            </div>
          )}

          {/* Assets Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => asset.dispatchable && toggleAssetSelection(asset.id)}
                className={`bg-surface rounded-xl border p-4 transition-all cursor-pointer ${
                  selectedAssets.includes(asset.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${!asset.dispatchable ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      asset.status === 'online' || asset.status === 'dispatching'
                        ? 'bg-success-500'
                        : asset.status === 'maintenance' ? 'bg-warning-500' : 'bg-danger-500'
                    }`} />
                    <div>
                      <h3 className="font-semibold text-foreground">{asset.name}</h3>
                      <p className="text-xs text-foreground-muted">{asset.location}</p>
                    </div>
                  </div>
                  {getStatusBadge(asset.status)}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-foreground-muted">Capacidade</p>
                    <p className="font-semibold text-foreground">{(asset.capacity / 1000).toFixed(1)} MW</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-foreground-muted">Potencia</p>
                    <p className={`font-semibold ${
                      asset.currentPower > 0 ? 'text-success-500' :
                      asset.currentPower < 0 ? 'text-primary' : 'text-foreground-muted'
                    }`}>
                      {asset.currentPower > 0 ? '+' : ''}{asset.currentPower} kW
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-foreground-muted">SOC</p>
                    <p className="font-semibold text-foreground">{asset.soc}%</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-muted">Estado de Carga</span>
                    <span className="text-foreground">{asset.soc}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        asset.soc >= 80 ? 'bg-success-500' :
                        asset.soc >= 30 ? 'bg-primary' : 'bg-warning-500'
                      }`}
                      style={{ width: `${asset.soc}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispatch Tab */}
      {activeTab === 'dispatch' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* New Dispatch */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Novo Despacho</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Tipo de Evento</label>
                <select className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary">
                  <option>Resposta a Demanda</option>
                  <option>Regulacao de Frequencia</option>
                  <option>Peak Shaving</option>
                  <option>Arbitragem</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Potencia Alvo (kW)</label>
                <input
                  type="number"
                  placeholder="3000"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Inicio</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Duracao (h)</label>
                  <input
                    type="number"
                    placeholder="2"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Ativos Participantes</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {assets.filter(a => a.dispatchable).map((asset) => (
                    <label key={asset.id} className="flex items-center gap-2 p-2 bg-surface-hover rounded-lg cursor-pointer">
                      <input type="checkbox" className="rounded border-border" />
                      <span className="text-sm text-foreground">{asset.name}</span>
                      <span className="text-xs text-foreground-muted">({(asset.capacity / 1000).toFixed(1)} MW)</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                <Power className="w-4 h-4" />
                Agendar Despacho
              </button>
            </div>
          </div>

          {/* Event Queue */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Fila de Eventos</h3>
            <div className="space-y-3">
              {dispatchEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    event.status === 'active'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{getEventTypeLabel(event.type)}</p>
                      <p className="text-sm text-foreground-muted">
                        {new Date(event.startTime).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`font-semibold ${event.power >= 0 ? 'text-success-500' : 'text-primary'}`}>
                        {event.power >= 0 ? '+' : ''}{(event.power / 1000).toFixed(1)} MW
                      </p>
                      <p className="text-xs text-foreground-muted">{event.duration}h</p>
                    </div>
                    {event.status === 'active' && (
                      <button className="px-3 py-1.5 bg-danger-500 text-white text-sm rounded-lg hover:bg-danger-500/90">
                        Parar
                      </button>
                    )}
                    {event.status === 'scheduled' && (
                      <button className="px-3 py-1.5 bg-surface text-foreground text-sm rounded-lg hover:bg-surface-hover border border-border">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Receita Mensal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={[
                { month: 'Ago', revenue: 45000 },
                { month: 'Set', revenue: 52000 },
                { month: 'Out', revenue: 48000 },
                { month: 'Nov', revenue: 61000 },
                { month: 'Dez', revenue: 58000 },
                { month: 'Jan', revenue: 67000 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Metrics */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Metricas de Desempenho</h3>
            <div className="space-y-4">
              {[
                { label: 'Taxa de Disponibilidade', value: 98.5, unit: '%' },
                { label: 'Tempo de Resposta Medio', value: 2.3, unit: 's' },
                { label: 'Eventos Bem-Sucedidos', value: 96, unit: '%' },
                { label: 'Eficiencia Round-Trip', value: 89, unit: '%' },
                { label: 'Fator de Utilizacao', value: 72, unit: '%' },
              ].map((metric, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{metric.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, metric.value)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-16 text-right">
                      {metric.value}{metric.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue by Event Type */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Receita por Tipo de Evento</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Resp. Demanda', value: 42 },
                    { name: 'Reg. Frequencia', value: 28 },
                    { name: 'Peak Shaving', value: 18 },
                    { name: 'Arbitragem', value: 12 },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Cards */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Resumo Anual</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-hover rounded-lg text-center">
                <DollarSign className="w-8 h-8 text-success-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">R$ 423k</p>
                <p className="text-sm text-foreground-muted">Receita Total</p>
              </div>
              <div className="p-4 bg-surface-hover rounded-lg text-center">
                <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">1.8 GWh</p>
                <p className="text-sm text-foreground-muted">Energia Despachada</p>
              </div>
              <div className="p-4 bg-surface-hover rounded-lg text-center">
                <Activity className="w-8 h-8 text-warning-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">847</p>
                <p className="text-sm text-foreground-muted">Eventos Atendidos</p>
              </div>
              <div className="p-4 bg-surface-hover rounded-lg text-center">
                <Clock className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">2.1s</p>
                <p className="text-sm text-foreground-muted">Tempo Resposta</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
