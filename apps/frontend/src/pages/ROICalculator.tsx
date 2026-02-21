/**
 * ROICalculator
 * TODO: [FASE 1] This page exists but is not routed in App.tsx.
 * Decision pending: Add route, keep for future use, or remove.
 * Created: 2026-02-21
 */
import { useState, useMemo } from 'react';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Battery,
  Zap,
  Save,
  Download,
  RefreshCw,
  Info,
  BarChart3,
  PieChart,
  Calendar,
  Target,
  Percent,
  Clock,
} from 'lucide-react';

interface CalculationResult {
  totalInvestment: number;
  annualSavings: number;
  paybackPeriod: number;
  roi10Years: number;
  roi20Years: number;
  npv10Years: number;
  npv20Years: number;
  irr: number;
  lcoe: number;
  annualRevenue: number;
  lifetimeSavings: number;
}

interface SavedScenario {
  id: string;
  name: string;
  date: string;
  inputs: typeof defaultInputs;
  result: CalculationResult;
}

const defaultInputs = {
  // System Configuration
  systemCapacity: 1000, // kWh
  powerRating: 500, // kW
  roundTripEfficiency: 90, // %
  systemLifetime: 20, // years
  degradationRate: 2, // % per year

  // Investment Costs
  batteryCapitalCost: 350, // $/kWh
  pcsCapitalCost: 150, // $/kW
  installationCost: 50000, // $
  engineeringCost: 30000, // $
  permittingCost: 15000, // $

  // Operational Costs
  annualOMCost: 15000, // $/year
  insuranceCost: 5000, // $/year
  landLeaseCost: 0, // $/year
  replacementReserve: 10000, // $/year

  // Revenue/Savings
  peakShavingSavings: 80000, // $/year
  arbitrageRevenue: 45000, // $/year
  demandResponseRevenue: 25000, // $/year
  capacityPayments: 15000, // $/year
  ancillaryServices: 10000, // $/year

  // Financial Parameters
  discountRate: 8, // %
  inflationRate: 3, // %
  electricityPriceEscalation: 4, // %
  taxRate: 25, // %
  investmentTaxCredit: 30, // %
  depreciationYears: 7, // MACRS years
};

