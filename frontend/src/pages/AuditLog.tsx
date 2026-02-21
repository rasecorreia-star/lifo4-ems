/**
 * Audit Log Page
 * Track all user actions for compliance and security
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  Filter,
  Download,
  User,
  Clock,
  Activity,
  Settings,
  AlertTriangle,
  Key,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Eye,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'control'
  | 'config';

interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  metadata?: Record<string, any>;
}

// Mock audit entries
const generateMockAuditEntries = (): AuditEntry[] => {
  const actions: Array<{
    action: AuditAction;
    resource: string;
    details: string;
  }> = [
    { action: 'login', resource: 'auth', details: 'Usuario autenticado com sucesso' },
    { action: 'logout', resource: 'auth', details: 'Sessao encerrada' },
    { action: 'view', resource: 'system', details: 'Visualizou detalhes do sistema BESS Principal' },
    { action: 'control', resource: 'system', details: 'Iniciou carga no sistema BESS Backup' },
    { action: 'control', resource: 'system', details: 'Parou descarga no sistema BESS Solar' },
    { action: 'update', resource: 'settings', details: 'Alterou parametros de protecao' },
    { action: 'create', resource: 'schedule', details: 'Criou agendamento de carga noturna' },
    { action: 'delete', resource: 'schedule', details: 'Removeu agendamento de descarga' },
    { action: 'export', resource: 'report', details: 'Exportou relatorio de desempenho em PDF' },
    { action: 'config', resource: 'bms', details: 'Atualizou limites de tensao do BMS' },
    { action: 'create', resource: 'user', details: 'Criou novo usuario tecnico' },
    { action: 'update', resource: 'user', details: 'Alterou permissoes do usuario' },
    { action: 'view', resource: 'alerts', details: 'Visualizou lista de alertas criticos' },
    { action: 'update', resource: 'alert', details: 'Reconheceu alerta de temperatura' },
    { action: 'config', resource: 'notification', details: 'Configurou notificacoes por email' },
  ];

  const users = [
    { id: 'usr-1', name: 'Admin Sistema', email: 'admin@lifo4.com.br', role: 'Super Admin' },
    { id: 'usr-2', name: 'Carlos Tecnico', email: 'carlos@lifo4.com.br', role: 'Tecnico' },
    { id: 'usr-3', name: 'Maria Gerente', email: 'maria@lifo4.com.br', role: 'Gerente' },
    { id: 'usr-4', name: 'Joao Operador', email: 'joao@lifo4.com.br', role: 'Operador' },
  ];

  const entries: AuditEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const actionData = actions[Math.floor(Math.random() * actions.length)];
    const user = users[Math.floor(Math.random() * users.length)];

    entries.push({
      id: `audit-${i}`,
      timestamp: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: actionData.action,
      resource: actionData.resource,
      resourceId: `res-${Math.floor(Math.random() * 1000)}`,
      details: actionData.details,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      status: Math.random() > 0.05 ? 'success' : 'failure',
    });
  }

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setEntries(generateMockAuditEntries());
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    let filtered = entries;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.userName.toLowerCase().includes(query) ||
          e.userEmail.toLowerCase().includes(query) ||
          e.details.toLowerCase().includes(query) ||
          e.ipAddress.includes(query)
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter((e) => e.action === actionFilter);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter((e) => e.userId === userFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    setFilteredEntries(filtered);
  }, [entries, searchQuery, actionFilter, userFilter, statusFilter]);

  const uniqueUsers = Array.from(new Set(entries.map((e) => e.userId))).map((id) => {
    const entry = entries.find((e) => e.userId === id)!;
    return { id, name: entry.userName };
  });

  const stats = {
    total: entries.length,
    logins: entries.filter((e) => e.action === 'login').length,
    changes: entries.filter((e) => ['create', 'update', 'delete'].includes(e.action)).length,
    failures: entries.filter((e) => e.status === 'failure').length,
  };

  if (isLoading) {
    return <AuditLogSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Log de Auditoria
          </h1>
          <p className="text-foreground-muted text-sm">
            Rastreamento de todas as acoes dos usuarios para conformidade e seguranca
          </p>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Log
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Registros" value={stats.total} icon={Activity} color="primary" />
        <StatCard label="Logins" value={stats.logins} icon={LogIn} color="success" />
        <StatCard label="Alteracoes" value={stats.changes} icon={Edit} color="secondary" />
        <StatCard
          label="Falhas"
          value={stats.failures}
          icon={AlertTriangle}
          color="danger"
          highlight={stats.failures > 0}
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Buscar por usuario, email, IP ou acao..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              showFilters ? 'bg-primary text-white' : 'bg-surface-hover text-foreground-muted hover:text-foreground'
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
            <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
          </button>
          <button
            onClick={() => {
              setIsLoading(true);
              setTimeout(() => {
                setEntries(generateMockAuditEntries());
                setIsLoading(false);
              }, 500);
            }}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-3 gap-4 animate-fade-in">
            <div>
              <label className="text-sm text-foreground-muted block mb-2">Acao</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              >
                <option value="all">Todas</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="view">Visualizacao</option>
                <option value="create">Criacao</option>
                <option value="update">Atualizacao</option>
                <option value="delete">Exclusao</option>
                <option value="control">Controle</option>
                <option value="config">Configuracao</option>
                <option value="export">Exportacao</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground-muted block mb-2">Usuario</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              >
                <option value="all">Todos</option>
                {uniqueUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground-muted block mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              >
                <option value="all">Todos</option>
                <option value="success">Sucesso</option>
                <option value="failure">Falha</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Audit Entries */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <span className="text-sm text-foreground-muted">
            {filteredEntries.length} registros encontrados
          </span>
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-foreground-subtle" />
              <p className="text-foreground-muted">Nenhum registro encontrado</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <AuditEntryRow
                key={entry.id}
                entry={entry}
                onClick={() => setSelectedEntry(entry)}
                isSelected={selectedEntry?.id === entry.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}

