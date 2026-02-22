import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  DollarSign,
  FileText,
  BarChart3,
  Shield,
} from 'lucide-react';
import {
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
} from 'recharts';
import { buildApiUrl } from '../services/config';

// --- Types ---

interface ROIData {
  systemId: string;
  currentMonthSavingBrl: number;
  roiAccumulatedPercent: number;
  paybackRemainingMonths: number;
  investmentCostBrl: number;
  breakdown: {
    peakShaving: number;
    arbitrage: number;
    gridServices: number;
    taxSaving: number;
    chargingCost: number;
  };
}

interface TaxOptData {
  regime: string;
  depreciationRatePercent: number;
  monthlyDepreciationBrl: number;
  taxSavingBrl: number;
  legalBasis: string[];
  recommendations: string[];
}

// --- Mock data (fallback when backend is unavailable) ---

const MOCK_ROI: ROIData = {
  systemId: 'demo-system-001',
  currentMonthSavingBrl: 10542.80,
  roiAccumulatedPercent: 24.5,
  paybackRemainingMonths: 22,
  investmentCostBrl: 350000,
  breakdown: {
    peakShaving: 6800,
    arbitrage: 3420,
    gridServices: 980,
    taxSaving: 1987,
    chargingCost: -2644.20,
  },
};

const MOCK_TAX: TaxOptData = {
  regime: 'INTENSIVO',
  depreciationRatePercent: 20,
  monthlyDepreciationBrl: 5833.33,
  taxSavingBrl: 1983.33,
  legalBasis: [
    'Lei 12.973/2014, art. 57 par.1 (regime intensivo: taxa 2x padrao)',
    'IN RFB 1.700/2017, art. 173 (vida util por regime)',
    'Decreto 9.580/2018, art. 326 (regulamento IR)',
    'Parecer Normativo COSIT 1/2017 (bens com desgaste acelerado)',
  ],
  recommendations: [
    'Sistema classificado como regime INTENSIVO (1.5 ciclos/dia, DoD medio 65%)',
    'Depreciacao acelerada de 20% a.a. aplicavel (Lei 12.973/2014)',
    'Economia tributaria estimada: R$ 1.983,33/mes',
    'Para upgrade para SEVERO: habilitar regulacao de frequencia ONS',
  ],
};

// --- Sub-components ---

