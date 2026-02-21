/**
 * Tariff Widget
 * Shows electricity tariff information based on ANEEL time-of-use rates
 * Helps optimize BESS charging/discharging strategy
 */

import { useState, useEffect } from 'react';
import { DollarSign, Clock, TrendingDown, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

interface TariffPeriod {
  name: string;
  startHour: number;
  endHour: number;
  rate: number; // R$/kWh
  color: string;
  type: 'off_peak' | 'intermediate' | 'peak';
}

interface TariffWidgetProps {
  className?: string;
  tariffType?: 'branca' | 'convencional' | 'verde' | 'azul';
}

// ANEEL Tariff Structures (simplified for demonstration)
const TARIFF_STRUCTURES: Record<string, TariffPeriod[]> = {
  branca: [
    { name: 'Fora Ponta', startHour: 0, endHour: 17, rate: 0.45, color: '#10B981', type: 'off_peak' },
    { name: 'Intermediario', startHour: 17, endHour: 18, rate: 0.65, color: '#F59E0B', type: 'intermediate' },
    { name: 'Ponta', startHour: 18, endHour: 21, rate: 1.25, color: '#EF4444', type: 'peak' },
    { name: 'Intermediario', startHour: 21, endHour: 22, rate: 0.65, color: '#F59E0B', type: 'intermediate' },
    { name: 'Fora Ponta', startHour: 22, endHour: 24, rate: 0.45, color: '#10B981', type: 'off_peak' },
  ],
  convencional: [
    { name: 'Tarifa Unica', startHour: 0, endHour: 24, rate: 0.75, color: '#3B82F6', type: 'off_peak' },
  ],
  verde: [
    { name: 'Fora Ponta', startHour: 0, endHour: 18, rate: 0.38, color: '#10B981', type: 'off_peak' },
    { name: 'Ponta', startHour: 18, endHour: 21, rate: 1.85, color: '#EF4444', type: 'peak' },
    { name: 'Fora Ponta', startHour: 21, endHour: 24, rate: 0.38, color: '#10B981', type: 'off_peak' },
  ],
  azul: [
    { name: 'Fora Ponta', startHour: 0, endHour: 18, rate: 0.35, color: '#10B981', type: 'off_peak' },
    { name: 'Ponta', startHour: 18, endHour: 21, rate: 2.10, color: '#EF4444', type: 'peak' },
    { name: 'Fora Ponta', startHour: 21, endHour: 24, rate: 0.35, color: '#10B981', type: 'off_peak' },
  ],
};

const generateHourlyData = (periods: TariffPeriod[]) => {
  const hourlyData = [];

  for (let hour = 0; hour < 24; hour++) {
    const period = periods.find(p =>
      (p.startHour <= hour && hour < p.endHour) ||
      (p.startHour > p.endHour && (hour >= p.startHour || hour < p.endHour))
    );

    hourlyData.push({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      rate: period?.rate || 0,
      color: period?.color || '#6B7280',
      type: period?.type || 'off_peak',
      name: period?.name || '',
    });
  }

  return hourlyData;
};

export default function TariffWidget({
  className,
  tariffType = 'branca'
}: TariffWidgetProps) {
  const [selectedTariff, setSelectedTariff] = useState(tariffType);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const periods = TARIFF_STRUCTURES[selectedTariff];
  const hourlyData = generateHourlyData(periods);
  const currentRate = hourlyData[currentHour];

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Find next rate change
  const findNextChange = () => {
    for (let i = 1; i <= 24; i++) {
      const nextHour = (currentHour + i) % 24;
      if (hourlyData[nextHour].rate !== currentRate.rate) {
        return {
          hoursUntil: i,
          newRate: hourlyData[nextHour].rate,
          type: hourlyData[nextHour].type,
        };
      }
    }
    return null;
  };

  const nextChange = findNextChange();
  const minRate = Math.min(...hourlyData.map(h => h.rate));
  const maxRate = Math.max(...hourlyData.map(h => h.rate));
  const savings = ((maxRate - minRate) / maxRate) * 100;

  // Recommendation logic
  const getRecommendation = () => {
    if (currentRate.type === 'peak') {
      return {
        action: 'DESCARREGAR',
        message: 'Horario de ponta - descarregue o BESS para maximizar economia',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
      };
    } else if (currentRate.type === 'off_peak') {
      return {
        action: 'CARREGAR',
        message: 'Horario fora de ponta - carregue o BESS com energia mais barata',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
      };
    }
    return {
      action: 'STANDBY',
      message: 'Horario intermediario - aguarde melhor momento',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className={cn('bg-surface rounded-xl border border-border p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Tarifas de Energia
        </h3>
        <select
          value={selectedTariff}
          onChange={(e) => setSelectedTariff(e.target.value as typeof selectedTariff)}
          className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="branca">Tarifa Branca</option>
          <option value="convencional">Convencional</option>
          <option value="verde">Verde (A4)</option>
          <option value="azul">Azul (A4)</option>
        </select>
      </div>

      {/* Current Rate */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={cn('p-4 rounded-lg', recommendation.bgColor)}>
          <div className="text-xs text-foreground-muted mb-1">Tarifa Atual</div>
          <div className={cn('text-3xl font-bold', recommendation.color)}>
            R$ {currentRate.rate.toFixed(2)}
          </div>
          <div className="text-sm text-foreground-muted">/kWh - {currentRate.name}</div>
        </div>

        <div className="p-4 bg-surface-hover rounded-lg">
          <div className="text-xs text-foreground-muted mb-1">Proxima Mudanca</div>
          {nextChange ? (
            <>
              <div className="text-2xl font-bold text-foreground">
                {nextChange.hoursUntil}h
              </div>
              <div className="text-sm text-foreground-muted">
                → R$ {nextChange.newRate.toFixed(2)}
              </div>
            </>
          ) : (
            <div className="text-sm text-foreground-muted">Sem mudanca</div>
          )}
        </div>

        <div className="p-4 bg-surface-hover rounded-lg">
          <div className="text-xs text-foreground-muted mb-1">Economia Potencial</div>
          <div className="text-2xl font-bold text-green-400">
            {savings.toFixed(0)}%
          </div>
          <div className="text-sm text-foreground-muted">pico vs fora ponta</div>
        </div>
      </div>

      {/* Recommendation */}
      <div className={cn('p-4 rounded-lg mb-6 flex items-center gap-3', recommendation.bgColor)}>
        <div className={cn('p-2 rounded-full', recommendation.bgColor)}>
          {recommendation.action === 'DESCARREGAR' ? (
            <TrendingUp className={cn('w-6 h-6', recommendation.color)} />
          ) : recommendation.action === 'CARREGAR' ? (
            <TrendingDown className={cn('w-6 h-6', recommendation.color)} />
          ) : (
            <Clock className={cn('w-6 h-6', recommendation.color)} />
          )}
        </div>
        <div>
          <div className={cn('font-bold', recommendation.color)}>
            Recomendacao: {recommendation.action}
          </div>
          <div className="text-sm text-foreground-muted">{recommendation.message}</div>
        </div>
      </div>

      {/* Tariff Chart */}
      <div className="h-40 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourlyData}>
            <XAxis
              dataKey="hour"
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF', fontSize: 9 }}
              interval={2}
            />
            <YAxis
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              tickFormatter={(v) => `R$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#F9FAFB' }}
              formatter={(value: number) => [`R$ ${value.toFixed(2)}/kWh`]}
            />
            <ReferenceLine
              x={`${currentHour.toString().padStart(2, '0')}:00`}
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ value: 'Agora', fill: '#8B5CF6', fontSize: 10 }}
            />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
              {hourlyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-foreground-muted">Fora Ponta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-xs text-foreground-muted">Intermediario</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-foreground-muted">Ponta</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <AlertCircle className="w-3 h-3 text-foreground-muted" />
          <span className="text-xs text-foreground-muted">Valores ilustrativos - consulte sua fatura</span>
        </div>
      </div>
    </div>
  );
}
