/**
 * useRealtimeDecision Hook
 * Real-time decision updates via WebSocket (Socket.IO)
 * Replaces HTTP polling for lower latency
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  DecisionResult,
  SystemTelemetry,
  GridState,
  MarketData,
} from '@lifo4/shared/types/optimization';
import { API_CONFIG } from '@/services/config';

interface UseRealtimeDecisionOptions {
  systemId: string;
  enabled?: boolean;
  onDecisionUpdate?: (decision: DecisionResult) => void;
  onError?: (error: Error) => void;
}

interface UseRealtimeDecisionReturn {
  decision: DecisionResult | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  requestDecision: (payload: {
    telemetry: SystemTelemetry;
    gridState: GridState;
    marketData: MarketData;
    constraints?: any;
    config?: any;
  }) => void;
}

export function useRealtimeDecision({
  systemId,
  enabled = true,
  onDecisionUpdate,
  onError,
}: UseRealtimeDecisionOptions): UseRealtimeDecisionReturn {
  const socketRef = useRef<Socket | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Connect to WebSocket
  useEffect(() => {
    if (!enabled || !systemId) return;

    // Get access token from localStorage (persisted by Zustand)
    let accessToken = '';
    try {
      const authData = localStorage.getItem('lifo4-auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        accessToken = parsed.state?.accessToken || '';
      }
    } catch {
      console.warn('Failed to parse lifo4-auth from localStorage');
    }

    const socket = io(API_CONFIG.wsURL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      socket.emit('subscribe:system', systemId);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err);
      setError(new Error(`Connection error: ${err}`));
      onError?.(new Error(`Connection error: ${err}`));
    });

    // Decision update
    socket.on('decision:update', (data) => {
      console.log('[Socket] Decision update received');
      setDecision(data.decision);
      setIsLoading(false);
      onDecisionUpdate?.(data.decision);
    });

    // Telemetry update
    socket.on('telemetry:update', (data) => {
      console.log('[Socket] Telemetry update received');
      // Can use this for real-time updates without requesting decision
    });

    // Alert
    socket.on('alert:new', (data) => {
      console.log('[Socket] Alert received');
      // Handle alerts
    });

    return () => {
      socket.emit('unsubscribe:system', systemId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, systemId, onDecisionUpdate, onError]);

  // Request decision
  const requestDecision = useCallback(
    (payload: {
      telemetry: SystemTelemetry;
      gridState: GridState;
      marketData: MarketData;
      constraints?: any;
      config?: any;
    }) => {
      if (!socketRef.current?.connected) {
        setError(new Error('Socket not connected'));
        return;
      }

      setIsLoading(true);
      socketRef.current.emit('request:decision', {
        systemId,
        ...payload,
      });
    },
    [systemId]
  );

  return {
    decision,
    isConnected,
    isLoading,
    error,
    requestDecision,
  };
}
