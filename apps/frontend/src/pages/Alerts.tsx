import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  RefreshCw,
  Search,
  X,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { alertsApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { Alert, AlertsSummary } from '@/types';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const [alertsRes, summaryRes] = await Promise.all([
        alertsApi.getAll({ sortBy: 'createdAt', sortOrder: 'desc', limit: 100 }),
        alertsApi.getSummary(),
      ]);
      setAlerts(alertsRes.data.data || []);
      setSummary(summaryRes.data.data || null);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Real-time alerts
  useEffect(() => {
    const unsubscribe = socketService.onAlert((alert) => {
      setAlerts((prev) => [alert, ...prev]);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              total: prev.total + 1,
              unread: prev.unread + 1,
              [alert.severity]: (prev[alert.severity as keyof AlertsSummary] as number) + 1,
            }
          : prev
      );
    });
    return unsubscribe;
  }, []);

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unread' && !alert.isRead) ||
      (statusFilter === 'read' && alert.isRead) ||
      (statusFilter === 'acknowledged' && alert.isAcknowledged) ||
      (statusFilter === 'resolved' && alert.resolvedAt);

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Mark as read
  const handleMarkAsRead = async (alertId: string) => {
    try {
      await alertsApi.markAsRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
      );
      setSummary((prev) => (prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Acknowledge
  const handleAcknowledge = async (alertId: string) => {
    try {
      await alertsApi.acknowledge(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, isAcknowledged: true, acknowledgedAt: new Date() }
            : a
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge:', error);
    }
  };

  // Mark multiple as read
  const handleMarkMultipleAsRead = async () => {
    if (selectedAlerts.size === 0) return;
    try {
      await alertsApi.markMultipleAsRead(Array.from(selectedAlerts));
      setAlerts((prev) =>
        prev.map((a) => (selectedAlerts.has(a.id) ? { ...a, isRead: true } : a))
      );
      setSummary((prev) =>
        prev ? { ...prev, unread: Math.max(0, prev.unread - selectedAlerts.size) } : prev
      );
      setSelectedAlerts(new Set());
    } catch (error) {
      console.error('Failed to mark multiple as read:', error);
    }
  };

  // Toggle selection
  const toggleSelection = (alertId: string) => {
    setSelectedAlerts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  // Select all visible
  const selectAllVisible = () => {
    if (selectedAlerts.size === filteredAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(filteredAlerts.map((a) => a.id)));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
          <p className="text-foreground-muted text-sm">
            {summary?.unread || 0} não lidos de {summary?.total || 0} alertas
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <SummaryCard
            label="Total"
            value={summary.total}
            icon={Bell}
            color="primary"
          />
          <SummaryCard
            label="Críticos"
            value={summary.critical}
            icon={AlertTriangle}
            color="danger"
          />
          <SummaryCard
            label="Altos"
            value={summary.high}
            icon={AlertTriangle}
            color="warning"
          />
          <SummaryCard
            label="Médios"
            value={summary.medium}
            icon={AlertTriangle}
            color="secondary"
          />
          <SummaryCard
            label="Não lidos"
            value={summary.unread}
            icon={Bell}
            color="primary"
            highlight
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar alertas..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todas severidades</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Médio</option>
            <option value="low">Baixo</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos status</option>
            <option value="unread">Não lidos</option>
            <option value="read">Lidos</option>
            <option value="acknowledged">Reconhecidos</option>
            <option value="resolved">Resolvidos</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedAlerts.size > 0 && (
        <div className="bg-surface rounded-lg border border-border p-3 flex items-center justify-between">
          <span className="text-sm text-foreground-muted">
            {selectedAlerts.size} alertas selecionados
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleMarkMultipleAsRead}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar como lidos
            </button>
            <button
              onClick={() => setSelectedAlerts(new Set())}
              className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-foreground-muted" />
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <AlertSkeleton key={i} />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum alerta encontrado</h3>
          <p className="text-foreground-muted">
            {searchQuery || severityFilter !== 'all' || statusFilter !== 'all'
              ? 'Tente ajustar os filtros'
              : 'Todos os sistemas estão funcionando normalmente'}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* Select All */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedAlerts.size === filteredAlerts.length && filteredAlerts.length > 0}
              onChange={selectAllVisible}
              className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground-muted">Selecionar todos</span>
          </div>

          {/* Alerts */}
          <div className="divide-y divide-border">
            {filteredAlerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                isSelected={selectedAlerts.has(alert.id)}
                isExpanded={expandedAlert === alert.id}
                onToggleSelect={() => toggleSelection(alert.id)}
                onToggleExpand={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                onMarkAsRead={() => handleMarkAsRead(alert.id)}
                onAcknowledge={() => handleAcknowledge(alert.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Summary Card
interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'primary' | 'danger' | 'warning' | 'secondary';
  highlight?: boolean;
}

function SummaryCard({ label, value, icon: Icon, color, highlight }: SummaryCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    danger: 'text-danger-500 bg-danger-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    secondary: 'text-secondary bg-secondary/10',
  };

  return (
    <div
      className={cn(
        'bg-surface rounded-lg border p-4 flex items-center gap-3',
        highlight && value > 0 ? 'border-primary' : 'border-border'
      )}
    >
      <div className={cn('p-2 rounded-lg', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-foreground-muted">{label}</p>
      </div>
    </div>
  );
}

// Alert Row
interface AlertRowProps {
  alert: Alert;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onMarkAsRead: () => void;
  onAcknowledge: () => void;
}

function AlertRow({
  alert,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onMarkAsRead,
  onAcknowledge,
}: AlertRowProps) {
  const severityStyles = {
    critical: 'bg-danger-500 text-white',
    high: 'bg-warning-500 text-white',
    medium: 'bg-secondary text-white',
    low: 'bg-foreground-subtle text-white',
  };

  return (
    <div className={cn('transition-colors', !alert.isRead && 'bg-primary/5')}>
      <div
        className="flex items-start gap-4 p-4 hover:bg-surface-hover cursor-pointer"
        onClick={onToggleExpand}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="mt-1 w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
        />

        <span
          className={cn(
            'px-2 py-0.5 text-2xs font-medium rounded-full uppercase shrink-0',
            severityStyles[alert.severity as keyof typeof severityStyles]
          )}
        >
          {alert.severity}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn('font-medium truncate', !alert.isRead ? 'text-foreground' : 'text-foreground-muted')}>
              {alert.title}
            </h4>
            {!alert.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
          </div>
          <p className="text-sm text-foreground-muted truncate">{alert.message}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-foreground-subtle">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(alert.createdAt)}
            </span>
            {alert.isAcknowledged && (
              <span className="flex items-center gap-1 text-success-500">
                <Check className="w-3 h-3" />
                Reconhecido
              </span>
            )}
            {alert.resolvedAt && (
              <span className="flex items-center gap-1 text-success-500">
                <CheckCheck className="w-3 h-3" />
                Resolvido
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            'w-5 h-5 text-foreground-muted transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 ml-12 border-t border-border mt-0 pt-4">
          <p className="text-sm text-foreground-muted mb-4">{alert.message}</p>

          {alert.data && (
            <div className="bg-background rounded-lg p-3 mb-4">
              <p className="text-xs text-foreground-subtle mb-2">Dados adicionais:</p>
              <pre className="text-xs text-foreground overflow-x-auto">
                {JSON.stringify(alert.data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex gap-2">
            {!alert.isRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-hover hover:bg-surface-active text-sm rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Marcar como lido
              </button>
            )}
            {!alert.isAcknowledged && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Reconhecer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-4 h-4 rounded bg-surface-hover" />
        <div className="w-16 h-5 rounded-full bg-surface-hover" />
        <div className="flex-1">
          <div className="h-5 w-48 bg-surface-hover rounded mb-2" />
          <div className="h-4 w-full bg-surface-hover rounded mb-2" />
          <div className="h-3 w-24 bg-surface-hover rounded" />
        </div>
      </div>
    </div>
  );
}
