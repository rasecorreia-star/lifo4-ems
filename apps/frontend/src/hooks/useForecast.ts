/**
 * useForecast Hook
 * Consumes ML Forecasting API with 5 models
 * Returns demand, price, and solar forecasts
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';

interface ForecastParams {
  currentHour?: number;
  solarCapacity?: number;
  horizonHours?: number;
}

/**
 * Hook to get ensemble forecast (24 hours)
 */
export function useEnsembleForecast(params: ForecastParams = {}) {
  const {
    currentHour = new Date().getHours(),
    solarCapacity = 100,
    horizonHours = 24,
  } = params;

  return useQuery({
    queryKey: ['forecast-ensemble', currentHour, solarCapacity, horizonHours],
    queryFn: async () => {
      const { data } = await api.get('/ml/forecast/ensemble', {
        params: {
          currentHour: currentHour.toString(),
          solarCapacity: solarCapacity.toString(),
          horizonHours: horizonHours.toString(),
        },
      });
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to get available ML models
 */
export function useAvailableModels() {
  return useQuery({
    queryKey: ['forecasting-models'],
    queryFn: async () => {
      const { data } = await api.get('/ml/forecast/models');
      return data;
    },
  });
}

/**
 * Hook to compare multiple model predictions
 */
export function useCompareModels() {
  return useMutation<
    any,
    Error,
    {
      currentHour: number;
      historicalDemand: number[];
      historicalPrices: number[];
      solarCapacity?: number;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/forecast/compare', payload);
      return data;
    },
  });
}

/**
 * Hook to get specific model information
 */
export function useModelInfo(modelName: string) {
  return useQuery({
    queryKey: ['model-info', modelName],
    queryFn: async () => {
      const { data } = await api.get(`/ml/forecast/model-info/${modelName}`);
      return data;
    },
    enabled: !!modelName,
  });
}

/**
 * Hook to get uncertainty bounds for forecast
 */
export function useUncertaintyBounds() {
  return useMutation<
    any,
    Error,
    {
      forecastValue: number;
      hoursAhead: number;
      horizonHours?: number;
      isSolarForecast?: boolean;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ml/forecast/uncertainty', payload);
      return data;
    },
  });
}

/**
 * Hook to get forecast data
 */
export function useForecast(systemId: string) {
  const ensemble = useEnsembleForecast();

  return {
    data: {
      hourly: [],
      weekly: [],
      seasonal: [],
      ...ensemble.data,
    },
    isLoading: ensemble.isLoading,
    isError: ensemble.isError,
  };
}
