import { useState, useMemo } from 'react';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Activity,
  Zap,
  Battery,
  Thermometer,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Minus,
  Globe,
  Building,
  MapPin,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from 'recharts';
import { cn } from '@/lib/utils';

interface BenchmarkMetric {
  name: string;
  yourValue: number;
  industryAvg: number;
  topPerformer: number;
  unit: string;
  higherIsBetter: boolean;
}

interface PerformanceRanking {
  category: string;
  rank: number;
  total: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
}

interface HistoricalComparison {
  month: string;
  yourSystem: number;
  industryAvg: number;
  topQuartile: number;
}

const benchmarkMetrics: BenchmarkMetric[] = [
  { name: 'Eficiencia Round-Trip', yourValue: 94.2, industryAvg: 91.5, topPerformer: 96.0, unit: '%', higherIsBetter: true },
  { name: 'Disponibilidade', yourValue: 99.2, industryAvg: 97.5, topPerformer: 99.8, unit: '%', higherIsBetter: true },
  { name: 'Degradacao Anual', yourValue: 1.8, industryAvg: 2.5, topPerformer: 1.2, unit: '%', higherIsBetter: false },
  { name: 'Tempo de Resposta', yourValue: 45, industryAvg: 120, topPerformer: 30, unit: 'ms', higherIsBetter: false },
  { name: 'Custo por Ciclo', yourValue: 0.82, industryAvg: 1.15, topPerformer: 0.65, unit: 'R$/kWh', higherIsBetter: false },
  { name: 'Fator de Capacidade', yourValue: 28, industryAvg: 22, topPerformer: 35, unit: '%', higherIsBetter: true },
  { name: 'MTBF', yourValue: 8500, industryAvg: 6000, topPerformer: 12000, unit: 'horas', higherIsBetter: true },
  { name: 'Autoconsumo Solar', yourValue: 85, industryAvg: 72, topPerformer: 92, unit: '%', higherIsBetter: true },
];

const performanceRankings: PerformanceRanking[] = [
  { category: 'Eficiencia Geral', rank: 12, total: 150, percentile: 92, trend: 'up' },
  { category: 'Confiabilidade', rank: 8, total: 150, percentile: 95, trend: 'stable' },
  { category: 'Custo-Beneficio', rank: 18, total: 150, percentile: 88, trend: 'up' },
  { category: 'Sustentabilidade', rank: 5, total: 150, percentile: 97, trend: 'up' },
  { category: 'Resposta de Rede', rank: 25, total: 150, percentile: 83, trend: 'down' },
];

const radarData = [
  { metric: 'Eficiencia', yours: 94, industry: 85, top: 100 },
  { metric: 'Disponibilidade', yours: 99, industry: 90, top: 100 },
  { metric: 'Confiabilidade', yours: 92, industry: 82, top: 100 },
  { metric: 'Custo', yours: 88, industry: 75, top: 100 },
  { metric: 'Sustentabilidade', yours: 95, industry: 78, top: 100 },
  { metric: 'Resposta', yours: 85, industry: 70, top: 100 },
];

const generateHistoricalComparison = (): HistoricalComparison[] => {
  const months = ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan'];
  let yourBase = 88;
  return months.map((month) => {
    yourBase += (Math.random() - 0.3) * 2;
    return {
      month,
      yourSystem: Math.round(yourBase * 10) / 10,
      industryAvg: 85 + Math.random() * 3,
      topQuartile: 93 + Math.random() * 2,
    };
  });
};

const regionalComparison = [
  { region: 'Seu Sistema', efficiency: 94.2, availability: 99.2, cost: 0.82 },
  { region: 'Nordeste', efficiency: 91.8, availability: 97.5, cost: 0.95 },
  { region: 'Sudeste', efficiency: 92.5, availability: 98.2, cost: 0.88 },
  { region: 'Sul', efficiency: 93.1, availability: 98.5, cost: 0.85 },
  { region: 'Brasil', efficiency: 91.5, availability: 97.8, cost: 0.92 },
  { region: 'Global', efficiency: 90.2, availability: 96.5, cost: 1.05 },
];

