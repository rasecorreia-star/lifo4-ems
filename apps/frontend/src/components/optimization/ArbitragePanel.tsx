/**
 * Arbitrage Trading Panel Component
 * Shows arbitrage opportunities and trading signals
 */

import React, { useMemo } from 'react';
import { useArbitrageEvaluate, useMarketSignal } from '@/hooks';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ArbitragePanelProps {
  telemetry: any;
  marketData: any;
  historicalPrices: { low: number; high: number };
}

export function ArbitragePanel({
  telemetry,
  marketData,
  historicalPrices,
}: ArbitragePanelProps) {
  const { mutate: evaluate, data, isPending } = useArbitrageEvaluate();
  const { data: signalData } = useMarketSignal(
    marketData.spotPrice,
    historicalPrices.low,
    historicalPrices.high
  );

  React.useEffect(() => {
    evaluate({
      telemetry,
      marketData,
      historicalPrices,
      batteryCapacity: 500,
    });
  }, [telemetry, marketData, historicalPrices]);

  const opportunity = data?.data.opportunity;
  const signal = signalData?.data;

  const priceMargin =
    ((marketData.spotPrice - historicalPrices.low) /
      (historicalPrices.high - historicalPrices.low)) *
    100;

  return (
    <div className="space-y-4">
      {/* Market Signal */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h3 className="font-bold text-blue-900 mb-3">Sinal de Mercado</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-600">Preço Atual</p>
            <p className="text-lg font-bold text-blue-600">
              R$ {marketData.spotPrice.toFixed(0)}/MWh
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Posição</p>
            <p className="text-lg font-bold">
              {priceMargin < 25
                ? '🔴 Baixa'
                : priceMargin < 75
                ? '🟡 Média'
                : '🟢 Alta'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Força</p>
            <p className="text-lg font-bold">
              {signal?.signal.toFixed(2) || '...'}
            </p>
          </div>
        </div>
      </div>

      {/* Opportunity Status */}
      {isPending ? (
        <div className="p-4 bg-gray-100 rounded-lg animate-pulse h-32"></div>
      ) : opportunity ? (
        <div
          className={`p-4 rounded-lg border-2 ${
            opportunity.buyPrice
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">
              {opportunity.buyPrice
                ? '💰 BUY SIGNAL - Comprar'
                : '💸 SELL SIGNAL - Vender'}
            </h3>
            {opportunity.buyPrice ? (
              <TrendingDown className="text-green-600" />
            ) : (
              <TrendingUp className="text-red-600" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Preço de {opportunity.buyPrice ? 'Compra' : 'Venda'}</p>
              <p className="text-lg font-bold">
                R$ {(opportunity.buyPrice || opportunity.sellPrice).toFixed(0)}/MWh
              </p>
            </div>
            <div>
              <p className="text-gray-600">Preço Esperado</p>
              <p className="text-lg font-bold">
                R$ {opportunity.sellPrice.toFixed(0)}/MWh
              </p>
            </div>
            <div>
              <p className="text-gray-600">Energia Necessária</p>
              <p className="text-lg font-bold">{opportunity.requiredEnergy.toFixed(1)} kWh</p>
            </div>
            <div>
              <p className="text-gray-600">Lucro Esperado</p>
              <p className="text-lg font-bold text-green-600">
                R$ {opportunity.expectedProfit.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Confiança</span>
              <span>{(opportunity.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${opportunity.confidence * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
          Nenhuma oportunidade de arbitragem no momento
        </div>
      )}

      {/* Price Range */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-xs font-semibold text-gray-600 mb-2">RANGE HISTÓRICO</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Mínimo</p>
            <p className="text-lg font-bold">R$ {historicalPrices.low.toFixed(0)}</p>
          </div>
          <div className="flex-1 mx-4">
            <div className="w-full bg-gradient-to-r from-red-200 to-green-200 rounded-full h-3 relative">
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-1 h-5 bg-blue-600 rounded"
                style={{
                  left: `${priceMargin}%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-center text-gray-600 mt-1">{priceMargin.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Máximo</p>
            <p className="text-lg font-bold">R$ {historicalPrices.high.toFixed(0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
