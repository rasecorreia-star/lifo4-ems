/**
 * useMaintenance Hook
 * Consumes Predictive Maintenance API
 * Handles failure prediction and maintenance scheduling
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';

/**
 * Hook to evaluate component health
 */
export function useEvaluateComponent() {
  return useMutation<
    any,
    Error,
    {
      componentType:
        | 'battery_pack'
        | 'bms'
        | 'inverter'
        | 'cooling_system'
        | 'electrical'
        | 'mechanical';
      metrics: Record<string, number>;
      historicalData?: Record<string, number[]>;
      lastMaintenanceDate?: string;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/maintenance/evaluate-component', payload);
      return data;
    },
  });
}

/**
 * Hook to get maintenance recommendation
 */
export function useMaintenanceRecommendation() {
  return useMutation<any, Error, any>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/maintenance/recommendation', payload);
      return data;
    },
  });
}

/**
 * Hook to predict failure probability
 */
export function usePredictFailure() {
  return useMutation<
    any,
    Error,
    {
      componentType: string;
      metrics: Record<string, number>;
      historicalData?: Record<string, number[]>;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/maintenance/predict-failure', payload);
      return data;
    },
  });
}

/**
 * Hook to get ML model metrics
 */
export function useMaintenanceModelMetrics() {
  return useQuery({
    queryKey: ['maintenance-model-metrics'],
    queryFn: async () => {
      const { data } = await api.get('/ml/maintenance/models/metrics');
      return data;
    },
  });
}

/**
 * Hook to compare preventive vs reactive maintenance costs
 */
export function useCostComparison() {
  return useMutation<
    any,
    Error,
    {
      failureProbability: number;
      plannedMaintenanceCost: number;
      unplannedRepairCost: number;
      downtimeHours: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/maintenance/cost-comparison', payload);
      return data;
    },
  });
}

/**
 * Hook to get trackable component types
 */
export function useComponentTypes() {
  return useQuery({
    queryKey: ['component-types'],
    queryFn: async () => {
      const { data } = await api.get('/ml/maintenance/components');
      return data;
    },
  });
}

/**
 * Hook to get maintenance data
 */
export function useMaintenance(systemId: string) {
  const metrics = useMaintenanceModelMetrics();

  return {
    data: {
      history: [],
      predictions: [],
      ...metrics.data,
    },
    isLoading: metrics.isLoading,
    isError: metrics.isError,
  };
}
