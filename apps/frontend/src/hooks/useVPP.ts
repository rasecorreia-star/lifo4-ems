/**
 * Virtual Power Plant (VPP) Hooks
 * Manages VPP state and asset coordination
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';
import { buildApiUrl } from '@/services/config';

interface VPPAsset {
  systemId: string;
  capacity: number;
  soc: number;
  available: boolean;
  status: string;
}

interface VPPState {
  participantCount: number;
  totalCapacity: number;
  availableCapacity: number;
  averageSOC: number;
  averageSOH: number;
  dispatchingPower: number;
  assets: VPPAsset[];
}

/**
 * Get VPP assets and state for a system
 */
export function useVPPAssets(systemId: string) {
  return useQuery({
    queryKey: ['vppAssets', systemId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/optimization/grid-services/vpp`);
      return response.data;
    },
    enabled: !!systemId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Dispatch VPP assets
 */
export function useVPPDispatch() {
  return useMutation({
    mutationFn: async ({ totalDispatchPower }: { totalDispatchPower: number }) => {
      const response = await api.post(
        '/api/v1/optimization/grid-services/vpp/dispatch',
        { totalDispatchPower }
      );
      return response.data;
    },
  });
}

/**
 * Hook to get VPP data
 */
export function useVPP(systemId: string) {
  const assets = useVPPAssets(systemId);

  return {
    data: {
      assets: assets.data?.assets || [],
      events: [],
      ...assets.data,
    },
    isLoading: assets.isLoading,
    isError: assets.isError,
  };
}
