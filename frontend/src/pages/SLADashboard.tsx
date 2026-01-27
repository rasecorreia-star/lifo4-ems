import { useState, useMemo } from 'react';
import {
  Target,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Award,
  Zap,
  Shield,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
} from 'recharts';

interface SLAMetric {
  id: string;
  name: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'met' | 'at_risk' | 'breached';
}

interface SLABreach {
  id: string;
  metric: string;
  date: string;
  target: number;
  actual: number;
  duration: number;
  impact: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export default function SLADashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'breaches' | 'reports'>('overview');

  const slaMetrics: SLAMetric[] = useMemo(() => [
    { id: '1', name: 'Disponibilidade do Sistema', category: 'Operacao', target: 99.9, current: 99.95, unit: '%', trend: 'up', status: 'met' },
    { id: '2', name: 'Tempo de Resposta a Alarmes', category: 'Suporte', target: 15, current: 8.5, unit: 'min', trend: 'down', status: 'met' },
    { id: '3', name: 'MTTR (Mean Time to Repair)', category: 'Manutencao', target: 4, current: 3.2, unit: 'h', trend: 'down', status: 'met' },
    { id: '4', name: 'MTBF (Mean Time Between Failures)', category: 'Confiabilidade', target: 720, current: 1250, unit: 'h', trend: 'up', status: 'met' },
    { id: '5', name: 'Eficiencia Round-Trip', category: 'Performance', target: 90, current: 93.5, unit: '%', trend: 'stable', status: 'met' },
    { id: '6', name: 'Latencia de Comunicacao', category: 'Comunicacao', target: 100, current: 85, unit: 'ms', trend: 'down', status: 'met' },
    { id: '7', name: 'Taxa de Despacho Bem-Sucedido', category: 'Operacao', target: 98, current: 96.5, unit: '%', trend: 'down', status: 'at_risk' },
    { id: '8', name: 'Tempo de Resolucao de Tickets', category: 'Suporte', target: 24, current: 28, unit: 'h', trend: 'up', status: 'breached' },
  ], []);

  const breaches: SLABreach[] = useMemo(() => [
    { id: '1', metric: 'Tempo de Resolucao de Tickets', date: '2025-01-24', target: 24, actual: 32, duration: 8, impact: 'medium', resolved: true },
    { id: '2', metric: 'Disponibilidade do Sistema', date: '2025-01-20', target: 99.9, actual: 99.7, duration: 2, impact: 'high', resolved: true },
    { id: '3', metric: 'Taxa de Despacho', date: '2025-01-18', target: 98, actual: 95, duration: 4, impact: 'medium', resolved: true },
    { id: '4', metric: 'Tempo de Resposta a Alarmes', date: '2025-01-15', target: 15, actual: 22, duration: 1, impact: 'low', resolved: true },
  ], []);

  const monthlyTrend = useMemo(() => [
    { month: 'Ago', disponibilidade: 99.8, eficiencia: 92.1, despacho: 97.5 },
    { month: 'Set', disponibilidade: 99.9, eficiencia: 92.8, despacho: 98.2 },
    { month: 'Out', disponibilidade: 99.85, eficiencia: 93.0, despacho: 97.8 },
    { month: 'Nov', disponibilidade: 99.92, eficiencia: 93.2, despacho: 98.5 },
    { month: 'Dez', disponibilidade: 99.88, eficiencia: 93.4, despacho: 97.2 },
    { month: 'Jan', disponibilidade: 99.95, eficiencia: 93.5, despacho: 96.5 },
  ], []);

