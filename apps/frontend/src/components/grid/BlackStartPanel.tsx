/**
 * Black Start Panel Component
 * Controls and monitors black start / island mode capability
 */

import React from 'react';
import { Power, Wifi, WifiOff, AlertTriangle, CheckCircle, RefreshCw, Zap, Clock, Battery } from 'lucide-react';

export enum BlackStartState {
  STANDBY = 'standby',
  GRID_LOSS_DETECTED = 'grid_loss',
  ISLANDING = 'islanding',
  ISLAND_MODE = 'island_mode',
  GRID_SYNC = 'grid_sync',
  RECONNECTING = 'reconnecting',
  RESTORED = 'restored',
}

interface GridStatus {
  isAvailable: boolean;
  voltage: number;
  frequency: number;
  quality: 'good' | 'degraded' | 'poor' | 'lost';
}

interface IslandStatus {
  systemId: string;
  state: BlackStartState;
  duration: number;
  currentLoad: number;
  availablePower: number;
  remainingEnergy: number;
  estimatedRuntime: number;
  activeLoads: string[];
  shedLoads: string[];
  gridStatus: GridStatus;
}

interface BlackStartPanelProps {
  status: IslandStatus | null;
  onTriggerBlackStart: () => void;
  onTriggerReconnect: () => void;
  className?: string;
}

export const BlackStartPanel: React.FC<BlackStartPanelProps> = ({
  status,
  onTriggerBlackStart,
  onTriggerReconnect,
  className = '',
}) => {
  const getStateInfo = (state: BlackStartState) => {
    switch (state) {
      case BlackStartState.STANDBY:
        return { label: 'Standby', color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle };
      case BlackStartState.GRID_LOSS_DETECTED:
        return { label: 'Perda de Rede Detectada', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: AlertTriangle };
      case BlackStartState.ISLANDING:
        return { label: 'Iniciando Modo Ilha', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: RefreshCw };
      case BlackStartState.ISLAND_MODE:
        return { label: 'Modo Ilha Ativo', color: 'text-orange-400', bg: 'bg-orange-400/10', icon: WifiOff };
      case BlackStartState.GRID_SYNC:
        return { label: 'Sincronizando com Rede', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: RefreshCw };
      case BlackStartState.RECONNECTING:
        return { label: 'Reconectando', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: RefreshCw };
      case BlackStartState.RESTORED:
        return { label: 'Rede Restaurada', color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle };
      default:
        return { label: 'Desconhecido', color: 'text-gray-400', bg: 'bg-gray-400/10', icon: AlertTriangle };
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m ${(seconds % 60).toFixed(0)}s`;
    return `${(seconds / 3600).toFixed(0)}h ${((seconds % 3600) / 60).toFixed(0)}m`;
  };

  const getGridQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'poor': return 'text-orange-400';
      case 'lost': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (!status) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="text-center text-gray-400">
          <Power className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Black Start não configurado</p>
        </div>
      </div>
    );
  }

  const stateInfo = getStateInfo(status.state);
  const StateIcon = stateInfo.icon;
  const isIslandMode = status.state === BlackStartState.ISLAND_MODE;
  const canReconnect = isIslandMode && status.gridStatus.isAvailable;

  return (
    <div className={`bg-gray-900 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stateInfo.bg}`}>
              <StateIcon className={`w-6 h-6 ${stateInfo.color} ${
                status.state === BlackStartState.ISLANDING ||
                status.state === BlackStartState.GRID_SYNC ||
                status.state === BlackStartState.RECONNECTING
                  ? 'animate-spin'
                  : ''
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Black Start</h3>
              <span className={`text-sm ${stateInfo.color}`}>{stateInfo.label}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {status.state === BlackStartState.STANDBY && (
              <button
                onClick={onTriggerBlackStart}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors text-sm"
              >
                <Power className="w-4 h-4" />
                Teste
              </button>
            )}
            {canReconnect && (
              <button
                onClick={onTriggerReconnect}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors text-sm"
              >
                <Wifi className="w-4 h-4" />
                Reconectar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Grid Status */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Status da Rede</span>
            {status.gridStatus.isAvailable ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">Tensão</div>
              <div className="text-lg font-semibold text-white">
                {status.gridStatus.voltage.toFixed(0)}V
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Frequência</div>
              <div className="text-lg font-semibold text-white">
                {status.gridStatus.frequency.toFixed(2)}Hz
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Qualidade</div>
              <div className={`text-lg font-semibold capitalize ${getGridQualityColor(status.gridStatus.quality)}`}>
                {status.gridStatus.quality === 'good' ? 'Boa' :
                 status.gridStatus.quality === 'degraded' ? 'Degradada' :
                 status.gridStatus.quality === 'poor' ? 'Ruim' : 'Perdida'}
              </div>
            </div>
          </div>
        </div>

        {/* Island Mode Stats */}
        {isIslandMode && (
          <>
            {/* Duration and Runtime */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Tempo em Ilha</span>
                </div>
                <div className="text-2xl font-bold text-orange-400">
                  {formatDuration(status.duration)}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Battery className="w-4 h-4" />
                  <span className="text-sm">Autonomia</span>
                </div>
                <div className={`text-2xl font-bold ${
                  status.estimatedRuntime > 60 ? 'text-green-400' :
                  status.estimatedRuntime > 30 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {formatDuration(status.estimatedRuntime * 60)}
                </div>
              </div>
            </div>

            {/* Power Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Carga Atual</div>
                <div className="text-xl font-bold text-purple-400">
                  {status.currentLoad.toFixed(1)} kW
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Potência Disp.</div>
                <div className="text-xl font-bold text-blue-400">
                  {status.availablePower.toFixed(1)} kW
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Energia Disp.</div>
                <div className="text-xl font-bold text-green-400">
                  {status.remainingEnergy.toFixed(1)} kWh
                </div>
              </div>
            </div>

            {/* Load Status */}
            <div className="space-y-3">
              {/* Active Loads */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">
                    Cargas Ativas ({status.activeLoads.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {status.activeLoads.map((load, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-green-400/10 text-green-400 rounded text-xs"
                    >
                      {load}
                    </span>
                  ))}
                  {status.activeLoads.length === 0 && (
                    <span className="text-xs text-gray-500">Nenhuma carga ativa</span>
                  )}
                </div>
              </div>

              {/* Shed Loads */}
              {status.shedLoads.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-400">
                      Cargas Desligadas ({status.shedLoads.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status.shedLoads.map((load, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-red-400/10 text-red-400 rounded text-xs"
                      >
                        {load}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Standby Info */}
        {status.state === BlackStartState.STANDBY && (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-400">
              Sistema pronto para black start automático
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Detecção de perda de rede em &lt;100ms
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlackStartPanel;
