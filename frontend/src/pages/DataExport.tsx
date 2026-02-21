/**
 * Data Export Page
 * Export telemetry data, reports, and analytics in various formats
 */

import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  Calendar,
  Clock,
  Battery,
  CheckCircle,
  Loader2,
  Filter,
  HardDrive,
  TrendingUp,
  AlertTriangle,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportJob {
  id: string;
  name: string;
  type: 'telemetry' | 'alerts' | 'reports' | 'analytics' | 'config';
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  fileSize?: string;
  downloadUrl?: string;
}

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  type: 'telemetry' | 'alerts' | 'reports' | 'analytics' | 'config';
  fields: string[];
}

const exportTemplates: ExportTemplate[] = [
  {
    id: 'telemetry-full',
    name: 'Telemetria Completa',
    description: 'Dados de SOC, tensao, corrente, temperatura e potencia',
    icon: TrendingUp,
    type: 'telemetry',
    fields: ['timestamp', 'systemId', 'soc', 'voltage', 'current', 'power', 'temperature', 'soh'],
  },
  {
    id: 'telemetry-cells',
    name: 'Dados de Celulas',
    description: 'Tensao e temperatura individual de cada celula',
    icon: Battery,
    type: 'telemetry',
    fields: ['timestamp', 'systemId', 'cellId', 'voltage', 'temperature', 'balancing'],
  },
  {
    id: 'alerts-history',
    name: 'Historico de Alertas',
    description: 'Todos os alertas com severidade e resolucao',
    icon: AlertTriangle,
    type: 'alerts',
    fields: ['timestamp', 'systemId', 'severity', 'type', 'message', 'resolved', 'resolvedAt'],
  },
  {
    id: 'energy-report',
    name: 'Relatorio de Energia',
    description: 'Consumo, geracao e economia de energia',
    icon: FileSpreadsheet,
    type: 'reports',
    fields: ['date', 'systemId', 'energyCharged', 'energyDischarged', 'peakShaving', 'savings'],
  },
  {
    id: 'performance',
    name: 'Analise de Desempenho',
    description: 'Metricas de eficiencia e disponibilidade',
    icon: TrendingUp,
    type: 'analytics',
    fields: ['date', 'systemId', 'efficiency', 'availability', 'cycleCount', 'degradation'],
  },
  {
    id: 'config-backup',
    name: 'Backup de Configuracao',
    description: 'Parametros de protecao e configuracoes do BMS',
    icon: Settings,
    type: 'config',
    fields: ['systemId', 'protectionParams', 'schedules', 'alerts', 'integration'],
  },
];

// Mock recent exports
const mockRecentExports: ExportJob[] = [
  {
    id: 'exp-1',
    name: 'Telemetria Janeiro 2026',
    type: 'telemetry',
    format: 'xlsx',
    status: 'completed',
    progress: 100,
    createdAt: new Date('2026-01-25T10:30:00'),
    completedAt: new Date('2026-01-25T10:32:00'),
    fileSize: '4.2 MB',
    downloadUrl: '#',
  },
  {
    id: 'exp-2',
    name: 'Alertas Q4 2025',
    type: 'alerts',
    format: 'csv',
    status: 'completed',
    progress: 100,
    createdAt: new Date('2026-01-24T15:00:00'),
    completedAt: new Date('2026-01-24T15:01:00'),
    fileSize: '856 KB',
    downloadUrl: '#',
  },
  {
    id: 'exp-3',
    name: 'Relatorio Anual 2025',
    type: 'reports',
    format: 'pdf',
    status: 'processing',
    progress: 65,
    createdAt: new Date('2026-01-25T14:00:00'),
  },
];