  const uptimeData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      uptime: 99.5 + Math.random() * 0.5,
    }));
  }, []);

  const stats = useMemo(() => {
    const met = slaMetrics.filter(m => m.status === 'met').length;
    const atRisk = slaMetrics.filter(m => m.status === 'at_risk').length;
    const breached = slaMetrics.filter(m => m.status === 'breached').length;
    const overallScore = (met / slaMetrics.length) * 100;
    return { met, atRisk, breached, overallScore, total: slaMetrics.length };
  }, [slaMetrics]);

  const gaugeData = useMemo(() => [
    { name: 'Score', value: stats.overallScore, fill: stats.overallScore >= 90 ? '#10b981' : stats.overallScore >= 70 ? '#f59e0b' : '#ef4444' },
  ], [stats.overallScore]);

  const getStatusBadge = (status: SLAMetric['status']) => {
    switch (status) {
      case 'met':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500"><CheckCircle className="w-3 h-3" /> Atingido</span>;
      case 'at_risk':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500"><AlertTriangle className="w-3 h-3" /> Em Risco</span>;
      case 'breached':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500"><XCircle className="w-3 h-3" /> Violado</span>;
    }
  };

  const getTrendIcon = (trend: SLAMetric['trend'], isLowerBetter: boolean = false) => {
    if (trend === 'stable') return <span className="text-foreground-muted">—</span>;
    if (trend === 'up') {
      return isLowerBetter
        ? <ArrowUp className="w-4 h-4 text-danger-500" />
        : <ArrowUp className="w-4 h-4 text-success-500" />;
    }
    return isLowerBetter
      ? <ArrowDown className="w-4 h-4 text-success-500" />
      : <ArrowDown className="w-4 h-4 text-danger-500" />;
  };

  const getImpactBadge = (impact: SLABreach['impact']) => {
    switch (impact) {
      case 'high':
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Alto</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Medio</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Baixo</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard SLA</h1>
          <p className="text-foreground-muted">Monitoramento de niveis de servico</p>
        </div>
        <div className="flex items-center gap-2">
          {['day', 'week', 'month', 'quarter'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period as typeof selectedPeriod)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedPeriod === period
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-foreground hover:bg-surface-hover'
              }`}
            >
              {period === 'day' ? 'Dia' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Trimestre'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Score & Stats */}
      <div className="grid md:grid-cols-5 gap-4">
        {/* Score Gauge */}
        <div className="md:col-span-2 bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Score Geral SLA</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={200} height={200}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  background
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center -mt-16">
            <p className={`text-4xl font-bold ${
              stats.overallScore >= 90 ? 'text-success-500' :
              stats.overallScore >= 70 ? 'text-warning-500' : 'text-danger-500'
            }`}>
              {stats.overallScore.toFixed(0)}%
            </p>
            <p className="text-sm text-foreground-muted">Conformidade</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="md:col-span-3 grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-success-500/20 to-success-500/5 rounded-xl p-4 border border-success-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-success-500" />
              <span className="text-sm text-foreground-muted">SLAs Atingidos</span>
            </div>
            <p className="text-3xl font-bold text-success-500">{stats.met}</p>
            <p className="text-xs text-foreground-muted">de {stats.total} metricas</p>
          </div>

          <div className="bg-gradient-to-br from-warning-500/20 to-warning-500/5 rounded-xl p-4 border border-warning-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
              <span className="text-sm text-foreground-muted">Em Risco</span>
            </div>
            <p className="text-3xl font-bold text-warning-500">{stats.atRisk}</p>
            <p className="text-xs text-foreground-muted">requerem atencao</p>
          </div>

          <div className="bg-gradient-to-br from-danger-500/20 to-danger-500/5 rounded-xl p-4 border border-danger-500/20">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-danger-500" />
              <span className="text-sm text-foreground-muted">Violados</span>
            </div>
            <p className="text-3xl font-bold text-danger-500">{stats.breached}</p>
            <p className="text-xs text-foreground-muted">acoes necessarias</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Visao Geral
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'metrics'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          Metricas
        </button>
        <button
          onClick={() => setActiveTab('breaches')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'breaches'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Violacoes
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Relatorios
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Uptime Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Disponibilidade (Ultimos 30 dias)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={uptimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <YAxis domain={[99, 100]} tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                />
                <Area type="monotone" dataKey="uptime" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Tendencia Mensal</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <YAxis domain={[90, 100]} tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="disponibilidade" name="Disponibilidade" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="eficiencia" name="Eficiencia" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="despacho" name="Despacho" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key Metrics Summary */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Resumo das Metricas Principais</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {slaMetrics.slice(0, 4).map((metric) => (
                <div key={metric.id} className="p-4 bg-surface-hover rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground-muted">{metric.name}</span>
                    {getTrendIcon(metric.trend, metric.name.includes('Tempo') || metric.name.includes('Latencia'))}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${
                      metric.status === 'met' ? 'text-success-500' :
                      metric.status === 'at_risk' ? 'text-warning-500' : 'text-danger-500'
                    }`}>
                      {metric.current}
                    </span>
                    <span className="text-sm text-foreground-muted">{metric.unit}</span>
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">Meta: {metric.target}{metric.unit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-hover">
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Metrica</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Categoria</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Meta</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Atual</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Tendencia</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slaMetrics.map((metric) => (
                <tr key={metric.id} className={`hover:bg-surface-hover ${
                  metric.status === 'breached' ? 'bg-danger-500/5' :
                  metric.status === 'at_risk' ? 'bg-warning-500/5' : ''
                }`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{metric.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground-muted">{metric.category}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-foreground">{metric.target} {metric.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${
                      metric.status === 'met' ? 'text-success-500' :
                      metric.status === 'at_risk' ? 'text-warning-500' : 'text-danger-500'
                    }`}>
                      {metric.current} {metric.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getTrendIcon(metric.trend, metric.name.includes('Tempo') || metric.name.includes('Latencia') || metric.name.includes('MTTR'))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(metric.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Breaches Tab */}
      {activeTab === 'breaches' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Historico de Violacoes</h2>
            <span className="text-sm text-foreground-muted">{breaches.length} violacoes no periodo</span>
          </div>

          <div className="space-y-3">
            {breaches.map((breach) => (
              <div
                key={breach.id}
                className={`bg-surface rounded-xl border p-4 ${
                  breach.resolved ? 'border-border' : 'border-danger-500'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      breach.resolved ? 'bg-success-500/20' : 'bg-danger-500/20'
                    }`}>
                      {breach.resolved ? (
                        <CheckCircle className="w-5 h-5 text-success-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-danger-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{breach.metric}</h3>
                      <p className="text-sm text-foreground-muted">
                        Meta: {breach.target} | Atual: {breach.actual}
                      </p>
                      <p className="text-xs text-foreground-muted mt-1">
                        {new Date(breach.date).toLocaleDateString('pt-BR')} - Duracao: {breach.duration}h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getImpactBadge(breach.impact)}
                    {breach.resolved ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Resolvido</span>
                    ) : (
                      <button className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Relatorio SLA Mensal', date: '2025-01-01', type: 'PDF' },
            { title: 'Analise de Violacoes Q4', date: '2024-12-31', type: 'PDF' },
            { title: 'Dashboard Executivo', date: '2025-01-15', type: 'PDF' },
            { title: 'Metricas Detalhadas', date: '2025-01-20', type: 'XLSX' },
            { title: 'Comparativo Trimestral', date: '2024-12-15', type: 'PDF' },
            { title: 'Plano de Melhoria', date: '2025-01-10', type: 'DOCX' },
          ].map((report, index) => (
            <div key={index} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{report.title}</p>
                    <p className="text-xs text-foreground-muted">
                      {new Date(report.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 text-xs bg-surface-hover rounded">{report.type}</span>
              </div>
              <button className="w-full px-3 py-2 bg-surface-hover hover:bg-primary/10 rounded-lg text-sm transition-colors">
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