export default function ROICalculator() {
  const [inputs, setInputs] = useState(defaultInputs);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([
    {
      id: '1',
      name: 'Cenario Comercial Padrao',
      date: '2025-01-15',
      inputs: { ...defaultInputs },
      result: {
        totalInvestment: 495000,
        annualSavings: 175000,
        paybackPeriod: 2.83,
        roi10Years: 253.5,
        roi20Years: 607.1,
        npv10Years: 678500,
        npv20Years: 1850000,
        irr: 35.2,
        lcoe: 0.085,
        annualRevenue: 175000,
        lifetimeSavings: 3500000,
      },
    },
    {
      id: '2',
      name: 'Cenario Industrial',
      date: '2025-01-10',
      inputs: { ...defaultInputs, systemCapacity: 5000, powerRating: 2500 },
      result: {
        totalInvestment: 2225000,
        annualSavings: 750000,
        paybackPeriod: 2.97,
        roi10Years: 237.1,
        roi20Years: 574.2,
        npv10Years: 2850000,
        npv20Years: 7750000,
        irr: 33.6,
        lcoe: 0.078,
        annualRevenue: 750000,
        lifetimeSavings: 15000000,
      },
    },
  ]);
  const [activeTab, setActiveTab] = useState<'calculator' | 'scenarios' | 'comparison'>('calculator');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');

  const calculation = useMemo<CalculationResult>(() => {
    // Total Investment
    const batteryCost = inputs.systemCapacity * inputs.batteryCapitalCost;
    const pcsCost = inputs.powerRating * inputs.pcsCapitalCost;
    const totalInvestment = batteryCost + pcsCost + inputs.installationCost +
                           inputs.engineeringCost + inputs.permittingCost;

    // Tax Credit
    const taxCredit = totalInvestment * (inputs.investmentTaxCredit / 100);
    const netInvestment = totalInvestment - taxCredit;

    // Annual Costs
    const annualCosts = inputs.annualOMCost + inputs.insuranceCost +
                       inputs.landLeaseCost + inputs.replacementReserve;

    // Annual Revenue
    const annualRevenue = inputs.peakShavingSavings + inputs.arbitrageRevenue +
                         inputs.demandResponseRevenue + inputs.capacityPayments +
                         inputs.ancillaryServices;

    // Annual Net Savings
    const annualSavings = annualRevenue - annualCosts;

    // Simple Payback
    const paybackPeriod = netInvestment / annualSavings;

    // NPV and ROI calculations
    let npv10Years = -netInvestment;
    let npv20Years = -netInvestment;
    let cashFlows: number[] = [-netInvestment];

    for (let year = 1; year <= 20; year++) {
      const degradationFactor = Math.pow(1 - inputs.degradationRate / 100, year - 1);
      const revenueEscalation = Math.pow(1 + inputs.electricityPriceEscalation / 100, year - 1);
      const costInflation = Math.pow(1 + inputs.inflationRate / 100, year - 1);

      const yearRevenue = annualRevenue * degradationFactor * revenueEscalation;
      const yearCosts = annualCosts * costInflation;
      const yearNetCashFlow = yearRevenue - yearCosts;

      cashFlows.push(yearNetCashFlow);

      const discountFactor = Math.pow(1 + inputs.discountRate / 100, year);

      if (year <= 10) {
        npv10Years += yearNetCashFlow / discountFactor;
      }
      npv20Years += yearNetCashFlow / discountFactor;
    }

    // ROI
    const roi10Years = ((npv10Years + netInvestment) / netInvestment) * 100;
    const roi20Years = ((npv20Years + netInvestment) / netInvestment) * 100;

    // IRR calculation (simplified Newton-Raphson)
    let irr = 0.1;
    for (let i = 0; i < 100; i++) {
      let npvIrr = 0;
      let npvDerivative = 0;
      for (let t = 0; t < cashFlows.length; t++) {
        npvIrr += cashFlows[t] / Math.pow(1 + irr, t);
        if (t > 0) {
          npvDerivative -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
        }
      }
      if (Math.abs(npvDerivative) < 0.0001) break;
      irr = irr - npvIrr / npvDerivative;
    }

    // LCOE (Levelized Cost of Energy)
    const totalLifetimeEnergy = inputs.systemCapacity * 365 * 0.8 * inputs.systemLifetime; // kWh
    const lcoe = (totalInvestment + annualCosts * inputs.systemLifetime) / totalLifetimeEnergy;

    // Lifetime Savings
    const lifetimeSavings = annualSavings * inputs.systemLifetime;

    return {
      totalInvestment,
      annualSavings,
      paybackPeriod,
      roi10Years,
      roi20Years,
      npv10Years,
      npv20Years,
      irr: irr * 100,
      lcoe,
      annualRevenue,
      lifetimeSavings,
    };
  }, [inputs]);

  const handleInputChange = (key: keyof typeof inputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return;

    const newScenario: SavedScenario = {
      id: Date.now().toString(),
      name: scenarioName,
      date: new Date().toISOString().split('T')[0],
      inputs: { ...inputs },
      result: { ...calculation },
    };

    setSavedScenarios((prev) => [...prev, newScenario]);
    setScenarioName('');
    setShowSaveModal(false);
  };

  const handleLoadScenario = (scenario: SavedScenario) => {
    setInputs(scenario.inputs);
    setActiveTab('calculator');
  };

  const handleReset = () => {
    setInputs(defaultInputs);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const InputField = ({
    label,
    value,
    onChange,
    unit,
    info,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    unit: string;
    info?: string;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label className="text-xs text-foreground-muted">{label}</label>
        {info && (
          <div className="group relative">
            <Info className="w-3 h-3 text-foreground-muted cursor-help" />
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-surface-elevated rounded-lg shadow-lg text-xs z-10">
              {info}
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">
          {unit}
        </span>
      </div>
    </div>
  );

  const ResultCard = ({
    icon: Icon,
    label,
    value,
    subValue,
    color,
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    color: string;
  }) => (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-foreground-muted">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
          {subValue && <p className="text-xs text-foreground-muted">{subValue}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-success-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calculadora ROI</h1>
            <p className="text-foreground-muted">Analise o retorno do investimento em sistemas BESS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Resetar
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Save className="w-4 h-4" />
            Salvar Cenario
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {[
          { id: 'calculator', label: 'Calculadora', icon: Calculator },
          { id: 'scenarios', label: 'Cenarios Salvos', icon: Save },
          { id: 'comparison', label: 'Comparacao', icon: BarChart3 },
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

      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Sections */}
          <div className="lg:col-span-2 space-y-6">
            {/* System Configuration */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Battery className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Configuracao do Sistema</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InputField
                  label="Capacidade"
                  value={inputs.systemCapacity}
                  onChange={(v) => handleInputChange('systemCapacity', v)}
                  unit="kWh"
                  info="Capacidade total de armazenamento do sistema"
                />
                <InputField
                  label="Potencia"
                  value={inputs.powerRating}
                  onChange={(v) => handleInputChange('powerRating', v)}
                  unit="kW"
                  info="Potencia maxima de carga/descarga"
                />
                <InputField
                  label="Eficiencia Round-Trip"
                  value={inputs.roundTripEfficiency}
                  onChange={(v) => handleInputChange('roundTripEfficiency', v)}
                  unit="%"
                  info="Eficiencia de um ciclo completo de carga/descarga"
                />
                <InputField
                  label="Vida Util"
                  value={inputs.systemLifetime}
                  onChange={(v) => handleInputChange('systemLifetime', v)}
                  unit="anos"
                />
                <InputField
                  label="Degradacao Anual"
                  value={inputs.degradationRate}
                  onChange={(v) => handleInputChange('degradationRate', v)}
                  unit="%"
                  info="Perda de capacidade por ano"
                />
              </div>
            </div>

            {/* Investment Costs */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-warning-500" />
                <h2 className="text-lg font-semibold text-foreground">Custos de Investimento</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InputField
                  label="Custo Bateria"
                  value={inputs.batteryCapitalCost}
                  onChange={(v) => handleInputChange('batteryCapitalCost', v)}
                  unit="$/kWh"
                />
                <InputField
                  label="Custo PCS"
                  value={inputs.pcsCapitalCost}
                  onChange={(v) => handleInputChange('pcsCapitalCost', v)}
                  unit="$/kW"
                  info="Power Conversion System"
                />
                <InputField
                  label="Instalacao"
                  value={inputs.installationCost}
                  onChange={(v) => handleInputChange('installationCost', v)}
                  unit="$"
                />
                <InputField
                  label="Engenharia"
                  value={inputs.engineeringCost}
                  onChange={(v) => handleInputChange('engineeringCost', v)}
                  unit="$"
                />
                <InputField
                  label="Licenciamento"
                  value={inputs.permittingCost}
                  onChange={(v) => handleInputChange('permittingCost', v)}
                  unit="$"
                />
              </div>
            </div>

            {/* Operational Costs */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-danger-500" />
                <h2 className="text-lg font-semibold text-foreground">Custos Operacionais</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField
                  label="O&M Anual"
                  value={inputs.annualOMCost}
                  onChange={(v) => handleInputChange('annualOMCost', v)}
                  unit="$/ano"
                />
                <InputField
                  label="Seguro"
                  value={inputs.insuranceCost}
                  onChange={(v) => handleInputChange('insuranceCost', v)}
                  unit="$/ano"
                />
                <InputField
                  label="Aluguel Terreno"
                  value={inputs.landLeaseCost}
                  onChange={(v) => handleInputChange('landLeaseCost', v)}
                  unit="$/ano"
                />
                <InputField
                  label="Reserva Reposicao"
                  value={inputs.replacementReserve}
                  onChange={(v) => handleInputChange('replacementReserve', v)}
                  unit="$/ano"
                />
              </div>
            </div>

            {/* Revenue/Savings */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-success-500" />
                <h2 className="text-lg font-semibold text-foreground">Receitas e Economias</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InputField
                  label="Peak Shaving"
                  value={inputs.peakShavingSavings}
                  onChange={(v) => handleInputChange('peakShavingSavings', v)}
                  unit="$/ano"
                  info="Economia com reducao de demanda de pico"
                />
                <InputField
                  label="Arbitragem"
                  value={inputs.arbitrageRevenue}
                  onChange={(v) => handleInputChange('arbitrageRevenue', v)}
                  unit="$/ano"
                  info="Receita com diferenca de precos"
                />
                <InputField
                  label="Resp. Demanda"
                  value={inputs.demandResponseRevenue}
                  onChange={(v) => handleInputChange('demandResponseRevenue', v)}
                  unit="$/ano"
                />
                <InputField
                  label="Capacidade"
                  value={inputs.capacityPayments}
                  onChange={(v) => handleInputChange('capacityPayments', v)}
                  unit="$/ano"
                />
                <InputField
                  label="Serv. Ancilares"
                  value={inputs.ancillaryServices}
                  onChange={(v) => handleInputChange('ancillaryServices', v)}
                  unit="$/ano"
                />
              </div>
            </div>

            {/* Financial Parameters */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Parametros Financeiros</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField
                  label="Taxa de Desconto"
                  value={inputs.discountRate}
                  onChange={(v) => handleInputChange('discountRate', v)}
                  unit="%"
                />
                <InputField
                  label="Inflacao"
                  value={inputs.inflationRate}
                  onChange={(v) => handleInputChange('inflationRate', v)}
                  unit="%"
                />
                <InputField
                  label="Esc. Preco Energia"
                  value={inputs.electricityPriceEscalation}
                  onChange={(v) => handleInputChange('electricityPriceEscalation', v)}
                  unit="%"
                />
                <InputField
                  label="Credito Fiscal"
                  value={inputs.investmentTaxCredit}
                  onChange={(v) => handleInputChange('investmentTaxCredit', v)}
                  unit="%"
                />
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-xl p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Resultados</h2>

              <div className="space-y-4">
                <ResultCard
                  icon={DollarSign}
                  label="Investimento Total"
                  value={formatCurrency(calculation.totalInvestment)}
                  subValue={`Liquido: ${formatCurrency(calculation.totalInvestment * (1 - inputs.investmentTaxCredit / 100))}`}
                  color="bg-warning-500/20 text-warning-500"
                />

                <ResultCard
                  icon={TrendingUp}
                  label="Economia Anual"
                  value={formatCurrency(calculation.annualSavings)}
                  subValue={`Receita: ${formatCurrency(calculation.annualRevenue)}`}
                  color="bg-success-500/20 text-success-500"
                />

                <ResultCard
                  icon={Clock}
                  label="Payback Simples"
                  value={`${calculation.paybackPeriod.toFixed(1)} anos`}
                  color="bg-primary/20 text-primary"
                />

                <ResultCard
                  icon={Target}
                  label="ROI (10 anos)"
                  value={formatPercent(calculation.roi10Years)}
                  subValue={`20 anos: ${formatPercent(calculation.roi20Years)}`}
                  color="bg-primary/20 text-primary"
                />

                <ResultCard
                  icon={BarChart3}
                  label="VPL (10 anos)"
                  value={formatCurrency(calculation.npv10Years)}
                  subValue={`20 anos: ${formatCurrency(calculation.npv20Years)}`}
                  color="bg-success-500/20 text-success-500"
                />

                <ResultCard
                  icon={Percent}
                  label="TIR"
                  value={formatPercent(calculation.irr)}
                  color="bg-primary/20 text-primary"
                />

                <ResultCard
                  icon={Zap}
                  label="LCOE"
                  value={`$${calculation.lcoe.toFixed(3)}/kWh`}
                  color="bg-warning-500/20 text-warning-500"
                />

                <ResultCard
                  icon={Calendar}
                  label="Economia Total (Vida Util)"
                  value={formatCurrency(calculation.lifetimeSavings)}
                  color="bg-success-500/20 text-success-500"
                />
              </div>

              <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors">
                <Download className="w-4 h-4" />
                Exportar Relatorio
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          {savedScenarios.length === 0 ? (
            <div className="text-center py-12">
              <Save className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <p className="text-foreground-muted">Nenhum cenario salvo</p>
            </div>
          ) : (
            savedScenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="bg-surface border border-border rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{scenario.name}</h3>
                    <p className="text-sm text-foreground-muted">Salvo em {scenario.date}</p>
                  </div>
                  <button
                    onClick={() => handleLoadScenario(scenario)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
                  >
                    Carregar
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted">Capacidade</p>
                    <p className="font-medium text-foreground">{scenario.inputs.systemCapacity} kWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Investimento</p>
                    <p className="font-medium text-foreground">{formatCurrency(scenario.result.totalInvestment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Payback</p>
                    <p className="font-medium text-foreground">{scenario.result.paybackPeriod.toFixed(1)} anos</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">ROI 10 anos</p>
                    <p className="font-medium text-success-500">{formatPercent(scenario.result.roi10Years)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Comparacao de Cenarios</h2>

          {savedScenarios.length < 2 ? (
            <div className="text-center py-12">
              <PieChart className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <p className="text-foreground-muted">Salve pelo menos 2 cenarios para comparar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Metrica</th>
                    {savedScenarios.map((s) => (
                      <th key={s.id} className="text-right py-3 px-4 text-sm font-medium text-foreground">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">Capacidade</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-foreground">
                        {s.inputs.systemCapacity} kWh
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">Investimento Total</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-foreground">
                        {formatCurrency(s.result.totalInvestment)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">Economia Anual</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-success-500">
                        {formatCurrency(s.result.annualSavings)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">Payback</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-foreground">
                        {s.result.paybackPeriod.toFixed(1)} anos
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">ROI 10 anos</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-success-500">
                        {formatPercent(s.result.roi10Years)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">VPL 10 anos</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-foreground">
                        {formatCurrency(s.result.npv10Years)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-sm text-foreground-muted">TIR</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-foreground">
                        {formatPercent(s.result.irr)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-foreground-muted">LCOE</td>
                    {savedScenarios.map((s) => (
                      <td key={s.id} className="text-right py-3 px-4 text-sm text-foreground">
                        ${s.result.lcoe.toFixed(3)}/kWh
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Salvar Cenario</h3>

            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Nome do cenario..."
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
            />

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveScenario}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
