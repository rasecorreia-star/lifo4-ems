/**
 * Solar Forecast Widget
 * Shows solar irradiance forecast and expected generation
 */

import { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudSun, Moon, TrendingUp, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface HourlyForecast {
  hour: string;
  irradiance: number; // W/m²
  cloudCover: number; // %
  expectedPower: number; // kW
  temperature: number; // °C
}

interface SolarForecastWidgetProps {
  systemCapacityKw?: number;
  className?: string;
}

// Generate mock forecast data based on time of day
const generateForecast = (capacityKw: number): HourlyForecast[] => {
  const now = new Date();
  const currentHour = now.getHours();
  const forecast: HourlyForecast[] = [];

  for (let i = 0; i < 24; i++) {
    const hour = (currentHour + i) % 24;
    const isSunUp = hour >= 6 && hour <= 18;
    const peakHour = hour >= 10 && hour <= 14;

    // Simulate solar curve
    let irradiance = 0;
    if (isSunUp) {
      const solarAngle = Math.sin(((hour - 6) / 12) * Math.PI);
      irradiance = solarAngle * (800 + Math.random() * 200);
    }

    // Random cloud cover
    const cloudCover = Math.random() * 50 + (peakHour ? 10 : 30);

    // Adjust for clouds
    const effectiveIrradiance = irradiance * (1 - cloudCover / 100 * 0.7);

    // Expected power (simplified calculation)
    const efficiency = 0.18; // 18% panel efficiency
    const systemArea = capacityKw / 0.2; // Approximate panel area
    const expectedPower = (effectiveIrradiance * systemArea * efficiency) / 1000;

    forecast.push({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      irradiance: Math.round(effectiveIrradiance),
      cloudCover: Math.round(cloudCover),
      expectedPower: Math.max(0, Math.min(capacityKw, expectedPower)),
      temperature: 25 + Math.random() * 10 + (isSunUp ? 5 : -5),
    });
  }

  return forecast;
};

const getWeatherIcon = (cloudCover: number, hour: number) => {
  const isNight = hour < 6 || hour > 18;

  if (isNight) return Moon;
  if (cloudCover > 70) return CloudRain;
  if (cloudCover > 40) return Cloud;
  if (cloudCover > 20) return CloudSun;
  return Sun;
};

export default function SolarForecastWidget({
  systemCapacityKw = 20,
  className
}: SolarForecastWidgetProps) {
  const [forecast, setForecast] = useState<HourlyForecast[]>([]);
  const [selectedHour, setSelectedHour] = useState<number>(0);

  useEffect(() => {
    setForecast(generateForecast(systemCapacityKw));

    // Update every 30 minutes
    const interval = setInterval(() => {
      setForecast(generateForecast(systemCapacityKw));
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [systemCapacityKw]);

  if (forecast.length === 0) return null;

  const currentForecast = forecast[selectedHour];
  const totalExpectedEnergy = forecast.reduce((sum, h) => sum + h.expectedPower, 0);
  const peakPower = Math.max(...forecast.map(h => h.expectedPower));
  const WeatherIcon = getWeatherIcon(currentForecast.cloudCover, parseInt(currentForecast.hour));

  return (
    <div className={cn('bg-surface rounded-xl border border-border p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sun className="w-5 h-5 text-yellow-400" />
          Previsao Solar (24h)
        </h3>
        <div className="text-sm text-foreground-muted">
          Capacidade: {systemCapacityKw} kWp
        </div>
      </div>

      {/* Current/Selected Hour Info */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
          <WeatherIcon className="w-8 h-8 mx-auto text-yellow-400 mb-1" />
          <div className="text-xs text-foreground-muted">{currentForecast.hour}</div>
          <div className="text-sm font-medium text-foreground">
            {currentForecast.cloudCover.toFixed(0)}% nuvens
          </div>
        </div>
        <div className="text-center p-3 bg-orange-500/10 rounded-lg">
          <div className="text-2xl font-bold text-orange-400">
            {currentForecast.irradiance}
          </div>
          <div className="text-xs text-foreground-muted">W/m² irradiancia</div>
        </div>
        <div className="text-center p-3 bg-green-500/10 rounded-lg">
          <div className="text-2xl font-bold text-green-400">
            {currentForecast.expectedPower.toFixed(1)}
          </div>
          <div className="text-xs text-foreground-muted">kW esperado</div>
        </div>
        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">
            {currentForecast.temperature.toFixed(0)}°C
          </div>
          <div className="text-xs text-foreground-muted">temperatura</div>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={forecast}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined) {
                setSelectedHour(e.activeTooltipIndex);
              }
            }}
          >
            <defs>
              <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              interval={3}
            />
            <YAxis
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              unit=" kW"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              labelStyle={{ color: '#F9FAFB' }}
              formatter={(value: number) => [`${value.toFixed(1)} kW`, 'Potencia']}
            />
            <Area
              type="monotone"
              dataKey="expectedPower"
              stroke="#F59E0B"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#solarGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-400">
            <Zap className="w-4 h-4" />
            <span className="text-lg font-bold">{totalExpectedEnergy.toFixed(0)} kWh</span>
          </div>
          <div className="text-xs text-foreground-muted">Energia prevista</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-lg font-bold">{peakPower.toFixed(1)} kW</span>
          </div>
          <div className="text-xs text-foreground-muted">Pico esperado</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-400">
            {((totalExpectedEnergy / (systemCapacityKw * 24)) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-foreground-muted">Fator capacidade</div>
        </div>
      </div>
    </div>
  );
}
