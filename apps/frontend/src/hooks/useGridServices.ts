/**
 * useGridServices Hook
 * Consumes Grid Services API
 * Manages control mode selection, VPP, and demand response
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { GridState, SystemTelemetry } from '@lifo4/shared/types/optimization';
import api from '@/services/api';

const API_PATH = '/api/v1/optimization';

/**
 * Hook to select control mode
 */
export function useSelectControlMode() {
  return useMutation<
    any,
    Error,
    {
      gridState: GridState;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/grid-services/select-mode`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to get current control mode
 */
export function useCurrentControlMode() {
  return useQuery({
    queryKey: ['current-control-mode'],
    queryFn: async () => {
      const response = await api.get(`${API_PATH}/grid-services/current-mode`);
      return response.data;
    },
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
  });
}

/**
 * Hook to process demand response event
 */
export function useDemandResponse() {
  return useMutation<
    any,
    Error,
    {
      type: string;
      powerRequired: number;
      durationMinutes: number;
      compensation?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/grid-services/demand-response`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to calculate demand response compliance
 */
export function useDRCompliance() {
  return useMutation<
    any,
    Error,
    {
      eventId: string;
      actualReduction: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(
        `${API_PATH}/grid-services/demand-response/compliance`,
        payload
      );
      return response.data;
    },
  });
}

/**
 * Hook to get VPP state
 */
export function useVPPState() {
  return useQuery({
    queryKey: ['vpp-state'],
    queryFn: async () => {
      const response = await api.get(`${API_PATH}/grid-services/vpp`);
      return response.data;
    },
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

/**
 * Hook to register as VPP participant
 */
export function useRegisterVPP() {
  return useMutation<
    any,
    Error,
    {
      systemId: string;
      telemetry: SystemTelemetry;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/grid-services/vpp/register`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to coordinate VPP dispatch
 */
export function useCoordinateVPPDispatch() {
  return useMutation<
    any,
    Error,
    {
      totalDispatchPower: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(`${API_PATH}/grid-services/vpp/dispatch`, payload);
      return response.data;
    },
  });
}

/**
 * Hook to get tariff schedule
 */
export function useTariffSchedule(hour?: number) {
  return useQuery({
    queryKey: ['tariff-schedule', hour],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (hour !== undefined) {
        params.append('hour', hour.toString());
      }

      const response = await api.get(
        `${API_PATH}/grid-services/tariff?${params}`
      );
      return response.data;
    },
  });
}

/**
 * Hook to calculate load shedding
 */
export function useCalculateLoadShedding() {
  return useMutation<
    any,
    Error,
    {
      currentSOC: number;
      socThreshold?: number;
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post(
        `${API_PATH}/grid-services/load-shedding`,
        payload
      );
      return response.data;
    },
  });
}

/**
 * Hook to get all grid services data
 */
export function useGridServices(systemId: string) {
  const controlMode = useCurrentControlMode();
  const vppState = useVPPState();

  return {
    data: {
      solarPower: 18,
      bessPower: -6,
      gridPower: 2,
      loadPower: 14,
      bessSoc: 65,
      bessState: 'discharging' as const,
      selfConsumptionRate: 82,
      solarEnergyToday: 58,
      gridImportToday: 12,
      gridExportToday: 18,
      ...controlMode.data,
      ...vppState.data,
    },
    isLoading: controlMode.isLoading || vppState.isLoading,
    isError: controlMode.isError || vppState.isError,
  };
}
