/**
 * useUnifiedDecision Hook
 * Consumes Unified Decision Engine API
 * Returns decision based on 5-level priority hierarchy
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  DecisionResult,
  SystemTelemetry,
  GridState,
  MarketData,
  SystemConstraints,
  OptimizationConfig,
} from '@lifo4/shared/types/optimization';
import api from '@/services/api';

interface DecisionPayload {
  systemId: string;
  telemetry: SystemTelemetry;
  gridState: GridState;
  marketData: MarketData;
  constraints?: SystemConstraints;
  config?: OptimizationConfig;
}

interface DecisionResponse {
  success: boolean;
  data: {
    systemId: string;
    decision: DecisionResult;
    timestamp: string;
  };
}

/**
 * Hook to make a single decision
 */
export function useUnifiedDecision() {
  return useMutation<DecisionResponse, Error, DecisionPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/decision', payload);
      return data;
    },
  });
}

/**
 * Hook to make batch decisions for multiple systems
 */
export function useUnifiedDecisionBatch() {
  return useMutation<any, Error, { decisions: DecisionPayload[] }>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/decision/batch', payload);
      return data;
    },
  });
}

/**
 * Hook to get priority level information
 */
export function usePriorityInfo(priority: string) {
  return useQuery({
    queryKey: ['priority-info', priority],
    queryFn: async () => {
      const { data } = await api.get(`/optimization/decision/priority/${priority}`);
      return data;
    },
    enabled: !!priority,
  });
}

/**
 * Hook to get default configuration
 */
export function useDefaultConfig() {
  return useQuery({
    queryKey: ['default-config'],
    queryFn: async () => {
      const { data } = await api.get('/optimization/config/default');
      return data;
    },
  });
}
