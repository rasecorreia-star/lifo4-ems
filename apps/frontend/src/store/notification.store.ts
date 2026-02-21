import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification, NotificationType, NotificationCategory } from '@/components/notifications/NotificationCenter';

interface NotificationState {
  notifications: Notification[];
  isConnected: boolean;
  soundEnabled: boolean;
  desktopNotificationsEnabled: boolean;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  setConnected: (connected: boolean) => void;
  toggleSound: () => void;
  toggleDesktopNotifications: () => void;

  // Getters
  getUnreadCount: () => number;
  getCriticalCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      isConnected: false,
      soundEnabled: true,
      desktopNotificationsEnabled: false,

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
        }));

        // Play sound for critical notifications
        const { soundEnabled, desktopNotificationsEnabled } = get();
        if (soundEnabled && (notification.type === 'critical' || notification.type === 'warning')) {
          playNotificationSound(notification.type);
        }

        // Show desktop notification
        if (desktopNotificationsEnabled && Notification.permission === 'granted') {
          showDesktopNotification(newNotification);
        }
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      deleteNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      setConnected: (connected) => {
        set({ isConnected: connected });
      },

      toggleSound: () => {
        set((state) => ({ soundEnabled: !state.soundEnabled }));
      },

      toggleDesktopNotifications: () => {
        const current = get().desktopNotificationsEnabled;
        if (!current && Notification.permission !== 'granted') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              set({ desktopNotificationsEnabled: true });
            }
          });
        } else {
          set({ desktopNotificationsEnabled: !current });
        }
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },

      getCriticalCount: () => {
        return get().notifications.filter((n) => n.type === 'critical' && !n.read).length;
      },
    }),
    {
      name: 'notification-storage',
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        // Don't persist notifications - they should come fresh from server
      }),
    }
  )
);

// Audio context for notification sounds
let audioContext: AudioContext | null = null;

function playNotificationSound(type: NotificationType) {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different sounds for different types
    if (type === 'critical') {
      // Urgent beep sequence
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      // Gentle notification
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

function showDesktopNotification(notification: Notification) {
  const icon = notification.type === 'critical' ? '🔴' : notification.type === 'warning' ? '🟡' : '🔵';

  new Notification(`${icon} ${notification.title}`, {
    body: notification.message,
    tag: notification.id,
    requireInteraction: notification.type === 'critical',
  });
}

// Simulated notification generator for development
export function generateMockNotifications(): Notification[] {
  const types: NotificationType[] = ['critical', 'warning', 'info', 'success'];
  const categories: NotificationCategory[] = ['battery', 'grid', 'system', 'thermal', 'maintenance'];

  const mockNotifications: Array<{
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
  }> = [
    {
      type: 'critical',
      category: 'battery',
      title: 'Sobretensao Detectada',
      message: 'Celula B12 do modulo 3 excedeu limite de tensao (3.75V). Verificacao imediata necessaria.',
    },
    {
      type: 'warning',
      category: 'thermal',
      title: 'Temperatura Elevada',
      message: 'Rack 2 atingiu 42°C. Sistema de refrigeracao ativado.',
    },
    {
      type: 'info',
      category: 'grid',
      title: 'Sincronizacao Completa',
      message: 'Sistema reconectado a rede apos manutencao programada.',
    },
    {
      type: 'success',
      category: 'system',
      title: 'Backup Concluido',
      message: 'Backup automatico dos dados do sistema realizado com sucesso.',
    },
    {
      type: 'warning',
      category: 'battery',
      title: 'SOC Baixo',
      message: 'Estado de carga abaixo de 20%. Considere carregar o sistema.',
    },
    {
      type: 'critical',
      category: 'grid',
      title: 'Falha de Comunicacao',
      message: 'Perda de comunicacao com inversor INV-001. Verificar conexao.',
    },
    {
      type: 'info',
      category: 'maintenance',
      title: 'Manutencao Programada',
      message: 'Manutencao preventiva agendada para amanha as 08:00.',
    },
    {
      type: 'success',
      category: 'battery',
      title: 'Balanceamento Concluido',
      message: 'Balanceamento de celulas do modulo 1 finalizado com sucesso.',
    },
  ];

  return mockNotifications.map((n, index) => ({
    ...n,
    id: `mock-${index}-${Date.now()}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 2), // Random time in last 2 days
    read: Math.random() > 0.5,
    systemId: 'system-001',
    systemName: 'BESS Principal',
    actionUrl: n.type === 'critical' ? `/systems/system-001` : undefined,
    actionLabel: n.type === 'critical' ? 'Verificar sistema' : undefined,
  }));
}