export default function Benchmarking() {
  const [selectedMetric, setSelectedMetric] = useState('efficiency');
  const historicalData = useMemo(() => generateHistoricalComparison(), []);

  // Calculate overall score
  const overallScore = useMemo(() => {
    let totalScore = 0;
    benchmarkMetrics.forEach(metric => {
      const range = metric.topPerformer - metric.industryAvg;
      const yourPosition = metric.higherIsBetter
        ? (metric.yourValue - metric.industryAvg) / range
        : (metric.industryAvg - metric.yourValue) / range;
      totalScore += Math.min(100, Math.max(0, 50 + yourPosition * 50));
    });
    return Math.round(totalScore / benchmarkMetrics.length);
  }, []);

  const getComparisonIcon = (yours: number, industry: number, higherIsBetter: boolean) => {
    const isAbove = higherIsBetter ? yours > industry : yours < industry;
    const diff = Math.abs(((yours - industry) / industry) * 100);

    if (isAbove && diff > 5) return <ChevronUp className="w-4 h-4 text-success-500" />;
    if (!isAbove && diff > 5) return <ChevronDown className="w-4 h-4 text-danger-500" />;
    return <Minus className="w-4 h-4 text-foreground-muted" />;
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return 'text-success-500';
    if (percentile >= 75) return 'text-primary';
    if (percentile >= 50) return 'text-warning-500';
    return 'text-danger-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-7 h-7 text-warning-500" />
            Benchmarking de Performance
          </h1>
          <p className="text-foreground-muted mt-1">
            Compare seu sistema com padroes da industria
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground">
            <option>BESS-001 - Teresina Centro</option>
            <option>BESS-002 - Picos Industrial</option>
            <option>Todos os Sistemas</option>
          </select>
        </div>
      </div>

      {/* Overall Score Card */}
      <div className="bg-gradient-to-r from-warning-500/20 to-primary/20 border border-warning-500/30 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke={overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#eab308' : '#ef4444'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallScore / 100) * 352} 352`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{overallScore}</span>
                <span className="text-xs text-foreground-muted">de 100</span>
              </div>
            </div>
            <p className="mt-2 font-medium text-foreground">Score Geral</p>
          </div>

          <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <Target className="w-6 h-6 text-success-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">Top 8%</p>
              <p className="text-xs text-foreground-muted">Ranking Global</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-success-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">+12%</p>
              <p className="text-xs text-foreground-muted">vs Media Industria</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <Award className="w-6 h-6 text-warning-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">5</p>
              <p className="text-xs text-foreground-muted">Metricas Top 10%</p>
            </div>
            <div className="text-center p-3 bg-surface/50 rounded-lg">
              <Activity className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">150</p>
              <p className="text-xs text-foreground-muted">Sistemas Comparados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {performanceRankings.map((ranking) => (
          <div key={ranking.category} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground-muted truncate">{ranking.category}</span>
              {ranking.trend === 'up' && <TrendingUp className="w-4 h-4 text-success-500" />}
              {ranking.trend === 'down' && <TrendingDown className="w-4 h-4 text-danger-500" />}
              {ranking.trend === 'stable' && <Minus className="w-4 h-4 text-foreground-muted" />}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">#{ranking.rank}</span>
              <span className="text-xs text-foreground-muted">/{ranking.total}</span>
            </div>
            <div className="mt-2">
              <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    ranking.percentile >= 90 ? 'bg-success-500' :
                    ranking.percentile >= 75 ? 'bg-primary' :
                    ranking.percentile >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                  )}
                  style={{ width: `${ranking.percentile}%` }}
                />
              </div>
              <p className={cn('text-xs mt-1 font-medium', getPercentileColor(ranking.percentile))}>
                Percentil {ranking.percentile}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Comparativo Multi-dimensional</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
                <Radar name="Seu Sistema" dataKey="yours" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} strokeWidth={2} />
                <Radar name="Media Industria" dataKey="industry" stroke="#6b7280" fill="#6b7280" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical Trend */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Evolucao vs Industria</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                <YAxis domain={[80, 100]} stroke="var(--foreground-muted)" fontSize={12} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="topQuartile"
                  name="Top 25%"
                  fill="#22c55e"
                  fillOpacity={0.1}
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotone"
                  dataKey="industryAvg"
                  name="Media Industria"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="yourSystem"
                  name="Seu Sistema"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Metricas Detalhadas</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Metrica</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Seu Sistema</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Media Industria</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Top Performer</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">vs Industria</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkMetrics.map((metric) => {
                const isAboveAvg = metric.higherIsBetter
                  ? metric.yourValue > metric.industryAvg
                  : metric.yourValue < metric.industryAvg;
                const diff = ((metric.yourValue - metric.industryAvg) / metric.industryAvg * 100);

                return (
                  <tr key={metric.name} className="border-b border-border hover:bg-surface-hover">
                    <td className="py-3 px-4 font-medium text-foreground">{metric.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-foreground">
                        {metric.yourValue} {metric.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-foreground-muted">
                      {metric.industryAvg} {metric.unit}
                    </td>
                    <td className="py-3 px-4 text-center text-success-500 font-medium">
                      {metric.topPerformer} {metric.unit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        'inline-flex items-center gap-1 font-medium',
                        isAboveAvg ? 'text-success-500' : 'text-danger-500'
                      )}>
                        {getComparisonIcon(metric.yourValue, metric.industryAvg, metric.higherIsBetter)}
                        {Math.abs(diff).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isAboveAvg ? (
                        <CheckCircle className="w-5 h-5 text-success-500 mx-auto" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-warning-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional Comparison */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Comparativo Regional</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionalComparison} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[85, 100]} stroke="var(--foreground-muted)" fontSize={12} unit="%" />
              <YAxis type="category" dataKey="region" stroke="var(--foreground-muted)" fontSize={12} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="efficiency" name="Eficiencia" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="availability" name="Disponibilidade" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Improvement Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Pontos Fortes</h3>
              <p className="text-sm text-success-500">5 metricas acima da media</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-foreground-muted">
              <CheckCircle className="w-4 h-4 text-success-500" />
              Eficiencia Round-Trip excepcional
            </li>
            <li className="flex items-center gap-2 text-foreground-muted">
              <CheckCircle className="w-4 h-4 text-success-500" />
              Alta disponibilidade do sistema
            </li>
            <li className="flex items-center gap-2 text-foreground-muted">
              <CheckCircle className="w-4 h-4 text-success-500" />
              Baixa degradacao anual
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Areas de Melhoria</h3>
              <p className="text-sm text-warning-500">Oportunidades identificadas</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-foreground-muted">
              <AlertTriangle className="w-4 h-4 text-warning-500" />
              Tempo de resposta pode ser otimizado
            </li>
            <li className="flex items-center gap-2 text-foreground-muted">
              <AlertTriangle className="w-4 h-4 text-warning-500" />
              Fator de capacidade abaixo do potencial
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Proximas Metas</h3>
              <p className="text-sm text-primary">Para Top 5%</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-foreground-muted">
              <Target className="w-4 h-4 text-primary" />
              Aumentar eficiencia para 95%+
            </li>
            <li className="flex items-center gap-2 text-foreground-muted">
              <Target className="w-4 h-4 text-primary" />
              Reduzir tempo de resposta para 35ms
            </li>
            <li className="flex items-center gap-2 text-foreground-muted">
              <Target className="w-4 h-4 text-primary" />
              Elevar fator de capacidade para 32%
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
