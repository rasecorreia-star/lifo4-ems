import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plug,
  Plus,
  Search,
  RefreshCw,
  WifiOff,
  Wifi,
  Zap,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Car,
  Clock,
  Battery,
  Power,
} from 'lucide-react';
import { cn, formatPower, formatRelativeTime, formatCurrency } from '@/lib/utils';
import api from '@/services/api';

// ============================================
// EV CHARGER TYPES
// ============================================

export type EVChargerStatus = 'online' | 'offline' | 'available' | 'charging' | 'faulted' | 'unavailable';
export type ConnectorStatus = 'available' | 'occupied' | 'reserved' | 'faulted' | 'unavailable';
export type ConnectorType = 'Type1' | 'Type2' | 'CCS1' | 'CCS2' | 'CHAdeMO' | 'Tesla';

export interface EVConnector {
  id: string;
  connectorId: number;
  type: ConnectorType;
  maxPowerKw: number;
  status: ConnectorStatus;
  currentPowerKw?: number;
  sessionId?: string;
}

export interface EVCharger {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  ocppVersion: '1.6' | '2.0.1';
  status: EVChargerStatus;
  connectors: EVConnector[];
  location?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  lastHeartbeat?: string;
  firmwareVersion?: string;
  totalEnergyKwh: number;
  totalSessions: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API FUNCTIONS
// ============================================

const evChargersApi = {
  getAll: (params?: { status?: string; search?: string }) =>
    api.get<{ success: boolean; data: EVCharger[] }>('/ev-chargers', { params }),

  sendCommand: (chargerId: string, command: string, params?: Record<string, unknown>) =>
    api.post(`/ev-chargers/${chargerId}/command`, { command, params }),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function EVChargerList() {
  const [chargers, setChargers] = useState<EVCharger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch chargers
  const fetchChargers = async () => {
    try {
      setIsLoading(true);
      const response = await evChargersApi.getAll();
      setChargers(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch EV chargers:', error);
      // Mock data for development
      setChargers(getMockChargers());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChargers();
  }, []);

  // Filter chargers with defensive checks
  const filteredChargers = chargers.filter((charger) => {
    if (!charger) return false;

    const name = charger.name || '';
    const model = charger.model || '';
    const serial = charger.serialNumber || '';

    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      serial.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      charger.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats with defensive checks
  const stats = {
    total: chargers.length,
    online: chargers.filter((c) => c && (c.status === 'online' || c.status === 'available' || c.status === 'charging')).length,
    charging: chargers.filter((c) => c && c.status === 'charging').length,
    available: chargers.filter((c) => c && c.status === 'available').length,
    offline: chargers.filter((c) => c && c.status === 'offline').length,
    faulted: chargers.filter((c) => c && c.status === 'faulted').length,
  };

  // Quick actions
  const handleReset = async (chargerId: string) => {
    try {
      await evChargersApi.sendCommand(chargerId, 'Reset', { type: 'Soft' });
      fetchChargers();
    } catch (error) {
      console.error('Failed to reset charger:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carregadores EV</h1>
          <p className="text-foreground-muted text-sm">
            {stats.online} de {stats.total} carregadores online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/ev-chargers/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 text-purple-400 font-medium rounded-lg transition-colors"
          >
            <MapPin className="w-5 h-5" />
            Dashboard CPMS
          </Link>
          <Link
            to="/ev-chargers/sessions"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors"
          >
            <Clock className="w-5 h-5" />
            Sessoes
          </Link>
          <Link
            to="/ev-chargers/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Carregador
          </Link>
        </div>
      </div>

      {/* CPMS Quick Navigation */}
      <div className="bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Plug className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">CPMS Enterprise</h3>
            <p className="text-xs text-foreground-muted">Sistema de Gerenciamento de Carregadores</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <Link
            to="/ev-chargers/dashboard"
            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
          >
            <MapPin className="w-4 h-4 text-purple-400" />
            <span className="text-sm">Mapa Global</span>
          </Link>
          <Link
            to="/ev-chargers/sessions"
            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-sm">Sessões</span>
          </Link>
          <Link
            to="/ev-chargers/users"
            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Car className="w-4 h-4 text-blue-400" />
            <span className="text-sm">Usuários</span>
          </Link>
          <Link
            to="/ev-chargers/billing"
            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Power className="w-4 h-4 text-green-400" />
            <span className="text-sm">Billing</span>
          </Link>
          <Link
            to="/ev-chargers/energy"
            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-sm">Energia</span>
          </Link>
          <Link
            to="/ev-chargers/smart-charging"
            className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Battery className="w-4 h-4 text-cyan-400" />
            <span className="text-sm">Smart Charging</span>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBadge label="Total" value={stats.total} icon={Plug} />
        <StatBadge label="Online" value={stats.online} icon={Wifi} color="success" />
        <StatBadge label="Carregando" value={stats.charging} icon={Zap} color="charging" />
        <StatBadge label="Disponivel" value={stats.available} icon={Car} color="available" />
        <StatBadge label="Offline" value={stats.offline} icon={WifiOff} color="muted" />
        <StatBadge label="Falha" value={stats.faulted} icon={AlertTriangle} color="danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, modelo ou serial..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">Todos</option>
            <option value="available">Disponivel</option>
            <option value="charging">Carregando</option>
            <option value="offline">Offline</option>
            <option value="faulted">Com falha</option>
          </select>
          <button
            onClick={fetchChargers}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Chargers Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <ChargerCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredChargers.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Plug className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum carregador encontrado</h3>
          <p className="text-foreground-muted mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Adicione seu primeiro carregador para comecar'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link
              to="/ev-chargers/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Adicionar Carregador
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChargers.map((charger) => (
            <ChargerCard
              key={charger.id}
              charger={charger}
              onReset={() => handleReset(charger.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// STAT BADGE COMPONENT
// ============================================

interface StatBadgeProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: 'success' | 'danger' | 'muted' | 'charging' | 'available';
}

function StatBadge({ label, value, icon: Icon, color }: StatBadgeProps) {
  const colorClasses = {
    success: 'text-success-500',
    danger: 'text-danger-500',
    muted: 'text-foreground-subtle',
    charging: 'text-warning-500',
    available: 'text-secondary',
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-3 flex items-center gap-3">
      <Icon className={cn('w-5 h-5', color ? colorClasses[color] : 'text-primary')} />
      <div>
        <p className={cn('text-lg font-semibold', color ? colorClasses[color] : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-foreground-muted">{label}</p>
      </div>
    </div>
  );
}

// ============================================
// CHARGER CARD COMPONENT
// ============================================

interface ChargerCardProps {
  charger: EVCharger;
  onReset: () => void;
}

function ChargerCard({ charger, onReset }: ChargerCardProps) {
  // Defensive checks for missing data
  if (!charger) return null;

  const status = charger.status || 'offline';
  const connectors = charger.connectors || [];
  const totalEnergyKwh = charger.totalEnergyKwh ?? 0;
  const totalSessions = charger.totalSessions ?? 0;

  const isOnline = status !== 'offline' && status !== 'faulted';
  const isCharging = status === 'charging';
  const hasFault = status === 'faulted';

  const statusColors: Record<EVChargerStatus, string> = {
    online: 'bg-success-500/20 text-success-500',
    offline: 'bg-foreground-subtle/20 text-foreground-subtle',
    available: 'bg-secondary/20 text-secondary',
    charging: 'bg-warning-500/20 text-warning-500',
    faulted: 'bg-danger-500/20 text-danger-500',
    unavailable: 'bg-foreground-subtle/20 text-foreground-subtle',
  };

  const statusLabels: Record<EVChargerStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    available: 'Disponivel',
    charging: 'Carregando',
    faulted: 'Falha',
    unavailable: 'Indisponivel',
  };

  // Calculate total power being delivered (with defensive check)
  const totalPower = connectors.reduce((sum, conn) => sum + (conn?.currentPowerKw || 0), 0);

  return (
    <Link
      to={`/ev-chargers/${charger.id}`}
      className={cn(
        'bg-surface rounded-xl border p-4 hover:bg-surface-hover transition-all group block',
        hasFault ? 'border-danger-500/50' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              isCharging ? 'bg-warning-500/10' : isOnline ? 'bg-primary/10' : 'bg-surface-active'
            )}
          >
            <Plug className={cn('w-6 h-6', isCharging ? 'text-warning-500' : isOnline ? 'text-primary' : 'text-foreground-subtle')} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {charger.name}
            </h3>
            <p className="text-sm text-foreground-muted">{charger.model}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[status] || statusColors.offline)}>
          {statusLabels[status] || 'Desconhecido'}
        </span>
        <span className="text-xs text-foreground-muted">
          OCPP {charger.ocppVersion || '1.6'}
        </span>
      </div>

      {/* Connectors */}
      <div className="flex flex-wrap gap-2 mb-4">
        {connectors.map((connector) => (
          connector && <ConnectorBadge key={connector.id} connector={connector} />
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <Zap className={cn('w-4 h-4 mx-auto mb-1', isCharging ? 'text-warning-500' : 'text-foreground-muted')} />
          <p className="text-sm font-medium text-foreground">{formatPower(totalPower * 1000)}</p>
          <p className="text-2xs text-foreground-muted">Potencia</p>
        </div>
        <div className="text-center">
          <Battery className="w-4 h-4 mx-auto mb-1 text-foreground-muted" />
          <p className="text-sm font-medium text-foreground">{totalEnergyKwh.toFixed(0)} kWh</p>
          <p className="text-2xs text-foreground-muted">Total</p>
        </div>
        <div className="text-center">
          <Car className="w-4 h-4 mx-auto mb-1 text-foreground-muted" />
          <p className="text-sm font-medium text-foreground">{totalSessions}</p>
          <p className="text-2xs text-foreground-muted">Sessoes</p>
        </div>
      </div>

      {/* Last heartbeat */}
      {charger.lastHeartbeat && (
        <p className="text-2xs text-foreground-subtle text-center mt-3">
          Ultimo heartbeat: {formatRelativeTime(charger.lastHeartbeat)}
        </p>
      )}

      {/* Quick Actions - Stop propagation to prevent navigation */}
      {hasFault && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReset();
            }}
            className="w-full px-3 py-2 bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 text-sm font-medium rounded-lg transition-colors"
          >
            Reiniciar Carregador
          </button>
        </div>
      )}
    </Link>
  );
}

// ============================================
// CONNECTOR BADGE COMPONENT
// ============================================

interface ConnectorBadgeProps {
  connector: EVConnector;
}

function ConnectorBadge({ connector }: ConnectorBadgeProps) {
  const statusColors: Record<ConnectorStatus, string> = {
    available: 'bg-success-500/20 text-success-500 border-success-500/30',
    occupied: 'bg-warning-500/20 text-warning-500 border-warning-500/30',
    reserved: 'bg-secondary/20 text-secondary border-secondary/30',
    faulted: 'bg-danger-500/20 text-danger-500 border-danger-500/30',
    unavailable: 'bg-foreground-subtle/20 text-foreground-subtle border-border',
  };

  return (
    <div className={cn('px-2 py-1 text-xs rounded-lg border flex items-center gap-1.5', statusColors[connector.status])}>
      <Power className="w-3 h-3" />
      <span>{connector.type}</span>
      <span className="text-foreground-muted">|</span>
      <span>{connector.maxPowerKw}kW</span>
    </div>
  );
}

// ============================================
// SKELETON COMPONENT
// ============================================

function ChargerCardSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-surface-hover" />
        <div>
          <div className="h-5 w-32 bg-surface-hover rounded mb-2" />
          <div className="h-4 w-24 bg-surface-hover rounded" />
        </div>
      </div>
      <div className="h-6 w-20 bg-surface-hover rounded mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="h-6 w-16 bg-surface-hover rounded" />
        <div className="h-6 w-16 bg-surface-hover rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="h-12 bg-surface-hover rounded" />
        <div className="h-12 bg-surface-hover rounded" />
        <div className="h-12 bg-surface-hover rounded" />
      </div>
    </div>
  );
}

// ============================================
// MOCK DATA
// ============================================

function getMockChargers(): EVCharger[] {
  return [
    {
      id: 'charger-001',
      name: 'Carregador Estacionamento A1',
      model: 'ABB Terra 54',
      manufacturer: 'ABB',
      serialNumber: 'ABB-54-001',
      ocppVersion: '1.6',
      status: 'charging',
      connectors: [
        { id: 'conn-1', connectorId: 1, type: 'CCS2', maxPowerKw: 50, status: 'occupied', currentPowerKw: 45.5 },
        { id: 'conn-2', connectorId: 2, type: 'CHAdeMO', maxPowerKw: 50, status: 'available' },
      ],
      location: { address: 'Av. Paulista, 1000', latitude: -23.5629, longitude: -46.6544 },
      lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
      firmwareVersion: '2.1.0',
      totalEnergyKwh: 15420,
      totalSessions: 1250,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'charger-002',
      name: 'Carregador Entrada Principal',
      model: 'Wallbox Pulsar Plus',
      manufacturer: 'Wallbox',
      serialNumber: 'WB-PP-002',
      ocppVersion: '1.6',
      status: 'available',
      connectors: [
        { id: 'conn-3', connectorId: 1, type: 'Type2', maxPowerKw: 22, status: 'available' },
      ],
      location: { address: 'Rua Augusta, 500', latitude: -23.5519, longitude: -46.6527 },
      lastHeartbeat: new Date(Date.now() - 15000).toISOString(),
      firmwareVersion: '5.6.1',
      totalEnergyKwh: 8750,
      totalSessions: 890,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'charger-003',
      name: 'Carregador Rapido B1',
      model: 'Tritium RTM 75',
      manufacturer: 'Tritium',
      serialNumber: 'TRI-75-003',
      ocppVersion: '2.0.1',
      status: 'faulted',
      connectors: [
        { id: 'conn-4', connectorId: 1, type: 'CCS2', maxPowerKw: 75, status: 'faulted' },
      ],
      location: { address: 'Av. Faria Lima, 2000', latitude: -23.5874, longitude: -46.6789 },
      lastHeartbeat: new Date(Date.now() - 3600000).toISOString(),
      firmwareVersion: '3.0.5',
      totalEnergyKwh: 22100,
      totalSessions: 1890,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'charger-004',
      name: 'Carregador Tesla Supercharger',
      model: 'Tesla Supercharger V3',
      manufacturer: 'Tesla',
      serialNumber: 'TSL-V3-004',
      ocppVersion: '2.0.1',
      status: 'charging',
      connectors: [
        { id: 'conn-5', connectorId: 1, type: 'Tesla', maxPowerKw: 250, status: 'occupied', currentPowerKw: 187.2 },
      ],
      location: { address: 'Shopping Iguatemi', latitude: -23.5789, longitude: -46.6891 },
      lastHeartbeat: new Date(Date.now() - 10000).toISOString(),
      firmwareVersion: '2024.8.1',
      totalEnergyKwh: 45200,
      totalSessions: 3200,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'charger-005',
      name: 'Carregador Residencial',
      model: 'ChargePoint Home Flex',
      manufacturer: 'ChargePoint',
      serialNumber: 'CP-HF-005',
      ocppVersion: '1.6',
      status: 'offline',
      connectors: [
        { id: 'conn-6', connectorId: 1, type: 'Type1', maxPowerKw: 11.5, status: 'unavailable' },
      ],
      location: { address: 'Rua das Flores, 100', latitude: -23.5412, longitude: -46.6234 },
      lastHeartbeat: new Date(Date.now() - 86400000).toISOString(),
      firmwareVersion: '1.8.2',
      totalEnergyKwh: 3200,
      totalSessions: 456,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'charger-006',
      name: 'Carregador Estacionamento B2',
      model: 'EVBox Troniq 100',
      manufacturer: 'EVBox',
      serialNumber: 'EVB-T100-006',
      ocppVersion: '2.0.1',
      status: 'available',
      connectors: [
        { id: 'conn-7', connectorId: 1, type: 'CCS2', maxPowerKw: 100, status: 'available' },
        { id: 'conn-8', connectorId: 2, type: 'CCS2', maxPowerKw: 100, status: 'available' },
      ],
      location: { address: 'Av. Brasil, 3000', latitude: -23.5678, longitude: -46.7012 },
      lastHeartbeat: new Date(Date.now() - 20000).toISOString(),
      firmwareVersion: '4.2.0',
      totalEnergyKwh: 28900,
      totalSessions: 2100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
