import { useState, useMemo } from 'react';
import {
  Calculator,
  Play,
  RotateCcw,
  Download,
  Save,
  TrendingUp,
  Battery,
  Zap,
  DollarSign,
  Clock,
  Sun,
  Sliders,
  ChevronRight,
  BarChart3,
  Target,
  AlertTriangle,
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
  ComposedChart,
  Bar,
} from 'recharts';

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed';
  createdAt: string;
}

interface SimulationParams {
  batteryCapacity: number;
  inverterPower: number;
  solarCapacity: number;
  avgConsumption: number;
  peakConsumption: number;
  tariffPeak: number;
  tariffOffPeak: number;
  tariffMidPeak: number;
  gridExportRate: number;
  chargingStrategy: 'solar' | 'offpeak' | 'optimal';
  dischargingStrategy: 'peak' | 'selfconsumption' | 'gridservices';
}

export default function Simulation() {
  const [activeTab, setActiveTab] = useState<'new' | 'saved' | 'compare'>('new');
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [params, setParams] = useState<SimulationParams>({
    batteryCapacity: 5000,
    inverterPower: 2500,
    solarCapacity: 8000,
    avgConsumption: 30,
    peakConsumption: 8,
    tariffPeak: 0.95,
    tariffOffPeak: 0.45,
    tariffMidPeak: 0.65,
    gridExportRate: 0.35,
    chargingStrategy: 'optimal',
    dischargingStrategy: 'peak',
  });

  const savedScenarios: SimulationScenario[] = useMemo(() => [
    { id: '1', name: 'Cenario Base 2025', description: 'Configuracao atual do sistema', status: 'completed', createdAt: '2025-01-20' },
    { id: '2', name: 'Expansao 10 MWh', description: 'Simulacao com bateria expandida', status: 'completed', createdAt: '2025-01-18' },
    { id: '3', name: 'Tarifa Branca', description: 'Analise com nova estrutura tarifaria', status: 'completed', createdAt: '2025-01-15' },
    { id: '4', name: 'Solar + Eolica', description: 'Integracao hibrida', status: 'draft', createdAt: '2025-01-22' },
  ], []);

  const simulationResults = useMemo(() => ({
    annualSavings: 125400,
    paybackYears: 4.2,
    roi: 23.8,
    selfConsumption: 87,
    gridIndependence: 72,
    peakReduction: 65,
    carbonOffset: 45.2,
    cyclesPerYear: 365,
    degradation: 2.1,
  }), []);

  const monthlyProjection = useMemo(() => [
    { month: 'Jan', economia: 8500, custoSem: 12000, custoCom: 3500 },
    { month: 'Fev', economia: 9200, custoSem: 12500, custoCom: 3300 },
    { month: 'Mar', economia: 10100, custoSem: 13200, custoCom: 3100 },
    { month: 'Abr', economia: 11500, custoSem: 14000, custoCom: 2500 },
    { month: 'Mai', economia: 12200, custoSem: 14500, custoCom: 2300 },
    { month: 'Jun', economia: 10800, custoSem: 13500, custoCom: 2700 },
    { month: 'Jul', economia: 9500, custoSem: 12800, custoCom: 3300 },
    { month: 'Ago', economia: 10200, custoSem: 13200, custoCom: 3000 },
    { month: 'Set', economia: 11800, custoSem: 14200, custoCom: 2400 },
    { month: 'Out', economia: 12500, custoSem: 15000, custoCom: 2500 },
    { month: 'Nov', economia: 11200, custoSem: 14000, custoCom: 2800 },
    { month: 'Dez', economia: 7900, custoSem: 11500, custoCom: 3600 },
  ], []);

  const hourlySimulation = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      solar: i >= 6 && i <= 18 ? Math.floor(Math.random() * 5 + (i > 10 && i < 15 ? 6 : 2)) : 0,
      consumo: Math.floor(Math.random() * 3 + (i >= 18 && i <= 22 ? 5 : 2)),
      bateria: i >= 18 && i <= 22 ? 3 : (i >= 10 && i <= 14 ? -2 : 0),
      soc: Math.min(100, Math.max(10, 50 + (i < 12 ? i * 4 : (24 - i) * 3))),
    }));
  }, []);

  const runSimulation = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setShowResults(true);
    }, 2500);
  };

  const resetSimulation = () => {
    setShowResults(false);
    setParams({
      batteryCapacity: 5000,
      inverterPower: 2500,
      solarCapacity: 8000,
      avgConsumption: 30,
      peakConsumption: 8,
      tariffPeak: 0.95,
      tariffOffPeak: 0.45,
      tariffMidPeak: 0.65,
      gridExportRate: 0.35,
      chargingStrategy: 'optimal',
      dischargingStrategy: 'peak',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulacao e Analise</h1>
          <p className="text-foreground-muted">Planejamento de cenarios e analise what-if</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <Save className="w-4 h-4" />
            Salvar Cenario
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'new'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Calculator className="w-4 h-4 inline mr-2" />
          Nova Simulacao
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'saved'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Save className="w-4 h-4 inline mr-2" />
          Cenarios Salvos
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'compare'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Comparar
        </button>
      </div>

      {/* New Simulation Tab */}
      {activeTab === 'new' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Parameters Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Battery className="w-5 h-5 text-primary" />
                Sistema de Armazenamento
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Capacidade da Bateria (kWh)</label>
                  <input
                    type="number"
                    value={params.batteryCapacity}
                    onChange={(e) => setParams({ ...params, batteryCapacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Potencia do Inversor (kW)</label>
                  <input
                    type="number"
                    value={params.inverterPower}
                    onChange={(e) => setParams({ ...params, inverterPower: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sun className="w-5 h-5 text-warning-500" />
                Geracao Solar
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Capacidade Solar (Wp)</label>
                  <input
                    type="number"
                    value={params.solarCapacity}
                    onChange={(e) => setParams({ ...params, solarCapacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-success-500" />
                Consumo
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Consumo Medio Diario (kWh)</label>
                  <input
                    type="number"
                    value={params.avgConsumption}
                    onChange={(e) => setParams({ ...params, avgConsumption: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Pico de Demanda (kW)</label>
                  <input
                    type="number"
                    value={params.peakConsumption}
                    onChange={(e) => setParams({ ...params, peakConsumption: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success-500" />
                Tarifas (R$/kWh)
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-foreground-muted mb-1">Ponta</label>
                    <input
                      type="number"
                      step="0.01"
                      value={params.tariffPeak}
                      onChange={(e) => setParams({ ...params, tariffPeak: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-muted mb-1">Intermed.</label>
                    <input
                      type="number"
                      step="0.01"
                      value={params.tariffMidPeak}
                      onChange={(e) => setParams({ ...params, tariffMidPeak: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-muted mb-1">Fora Ponta</label>
                    <input
                      type="number"
                      step="0.01"
                      value={params.tariffOffPeak}
                      onChange={(e) => setParams({ ...params, tariffOffPeak: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                Estrategias
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Estrategia de Carga</label>
                  <select
                    value={params.chargingStrategy}
                    onChange={(e) => setParams({ ...params, chargingStrategy: e.target.value as SimulationParams['chargingStrategy'] })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="solar">Priorizar Solar</option>
                    <option value="offpeak">Carregar Fora-Ponta</option>
                    <option value="optimal">Otimizado por Custo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Estrategia de Descarga</label>
                  <select
                    value={params.dischargingStrategy}
                    onChange={(e) => setParams({ ...params, dischargingStrategy: e.target.value as SimulationParams['dischargingStrategy'] })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="peak">Horario de Ponta</option>
                    <option value="selfconsumption">Auto-Consumo</option>
                    <option value="gridservices">Servicos de Rede</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={runSimulation}
                disabled={isRunning}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Simulando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Executar
                  </>
                )}
              </button>
              <button
                onClick={resetSimulation}
                className="px-4 py-3 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {showResults ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-success-500/20 to-success-500/5 rounded-xl p-4 border border-success-500/20">
                    <DollarSign className="w-6 h-6 text-success-500 mb-2" />
                    <p className="text-xs text-foreground-muted">Economia Anual</p>
                    <p className="text-xl font-bold text-success-500">
                      R$ {simulationResults.annualSavings.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-4 border border-primary/20">
                    <Clock className="w-6 h-6 text-primary mb-2" />
                    <p className="text-xs text-foreground-muted">Payback</p>
                    <p className="text-xl font-bold text-foreground">{simulationResults.paybackYears} anos</p>
                  </div>
                  <div className="bg-gradient-to-br from-warning-500/20 to-warning-500/5 rounded-xl p-4 border border-warning-500/20">
                    <TrendingUp className="w-6 h-6 text-warning-500 mb-2" />
                    <p className="text-xs text-foreground-muted">ROI</p>
                    <p className="text-xl font-bold text-foreground">{simulationResults.roi}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl p-4 border border-green-500/20">
                    <Target className="w-6 h-6 text-green-500 mb-2" />
                    <p className="text-xs text-foreground-muted">Autoconsumo</p>
                    <p className="text-xl font-bold text-foreground">{simulationResults.selfConsumption}%</p>
                  </div>
                </div>

                {/* Monthly Projection Chart */}
                <div className="bg-surface rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Projecao de Custos Mensais</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={monthlyProjection}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--surface))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                      />
                      <Bar dataKey="custoSem" name="Sem BESS" fill="#ef4444" fillOpacity={0.3} />
                      <Bar dataKey="custoCom" name="Com BESS" fill="#10b981" />
                      <Line type="monotone" dataKey="economia" name="Economia" stroke="#3b82f6" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Hourly Simulation */}
                <div className="bg-surface rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Simulacao de Dia Tipico</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={hourlySimulation}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--foreground-muted))', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--surface))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Area type="monotone" dataKey="solar" name="Solar" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="consumo" name="Consumo" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      <Line type="monotone" dataKey="soc" name="SOC (%)" stroke="#3b82f6" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Additional Metrics */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-surface rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Metricas Tecnicas</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Independencia da Rede</span>
                        <span className="font-semibold text-foreground">{simulationResults.gridIndependence}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Reducao de Pico</span>
                        <span className="font-semibold text-foreground">{simulationResults.peakReduction}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Ciclos por Ano</span>
                        <span className="font-semibold text-foreground">{simulationResults.cyclesPerYear}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Degradacao Anual Est.</span>
                        <span className="font-semibold text-foreground">{simulationResults.degradation}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Impacto Ambiental</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">CO2 Evitado (ton/ano)</span>
                        <span className="font-semibold text-success-500">{simulationResults.carbonOffset}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Equiv. Arvores Plantadas</span>
                        <span className="font-semibold text-foreground">{Math.floor(simulationResults.carbonOffset * 45)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Km de Carro Evitados</span>
                        <span className="font-semibold text-foreground">{Math.floor(simulationResults.carbonOffset * 4500).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 bg-surface rounded-xl border border-border">
                <Calculator className="w-16 h-16 text-foreground-muted mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Configure os Parametros</h3>
                <p className="text-foreground-muted text-center max-w-md">
                  Ajuste os parametros do sistema no painel lateral e clique em "Executar" para ver os resultados da simulacao.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Scenarios Tab */}
      {activeTab === 'saved' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedScenarios.map((scenario) => (
            <div key={scenario.id} className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">{scenario.name}</h3>
                {scenario.status === 'completed' ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Concluido</span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Rascunho</span>
                )}
              </div>
              <p className="text-sm text-foreground-muted mb-3">{scenario.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">
                  {new Date(scenario.createdAt).toLocaleDateString('pt-BR')}
                </span>
                <button className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Abrir <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === 'compare' && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Comparar Cenarios</h3>
              <p className="text-foreground-muted">Selecione dois ou mais cenarios salvos para comparar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
