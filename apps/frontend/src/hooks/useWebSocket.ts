import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/store/notification.store';
import { useAuthStore } from '@/store/auth.store';

interface WebSocketMessage {
  type: 'notification' | 'telemetry' | 'alarm' | 'status';
  payload: any;
}

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `ws://${window.location.hostname}:3001/ws`,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    onMessage,
    onConnect,
    onDisconnect,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { addNotification, setConnected } = useNotificationStore();
  const { isAuthenticated, accessToken } = useAuthStore();

  const connect = useCallback(() => {
    if (!isAuthenticated || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Include token as query param for authentication
      const wsUrl = accessToken ? `${url}?token=${accessToken}` : url;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle notification messages
          if (message.type === 'notification') {
            addNotification(message.payload);
          }

          // Handle alarm messages (convert to notification)
          if (message.type === 'alarm') {
            addNotification({
              type: message.payload.severity === 'critical' ? 'critical' : 'warning',
              category: message.payload.category || 'system',
              title: message.payload.title,
              message: message.payload.message,
              systemId: message.payload.systemId,
              systemName: message.payload.systemName,
            });
          }

          // Call custom message handler
          onMessage?.(message);
        } catch (error) {
          // Silent error handling - log WebSocket message parse error
          console.error('[WebSocket] Message parse error:', error);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        // Error is typically followed by onclose, no need to log here
        console.error('[WebSocket] Connection error');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [url, accessToken, isAuthenticated, addNotification, setConnected, onConnect, onDisconnect, onMessage, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setConnected(false);
  }, [setConnected]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message - not connected');
    }
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to ensure token is available
      const timeout = setTimeout(connect, 500);
      return () => clearTimeout(timeout);
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    connect,
    disconnect,
    send,
  };
}

// Hook for simulating WebSocket notifications in development
export function useSimulatedNotifications(enabled: boolean = true) {
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!enabled) return;

    // Simulate random notifications for demo
    const interval = setInterval(() => {
      const random = Math.random();

      // 20% chance of notification every 30 seconds
      if (random < 0.2) {
        const types = ['critical', 'warning', 'info', 'success'] as const;
        const categories = ['battery', 'grid', 'system', 'thermal', 'maintenance'] as const;

        const notifications = [
          {
            type: 'info' as const,
            category: 'system' as const,
            title: 'Telemetria Atualizada',
            message: 'Dados de telemetria recebidos com sucesso.',
          },
          {
            type: 'warning' as const,
            category: 'battery' as const,
            title: 'Desbalanceamento Detectado',
            message: 'Diferenca de tensao entre celulas maior que 50mV.',
          },
          {
            type: 'success' as const,
            category: 'grid' as const,
            title: 'Exportacao de Energia',
            message: 'Exportando 150kW para a rede durante horario de pico.',
          },
          {
            type: 'info' as const,
            category: 'maintenance' as const,
            title: 'Ciclo de Carga',
            message: 'Iniciando ciclo de carga programado.',
          },
        ];

        const selected = notifications[Math.floor(Math.random() * notifications.length)];
        addNotification({
          ...selected,
          systemId: 'system-001',
          systemName: 'BESS Principal',
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, addNotification]);
}
