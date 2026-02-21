import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plug,
  Zap,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  MapPin,
  Activity,
  Battery,
  Car,
  Globe,
  BarChart3,
  Filter,
  RefreshCw,
  Search,
  Eye,
  Settings,
  Bell,
  Maximize2,
  ChevronRight,
  Wifi,
  WifiOff,
  ThermometerSun,
  Navigation,
  Timer,
  CreditCard,
  Gauge,
  Building2,
  Map,
  List,
  Grid3X3,
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatPower } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface ChargerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline' | 'charging' | 'faulted' | 'available';
  chargersCount: number;
  activeSessionsCount: number;
  powerKw: number;
  revenue24h: number;
  utilizationPercent: number;
  country: string;
  city: string;
}

interface Alert {
  id: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  description: string;
  chargerName: string;
  location: string;
  timestamp: string;
  acknowledged: boolean;
}

interface Session {
  id: string;
  chargerName: string;
  connectorType: string;
  userName: string;
  vehicleModel: string;
  startTime: string;
  energyKwh: number;
  powerKw: number;
  socPercent: number;
  estimatedEnd: string;
  costSoFar: number;
}

// ============================================
// MOCK DATA
// ============================================

const mockLocations: ChargerLocation[] = [
  { id: '1', name: 'São Paulo - Paulista', lat: -23.5629, lng: -46.6544, status: 'charging', chargersCount: 12, activeSessionsCount: 8, powerKw: 450, revenue24h: 4250, utilizationPercent: 67, country: 'Brasil', city: 'São Paulo' },
  { id: '2', name: 'Rio de Janeiro - Centro', lat: -22.9068, lng: -43.1729, status: 'online', chargersCount: 8, activeSessionsCount: 3, powerKw: 180, revenue24h: 2100, utilizationPercent: 38, country: 'Brasil', city: 'Rio de Janeiro' },
  { id: '3', name: 'Curitiba - Batel', lat: -25.4284, lng: -49.2733, status: 'available', chargersCount: 6, activeSessionsCount: 0, powerKw: 0, revenue24h: 890, utilizationPercent: 22, country: 'Brasil', city: 'Curitiba' },
  { id: '4', name: 'Porto Alegre - Moinhos', lat: -30.0346, lng: -51.2177, status: 'faulted', chargersCount: 4, activeSessionsCount: 2, powerKw: 90, revenue24h: 650, utilizationPercent: 45, country: 'Brasil', city: 'Porto Alegre' },
  { id: '5', name: 'Belo Horizonte - Savassi', lat: -19.9167, lng: -43.9345, status: 'charging', chargersCount: 10, activeSessionsCount: 6, powerKw: 320, revenue24h: 3100, utilizationPercent: 60, country: 'Brasil', city: 'Belo Horizonte' },
  { id: '6', name: 'Brasília - Asa Sul', lat: -15.7801, lng: -47.9292, status: 'online', chargersCount: 5, activeSessionsCount: 2, powerKw: 110, revenue24h: 1200, utilizationPercent: 40, country: 'Brasil', city: 'Brasília' },
  { id: '7', name: 'Miami - Downtown', lat: 25.7617, lng: -80.1918, status: 'charging', chargersCount: 20, activeSessionsCount: 15, powerKw: 1200, revenue24h: 8500, utilizationPercent: 75, country: 'USA', city: 'Miami' },
  { id: '8', name: 'Lisboa - Parque Nações', lat: 38.7633, lng: -9.0950, status: 'online', chargersCount: 15, activeSessionsCount: 7, powerKw: 420, revenue24h: 3800, utilizationPercent: 47, country: 'Portugal', city: 'Lisboa' },
];

const mockAlerts: Alert[] = [
  { id: '1', priority: 'P1', title: 'Falha crítica de comunicação', description: 'Carregador não responde há mais de 30 minutos', chargerName: 'Carregador Porto Alegre #3', location: 'Porto Alegre - Moinhos', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), acknowledged: false },
  { id: '2', priority: 'P2', title: 'Temperatura elevada', description: 'Temperatura do módulo de potência acima de 65°C', chargerName: 'Carregador SP-Paulista #7', location: 'São Paulo - Paulista', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), acknowledged: false },
  { id: '3', priority: 'P3', title: 'Firmware desatualizado', description: 'Versão atual 2.1.0, disponível 2.3.1', chargerName: 'Carregador RJ-Centro #2', location: 'Rio de Janeiro - Centro', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), acknowledged: true },
  { id: '4', priority: 'P4', title: 'Baixa utilização', description: 'Utilização abaixo de 20% nas últimas 24h', chargerName: 'Carregador Curitiba #1', location: 'Curitiba - Batel', timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), acknowledged: true },
];

