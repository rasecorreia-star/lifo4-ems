/**
 * Forecast Chart Component
 * Displays demand, price, and solar forecasts with multiple ML models
 */

import React, { useEffect } from 'react';
import { useEnsembleForecast } from '@/hooks';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader } from 'lucide-react';

interface ForecastChartProps {
  solarCapacity?: number;
  horizonHours?: number;
  height?: number;
}

export function ForecastChart({
  solarCapacity = 100,
  horizonHours = 24,
  height = 400,
}: ForecastChartProps) {
  const currentHour = new Date().getHours();
  const { data, isLoading } = useEnsembleForecast({
    currentHour,
    solarCapacity,
    horizonHours,
  });

  const chartData = data?.data.forecasts.map((forecast: any) => ({
    time: new Date(forecast.timestamp).getHours().toString().padStart(2, '0') + ':00',
    demand: Math.round(forecast.demandForecast),
    price: Math.round(forecast.priceForecast),
    solar: Math.round(forecast.solarForecast),
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-lg mb-2">Previsão de Demanda (kW)</h3>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="demand"
              stroke="#3b82f6"
              name="Demanda (kW)"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="font-bold text-lg mb-2">Previsão de Preço (R$/MWh)</h3>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="price"
              stroke="#ef4444"
              name="Preço (R$/MWh)"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="font-bold text-lg mb-2">Geração Solar (kW)</h3>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="solar"
              stroke="#fbbf24"
              name="Solar (kW)"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold mb-2">Resumo da Previsão</h4>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Demanda Média</p>
              <p className="text-lg font-bold">{data.data.summary.averageDemand}</p>
            </div>
            <div>
              <p className="text-gray-600">Preço Médio</p>
              <p className="text-lg font-bold">{data.data.summary.averagePrice}</p>
            </div>
            <div>
              <p className="text-gray-600">Pico de Demanda</p>
              <p className="text-lg font-bold">{data.data.summary.peakDemand}</p>
            </div>
            <div>
              <p className="text-gray-600">Modelo</p>
              <p className="text-lg font-bold">{data.data.modelName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
