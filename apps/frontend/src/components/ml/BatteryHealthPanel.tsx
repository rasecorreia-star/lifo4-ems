/**
 * Battery Health Panel Component
 * Displays SOH, degradation, RUL, and warranty status
 */

import React, { useEffect } from 'react';
import { useHealthReport, useWarrantyStatus } from '@/hooks';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface BatteryHealthPanelProps {
  systemId: string;
  nominalCapacity: number;
  currentCapacity: number;
  cycleCount: number;
  maxCycles: number;
  operatingHoursPerDay: number;
  averageTemperature: number;
}

export function BatteryHealthPanel({
  systemId,
  nominalCapacity,
  currentCapacity,
  cycleCount,
  maxCycles,
  operatingHoursPerDay,
  averageTemperature,
}: BatteryHealthPanelProps) {
  const { mutate: generateReport, data: reportData, isPending } = useHealthReport();
  const { data: warrantyData } = useWarrantyStatus(systemId, (currentCapacity / nominalCapacity) * 100);

  useEffect(() => {
    generateReport({
      systemId,
      nominalCapacity,
      currentCapacity,
      cycleCount,
      maxCycles,
      operatingHoursPerDay,
      averageTemperature,
    });
  }, [systemId, nominalCapacity, currentCapacity, cycleCount]);

  const report = reportData?.data;
  const soh = report?.soh || ((currentCapacity / nominalCapacity) * 100).toFixed(1);
  const warranty = warrantyData?.data;

  const getHealthColor = (soh: number) => {
    if (soh > 90) return 'text-green-600';
    if (soh > 80) return 'text-blue-600';
    if (soh > 70) return 'text-yellow-600';
    if (soh > 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthBgColor = (soh: number) => {
    if (soh > 90) return 'bg-green-50';
    if (soh > 80) return 'bg-blue-50';
    if (soh > 70) return 'bg-yellow-50';
    if (soh > 50) return 'bg-orange-50';
    return 'bg-red-50';
  };

  return (
    <div className="space-y-4">
      {/* Main SOH Gauge */}
      <div className={`p-6 rounded-lg border-2 ${getHealthBgColor(parseFloat(String(soh)))}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Estado de Saúde (SOH)</h3>
          <span className={`text-4xl font-bold ${getHealthColor(parseFloat(String(soh)))}`}>
            {soh}%
          </span>
        </div>

        {/* SOH Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-300 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                parseFloat(String(soh)) > 90
                  ? 'bg-green-600'
                  : parseFloat(String(soh)) > 80
                  ? 'bg-blue-600'
                  : parseFloat(String(soh)) > 70
                  ? 'bg-yellow-600'
                  : parseFloat(String(soh)) > 50
                  ? 'bg-orange-600'
                  : 'bg-red-600'
              }`}
              style={{ width: `${soh}%` }}
            ></div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {parseFloat(String(soh)) > 80 ? (
            <>
              <CheckCircle className="text-green-600" size={20} />
              <span className="text-green-700 font-semibold">Excelente condição</span>
            </>
          ) : parseFloat(String(soh)) > 70 ? (
            <>
              <AlertTriangle className="text-yellow-600" size={20} />
              <span className="text-yellow-700 font-semibold">Monitorar</span>
            </>
          ) : (
            <>
              <AlertCircle className="text-red-600" size={20} />
              <span className="text-red-700 font-semibold">Ação necessária</span>
            </>
          )}
        </div>
      </div>

      {/* Degradation Info */}
      {report && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-bold mb-3">Degradação</h4>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Calendário</p>
              <p className="text-lg font-bold">
                {report.degradation.estimatedCalendarDegradation.toFixed(3)}%
              </p>
            </div>
            <div>
              <p className="text-gray-600">Por Ciclagem</p>
              <p className="text-lg font-bold">
                {report.degradation.estimatedCyclicDegradation.toFixed(3)}%
              </p>
            </div>
            <div>
              <p className="text-gray-600">Taxa/Mês</p>
              <p className="text-lg font-bold">
                {report.degradation.percentPerMonth.toFixed(3)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RUL Info */}
      {report && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-bold mb-3">Vida Útil Restante (RUL)</h4>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Meses</p>
              <p className="text-lg font-bold">{report.lifeRemaining.estimatedMonths.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-gray-600">Ciclos</p>
              <p className="text-lg font-bold">{report.lifeRemaining.estimatedCycles}</p>
            </div>
            <div>
              <p className="text-gray-600">Confiança</p>
              <p className="text-lg font-bold">
                {(report.lifeRemaining.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Utilization */}
      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
        <h4 className="font-bold mb-3">Utilização de Ciclos</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Ciclos Usados</span>
              <span className="font-semibold">{((cycleCount / maxCycles) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-3">
              <div
                className="bg-orange-600 h-3 rounded-full"
                style={{ width: `${(cycleCount / maxCycles) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {cycleCount} / {maxCycles} ciclos
            </p>
          </div>
        </div>
      </div>

      {/* Warranty */}
      {warranty && (
        <div
          className={`p-4 rounded-lg border-2 ${
            warranty.status === 'active'
              ? 'bg-green-50 border-green-300'
              : warranty.status === 'expiring_soon'
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <h4 className="font-bold mb-2">Garantia</h4>
          <p className="text-sm text-gray-700 mb-2">
            Status: <span className="font-semibold">{warranty.statusDescription}</span>
          </p>
          <p className="text-sm text-gray-700">
            Fim da Garantia: <span className="font-semibold">{warranty.warrantyEndDate}</span>
          </p>
        </div>
      )}
    </div>
  );
}
