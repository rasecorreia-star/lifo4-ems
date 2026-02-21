import { useState, useMemo } from 'react';
import {
  Leaf,
  TreePine,
  Wind,
  Droplets,
  Sun,
  TrendingDown,
  TrendingUp,
  Calendar,
  Download,
  Award,
  Target,
  Globe,
  Factory,
  Car,
  Home,
  Zap,
  BarChart3,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface CarbonData {
  month: string;
  gridEmissions: number;
  avoided: number;
  solarOffset: number;
  batteryOffset: number;
}

interface EquivalentMetric {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  color: string;
}

interface CertificateData {
  id: string;
  period: string;
  co2Avoided: number;
  status: 'issued' | 'pending' | 'expired';
  downloadUrl: string;
}

// Brazilian grid emission factor (kg CO2/kWh) - average
const GRID_EMISSION_FACTOR = 0.075; // Brazil has relatively clean grid due to hydro

const generateMonthlyCarbon = (): CarbonData[] => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months.map((month, index) => {
    const summer = index < 3 || index > 9;
    const baseGridConsumption = 8000 + (summer ? 2000 : 0) + Math.random() * 1000;
    const solarGeneration = 6000 + (summer ? 2000 : -1000) + Math.random() * 500;
    const batteryOptimization = 1500 + Math.random() * 500;

    const gridEmissions = baseGridConsumption * GRID_EMISSION_FACTOR;
    const solarOffset = solarGeneration * GRID_EMISSION_FACTOR;
    const batteryOffset = batteryOptimization * GRID_EMISSION_FACTOR;
    const avoided = solarOffset + batteryOffset;

    return {
      month,
      gridEmissions: Math.round(gridEmissions),
      avoided: Math.round(avoided),
      solarOffset: Math.round(solarOffset),
      batteryOffset: Math.round(batteryOffset),
    };
  });
};

const energySourceBreakdown = [
  { name: 'Solar', value: 45, color: '#eab308' },
  { name: 'Bateria', value: 25, color: '#22c55e' },
  { name: 'Rede (Hidro)', value: 20, color: '#3b82f6' },
  { name: 'Rede (Termica)', value: 10, color: '#6b7280' },
];

const certificates: CertificateData[] = [
  { id: 'CERT-2026-01', period: 'Janeiro 2026', co2Avoided: 892, status: 'issued', downloadUrl: '#' },
  { id: 'CERT-2025-12', period: 'Dezembro 2025', co2Avoided: 756, status: 'issued', downloadUrl: '#' },
  { id: 'CERT-2025-11', period: 'Novembro 2025', co2Avoided: 823, status: 'issued', downloadUrl: '#' },
  { id: 'CERT-2025-10', period: 'Outubro 2025', co2Avoided: 912, status: 'issued', downloadUrl: '#' },
];

