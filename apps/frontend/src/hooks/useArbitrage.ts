/**
 * useArbitrage Hook
 * Consumes Energy Arbitrage API
 * Handles buy/sell decisions and revenue calculations
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { SystemTelemetry, MarketData } from '@lifo4/shared/types/optimization';
import api from '@/services/api';
import { buildApiUrl } from '@/services/config';

interface ArbitrageEvaluatePayload {
  telemetry: SystemTelemetry;
  marketData: MarketData;
  historicalPrices: { low: number; high: number };
  batteryCapacity?: number;
  config?: {
    enabled: boolean;
    buyThreshold: number;
    sellThreshold: number;
    minSOCMargin?: number;
    maxSOCMargin?: number;
    efficiency?: number;
  };
}

/**
 * Hook to evaluate arbitrage opportunity
 */
export function useArbitrageEvaluate() {
  return useMutation<any, Error, ArbitrageEvaluatePayload>({
    mutationFn: async (payload) => {
      const response = await api.post(
        buildApiUrl('/optimization/arbitrage/evaluate'),
        payload
      );
      return response.data.data;
    },
  });
}

/**
 * Hook to calculate revenue from arbitrage
 */
export function useArbitrageRevenue() {
  return useMutation<
    any,
    Error,
    {
      buyPrice: number;
      sellPrice: number;
      energyArbitraged: number;
      efficiency?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(
        buildApiUrl('/optimization/arbitrage/revenue'),
        payload
      );
      return response.data.data;
    },
  });
}

/**
 * Hook to get market signal strength
 */
export function useMarketSignal(
  spotPrice: number,
  historicalLow: number,
  historicalHigh: number
) {
  return useQuery({
    queryKey: ['market-signal', spotPrice, historicalLow, historicalHigh],
    queryFn: async () => {
      const response = await api.get(
        buildApiUrl(
          `/optimization/arbitrage/market-signal?spotPrice=${spotPrice}&historicalLow=${historicalLow}&historicalHigh=${historicalHigh}`
        )
      );
      return response.data.data;
    },
    enabled: spotPrice > 0 && historicalLow >= 0 && historicalHigh > 0,
  });
}

/**
 * Hook to get arbitrage strategy recommendation
 */
export function useArbitrageStrategy() {
  return useMutation<
    any,
    Error,
    {
      spotPrice: number;
      historicalLow: number;
      historicalHigh: number;
      currentSOC: number;
      batteryCapacity?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(
        buildApiUrl('/optimization/arbitrage/strategy'),
        payload
      );
      return response.data.data;
    },
  });
}

/**
 * Hook to get arbitrage data from API
 */
export function useArbitrage(systemId: string) {
  return useQuery({
    queryKey: ['arbitrage', systemId],
    queryFn: async () => {
      const response = await api.get(
        buildApiUrl(`/optimization/${systemId}/arbitrage/status`)
      );
      return response.data.data as {
        prices: Array<{ hour: string; spotPrice: number }>;
        revenue: Array<{ date: string; netRevenue: number; sold: number; bought: number }>;
        orders: Array<{ id: string; type: string; quantity: number; price: number; timestamp: string }>;
      };
    },
    enabled: !!systemId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
