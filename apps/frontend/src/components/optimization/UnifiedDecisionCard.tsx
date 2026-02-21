/**
 * Unified Decision Card Component
 * Displays decision engine result with priority level and action
 */

import React, { useEffect, useState } from 'react';
import { useUnifiedDecision } from '@/hooks';
import { DecisionResult } from '@lifo4/shared/types/optimization';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

interface UnifiedDecisionCardProps {
  systemId: string;
  telemetry: any;
  gridState: any;
  marketData: any;
  onDecisionUpdate?: (decision: DecisionResult) => void;
  autoRefresh?: number; // ms
}

const priorityColors: Record<string, string> = {
  SAFETY: 'bg-red-100 border-red-500',
  GRID_CODE: 'bg-orange-100 border-orange-500',
  CONTRACTUAL: 'bg-yellow-100 border-yellow-500',
  ECONOMIC: 'bg-blue-100 border-blue-500',
  LONGEVITY: 'bg-green-100 border-green-500',
};

const actionIcons: Record<string, React.ReactNode> = {
  CHARGE: <Zap className="text-blue-600" size={24} />,
  DISCHARGE: <Zap className="text-red-600" size={24} />,
  IDLE: <Clock className="text-gray-600" size={24} />,
  EMERGENCY_STOP: <AlertCircle className="text-red-700" size={24} />,
  GRID_SUPPORT: <CheckCircle className="text-green-600" size={24} />,
  FREQUENCY_RESPONSE: <Zap className="text-orange-600" size={24} />,
};

export function UnifiedDecisionCard({
  systemId,
  telemetry,
  gridState,
  marketData,
  onDecisionUpdate,
  autoRefresh = 5000,
}: UnifiedDecisionCardProps) {
  const { mutate: makeDecision, data, isPending, error } = useUnifiedDecision();
  const [lastDecision, setLastDecision] = useState<DecisionResult | null>(null);

  // Auto-refresh decision
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      makeDecision({
        systemId,
        telemetry,
        gridState,
        marketData,
      });
    }, autoRefresh);

    return () => clearInterval(interval);
  }, [systemId, telemetry, gridState, marketData, autoRefresh, makeDecision]);

  // Initial decision
  useEffect(() => {
    makeDecision({
      systemId,
      telemetry,
      gridState,
      marketData,
    });
  }, [systemId]);

  // Update local state and notify parent
  useEffect(() => {
    if (data?.data.decision) {
      setLastDecision(data.data.decision);
      onDecisionUpdate?.(data.data.decision);
    }
  }, [data, onDecisionUpdate]);

  if (isPending && !lastDecision) {
    return (
      <div className="p-6 bg-gray-100 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </div>
    );
  }

  const decision = lastDecision || data?.data.decision;

  if (!decision) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Erro ao obter decisão</p>
        {error && <p className="text-sm text-red-600">{error.message}</p>}
      </div>
    );
  }

  return (
    <div
      className={`p-6 border-2 rounded-lg ${
        priorityColors[decision.priority] || 'bg-gray-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">{decision.action}</h3>
          <p className="text-sm text-gray-600">
            Prioridade: <span className="font-semibold">{decision.priority}</span>
          </p>
        </div>
        <div className="text-3xl">{actionIcons[decision.action]}</div>
      </div>

      {/* Decision Details */}
      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-700">{decision.reason}</p>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Potência:</span>
            <p className="font-semibold">
              {decision.powerKW > 0 ? '+' : ''}
              {decision.powerKW.toFixed(1)} kW
            </p>
          </div>
          <div>
            <span className="text-gray-600">Duração:</span>
            <p className="font-semibold">{decision.durationMinutes} min</p>
          </div>
          <div>
            <span className="text-gray-600">Confiança:</span>
            <p className="font-semibold">{(decision.confidence * 100).toFixed(0)}%</p>
          </div>
          <div>
            <span className="text-gray-600">Próx. Revisão:</span>
            <p className="font-semibold">
              {new Date(decision.nextReviewAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {decision.metadata && (
          <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded">
            <p>Metadados:</p>
            {Object.entries(decision.metadata).map(([key, value]) => (
              <p key={key}>
                {key}: {String(value)}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Confiança</span>
          <span className="font-semibold">{(decision.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${decision.confidence * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-500 text-right">
        {new Date(decision.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