export default function DataExport() {
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'json' | 'pdf'>('xlsx');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['all']);
  const [recentExports, setRecentExports] = useState<ExportJob[]>(mockRecentExports);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!selectedTemplate) return;

    setIsExporting(true);

    const newExport: ExportJob = {
      id: `exp-${Date.now()}`,
      name: `${selectedTemplate.name} - ${new Date().toLocaleDateString('pt-BR')}`,
      type: selectedTemplate.type,
      format: exportFormat,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
    };

    setRecentExports((prev) => [newExport, ...prev]);

    // Simulate export progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setRecentExports((prev) =>
        prev.map((exp) =>
          exp.id === newExport.id
            ? { ...exp, progress: i, status: i === 100 ? 'completed' : 'processing' }
            : exp
        )
      );
    }

    setRecentExports((prev) =>
      prev.map((exp) =>
        exp.id === newExport.id
          ? {
              ...exp,
              status: 'completed',
              progress: 100,
              completedAt: new Date(),
              fileSize: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
              downloadUrl: '#',
            }
          : exp
      )
    );

    setIsExporting(false);
    setSelectedTemplate(null);
  };

  const formatIcons = {
    csv: FileText,
    xlsx: FileSpreadsheet,
    json: FileJson,
    pdf: FileText,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" />
          Exportar Dados
        </h1>
        <p className="text-foreground-muted text-sm">
          Exporte dados de telemetria, alertas e relatorios em varios formatos
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Export Templates */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-xl border border-border">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Selecione o Tipo de Exportacao</h3>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-3">
              {exportTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-surface-hover'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        selectedTemplate?.id === template.id
                          ? 'bg-primary/20 text-primary'
                          : 'bg-surface-hover text-foreground-muted'
                      )}
                    >
                      <template.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{template.name}</h4>
                      <p className="text-sm text-foreground-muted mt-1">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Options */}
          {selectedTemplate && (
            <div className="bg-surface rounded-xl border border-border animate-fade-in">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Opcoes de Exportacao</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Formato</label>
                  <div className="flex flex-wrap gap-2">
                    {(['csv', 'xlsx', 'json', 'pdf'] as const).map((format) => {
                      const FormatIcon = formatIcons[format];
                      return (
                        <button
                          key={format}
                          onClick={() => setExportFormat(format)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                            exportFormat === format
                              ? 'bg-primary text-white'
                              : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                          )}
                        >
                          <FormatIcon className="w-4 h-4" />
                          {format.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range */}
                {selectedTemplate.type !== 'config' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Periodo
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-foreground-muted">Inicio</label>
                        <input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-foreground-muted">Fim</label>
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {['Hoje', '7 dias', '30 dias', '90 dias', 'Ano'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            const end = new Date();
                            const start = new Date();
                            if (preset === 'Hoje') start.setHours(0, 0, 0, 0);
                            else if (preset === '7 dias') start.setDate(start.getDate() - 7);
                            else if (preset === '30 dias') start.setDate(start.getDate() - 30);
                            else if (preset === '90 dias') start.setDate(start.getDate() - 90);
                            else if (preset === 'Ano') start.setFullYear(start.getFullYear() - 1);
                            setDateRange({
                              start: start.toISOString().split('T')[0],
                              end: end.toISOString().split('T')[0],
                            });
                          }}
                          className="px-3 py-1 text-xs bg-surface-hover text-foreground-muted hover:text-foreground rounded-lg transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Systems Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Sistemas
                  </label>
                  <select
                    value={selectedSystems[0]}
                    onChange={(e) => setSelectedSystems([e.target.value])}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">Todos os sistemas</option>
                    <option value="sys-1">BESS Principal</option>
                    <option value="sys-2">BESS Backup</option>
                    <option value="sys-3">BESS Solar</option>
                    <option value="sys-4">BESS Industrial</option>
                  </select>
                </div>

                {/* Fields Preview */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Campos Incluidos
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.fields.map((field) => (
                      <span
                        key={field}
                        className="px-2 py-1 bg-surface-hover text-foreground-muted text-xs rounded"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Exportar {exportFormat.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Exports */}
        <div className="bg-surface rounded-xl border border-border h-fit">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Exportacoes Recentes</h3>
            <button className="p-1 hover:bg-surface-hover rounded transition-colors">
              <RefreshCw className="w-4 h-4 text-foreground-muted" />
            </button>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {recentExports.length === 0 ? (
              <div className="p-8 text-center">
                <HardDrive className="w-12 h-12 mx-auto mb-4 text-foreground-subtle" />
                <p className="text-foreground-muted">Nenhuma exportacao recente</p>
              </div>
            ) : (
              recentExports.map((job) => (
                <ExportJobRow key={job.id} job={job} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Scheduled Exports Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium">Exportacao Automatica</p>
          <p className="text-foreground-muted">
            Configure exportacoes automaticas em Configuracoes {'>'} Relatorios para receber dados
            periodicamente por email.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export Job Row
function ExportJobRow({ job }: { job: ExportJob }) {
  const formatIcons = {
    csv: FileText,
    xlsx: FileSpreadsheet,
    json: FileJson,
    pdf: FileText,
  };
  const FormatIcon = formatIcons[job.format];

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            job.status === 'completed'
              ? 'bg-success-500/10 text-success-500'
              : job.status === 'processing'
              ? 'bg-primary/10 text-primary'
              : 'bg-danger-500/10 text-danger-500'
          )}
        >
          <FormatIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm truncate">{job.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs text-foreground-muted uppercase">{job.format}</span>
            {job.fileSize && (
              <>
                <span className="text-foreground-subtle">•</span>
                <span className="text-2xs text-foreground-muted">{job.fileSize}</span>
              </>
            )}
          </div>

          {job.status === 'processing' && (
            <div className="mt-2">
              <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <p className="text-2xs text-foreground-muted mt-1">{job.progress}%</p>
            </div>
          )}

          {job.status === 'completed' && job.downloadUrl && (
            <button className="mt-2 text-xs text-primary hover:text-primary-400 flex items-center gap-1">
              <Download className="w-3 h-3" />
              Baixar
            </button>
          )}

          {job.status === 'failed' && (
            <p className="mt-1 text-xs text-danger-500">Falha na exportacao</p>
          )}
        </div>
        <div className="text-right">
          {job.status === 'completed' && (
            <CheckCircle className="w-4 h-4 text-success-500" />
          )}
          {job.status === 'processing' && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
          <p className="text-2xs text-foreground-muted mt-1">
            {job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
