/**
 * usePeakShaving Hook
 * Consumes Peak Shaving / Demand Management API
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { SystemTelemetry, MarketData } from '@lifo4/shared/types/optimization';
import api from '@/services/api';

const API_PATH = '/api/v1/optimization';

/**
 * Hook to evaluate peak shaving need
 */
export function usePeakShavingEvaluate() {
  return useMutation<
    any,
    Error,
    {
      telemetry: SystemTelemetry;
      marketData: MarketData;
      currentHour: number;
      batteryCapacity?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/peak-shaving/evaluate`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to calculate demand charge savings
 */
export function usePeakShavingSavings() {
  return useMutation<
    any,
    Error,
    {
      peakReduction: number;
      tariff?: { demandChargePerkW: number; seasonalFactor: number };
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(
        `${API_PATH}/peak-shaving/demand-charge-savings`,
        payload
      );
      return response.data;
    },
  });
}

/**
 * Hook to calculate compliance rate
 */
export function usePeakShavingCompliance() {
  return useMutation<
    any,
    Error,
    {
      demandForecast: number;
      actualDemand: number;
      complianceTarget?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/peak-shaving/compliance`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to calculate ROI
 */
export function usePeakShavingROI() {
  return useMutation<
    any,
    Error,
    {
      batteryInvestmentCost: number;
      peakReductionCapability: number;
      operatingCosts?: number;
      peakDaysPerYear?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/peak-shaving/roi`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to get tariff information
 */
export function useTariffInfo(hour?: number) {
  return useQuery({
    queryKey: ['tariff-info', hour],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (hour !== undefined) {
        params.append('hour', hour.toString());
      }

      const response = await api.get(`${API_PATH}/peak-shaving/tariff?${params}`);
      return response.data;
    },
  });
}
