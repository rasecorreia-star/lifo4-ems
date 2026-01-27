import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Clock,
  Search,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Zap,
  Battery,
  DollarSign,
  Calendar,
  Car,
  Plug,
  X,
  ArrowUpDown,
  TrendingUp,
} from 'lucide-react';
import {
  cn,
  formatDate,
  formatRelativeTime,
  formatCurrency,
  formatEnergy,
  formatNumber,
} from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface ChargingSession {
  id: string;
  chargerId: string;
  chargerName: string;
  connectorId: number;
  connectorType: string;
  userId?: string;
  userName?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  energyKwh: number;
  durationMinutes: number;
  cost: number;
  tariffId: string;
  tariffName: string;
  maxPowerKw: number;
  averagePowerKw: number;
  stopReason?: string;
  meterStart: number;
  meterEnd?: number;
  idTag?: string;
}

export interface SessionStats {
  totalSessions: number;
  totalEnergy: number;
  totalRevenue: number;
  averageDuration: number;
  activeNow: number;
}

export interface SessionFilters {
  search: string;
  status: string;
  chargerId: string;
  dateFrom: string;
  dateTo: string;
  minEnergy: string;
  maxEnergy: string;
}

// ============================================
// API FUNCTIONS
// ============================================

const sessionsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    chargerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) =>
    api.get<{
      success: boolean;
      data: ChargingSession[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/ev-chargers/sessions', { params }),

  getStats: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ success: boolean; data: SessionStats }>('/ev-chargers/sessions/stats', { params }),

  exportCsv: (params?: {
    status?: string;
    chargerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get('/ev-chargers/sessions/export', { params, responseType: 'blob' }),

  getChargers: () =>
    api.get<{ success: boolean; data: { id: string; name: string }[] }>('/ev-chargers'),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ChargingSessions() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [chargers, setChargers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('startTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filters, setFilters] = useState<SessionFilters>({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
    chargerId: searchParams.get('chargerId') || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    minEnergy: searchParams.get('minEnergy') || '',
    maxEnergy: searchParams.get('maxEnergy') || '',
  });

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      setIsLoading(true);

      const params: Record<string, unknown> = {
        page,
        limit,
        sortBy,
        sortOrder,
      };

      if (filters.search) params.search = filters.search;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.chargerId !== 'all') params.chargerId = filters.chargerId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const [sessionsRes, statsRes] = await Promise.all([
        sessionsApi.getAll(params as Parameters<typeof sessionsApi.getAll>[0]).catch(() => null),
        sessionsApi.getStats({ dateFrom: filters.dateFrom, dateTo: filters.dateTo }).catch(() => null),
      ]);

      if (sessionsRes?.data.data) {
        setSessions(sessionsRes.data.data);
        setTotal(sessionsRes.data.pagination.total);
        setTotalPages(sessionsRes.data.pagination.totalPages);
      } else {
        // Use mock data
        const mockData = getMockSessions();
        setSessions(mockData.sessions);
        setTotal(mockData.total);
        setTotalPages(Math.ceil(mockData.total / limit));
      }

      if (statsRes?.data.data) {
        setStats(statsRes.data.data);
      } else {
        setStats(getMockStats());
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch chargers list
  const fetchChargers = async () => {
    try {
      const response = await sessionsApi.getChargers();
      setChargers(response.data.data || []);
    } catch {
      // Use mock chargers
      setChargers([
        { id: 'charger-001', name: 'Carregador Estacionamento A1' },
        { id: 'charger-002', name: 'Carregador Entrada Principal' },
        { id: 'charger-003', name: 'Carregador Rapido B1' },
      ]);
    }
  };

  useEffect(() => {
    fetchChargers();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [page, sortBy, sortOrder, filters.status, filters.chargerId, filters.dateFrom, filters.dateTo]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.chargerId !== 'all') params.set('chargerId', filters.chargerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    setSearchParams(params, { replace: true });
  }, [filters]);

  // Handle search
  const handleSearch = () => {
    setPage(1);
    fetchSessions();
  };

  // Handle sort
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Handle export
  const handleExport = async () => {
    try {
      const response = await sessionsApi.exportCsv({
        status: filters.status !== 'all' ? filters.status : undefined,
        chargerId: filters.chargerId !== 'all' ? filters.chargerId : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `charging-sessions-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      chargerId: 'all',
      dateFrom: '',
      dateTo: '',
      minEnergy: '',
      maxEnergy: '',
    });
    setPage(1);
  };

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.chargerId !== 'all' ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.search;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sessoes de Carregamento</h1>
          <p className="text-foreground-muted text-sm">
            {total} sessoes encontradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors',
              showFilters || hasActiveFilters
                ? 'bg-primary/10 text-primary'
                : 'bg-surface border border-border text-foreground hover:bg-surface-hover'
            )}
          >
            <Filter className="w-5 h-5" />
            Filtros
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <button
            onClick={fetchSessions}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={Zap} label="Total Sessoes" value={formatNumber(stats.totalSessions, 0)} />
          <StatCard icon={Battery} label="Energia Total" value={formatEnergy(stats.totalEnergy)} color="primary" />
          <StatCard icon={DollarSign} label="Receita Total" value={formatCurrency(stats.totalRevenue)} color="success" />
          <StatCard icon={Clock} label="Duracao Media" value={`${stats.averageDuration} min`} />
          <StatCard icon={Car} label="Ativas Agora" value={stats.activeNow.toString()} color="warning" />
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Filtros</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-danger-500 hover:text-danger-400 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">
                Busca
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="ID, placa, usuario..."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Todos</option>
                <option value="active">Ativas</option>
                <option value="completed">Concluidas</option>
                <option value="failed">Falhas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>

            {/* Charger */}
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">
                Carregador
              </label>
              <select
                value={filters.chargerId}
                onChange={(e) => setFilters({ ...filters, chargerId: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Todos</option>
                {chargers.map((charger) => (
                  <option key={charger.id} value={charger.id}>
                    {charger.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <TableSkeleton />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma sessao encontrada</h3>
            <p className="text-foreground-muted">
              {hasActiveFilters
                ? 'Tente ajustar os filtros de busca'
                : 'As sessoes de carregamento aparecerao aqui'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-hover">
                    <SortableHeader
                      label="Inicio"
                      field="startTime"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <th className="text-left py-3 px-4 text-foreground-muted text-sm font-medium">Carregador</th>
                    <th className="text-left py-3 px-4 text-foreground-muted text-sm font-medium">Conector</th>
                    <th className="text-left py-3 px-4 text-foreground-muted text-sm font-medium">Usuario/Veiculo</th>
                    <SortableHeader
                      label="Duracao"
                      field="durationMinutes"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Energia"
                      field="energyKwh"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Pot. Media"
                      field="averagePowerKw"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Custo"
                      field="cost"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <th className="text-left py-3 px-4 text-foreground-muted text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-foreground-muted">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground-muted" />
                </button>
                <span className="text-sm text-foreground">
                  Pagina {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-foreground-muted" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success-500',
    warning: 'text-warning-500',
    danger: 'text-danger-500',
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <Icon className={cn('w-5 h-5', color ? colorClasses[color] : 'text-foreground-muted')} />
        <div>
          <p className={cn('text-lg font-semibold', color ? colorClasses[color] : 'text-foreground')}>
            {value}
          </p>
          <p className="text-xs text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SORTABLE HEADER
// ============================================

interface SortableHeaderProps {
  label: string;
  field: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

function SortableHeader({ label, field, sortBy, sortOrder, onSort }: SortableHeaderProps) {
  const isActive = sortBy === field;

  return (
    <th
      className="text-left py-3 px-4 text-foreground-muted text-sm font-medium cursor-pointer hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn('w-4 h-4', isActive && 'text-primary')} />
        {isActive && (
          <span className="text-2xs text-primary">
            {sortOrder === 'asc' ? 'ASC' : 'DESC'}
          </span>
        )}
      </div>
    </th>
  );
}

// ============================================
// SESSION ROW
// ============================================

interface SessionRowProps {
  session: ChargingSession;
}

function SessionRow({ session }: SessionRowProps) {
  const statusColors: Record<SessionStatus, string> = {
    active: 'bg-warning-500/20 text-warning-500',
    completed: 'bg-success-500/20 text-success-500',
    failed: 'bg-danger-500/20 text-danger-500',
    cancelled: 'bg-foreground-subtle/20 text-foreground-subtle',
  };

  const statusLabels: Record<SessionStatus, string> = {
    active: 'Ativa',
    completed: 'Concluida',
    failed: 'Falha',
    cancelled: 'Cancelada',
  };

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
      <td className="py-3 px-4">
        <div>
          <p className="text-foreground text-sm font-medium">{formatDate(session.startTime)}</p>
          {session.endTime && (
            <p className="text-foreground-muted text-xs">{formatRelativeTime(session.startTime)}</p>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <Link
          to={`/ev-chargers/${session.chargerId}`}
          className="text-primary hover:text-primary-400 text-sm"
        >
          {session.chargerName}
        </Link>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-foreground-muted" />
          <span className="text-foreground text-sm">#{session.connectorId}</span>
          <span className="text-foreground-muted text-xs">({session.connectorType})</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div>
          {session.userName && (
            <p className="text-foreground text-sm">{session.userName}</p>
          )}
          {session.vehiclePlate && (
            <p className="text-foreground-muted text-xs">{session.vehiclePlate}</p>
          )}
          {!session.userName && !session.vehiclePlate && (
            <p className="text-foreground-subtle text-sm">-</p>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-foreground text-sm">{session.durationMinutes} min</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-foreground text-sm font-medium">{session.energyKwh.toFixed(2)} kWh</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-foreground text-sm">{session.averagePowerKw.toFixed(1)} kW</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-foreground text-sm font-medium">{formatCurrency(session.cost)}</span>
      </td>
      <td className="py-3 px-4">
        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[session.status])}>
          {statusLabels[session.status]}
        </span>
      </td>
    </tr>
  );
}

// ============================================
// TABLE SKELETON
// ============================================

function TableSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-10 flex-1 bg-surface-hover rounded" />
          <div className="h-10 flex-1 bg-surface-hover rounded" />
          <div className="h-10 flex-1 bg-surface-hover rounded" />
          <div className="h-10 flex-1 bg-surface-hover rounded" />
          <div className="h-10 w-24 bg-surface-hover rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// MOCK DATA
// ============================================

function getMockSessions(): { sessions: ChargingSession[]; total: number } {
  const sessions: ChargingSession[] = [
    {
      id: 'session-001',
      chargerId: 'charger-001',
      chargerName: 'Carregador Estacionamento A1',
      connectorId: 1,
      connectorType: 'CCS2',
      userName: 'Joao Silva',
      vehiclePlate: 'ABC-1234',
      status: 'active',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      energyKwh: 12.5,
      durationMinutes: 60,
      cost: 18.75,
      tariffId: 'tariff-001',
      tariffName: 'Tarifa Padrao',
      maxPowerKw: 50,
      averagePowerKw: 12.5,
      meterStart: 1000,
      idTag: 'TAG001',
    },
    {
      id: 'session-002',
      chargerId: 'charger-002',
      chargerName: 'Carregador Entrada Principal',
      connectorId: 1,
      connectorType: 'Type2',
      userName: 'Maria Santos',
      vehiclePlate: 'DEF-5678',
      status: 'completed',
      startTime: new Date(Date.now() - 7200000).toISOString(),
      endTime: new Date(Date.now() - 3600000).toISOString(),
      energyKwh: 25.3,
      durationMinutes: 60,
      cost: 37.95,
      tariffId: 'tariff-001',
      tariffName: 'Tarifa Padrao',
      maxPowerKw: 22,
      averagePowerKw: 25.3,
      meterStart: 800,
      meterEnd: 825.3,
      stopReason: 'EVDisconnected',
      idTag: 'TAG002',
    },
    {
      id: 'session-003',
      chargerId: 'charger-003',
      chargerName: 'Carregador Rapido B1',
      connectorId: 1,
      connectorType: 'CCS2',
      status: 'failed',
      startTime: new Date(Date.now() - 14400000).toISOString(),
      endTime: new Date(Date.now() - 14100000).toISOString(),
      energyKwh: 0.5,
      durationMinutes: 5,
      cost: 0.75,
      tariffId: 'tariff-002',
      tariffName: 'Tarifa Rapida',
      maxPowerKw: 75,
      averagePowerKw: 6.0,
      meterStart: 500,
      meterEnd: 500.5,
      stopReason: 'PowerLoss',
      idTag: 'TAG003',
    },
    {
      id: 'session-004',
      chargerId: 'charger-001',
      chargerName: 'Carregador Estacionamento A1',
      connectorId: 2,
      connectorType: 'CHAdeMO',
      userName: 'Pedro Costa',
      vehiclePlate: 'GHI-9012',
      status: 'completed',
      startTime: new Date(Date.now() - 28800000).toISOString(),
      endTime: new Date(Date.now() - 25200000).toISOString(),
      energyKwh: 45.2,
      durationMinutes: 60,
      cost: 67.80,
      tariffId: 'tariff-001',
      tariffName: 'Tarifa Padrao',
      maxPowerKw: 50,
      averagePowerKw: 45.2,
      meterStart: 1200,
      meterEnd: 1245.2,
      stopReason: 'Local',
      idTag: 'TAG004',
    },
    {
      id: 'session-005',
      chargerId: 'charger-004',
      chargerName: 'Tesla Supercharger',
      connectorId: 1,
      connectorType: 'Tesla',
      userName: 'Ana Oliveira',
      vehiclePlate: 'JKL-3456',
      status: 'completed',
      startTime: new Date(Date.now() - 43200000).toISOString(),
      endTime: new Date(Date.now() - 41400000).toISOString(),
      energyKwh: 75.0,
      durationMinutes: 30,
      cost: 112.50,
      tariffId: 'tariff-003',
      tariffName: 'Tarifa Supercharger',
      maxPowerKw: 250,
      averagePowerKw: 150.0,
      meterStart: 5000,
      meterEnd: 5075,
      stopReason: 'EVDisconnected',
      idTag: 'TAG005',
    },
  ];

  return { sessions, total: 125 };
}

function getMockStats(): SessionStats {
  return {
    totalSessions: 1250,
    totalEnergy: 15420,
    totalRevenue: 23130,
    averageDuration: 45,
    activeNow: 3,
  };
}
