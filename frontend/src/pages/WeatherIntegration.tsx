import { useState, useMemo } from 'react';
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle,
  CloudLightning,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { cn } from '@/lib/utils';

interface WeatherData {
  hour: string;
  temperature: number;
  humidity: number;
  cloudCover: number;
  windSpeed: number;
  irradiance: number;
  solarForecast: number;
  actualSolar?: number;
  condition: 'sunny' | 'cloudy' | 'partly_cloudy' | 'rainy' | 'stormy';
}

interface DailyForecast {
  date: string;
  dayName: string;
  tempMin: number;
  tempMax: number;
  condition: 'sunny' | 'cloudy' | 'partly_cloudy' | 'rainy' | 'stormy';
  solarProduction: number;
  confidence: number;
}

interface WeatherAlert {
  id: string;
  type: 'storm' | 'heat' | 'wind' | 'rain';
  severity: 'low' | 'medium' | 'high';
  message: string;
  validUntil: string;
}

// Mock data generators
const generateHourlyForecast = (): WeatherData[] => {
  const hours: WeatherData[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  for (let i = 0; i < 24; i++) {
    const hour = `${i.toString().padStart(2, '0')}:00`;
    const isDaytime = i >= 6 && i <= 18;
    const midday = Math.abs(i - 12);

    // Simulate weather conditions
    const baseCloud = 20 + Math.random() * 30;
    const cloudCover = Math.min(100, baseCloud + (isDaytime ? -10 : 20));
    const temperature = 28 + (isDaytime ? 8 - midday * 0.5 : -5) + Math.random() * 3;
    const humidity = 60 + (isDaytime ? -15 : 10) + Math.random() * 10;
    const windSpeed = 5 + Math.random() * 10;

    // Solar irradiance based on time and cloud cover
    let irradiance = 0;
    if (isDaytime) {
      const solarAngle = Math.sin((i - 6) * Math.PI / 12);
      irradiance = solarAngle * 1000 * (1 - cloudCover / 150);
    }

    // Solar production forecast
    const solarForecast = irradiance * 0.15 * 10; // kW for 10kWp system

    let condition: WeatherData['condition'] = 'sunny';
    if (cloudCover > 70) condition = 'cloudy';
    else if (cloudCover > 40) condition = 'partly_cloudy';
    if (humidity > 85 && cloudCover > 60) condition = 'rainy';

    hours.push({
      hour,
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity),
      cloudCover: Math.round(cloudCover),
      windSpeed: Math.round(windSpeed * 10) / 10,
      irradiance: Math.round(irradiance),
      solarForecast: Math.round(solarForecast * 10) / 10,
      actualSolar: i <= currentHour ? Math.round((solarForecast + (Math.random() - 0.5) * 2) * 10) / 10 : undefined,
      condition,
    });
  }
  return hours;
};

const generateWeeklyForecast = (): DailyForecast[] => {
  const days: DailyForecast[] = [];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();

    const baseTemp = 32 + Math.random() * 4;
    const conditions: DailyForecast['condition'][] = ['sunny', 'partly_cloudy', 'cloudy', 'partly_cloudy', 'sunny', 'partly_cloudy', 'rainy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    let solarMultiplier = 1;
    if (condition === 'cloudy') solarMultiplier = 0.5;
    else if (condition === 'partly_cloudy') solarMultiplier = 0.75;
    else if (condition === 'rainy') solarMultiplier = 0.3;

    days.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      dayName: dayNames[dayOfWeek],
      tempMin: Math.round(baseTemp - 8 + Math.random() * 2),
      tempMax: Math.round(baseTemp + Math.random() * 2),
      condition,
      solarProduction: Math.round(45 * solarMultiplier + Math.random() * 10),
      confidence: Math.round(95 - i * 5 - Math.random() * 5),
    });
  }
  return days;
};

const weatherAlerts: WeatherAlert[] = [
  {
    id: '1',
    type: 'heat',
    severity: 'medium',
    message: 'Onda de calor prevista para os proximos 3 dias. Temperaturas acima de 38C.',
    validUntil: '28/01/2026',
  },
];

