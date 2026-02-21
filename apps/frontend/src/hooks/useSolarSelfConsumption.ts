/**
 * Solar Self-Consumption Optimization Hook
 * Manages solar generation and battery storage coordination
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { buildApiUrl } from '@/services/config';

interface SolarSelfConsumptionData {
  solarGeneration: number;
  gridImport: number;
  selfConsumptionRate: number;
  batteryCharge: number;
  savings: number;
  status: string;
}

/**
 * Get solar self-consumption status for a system
 */
export function useSolarSelfConsumption(systemId: string) {
  return useQuery({
    queryKey: ['solarSelfConsumption', systemId],
    queryFn: async () => {
      // This endpoint will return aggregated grid-services status
      // when dedicated solar endpoint is not available
      const response = await api.get(
        buildApiUrl(`/optimization/${systemId}/grid-services/status`)
      );
      return response.data.data as SolarSelfConsumptionData;
    },
    enabled: !!systemId,
    refetchInterval: 60000, // Refetch every minute
  });
}
