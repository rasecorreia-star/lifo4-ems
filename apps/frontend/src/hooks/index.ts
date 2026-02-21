/**
 * Custom Hooks Index
 * Exports all API hooks for easy importing
 */

// Unified Decision
export {
  useUnifiedDecision,
  useUnifiedDecisionBatch,
  usePriorityInfo,
  useDefaultConfig,
} from './useUnifiedDecision';

// Arbitrage
export {
  useArbitrage,
  useArbitrageEvaluate,
  useArbitrageRevenue,
  useMarketSignal,
  useArbitrageStrategy,
} from './useArbitrage';

// Peak Shaving
export {
  usePeakShavingEvaluate,
  usePeakShavingSavings,
  usePeakShavingCompliance,
  usePeakShavingROI,
  useTariffInfo,
} from './usePeakShaving';

// Forecasting
export {
  useEnsembleForecast,
  useAvailableModels,
  useCompareModels,
  useModelInfo,
  useUncertaintyBounds,
} from './useForecast';

// Battery Health
export {
  useCalculateSOH,
  useEstimateDegradation,
  useEstimateRemainingLife,
  useHealthReport,
  useWarrantyStatus,
  useDegradationCost,
} from './useBatteryHealth';

// Grid Services
export {
  useSelectControlMode,
  useCurrentControlMode,
  useDemandResponse,
  useDRCompliance,
  useVPPState,
  useRegisterVPP,
  useCoordinateVPPDispatch,
  useTariffSchedule,
  useCalculateLoadShedding,
} from './useGridServices';

// Black Start
export {
  useProcessBlackout,
  useBlackStartStateHistory,
  useEstimateIslandDuration,
  useBlackStartCapability,
  useEstimateRestorationTime,
  useFSMStates,
  useResetFSM,
} from './useBlackStart';

// Maintenance
export {
  useEvaluateComponent,
  useMaintenanceRecommendation,
  usePredictFailure,
  useMaintenanceModelMetrics,
  useCostComparison,
  useComponentTypes,
} from './useMaintenance';

// Virtual Power Plant (VPP)
export {
  useVPPAssets,
  useVPPDispatch,
} from './useVPP';

// Solar Self-Consumption
export {
  useSolarSelfConsumption,
} from './useSolarSelfConsumption';
