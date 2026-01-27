/**
 * Systems Map Page
 * Geographic view of all BESS installations
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Battery,
  Wifi,
  WifiOff,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Filter,
  RefreshCw,
  Zap,
  Thermometer,
  Navigation,
  Building2,
  Sun,
  Factory,
} from 'lucide-react';
import { cn, formatPercent, formatPower, formatTemperature } from '@/lib/utils';

interface SystemLocation {
  id: string;
  name: string;
  model: string;
  type: 'residential' | 'commercial' | 'industrial' | 'solar_farm';
  status: 'online' | 'offline' | 'error';
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  soc: number;
  power: number;
  temperature: number;
  alerts: number;
  capacity: number;
}

// Mock locations in Piaui/Teresina region
const mockLocations: SystemLocation[] = [
  {
    id: 'sys-1',
    name: 'BESS Teresina Centro',
    model: 'LiFePO4 100kWh',
    type: 'commercial',
    status: 'online',
    lat: -5.0892,
    lng: -42.8019,
    address: 'Av. Frei Serafim, 1500',
    city: 'Teresina',
    state: 'PI',
    soc: 78,
    power: 25.4,
    temperature: 32,
    alerts: 0,
    capacity: 100,
  },
  {
    id: 'sys-2',
    name: 'BESS Shopping Rio Poty',
    model: 'LiFePO4 200kWh',
    type: 'commercial',
    status: 'online',
    lat: -5.0456,
    lng: -42.7892,
    address: 'Av. Marechal Castelo Branco',
    city: 'Teresina',
    state: 'PI',
    soc: 92,
    power: -45.2,
    temperature: 28,
    alerts: 0,
    capacity: 200,
  },
  {
    id: 'sys-3',
    name: 'Usina Solar Piripiri',
    model: 'NMC 500kWh',
    type: 'solar_farm',
    status: 'online',
    lat: -4.2714,
    lng: -41.7769,
    address: 'Rodovia BR-343, Km 25',
    city: 'Piripiri',
    state: 'PI',
    soc: 45,
    power: 125.8,
    temperature: 38,
    alerts: 1,
    capacity: 500,
  },
  {
    id: 'sys-4',
    name: 'BESS Industria Parnaiba',
    model: 'LiFePO4 300kWh',
    type: 'industrial',
    status: 'online',
    lat: -2.9055,
    lng: -41.7769,
    address: 'Distrito Industrial',
    city: 'Parnaiba',
    state: 'PI',
    soc: 65,
    power: 85.3,
    temperature: 35,
    alerts: 0,
    capacity: 300,
  },
  {
    id: 'sys-5',
    name: 'BESS Residencial Lourival',
    model: 'LiFePO4 10kWh',
    type: 'residential',
    status: 'offline',
    lat: -5.0723,
    lng: -42.7456,
    address: 'Rua das Flores, 45',
    city: 'Teresina',
    state: 'PI',
    soc: 0,
    power: 0,
    temperature: 25,
    alerts: 2,
    capacity: 10,
  },
  {
    id: 'sys-6',
    name: 'BESS Hospital Sao Marcos',
    model: 'LiFePO4 150kWh',
    type: 'commercial',
    status: 'online',
    lat: -5.0512,
    lng: -42.8123,
    address: 'Av. Santos Dumont, 800',
    city: 'Teresina',
    state: 'PI',
    soc: 95,
    power: -12.5,
    temperature: 26,
    alerts: 0,
    capacity: 150,
  },
  {
    id: 'sys-7',
    name: 'Fazenda Solar Floriano',
    model: 'NMC 1000kWh',
    type: 'solar_farm',
    status: 'online',
    lat: -6.7689,
    lng: -43.0234,
    address: 'Zona Rural',
    city: 'Floriano',
    state: 'PI',
    soc: 55,
    power: 320.5,
    temperature: 42,
    alerts: 0,
    capacity: 1000,
  },
  {
    id: 'sys-8',
    name: 'BESS Fabrica Picos',
    model: 'LiFePO4 250kWh',
    type: 'industrial',
    status: 'error',
    lat: -7.0769,
    lng: -41.4668,
    address: 'Distrito Industrial',
    city: 'Picos',
    state: 'PI',
    soc: 23,
    power: 0,
    temperature: 48,
    alerts: 3,
    capacity: 250,
  },
];

export default function SystemsMap() {
  const [locations, setLocations] = useState<SystemLocation[]>(mockLocations);
  const [selectedLocation, setSelectedLocation] = useState<SystemLocation | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mapCenter] = useState({ lat: -5.0892, lng: -42.5 });
  const [mapZoom, setMapZoom] = useState(7);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  const filteredLocations = locations.filter((loc) => {
    const matchesType = filterType === 'all' || loc.type === filterType;
    const matchesStatus = filterStatus === 'all' || loc.status === filterStatus;
    return matchesType && matchesStatus;
  });

  const stats = {
    total: locations.length,
    online: locations.filter((l) => l.status === 'online').length,
    offline: locations.filter((l) => l.status === 'offline').length,
    error: locations.filter((l) => l.status === 'error').length,
    totalCapacity: locations.reduce((sum, l) => sum + l.capacity, 0),
    totalPower: locations.reduce((sum, l) => sum + l.power, 0),
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'residential':
        return Building2;
      case 'commercial':
        return Building2;
      case 'industrial':
        return Factory;
      case 'solar_farm':
        return Sun;
      default:
        return Battery;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'residential':
        return 'Residencial';
      case 'commercial':
        return 'Comercial';
      case 'industrial':
        return 'Industrial';
      case 'solar_farm':
        return 'Usina Solar';
      default:
        return type;
    }
  };

  if (isLoading) {
    return <MapSkeleton />;
  }

  return (
    <div className={cn('space-y-6 animate-fade-in', isFullscreen && 'fixed inset-0 z-50 bg-background p-4')}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Mapa de Sistemas
          </h1>
          <p className="text-foreground-muted text-sm">
            {stats.total} sistemas | {stats.totalCapacity.toLocaleString('pt-BR')} kWh capacidade total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setLocations(mockLocations)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Sistemas Online"
          value={stats.online}
          total={stats.total}
          icon={Wifi}
          color="success"
        />
        <StatCard
          label="Offline"
          value={stats.offline}
          icon={WifiOff}
          color="muted"
        />
        <StatCard
          label="Com Erro"
          value={stats.error}
          icon={AlertTriangle}
          color="danger"
        />
        <StatCard
          label="Potencia Total"
          value={`${stats.totalPower.toFixed(1)} kW`}
          icon={Zap}
          color="primary"
          isText
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os tipos</option>
          <option value="residential">Residencial</option>
          <option value="commercial">Comercial</option>
          <option value="industrial">Industrial</option>
          <option value="solar_farm">Usina Solar</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="error">Com erro</option>
        </select>
      </div>

      {/* Map Container */}
      <div className={cn('grid gap-6', selectedLocation ? 'lg:grid-cols-3' : 'lg:grid-cols-1')}>
        {/* Map */}
        <div className={cn('bg-surface rounded-xl border border-border overflow-hidden', selectedLocation ? 'lg:col-span-2' : '')}>
          <div className="relative h-[500px] bg-gradient-to-br from-blue-900/20 to-green-900/20">
            {/* Simulated Map Background */}
            <div className="absolute inset-0 opacity-30">
              <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                {/* Grid lines */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <g key={i}>
                    <line
                      x1={i * 10}
                      y1="0"
                      x2={i * 10}
                      y2="100"
                      stroke="currentColor"
                      strokeWidth="0.1"
                      className="text-border"
                    />
                    <line
                      x1="0"
                      y1={i * 10}
                      x2="100"
                      y2={i * 10}
                      stroke="currentColor"
                      strokeWidth="0.1"
                      className="text-border"
                    />
                  </g>
                ))}
              </svg>
            </div>

            {/* Map Label */}
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-surface/80 backdrop-blur-sm rounded-lg border border-border">
              <p className="text-sm text-foreground">Piaui, Brasil</p>
              <p className="text-xs text-foreground-muted">Zoom: {mapZoom}x</p>
            </div>

            {/* Location Markers */}
            {filteredLocations.map((location, index) => {
              const TypeIcon = getTypeIcon(location.type);
              // Simple position calculation for demo
              const x = 20 + (index % 4) * 20;
              const y = 15 + Math.floor(index / 4) * 25;

              return (
                <button
                  key={location.id}
                  onClick={() => setSelectedLocation(location)}
                  className={cn(
                    'absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110',
                    selectedLocation?.id === location.id && 'scale-125 z-10'
                  )}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div
                    className={cn(
                      'relative p-2 rounded-full shadow-lg',
                      location.status === 'online'
                        ? 'bg-success-500'
                        : location.status === 'error'
                        ? 'bg-danger-500'
                        : 'bg-foreground-subtle'
                    )}
                  >
                    <TypeIcon className="w-4 h-4 text-white" />
                    {location.alerts > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 text-white text-2xs rounded-full flex items-center justify-center">
                        {location.alerts}
                      </span>
                    )}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-surface/90 backdrop-blur-sm text-2xs text-foreground rounded shadow">
                      {location.name.split(' ').slice(1).join(' ')}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Zoom Controls */}
            <div className="absolute right-4 top-4 flex flex-col gap-1">
              <button
                onClick={() => setMapZoom((z) => Math.min(z + 1, 15))}
                className="w-8 h-8 bg-surface/80 backdrop-blur-sm rounded-lg border border-border flex items-center justify-center hover:bg-surface transition-colors"
              >
                <span className="text-foreground font-bold">+</span>
              </button>
              <button
                onClick={() => setMapZoom((z) => Math.max(z - 1, 1))}
                className="w-8 h-8 bg-surface/80 backdrop-blur-sm rounded-lg border border-border flex items-center justify-center hover:bg-surface transition-colors"
              >
                <span className="text-foreground font-bold">-</span>
              </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 p-3 bg-surface/80 backdrop-blur-sm rounded-lg border border-border">
              <p className="text-xs font-medium text-foreground mb-2">Legenda</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-2xs">
                  <div className="w-3 h-3 rounded-full bg-success-500" />
                  <span className="text-foreground-muted">Online</span>
                </div>
                <div className="flex items-center gap-2 text-2xs">
                  <div className="w-3 h-3 rounded-full bg-foreground-subtle" />
                  <span className="text-foreground-muted">Offline</span>
                </div>
                <div className="flex items-center gap-2 text-2xs">
                  <div className="w-3 h-3 rounded-full bg-danger-500" />
                  <span className="text-foreground-muted">Erro</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Location Detail */}
        {selectedLocation && (
          <div className="bg-surface rounded-xl border border-border animate-fade-in">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{selectedLocation.name}</h3>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-1 hover:bg-surface-hover rounded transition-colors"
              >
                <span className="text-foreground-muted text-lg">&times;</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    selectedLocation.status === 'online'
                      ? 'bg-success-500/20 text-success-500'
                      : selectedLocation.status === 'error'
                      ? 'bg-danger-500/20 text-danger-500'
                      : 'bg-foreground-subtle/20 text-foreground-subtle'
                  )}
                >
                  {selectedLocation.status === 'online'
                    ? 'Online'
                    : selectedLocation.status === 'error'
                    ? 'Erro'
                    : 'Offline'}
                </span>
                <span className="px-2 py-1 text-xs bg-surface-hover text-foreground-muted rounded-full">
                  {getTypeLabel(selectedLocation.type)}
                </span>
              </div>

              {/* Location */}
              <div>
                <p className="text-sm text-foreground">{selectedLocation.address}</p>
                <p className="text-xs text-foreground-muted">
                  {selectedLocation.city}, {selectedLocation.state}
                </p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  icon={Battery}
                  label="SOC"
                  value={formatPercent(selectedLocation.soc, 0)}
                  color={selectedLocation.soc > 20 ? 'primary' : 'danger'}
                />
                <MetricCard
                  icon={Zap}
                  label="Potencia"
                  value={formatPower(selectedLocation.power)}
                  color={selectedLocation.power > 0 ? 'success' : selectedLocation.power < 0 ? 'warning' : 'muted'}
                />
                <MetricCard
                  icon={Thermometer}
                  label="Temperatura"
                  value={formatTemperature(selectedLocation.temperature)}
                  color={selectedLocation.temperature > 40 ? 'danger' : 'success'}
                />
                <MetricCard
                  icon={AlertTriangle}
                  label="Alertas"
                  value={selectedLocation.alerts.toString()}
                  color={selectedLocation.alerts > 0 ? 'danger' : 'success'}
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border flex gap-2">
                <Link
                  to={`/systems/${selectedLocation.id}`}
                  className="flex-1 px-4 py-2 bg-primary text-white text-center text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Ver Detalhes
                </Link>
                <button className="px-4 py-2 bg-surface-hover text-foreground text-sm rounded-lg hover:bg-surface-active transition-colors flex items-center gap-2">
                  <Navigation className="w-4 h-4" />
                  Navegar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Systems List */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Lista de Sistemas</h3>
        </div>
        <div className="divide-y divide-border max-h-80 overflow-y-auto">
          {filteredLocations.map((location) => {
            const TypeIcon = getTypeIcon(location.type);
            return (
              <button
                key={location.id}
                onClick={() => setSelectedLocation(location)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors text-left',
                  selectedLocation?.id === location.id && 'bg-surface-hover'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    location.status === 'online'
                      ? 'bg-success-500/10'
                      : location.status === 'error'
                      ? 'bg-danger-500/10'
                      : 'bg-surface-hover'
                  )}
                >
                  <TypeIcon
                    className={cn(
                      'w-5 h-5',
                      location.status === 'online'
                        ? 'text-success-500'
                        : location.status === 'error'
                        ? 'text-danger-500'
                        : 'text-foreground-muted'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{location.name}</h4>
                  <p className="text-sm text-foreground-muted truncate">
                    {location.city}, {location.state}
                  </p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{formatPercent(location.soc, 0)}</p>
                  <p className="text-xs text-foreground-muted">{location.capacity} kWh</p>
                </div>
                {location.alerts > 0 && (
                  <span className="px-2 py-1 bg-danger-500/20 text-danger-500 text-xs font-medium rounded-full">
                    {location.alerts} alertas
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({
  label,
  value,
  total,
  icon: Icon,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  total?: number;
  icon: React.ElementType;
  color: 'success' | 'muted' | 'danger' | 'primary';
  isText?: boolean;
}) {
  const colorClasses = {
    success: 'text-success-500 bg-success-500/10',
    muted: 'text-foreground-muted bg-surface-hover',
    danger: 'text-danger-500 bg-danger-500/10',
    primary: 'text-primary bg-primary/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className={cn('p-2 rounded-lg w-fit mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">
        {isText ? value : value}
        {total !== undefined && <span className="text-foreground-muted font-normal">/{total}</span>}
      </p>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

// Metric Card
function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
}) {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success-500',
    warning: 'text-warning-500',
    danger: 'text-danger-500',
    muted: 'text-foreground-muted',
  };

  return (
    <div className="p-3 bg-background rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', colorClasses[color])} />
        <span className="text-xs text-foreground-muted">{label}</span>
      </div>
      <p className={cn('text-lg font-semibold', colorClasses[color])}>{value}</p>
    </div>
  );
}

// Loading Skeleton
function MapSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
        ))}
      </div>
      <div className="bg-surface rounded-xl border border-border h-[500px] animate-pulse" />
    </div>
  );
}
