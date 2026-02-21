import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell, User, Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore, generateMockNotifications } from '@/store/notification.store';
import { useSimulatedNotifications } from '@/hooks/useWebSocket';
import NotificationCenter from '@/components/notifications/NotificationCenter';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  const {
    notifications,
    isConnected,
    soundEnabled,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    toggleSound,
    getUnreadCount,
    getCriticalCount,
  } = useNotificationStore();

  // Use simulated notifications in development
  useSimulatedNotifications(import.meta.env.DEV);

  // Load mock notifications on first mount (development only)
  useEffect(() => {
    if (import.meta.env.DEV && notifications.length === 0) {
      const mockNotifications = generateMockNotifications();
      mockNotifications.forEach((n) => {
        addNotification({
          type: n.type,
          category: n.category,
          title: n.title,
          message: n.message,
          systemId: n.systemId,
          systemName: n.systemName,
          actionUrl: n.actionUrl,
          actionLabel: n.actionLabel,
        });
      });
    }
  }, []);

  const unreadCount = getUnreadCount();
  const criticalCount = getCriticalCount();

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-surface-hover rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Connection Status */}
          <div
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
              isConnected ? 'bg-success-500/20 text-success-500' : 'bg-warning-500/20 text-warning-500'
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </>
            )}
          </div>

          {/* Critical Alerts Indicator */}
          {criticalCount > 0 && (
            <button
              onClick={() => setIsNotificationPanelOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-danger-500/20 text-danger-500 animate-pulse"
            >
              <span className="w-2 h-2 bg-danger-500 rounded-full" />
              {criticalCount} alerta{criticalCount > 1 ? 's' : ''} critico{criticalCount > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={cn(
              'p-2 rounded-lg transition-colors',
              soundEnabled ? 'hover:bg-surface-hover' : 'bg-surface-hover'
            )}
            title={soundEnabled ? 'Som ativado' : 'Som desativado'}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-foreground-muted" />
            ) : (
              <VolumeX className="w-5 h-5 text-foreground-muted" />
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => setIsNotificationPanelOpen(true)}
            className="relative p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Bell className={cn(
              'w-5 h-5',
              criticalCount > 0 ? 'text-danger-500' : 'text-foreground-muted'
            )} />
            {unreadCount > 0 && (
              <span className={cn(
                'absolute top-1 right-1 min-w-4 h-4 px-1 text-white text-2xs font-bold rounded-full flex items-center justify-center',
                criticalCount > 0 ? 'bg-danger-500 animate-pulse' : 'bg-primary'
              )}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <Link
            to="/profile"
            className="flex items-center gap-2 p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="hidden sm:block text-sm font-medium text-foreground">
              {user?.name?.split(' ')[0]}
            </span>
          </Link>
        </div>
      </header>

      {/* Notification Panel */}
      <NotificationCenter
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAll}
      />
    </>
  );
}