const mockActiveSessions: Session[] = [
  { id: '1', chargerName: 'SP-Paulista #1', connectorType: 'CCS2', userName: 'João Silva', vehicleModel: 'Tesla Model 3', startTime: new Date(Date.now() - 45 * 60000).toISOString(), energyKwh: 28.5, powerKw: 125, socPercent: 65, estimatedEnd: new Date(Date.now() + 20 * 60000).toISOString(), costSoFar: 42.75 },
  { id: '2', chargerName: 'SP-Paulista #3', connectorType: 'CHAdeMO', userName: 'Maria Santos', vehicleModel: 'Nissan Leaf', startTime: new Date(Date.now() - 30 * 60000).toISOString(), energyKwh: 15.2, powerKw: 45, socPercent: 78, estimatedEnd: new Date(Date.now() + 10 * 60000).toISOString(), costSoFar: 22.80 },
  { id: '3', chargerName: 'Miami #5', connectorType: 'Tesla', userName: 'John Smith', vehicleModel: 'Tesla Model Y', startTime: new Date(Date.now() - 15 * 60000).toISOString(), energyKwh: 32.1, powerKw: 187, socPercent: 42, estimatedEnd: new Date(Date.now() + 35 * 60000).toISOString(), costSoFar: 12.84 },
  { id: '4', chargerName: 'BH-Savassi #2', connectorType: 'CCS2', userName: 'Carlos Oliveira', vehicleModel: 'BYD Dolphin', startTime: new Date(Date.now() - 60 * 60000).toISOString(), energyKwh: 38.7, powerKw: 75, socPercent: 88, estimatedEnd: new Date(Date.now() + 5 * 60000).toISOString(), costSoFar: 58.05 },
  { id: '5', chargerName: 'Lisboa #8', connectorType: 'Type2', userName: 'António Ferreira', vehicleModel: 'Renault Zoe', startTime: new Date(Date.now() - 90 * 60000).toISOString(), energyKwh: 22.4, powerKw: 22, socPercent: 95, estimatedEnd: new Date(Date.now() + 2 * 60000).toISOString(), costSoFar: 8.96 },
];

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  sessions: Math.floor(Math.random() * 50) + 10,
  energy: Math.floor(Math.random() * 500) + 100,
  revenue: Math.floor(Math.random() * 2000) + 500,
}));

const utilizationByHour = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  utilization: i >= 7 && i <= 22 ? Math.floor(Math.random() * 40) + 40 : Math.floor(Math.random() * 20) + 10,
}));