const getWeatherIcon = (condition: string, size = 'w-6 h-6') => {
  switch (condition) {
    case 'sunny':
      return <Sun className={cn(size, 'text-warning-500')} />;
    case 'cloudy':
      return <Cloud className={cn(size, 'text-foreground-muted')} />;
    case 'partly_cloudy':
      return <CloudSun className={cn(size, 'text-warning-500')} />;
    case 'rainy':
      return <CloudRain className={cn(size, 'text-primary')} />;
    case 'stormy':
      return <CloudLightning className={cn(size, 'text-danger-500')} />;
    default:
      return <Sun className={cn(size, 'text-warning-500')} />;
  }
};

export default function WeatherIntegration() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hourlyForecast = useMemo(() => generateHourlyForecast(), []);
  const weeklyForecast = useMemo(() => generateWeeklyForecast(), []);

  // Calculate statistics
  const stats = useMemo(() => {
    const currentHour = new Date().getHours();
    const current = hourlyForecast[currentHour] || hourlyForecast[12];
    const totalForecast = hourlyForecast.reduce((sum, h) => sum + h.solarForecast, 0);
    const actualTotal = hourlyForecast
      .filter(h => h.actualSolar !== undefined)
      .reduce((sum, h) => sum + (h.actualSolar || 0), 0);
    const weeklyTotal = weeklyForecast.reduce((sum, d) => sum + d.solarProduction, 0);

    return {
      current,
      totalForecast: Math.round(totalForecast * 10) / 10,
      actualTotal: Math.round(actualTotal * 10) / 10,
      weeklyTotal,
      avgConfidence: Math.round(weeklyForecast.reduce((sum, d) => sum + d.confidence, 0) / weeklyForecast.length),
    };
  }, [hourlyForecast, weeklyForecast]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Previsao Meteorologica</h1>
          <p className="text-foreground-muted mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Teresina, PI - Atualizado ha 15 min
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Weather Alerts */}
      {weatherAlerts.length > 0 && (
        <div className="space-y-2">
          {weatherAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 p-4 rounded-xl border',
                alert.severity === 'high' && 'bg-danger-500/10 border-danger-500/30',
                alert.severity === 'medium' && 'bg-warning-500/10 border-warning-500/30',
                alert.severity === 'low' && 'bg-primary/10 border-primary/30'
              )}
            >
              <AlertTriangle className={cn(
                'w-5 h-5 mt-0.5',
                alert.severity === 'high' && 'text-danger-500',
                alert.severity === 'medium' && 'text-warning-500',
                alert.severity === 'low' && 'text-primary'
              )} />
              <div className="flex-1">
                <p className="font-medium text-foreground">{alert.message}</p>
                <p className="text-sm text-foreground-muted mt-1">
                  Valido ate: {alert.validUntil}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Conditions + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Weather */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Agora</h2>
          <div className="flex items-center gap-4 mb-6">
            {getWeatherIcon(stats.current.condition, 'w-16 h-16')}
            <div>
              <div className="text-4xl font-bold text-foreground">
                {stats.current.temperature}°C
              </div>
              <p className="text-foreground-muted capitalize">
                {stats.current.condition === 'sunny' && 'Ensolarado'}
                {stats.current.condition === 'cloudy' && 'Nublado'}
                {stats.current.condition === 'partly_cloudy' && 'Parcialmente nublado'}
                {stats.current.condition === 'rainy' && 'Chuvoso'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-foreground-muted">Umidade</p>
                <p className="font-medium text-foreground">{stats.current.humidity}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-foreground-muted" />
              <div>
                <p className="text-xs text-foreground-muted">Vento</p>
                <p className="font-medium text-foreground">{stats.current.windSpeed} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-foreground-muted" />
              <div>
                <p className="text-xs text-foreground-muted">Nuvens</p>
                <p className="font-medium text-foreground">{stats.current.cloudCover}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-warning-500" />
              <div>
                <p className="text-xs text-foreground-muted">Irradiancia</p>
                <p className="font-medium text-foreground">{stats.current.irradiance} W/m²</p>
              </div>
            </div>
          </div>
        </div>

        {/* Solar Production Summary */}
        <div className="bg-surface border border-border rounded-xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Producao Solar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-warning-500" />
                <span className="text-sm text-foreground-muted">Previsao Hoje</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.totalForecast} kWh</div>
              <div className="flex items-center gap-1 text-xs text-success-500 mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+12% vs ontem</span>
              </div>
            </div>

            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-success-500" />
                <span className="text-sm text-foreground-muted">Produzido Ate Agora</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.actualTotal} kWh</div>
              <div className="text-xs text-foreground-muted mt-1">
                {Math.round((stats.actualTotal / stats.totalForecast) * 100)}% da previsao
              </div>
            </div>

            <div className="bg-surface-hover rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground-muted">Previsao Semana</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.weeklyTotal} kWh</div>
              <div className="text-xs text-foreground-muted mt-1">
                Confianca: {stats.avgConfidence}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Forecast Chart */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Previsao Horaria</h2>
            <p className="text-sm text-foreground-muted">Producao solar vs irradiancia</p>
          </div>
          <Clock className="w-5 h-5 text-foreground-muted" />
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis yAxisId="solar" stroke="var(--foreground-muted)" fontSize={12} unit=" kW" />
              <YAxis yAxisId="irradiance" orientation="right" stroke="var(--foreground-muted)" fontSize={12} unit=" W/m²" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                yAxisId="irradiance"
                type="monotone"
                dataKey="irradiance"
                name="Irradiancia"
                fill="#eab308"
                fillOpacity={0.2}
                stroke="#eab308"
                strokeWidth={1}
              />
              <Line
                yAxisId="solar"
                type="monotone"
                dataKey="solarForecast"
                name="Previsao Solar"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
              <Line
                yAxisId="solar"
                type="monotone"
                dataKey="actualSolar"
                name="Producao Real"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weather Conditions Chart */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Condicoes Atmosfericas</h2>
            <p className="text-sm text-foreground-muted">Temperatura, umidade e cobertura de nuvens</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourlyForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis stroke="var(--foreground-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="temperature"
                name="Temperatura (°C)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                name="Umidade (%)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cloudCover"
                name="Nuvens (%)"
                stroke="#6b7280"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Previsao 7 Dias</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {weeklyForecast.map((day, index) => (
            <div
              key={day.date}
              className={cn(
                'flex flex-col items-center p-4 rounded-xl transition-colors',
                index === 0 ? 'bg-primary/10 border border-primary/30' : 'bg-surface-hover'
              )}
            >
              <p className="font-medium text-foreground">{day.dayName}</p>
              <p className="text-xs text-foreground-muted mb-2">{day.date}</p>
              {getWeatherIcon(day.condition, 'w-10 h-10')}
              <div className="flex items-center gap-2 mt-2 text-sm">
                <span className="text-danger-500 font-medium">{day.tempMax}°</span>
                <span className="text-foreground-muted">{day.tempMin}°</span>
              </div>
              <div className="mt-2 text-center">
                <p className="text-sm font-medium text-foreground">{day.solarProduction} kWh</p>
                <p className="text-xs text-foreground-muted">{day.confidence}% conf.</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Solar Production Forecast */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Producao Solar Semanal</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dayName" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kWh" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [
                  name === 'Confianca' ? `${value}%` : `${value} kWh`,
                  name
                ]}
              />
              <Legend />
              <Bar dataKey="solarProduction" name="Producao Solar" fill="#eab308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Optimization Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Sugestoes de Otimizacao</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-success-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Alta irradiancia hoje</p>
                <p className="text-sm text-foreground-muted">
                  Aproveite para carregar as baterias ao maximo entre 10:00-14:00
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-warning-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-warning-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Chuva prevista para quinta</p>
                <p className="text-sm text-foreground-muted">
                  Considere aumentar carga da bateria na quarta para compensar
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Semana favoravel</p>
                <p className="text-sm text-foreground-muted">
                  Previsao de 315 kWh de producao solar esta semana
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Historico de Acuracia</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted">Previsao 1 dia</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-success-500" style={{ width: '94%' }} />
                </div>
                <span className="text-sm font-medium text-foreground">94%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground-muted">Previsao 3 dias</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-success-500" style={{ width: '87%' }} />
                </div>
                <span className="text-sm font-medium text-foreground">87%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground-muted">Previsao 7 dias</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-warning-500" style={{ width: '72%' }} />
                </div>
                <span className="text-sm font-medium text-foreground">72%</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-foreground-muted">
                Baseado em dados historicos dos ultimos 90 dias.
                A acuracia considera a diferenca entre producao prevista e real.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
