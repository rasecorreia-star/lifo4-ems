/**
 * System Comparison Page
 * Compare multiple BESS systems side by side
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  X,
  Battery,
  Zap,
  Thermometer,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn, formatPercent, formatPower, formatVoltage, formatTemperature } from '@/lib/utils';

interface ComparisonSystem {
  id: string;
  name: string;
  model: string;
  chemistry: string;
  capacity: number;
  status: 'online' | 'offline';
  soc: number;
  soh: number;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  cycleCount: number;
  efficiency: number;
  dailyEnergy: number;
  monthlyEnergy: number;
  alerts: number;
}

// Mock systems data
const mockSystems: ComparisonSystem[] = [
  {
    id: 'sys-1',
    name: 'BESS Principal',
    model: 'LiFePO4 16S4P',
    chemistry: 'LiFePO4',
    capacity: 100,
    status: 'online',
    soc: 78.5,
    soh: 97.2,
    power: 25.4,
    voltage: 51.2,
    current: 48.5,
    temperature: 32.4,
    cycleCount: 245,
    efficiency: 96.5,
    dailyEnergy: 120.5,
    monthlyEnergy: 3250.8,
    alerts: 0,
  },
  {
    id: 'sys-2',
    name: 'BESS Backup',
    model: 'LiFePO4 16S2P',
    chemistry: 'LiFePO4',
    capacity: 50,
    status: 'online',
    soc: 92.1,
    soh: 98.5,
    power: -12.3,
    voltage: 52.8,
    current: -23.3,
    temperature: 28.6,
    cycleCount: 120,
    efficiency: 97.2,
    dailyEnergy: 85.2,
    monthlyEnergy: 2180.4,
    alerts: 0,
  },
  {
    id: 'sys-3',
    name: 'BESS Solar',
    model: 'NMC 14S6P',
    chemistry: 'NMC',
    capacity: 150,
    status: 'online',
    soc: 45.3,
    soh: 94.8,
    power: 45.2,
    voltage: 48.6,
    current: 93.0,
    temperature: 35.8,
    cycleCount: 380,
    efficiency: 95.1,
    dailyEnergy: 185.3,
    monthlyEnergy: 4820.5,
    alerts: 2,
  },
  {
    id: 'sys-4',
    name: 'BESS Industrial',
    model: 'LiFePO4 32S8P',
    chemistry: 'LiFePO4',
    capacity: 500,
    status: 'online',
    soc: 62.8,
    soh: 91.2,
    power: 125.6,
    voltage: 102.4,
    current: 122.7,
    temperature: 38.2,
    cycleCount: 520,
    efficiency: 94.8,
    dailyEnergy: 580.2,
    monthlyEnergy: 15250.8,
    alerts: 1,
  },
  {
    id: 'sys-5',
    name: 'BESS Comercial',
    model: 'NCA 12S4P',
    chemistry: 'NCA',
    capacity: 80,
    status: 'offline',
    soc: 0,
    soh: 88.5,
    power: 0,
    voltage: 0,
    current: 0,
    temperature: 25.0,
    cycleCount: 680,
    efficiency: 93.2,
    dailyEnergy: 0,
    monthlyEnergy: 2050.3,
    alerts: 3,
  },
];

interface ComparisonMetric {
  id: string;
  label: string;
  format: (value: number) => string;
  icon: React.ElementType;
  highlight?: 'higher' | 'lower';
}

const metrics: ComparisonMetric[] = [
  { id: 'soc', label: 'SOC', format: (v) => formatPercent(v, 1), icon: Battery, highlight: 'higher' },
  { id: 'soh', label: 'SOH', format: (v) => formatPercent(v, 1), icon: Activity, highlight: 'higher' },
  { id: 'power', label: 'Potencia', format: (v) => formatPower(v), icon: Zap },
  { id: 'voltage', label: 'Tensao', format: (v) => formatVoltage(v), icon: Activity },
  { id: 'temperature', label: 'Temperatura', format: (v) => formatTemperature(v), icon: Thermometer, highlight: 'lower' },
  { id: 'cycleCount', label: 'Ciclos', format: (v) => v.toLocaleString('pt-BR'), icon: RefreshCw },
  { id: 'efficiency', label: 'Eficiencia', format: (v) => formatPercent(v, 1), icon: TrendingUp, highlight: 'higher' },
  { id: 'dailyEnergy', label: 'Energia Diaria', format: (v) => `${v.toFixed(1)} kWh`, icon: Zap, highlight: 'higher' },
  { id: 'monthlyEnergy', label: 'Energia Mensal', format: (v) => `${v.toFixed(1)} kWh`, icon: TrendingUp, highlight: 'higher' },
  { id: 'capacity', label: 'Capacidade', format: (v) => `${v} kWh`, icon: Battery },
  { id: 'alerts', label: 'Alertas Ativos', format: (v) => v.toString(), icon: AlertTriangle, highlight: 'lower' },
];

export default function SystemComparison() {
  const [availableSystems, setAvailableSystems] = useState<ComparisonSystem[]>(mockSystems);
  const [selectedSystems, setSelectedSystems] = useState<ComparisonSystem[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
      // Auto-select first 2 systems
      setSelectedSystems([mockSystems[0], mockSystems[1]]);
    }, 500);
  }, []);

  const addSystem = (system: ComparisonSystem) => {
    if (selectedSystems.length < 4 && !selectedSystems.find((s) => s.id === system.id)) {
      setSelectedSystems([...selectedSystems, system]);
    }
    setShowSelector(false);
  };

  const removeSystem = (systemId: string) => {
    setSelectedSystems(selectedSystems.filter((s) => s.id !== systemId));
  };

  const getMetricValue = (system: ComparisonSystem, metricId: string): number => {
    return (system as any)[metricId] as number;
  };

  const getBestValue = (metricId: string, highlight?: 'higher' | 'lower'): number | null => {
    if (!highlight || selectedSystems.length === 0) return null;
    const values = selectedSystems.map((s) => getMetricValue(s, metricId));
    return highlight === 'higher' ? Math.max(...values) : Math.min(...values);
  };

  if (isLoading) {
    return <ComparisonSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/systems"
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comparacao de Sistemas</h1>
            <p className="text-foreground-muted text-sm">
              Compare ate 4 sistemas lado a lado
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSelector(true)}
          disabled={selectedSystems.length >= 4}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Adicionar Sistema
        </button>
      </div>

      {/* Selected Systems Header */}
      {selectedSystems.length > 0 ? (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* System Headers */}
          <div className="grid grid-cols-[200px_repeat(4,1fr)] border-b border-border">
            <div className="p-4 bg-surface-hover">
              <span className="text-sm font-medium text-foreground-muted">Metrica</span>
            </div>
            {selectedSystems.map((system) => (
              <div key={system.id} className="p-4 border-l border-border relative group">
                <button
                  onClick={() => removeSystem(system.id)}
                  className="absolute top-2 right-2 p-1 hover:bg-danger-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4 text-danger-500" />
                </button>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      system.status === 'online' ? 'bg-primary/10' : 'bg-surface-hover'
                    )}
                  >
                    <Battery
                      className={cn(
                        'w-5 h-5',
                        system.status === 'online' ? 'text-primary' : 'text-foreground-muted'
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{system.name}</h3>
                    <p className="text-xs text-foreground-muted">{system.model}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          'px-2 py-0.5 text-2xs rounded-full',
                          system.status === 'online'
                            ? 'bg-success-500/20 text-success-500'
                            : 'bg-foreground-subtle/20 text-foreground-subtle'
                        )}
                      >
                        {system.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                      <span className="text-2xs text-foreground-muted">{system.chemistry}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: 4 - selectedSystems.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="p-4 border-l border-border flex items-center justify-center"
              >
                <button
                  onClick={() => setShowSelector(true)}
                  className="p-4 border-2 border-dashed border-border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <Plus className="w-6 h-6 text-foreground-muted" />
                </button>
              </div>
            ))}
          </div>

          {/* Metrics Rows */}
          {metrics.map((metric) => {
            const bestValue = getBestValue(metric.id, metric.highlight);

            return (
              <div
                key={metric.id}
                className="grid grid-cols-[200px_repeat(4,1fr)] border-b border-border last:border-b-0 hover:bg-surface-hover/50"
              >
                <div className="p-4 flex items-center gap-3">
                  <metric.icon className="w-4 h-4 text-foreground-muted" />
                  <span className="text-sm text-foreground">{metric.label}</span>
                </div>
                {selectedSystems.map((system) => {
                  const value = getMetricValue(system, metric.id);
                  const isBest = bestValue !== null && value === bestValue;

                  return (
                    <div key={system.id} className="p-4 border-l border-border">
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          isBest && 'text-success-500'
                        )}
                      >
                        <span className="text-lg font-semibold">
                          {metric.format(value)}
                        </span>
                        {isBest && <CheckCircle className="w-4 h-4" />}
                      </div>
                    </div>
                  );
                })}
                {/* Empty slots */}
                {Array.from({ length: 4 - selectedSystems.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-4 border-l border-border">
                    <span className="text-foreground-subtle">-</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Battery className="w-16 h-16 mx-auto mb-4 text-foreground-subtle" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum sistema selecionado
          </h3>
          <p className="text-foreground-muted mb-4">
            Adicione sistemas para comparar lado a lado
          </p>
          <button
            onClick={() => setShowSelector(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Sistema
          </button>
        </div>
      )}

      {/* Performance Summary */}
      {selectedSystems.length >= 2 && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="font-semibold text-foreground mb-4">Resumo da Comparacao</h3>
          <div className="grid lg:grid-cols-3 gap-4">
            <SummaryCard
              title="Melhor SOH"
              system={selectedSystems.reduce((best, s) => (s.soh > best.soh ? s : best))}
              value={formatPercent(Math.max(...selectedSystems.map((s) => s.soh)), 1)}
              icon={Activity}
              color="success"
            />
            <SummaryCard
              title="Maior Eficiencia"
              system={selectedSystems.reduce((best, s) =>
                s.efficiency > best.efficiency ? s : best
              )}
              value={formatPercent(Math.max(...selectedSystems.map((s) => s.efficiency)), 1)}
              icon={TrendingUp}
              color="primary"
            />
            <SummaryCard
              title="Maior Producao Mensal"
              system={selectedSystems.reduce((best, s) =>
                s.monthlyEnergy > best.monthlyEnergy ? s : best
              )}
              value={`${Math.max(...selectedSystems.map((s) => s.monthlyEnergy)).toFixed(0)} kWh`}
              icon={Zap}
              color="secondary"
            />
          </div>
        </div>
      )}

      {/* System Selector Modal */}
      {showSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-xl border border-border w-full max-w-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Selecionar Sistema</h3>
              <button
                onClick={() => setShowSelector(false)}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {availableSystems
                  .filter((s) => !selectedSystems.find((sel) => sel.id === s.id))
                  .map((system) => (
                    <button
                      key={system.id}
                      onClick={() => addSystem(system)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface-hover transition-all text-left"
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          system.status === 'online' ? 'bg-primary/10' : 'bg-surface-hover'
                        )}
                      >
                        <Battery
                          className={cn(
                            'w-5 h-5',
                            system.status === 'online' ? 'text-primary' : 'text-foreground-muted'
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{system.name}</h4>
                        <p className="text-sm text-foreground-muted">
                          {system.model} • {system.chemistry} • {system.capacity}kWh
                        </p>
                      </div>
                      <span
                        className={cn(
                          'px-2 py-1 text-xs rounded-full',
                          system.status === 'online'
                            ? 'bg-success-500/20 text-success-500'
                            : 'bg-foreground-subtle/20 text-foreground-subtle'
                        )}
                      >
                        {system.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </button>
                  ))}
              </div>
              {availableSystems.filter((s) => !selectedSystems.find((sel) => sel.id === s.id))
                .length === 0 && (
                <div className="text-center py-8 text-foreground-muted">
                  Todos os sistemas ja foram adicionados
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary Card
function SummaryCard({
  title,
  system,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  system: ComparisonSystem;
  value: string;
  icon: React.ElementType;
  color: 'success' | 'primary' | 'secondary';
}) {
  const colorClasses = {
    success: 'bg-success-500/10 text-success-500',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
  };

  return (
    <div className="p-4 bg-background rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-foreground-muted">{title}</span>
      </div>
      <p className={cn('text-2xl font-bold', colorClasses[color].split(' ')[1])}>{value}</p>
      <p className="text-sm text-foreground mt-1">{system.name}</p>
    </div>
  );
}

// Loading Skeleton
function ComparisonSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-8 w-64 bg-surface rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-border h-96 animate-pulse" />
    </div>
  );
}