export default function CarbonFootprint() {
  const [selectedYear, setSelectedYear] = useState('2025');

  const carbonData = useMemo(() => generateMonthlyCarbon(), []);

  // Calculate totals
  const totals = useMemo(() => {
    const totalAvoided = carbonData.reduce((sum, d) => sum + d.avoided, 0);
    const totalSolar = carbonData.reduce((sum, d) => sum + d.solarOffset, 0);
    const totalBattery = carbonData.reduce((sum, d) => sum + d.batteryOffset, 0);
    const totalGrid = carbonData.reduce((sum, d) => sum + d.gridEmissions, 0);

    // Equivalencies calculations
    const treesEquivalent = Math.round(totalAvoided / 22); // 22kg CO2 per tree per year
    const carsEquivalent = Math.round(totalAvoided / 4600); // 4600kg CO2 per car per year
    const flightsEquivalent = Math.round(totalAvoided / 90); // 90kg CO2 per flight hour
    const homesEquivalent = Math.round(totalAvoided / 2000); // 2000kg CO2 per home per year

    return {
      totalAvoided: Math.round(totalAvoided),
      totalSolar,
      totalBattery,
      totalGrid,
      reductionPercent: Math.round((totalAvoided / (totalGrid + totalAvoided)) * 100),
      treesEquivalent,
      carsEquivalent,
      flightsEquivalent,
      homesEquivalent,
    };
  }, [carbonData]);

  const equivalentMetrics: EquivalentMetric[] = [
    { icon: TreePine, label: 'Arvores Plantadas', value: totals.treesEquivalent, unit: 'arvores/ano', color: 'text-success-500' },
    { icon: Car, label: 'Carros Retirados', value: totals.carsEquivalent, unit: 'veiculos', color: 'text-primary' },
    { icon: Home, label: 'Casas Alimentadas', value: totals.homesEquivalent, unit: 'residencias', color: 'text-warning-500' },
    { icon: Wind, label: 'Horas de Voo', value: totals.flightsEquivalent, unit: 'horas evitadas', color: 'text-foreground-muted' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pegada de Carbono</h1>
          <p className="text-foreground-muted mt-1">
            Impacto ambiental e emissoes evitadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors">
            <Download className="w-4 h-4" />
            Relatorio ESG
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-success-500/20 to-success-500/5 border border-success-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <Leaf className="w-8 h-8 text-success-500" />
            <span className="px-2 py-1 bg-success-500/20 text-success-500 rounded-full text-xs font-medium">
              Ano
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {(totals.totalAvoided / 1000).toFixed(1)} t
          </div>
          <p className="text-sm text-foreground-muted mt-1">CO2 Evitado</p>
          <div className="flex items-center gap-1 text-xs text-success-500 mt-2">
            <TrendingUp className="w-3 h-3" />
            <span>+18% vs ano anterior</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <Sun className="w-8 h-8 text-warning-500" />
            <span className="px-2 py-1 bg-warning-500/20 text-warning-500 rounded-full text-xs font-medium">
              Solar
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {(totals.totalSolar / 1000).toFixed(1)} t
          </div>
          <p className="text-sm text-foreground-muted mt-1">Offset Solar</p>
          <div className="text-xs text-foreground-muted mt-2">
            {Math.round((totals.totalSolar / totals.totalAvoided) * 100)}% do total evitado
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <Zap className="w-8 h-8 text-primary" />
            <span className="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
              Bateria
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {(totals.totalBattery / 1000).toFixed(1)} t
          </div>
          <p className="text-sm text-foreground-muted mt-1">Offset Bateria</p>
          <div className="text-xs text-foreground-muted mt-2">
            Otimizacao de pico
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <Target className="w-8 h-8 text-success-500" />
            <span className="px-2 py-1 bg-success-500/20 text-success-500 rounded-full text-xs font-medium">
              Meta
            </span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {totals.reductionPercent}%
          </div>
          <p className="text-sm text-foreground-muted mt-1">Reducao Emissoes</p>
          <div className="text-xs text-success-500 mt-2">
            Meta 2026: 50% (atingida!)
          </div>
        </div>
      </div>

      {/* Equivalencies */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Equivalencias Ambientais</h2>
        <p className="text-sm text-foreground-muted mb-6">
          O CO2 evitado pelo seu sistema BESS equivale a:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {equivalentMetrics.map((metric) => (
            <div key={metric.label} className="text-center p-4 bg-surface-hover rounded-xl">
              <metric.icon className={cn('w-10 h-10 mx-auto mb-3', metric.color)} />
              <div className="text-2xl font-bold text-foreground">{metric.value.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-foreground-muted mt-1">{metric.unit}</p>
              <p className="text-sm font-medium text-foreground mt-2">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Emissions Chart */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Emissoes Mensais</h2>
              <p className="text-sm text-foreground-muted">CO2 da rede vs evitado</p>
            </div>
            <Calendar className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={carbonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
                <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kg" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString('pt-BR')} kg CO2`, '']}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="gridEmissions"
                  name="Emissoes Rede"
                  fill="#6b7280"
                  fillOpacity={0.3}
                  stroke="#6b7280"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="avoided"
                  name="CO2 Evitado"
                  fill="#22c55e"
                  fillOpacity={0.3}
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Source Breakdown */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Mix Energetico</h2>
              <p className="text-sm text-foreground-muted">Fontes de energia utilizadas</p>
            </div>
            <Globe className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="h-72 flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie
                  data={energySourceBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {energySourceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {energySourceBreakdown.map((source) => (
                <div key={source.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: source.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{source.name}</span>
                      <span className="text-sm font-medium text-foreground">{source.value}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-hover rounded-full mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${source.value}%`, backgroundColor: source.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Carbon Offset Breakdown */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Composicao do Offset</h2>
            <p className="text-sm text-foreground-muted">Solar vs Bateria por mes</p>
          </div>
          <BarChart3 className="w-5 h-5 text-foreground-muted" />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={carbonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--foreground-muted)" fontSize={12} />
              <YAxis stroke="var(--foreground-muted)" fontSize={12} unit=" kg" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value.toLocaleString('pt-BR')} kg CO2`, '']}
              />
              <Legend />
              <Bar dataKey="solarOffset" name="Offset Solar" stackId="a" fill="#eab308" />
              <Bar dataKey="batteryOffset" name="Offset Bateria" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Certificates & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carbon Certificates */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Certificados de Carbono</h2>
              <p className="text-sm text-foreground-muted">Documentacao de offset</p>
            </div>
            <Award className="w-5 h-5 text-warning-500" />
          </div>
          <div className="space-y-3">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between p-4 bg-surface-hover rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-success-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{cert.period}</p>
                    <p className="text-sm text-foreground-muted">{cert.co2Avoided} kg CO2 evitado</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    cert.status === 'issued' && 'bg-success-500/20 text-success-500',
                    cert.status === 'pending' && 'bg-warning-500/20 text-warning-500',
                    cert.status === 'expired' && 'bg-foreground-muted/20 text-foreground-muted'
                  )}>
                    {cert.status === 'issued' ? 'Emitido' : cert.status === 'pending' ? 'Pendente' : 'Expirado'}
                  </span>
                  <button className="p-2 hover:bg-surface rounded-lg transition-colors">
                    <Download className="w-4 h-4 text-foreground-muted" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sustainability Goals */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Metas de Sustentabilidade</h2>
              <p className="text-sm text-foreground-muted">Progresso ESG 2026</p>
            </div>
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Reducao de Emissoes</span>
                <span className="text-sm text-success-500 font-medium">52% / 50%</span>
              </div>
              <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-success-500" style={{ width: '100%' }} />
              </div>
              <p className="text-xs text-success-500 mt-1">Meta atingida!</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Energia Renovavel</span>
                <span className="text-sm text-foreground font-medium">70% / 80%</span>
              </div>
              <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '87.5%' }} />
              </div>
              <p className="text-xs text-foreground-muted mt-1">10% restante</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Autoconsumo Solar</span>
                <span className="text-sm text-foreground font-medium">85% / 90%</span>
              </div>
              <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-warning-500" style={{ width: '94.4%' }} />
              </div>
              <p className="text-xs text-foreground-muted mt-1">5% restante</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Eficiencia Energetica</span>
                <span className="text-sm text-foreground font-medium">92% / 95%</span>
              </div>
              <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-success-500" style={{ width: '96.8%' }} />
              </div>
              <p className="text-xs text-foreground-muted mt-1">3% restante</p>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="bg-gradient-to-r from-success-500/10 to-primary/10 border border-success-500/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-success-500/20 flex items-center justify-center flex-shrink-0">
            <Globe className="w-6 h-6 text-success-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Impacto Ambiental Positivo</h3>
            <p className="text-foreground-muted mt-2">
              Seu sistema BESS contribuiu significativamente para a reducao de emissoes de gases de efeito estufa.
              No ultimo ano, voce evitou a emissao de <span className="font-semibold text-success-500">{(totals.totalAvoided / 1000).toFixed(1)} toneladas de CO2</span>,
              equivalente a plantar <span className="font-semibold text-success-500">{totals.treesEquivalent.toLocaleString('pt-BR')} arvores</span> ou
              retirar <span className="font-semibold text-success-500">{totals.carsEquivalent} carros</span> das ruas por um ano.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <button className="px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors text-sm font-medium">
                Compartilhar Resultados
              </button>
              <button className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors text-sm font-medium">
                Ver Metodologia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