function KPICard({
  icon,
  label,
  value,
  sublabel,
  trend,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  trend: string;
  positive: boolean;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-gray-800 rounded-lg">{icon}</div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            positive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}
        >
          {trend}
        </span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sublabel}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

// --- Main Component ---

export default function FinancialDashboard() {
  const { systemId = 'demo-system-001' } = useParams<{ systemId: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');

  const { data: roiData } = useQuery<{ data: ROIData }>({
    queryKey: ['roi', systemId],
    queryFn: () =>
      fetch(buildApiUrl(`/api/v1/financial/\/roi`))
        .then((r) => r.json())
        .catch(() => ({ data: MOCK_ROI })),
    initialData: { data: MOCK_ROI },
  });

  const { data: taxData } = useQuery<{ data: TaxOptData }>({
    queryKey: ['taxOptimization', systemId],
    queryFn: () =>
      fetch(buildApiUrl(`/api/v1/financial/\/tax/optimization`))
        .then((r) => r.json())
        .catch(() => ({ data: MOCK_TAX })),
    initialData: { data: MOCK_TAX },
  });

  const roi = roiData?.data ?? MOCK_ROI;
  const tax = taxData?.data ?? MOCK_TAX;

  const breakdownData = [
    { name: 'Peak Shaving', valor: roi.breakdown.peakShaving, fill: '#3b82f6' },
    { name: 'Arbitragem', valor: roi.breakdown.arbitrage, fill: '#22c55e' },
    { name: 'Serv. Ancilares', valor: roi.breakdown.gridServices, fill: '#f97316' },
    { name: 'Economia Fiscal', valor: tax.taxSavingBrl, fill: '#a855f7' },
    { name: 'Custo Carga', valor: Math.abs(roi.breakdown.chargingCost), fill: '#ef4444' },
  ];

  const monthlyTrend = [
    { mes: 'Set/25', economia: 8200, fiscal: 1950 },
    { mes: 'Out/25', economia: 8800, fiscal: 1950 },
    { mes: 'Nov/25', economia: 9100, fiscal: 1950 },
    { mes: 'Dez/25', economia: 9500, fiscal: 1950 },
    { mes: 'Jan/26', economia: 9200, fiscal: 1950 },
    { mes: 'Fev/26', economia: roi.currentMonthSavingBrl, fiscal: tax.taxSavingBrl },
  ];

  const regimeColor: Record<string, string> = {
    SEVERO: 'text-red-400',
    INTENSIVO: 'text-yellow-400',
    NORMAL: 'text-green-400',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Financeiro</h1>
          <p className="text-gray-400 text-sm mt-1">
            Sistema: {systemId} - Periodo: Fevereiro 2026
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setSelectedPeriod('year')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Anual
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<DollarSign className="w-5 h-5 text-green-400" />}
          label="Economia Liquida"
          value={`R$ ${roi.currentMonthSavingBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sublabel="este mes"
          trend="+12%"
          positive
        />
        <KPICard
          icon={<Shield className="w-5 h-5 text-purple-400" />}
          label="Economia Tributaria"
          value={`R$ ${tax.taxSavingBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sublabel={`Regime ${tax.regime} - ${tax.depreciationRatePercent}% a.a.`}
          trend="Legal"
          positive
        />
        <KPICard
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          label="ROI Acumulado"
          value={`${roi.roiAccumulatedPercent.toFixed(1)}%`}
          sublabel="desde instalacao"
          trend="+3.2%"
          positive
        />
        <KPICard
          icon={<BarChart3 className="w-5 h-5 text-orange-400" />}
          label="Payback Restante"
          value={`${roi.paybackRemainingMonths} meses`}
          sublabel={`Investimento: R$ ${(roi.investmentCostBrl / 1000).toFixed(0)}k`}
          trend="Em dia"
          positive
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold mb-4">Composicao do Beneficio Mensal</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={breakdownData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(1)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={100} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly trend */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold mb-4">Tendencia (ultimos 6 meses)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
              <Legend />
              <Line type="monotone" dataKey="economia" name="Economia Operacional"
                stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
              <Line type="monotone" dataKey="fiscal" name="Economia Fiscal"
                stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tax Optimization Detail */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-semibold">Otimizacao Tributaria - Regime de Depreciacao</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Regime Classificado</div>
            <div className={`text-xl font-bold ${regimeColor[tax.regime] ?? 'text-white'}`}>
              {tax.regime}
            </div>
            <div className="text-xs text-gray-500 mt-1">{tax.depreciationRatePercent}% a.a.</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Depreciacao Mensal</div>
            <div className="text-xl font-bold text-white">
              R$ {tax.monthlyDepreciationBrl?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">valor contabil</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Economia Tributaria</div>
            <div className="text-xl font-bold text-purple-400">
              R$ {tax.taxSavingBrl?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">IRPJ + CSLL (34%)</div>
          </div>
        </div>

        {/* Legal Basis */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Base Legal
          </div>
          <ul className="space-y-1">
            {tax.legalBasis?.map((ref, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">-</span>
                {ref}
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendations */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Recomendacoes
          </div>
          <ul className="space-y-1">
            {tax.recommendations?.map((rec, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="text-green-400 mt-0.5">+</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
            onClick={() => alert('PDF generation requires backend PDF service (pdfkit/puppeteer)')}
          >
            Baixar Laudo PDF
          </button>
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            onClick={() => alert('Email sending requires backend email service (nodemailer)')}
          >
            Enviar por Email
          </button>
        </div>
      </div>
    </div>
  );
}
