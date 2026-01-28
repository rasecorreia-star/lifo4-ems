import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Target,
  Battery,
  TrendingUp,
  DollarSign,
  Zap,
  CheckCircle,
  AlertTriangle,
  Info,
  Award,
  Shield,
  Gauge,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Sparkles,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

export enum RecommendationTier {
  CONSERVATIVE = 'conservative',
  RECOMMENDED = 'recommended',
  PREMIUM = 'premium',
}

interface SystemSpecification {
  batteryCapacityKwh: number;
  batteryPowerKw: number;
  batteryChemistry: string;
  inverterPowerKw: number;
  modulesCount: number;
  footprintM2: number;
  weightKg: number;
  warrantyYears: number;
  expectedLifeYears: number;
  cyclesGuaranteed: number;
}

interface FinancialProjection {
  totalInvestment: number;
  annualSavings: number;
  simplePaybackYears: number;
  npv10Years: number;
  irr: number;
  roiPercent: number;
  lcosPerKwh: number;
  monthlySavings: number;
}

interface SavingsBreakdown {
  peakShavingSavings: number;
  arbitrageSavings: number;
  demandReductionSavings: number;
  backupValue: number;
  totalAnnual: number;
}

interface CashFlowProjection {
  year: number;
  savings: number;
  maintenance: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

interface SystemRecommendation {
  id: string;
  tier: RecommendationTier;
  tierName: string;
  tierDescription: string;
  isRecommended: boolean;
  specifications: SystemSpecification;
  financials: FinancialProjection;
  savingsBreakdown: SavingsBreakdown;
  cashFlowProjection: CashFlowProjection[];
  useCases: string[];
  highlights: string[];
  limitations: string[];
}

interface RecommendationsData {
  prospectId: string;
  prospectName: string;
  analysisDate: Date;
  loadProfileSummary: {
    avgDailyConsumption: number;
    peakDemand: number;
    avgDemand: number;
    loadFactor: number;
  };
  tariffInfo: {
    peakPrice: number;
    offPeakPrice: number;
    demandCharge: number;
  };
  recommendations: SystemRecommendation[];
  assumptions: {
    electricityInflation: number;
    discountRate: number;
    batteryDegradation: number;
    maintenanceCostPercent: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const TIER_CONFIG = {
  [RecommendationTier.CONSERVATIVE]: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: Shield,
  },
  [RecommendationTier.RECOMMENDED]: {
    color: 'text-success-500',
    bgColor: 'bg-success-500/10',
    borderColor: 'border-success-500/30',
    icon: Award,
  },
  [RecommendationTier.PREMIUM]: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    icon: Sparkles,
  },
};

// ============================================
// MOCK DATA
// ============================================

const generateCashFlow = (investment: number, annualSavings: number, years: number): CashFlowProjection[] => {
  const maintenanceRate = 0.01;
  let cumulative = -investment;

  return Array.from({ length: years + 1 }, (_, i) => {
    if (i === 0) {
      return {
        year: 0,
        savings: 0,
        maintenance: 0,
        netCashFlow: -investment,
        cumulativeCashFlow: -investment,
      };
    }

    const savings = annualSavings * Math.pow(1.05, i - 1); // 5% inflation
    const maintenance = investment * maintenanceRate * i;
    const net = savings - maintenance;
    cumulative += net;

    return {
      year: i,
      savings,
      maintenance,
      netCashFlow: net,
      cumulativeCashFlow: cumulative,
    };
  });
};

const MOCK_RECOMMENDATIONS: RecommendationsData = {
  prospectId: 'p1',
  prospectName: 'Industria ABC Ltda',
  analysisDate: new Date(),
  loadProfileSummary: {
    avgDailyConsumption: 1250,
    peakDemand: 320,
    avgDemand: 180,
    loadFactor: 0.56,
  },
  tariffInfo: {
    peakPrice: 0.95,
    offPeakPrice: 0.45,
    demandCharge: 45,
  },
  recommendations: [
    {
      id: 'rec1',
      tier: RecommendationTier.CONSERVATIVE,
      tierName: 'Conservador',
      tierDescription: 'Solucao otimizada para ROI rapido com investimento moderado',
      isRecommended: false,
      specifications: {
        batteryCapacityKwh: 200,
        batteryPowerKw: 100,
        batteryChemistry: 'LiFePO4',
        inverterPowerKw: 100,
        modulesCount: 4,
        footprintM2: 12,
        weightKg: 2400,
        warrantyYears: 10,
        expectedLifeYears: 15,
        cyclesGuaranteed: 6000,
      },
      financials: {
        totalInvestment: 280000,
        annualSavings: 72000,
        simplePaybackYears: 3.9,
        npv10Years: 245000,
        irr: 22.5,
        roiPercent: 157,
        lcosPerKwh: 0.28,
        monthlySavings: 6000,
      },
      savingsBreakdown: {
        peakShavingSavings: 45000,
        arbitrageSavings: 22000,
        demandReductionSavings: 5000,
        backupValue: 0,
        totalAnnual: 72000,
      },
      cashFlowProjection: generateCashFlow(280000, 72000, 15),
      useCases: ['Reducao de demanda de ponta', 'Arbitragem tarifaria basica'],
      highlights: [
        'Menor investimento inicial',
        'Payback mais rapido',
        'Ideal para validar tecnologia',
        'Baixo risco financeiro',
      ],
      limitations: [
        'Autonomia limitada para backup',
        'Menor economia total ao longo do tempo',
        'Capacidade pode ficar insuficiente com crescimento',
      ],
    },
    {
      id: 'rec2',
      tier: RecommendationTier.RECOMMENDED,
      tierName: 'Recomendado',
      tierDescription: 'Melhor relacao custo-beneficio para seu perfil de consumo',
      isRecommended: true,
      specifications: {
        batteryCapacityKwh: 350,
        batteryPowerKw: 150,
        batteryChemistry: 'LiFePO4',
        inverterPowerKw: 150,
        modulesCount: 7,
        footprintM2: 20,
        weightKg: 4200,
        warrantyYears: 10,
        expectedLifeYears: 15,
        cyclesGuaranteed: 6000,
      },
      financials: {
        totalInvestment: 425000,
        annualSavings: 115000,
        simplePaybackYears: 3.7,
        npv10Years: 425000,
        irr: 26.8,
        roiPercent: 200,
        lcosPerKwh: 0.24,
        monthlySavings: 9580,
      },
      savingsBreakdown: {
        peakShavingSavings: 68000,
        arbitrageSavings: 38000,
        demandReductionSavings: 9000,
        backupValue: 0,
        totalAnnual: 115000,
      },
      cashFlowProjection: generateCashFlow(425000, 115000, 15),
      useCases: ['Reducao significativa de demanda', 'Arbitragem tarifaria completa', 'Backup parcial'],
      highlights: [
        'Melhor relacao custo-beneficio',
        'Cobertura completa do horario de ponta',
        'Capacidade para crescimento moderado',
        'ROI otimizado',
      ],
      limitations: [
        'Investimento medio',
        'Backup limitado a 2h com carga total',
      ],
    },
    {
      id: 'rec3',
      tier: RecommendationTier.PREMIUM,
      tierName: 'Premium',
      tierDescription: 'Solucao completa com maxima economia e backup integral',
      isRecommended: false,
      specifications: {
        batteryCapacityKwh: 500,
        batteryPowerKw: 200,
        batteryChemistry: 'LiFePO4',
        inverterPowerKw: 200,
        modulesCount: 10,
        footprintM2: 28,
        weightKg: 6000,
        warrantyYears: 12,
        expectedLifeYears: 18,
        cyclesGuaranteed: 8000,
      },
      financials: {
        totalInvestment: 620000,
        annualSavings: 155000,
        simplePaybackYears: 4.0,
        npv10Years: 580000,
        irr: 24.5,
        roiPercent: 188,
        lcosPerKwh: 0.22,
        monthlySavings: 12920,
      },
      savingsBreakdown: {
        peakShavingSavings: 85000,
        arbitrageSavings: 48000,
        demandReductionSavings: 12000,
        backupValue: 10000,
        totalAnnual: 155000,
      },
      cashFlowProjection: generateCashFlow(620000, 155000, 15),
      useCases: ['Eliminacao total da demanda de ponta', 'Arbitragem maxima', 'Backup completo 4h', 'Grid services'],
      highlights: [
        'Maxima economia possivel',
        'Backup completo para cargas criticas',
        'Preparado para servicos de grid futuros',
        'Garantia estendida',
        'Maior vida util',
      ],
      limitations: [
        'Maior investimento inicial',
        'Payback ligeiramente maior',
        'Requer mais espaco fisico',
      ],
    },
  ],
  assumptions: {
    electricityInflation: 5,
    discountRate: 10,
    batteryDegradation: 2,
    maintenanceCostPercent: 1,
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SystemRecommendations() {
  const { prospectId } = useParams<{ prospectId: string }>();
  const [data, setData] = useState<RecommendationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<RecommendationTier>(RecommendationTier.RECOMMENDED);
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        // In production: const response = await api.get(`/prospects/${prospectId}/recommendations`);
        await new Promise(resolve => setTimeout(resolve, 500));
        setData(MOCK_RECOMMENDATIONS);
      } catch (err) {
        setError('Falha ao carregar recomendacoes');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [prospectId]);

  const selectedRecommendation = useMemo(() => {
    return data?.recommendations.find(r => r.tier === selectedTier);
  }, [data, selectedTier]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return <RecommendationsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Recomendacoes nao encontradas'}
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
            <h1 className="text-2xl font-bold text-foreground">Recomendacoes de Sistema</h1>
            <p className="text-foreground-muted text-sm">{data.prospectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/prospects/${prospectId}/analysis`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-hover rounded-lg transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Ver Analise
          </Link>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-hover rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
          <Link
            to={`/prospects/${prospectId}/proposal/new?tier=${selectedTier}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Criar Proposta
          </Link>
        </div>
      </div>

      {/* Load Profile Summary */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Resumo do Perfil de Carga
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-foreground-muted text-sm">Consumo Medio Diario</p>
            <p className="text-xl font-bold text-foreground">{data.loadProfileSummary.avgDailyConsumption.toLocaleString()} kWh</p>
          </div>
          <div>
            <p className="text-foreground-muted text-sm">Demanda de Pico</p>
            <p className="text-xl font-bold text-danger-500">{data.loadProfileSummary.peakDemand} kW</p>
          </div>
          <div>
            <p className="text-foreground-muted text-sm">Demanda Media</p>
            <p className="text-xl font-bold text-foreground">{data.loadProfileSummary.avgDemand} kW</p>
          </div>
          <div>
            <p className="text-foreground-muted text-sm">Fator de Carga</p>
            <p className="text-xl font-bold text-foreground">{(data.loadProfileSummary.loadFactor * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Tier Selection */}
      <div className="grid lg:grid-cols-3 gap-4">
        {data.recommendations.map(rec => {
          const tierConfig = TIER_CONFIG[rec.tier];
          const Icon = tierConfig.icon;
          const isSelected = selectedTier === rec.tier;

          return (
            <button
              key={rec.id}
              onClick={() => setSelectedTier(rec.tier)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all relative',
                isSelected
                  ? `${tierConfig.bgColor} ${tierConfig.borderColor}`
                  : 'bg-surface border-border hover:border-primary/30'
              )}
            >
              {rec.isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-success-500 text-white text-xs font-medium rounded-full">
                  Recomendado
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2 rounded-lg', tierConfig.bgColor)}>
                  <Icon className={cn('w-5 h-5', tierConfig.color)} />
                </div>
                <div>
                  <h4 className={cn('font-semibold', isSelected ? tierConfig.color : 'text-foreground')}>
                    {rec.tierName}
                  </h4>
                  <p className="text-xs text-foreground-muted">{rec.specifications.batteryCapacityKwh} kWh</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Investimento</span>
                  <span className="font-semibold text-foreground">{formatCurrency(rec.financials.totalInvestment)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Economia/Ano</span>
                  <span className="font-semibold text-success-500">{formatCurrency(rec.financials.annualSavings)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Payback</span>
                  <span className="font-semibold text-foreground">{rec.financials.simplePaybackYears.toFixed(1)} anos</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Recommendation Details */}
      {selectedRecommendation && (
        <>
          {/* Financial Highlights */}
          <div className="grid lg:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground-muted text-sm">NPV (10 anos)</span>
                <DollarSign className="w-5 h-5 text-success-500" />
              </div>
              <p className="text-2xl font-bold text-success-500">
                {formatCurrency(selectedRecommendation.financials.npv10Years)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                Taxa de desconto: {data.assumptions.discountRate}%
              </p>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground-muted text-sm">TIR (IRR)</span>
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-2xl font-bold text-secondary">
                {formatPercent(selectedRecommendation.financials.irr)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                Taxa Interna de Retorno
              </p>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground-muted text-sm">ROI Total</span>
                <Target className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatPercent(selectedRecommendation.financials.roiPercent)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                Em {selectedRecommendation.specifications.expectedLifeYears} anos
              </p>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground-muted text-sm">LCOS</span>
                <Gauge className="w-5 h-5 text-warning-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(selectedRecommendation.financials.lcosPerKwh)}/kWh
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                Custo nivelado de armazenamento
              </p>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* System Specifications */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Battery className="w-5 h-5" />
                Especificacoes do Sistema
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Capacidade</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.batteryCapacityKwh} kWh</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Potencia</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.batteryPowerKw} kW</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Quimica</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.batteryChemistry}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Inversor</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.inverterPowerKw} kW</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Modulos</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.modulesCount} unidades</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Area Necessaria</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.footprintM2} m2</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Peso Total</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.weightKg.toLocaleString()} kg</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Garantia</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.warrantyYears} anos</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <dt className="text-foreground-muted">Vida Util Esperada</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.expectedLifeYears} anos</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-foreground-muted">Ciclos Garantidos</dt>
                  <dd className="text-foreground font-medium">{selectedRecommendation.specifications.cyclesGuaranteed.toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            {/* Savings Breakdown */}
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Composicao da Economia
              </h3>

              <div className="space-y-4">
                {[
                  { label: 'Peak Shaving', value: selectedRecommendation.savingsBreakdown.peakShavingSavings, color: 'bg-danger-500' },
                  { label: 'Arbitragem', value: selectedRecommendation.savingsBreakdown.arbitrageSavings, color: 'bg-secondary' },
                  { label: 'Reducao Demanda', value: selectedRecommendation.savingsBreakdown.demandReductionSavings, color: 'bg-warning-500' },
                  { label: 'Valor Backup', value: selectedRecommendation.savingsBreakdown.backupValue, color: 'bg-purple-500' },
                ].map((item, i) => {
                  const percentage = (item.value / selectedRecommendation.savingsBreakdown.totalAnnual) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className="text-foreground-muted text-sm">{item.label}</span>
                        <span className="text-foreground font-medium">{formatCurrency(item.value)}/ano</span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', item.color)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-success-500/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">Economia Total Anual</span>
                  <span className="text-2xl font-bold text-success-500">
                    {formatCurrency(selectedRecommendation.savingsBreakdown.totalAnnual)}
                  </span>
                </div>
                <p className="text-sm text-foreground-muted mt-1">
                  Equivale a {formatCurrency(selectedRecommendation.financials.monthlySavings)}/mes
                </p>
              </div>
            </div>
          </div>

          {/* Highlights and Limitations */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success-500" />
                Destaques
              </h3>
              <ul className="space-y-2">
                {selectedRecommendation.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-warning-500" />
                Limitacoes
              </h3>
              <ul className="space-y-2">
                {selectedRecommendation.limitations.map((limitation, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-500 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground-muted">{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Use Cases */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Casos de Uso
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedRecommendation.useCases.map((useCase, i) => (
                <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium">
                  {useCase}
                </span>
              ))}
            </div>
          </div>

          {/* Cash Flow Projection */}
          <div className="bg-surface rounded-xl border border-border">
            <button
              onClick={() => setShowCashFlow(!showCashFlow)}
              className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-colors rounded-xl"
            >
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Projecao de Fluxo de Caixa
              </h3>
              {showCashFlow ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showCashFlow && (
              <div className="p-4 pt-0">
                {/* Simple Bar Chart */}
                <div className="h-48 flex items-end gap-1 mb-4">
                  {selectedRecommendation.cashFlowProjection.map((cf, i) => {
                    const maxValue = Math.max(...selectedRecommendation.cashFlowProjection.map(c => Math.abs(c.cumulativeCashFlow)));
                    const isPositive = cf.cumulativeCashFlow >= 0;
                    const heightPercent = (Math.abs(cf.cumulativeCashFlow) / maxValue) * 100;

                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col justify-end items-center"
                        title={`Ano ${cf.year}: ${formatCurrency(cf.cumulativeCashFlow)}`}
                      >
                        <div
                          className={cn(
                            'w-full rounded-t transition-all',
                            isPositive ? 'bg-success-500' : 'bg-danger-500'
                          )}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-2xs text-foreground-muted mt-1">{cf.year}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-foreground-muted font-medium">Ano</th>
                        <th className="text-right py-2 text-foreground-muted font-medium">Economia</th>
                        <th className="text-right py-2 text-foreground-muted font-medium">Manutencao</th>
                        <th className="text-right py-2 text-foreground-muted font-medium">Fluxo Liquido</th>
                        <th className="text-right py-2 text-foreground-muted font-medium">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecommendation.cashFlowProjection.slice(0, 11).map((cf, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="py-2 text-foreground">{cf.year}</td>
                          <td className="py-2 text-right text-success-500">{cf.savings > 0 ? formatCurrency(cf.savings) : '-'}</td>
                          <td className="py-2 text-right text-danger-500">{cf.maintenance > 0 ? formatCurrency(cf.maintenance) : '-'}</td>
                          <td className="py-2 text-right text-foreground">{formatCurrency(cf.netCashFlow)}</td>
                          <td className={cn(
                            'py-2 text-right font-medium',
                            cf.cumulativeCashFlow >= 0 ? 'text-success-500' : 'text-danger-500'
                          )}>
                            {formatCurrency(cf.cumulativeCashFlow)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Comparison Table */}
          <div className="bg-surface rounded-xl border border-border">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-colors rounded-xl"
            >
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Comparacao entre Opcoes
              </h3>
              {showComparison ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showComparison && (
              <div className="p-4 pt-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-foreground-muted font-medium">Metrica</th>
                      {data.recommendations.map(rec => (
                        <th key={rec.id} className={cn(
                          'text-center py-3 font-medium',
                          rec.isRecommended ? 'text-success-500' : 'text-foreground'
                        )}>
                          {rec.tierName}
                          {rec.isRecommended && <span className="block text-xs">(Recomendado)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-3 text-foreground-muted">Capacidade</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-foreground">{rec.specifications.batteryCapacityKwh} kWh</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 text-foreground-muted">Investimento</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-foreground">{formatCurrency(rec.financials.totalInvestment)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 text-foreground-muted">Economia/Ano</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-success-500 font-medium">{formatCurrency(rec.financials.annualSavings)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 text-foreground-muted">Payback</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-foreground">{rec.financials.simplePaybackYears.toFixed(1)} anos</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 text-foreground-muted">NPV (10 anos)</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-foreground">{formatCurrency(rec.financials.npv10Years)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 text-foreground-muted">TIR</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-foreground">{formatPercent(rec.financials.irr)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 text-foreground-muted">ROI</td>
                      {data.recommendations.map(rec => (
                        <td key={rec.id} className="py-3 text-center text-foreground">{formatPercent(rec.financials.roiPercent)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assumptions */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Premissas do Calculo
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">Inflacao Energia</p>
                <p className="text-foreground font-medium">{data.assumptions.electricityInflation}% a.a.</p>
              </div>
              <div>
                <p className="text-foreground-muted">Taxa de Desconto</p>
                <p className="text-foreground font-medium">{data.assumptions.discountRate}% a.a.</p>
              </div>
              <div>
                <p className="text-foreground-muted">Degradacao Bateria</p>
                <p className="text-foreground font-medium">{data.assumptions.batteryDegradation}% a.a.</p>
              </div>
              <div>
                <p className="text-foreground-muted">Custo Manutencao</p>
                <p className="text-foreground font-medium">{data.assumptions.maintenanceCostPercent}% do investimento/ano</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function RecommendationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-7 w-64 bg-surface rounded animate-pulse mb-2" />
          <div className="h-5 w-48 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
      <div className="grid lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-48 animate-pulse" />
        ))}
      </div>
      <div className="grid lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
