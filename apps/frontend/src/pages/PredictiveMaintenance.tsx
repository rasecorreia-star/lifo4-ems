import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMaintenance } from '@/hooks/useMaintenance';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Wrench,
  Battery,
  Thermometer,
  Zap,
  Activity,
  Target,
  RefreshCw,
  Download,
  ChevronRight,
  AlertCircle,
  Info,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { cn } from '@/lib/utils';

interface PredictionItem {
  id: string;
  component: string;
  issue: string;
  probability: number;
  timeToFailure: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  estimatedCost: number;
  lastUpdated: string;
}

interface HealthScore {
  category: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  fullMark: number;
}

interface MaintenanceHistory {
  date: string;
  predicted: number;
  actual: number;
  prevented: number;
}

const predictions: PredictionItem[] = [
  {
    id: '1',
    component: 'Modulo de Celulas #3',
    issue: 'Degradacao acelerada detectada',
    probability: 78,
    timeToFailure: '45-60 dias',
    impact: 'high',
    recommendedAction: 'Inspecao visual e teste de capacidade',
    estimatedCost: 500,
    lastUpdated: '2h atras',
  },
  {
    id: '2',
    component: 'Ventilador Refrigeracao',
    issue: 'Ruido anomalo - possivel desgaste de rolamento',
    probability: 65,
    timeToFailure: '30-45 dias',
    impact: 'medium',
    recommendedAction: 'Substituicao preventiva do ventilador',
    estimatedCost: 250,
    lastUpdated: '4h atras',
  },
  {
    id: '3',
    component: 'Contator Principal',
    issue: 'Aumento na resistencia de contato',
    probability: 45,
    timeToFailure: '90-120 dias',
    impact: 'high',
    recommendedAction: 'Limpeza de contatos ou substituicao',
    estimatedCost: 800,
    lastUpdated: '1d atras',
  },
  {
    id: '4',
    component: 'Sensor de Temperatura #7',
    issue: 'Deriva nas leituras detectada',
    probability: 82,
    timeToFailure: '15-20 dias',
    impact: 'medium',
    recommendedAction: 'Calibracao ou substituicao do sensor',
    estimatedCost: 150,
    lastUpdated: '6h atras',
  },
  {
    id: '5',
    component: 'Capacitor DC Link',
    issue: 'ESR aumentando gradualmente',
    probability: 35,
    timeToFailure: '180+ dias',
    impact: 'low',
    recommendedAction: 'Monitorar evolucao',
    estimatedCost: 1200,
    lastUpdated: '2d atras',
  },
];

const healthScores: HealthScore[] = [
  { category: 'Celulas', score: 92, trend: 'stable', fullMark: 100 },
  { category: 'BMS', score: 98, trend: 'up', fullMark: 100 },
  { category: 'Inversor', score: 95, trend: 'stable', fullMark: 100 },
  { category: 'Refrigeracao', score: 78, trend: 'down', fullMark: 100 },
  { category: 'Contatores', score: 88, trend: 'down', fullMark: 100 },
  { category: 'Sensores', score: 85, trend: 'stable', fullMark: 100 },
];

const maintenanceHistoryData: MaintenanceHistory[] = [
  { date: 'Jul', predicted: 3, actual: 1, prevented: 2 },
  { date: 'Ago', predicted: 2, actual: 0, prevented: 2 },
  { date: 'Set', predicted: 4, actual: 1, prevented: 3 },
  { date: 'Out', predicted: 3, actual: 2, prevented: 1 },
  { date: 'Nov', predicted: 2, actual: 0, prevented: 2 },
  { date: 'Dez', predicted: 4, actual: 1, prevented: 3 },
  { date: 'Jan', predicted: 3, actual: 1, prevented: 2 },
];

