/**
 * Optimization Panel Component
 * Controls and displays AI-driven energy optimization
 */

import React, { useState, useEffect } from 'react';
import { Brain, Play, Square, TrendingUp, Clock, Zap, DollarSign, Leaf } from 'lucide-react';

interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
}

interface DispatchInterval {
  startTime: string;
  endTime: string;
  action: 'charge' | 'discharge' | 'idle' | 'grid_support';
  targetPower: number;
  reason: string;
  priority: number;
}

interface DispatchSchedule {
  id: string;
  systemId: string;
  generatedAt: string;
  validUntil: string;
  intervals: DispatchInterval[];
  expectedSavings: number;
  expectedRevenue: number;
  confidence: number;
}

interface OptimizationPanelProps {
  systemId: string;
  schedule: DispatchSchedule | null;
  isActive: boolean;
  onStart: (strategy: string, config: any) => void;
  onStop: () => void;
  className?: string;
}

const strategies: OptimizationStrategy[] = [
  { id: 'arbitrage', name: 'Energy Arbitrage', description: 'Compra barato, vende caro' },
  { id: 'peak_shaving', name: 'Peak Shaving', description: 'Reduz picos de demanda' },
  { id: 'value_stacking', name: 'Value Stacking', description: 'Maximiza multiplas receitas' },
  { id: 'load_leveling', name: 'Load Leveling', description: 'Suaviza variações de carga' },
  { id: 'frequency_response', name: 'Freq Response', description: 'Resposta a frequência da rede' },
  { id: 'self_consumption', name: 'Self-Consumption', description: 'Maximiza uso do solar' },
];

export const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  systemId,
  schedule,
  isActive,
  onStart,
  onStop,
  className = '',
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState('value_stacking');
  const [config, setConfig] = useState({
    minSoc: 20,
    maxSoc: 95,
    reserveCapacity: 10,
    maxChargeRate: 0.5,
    maxDischargeRate: 0.5,
    forecastHorizon: 24,
  });

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'charge': return 'text-green-400 bg-green-400/10';
      case 'discharge': return 'text-orange-400 bg-orange-400/10';
      case 'grid_support': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'charge': return 'Carregar';
      case 'discharge': return 'Descarregar';
      case 'grid_support': return 'Suporte Grid';
      default: return 'Standby';
    }
  };

  // Current interval
  const now = Date.now();
  const currentInterval = schedule?.intervals.find(i => {
    const start = new Date(i.startTime).getTime();
    const end = new Date(i.endTime).getTime();
    return now >= start && now < end;
  });

  return (
    <div className={`bg-gray-900 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-green-500/20' : 'bg-gray-800'}`}>
            <Brain className={`w-6 h-6 ${isActive ? 'text-green-400' : 'text-gray-500'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Otimização AI</h3>
            <span className={`text-xs ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
              {isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        {isActive ? (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
          >
            <Square className="w-4 h-4" />
            Parar
          </button>
        ) : (
          <button
            onClick={() => onStart(selectedStrategy, config)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
          >
            <Play className="w-4 h-4" />
            Iniciar
          </button>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Strategy Selection */}
        {!isActive && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Estratégia</label>
            <div className="grid grid-cols-2 gap-2">
              {strategies.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => setSelectedStrategy(strategy.id)}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    selectedStrategy === strategy.id
                      ? 'bg-blue-600/20 border-2 border-blue-500'
                      : 'bg-gray-800 border-2 border-transparent hover:border-gray-700'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{strategy.name}</div>
                  <div className="text-xs text-gray-500">{strategy.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Configuration */}
        {!isActive && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">SOC Mínimo</label>
              <input
                type="number"
                value={config.minSoc}
                onChange={(e) => setConfig({ ...config, minSoc: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                min={0}
                max={50}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">SOC Máximo</label>
              <input
                type="number"
                value={config.maxSoc}
                onChange={(e) => setConfig({ ...config, maxSoc: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                min={50}
                max={100}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Reserva (%)</label>
              <input
                type="number"
                value={config.reserveCapacity}
                onChange={(e) => setConfig({ ...config, reserveCapacity: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                min={0}
                max={50}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Horizonte (h)</label>
              <input
                type="number"
                value={config.forecastHorizon}
                onChange={(e) => setConfig({ ...config, forecastHorizon: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                min={1}
                max={48}
              />
            </div>
          </div>
        )}

        {/* Current Action */}
        {isActive && currentInterval && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-white">Ação Atual</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getActionColor(currentInterval.action)}`}>
              <span className="font-medium">{getActionLabel(currentInterval.action)}</span>
              {currentInterval.targetPower !== 0 && (
                <span className="text-sm">
                  {Math.abs(currentInterval.targetPower).toFixed(1)} kW
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-2">{currentInterval.reason}</p>
          </div>
        )}

        {/* Schedule Preview */}
        {schedule && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-white">Próximas {schedule.intervals.length} Horas</span>
              </div>
              <span className="text-xs text-gray-500">
                Confiança: {(schedule.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {schedule.intervals.slice(0, 12).map((interval, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded ${
                    currentInterval === interval ? 'bg-blue-600/20 border border-blue-500' : 'bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16">
                      {formatTime(interval.startTime)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getActionColor(interval.action)}`}>
                      {getActionLabel(interval.action)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {Math.abs(interval.targetPower).toFixed(1)} kW
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expected Results */}
        {schedule && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-400">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Economia Esperada</span>
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {formatCurrency(schedule.expectedSavings)}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Receita Esperada</span>
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {formatCurrency(schedule.expectedRevenue)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizationPanel;