// Stat Card
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'primary' | 'success' | 'secondary' | 'danger';
  highlight?: boolean;
}) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success-500 bg-success-500/10',
    secondary: 'text-secondary bg-secondary/10',
    danger: 'text-danger-500 bg-danger-500/10',
  };

  return (
    <div
      className={cn(
        'bg-surface rounded-xl border p-4',
        highlight ? 'border-danger-500' : 'border-border'
      )}
    >
      <div className={cn('p-2 rounded-lg w-fit mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

// Audit Entry Row
function AuditEntryRow({
  entry,
  onClick,
  isSelected,
}: {
  entry: AuditEntry;
  onClick: () => void;
  isSelected: boolean;
}) {
  const actionIcons: Record<AuditAction, React.ElementType> = {
    login: LogIn,
    logout: LogOut,
    create: Plus,
    update: Edit,
    delete: Trash2,
    view: Eye,
    export: Download,
    control: Activity,
    config: Settings,
  };

  const ActionIcon = actionIcons[entry.action];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-4 p-4 hover:bg-surface-hover transition-colors text-left',
        isSelected && 'bg-surface-hover',
        entry.status === 'failure' && 'bg-danger-500/5'
      )}
    >
      <div
        className={cn(
          'p-2 rounded-lg shrink-0',
          entry.status === 'failure' ? 'bg-danger-500/10 text-danger-500' : 'bg-surface-hover text-foreground-muted'
        )}
      >
        <ActionIcon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">{entry.details}</span>
          {entry.status === 'failure' && (
            <span className="px-2 py-0.5 bg-danger-500/20 text-danger-500 text-2xs rounded-full">
              Falha
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {entry.userName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(entry.timestamp)}
          </span>
          <span className="flex items-center gap-1">
            <Key className="w-3 h-3" />
            {entry.ipAddress}
          </span>
        </div>
      </div>

      <span className="px-2 py-1 bg-surface-hover text-foreground-muted text-2xs rounded-full shrink-0">
        {entry.action}
      </span>
    </button>
  );
}

// Audit Detail Modal
function AuditDetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Detalhes do Registro</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <span className="text-foreground-muted text-lg">&times;</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-foreground-muted">Acao</label>
              <p className="text-foreground font-medium capitalize">{entry.action}</p>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Status</label>
              <p
                className={cn(
                  'font-medium',
                  entry.status === 'success' ? 'text-success-500' : 'text-danger-500'
                )}
              >
                {entry.status === 'success' ? 'Sucesso' : 'Falha'}
              </p>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Data/Hora</label>
              <p className="text-foreground">{entry.timestamp.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Recurso</label>
              <p className="text-foreground capitalize">{entry.resource}</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-foreground-muted">Descricao</label>
            <p className="text-foreground">{entry.details}</p>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Usuario</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-foreground-muted">Nome</label>
                <p className="text-foreground">{entry.userName}</p>
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Email</label>
                <p className="text-foreground">{entry.userEmail}</p>
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Funcao</label>
                <p className="text-foreground">{entry.userRole}</p>
              </div>
              <div>
                <label className="text-xs text-foreground-muted">ID</label>
                <p className="text-foreground font-mono text-sm">{entry.userId}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Informacoes Tecnicas</h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-foreground-muted">Endereco IP</label>
                <p className="text-foreground font-mono text-sm">{entry.ipAddress}</p>
              </div>
              <div>
                <label className="text-xs text-foreground-muted">User Agent</label>
                <p className="text-foreground text-xs break-all">{entry.userAgent}</p>
              </div>
              <div>
                <label className="text-xs text-foreground-muted">ID do Registro</label>
                <p className="text-foreground font-mono text-sm">{entry.id}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-hover text-foreground rounded-lg hover:bg-surface-active transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function AuditLogSkeleton() {
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
      <div className="bg-surface rounded-xl border border-border h-96 animate-pulse" />
    </div>
  );
}
