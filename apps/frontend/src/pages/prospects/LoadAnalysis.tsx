/**
 * LoadAnalysis
 * TODO: [FASE 1] This page exists but is not routed in App.tsx.
 * Decision pending: Add route, keep for future use, or remove.
 * Created: 2026-02-21
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Calendar,
  Download,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Activity,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Info,
  Target,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

interface LoadProfile {
  timestamp: Date;
  demandKw: number;
  consumptionKwh: number;
  powerFactor: number;
}

interface DailyPattern {
  hour: number;
  avgDemandKw: number;
  minDemandKw: number;
  maxDemandKw: number;
  stdDevKw: number;
}

interface WeeklyPattern {
  dayOfWeek: number;
  dayName: string;
  avgDemandKw: number;
  peakDemandKw: number;
  totalConsumptionKwh: number;
}

interface TariffPeriod {
  name: string;
  startHour: number;
  endHour: number;
  pricePerKwh: number;
  demandPricePerKw?: number;
  color: string;
}

interface LoadAnalysisData {
  id: string;
  prospectId: string;
  prospectName: string;
  analyzerKitSerial: string;
  startDate: Date;
  endDate: Date;
  analyzedDays: number;
  status: 'pending' | 'in_progress' | 'completed';

  // Summary statistics
  totalConsumptionKwh: number;
  avgDailyConsumptionKwh: number;
  peakDemandKw: number;
  peakDemandTimestamp: Date;
  avgDemandKw: number;
  minDemandKw: number;
  loadFactor: number;
  avgPowerFactor: number;

  // Patterns
  dailyPattern: DailyPattern[];
  weeklyPattern: WeeklyPattern[];

  // Tariff analysis
  tariffStructure: TariffPeriod[];
  consumptionByTariff: {
    periodName: string;
    consumptionKwh: number;
    cost: number;
    percentage: number;
  }[];
  currentMonthlyCost: number;

  // Opportunities
  peakShavingPotential: {
    targetReductionKw: number;
    estimatedSavingsPerYear: number;
    requiredBatteryKwh: number;
    paybackYears: number;
  };
  arbitragePotential: {
    dailySpreadBrl: number;
    estimatedSavingsPerYear: number;
    requiredBatteryKwh: number;
    cyclesPerDay: number;
  };
  backupPotential: {
    criticalLoadKw: number;
    desiredBackupHours: number;
    requiredBatteryKwh: number;
  };

  // Raw data sample (for charts)
  recentLoadProfile: LoadProfile[];
}

// ============================================
// MOCK DATA
// ============================================

const generateHourlyPattern = (): DailyPattern[] => {
  return Array.from({ length: 24 }, (_, hour) => {
    // Industrial pattern: low at night, ramp up in morning, peak mid-day, drop evening
    let baseLoad = 100;
    if (hour >= 0 && hour < 6) baseLoad = 80;
    else if (hour >= 6 && hour < 8) baseLoad = 120 + (hour - 6) * 40;
    else if (hour >= 8 && hour < 12) baseLoad = 200 + Math.sin((hour - 8) * Math.PI / 4) * 80;
    else if (hour >= 12 && hour < 14) baseLoad = 180;
    else if (hour >= 14 && hour < 18) baseLoad = 250 + Math.sin((hour - 14) * Math.PI / 4) * 70;
    else if (hour >= 18 && hour < 21) baseLoad = 200 - (hour - 18) * 30;
    else baseLoad = 100 - (hour - 21) * 10;

    const variance = baseLoad * 0.15;
    return {
      hour,
      avgDemandKw: baseLoad,
      minDemandKw: baseLoad - variance,
      maxDemandKw: baseLoad + variance,
      stdDevKw: variance * 0.5,
    };
  });
};

const generateWeeklyPattern = (): WeeklyPattern[] => {
  const days = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  const baseConsumption = [600, 1200, 1250, 1280, 1220, 1180, 700];
  const basePeak = [150, 280, 320, 310, 290, 270, 160];

  return days.map((dayName, dayOfWeek) => ({
    dayOfWeek,
    dayName,
    avgDemandKw: baseConsumption[dayOfWeek] / 12,
    peakDemandKw: basePeak[dayOfWeek],
    totalConsumptionKwh: baseConsumption[dayOfWeek],
  }));
};

const generateLoadProfile = (days: number): LoadProfile[] => {
  const data: LoadProfile[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 24; h++) {
      const timestamp = new Date(startDate);
      timestamp.setDate(timestamp.getDate() + d);
      timestamp.setHours(h, 0, 0, 0);

      // Generate realistic industrial load
      let baseDemand = 150;
      const dayOfWeek = timestamp.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend) {
        baseDemand = 80;
      } else {
        if (h >= 8 && h < 18) baseDemand = 200 + Math.random() * 100;
        else if (h >= 6 && h < 8) baseDemand = 150 + Math.random() * 50;
        else if (h >= 18 && h < 22) baseDemand = 120 + Math.random() * 40;
        else baseDemand = 60 + Math.random() * 30;
      }

      data.push({
        timestamp,
        demandKw: baseDemand + (Math.random() - 0.5) * 30,
        consumptionKwh: baseDemand * (1 + (Math.random() - 0.5) * 0.1),
        powerFactor: 0.85 + Math.random() * 0.1,
      });
    }
  }

  return data;
};

const MOCK_ANALYSIS: LoadAnalysisData = {
  id: 'la1',
  prospectId: 'p1',
  prospectName: 'Industria ABC Ltda',
  analyzerKitSerial: 'AK-2024-001',
  startDate: new Date('2024-01-15'),
  endDate: new Date('2024-01-28'),
  analyzedDays: 14,
  status: 'completed',

  totalConsumptionKwh: 17500,
  avgDailyConsumptionKwh: 1250,
  peakDemandKw: 320,
  peakDemandTimestamp: new Date('2024-01-22T14:30:00'),
  avgDemandKw: 180,
  minDemandKw: 45,
  loadFactor: 0.56,
  avgPowerFactor: 0.89,

  dailyPattern: generateHourlyPattern(),
  weeklyPattern: generateWeeklyPattern(),

  tariffStructure: [
    { name: 'Fora Ponta', startHour: 0, endHour: 18, pricePerKwh: 0.45, demandPricePerKw: 15.50, color: '#22c55e' },
    { name: 'Ponta', startHour: 18, endHour: 21, pricePerKwh: 0.95, demandPricePerKw: 45.00, color: '#ef4444' },
    { name: 'Fora Ponta', startHour: 21, endHour: 24, pricePerKwh: 0.45, demandPricePerKw: 15.50, color: '#22c55e' },
  ],
  consumptionByTariff: [
    { periodName: 'Fora Ponta', consumptionKwh: 14875, cost: 6693.75, percentage: 85 },
    { periodName: 'Ponta', consumptionKwh: 2625, cost: 2493.75, percentage: 15 },
  ],
  currentMonthlyCost: 52500,

  peakShavingPotential: {
    targetReductionKw: 80,
    estimatedSavingsPerYear: 85000,
    requiredBatteryKwh: 240,
    paybackYears: 4.2,
  },
  arbitragePotential: {
    dailySpreadBrl: 0.50,
    estimatedSavingsPerYear: 42000,
    requiredBatteryKwh: 200,
    cyclesPerDay: 1.2,
  },
  backupPotential: {
    criticalLoadKw: 100,
    desiredBackupHours: 4,
    requiredBatteryKwh: 400,
  },

  recentLoadProfile: generateLoadProfile(7),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function LoadAnalysis() {
  const { prospectId } = useParams<{ prospectId: string }>();
  const [analysis, setAnalysis] = useState<LoadAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'daily' | 'weekly' | 'timeline'>('daily');
  const [showDetails, setShowDetails] = useState(false);

  // Fetch analysis data
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setIsLoading(true);
        // In production: const response = await api.get(`/prospects/${prospectId}/analysis`);
        await new Promise(resolve => setTimeout(resolve, 500));
        setAnalysis(MOCK_ANALYSIS);
      } catch (err) {
        setError('Falha ao carregar analise');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [prospectId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  // Calculate peak hours data
  const peakHoursAnalysis = useMemo(() => {
    if (!analysis) return null;

    const peakHours = analysis.dailyPattern.filter(d => d.hour >= 18 && d.hour < 21);
    const offPeakHours = analysis.dailyPattern.filter(d => d.hour < 18 || d.hour >= 21);

    const avgPeakDemand = peakHours.reduce((sum, h) => sum + h.avgDemandKw, 0) / peakHours.length;
    const avgOffPeakDemand = offPeakHours.reduce((sum, h) => sum + h.avgDemandKw, 0) / offPeakHours.length;

    return {
      avgPeakDemand,
      avgOffPeakDemand,
      peakToOffPeakRatio: avgPeakDemand / avgOffPeakDemand,
      peakReductionOpportunity: avgPeakDemand - avgOffPeakDemand,
    };
  }, [analysis]);

  if (isLoading) {
    return <LoadAnalysisSkeleton />;
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Analise nao encontrada'}
        </h2>
        <Link
          to={`/prospects/${prospectId}`}
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para prospecto
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/prospects/${prospectId}`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analise de Carga</h1>
            <p className="text-foreground-muted text-sm">
              {analysis.prospectName} | Kit: {analysis.analyzerKitSerial}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-hover rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
          <Link
            to={`/prospects/${prospectId}/recommendations`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors"
          >
            <Target className="w-4 h-4" />
            Ver Recomendacoes
          </Link>
          <Link
            to={`/prospects/${prospectId}/proposal/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Criar Proposta
          </Link>
        </div>
      </div>

      {/* Analysis Period */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-foreground-muted text-sm">Periodo de Analise</p>
              <p className="text-foreground font-semibold">
                {formatDate(analysis.startDate)} - {formatDate(analysis.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{analysis.analyzedDays}</p>
              <p className="text-xs text-foreground-muted">Dias Analisados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{(analysis.analyzedDays * 24).toLocaleString()}</p>
              <p className="text-xs text-foreground-muted">Pontos de Dados</p>
            </div>
            <span className={cn(
              'px-3 py-1 text-sm font-medium rounded-full',
              analysis.status === 'completed' ? 'bg-success-500/20 text-success-500' :
              analysis.status === 'in_progress' ? 'bg-purple-500/20 text-purple-400' :
              'bg-warning-500/20 text-warning-500'
            )}>
              {analysis.status === 'completed' ? 'Concluida' :
               analysis.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Consumo Total</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{analysis.totalConsumptionKwh.toLocaleString()} kWh</p>
          <p className="text-sm text-foreground-muted mt-1">
            Media: {analysis.avgDailyConsumptionKwh.toLocaleString()} kWh/dia
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Demanda de Pico</span>
            <TrendingUp className="w-5 h-5 text-danger-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{analysis.peakDemandKw} kW</p>
          <p className="text-sm text-foreground-muted mt-1">
            Em {formatDateTime(analysis.peakDemandTimestamp)}
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Demanda Media</span>
            <BarChart3 className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{analysis.avgDemandKw} kW</p>
          <p className="text-sm text-foreground-muted mt-1">
            Fator de Carga: {(analysis.loadFactor * 100).toFixed(0)}%
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Custo Mensal Est.</span>
            <DollarSign className="w-5 h-5 text-warning-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(analysis.currentMonthlyCost)}</p>
          <p className="text-sm text-foreground-muted mt-1">
            FP Medio: {(analysis.avgPowerFactor * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Load Pattern Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Pattern */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Perfil Diario de Carga
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedView('daily')}
                className={cn(
                  'px-3 py-1 text-sm rounded-lg transition-colors',
                  selectedView === 'daily' ? 'bg-primary text-white' : 'bg-surface-hover text-foreground-muted'
                )}
              >
                Horario
              </button>
              <button
                onClick={() => setSelectedView('weekly')}
                className={cn(
                  'px-3 py-1 text-sm rounded-lg transition-colors',
                  selectedView === 'weekly' ? 'bg-primary text-white' : 'bg-surface-hover text-foreground-muted'
                )}
              >
                Semanal
              </button>
            </div>
          </div>

          {/* Simplified Chart Representation */}
          <div className="h-64 flex items-end gap-1 pt-4">
            {selectedView === 'daily' ? (
              analysis.dailyPattern.map((hour, i) => {
                const maxDemand = Math.max(...analysis.dailyPattern.map(h => h.maxDemandKw));
                const heightPercent = (hour.avgDemandKw / maxDemand) * 100;
                const isPeakHour = hour.hour >= 18 && hour.hour < 21;

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isPeakHour ? 'bg-danger-500' : 'bg-primary'
                      )}
                      style={{ height: `${heightPercent}%` }}
                      title={`${hour.hour}h: ${hour.avgDemandKw.toFixed(0)} kW`}
                    />
                    {i % 4 === 0 && (
                      <span className="text-2xs text-foreground-muted">{hour.hour}h</span>
                    )}
                  </div>
                );
              })
            ) : (
              analysis.weeklyPattern.map((day, i) => {
                const maxDemand = Math.max(...analysis.weeklyPattern.map(d => d.peakDemandKw));
                const heightPercent = (day.peakDemandKw / maxDemand) * 100;
                const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isWeekend ? 'bg-foreground-subtle' : 'bg-primary'
                      )}
                      style={{ height: `${heightPercent}%` }}
                      title={`${day.dayName}: ${day.peakDemandKw.toFixed(0)} kW`}
                    />
                    <span className="text-2xs text-foreground-muted">{day.dayName.substring(0, 3)}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-foreground-muted">Fora Ponta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-danger-500" />
              <span className="text-foreground-muted">Horario de Ponta (18h-21h)</span>
            </div>
          </div>
        </div>

        {/* Tariff Breakdown */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Distribuicao por Tarifa
          </h3>

          <div className="space-y-4">
            {analysis.consumptionByTariff.map((tariff, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground">{tariff.periodName}</span>
                  <span className="text-foreground-muted">{tariff.percentage}%</span>
                </div>
                <div className="h-3 bg-background rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      tariff.periodName === 'Ponta' ? 'bg-danger-500' : 'bg-success-500'
                    )}
                    style={{ width: `${tariff.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-sm">
                  <span className="text-foreground-muted">{tariff.consumptionKwh.toLocaleString()} kWh</span>
                  <span className="text-foreground font-medium">{formatCurrency(tariff.cost)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 bg-background rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted">Custo Total Estimado</span>
              <span className="text-xl font-bold text-foreground">
                {formatCurrency(analysis.consumptionByTariff.reduce((sum, t) => sum + t.cost, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5" />
            Oportunidades Identificadas
          </h3>
        </div>

        <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Peak Shaving */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-danger-500/10">
                <TrendingDown className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Peak Shaving</h4>
                <p className="text-xs text-foreground-muted">Reducao de demanda de ponta</p>
              </div>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Reducao Alvo</dt>
                <dd className="text-foreground font-medium">{analysis.peakShavingPotential.targetReductionKw} kW</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Economia Anual</dt>
                <dd className="text-success-500 font-bold">{formatCurrency(analysis.peakShavingPotential.estimatedSavingsPerYear)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Bateria Necessaria</dt>
                <dd className="text-foreground font-medium">{analysis.peakShavingPotential.requiredBatteryKwh} kWh</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Payback</dt>
                <dd className="text-foreground font-medium">{analysis.peakShavingPotential.paybackYears.toFixed(1)} anos</dd>
              </div>
            </dl>
          </div>

          {/* Arbitrage */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Arbitragem Tarifaria</h4>
                <p className="text-xs text-foreground-muted">Carregar fora ponta, descarregar na ponta</p>
              </div>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Spread Diario</dt>
                <dd className="text-foreground font-medium">{formatCurrency(analysis.arbitragePotential.dailySpreadBrl)}/kWh</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Economia Anual</dt>
                <dd className="text-success-500 font-bold">{formatCurrency(analysis.arbitragePotential.estimatedSavingsPerYear)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Bateria Necessaria</dt>
                <dd className="text-foreground font-medium">{analysis.arbitragePotential.requiredBatteryKwh} kWh</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Ciclos/Dia</dt>
                <dd className="text-foreground font-medium">{analysis.arbitragePotential.cyclesPerDay.toFixed(1)}</dd>
              </div>
            </dl>
          </div>

          {/* Backup */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-warning-500/10">
                <Zap className="w-5 h-5 text-warning-500" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Backup de Energia</h4>
                <p className="text-xs text-foreground-muted">Continuidade para cargas criticas</p>
              </div>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Carga Critica Est.</dt>
                <dd className="text-foreground font-medium">{analysis.backupPotential.criticalLoadKw} kW</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Autonomia Desejada</dt>
                <dd className="text-foreground font-medium">{analysis.backupPotential.desiredBackupHours}h</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Bateria Necessaria</dt>
                <dd className="text-foreground font-medium">{analysis.backupPotential.requiredBatteryKwh} kWh</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-foreground-muted">Protecao</dt>
                <dd className="text-foreground font-medium">Quedas de energia</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Combined Savings */}
        <div className="p-4 bg-success-500/5 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-success-500" />
              <span className="text-foreground font-medium">Economia Potencial Combinada</span>
            </div>
            <span className="text-2xl font-bold text-success-500">
              {formatCurrency(analysis.peakShavingPotential.estimatedSavingsPerYear + analysis.arbitragePotential.estimatedSavingsPerYear)}/ano
            </span>
          </div>
        </div>
      </div>

      {/* Peak Hours Analysis */}
      {peakHoursAnalysis && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Analise de Horarios
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-foreground-muted text-sm mb-1">Media Ponta</p>
              <p className="text-xl font-bold text-danger-500">{peakHoursAnalysis.avgPeakDemand.toFixed(0)} kW</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-foreground-muted text-sm mb-1">Media Fora Ponta</p>
              <p className="text-xl font-bold text-success-500">{peakHoursAnalysis.avgOffPeakDemand.toFixed(0)} kW</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-foreground-muted text-sm mb-1">Ratio Ponta/Fora</p>
              <p className="text-xl font-bold text-foreground">{peakHoursAnalysis.peakToOffPeakRatio.toFixed(2)}x</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-foreground-muted text-sm mb-1">Oportunidade Reducao</p>
              <p className="text-xl font-bold text-secondary">{peakHoursAnalysis.peakReductionOpportunity.toFixed(0)} kW</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Data Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full p-4 bg-surface rounded-xl border border-border flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <span className="font-medium text-foreground">Dados Detalhados</span>
        {showDetails ? (
          <ChevronUp className="w-5 h-5 text-foreground-muted" />
        ) : (
          <ChevronDown className="w-5 h-5 text-foreground-muted" />
        )}
      </button>

      {showDetails && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-hover">
                  <th className="text-left p-3 text-sm font-medium text-foreground-muted">Hora</th>
                  <th className="text-right p-3 text-sm font-medium text-foreground-muted">Demanda Media (kW)</th>
                  <th className="text-right p-3 text-sm font-medium text-foreground-muted">Min (kW)</th>
                  <th className="text-right p-3 text-sm font-medium text-foreground-muted">Max (kW)</th>
                  <th className="text-right p-3 text-sm font-medium text-foreground-muted">Desvio Padrao</th>
                  <th className="text-center p-3 text-sm font-medium text-foreground-muted">Periodo</th>
                </tr>
              </thead>
              <tbody>
                {analysis.dailyPattern.map((hour, i) => {
                  const isPeakHour = hour.hour >= 18 && hour.hour < 21;
                  return (
                    <tr key={i} className={cn('border-b border-border', isPeakHour && 'bg-danger-500/5')}>
                      <td className="p-3 text-foreground font-medium">{hour.hour.toString().padStart(2, '0')}:00</td>
                      <td className="p-3 text-right text-foreground">{hour.avgDemandKw.toFixed(1)}</td>
                      <td className="p-3 text-right text-foreground-muted">{hour.minDemandKw.toFixed(1)}</td>
                      <td className="p-3 text-right text-foreground-muted">{hour.maxDemandKw.toFixed(1)}</td>
                      <td className="p-3 text-right text-foreground-muted">{hour.stdDevKw.toFixed(1)}</td>
                      <td className="p-3 text-center">
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          isPeakHour ? 'bg-danger-500/20 text-danger-500' : 'bg-success-500/20 text-success-500'
                        )}>
                          {isPeakHour ? 'Ponta' : 'Fora Ponta'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function LoadAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border h-80 animate-pulse" />
        <div className="bg-surface rounded-xl border border-border h-80 animate-pulse" />
      </div>
    </div>
  );
}
