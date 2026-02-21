import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Battery,
  Thermometer,
  Network,
  Settings,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationType = 'critical' | 'warning' | 'info' | 'success';
export type NotificationCategory = 'battery' | 'grid' | 'system' | 'thermal' | 'maintenance';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  systemId?: string;
  systemName?: string;
  actionUrl?: string;
  actionLabel?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  critical: { icon: AlertCircle, color: 'text-danger-500', bg: 'bg-danger-500/10' },
  warning: { icon: AlertTriangle, color: 'text-warning-500', bg: 'bg-warning-500/10' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  success: { icon: Check, color: 'text-success-500', bg: 'bg-success-500/10' },
};

const categoryConfig: Record<NotificationCategory, { icon: React.ElementType; label: string }> = {
  battery: { icon: Battery, label: 'Bateria' },
  grid: { icon: Network, label: 'Rede' },
  system: { icon: Settings, label: 'Sistema' },
  thermal: { icon: Thermometer, label: 'Termica' },
  maintenance: { icon: Zap, label: 'Manutencao' },
};

export default function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (filter !== 'all' && n.type !== filter) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.type === 'critical' && !n.read).length;

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atras`;
    if (hours < 24) return `${hours}h atras`;
    return `${days}d atras`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-surface border-l border-border flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Notificacoes</h2>
              <p className="text-xs text-foreground-muted">
                {unreadCount} nao lidas
                {criticalCount > 0 && (
                  <span className="text-danger-500 ml-1">({criticalCount} criticas)</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-foreground-muted" />
            <span className="text-xs text-foreground-muted">Tipo:</span>
            <div className="flex gap-1">
              {(['all', 'critical', 'warning', 'info', 'success'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md transition-colors',
                    filter === type
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                  )}
                >
                  {type === 'all' ? 'Todos' : type === 'critical' ? 'Critico' : type === 'warning' ? 'Alerta' : type === 'info' ? 'Info' : 'Sucesso'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-muted ml-6">Categoria:</span>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'battery', 'grid', 'system', 'thermal', 'maintenance'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md transition-colors',
                    categoryFilter === cat
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                  )}
                >
                  {cat === 'all' ? 'Todas' : categoryConfig[cat].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-hover/50">
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            disabled={unreadCount === 0}
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como lidas
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-danger-500 hover:text-danger-400 transition-colors"
            disabled={notifications.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            Limpar todas
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-foreground-muted">
              <Bell className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma notificacao</p>
              <p className="text-xs">Voce esta em dia!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => {
                const TypeIcon = typeConfig[notification.type].icon;
                const CategoryIcon = categoryConfig[notification.category].icon;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 hover:bg-surface-hover transition-colors cursor-pointer',
                      !notification.read && 'bg-primary/5'
                    )}
                    onClick={() => onMarkAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn('p-2 rounded-lg', typeConfig[notification.type].bg)}>
                        <TypeIcon className={cn('w-5 h-5', typeConfig[notification.type].color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className={cn(
                                'text-sm font-medium',
                                notification.read ? 'text-foreground-muted' : 'text-foreground'
                              )}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-primary rounded-full" />
                              )}
                            </div>
                            <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(notification.id);
                            }}
                            className="p-1 hover:bg-danger-500/10 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-foreground-muted hover:text-danger-500" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 text-xs text-foreground-muted">
                            <CategoryIcon className="w-3 h-3" />
                            {categoryConfig[notification.category].label}
                          </div>
                          {notification.systemName && (
                            <span className="text-xs text-foreground-muted">
                              • {notification.systemName}
                            </span>
                          )}
                          <span className="text-xs text-foreground-muted ml-auto">
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                        {notification.actionUrl && (
                          <a
                            href={notification.actionUrl}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-block mt-2 text-xs text-primary hover:underline"
                          >
                            {notification.actionLabel || 'Ver detalhes'} →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface-hover/50">
          <a
            href="/alerts"
            className="block text-center text-sm text-primary hover:underline"
          >
            Ver todos os alertas →
          </a>
        </div>
      </div>
    </div>
  );
}