const connectorTypeData = [
  { name: 'CCS2', value: 45, color: '#10b981' },
  { name: 'CHAdeMO', value: 20, color: '#3b82f6' },
  { name: 'Type2', value: 25, color: '#8b5cf6' },
  { name: 'Tesla', value: 10, color: '#ef4444' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function CPMSDashboard() {
  const [locations] = useState<ChargerLocation[]>(mockLocations);
  const [alerts] = useState<Alert[]>(mockAlerts);
  const [activeSessions] = useState<Session[]>(mockActiveSessions);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Calculate KPIs
  const kpis = useMemo(() => {
    const filteredLocations = selectedRegion === 'all'
      ? locations
      : locations.filter(l => l.country === selectedRegion);

    return {
      totalChargers: filteredLocations.reduce((sum, l) => sum + l.chargersCount, 0),
      onlineChargers: filteredLocations.filter(l => l.status !== 'offline' && l.status !== 'faulted').reduce((sum, l) => sum + l.chargersCount, 0),
      activeSessions: filteredLocations.reduce((sum, l) => sum + l.activeSessionsCount, 0),
      totalPowerKw: filteredLocations.reduce((sum, l) => sum + l.powerKw, 0),
      revenue24h: filteredLocations.reduce((sum, l) => sum + l.revenue24h, 0),
      avgUtilization: filteredLocations.length > 0
        ? filteredLocations.reduce((sum, l) => sum + l.utilizationPercent, 0) / filteredLocations.length
        : 0,
      criticalAlerts: alerts.filter(a => a.priority === 'P1' && !a.acknowledged).length,
      totalAlerts: alerts.filter(a => !a.acknowledged).length,
    };
  }, [locations, alerts, selectedRegion]);

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  // Format remaining time
  const formatRemaining = (timestamp: string) => {
    const diff = new Date(timestamp).getTime() - Date.now();
    if (diff < 0) return 'Concluindo...';
    const minutes = Math.floor(diff / 60000);
    return `~${minutes}min`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Plug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">CPMS Enterprise Dashboard</h1>
              <p className="text-foreground-muted text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {kpis.totalChargers} carregadores em {new Set(locations.map(l => l.country)).size} países
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todas as Regiões</option>
            <option value="Brasil">Brasil</option>
            <option value="USA">Estados Unidos</option>
            <option value="Portugal">Portugal</option>
          </select>

          {/* Time Range */}
          <div className="flex bg-surface border border-border rounded-lg overflow-hidden">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors',
                  timeRange === range ? 'bg-primary text-white' : 'hover:bg-surface-hover'
                )}
              >
                {range}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex bg-surface border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'map' ? 'bg-primary text-white' : 'hover:bg-surface-hover'
              )}
            >
              <Map className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-surface-hover'
              )}
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
          </button>

          {/* Quick Actions */}
          <Link
            to="/ev-chargers/sessions"
            className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Sessões
          </Link>
          <Link
            to="/ev-chargers/alerts"
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Bell className="w-4 h-4" />
            Alertas
            {kpis.criticalAlerts > 0 && (
              <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{kpis.criticalAlerts}</span>
            )}
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard
          title="Carregadores"
          value={kpis.totalChargers}
          subtitle={`${kpis.onlineChargers} online`}
          icon={Plug}
          color="primary"
          trend={+5}
        />
        <KPICard
          title="Sessões Ativas"
          value={kpis.activeSessions}
          subtitle="em tempo real"
          icon={Zap}
          color="warning"
          pulse
        />
        <KPICard
          title="Potência Total"
          value={`${(kpis.totalPowerKw / 1000).toFixed(1)} MW`}
          subtitle="entregando agora"
          icon={Gauge}
          color="success"
        />
        <KPICard
          title="Receita 24h"
          value={formatCurrency(kpis.revenue24h)}
          subtitle="+12% vs ontem"
          icon={DollarSign}
          color="emerald"
          trend={+12}
        />
        <KPICard
          title="Utilização"
          value={`${kpis.avgUtilization.toFixed(0)}%`}
          subtitle="média da frota"
          icon={BarChart3}
          color="blue"
          trend={+3}
        />
        <KPICard
          title="Uptime"
          value="99.7%"
          subtitle="últimos 30 dias"
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title="Alertas P1/P2"
          value={kpis.criticalAlerts}
          subtitle={`${kpis.totalAlerts} total`}
          icon={AlertCircle}
          color={kpis.criticalAlerts > 0 ? 'danger' : 'muted'}
          pulse={kpis.criticalAlerts > 0}
        />
        <KPICard
          title="Usuários Ativos"
          value="1,247"
          subtitle="este mês"
          icon={Users}
          color="purple"
          trend={+8}
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map / List Section */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Mapa Global de Carregadores
            </h2>
            <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
              <Maximize2 className="w-4 h-4 text-foreground-muted" />
            </button>
          </div>

          {viewMode === 'map' ? (
            <div className="relative h-[400px] bg-gradient-to-br from-slate-900 to-slate-800">
              {/* Simplified Map Visualization */}
              <div className="absolute inset-0 p-4">
                <div className="relative w-full h-full rounded-lg overflow-hidden">
                  {/* Map Background Pattern */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="grid grid-cols-12 h-full">
                      {Array.from({ length: 48 }).map((_, i) => (
                        <div key={i} className="border-r border-b border-white/10" />
                      ))}
                    </div>
                  </div>

                  {/* Location Markers */}
                  {locations.map((location) => {
                    const x = ((location.lng + 180) / 360) * 100;
                    const y = ((90 - location.lat) / 180) * 100;

                    return (
                      <div
                        key={location.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div className={cn(
                          'relative',
                          location.status === 'charging' && 'animate-pulse'
                        )}>
                          {/* Pulse Effect */}
                          {location.status === 'charging' && (
                            <div className="absolute inset-0 w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-warning-500/30 rounded-full animate-ping" />
                          )}

                          {/* Marker */}
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg',
                            location.status === 'online' && 'bg-success-500',
                            location.status === 'charging' && 'bg-warning-500',
                            location.status === 'available' && 'bg-blue-500',
                            location.status === 'faulted' && 'bg-danger-500',
                            location.status === 'offline' && 'bg-gray-500'
                          )}>
                            <span className="text-white text-xs font-bold">{location.chargersCount}</span>
                          </div>

                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                            <div className="bg-surface border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
                              <p className="font-semibold text-foreground text-sm">{location.name}</p>
                              <p className="text-xs text-foreground-muted">{location.city}, {location.country}</p>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-foreground-muted">Carregadores:</span>
                                  <span className="ml-1 font-medium">{location.chargersCount}</span>
                                </div>
                                <div>
                                  <span className="text-foreground-muted">Ativos:</span>
                                  <span className="ml-1 font-medium">{location.activeSessionsCount}</span>
                                </div>
                                <div>
                                  <span className="text-foreground-muted">Potência:</span>
                                  <span className="ml-1 font-medium">{location.powerKw} kW</span>
                                </div>
                                <div>
                                  <span className="text-foreground-muted">Utilização:</span>
                                  <span className="ml-1 font-medium">{location.utilizationPercent}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur border border-border rounded-lg p-3">
                    <p className="text-xs font-medium text-foreground mb-2">Status</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-success-500" />
                        <span className="text-foreground-muted">Online</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-warning-500" />
                        <span className="text-foreground-muted">Carregando</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-foreground-muted">Disponível</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-danger-500" />
                        <span className="text-foreground-muted">Falha</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-hover">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Local</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Carregadores</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Sessões</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Potência</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Utilização</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Receita 24h</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {locations.map((location) => (
                    <tr key={location.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{location.name}</p>
                          <p className="text-xs text-foreground-muted">{location.city}, {location.country}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={location.status} />
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{location.chargersCount}</td>
                      <td className="px-4 py-3 text-center font-medium">{location.activeSessionsCount}</td>
                      <td className="px-4 py-3 text-center font-medium">{location.powerKw} kW</td>
                      <td className="px-4 py-3">
                        <UtilizationBar value={location.utilizationPercent} />
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-success-500">{formatCurrency(location.revenue24h)}</td>
                      <td className="px-4 py-3 text-center">
                        <Link to={`/ev-chargers/site/${location.id}`} className="text-primary hover:underline text-sm">
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerts Panel */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
              Alertas Ativos
            </h2>
            <Link to="/ev-chargers/alerts" className="text-primary text-sm hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
            {alerts.filter(a => !a.acknowledged).map((alert) => (
              <div key={alert.id} className={cn(
                'p-4 hover:bg-surface-hover cursor-pointer transition-colors',
                alert.priority === 'P1' && 'border-l-4 border-l-danger-500',
                alert.priority === 'P2' && 'border-l-4 border-l-warning-500',
                alert.priority === 'P3' && 'border-l-4 border-l-blue-500',
                alert.priority === 'P4' && 'border-l-4 border-l-gray-500'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'px-1.5 py-0.5 text-xs font-bold rounded',
                        alert.priority === 'P1' && 'bg-danger-500/20 text-danger-500',
                        alert.priority === 'P2' && 'bg-warning-500/20 text-warning-500',
                        alert.priority === 'P3' && 'bg-blue-500/20 text-blue-500',
                        alert.priority === 'P4' && 'bg-gray-500/20 text-gray-400'
                      )}>
                        {alert.priority}
                      </span>
                      <span className="text-xs text-foreground-muted">{formatTimeAgo(alert.timestamp)}</span>
                    </div>
                    <p className="font-medium text-sm text-foreground truncate">{alert.title}</p>
                    <p className="text-xs text-foreground-muted truncate">{alert.chargerName}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning-500" />
            Sessões Ativas em Tempo Real
            <span className="px-2 py-0.5 bg-warning-500/20 text-warning-500 text-xs font-medium rounded-full">
              {activeSessions.length} ativas
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Link to="/ev-chargers/sessions" className="text-primary text-sm hover:underline">
              Ver todas
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Carregador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Usuário / Veículo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Conector</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Potência</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Energia</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">SOC</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Tempo Rest.</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Custo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeSessions.map((session) => (
                <tr key={session.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{session.chargerName}</p>
                    <p className="text-xs text-foreground-muted">{formatTimeAgo(session.startTime)} iniciado</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{session.userName}</p>
                    <p className="text-xs text-foreground-muted">{session.vehicleModel}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                      {session.connectorType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium text-warning-500">{session.powerKw} kW</span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{session.energyKwh.toFixed(1)} kWh</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-surface-active rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            session.socPercent > 80 ? 'bg-success-500' :
                            session.socPercent > 40 ? 'bg-warning-500' : 'bg-danger-500'
                          )}
                          style={{ width: `${session.socPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{session.socPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-foreground-muted">{formatRemaining(session.estimatedEnd)}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-success-500">
                    {formatCurrency(session.costSoFar)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 hover:bg-surface-active rounded transition-colors" title="Ver detalhes">
                        <Eye className="w-4 h-4 text-foreground-muted" />
                      </button>
                      <button className="p-1.5 hover:bg-danger-500/10 rounded transition-colors" title="Parar sessão">
                        <AlertCircle className="w-4 h-4 text-danger-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sessions & Revenue Chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Sessões e Receita por Hora
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="sessions" name="Sessões" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="revenue" name="Receita (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Connector Type Distribution */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5 text-primary" />
            Tipo de Conector
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={connectorTypeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {connectorTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {connectorTypeData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-foreground-muted">{item.name}</span>
                <span className="font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Utilization Chart */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Utilização da Frota por Hora
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={utilizationByHour}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="hour" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value}%`, 'Utilização']}
            />
            <defs>
              <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="utilization"
              stroke="#8b5cf6"
              fill="url(#utilizationGradient)"
              strokeWidth={2}
            />
            {/* Target Line */}
            <Line
              type="monotone"
              dataKey={() => 65}
              stroke="#10b981"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              name="Meta (65%)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: 'primary' | 'warning' | 'success' | 'danger' | 'emerald' | 'blue' | 'green' | 'muted' | 'purple';
  trend?: number;
  pulse?: boolean;
}

function KPICard({ title, value, subtitle, icon: Icon, color, trend, pulse }: KPICardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    warning: 'text-warning-500 bg-warning-500/10',
    success: 'text-success-500 bg-success-500/10',
    danger: 'text-danger-500 bg-danger-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-green-500 bg-green-500/10',
    muted: 'text-foreground-muted bg-surface-active',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className={cn(
      'bg-surface rounded-xl border border-border p-4',
      pulse && 'ring-2 ring-warning-500/50'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            trend >= 0 ? 'text-success-500' : 'text-danger-500'
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className={cn('text-xl font-bold', pulse && 'animate-pulse')}>{value}</p>
      <p className="text-xs text-foreground-muted">{title}</p>
      <p className="text-2xs text-foreground-subtle mt-0.5">{subtitle}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    online: { label: 'Online', class: 'bg-success-500/20 text-success-500' },
    charging: { label: 'Carregando', class: 'bg-warning-500/20 text-warning-500' },
    available: { label: 'Disponível', class: 'bg-blue-500/20 text-blue-500' },
    faulted: { label: 'Falha', class: 'bg-danger-500/20 text-danger-500' },
    offline: { label: 'Offline', class: 'bg-gray-500/20 text-gray-400' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', config.class)}>
      {config.label}
    </span>
  );
}

function UtilizationBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-surface-active rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            value >= 70 ? 'bg-success-500' :
            value >= 40 ? 'bg-warning-500' : 'bg-danger-500'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{value}%</span>
    </div>
  );
}
