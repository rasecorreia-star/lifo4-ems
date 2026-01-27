import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Battery,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Filter,
  Grid,
  List,
  RefreshCw,
  ExternalLink,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

interface Site {
  id: string;
  name: string;
  location: string;
  state: string;
  coordinates: { lat: number; lng: number };
  capacity: number;
  currentPower: number;
  soc: number;
  status: 'online' | 'offline' | 'warning' | 'maintenance';
  alerts: number;
  todayEnergy: number;
  todaySavings: number;
  efficiency: number;
  temperature: number;
}

export default function MultiSiteDashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'soc' | 'alerts'>('name');

  const sites: Site[] = useMemo(() => [
    {
      id: '1',
      name: 'BESS Teresina Centro',
      location: 'Teresina',
      state: 'PI',
      coordinates: { lat: -5.0892, lng: -42.8016 },
      capacity: 5000,
      currentPower: 1250,
      soc: 72,
      status: 'online',
      alerts: 0,
      todayEnergy: 4500,
      todaySavings: 3150,
      efficiency: 94.2,
      temperature: 28,
    },
    {
      id: '2',
      name: 'BESS Parnaiba Industrial',
      location: 'Parnaiba',
      state: 'PI',
      coordinates: { lat: -2.9055, lng: -41.7769 },
      capacity: 2000,
      currentPower: -500,
      soc: 45,
      status: 'online',
      alerts: 0,
      todayEnergy: 1800,
      todaySavings: 1260,
      efficiency: 92.8,
      temperature: 31,
    },
    {
      id: '3',
      name: 'BESS Floriano Solar',
      location: 'Floriano',
      state: 'PI',
      coordinates: { lat: -6.7670, lng: -43.0222 },
      capacity: 1000,
      currentPower: 0,
      soc: 85,
      status: 'maintenance',
      alerts: 1,
      todayEnergy: 0,
      todaySavings: 0,
      efficiency: 0,
      temperature: 25,
    },
    {
      id: '4',
      name: 'BESS Picos Comercial',
      location: 'Picos',
      state: 'PI',
      coordinates: { lat: -7.0769, lng: -41.4669 },
      capacity: 3000,
      currentPower: 2100,
      soc: 38,
      status: 'warning',
      alerts: 2,
      todayEnergy: 3200,
      todaySavings: 2240,
      efficiency: 91.5,
      temperature: 35,
    },
    {
      id: '5',
      name: 'BESS Piripiri Norte',
      location: 'Piripiri',
      state: 'PI',
      coordinates: { lat: -4.2728, lng: -41.7768 },
      capacity: 1500,
      currentPower: 750,
      soc: 62,
      status: 'online',
      alerts: 0,
      todayEnergy: 1350,
      todaySavings: 945,
      efficiency: 93.7,
      temperature: 29,
    },
    {
      id: '6',
      name: 'BESS Oeiras Agro',
      location: 'Oeiras',
      state: 'PI',
      coordinates: { lat: -7.0244, lng: -42.1311 },
      capacity: 2500,
      currentPower: 1800,
      soc: 55,
      status: 'online',
      alerts: 0,
      todayEnergy: 2250,
      todaySavings: 1575,
      efficiency: 94.0,
      temperature: 30,
    },
  ], []);

  const filteredSites = useMemo(() => {
    let result = sites;
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'capacity': return b.capacity - a.capacity;
        case 'soc': return b.soc - a.soc;
        case 'alerts': return b.alerts - a.alerts;
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [sites, statusFilter, sortBy]);

  const aggregatedStats = useMemo(() => {
    const totalCapacity = sites.reduce((sum, s) => sum + s.capacity, 0);
    const currentPower = sites.reduce((sum, s) => sum + s.currentPower, 0);
    const avgSoc = sites.reduce((sum, s) => sum + s.soc, 0) / sites.length;
    const totalEnergy = sites.reduce((sum, s) => sum + s.todayEnergy, 0);
    const totalSavings = sites.reduce((sum, s) => sum + s.todaySavings, 0);
    const onlineSites = sites.filter(s => s.status === 'online').length;
    const totalAlerts = sites.reduce((sum, s) => sum + s.alerts, 0);
    return { totalCapacity, currentPower, avgSoc, totalEnergy, totalSavings, onlineSites, totalAlerts };
  }, [sites]);

  const capacityByCity = useMemo(() => {
    return sites.map(s => ({
      name: s.location,
      capacity: s.capacity / 1000,
    }));
  }, [sites]);

  const performanceData = useMemo(() => {
    return sites.map(s => ({
      name: s.name.replace('BESS ', ''),
      eficiencia: s.efficiency,
      soc: s.soc,
    }));
  }, [sites]);

  const statusDistribution = useMemo(() => [
    { name: 'Online', value: sites.filter(s => s.status === 'online').length, color: '#10b981' },
    { name: 'Warning', value: sites.filter(s => s.status === 'warning').length, color: '#f59e0b' },
    { name: 'Manutencao', value: sites.filter(s => s.status === 'maintenance').length, color: '#6b7280' },
    { name: 'Offline', value: sites.filter(s => s.status === 'offline').length, color: '#ef4444' },
  ].filter(s => s.value > 0), [sites]);

  const getStatusBadge = (status: Site['status']) => {
    switch (status) {
      case 'online':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500"><CheckCircle className="w-3 h-3" /> Online</span>;
      case 'warning':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500"><AlertTriangle className="w-3 h-3" /> Alerta</span>;
      case 'maintenance':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-foreground-muted/20 text-foreground-muted"><Clock className="w-3 h-3" /> Manutencao</span>;
      case 'offline':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500"><AlertTriangle className="w-3 h-3" /> Offline</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Site Dashboard</h1>
          <p className="text-foreground-muted">{sites.length} sistemas em {new Set(sites.map(s => s.state)).size} estados</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <div className="flex items-center bg-surface border border-border rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-l-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'hover:bg-surface-hover'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-r-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-surface-hover'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Aggregated Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Battery className="w-4 h-4 text-primary" />
            <span className="text-xs text-foreground-muted">Capacidade Total</span>
          </div>
          <p className="text-xl font-bold text-foreground">{(aggregatedStats.totalCapacity / 1000).toFixed(1)} MW</p>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Zap className={`w-4 h-4 ${aggregatedStats.currentPower >= 0 ? 'text-success-500' : 'text-primary'}`} />
            <span className="text-xs text-foreground-muted">Potencia Atual</span>
          </div>
          <p className={`text-xl font-bold ${aggregatedStats.currentPower >= 0 ? 'text-success-500' : 'text-primary'}`}>
            {aggregatedStats.currentPower >= 0 ? '+' : ''}{(aggregatedStats.currentPower / 1000).toFixed(2)} MW
          </p>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-foreground-muted">SOC Medio</span>
          </div>
          <p className="text-xl font-bold text-foreground">{aggregatedStats.avgSoc.toFixed(0)}%</p>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-success-500" />
            <span className="text-xs text-foreground-muted">Energia Hoje</span>
          </div>
          <p className="text-xl font-bold text-foreground">{(aggregatedStats.totalEnergy / 1000).toFixed(1)} MWh</p>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-success-500" />
            <span className="text-xs text-foreground-muted">Economia Hoje</span>
          </div>
          <p className="text-xl font-bold text-success-500">R$ {(aggregatedStats.totalSavings).toLocaleString('pt-BR')}</p>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-success-500" />
            <span className="text-xs text-foreground-muted">Sites Online</span>
          </div>
          <p className="text-xl font-bold text-foreground">{aggregatedStats.onlineSites}/{sites.length}</p>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${aggregatedStats.totalAlerts > 0 ? 'text-warning-500' : 'text-success-500'}`} />
            <span className="text-xs text-foreground-muted">Alertas</span>
          </div>
          <p className={`text-xl font-bold ${aggregatedStats.totalAlerts > 0 ? 'text-warning-500' : 'text-success-500'}`}>
            {aggregatedStats.totalAlerts}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Capacidade por Cidade</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={capacityByCity} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: 'hsl(var(--foreground-muted))' }} unit=" MW" />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--foreground-muted))' }} width={70} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `${value} MW`}
              />
              <Bar dataKey="capacity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Status dos Sites</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
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

        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Performance Comparativa</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--foreground-muted))', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line type="monotone" dataKey="eficiencia" name="Eficiencia %" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="soc" name="SOC %" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Todos Status</option>
            <option value="online">Online</option>
            <option value="warning">Alerta</option>
            <option value="maintenance">Manutencao</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          >
            <option value="name">Nome</option>
            <option value="capacity">Capacidade</option>
            <option value="soc">SOC</option>
            <option value="alerts">Alertas</option>
          </select>
        </div>
      </div>

      {/* Sites Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site) => (
            <Link
              key={site.id}
              to={`/systems/${site.id}`}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    site.status === 'online' ? 'bg-success-500' :
                    site.status === 'warning' ? 'bg-warning-500' :
                    site.status === 'maintenance' ? 'bg-foreground-muted' : 'bg-danger-500'
                  }`} />
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {site.name}
                  </h3>
                </div>
                <ExternalLink className="w-4 h-4 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-foreground-muted" />
                <span className="text-sm text-foreground-muted">{site.location}, {site.state}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2 bg-surface-hover rounded-lg text-center">
                  <p className="text-xs text-foreground-muted">Capacidade</p>
                  <p className="font-semibold text-foreground">{(site.capacity / 1000).toFixed(1)} MW</p>
                </div>
                <div className="p-2 bg-surface-hover rounded-lg text-center">
                  <p className="text-xs text-foreground-muted">SOC</p>
                  <p className="font-semibold text-foreground">{site.soc}%</p>
                </div>
                <div className="p-2 bg-surface-hover rounded-lg text-center">
                  <p className="text-xs text-foreground-muted">Potencia</p>
                  <p className={`font-semibold ${site.currentPower >= 0 ? 'text-success-500' : 'text-primary'}`}>
                    {site.currentPower >= 0 ? '+' : ''}{site.currentPower} kW
                  </p>
                </div>
                <div className="p-2 bg-surface-hover rounded-lg text-center">
                  <p className="text-xs text-foreground-muted">Eficiencia</p>
                  <p className="font-semibold text-foreground">{site.efficiency}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {getStatusBadge(site.status)}
                {site.alerts > 0 && (
                  <span className="flex items-center gap-1 text-xs text-warning-500">
                    <AlertTriangle className="w-3 h-3" /> {site.alerts} alerta(s)
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-hover">
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Site</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Local</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Capacidade</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">SOC</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Potencia</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Energia Hoje</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSites.map((site) => (
                <tr key={site.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        site.status === 'online' ? 'bg-success-500' :
                        site.status === 'warning' ? 'bg-warning-500' :
                        site.status === 'maintenance' ? 'bg-foreground-muted' : 'bg-danger-500'
                      }`} />
                      <span className="font-medium text-foreground">{site.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground-muted">{site.location}, {site.state}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-foreground">{(site.capacity / 1000).toFixed(1)} MW</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-foreground">{site.soc}%</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${site.currentPower >= 0 ? 'text-success-500' : 'text-primary'}`}>
                      {site.currentPower >= 0 ? '+' : ''}{site.currentPower} kW
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-foreground">{(site.todayEnergy / 1000).toFixed(1)} MWh</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(site.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/systems/${site.id}`}
                      className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
