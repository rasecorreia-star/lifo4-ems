/**
 * Grid Services Panel Component
 * Displays control mode, VPP state, and grid conditions
 */

import React, { useEffect } from 'react';
import { useCurrentControlMode, useVPPState } from '@/hooks';
import { Wifi, WifiOff, Zap } from 'lucide-react';

interface GridServicesPanelProps {
  systemId?: string;
}

const modeDescriptions: Record<string, string> = {
  grid_following: 'Segue voltagem e frequência da rede (modo padrão)',
  grid_forming: 'Cria própria referência de voltagem/frequência',
  islanding: 'Opera independente quando rede indisponível',
  black_start: 'Ajuda restaurar rede após blackout',
  synchronizing: 'Sincronizando com rede após islanding',
};

const modeColors: Record<string, string> = {
  grid_following: 'bg-blue-100 border-blue-300',
  grid_forming: 'bg-green-100 border-green-300',
  islanding: 'bg-orange-100 border-orange-300',
  black_start: 'bg-red-100 border-red-300',
  synchronizing: 'bg-yellow-100 border-yellow-300',
};

export function GridServicesPanel({ systemId }: GridServicesPanelProps) {
  const { data: modeData, isLoading: modeLoading } = useCurrentControlMode();
  const { data: vppData, isLoading: vppLoading } = useVPPState();

  const mode = modeData?.data.currentMode;
  const vpp = vppData?.data;

  if (modeLoading || vppLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-gray-100 rounded-lg animate-pulse h-24"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Mode */}
      {mode && (
        <div className={`p-6 rounded-lg border-2 ${modeColors[mode]}`}>
          <h3 className="font-bold text-lg mb-2">Modo de Controle Atual</h3>
          <div className="flex items-center gap-4 mb-4">
            {mode === 'grid_following' || mode === 'grid_forming' ? (
              <Wifi className="text-green-600" size={32} />
            ) : (
              <WifiOff className="text-orange-600" size={32} />
            )}
            <div>
              <p className="text-2xl font-bold capitalize">{mode.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-700">{modeDescriptions[mode]}</p>
            </div>
          </div>

          {modeData?.data.gridConditions && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-2 bg-white rounded">
                <p className="text-gray-600">Frequência</p>
                <p className="font-bold text-lg">
                  {modeData.data.gridConditions.frequency.toFixed(2)} Hz
                </p>
              </div>
              <div className="p-2 bg-white rounded">
                <p className="text-gray-600">Voltagem</p>
                <p className="font-bold text-lg">
                  {modeData.data.gridConditions.voltage.toFixed(0)} V
                </p>
              </div>
              <div className="p-2 bg-white rounded">
                <p className="text-gray-600">Conectado</p>
                <p className="font-bold text-lg">
                  {modeData.data.gridConditions.gridConnected ? '✅ Sim' : '❌ Não'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VPP State */}
      {vpp && (
        <div className="p-6 bg-purple-50 rounded-lg border-2 border-purple-300">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Zap className="text-purple-600" size={24} />
            Virtual Power Plant (VPP)
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-white rounded">
              <p className="text-sm text-gray-600">Participantes</p>
              <p className="text-2xl font-bold text-purple-600">{vpp.participantCount}</p>
            </div>
            <div className="p-3 bg-white rounded">
              <p className="text-sm text-gray-600">Capacidade Total</p>
              <p className="text-2xl font-bold text-purple-600">
                {vpp.aggregated.totalCapacity}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Capacidade Disponível</p>
              <p className="font-bold">{vpp.aggregated.availableCapacity}</p>
            </div>
            <div>
              <p className="text-gray-600">SOC Médio</p>
              <p className="font-bold">{vpp.aggregated.averageSOC}</p>
            </div>
            <div>
              <p className="text-gray-600">SOH Médio</p>
              <p className="font-bold">{vpp.aggregated.averageSOH}</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
            <p className="text-gray-600">Potência Despachada</p>
            <p className="text-xl font-bold text-purple-600">{vpp.aggregated.dispatchingPower}</p>
          </div>
        </div>
      )}

      {/* Grid Health */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-bold mb-3">Saúde da Rede</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Frequência</span>
            <span className={modeData?.data.gridConditions?.frequency ?
              (Math.abs(modeData.data.gridConditions.frequency - 60) < 0.5 ? 'text-green-600' : 'text-yellow-600') : ''
            }>
              ✓ Normal
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Voltagem</span>
            <span className={modeData?.data.gridConditions?.voltage ?
              (Math.abs(modeData.data.gridConditions.voltage - 380) < 30 ? 'text-green-600' : 'text-yellow-600') : ''
            }>
              ✓ Normal
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Estabilidade</span>
            <span className="text-green-600">✓ Estável</span>
          </div>
        </div>
      </div>
    </div>
  );
}
