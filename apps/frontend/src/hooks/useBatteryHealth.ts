/**
 * useBatteryHealth Hook
 * Consumes Battery Health API
 * Monitors SOH, degradation, RUL, and warranty status
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';

/**
 * Hook to calculate SOH
 */
export function useCalculateSOH() {
  return useMutation<
    any,
    Error,
    {
      currentCapacity: number;
      nominalCapacity: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/battery/calculate-soh', payload);
      return data;
    },
  });
}

/**
 * Hook to estimate degradation
 */
export function useEstimateDegradation() {
  return useMutation<
    any,
    Error,
    {
      cycleCount: number;
      operatingHoursPerDay: number;
      averageTemperature: number;
      daysOfOperation: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/battery/estimate-degradation', payload);
      return data;
    },
  });
}

/**
 * Hook to estimate remaining useful life
 */
export function useEstimateRemainingLife() {
  return useMutation<
    any,
    Error,
    {
      currentSOH: number;
      cycleCount: number;
      maxCycles: number;
      monthlyDegradationRate?: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/battery/estimate-life', payload);
      return data;
    },
  });
}

/**
 * Hook to generate comprehensive health report
 */
export function useHealthReport() {
  return useMutation<
    any,
    Error,
    {
      systemId: string;
      nominalCapacity: number;
      currentCapacity: number;
      cycleCount?: number;
      maxCycles?: number;
      operatingHoursPerDay?: number;
      averageTemperature?: number;
      daysOfOperation?: number;
      warrantyEndDate?: string;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/battery/health-report', payload);
      return data;
    },
  });
}

/**
 * Hook to check warranty status
 */
export function useWarrantyStatus(
  systemId: string,
  soh?: number,
  currentCapacity?: number,
  nominalCapacity?: number
) {
  return useQuery({
    queryKey: ['warranty-status', systemId, soh, currentCapacity, nominalCapacity],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (soh !== undefined) params.soh = soh.toString();
      if (currentCapacity !== undefined) params.currentCapacity = currentCapacity.toString();
      if (nominalCapacity !== undefined) params.nominalCapacity = nominalCapacity.toString();
      const { data } = await api.get(`/ml/battery/warranty-status/${systemId}`, { params });
      return data;
    },
    enabled: !!systemId,
  });
}

/**
 * Hook to calculate degradation cost
 */
export function useDegradationCost() {
  return useMutation<
    any,
    Error,
    {
      degradationPercent: number;
      batteryCapacityKWh: number;
      costPerKWh?: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/battery/degradation-cost', payload);
      return data;
    },
  });
}

/**
 * Hook to get battery health data
 */
export function useBatteryHealth(systemId: string) {
  const warranty = useWarrantyStatus(systemId);

  return {
    data: {
      degradation: [],
      cycles: [],
      temperature: [],
      ...warranty.data,
    },
    isLoading: warranty.isLoading,
    isError: warranty.isError,
  };
}
