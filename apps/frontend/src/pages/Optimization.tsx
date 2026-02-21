import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  DollarSign,
  Battery,
  Sun,
  Activity,
  Settings,
  Play,
  Pause,
  BarChart3,
  Clock,
  RefreshCw,
  ChevronRight,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { systemsApi, optimizationApi } from '@/services/api';
import { BessSystem } from '@/types';

// Strategy Types
type StrategyId = 'arbitrage' | 'peak_shaving' | 'self_consumption' | 'frequency_response' | 'demand_response';

interface Strategy {
  id: StrategyId;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  benefits: string[];
  requirements: string[];
}

interface StrategyConfig {
  enabled: boolean;
  priority: number;
  parameters: Record<string, number | string | boolean>;
}

interface OptimizationResult {
  savings: number;
  energyArbitraged: number;
  peakReduction: number;
  selfConsumptionRate: number;
  co2Avoided: number;
}

const STRATEGIES: Strategy[] = [
  {
    id: 'arbitrage',
    name: 'Arbitragem de Energia',
    description: 'Compra energia quando barata (fora de pico) e vende/usa quando cara (pico)',
    icon: DollarSign,
    color: 'text-success-500',
    bgColor: 'bg-success-500/10',
    benefits: [
      'Reducao de custos de energia ate 30%',
      'Aproveitamento de tarifas horarias',
      'ROI tipico de 2-4 anos',
    ],
    requirements: [
      'Tarifa horosazonal (branca/verde/azul)',
      'Capacidade de armazenamento adequada',
      'Conexao com dados de tarifas',
    ],
  },
  {
    id: 'peak_shaving',
    name: 'Peak Shaving',
    description: 'Reduz picos de demanda para diminuir custos de demanda contratada',
    icon: TrendingDown,
    color: 'text-warning-500',
    bgColor: 'bg-warning-500/10',
    benefits: [
      'Reducao de demanda contratada',
      'Economia de 15-25% na fatura',
      'Evita multas por ultrapassagem',
    ],
    requirements: [
      'Contrato de demanda',
      'Medicao de potencia em tempo real',
      'Capacidade de potencia adequada',
    ],
  },
  {
    id: 'self_consumption',
    name: 'Autoconsumo Solar',
    description: 'Maximiza uso da geracao solar armazenando excedente para uso posterior',
    icon: Sun,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    benefits: [
      'Autoconsumo acima de 90%',
      'Reducao de injecao na rede',
      'Independencia energetica',
    ],
    requirements: [
      'Sistema fotovoltaico instalado',
      'Inversores compativeis',
      'Medicao de geracao solar',
    ],
  },
  {
    id: 'frequency_response',
    name: 'Resposta de Frequencia',
    description: 'Participa de servicos ancilares fornecendo regulacao de frequencia',
    icon: Activity,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    benefits: [
      'Receita adicional de servicos',
      'Contribuicao para estabilidade',
      'Valorizacao do ativo',
    ],
    requirements: [
      'Certificacao ONS',
      'Tempo de resposta < 200ms',
      'Comunicacao com operador',
    ],
  },
  {
    id: 'demand_response',
    name: 'Resposta a Demanda',
    description: 'Responde a sinais de preco ou eventos de rede reduzindo consumo',
    icon: Zap,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    benefits: [
      'Receita de programas DR',
      'Flexibilidade operacional',
      'Suporte a rede em emergencias',
    ],
    requirements: [
      'Participacao em programa DR',
      'Comunicacao bidirecional',
      'Capacidade de reducao',
    ],
  },
];

const DEFAULT_CONFIGS: Record<StrategyId, StrategyConfig> = {
  arbitrage: {
    enabled: true,
    priority: 1,
    parameters: {
      buyThresholdPrice: 0.45,
      sellThresholdPrice: 0.85,
      minSocForSell: 30,
      maxSocForBuy: 90,
    },
  },
  peak_shaving: {
    enabled: true,
    priority: 2,
    parameters: {
      demandLimit: 100,
      triggerThreshold: 80,
      minSoc: 20,
      responseTime: 5,
    },
  },
  self_consumption: {
    enabled: false,
    priority: 3,
    parameters: {
      minSolarExcess: 1,
      targetSoc: 80,
      nightDischarge: true,
    },
  },
  frequency_response: {
    enabled: false,
    priority: 4,
    parameters: {
      frequencyDeadband: 0.05,
      droopPercentage: 5,
      maxPowerResponse: 50,
    },
  },
  demand_response: {
    enabled: false,
    priority: 5,
    parameters: {
      minEventDuration: 30,
      maxReduction: 80,
      advanceNotice: 15,
    },
  },
};

