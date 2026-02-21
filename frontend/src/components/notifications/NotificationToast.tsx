import { useEffect, useState } from 'react';
import { X, AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification.store';
import type { Notification, NotificationType } from './NotificationCenter';

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: {
    icon: AlertCircle,
    color: 'text-danger-500',
    bg: 'bg-danger-500/10',
    border: 'border-danger-500/50'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning-500',
    bg: 'bg-warning-500/10',
    border: 'border-warning-500/50'
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/50'
  },
  success: {
    icon: Check,
    color: 'text-success-500',
    bg: 'bg-success-500/10',
    border: 'border-success-500/50'
  },
};

interface ToastItem {
  notification: Notification;
  isExiting: boolean;
}

export default function NotificationToast() {
  const { notifications } = useNotificationStore();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // Watch for new notifications
  useEffect(() => {
    const latestNotifications = notifications.slice(0, 5);

    latestNotifications.forEach((notification) => {
      if (!seenIds.has(notification.id) && !notification.read) {
        // Add to toasts
        setToasts((prev) => [
          { notification, isExiting: false },
          ...prev.slice(0, 4), // Keep max 5 toasts
        ]);

        // Mark as seen
        setSeenIds((prev) => new Set([...prev, notification.id]));

        // Auto-dismiss after delay
        const duration = notification.type === 'critical' ? 10000 : 5000;
        setTimeout(() => {
          dismissToast(notification.id);
        }, duration);
      }
    });
  }, [notifications]);

  const dismissToast = (id: string) => {
    // Start exit animation
    setToasts((prev) =>
      prev.map((t) =>
        t.notification.id === id ? { ...t, isExiting: true } : t
      )
    );

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.notification.id !== id));
    }, 300);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(({ notification, isExiting }) => {
        const Icon = typeConfig[notification.type].icon;

        return (
          <div
            key={notification.id}
            className={cn(
              'pointer-events-auto w-80 bg-surface border rounded-lg shadow-lg overflow-hidden transition-all duration-300',
              typeConfig[notification.type].border,
              isExiting
                ? 'opacity-0 translate-x-full'
                : 'opacity-100 translate-x-0 animate-slide-in'
            )}
          >
            <div className={cn('h-1', typeConfig[notification.type].bg.replace('/10', ''))} />
            <div className="p-3">
              <div className="flex gap-3">
                <div className={cn('p-1.5 rounded-lg', typeConfig[notification.type].bg)}>
                  <Icon className={cn('w-4 h-4', typeConfig[notification.type].color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {notification.title}
                    </h4>
                    <button
                      onClick={() => dismissToast(notification.id)}
                      className="p-0.5 hover:bg-surface-hover rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-foreground-muted" />
                    </button>
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  {notification.systemName && (
                    <p className="text-xs text-foreground-muted mt-1">
                      {notification.systemName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
