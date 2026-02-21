/**
 * useBlackStart Hook
 * Consumes Black Start API
 * Handles grid restoration FSM and blackout scenarios
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { GridState, SystemTelemetry } from '@lifo4/shared/types/optimization';
import api from '@/services/api';

/**
 * Hook to process blackout and transition FSM
 */
export function useProcessBlackout() {
  return useMutation<
    any,
    Error,
    {
      systemId: string;
      gridState: GridState;
      telemetry: SystemTelemetry;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/grid-services/black-start/process', payload);
      return data;
    },
  });
}

/**
 * Hook to get FSM state history
 */
export function useBlackStartStateHistory() {
  return useQuery({
    queryKey: ['black-start-history'],
    queryFn: async () => {
      const { data } = await api.get('/optimization/grid-services/black-start/state-history');
      return data;
    },
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

/**
 * Hook to estimate island mode duration
 */
export function useEstimateIslandDuration() {
  return useMutation<
    any,
    Error,
    {
      batteryCapacityKWh: number;
      currentSOC: number;
      averageLoadKW: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/grid-services/black-start/island-duration', payload);
      return data;
    },
  });
}

/**
 * Hook to check black start capability
 */
export function useBlackStartCapability() {
  return useMutation<
    any,
    Error,
    {
      telemetry: SystemTelemetry;
      gridState: GridState;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/grid-services/black-start/capability', payload);
      return data;
    },
  });
}

/**
 * Hook to estimate grid restoration time
 */
export function useEstimateRestorationTime() {
  return useMutation<
    any,
    Error,
    {
      gridState: GridState;
      telemetry: SystemTelemetry;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/grid-services/black-start/restoration-time', payload);
      return data;
    },
  });
}

/**
 * Hook to get available FSM states
 */
export function useFSMStates() {
  return useQuery({
    queryKey: ['fsm-states'],
    queryFn: async () => {
      const { data } = await api.get('/optimization/grid-services/black-start/fsm-states');
      return data;
    },
  });
}

/**
 * Hook to reset FSM to initial state
 */
export function useResetFSM() {
  return useMutation<any, Error, { systemId: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/optimization/grid-services/black-start/reset', payload);
      return data;
    },
  });
}

/**
 * Hook to get black start data
 */
export function useBlackStart(systemId: string) {
  const history = useBlackStartStateHistory();

  return {
    data: {
      loads: [],
      soc: 85,
      ...history.data,
    },
    isLoading: history.isLoading,
    isError: history.isError,
  };
}