export default function Optimization() {
  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [configs, setConfigs] = useState<Record<StrategyId, StrategyConfig>>(DEFAULT_CONFIGS);
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<StrategyId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Fetch systems
  useEffect(() => {
    const fetchSystems = async () => {
      try {
        const res = await systemsApi.getAll();
        setSystems(res.data.data || []);
        if (res.data.data?.length) {
          setSelectedSystem(res.data.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch systems:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystems();
  }, []);

  // Fetch optimization config for selected system
  useEffect(() => {
    const fetchConfig = async () => {
      if (!selectedSystem) return;
      try {
        const res = await optimizationApi.getConfig(selectedSystem);
        if (res.data.data) {
          setConfigs(res.data.data);
        }
      } catch {
        // Use defaults
      }
    };

    fetchConfig();
  }, [selectedSystem]);

  // Fetch optimization results
  useEffect(() => {
    const fetchResults = async () => {
      if (!selectedSystem) return;
      try {
        const res = await optimizationApi.getResults(selectedSystem);
        if (res.data.data) {
          setResults(res.data.data);
        }
      } catch {
        // Mock results for demo
        setResults({
          savings: 12450.80,
          energyArbitraged: 2450,
          peakReduction: 35,
          selfConsumptionRate: 78,
          co2Avoided: 1.2,
        });
      }
    };

    fetchResults();
  }, [selectedSystem]);

  // Toggle strategy
  const toggleStrategy = (strategyId: StrategyId) => {
    setConfigs(prev => ({
      ...prev,
      [strategyId]: {
        ...prev[strategyId],
        enabled: !prev[strategyId].enabled,
      },
    }));
  };

  // Update strategy parameters
  const updateParameter = (strategyId: StrategyId, param: string, value: number | string | boolean) => {
    setConfigs(prev => ({
      ...prev,
      [strategyId]: {
        ...prev[strategyId],
        parameters: {
          ...prev[strategyId].parameters,
          [param]: value,
        },
      },
    }));
  };

  // Save configuration
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await optimizationApi.updateConfig(selectedSystem, configs);
      // Show success
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Run optimization
  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      await optimizationApi.runOptimization(selectedSystem);
      // Refresh results
    } catch (error) {
      console.error('Failed to run optimization:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const enabledCount = Object.values(configs).filter(c => c.enabled).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Otimizacao</h1>
          <p className="text-foreground-muted text-sm">
            Configure estrategias de otimizacao para maximizar o valor do seu BESS
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* System Selector */}
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {systems.map(system => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleOptimize}
            disabled={isOptimizing || enabledCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isOptimizing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Otimizar Agora
          </button>
        </div>
      </div>

      {/* Results Summary */}
      {results && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <ResultCard
            title="Economia Total"
            value={`R$ ${results.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            color="success"
            subtitle="Este mes"
          />
          <ResultCard
            title="Energia Arbitrada"
            value={`${results.energyArbitraged} kWh`}
            icon={TrendingUp}
            color="primary"
            subtitle="Ciclos de arbitragem"
          />
          <ResultCard
            title="Reducao de Pico"
            value={`${results.peakReduction}%`}
            icon={TrendingDown}
            color="warning"
            subtitle="vs. demanda base"
          />
          <ResultCard
            title="Autoconsumo"
            value={`${results.selfConsumptionRate}%`}
            icon={Sun}
            color="secondary"
            subtitle="Taxa de utilizacao"
          />
          <ResultCard
            title="CO2 Evitado"
            value={`${results.co2Avoided} ton`}
            icon={Activity}
            color="success"
            subtitle="Impacto ambiental"
          />
        </div>
      )}

      {/* Active Strategies */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Estrategias Ativas</h2>
              <p className="text-sm text-foreground-muted">
                {enabledCount} de {STRATEGIES.length} estrategias habilitadas
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground font-medium rounded-lg transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            Salvar Config
          </button>
        </div>

        {/* Priority Order */}
        <div className="flex items-center gap-2 mb-4 text-sm text-foreground-muted">
          <Clock className="w-4 h-4" />
          <span>Ordem de prioridade (arraste para reordenar):</span>
        </div>

        <div className="space-y-3">
          {STRATEGIES.sort((a, b) =>
            (configs[a.id]?.priority || 99) - (configs[b.id]?.priority || 99)
          ).map((strategy) => {
            const config = configs[strategy.id];
            const Icon = strategy.icon;

            return (
              <div
                key={strategy.id}
                className={cn(
                  'rounded-xl border p-4 transition-all cursor-pointer',
                  config?.enabled
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-surface-hover opacity-60'
                )}
                onClick={() => setActiveStrategy(
                  activeStrategy === strategy.id ? null : strategy.id
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-3 rounded-xl', strategy.bgColor)}>
                      <Icon className={cn('w-6 h-6', strategy.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {strategy.name}
                        {config?.enabled && (
                          <span className="px-2 py-0.5 bg-success-500/20 text-success-500 text-xs font-medium rounded-full">
                            Ativo
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-foreground-muted">{strategy.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStrategy(strategy.id);
                      }}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        config?.enabled
                          ? 'bg-primary text-white hover:bg-primary-600'
                          : 'bg-surface-active text-foreground-muted hover:text-foreground'
                      )}
                    >
                      {config?.enabled ? (
                        <>
                          <Pause className="w-4 h-4 inline mr-2" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 inline mr-2" />
                          Ativar
                        </>
                      )}
                    </button>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-foreground-muted transition-transform',
                        activeStrategy === strategy.id && 'rotate-90'
                      )}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {activeStrategy === strategy.id && (
                  <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Benefits */}
                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <Check className="w-4 h-4 text-success-500" />
                          Beneficios
                        </h4>
                        <ul className="space-y-2 text-sm text-foreground-muted">
                          {strategy.benefits.map((benefit, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-4 h-4 text-success-500 shrink-0 mt-0.5" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Requirements */}
                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning-500" />
                          Requisitos
                        </h4>
                        <ul className="space-y-2 text-sm text-foreground-muted">
                          {strategy.requirements.map((req, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-foreground-subtle shrink-0 mt-0.5" />
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Parameters */}
                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-primary" />
                          Parametros
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(config?.parameters || {}).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between">
                              <label className="text-sm text-foreground-muted capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </label>
                              {typeof value === 'boolean' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateParameter(strategy.id, key, !value);
                                  }}
                                  className={cn(
                                    'w-10 h-6 rounded-full transition-colors',
                                    value ? 'bg-primary' : 'bg-surface-active'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'w-4 h-4 bg-white rounded-full transition-transform',
                                      value ? 'translate-x-5' : 'translate-x-1'
                                    )}
                                  />
                                </button>
                              ) : (
                                <input
                                  type="number"
                                  value={value as number}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateParameter(strategy.id, key, parseFloat(e.target.value));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-24 px-2 py-1 bg-background border border-border rounded text-foreground text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tariff Schedule */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Horarios Tarifarios</h2>
              <p className="text-sm text-foreground-muted">
                Configuracao de tarifas para otimizacao
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="text-sm text-primary hover:text-primary-400 flex items-center gap-1"
          >
            Configurar
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <TariffCard
            name="Fora Ponta"
            hours="22:00 - 17:00"
            price={0.45}
            color="success"
            action="Carregar"
          />
          <TariffCard
            name="Intermediario"
            hours="17:00 - 18:00 / 21:00 - 22:00"
            price={0.65}
            color="warning"
            action="Standby"
          />
          <TariffCard
            name="Ponta"
            hours="18:00 - 21:00"
            price={0.95}
            color="danger"
            action="Descarregar"
          />
        </div>
      </div>
    </div>
  );
}

// Result Card Component
interface ResultCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'success' | 'warning' | 'primary' | 'secondary' | 'danger';
  subtitle: string;
}

function ResultCard({ title, value, icon: Icon, color, subtitle }: ResultCardProps) {
  const colorClasses = {
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    danger: 'text-danger-500 bg-danger-500/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-foreground-muted">{title}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground-subtle mt-1">{subtitle}</p>
    </div>
  );
}

// Tariff Card Component
interface TariffCardProps {
  name: string;
  hours: string;
  price: number;
  color: 'success' | 'warning' | 'danger';
  action: string;
}

function TariffCard({ name, hours, price, color, action }: TariffCardProps) {
  const colorClasses = {
    success: 'border-success-500/30 bg-success-500/5',
    warning: 'border-warning-500/30 bg-warning-500/5',
    danger: 'border-danger-500/30 bg-danger-500/5',
  };

  const textColors = {
    success: 'text-success-500',
    warning: 'text-warning-500',
    danger: 'text-danger-500',
  };

  return (
    <div className={cn('rounded-xl border p-4', colorClasses[color])}>
      <h3 className={cn('font-semibold mb-1', textColors[color])}>{name}</h3>
      <p className="text-sm text-foreground-muted mb-2">{hours}</p>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-foreground">
          R$ {price.toFixed(2)}/kWh
        </span>
        <span className="text-xs text-foreground-muted px-2 py-1 bg-background rounded">
          {action}
        </span>
      </div>
    </div>
  );
}
