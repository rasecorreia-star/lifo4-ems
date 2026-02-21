/**
 * Maintenance Alert Component
 * Shows failure predictions and maintenance recommendations
 */

import React, { useEffect } from 'react';
import { usePredictFailure } from '@/hooks';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface MaintenanceAlertProps {
  componentType:
    | 'battery_pack'
    | 'bms'
    | 'inverter'
    | 'cooling_system'
    | 'electrical'
    | 'mechanical';
  metrics: Record<string, number>;
  historicalData?: Record<string, number[]>;
}

const componentNames: Record<string, string> = {
  battery_pack: 'Bateria',
  bms: 'Sistema de Gerenciamento',
  inverter: 'Inversor',
  cooling_system: 'Sistema de Resfriamento',
  electrical: 'Sistema Elétrico',
  mechanical: 'Conjunto Mecânico',
};

const riskColors: Record<string, string> = {
  Critical: 'bg-red-100 border-red-300',
  High: 'bg-orange-100 border-orange-300',
  Medium: 'bg-yellow-100 border-yellow-300',
  Low: 'bg-green-100 border-green-300',
};

const riskIcons: Record<string, React.ReactNode> = {
  Critical: <AlertTriangle className="text-red-600" size={24} />,
  High: <AlertTriangle className="text-orange-600" size={24} />,
  Medium: <AlertCircle className="text-yellow-600" size={24} />,
  Low: <CheckCircle className="text-green-600" size={24} />,
};

export function MaintenanceAlert({
  componentType,
  metrics,
  historicalData,
}: MaintenanceAlertProps) {
  const { mutate: predictFailure, data, isPending } = usePredictFailure();

  useEffect(() => {
    predictFailure({
      componentType,
      metrics,
      historicalData: historicalData || {},
    });
  }, [componentType, metrics]);

  const prediction = data?.data;

  if (isPending) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg animate-pulse h-32"></div>
    );
  }

  if (!prediction) {
    return null;
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 ${
        riskColors[prediction.riskLevel] || 'bg-gray-100'
      }`}
    >
      <div className="flex items-start gap-4">
        <div>{riskIcons[prediction.riskLevel]}</div>
        <div className="flex-1">
          <h4 className="font-bold text-lg mb-2">{componentNames[componentType]}</h4>
          <p className="text-sm text-gray-700 mb-3">{prediction.recommendation}</p>

          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
            <div className="p-2 bg-white rounded">
              <p className="text-gray-600">Risco de Falha</p>
              <p className="text-lg font-bold">{prediction.failureProbability}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-gray-600">Tempo até Falha</p>
              <p className="text-lg font-bold">{prediction.timeToFailureMonths}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-gray-600">Nível de Risco</p>
              <p className="text-lg font-bold">{prediction.riskLevel}</p>
            </div>
          </div>

          {/* Risk Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Probabilidade de Falha</span>
              <span className="font-semibold">{prediction.failureProbability}</span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  prediction.riskLevel === 'Critical'
                    ? 'bg-red-600'
                    : prediction.riskLevel === 'High'
                    ? 'bg-orange-600'
                    : prediction.riskLevel === 'Medium'
                    ? 'bg-yellow-600'
                    : 'bg-green-600'
                }`}
                style={{
                  width: prediction.failureProbability.replace('%', ''),
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