export default function PredictiveMaintenance() {
  const { systemId } = useParams<{ systemId: string }>();
  const currentSystemId = systemId || 'BESS-001';

  const { data: maintenanceData, isLoading, isError } = useMaintenance(currentSystemId);

  const [selectedSystem, setSelectedSystem] = useState(currentSystemId);
  const maintenanceHistory = useMemo(() => maintenanceData?.history || maintenanceHistoryData, [maintenanceData?.history]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">Carregando análise preditiva...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger-500">Erro ao carregar análise preditiva</div>
      </div>
    );
  }

  // Calculate stats
  const stats = useMemo(() => {
    const highPriority = predictions.filter(p => p.impact === 'high' || p.impact === 'critical').length;
    const avgProbability = predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length;
    const totalCost = predictions.reduce((sum, p) => sum + p.estimatedCost, 0);
    const avgHealth = healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length;
    const totalPrevented = maintenanceHistory.reduce((sum: number, m: MaintenanceHistory) => sum + m.prevented, 0);

    return {
      highPriority,
      avgProbability: Math.round(avgProbability),
      totalCost,
      avgHealth: Math.round(avgHealth),
      totalPredictions: predictions.length,
      totalPrevented,
      savingsEstimate: totalPrevented * 2500, // Estimated savings per prevented failure
    };
  }, [maintenanceHistory]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'bg-danger-500/20 text-danger-500 border-danger-500/30';
      case 'high':
        return 'bg-warning-500/20 text-warning-500 border-warning-500/30';
      case 'medium':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'low':
        return 'bg-success-500/20 text-success-500 border-success-500/30';
      default:
        return 'bg-foreground-muted/20 text-foreground-muted border-foreground-muted/30';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-danger-500';
    if (probability >= 50) return 'text-warning-500';
    if (probability >= 30) return 'text-primary';
    return 'text-success-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            Manutencao Preditiva
          </h1>
          <p className="text-foreground-muted mt-1">
            Analise baseada em IA para prevencao de falhas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
          >
            <option value="BESS-001">BESS-001 - Teresina Centro</option>
            <option value="BESS-002">BESS-002 - Picos Industrial</option>
            <option value="BESS-003">BESS-003 - Parnaiba Solar</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Atualizar Analise
          </button>
        </div>
      </div>

      {/* AI Analysis Banner */}
      <div className="bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Analise de IA Atualizada</h2>
            <p className="text-foreground-muted mt-1">
              Ultima analise: ha 2 horas | Proxima analise programada: em 4 horas
            </p>
            <p className="text-sm text-primary mt-2">
              Modelo: LSTM + Random Forest | Precisao historica: 94.2%
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground">{stats.avgHealth}%</div>
            <p className="text-sm text-foreground-muted">Saude Geral</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Predicoes Ativas</span>
            <AlertTriangle className="w-5 h-5 text-warning-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalPredictions}</div>
          <div className="text-xs text-danger-500 mt-1">
            {stats.highPriority} de alta prioridade
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Prob. Media</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.avgProbability}%</div>
          <div className="text-xs text-foreground-muted mt-1">
            de falha nos proximos 90 dias
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Custo Estimado</span>
            <Wrench className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {stats.totalCost.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            manutencao preventiva
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Economia Estimada</span>
            <CheckCircle className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-success-500">
            R$ {stats.savingsEstimate.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            {stats.totalPrevented} falhas evitadas
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Radar */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Saude por Componente</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={healthScores}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
                <Radar
                  name="Saude"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {healthScores.map((item) => (
              <div key={item.category} className="flex items-center gap-2 text-sm">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  item.score >= 90 ? 'bg-success-500' :
                  item.score >= 70 ? 'bg-warning-500' : 'bg-danger-500'
                )} />
                <span className="text-foreground-muted">{item.category}</span>
                <span className={cn(
                  'ml-auto font-medium',
                  item.trend === 'up' ? 'text-success-500' :
                  item.trend === 'down' ? 'text-danger-500' : 'text-foreground'
                )}>
                  {item.score}%
                  {item.trend === 'up' && <TrendingUp className="w-3 h-3 inline ml-1" />}
                  {item.trend === 'down' && <TrendingDown className="w-3 h-3 inline ml-1" />}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance History */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Historico de Manutencao</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={12} />
                <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="predicted" name="Previstas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Corretivas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="prevented" name="Evitadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Predicoes de Falha</h2>
          <button className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Download className="w-4 h-4" />
            Exportar Relatorio
          </button>
        </div>
        <div className="space-y-4">
          {predictions.sort((a, b) => b.probability - a.probability).map((prediction) => (
            <div
              key={prediction.id}
              className="flex items-start gap-4 p-4 bg-surface-hover rounded-xl hover:bg-surface-hover/80 transition-colors cursor-pointer"
            >
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                prediction.impact === 'critical' || prediction.impact === 'high'
                  ? 'bg-danger-500/20'
                  : prediction.impact === 'medium'
                  ? 'bg-warning-500/20'
                  : 'bg-success-500/20'
              )}>
                {prediction.impact === 'critical' || prediction.impact === 'high' ? (
                  <AlertCircle className="w-6 h-6 text-danger-500" />
                ) : prediction.impact === 'medium' ? (
                  <AlertTriangle className="w-6 h-6 text-warning-500" />
                ) : (
                  <Info className="w-6 h-6 text-success-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground">{prediction.component}</h3>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium border',
                    getImpactColor(prediction.impact)
                  )}>
                    {prediction.impact === 'critical' ? 'Critico' :
                     prediction.impact === 'high' ? 'Alto' :
                     prediction.impact === 'medium' ? 'Medio' : 'Baixo'}
                  </span>
                </div>
                <p className="text-sm text-foreground-muted mt-1">{prediction.issue}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {prediction.timeToFailure}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    R$ {prediction.estimatedCost}
                  </span>
                  <span>Atualizado: {prediction.lastUpdated}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className={cn('text-2xl font-bold', getProbabilityColor(prediction.probability))}>
                  {prediction.probability}%
                </div>
                <p className="text-xs text-foreground-muted">probabilidade</p>
              </div>

              <ChevronRight className="w-5 h-5 text-foreground-muted flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Actions */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Acoes Recomendadas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {predictions
            .filter(p => p.probability >= 50)
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 3)
            .map((prediction, index) => (
              <div
                key={prediction.id}
                className={cn(
                  'p-4 rounded-xl border',
                  index === 0
                    ? 'bg-danger-500/10 border-danger-500/30'
                    : 'bg-surface-hover border-border'
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    index === 0 ? 'bg-danger-500 text-white' : 'bg-primary text-white'
                  )}>
                    {index + 1}
                  </span>
                  <span className="font-medium text-foreground">{prediction.component}</span>
                </div>
                <p className="text-sm text-foreground-muted mb-3">{prediction.recommendedAction}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-muted">
                    Prazo: {prediction.timeToFailure}
                  </span>
                  <button className="px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                    Agendar
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* AI Model Info */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Sobre o Modelo de IA</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium text-foreground mb-2">Algoritmos Utilizados</h3>
            <ul className="text-sm text-foreground-muted space-y-1">
              <li>• LSTM para series temporais</li>
              <li>• Random Forest para classificacao</li>
              <li>• Isolation Forest para anomalias</li>
              <li>• Gradient Boosting para regressao</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-2">Dados de Entrada</h3>
            <ul className="text-sm text-foreground-muted space-y-1">
              <li>• Telemetria em tempo real</li>
              <li>• Historico de manutencao</li>
              <li>• Padroes de uso</li>
              <li>• Condicoes ambientais</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-2">Metricas do Modelo</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground-muted">Precisao</span>
                <span className="text-success-500 font-medium">94.2%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground-muted">Recall</span>
                <span className="text-success-500 font-medium">91.8%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground-muted">F1-Score</span>
                <span className="text-success-500 font-medium">93.0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
