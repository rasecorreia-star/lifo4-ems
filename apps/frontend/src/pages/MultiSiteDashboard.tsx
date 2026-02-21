import React, { useState, useMemo } from 'react';
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
  Info,
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

// Componente de Tooltip com informações detalhadas
interface InfoTooltipProps {
  title: string;
  description: string;
  calculation: string;
  importance: string;
}

function InfoTooltip({ title, description, calculation, importance }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 300),
      });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={iconRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cursor-help"
      >
        <Info className="w-3.5 h-3.5 text-white/70 hover:text-white transition-colors" />
      </div>
      {isVisible && (
        <div
          className="fixed z-[9999] w-72 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={handleMouseLeave}
        >
          <h4 className="font-semibold text-white text-sm mb-2">{title}</h4>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-emerald-400 font-medium">O que mostra:</span>
              <p className="text-gray-300 mt-0.5">{description}</p>
            </div>
            <div>
              <span className="text-blue-400 font-medium">Como é calculado:</span>
              <p className="text-gray-300 mt-0.5">{calculation}</p>
            </div>
            <div>
              <span className="text-amber-400 font-medium">Por que é importante:</span>
              <p className="text-gray-300 mt-0.5">{importance}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function MultiSiteDashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'soc' | 'alerts'>('name');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  // Função para gerar variação nos dados simulando atualização em tempo real
  const generateVariation = (base: number, percent: number = 5) => {
    const variation = base * (percent / 100);
    return Math.round(base + (Math.random() - 0.5) * 2 * variation);
  };

  const sites: Site[] = useMemo(() => [
    {
      id: '1',
      name: 'BESS Teresina Centro',
      location: 'Teresina',
      state: 'PI',
      coordinates: { lat: -5.0892, lng: -42.8016 },
      capacity: 5000,
      currentPower: generateVariation(1250, 10),
      soc: Math.min(100, Math.max(0, generateVariation(72, 3))),
      status: 'online',
      alerts: 0,
      todayEnergy: generateVariation(4500, 2),
      todaySavings: generateVariation(3150, 2),
      efficiency: Math.min(100, generateVariation(942, 1) / 10),
      temperature: generateVariation(28, 5),
    },
    {
      id: '2',
      name: 'BESS Parnaiba Industrial',
      location: 'Parnaiba',
      state: 'PI',
      coordinates: { lat: -2.9055, lng: -41.7769 },
      capacity: 2000,
      currentPower: generateVariation(-500, 15),
      soc: Math.min(100, Math.max(0, generateVariation(45, 5))),
      status: 'online',
      alerts: 0,
      todayEnergy: generateVariation(1800, 2),
      todaySavings: generateVariation(1260, 2),
      efficiency: Math.min(100, generateVariation(928, 1) / 10),
      temperature: generateVariation(31, 5),
    },
    {
      id: '3',
      name: 'BESS Floriano Solar',
      location: 'Floriano',
      state: 'PI',
      coordinates: { lat: -6.7670, lng: -43.0222 },
      capacity: 1000,
      currentPower: 0,
      soc: Math.min(100, Math.max(0, generateVariation(85, 2))),
      status: 'maintenance',
      alerts: 1,
      todayEnergy: 0,
      todaySavings: 0,
      efficiency: 0,
      temperature: generateVariation(25, 3),
    },
    {
      id: '4',
      name: 'BESS Picos Comercial',
      location: 'Picos',
      state: 'PI',
      coordinates: { lat: -7.0769, lng: -41.4669 },
      capacity: 3000,
      currentPower: generateVariation(2100, 8),
      soc: Math.min(100, Math.max(0, generateVariation(38, 5))),
      status: 'warning',
      alerts: 2,
      todayEnergy: generateVariation(3200, 2),
      todaySavings: generateVariation(2240, 2),
      efficiency: Math.min(100, generateVariation(915, 1) / 10),
      temperature: generateVariation(35, 5),
    },
    {
      id: '5',
      name: 'BESS Piripiri Norte',
      location: 'Piripiri',
      state: 'PI',
      coordinates: { lat: -4.2728, lng: -41.7768 },
      capacity: 1500,
      currentPower: generateVariation(750, 10),
      soc: Math.min(100, Math.max(0, generateVariation(62, 4))),
      status: 'online',
      alerts: 0,
      todayEnergy: generateVariation(1350, 2),
      todaySavings: generateVariation(945, 2),
      efficiency: Math.min(100, generateVariation(937, 1) / 10),
      temperature: generateVariation(29, 5),
    },
    {
      id: '6',
      name: 'BESS Oeiras Agro',
      location: 'Oeiras',
      state: 'PI',
      coordinates: { lat: -7.0244, lng: -42.1311 },
      capacity: 2500,
      currentPower: generateVariation(1800, 10),
      soc: Math.min(100, Math.max(0, generateVariation(55, 4))),
      status: 'online',
      alerts: 0,
      todayEnergy: generateVariation(2250, 2),
      todaySavings: generateVariation(1575, 2),
      efficiency: Math.min(100, generateVariation(940, 1) / 10),
      temperature: generateVariation(30, 5),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [refreshKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simula chamada à API
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshKey(prev => prev + 1);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

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
          <p className="text-foreground-muted">
            {sites.length} sistemas em {new Set(sites.map(s => s.state)).size} estados
            <span className="mx-2">•</span>
            <span className="text-xs">Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
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

      {/* Aggregated Stats - Cards 3D */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Card Capacidade Total */}
        <div className="relative rounded-xl p-4 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-800 border-2 border-blue-300/50 shadow-lg shadow-blue-500/20 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-white" />
                <span className="text-xs text-blue-100">Capacidade Total</span>
              </div>
              <InfoTooltip
                title="Capacidade Total"
                description="Soma da capacidade máxima de armazenamento de todos os sistemas BESS conectados."
                calculation="Σ (capacidade de cada site) = Teresina (5MW) + Parnaíba (2MW) + Floriano (1MW) + Picos (3MW) + Piripiri (1.5MW) + Oeiras (2.5MW)"
                importance="Indica o potencial total de armazenamento de energia disponível para arbitragem, backup e estabilização da rede."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">{(aggregatedStats.totalCapacity / 1000).toFixed(1)} MW</p>
          </div>
        </div>

        {/* Card Potência Atual */}
        <div className={`relative rounded-xl p-4 bg-gradient-to-b ${aggregatedStats.currentPower >= 0 ? 'from-emerald-500 via-emerald-600 to-emerald-800 border-emerald-300/50 shadow-emerald-500/20' : 'from-violet-500 via-violet-600 to-violet-800 border-violet-300/50 shadow-violet-500/20'} border-2 shadow-lg overflow-hidden`}>
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-white" />
                <span className="text-xs text-white/80">Potência Atual</span>
              </div>
              <InfoTooltip
                title="Potência Atual"
                description="Fluxo de potência instantâneo de todos os sistemas. Positivo = descarga (fornecendo energia), Negativo = carga (armazenando)."
                calculation="Σ (potência atual de cada site) - valores em tempo real dos inversores PCS de cada instalação."
                importance="Mostra se a frota está fornecendo ou absorvendo energia da rede neste momento. Crítico para balanceamento e resposta à demanda."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">
              {aggregatedStats.currentPower >= 0 ? '+' : ''}{(aggregatedStats.currentPower / 1000).toFixed(2)} MW
            </p>
          </div>
        </div>

        {/* Card SOC Médio */}
        <div className="relative rounded-xl p-4 bg-gradient-to-b from-cyan-500 via-cyan-600 to-cyan-800 border-2 border-cyan-300/50 shadow-lg shadow-cyan-500/20 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-white" />
                <span className="text-xs text-cyan-100">SOC Médio</span>
              </div>
              <InfoTooltip
                title="State of Charge Médio"
                description="Média do nível de carga de todas as baterias. Indica quanto da capacidade total está disponível para uso."
                calculation="(Σ SOC de cada site) / número de sites = média ponderada do estado de carga."
                importance="SOC muito baixo (<20%) limita capacidade de descarga. SOC muito alto (>90%) limita capacidade de carga. Ideal: 30-70%."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">{aggregatedStats.avgSoc.toFixed(0)}%</p>
          </div>
        </div>

        {/* Card Energia Hoje */}
        <div className="relative rounded-xl p-4 bg-gradient-to-b from-green-500 via-green-600 to-green-800 border-2 border-green-300/50 shadow-lg shadow-green-500/20 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-white" />
                <span className="text-xs text-green-100">Energia Hoje</span>
              </div>
              <InfoTooltip
                title="Energia Movimentada Hoje"
                description="Total de energia que passou pelos sistemas (carga + descarga) desde 00:00h de hoje."
                calculation="Σ (energia movimentada por cada site hoje) - medido pelos medidores de energia em cada instalação."
                importance="Indica a utilização dos ativos. Maior throughput = mais ciclos = mais receita de arbitragem e serviços ancilares."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">{(aggregatedStats.totalEnergy / 1000).toFixed(1)} MWh</p>
          </div>
        </div>

        {/* Card Economia Hoje */}
        <div className="relative rounded-xl p-4 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800 border-2 border-amber-300/50 shadow-lg shadow-amber-500/20 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-white" />
                <span className="text-xs text-amber-100">Economia Hoje</span>
              </div>
              <InfoTooltip
                title="Economia Financeira Hoje"
                description="Valor economizado através de arbitragem tarifária (carregar no horário barato, descarregar no caro) e redução de demanda de pico."
                calculation="Σ (economia de cada site) = (energia descarga × tarifa ponta) - (energia carga × tarifa fora-ponta) + redução demanda contratada."
                importance="KPI principal de retorno financeiro. Mostra o valor gerado pelo sistema em reais, justificando o investimento no BESS."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">R$ {(aggregatedStats.totalSavings).toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {/* Card Sites Online */}
        <div className="relative rounded-xl p-4 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-800 border-2 border-teal-300/50 shadow-lg shadow-teal-500/20 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-white" />
                <span className="text-xs text-teal-100">Sites Online</span>
              </div>
              <InfoTooltip
                title="Sites Online"
                description="Quantidade de instalações BESS operando normalmente vs total de sites na frota."
                calculation="Contagem de sites com status 'online' / total de sites cadastrados."
                importance="Disponibilidade da frota. 100% = todos operacionais. Abaixo disso indica manutenção, falhas ou comunicação perdida."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">{aggregatedStats.onlineSites}/{sites.length}</p>
          </div>
        </div>

        {/* Card Alertas */}
        <div className={`relative rounded-xl p-4 bg-gradient-to-b ${aggregatedStats.totalAlerts > 0 ? 'from-orange-500 via-orange-600 to-orange-800 border-orange-300/50 shadow-orange-500/20' : 'from-emerald-500 via-emerald-600 to-emerald-800 border-emerald-300/50 shadow-emerald-500/20'} border-2 shadow-lg overflow-hidden`}>
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-white" />
                <span className="text-xs text-white/80">Alertas</span>
              </div>
              <InfoTooltip
                title="Alertas Ativos"
                description="Número total de alertas não resolvidos em toda a frota, incluindo alarmes de temperatura, SOC, comunicação e equipamentos."
                calculation="Σ (alertas ativos de cada site) - consolidado de todos os sistemas de monitoramento."
                importance="Zero alertas = operação saudável. Alertas precisam de atenção para evitar degradação de performance ou falhas."
              />
            </div>
            <p className="text-xl font-bold text-white drop-shadow-md">
              {aggregatedStats.totalAlerts}
            </p>
          </div>
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
