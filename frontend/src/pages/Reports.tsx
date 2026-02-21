/**
 * Reports Page - Enhanced
 * Generate, preview, and export performance, financial, and energy reports
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  DollarSign,
  Zap,
  Wrench,
  Clock,
  FileSpreadsheet,
  File,
  Eye,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Battery,
  Leaf,
  Filter,
  Plus,
  Trash2,
  Mail,
  Loader2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn, formatRelativeTime } from '@/lib/utils';
import { systemsApi, reportsApi } from '@/services/api';
import { BessSystem } from '@/types';

// Report Types
type ReportType = 'performance' | 'financial' | 'energy' | 'maintenance';
type ExportFormat = 'pdf' | 'excel' | 'csv';

interface ReportTemplate {
  id: ReportType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  sections: string[];
}

interface GeneratedReport {
  id: string;
  type: string;
  name: string;
  systemId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  fileSize?: string;
  format?: string;
}

// Report Templates
const reportTemplates: ReportTemplate[] = [
  {
    id: 'performance',
    name: 'Desempenho do Sistema',
    description: 'Metricas de eficiencia, disponibilidade e saude da bateria',
    icon: BarChart3,
    color: 'blue',
    sections: ['Disponibilidade', 'Eficiencia Round-Trip', 'Ciclos de Bateria', 'SOH Trend', 'Alarmes'],
  },
  {
    id: 'financial',
    name: 'Analise Financeira',
    description: 'Economia, ROI, arbitragem e reducao de demanda',
    icon: DollarSign,
    color: 'green',
    sections: ['Economia Total', 'Arbitragem', 'Peak Shaving', 'ROI', 'Payback'],
  },
  {
    id: 'energy',
    name: 'Balanco Energetico',
    description: 'Fluxo de energia, autoconsumo e pegada de carbono',
    icon: Zap,
    color: 'yellow',
    sections: ['Energia Carregada', 'Energia Descarregada', 'Autoconsumo', 'Grid Import/Export', 'CO2 Evitado'],
  },
  {
    id: 'maintenance',
    name: 'Manutencao',
    description: 'Historico de alarmes, manutencoes e previsoes',
    icon: Wrench,
    color: 'purple',
    sections: ['Alarmes Ativos', 'Historico de Falhas', 'Manutencoes Realizadas', 'Proximas Manutencoes', 'Vida Util'],
  },
];

// Mock data generators
const generatePerformanceData = () => ({
  availability: 99.7,
  roundTripEfficiency: 92.5,
  totalCycles: 1250,
  soh: 97.8,
  monthlyData: Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
    efficiency: 91 + Math.random() * 3,
    availability: 99 + Math.random(),
  })),
});

const generateFinancialData = () => ({
  totalSavings: 145680.50,
  arbitrageSavings: 78450.00,
  peakShavingSavings: 52230.50,
  demandChargeSavings: 15000.00,
  roi: 28.5,
  paybackYears: 3.5,
  monthlyData: Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
    arbitrage: 5000 + Math.random() * 3000,
    peakShaving: 3000 + Math.random() * 2000,
    demandCharge: 1000 + Math.random() * 500,
  })),
  savingsBreakdown: [
    { name: 'Arbitragem', value: 78450, color: '#3B82F6' },
    { name: 'Peak Shaving', value: 52230, color: '#10B981' },
    { name: 'Demanda', value: 15000, color: '#F59E0B' },
  ],
});

const generateEnergyData = () => ({
  totalCharged: 125680,
  totalDischarged: 116250,
  selfConsumptionRate: 78.5,
  co2Avoided: 58.2,
  monthlyData: Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
    charged: 8000 + Math.random() * 4000,
    discharged: 7500 + Math.random() * 3500,
    solar: 6000 + Math.random() * 4000,
  })),
});

const generateMaintenanceData = () => ({
  activeAlarms: 2,
  mtbf: 720,
  mttr: 2.5,
  nextMaintenance: new Date(Date.now() + 86400000 * 45),
  alarmHistory: Array.from({ length: 6 }, (_, i) => ({
    month: ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
    critical: Math.floor(Math.random() * 2),
    high: Math.floor(Math.random() * 5),
    medium: Math.floor(Math.random() * 10),
    low: Math.floor(Math.random() * 15),
  })),
});

export default function Reports() {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportType | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSystem, setSelectedSystem] = useState('');
  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch systems and reports
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [systemsRes, reportsRes] = await Promise.all([
          systemsApi.getAll(),
          reportsApi.getAll({ sortBy: 'createdAt', sortOrder: 'desc' }),
        ]);
        setSystems(systemsRes.data.data || []);
        setGeneratedReports(reportsRes.data.data || []);
        if (systemsRes.data.data?.length > 0) {
          setSelectedSystem(systemsRes.data.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    // Set default date range
    const end = new Date();
    const start = new Date(Date.now() - 86400000 * 30);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  }, []);

  // Generate report data when template selected
  useEffect(() => {
    if (selectedTemplate) {
      switch (selectedTemplate) {
        case 'performance':
          setReportData(generatePerformanceData());
          break;
        case 'financial':
          setReportData(generateFinancialData());
          break;
        case 'energy':
          setReportData(generateEnergyData());
          break;
        case 'maintenance':
          setReportData(generateMaintenanceData());
          break;
      }
    }
  }, [selectedTemplate]);

  // Generate report
  const handleGenerateReport = async (format: ExportFormat) => {
    if (!selectedTemplate || !selectedSystem) return;

    setIsGenerating(true);
    try {
      await reportsApi.generate(selectedSystem, selectedTemplate, dateRange.start, dateRange.end, format);
      const template = reportTemplates.find((t) => t.id === selectedTemplate)!;
      const newReport: GeneratedReport = {
        id: `rpt-${Date.now()}`,
        type: selectedTemplate,
        name: `${template.name} - ${new Date().toLocaleDateString('pt-BR')}`,
        systemId: selectedSystem,
        status: 'completed',
        createdAt: new Date(),
        fileSize: `${(Math.random() * 3 + 1).toFixed(1)} MB`,
        format,
      };
      setGeneratedReports((prev) => [newReport, ...prev]);
      setShowPreview(false);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatNumber = (value: number, decimals = 1) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const selectedTemplateData = reportTemplates.find((t) => t.id === selectedTemplate);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            Relatorios
          </h1>
          <p className="text-foreground-muted mt-1">
            Gere e exporte relatorios de desempenho, financeiro e energetico
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/export"
            className="flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Dados
            <ArrowRight className="w-4 h-4" />
          </Link>
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground"
          >
            {systems.map((sys) => (
              <option key={sys.id} value={sys.id}>{sys.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { id: 'generate', label: 'Gerar Relatorio', icon: Plus },
          { id: 'history', label: 'Historico', icon: Clock },
        ].map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              )}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template Selection */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Tipo de Relatorio</h3>
            <div className="space-y-3">
              {reportTemplates.map((template) => {
                const TemplateIcon = template.icon;
                const isSelected = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setShowPreview(false);
                    }}
                    className={cn(
                      'w-full p-4 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-surface'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg', isSelected ? 'bg-primary/20' : 'bg-surface-hover')}>
                        <TemplateIcon className={cn('w-5 h-5', isSelected ? 'text-primary' : 'text-foreground-muted')} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{template.name}</h4>
                        <p className="text-sm text-foreground-muted mt-1">{template.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.sections.slice(0, 3).map((section) => (
                            <span key={section} className="text-xs px-2 py-0.5 bg-surface-hover rounded">
                              {section}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Date Range */}
            {selectedTemplate && (
              <div className="p-4 bg-surface border border-border rounded-lg space-y-4">
                <h4 className="font-medium text-foreground">Periodo</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-foreground-muted">Inicio</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-foreground-muted">Fim</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {['7d', '30d', '90d', '1y'].map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
                        setDateRange({
                          start: new Date(Date.now() - 86400000 * days).toISOString().split('T')[0],
                          end: new Date().toISOString().split('T')[0],
                        });
                      }}
                      className="px-3 py-1 text-sm bg-surface-hover border border-border rounded hover:border-primary"
                    >
                      {period}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Eye className="w-4 h-4" />
                  Visualizar
                </button>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            {!selectedTemplate ? (
              <div className="h-96 flex items-center justify-center bg-surface border border-border rounded-lg">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-foreground-muted mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground">Selecione um tipo de relatorio</h3>
                  <p className="text-foreground-muted mt-2">Escolha um modelo ao lado para visualizar</p>
                </div>
              </div>
            ) : showPreview && reportData ? (
              <div className="bg-surface border border-border rounded-lg p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedTemplateData?.name}</h3>
                    <p className="text-sm text-foreground-muted">{dateRange.start} a {dateRange.end}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerateReport('pdf')}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <File className="w-4 h-4" />}
                      PDF
                    </button>
                    <button
                      onClick={() => handleGenerateReport('excel')}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                </div>

                {/* Financial Preview */}
                {selectedTemplate === 'financial' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Economia Total</p>
                        <p className="text-xl font-bold text-green-400">{formatCurrency(reportData.totalSavings)}</p>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">ROI</p>
                        <p className="text-xl font-bold text-blue-400">{reportData.roi}%</p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Payback</p>
                        <p className="text-xl font-bold text-purple-400">{reportData.paybackYears} anos</p>
                      </div>
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Arbitragem</p>
                        <p className="text-xl font-bold text-yellow-400">{formatCurrency(reportData.arbitrageSavings)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-surface-hover rounded-lg">
                        <h4 className="font-medium text-foreground mb-4">Economia Mensal</h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                              <Bar dataKey="arbitrage" name="Arbitragem" fill="#3B82F6" stackId="a" />
                              <Bar dataKey="peakShaving" name="Peak Shaving" fill="#10B981" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="p-4 bg-surface-hover rounded-lg">
                        <h4 className="font-medium text-foreground mb-4">Distribuicao</h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={reportData.savingsBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                                {reportData.savingsBreakdown.map((entry: any, i: number) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Performance Preview */}
                {selectedTemplate === 'performance' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Disponibilidade</p>
                        <p className="text-xl font-bold text-green-400">{reportData.availability}%</p>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Eficiencia RT</p>
                        <p className="text-xl font-bold text-blue-400">{reportData.roundTripEfficiency}%</p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Ciclos</p>
                        <p className="text-xl font-bold text-purple-400">{formatNumber(reportData.totalCycles, 0)}</p>
                      </div>
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">SOH</p>
                        <p className="text-xl font-bold text-yellow-400">{reportData.soh}%</p>
                      </div>
                    </div>
                    <div className="p-4 bg-surface-hover rounded-lg">
                      <h4 className="font-medium text-foreground mb-4">Tendencia</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={reportData.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[85, 100]} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                            <Line type="monotone" dataKey="efficiency" name="Eficiencia" stroke="#3B82F6" strokeWidth={2} />
                            <Line type="monotone" dataKey="availability" name="Disponibilidade" stroke="#10B981" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}

                {/* Energy Preview */}
                {selectedTemplate === 'energy' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Carregada</p>
                        <p className="text-xl font-bold text-green-400">{formatNumber(reportData.totalCharged / 1000)} MWh</p>
                      </div>
                      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Descarregada</p>
                        <p className="text-xl font-bold text-orange-400">{formatNumber(reportData.totalDischarged / 1000)} MWh</p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Autoconsumo</p>
                        <p className="text-xl font-bold text-purple-400">{reportData.selfConsumptionRate}%</p>
                      </div>
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                        <Leaf className="w-6 h-6 text-green-400" />
                        <div>
                          <p className="text-xs text-foreground-muted">CO2 Evitado</p>
                          <p className="text-lg font-bold text-green-400">{reportData.co2Avoided} ton</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-surface-hover rounded-lg">
                      <h4 className="font-medium text-foreground mb-4">Fluxo Mensal</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={reportData.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                            <Area type="monotone" dataKey="solar" name="Solar" fill="#F59E0B" stroke="#F59E0B" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="charged" name="Carregado" fill="#10B981" stroke="#10B981" fillOpacity={0.6} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}

                {/* Maintenance Preview */}
                {selectedTemplate === 'maintenance' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={cn('p-4 rounded-lg border', reportData.activeAlarms > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30')}>
                        <p className="text-sm text-foreground-muted">Alarmes Ativos</p>
                        <p className={cn('text-xl font-bold', reportData.activeAlarms > 0 ? 'text-red-400' : 'text-green-400')}>{reportData.activeAlarms}</p>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">MTBF</p>
                        <p className="text-xl font-bold text-blue-400">{reportData.mtbf}h</p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">MTTR</p>
                        <p className="text-xl font-bold text-purple-400">{reportData.mttr}h</p>
                      </div>
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-sm text-foreground-muted">Prox. Manutencao</p>
                        <p className="text-lg font-bold text-yellow-400">{reportData.nextMaintenance.toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-surface-hover rounded-lg">
                      <h4 className="font-medium text-foreground mb-4">Historico de Alarmes</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportData.alarmHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                            <Bar dataKey="critical" name="Critico" fill="#EF4444" stackId="a" />
                            <Bar dataKey="high" name="Alto" fill="#F97316" stackId="a" />
                            <Bar dataKey="medium" name="Medio" fill="#F59E0B" stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center bg-surface border border-border rounded-lg">
                <div className="text-center">
                  <Eye className="w-16 h-16 text-foreground-muted mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground">Clique em Visualizar</h3>
                  <p className="text-foreground-muted mt-2">Selecione o periodo e visualize o preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Relatorios Gerados</h3>
            <button onClick={() => setActiveTab('generate')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              Novo Relatorio
            </button>
          </div>
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
          ) : generatedReports.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-foreground-muted mx-auto mb-4" />
              <p className="text-foreground-muted">Nenhum relatorio gerado ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {generatedReports.map((report) => {
                const template = reportTemplates.find((t) => t.id === report.type);
                const TemplateIcon = template?.icon || FileText;
                return (
                  <div key={report.id} className="p-4 flex items-center justify-between hover:bg-surface-hover">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <TemplateIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{report.name || template?.name}</h4>
                        <p className="text-sm text-foreground-muted">{report.fileSize || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ReportStatus status={report.status} />
                      <span className="text-sm text-foreground-muted">
                        {report.createdAt instanceof Date ? formatRelativeTime(report.createdAt) : formatRelativeTime(new Date(report.createdAt))}
                      </span>
                      {report.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Simulate download of report
                            const reportContent = `Relatorio: ${report.name}\nTipo: ${report.type}\nData: ${new Date(report.createdAt).toLocaleDateString('pt-BR')}\n\nDados simulados do relatorio...`;
                            const blob = new Blob([reportContent], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${report.name.replace(/\s/g, '_')}.${report.format || 'txt'}`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-2 hover:bg-surface-hover rounded-lg"
                          title="Baixar relatorio"
                        >
                          <Download className="w-4 h-4 text-primary" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportStatus({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, label: 'Pendente', className: 'text-foreground-muted bg-surface-hover' },
    processing: { icon: Loader2, label: 'Processando', className: 'text-yellow-400 bg-yellow-500/10' },
    completed: { icon: CheckCircle, label: 'Pronto', className: 'text-green-400 bg-green-500/10' },
    failed: { icon: XCircle, label: 'Erro', className: 'text-red-400 bg-red-500/10' },
  }[status] || { icon: Clock, label: status, className: 'text-foreground-muted bg-surface-hover' };

  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full', config.className)}>
      <Icon className={cn('w-3.5 h-3.5', status === 'processing' && 'animate-spin')} />
      {config.label}
    </span>
  );
}
