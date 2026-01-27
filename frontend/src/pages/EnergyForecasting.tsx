import { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Clock,
  Zap,
  Battery,
  Sun,
  Cloud,
  RefreshCw,
  Download,
  Settings,
  AlertTriangle,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Target,
  BarChart3,
  Activity,
  Cpu,
  Brain,
} from 'lucide-react';

interface ForecastPoint {
  timestamp: string;
  predicted: number;
  actual?: number;
  lower: number;
  upper: number;
  confidence: number;
}

interface ForecastModel {
  id: string;
  name: string;
  type: string;
  accuracy: number;
  mape: number;
  rmse: number;
  lastTrained: string;
  status: 'active' | 'training' | 'outdated';
}

export default function EnergyForecasting() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [forecastHorizon, setForecastHorizon] = useState(7);
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [activeTab, setActiveTab] = useState<'demand' | 'generation' | 'price' | 'models'>('demand');

  const models = useMemo<ForecastModel[]>(() => [
    {
      id: 'ensemble',
      name: 'Ensemble Model',
      type: 'Hybrid ML',
      accuracy: 94.5,
      mape: 3.2,
      rmse: 45.8,
      lastTrained: '2025-01-24',
      status: 'active',
    },
    {
      id: 'lstm',
      name: 'LSTM Neural Network',
      type: 'Deep Learning',
      accuracy: 92.8,
      mape: 4.1,
      rmse: 52.3,
      lastTrained: '2025-01-23',
      status: 'active',
    },
    {
      id: 'prophet',
      name: 'Prophet Forecaster',
      type: 'Statistical',
      accuracy: 91.2,
      mape: 4.8,
      rmse: 58.1,
      lastTrained: '2025-01-22',
      status: 'active',
    },
    {
      id: 'xgboost',
      name: 'XGBoost Regressor',
      type: 'Gradient Boosting',
      accuracy: 93.1,
      mape: 3.9,
      rmse: 49.6,
      lastTrained: '2025-01-24',
      status: 'active',
    },
    {
      id: 'arima',
      name: 'ARIMA Model',
      type: 'Time Series',
      accuracy: 88.5,
      mape: 6.2,
      rmse: 68.4,
      lastTrained: '2025-01-20',
      status: 'outdated',
    },
  ], []);

  const demandForecast = useMemo<ForecastPoint[]>(() => {
    const points: ForecastPoint[] = [];
    const now = new Date();

    for (let i = 0; i < forecastHorizon * 24; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() + i);

      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Simulate demand pattern
      let baseDemand = 500; // kW
      if (hour >= 6 && hour <= 10) baseDemand = 800; // Morning peak
      if (hour >= 17 && hour <= 21) baseDemand = 900; // Evening peak
      if (hour >= 0 && hour <= 5) baseDemand = 300; // Night low
      if (isWeekend) baseDemand *= 0.7;

      const noise = (Math.random() - 0.5) * 100;
      const predicted = baseDemand + noise;
      const uncertainty = 50 + Math.random() * 30;

      points.push({
        timestamp: date.toISOString(),
        predicted: Math.round(predicted),
        actual: i < 12 ? Math.round(predicted + (Math.random() - 0.5) * 80) : undefined,
        lower: Math.round(predicted - uncertainty),
        upper: Math.round(predicted + uncertainty),
        confidence: 95 - (i / (forecastHorizon * 24)) * 20,
      });
    }

    return points;
  }, [forecastHorizon]);

  const solarForecast = useMemo<ForecastPoint[]>(() => {
    const points: ForecastPoint[] = [];
    const now = new Date();

    for (let i = 0; i < forecastHorizon * 24; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() + i);

      const hour = date.getHours();

      // Simulate solar generation pattern
      let solarGen = 0;
      if (hour >= 6 && hour <= 18) {
        const peakHour = 12;
        const distance = Math.abs(hour - peakHour);
        solarGen = 200 * Math.cos((distance / 6) * (Math.PI / 2));
        solarGen *= 0.7 + Math.random() * 0.3; // Weather variation
      }

      const uncertainty = solarGen * 0.15;

      points.push({
        timestamp: date.toISOString(),
        predicted: Math.round(solarGen),
        actual: i < 12 ? Math.round(solarGen * (0.9 + Math.random() * 0.2)) : undefined,
        lower: Math.round(Math.max(0, solarGen - uncertainty)),
        upper: Math.round(solarGen + uncertainty),
        confidence: 95 - (i / (forecastHorizon * 24)) * 25,
      });
    }

    return points;
  }, [forecastHorizon]);

  const priceForecast = useMemo(() => {
    const points: ForecastPoint[] = [];
    const now = new Date();

    for (let i = 0; i < forecastHorizon * 24; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() + i);

      const hour = date.getHours();

      // Simulate price pattern (R$/MWh)
      let basePrice = 250;
      if (hour >= 18 && hour <= 21) basePrice = 450; // Peak tariff
      if (hour >= 0 && hour <= 5) basePrice = 150; // Off-peak

      const noise = (Math.random() - 0.5) * 50;
      const predicted = basePrice + noise;
      const uncertainty = 30 + Math.random() * 20;

      points.push({
        timestamp: date.toISOString(),
        predicted: Math.round(predicted),
        actual: i < 12 ? Math.round(predicted + (Math.random() - 0.5) * 40) : undefined,
        lower: Math.round(predicted - uncertainty),
        upper: Math.round(predicted + uncertainty),
        confidence: 90 - (i / (forecastHorizon * 24)) * 25,
      });
    }

    return points;
  }, [forecastHorizon]);

  const insights = useMemo(() => [
    {
      type: 'peak' as const,
      title: 'Pico de Demanda Previsto',
      description: 'Demanda maxima de 950 kW esperada hoje as 19:00',
      icon: TrendingUp,
      color: 'warning',
    },
    {
      type: 'opportunity' as const,
      title: 'Oportunidade de Arbitragem',
      description: 'Diferenca de R$ 300/MWh entre vale e pico amanha',
      icon: Target,
      color: 'success',
    },
    {
      type: 'weather' as const,
      title: 'Impacto Meteorologico',
      description: 'Nebulosidade prevista pode reduzir geracao solar em 30%',
      icon: Cloud,
      color: 'info',
    },
    {
      type: 'alert' as const,
      title: 'Alerta de Confiabilidade',
      description: 'Incerteza aumenta apos 5 dias - considerar atualizacao',
      icon: AlertTriangle,
      color: 'warning',
    },
  ], []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success-500 bg-success-500/20';
      case 'training': return 'text-warning-500 bg-warning-500/20';
      case 'outdated': return 'text-danger-500 bg-danger-500/20';
      default: return 'text-foreground-muted bg-surface-hover';
    }
  };

  const getInsightColor = (color: string) => {
    switch (color) {
      case 'success': return 'bg-success-500/20 text-success-500';
      case 'warning': return 'bg-warning-500/20 text-warning-500';
      case 'danger': return 'bg-danger-500/20 text-danger-500';
      case 'info': return 'bg-primary/20 text-primary';
      default: return 'bg-surface-hover text-foreground-muted';
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const currentForecast = activeTab === 'demand' ? demandForecast :
                          activeTab === 'generation' ? solarForecast :
                          priceForecast;

  const aggregatedData = useMemo(() => {
    if (selectedTimeframe === 'hourly') return currentForecast.slice(0, 24);

    const groups: { [key: string]: ForecastPoint[] } = {};

    currentForecast.forEach((point) => {
      const date = new Date(point.timestamp);
      let key: string;

      if (selectedTimeframe === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (selectedTimeframe === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(point);
    });

    return Object.entries(groups).map(([key, points]) => ({
      timestamp: key,
      predicted: Math.round(points.reduce((s, p) => s + p.predicted, 0) / points.length),
      actual: points.some(p => p.actual !== undefined)
        ? Math.round(points.filter(p => p.actual !== undefined).reduce((s, p) => s + p.actual!, 0) / points.filter(p => p.actual !== undefined).length)
        : undefined,
      lower: Math.round(points.reduce((s, p) => s + p.lower, 0) / points.length),
      upper: Math.round(points.reduce((s, p) => s + p.upper, 0) / points.length),
      confidence: points.reduce((s, p) => s + p.confidence, 0) / points.length,
    }));
  }, [currentForecast, selectedTimeframe]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Previsao de Energia</h1>
            <p className="text-foreground-muted">Previsoes de demanda, geracao e precos com ML</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {tf === 'hourly' ? 'Horario' : tf === 'daily' ? 'Diario' : tf === 'weekly' ? 'Semanal' : 'Mensal'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">Horizonte:</span>
          <select
            value={forecastHorizon}
            onChange={(e) => setForecastHorizon(Number(e.target.value))}
            className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value={1}>1 dia</option>
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">Modelo:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {models.filter((m) => m.status === 'active').map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.accuracy}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {[
          { id: 'demand', label: 'Demanda', icon: Zap },
          { id: 'generation', label: 'Geracao Solar', icon: Sun },
          { id: 'price', label: 'Precos', icon: Activity },
          { id: 'models', label: 'Modelos', icon: Cpu },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-primary'
                : 'text-foreground-muted border-transparent hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'models' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Forecast Chart Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-xs text-foreground-muted">Media Prevista</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {Math.round(aggregatedData.reduce((s, p) => s + p.predicted, 0) / aggregatedData.length)}
                  <span className="text-sm font-normal text-foreground-muted ml-1">
                    {activeTab === 'price' ? 'R$/MWh' : 'kW'}
                  </span>
                </p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="w-4 h-4 text-warning-500" />
                  <span className="text-xs text-foreground-muted">Pico Previsto</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {Math.max(...aggregatedData.map((p) => p.predicted))}
                  <span className="text-sm font-normal text-foreground-muted ml-1">
                    {activeTab === 'price' ? 'R$/MWh' : 'kW'}
                  </span>
                </p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="w-4 h-4 text-success-500" />
                  <span className="text-xs text-foreground-muted">Vale Previsto</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {Math.min(...aggregatedData.map((p) => p.predicted))}
                  <span className="text-sm font-normal text-foreground-muted ml-1">
                    {activeTab === 'price' ? 'R$/MWh' : 'kW'}
                  </span>
                </p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs text-foreground-muted">Confianca Media</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {Math.round(aggregatedData.reduce((s, p) => s + p.confidence, 0) / aggregatedData.length)}%
                </p>
              </div>
            </div>

            {/* Forecast Table */}
            <div className="bg-surface border border-border rounded-xl">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Dados da Previsao</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Periodo</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Previsto</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Atual</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Intervalo</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Confianca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedData.slice(0, 10).map((point, index) => (
                      <tr key={index} className="border-b border-border hover:bg-surface-hover">
                        <td className="py-3 px-4 text-sm text-foreground">
                          {selectedTimeframe === 'hourly' ? formatDate(point.timestamp) : point.timestamp}
                        </td>
                        <td className="text-right py-3 px-4 text-sm font-medium text-foreground">
                          {point.predicted} {activeTab === 'price' ? 'R$/MWh' : 'kW'}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-foreground">
                          {point.actual !== undefined ? (
                            <span className={point.actual > point.predicted ? 'text-warning-500' : 'text-success-500'}>
                              {point.actual} {activeTab === 'price' ? 'R$/MWh' : 'kW'}
                            </span>
                          ) : (
                            <span className="text-foreground-muted">-</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-foreground-muted">
                          {point.lower} - {point.upper}
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  point.confidence >= 90 ? 'bg-success-500' :
                                  point.confidence >= 75 ? 'bg-warning-500' : 'bg-danger-500'
                                }`}
                                style={{ width: `${point.confidence}%` }}
                              />
                            </div>
                            <span className="text-sm text-foreground-muted">{Math.round(point.confidence)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Insights Panel */}
          <div className="space-y-6">
            {/* Insights */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="font-semibold text-foreground mb-4">Insights</h3>
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-surface-hover rounded-lg"
                  >
                    <div className={`w-8 h-8 rounded-lg ${getInsightColor(insight.color)} flex items-center justify-center flex-shrink-0`}>
                      <insight.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{insight.title}</p>
                      <p className="text-xs text-foreground-muted">{insight.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Model Performance */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="font-semibold text-foreground mb-4">Performance do Modelo</h3>

              {models.filter((m) => m.id === selectedModel).map((model) => (
                <div key={model.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Modelo</span>
                    <span className="text-sm font-medium text-foreground">{model.name}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Tipo</span>
                    <span className="text-sm text-foreground">{model.type}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Precisao</span>
                    <span className="text-sm font-medium text-success-500">{model.accuracy}%</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">MAPE</span>
                    <span className="text-sm text-foreground">{model.mape}%</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">RMSE</span>
                    <span className="text-sm text-foreground">{model.rmse}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Ultimo Treino</span>
                    <span className="text-sm text-foreground">{model.lastTrained}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Weather Impact */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="font-semibold text-foreground mb-4">Impacto Meteorologico</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-warning-500" />
                    <span className="text-sm text-foreground-muted">Irradiancia</span>
                  </div>
                  <span className="text-sm text-foreground">85% do normal</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-foreground-muted" />
                    <span className="text-sm text-foreground-muted">Cobertura</span>
                  </div>
                  <span className="text-sm text-foreground">30%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground-muted">Temperatura</span>
                  </div>
                  <span className="text-sm text-foreground">32°C</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Models Tab */
        <div className="space-y-4">
          {models.map((model) => (
            <div
              key={model.id}
              className="bg-surface border border-border rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{model.name}</h3>
                    <p className="text-sm text-foreground-muted">{model.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(model.status)}`}>
                    {model.status === 'active' ? 'Ativo' : model.status === 'training' ? 'Treinando' : 'Desatualizado'}
                  </span>
                  <button className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors text-sm">
                    Retreinar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-foreground-muted">Precisao</p>
                  <p className="text-lg font-bold text-success-500">{model.accuracy}%</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">MAPE</p>
                  <p className="text-lg font-bold text-foreground">{model.mape}%</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">RMSE</p>
                  <p className="text-lg font-bold text-foreground">{model.rmse}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Ultimo Treino</p>
                  <p className="text-lg font-bold text-foreground">{model.lastTrained}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      model.status === 'active' ? 'bg-success-500' :
                      model.status === 'training' ? 'bg-warning-500' : 'bg-danger-500'
                    }`} />
                    <span className="text-sm text-foreground">
                      {model.status === 'active' ? 'Operacional' :
                       model.status === 'training' ? 'Em treino' : 'Requer atualizacao'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Training Configuration */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Configuracao de Treinamento</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-foreground-muted mb-2">Dados Historicos</label>
                <select className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground">
                  <option>Ultimos 30 dias</option>
                  <option>Ultimos 90 dias</option>
                  <option>Ultimos 180 dias</option>
                  <option>Ultimo ano</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-foreground-muted mb-2">Frequencia de Retreino</label>
                <select className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground">
                  <option>Diario</option>
                  <option>Semanal</option>
                  <option>Mensal</option>
                  <option>Manual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-foreground-muted mb-2">Validacao</label>
                <select className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground">
                  <option>Cross-validation 5-fold</option>
                  <option>Hold-out 20%</option>
                  <option>Time series split</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors">
                Salvar Configuracao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
