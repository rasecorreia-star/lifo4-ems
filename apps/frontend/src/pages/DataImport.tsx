import { useMemo, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Database,
  Cloud,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Download,
  Trash2,
  Play,
  RefreshCw,
  Settings,
  Eye,
  Calendar,
} from 'lucide-react';

interface ImportJob {
  id: string;
  name: string;
  source: 'file' | 'api' | 'database' | 'cloud';
  format: 'csv' | 'xlsx' | 'json' | 'xml';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  createdAt: string;
  completedAt?: string;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  errorRecords: number;
  targetTable: string;
  fileName?: string;
  errorLog?: string[];
}

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'xlsx';
  fields: { name: string; type: string; required: boolean }[];
  downloadUrl: string;
}

export default function DataImport() {
  const [activeTab, setActiveTab] = useState<'import' | 'history' | 'templates' | 'scheduled'>('import');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const importJobs = useMemo<ImportJob[]>(() => [
    {
      id: 'imp-1',
      name: 'Importacao Telemetria Jan/2025',
      source: 'file',
      format: 'csv',
      status: 'completed',
      createdAt: '2025-01-22T10:30:00',
      completedAt: '2025-01-22T10:35:00',
      totalRecords: 15000,
      processedRecords: 15000,
      successRecords: 14985,
      errorRecords: 15,
      targetTable: 'telemetry_data',
      fileName: 'telemetria_jan2025.csv',
    },
    {
      id: 'imp-2',
      name: 'Sync API Meteorologia',
      source: 'api',
      format: 'json',
      status: 'processing',
      createdAt: '2025-01-22T14:00:00',
      totalRecords: 5000,
      processedRecords: 2340,
      successRecords: 2340,
      errorRecords: 0,
      targetTable: 'weather_data',
    },
    {
      id: 'imp-3',
      name: 'Importacao Tarifas',
      source: 'file',
      format: 'xlsx',
      status: 'failed',
      createdAt: '2025-01-21T16:00:00',
      completedAt: '2025-01-21T16:02:00',
      totalRecords: 500,
      processedRecords: 120,
      successRecords: 0,
      errorRecords: 120,
      targetTable: 'energy_tariffs',
      fileName: 'tarifas_2025.xlsx',
      errorLog: ['Erro na linha 121: Formato de data invalido', 'Erro na linha 122: Campo obrigatorio vazio'],
    },
    {
      id: 'imp-4',
      name: 'Importacao Cadastro Equipamentos',
      source: 'file',
      format: 'csv',
      status: 'partial',
      createdAt: '2025-01-20T09:00:00',
      completedAt: '2025-01-20T09:15:00',
      totalRecords: 250,
      processedRecords: 250,
      successRecords: 235,
      errorRecords: 15,
      targetTable: 'assets',
      fileName: 'equipamentos_novos.csv',
    },
    {
      id: 'imp-5',
      name: 'Sync Banco Legado',
      source: 'database',
      format: 'csv',
      status: 'completed',
      createdAt: '2025-01-19T22:00:00',
      completedAt: '2025-01-19T23:30:00',
      totalRecords: 50000,
      processedRecords: 50000,
      successRecords: 50000,
      errorRecords: 0,
      targetTable: 'historical_data',
    },
  ], []);

  const templates = useMemo<ImportTemplate[]>(() => [
    {
      id: 'tpl-1',
      name: 'Template Telemetria',
      description: 'Importacao de dados de telemetria dos sistemas',
      format: 'csv',
      fields: [
        { name: 'timestamp', type: 'datetime', required: true },
        { name: 'system_id', type: 'string', required: true },
        { name: 'voltage', type: 'number', required: true },
        { name: 'current', type: 'number', required: true },
        { name: 'power', type: 'number', required: true },
        { name: 'soc', type: 'number', required: true },
        { name: 'temperature', type: 'number', required: false },
      ],
      downloadUrl: '#',
    },
    {
      id: 'tpl-2',
      name: 'Template Tarifas de Energia',
      description: 'Importacao de tarifas de energia por horario',
      format: 'xlsx',
      fields: [
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'tariff_type', type: 'string', required: true },
        { name: 'peak_rate', type: 'number', required: true },
        { name: 'off_peak_rate', type: 'number', required: true },
        { name: 'intermediate_rate', type: 'number', required: false },
      ],
      downloadUrl: '#',
    },
    {
      id: 'tpl-3',
      name: 'Template Cadastro de Ativos',
      description: 'Importacao de cadastro de equipamentos',
      format: 'csv',
      fields: [
        { name: 'asset_tag', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'category', type: 'string', required: true },
        { name: 'manufacturer', type: 'string', required: true },
        { name: 'model', type: 'string', required: true },
        { name: 'serial_number', type: 'string', required: true },
        { name: 'purchase_date', type: 'date', required: false },
        { name: 'purchase_cost', type: 'number', required: false },
      ],
      downloadUrl: '#',
    },
    {
      id: 'tpl-4',
      name: 'Template Manutencoes',
      description: 'Importacao de historico de manutencoes',
      format: 'xlsx',
      fields: [
        { name: 'asset_id', type: 'string', required: true },
        { name: 'maintenance_date', type: 'date', required: true },
        { name: 'type', type: 'string', required: true },
        { name: 'description', type: 'string', required: true },
        { name: 'technician', type: 'string', required: false },
        { name: 'cost', type: 'number', required: false },
      ],
      downloadUrl: '#',
    },
  ], []);

  const stats = useMemo(() => ({
    total: importJobs.length,
    completed: importJobs.filter(j => j.status === 'completed').length,
    processing: importJobs.filter(j => j.status === 'processing').length,
    failed: importJobs.filter(j => j.status === 'failed').length,
    totalRecords: importJobs.reduce((sum, j) => sum + j.successRecords, 0),
  }), [importJobs]);

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-500/20';
      case 'processing': return 'text-blue-500 bg-blue-500/20';
      case 'pending': return 'text-gray-500 bg-gray-500/20';
      case 'failed': return 'text-red-500 bg-red-500/20';
      case 'partial': return 'text-amber-500 bg-amber-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return 'Concluido';
      case 'processing': return 'Processando';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      case 'partial': return 'Parcial';
      default: return status;
    }
  };

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'processing': return RefreshCw;
      case 'pending': return Clock;
      case 'failed': return XCircle;
      case 'partial': return AlertTriangle;
      default: return Clock;
    }
  };

  const getSourceIcon = (source: ImportJob['source']) => {
    switch (source) {
      case 'file': return FileSpreadsheet;
      case 'api': return Cloud;
      case 'database': return Database;
      case 'cloud': return Cloud;
      default: return FileText;
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importacao de Dados</h1>
          <p className="text-foreground-muted">Importe dados de arquivos, APIs ou bancos de dados</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Total Imports</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Concluidos</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-foreground-muted">Processando</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.processing}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Falhas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground-muted">Registros</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalRecords.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: 'import', label: 'Nova Importacao', icon: Upload },
            { id: 'history', label: 'Historico', icon: Clock },
            { id: 'templates', label: 'Templates', icon: FileSpreadsheet },
            { id: 'scheduled', label: 'Agendados', icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Area */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Upload de Arquivo</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
              {selectedFile ? (
                <div>
                  <p className="text-foreground font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-foreground-muted">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="mt-2 text-sm text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-foreground mb-2">
                    Arraste arquivos aqui ou{' '}
                    <label className="text-primary cursor-pointer hover:underline">
                      selecione
                      <input type="file" className="hidden" accept=".csv,.xlsx,.json,.xml" />
                    </label>
                  </p>
                  <p className="text-sm text-foreground-muted">
                    Formatos: CSV, XLSX, JSON, XML (max 100MB)
                  </p>
                </>
              )}
            </div>

            {selectedFile && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Tabela de Destino
                  </label>
                  <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                    <option value="">Selecione</option>
                    <option value="telemetry_data">Dados de Telemetria</option>
                    <option value="energy_tariffs">Tarifas de Energia</option>
                    <option value="assets">Cadastro de Ativos</option>
                    <option value="maintenance_history">Historico Manutencao</option>
                    <option value="historical_data">Dados Historicos</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-sm text-foreground">Ignorar primeira linha (cabecalho)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-sm text-foreground">Validar dados antes de importar</span>
                </label>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  <Play className="w-4 h-4" />
                  Iniciar Importacao
                </button>
              </div>
            )}
          </div>

          {/* Other Sources */}
          <div className="space-y-4">
            <div className="bg-surface rounded-lg border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Cloud className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">API Externa</h3>
                  <p className="text-sm text-foreground-muted">Sincronizar dados via API REST</p>
                </div>
              </div>
              <button className="w-full px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors">
                Configurar API
              </button>
            </div>

            <div className="bg-surface rounded-lg border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Database className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Banco de Dados</h3>
                  <p className="text-sm text-foreground-muted">Importar de banco externo</p>
                </div>
              </div>
              <button className="w-full px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors">
                Conectar Banco
              </button>
            </div>

            <div className="bg-surface rounded-lg border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Cloud className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Cloud Storage</h3>
                  <p className="text-sm text-foreground-muted">S3, Google Cloud, Azure</p>
                </div>
              </div>
              <button className="w-full px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors">
                Conectar Cloud
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Importacao</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Fonte</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Destino</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Registros</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Data</th>
                  <th className="text-right p-4 text-sm font-medium text-foreground-muted">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {importJobs.map((job) => {
                  const SourceIcon = getSourceIcon(job.source);
                  const StatusIcon = getStatusIcon(job.status);
                  const progress = (job.processedRecords / job.totalRecords) * 100;

                  return (
                    <tr key={job.id} className="hover:bg-surface-hover">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <SourceIcon className="w-5 h-5 text-foreground-muted" />
                          <div>
                            <p className="font-medium text-foreground">{job.name}</p>
                            {job.fileName && (
                              <p className="text-sm text-foreground-muted">{job.fileName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-foreground capitalize">{job.source}</span>
                        <span className="text-xs text-foreground-muted ml-1">({job.format.toUpperCase()})</span>
                      </td>
                      <td className="p-4 text-sm text-foreground">{job.targetTable}</td>
                      <td className="p-4">
                        <div>
                          <p className="text-sm text-foreground">
                            {job.successRecords.toLocaleString()} / {job.totalRecords.toLocaleString()}
                          </p>
                          {job.errorRecords > 0 && (
                            <p className="text-xs text-red-500">{job.errorRecords} erros</p>
                          )}
                          {job.status === 'processing' && (
                            <div className="mt-1 h-1.5 bg-background rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`w-4 h-4 ${job.status === 'processing' ? 'animate-spin' : ''} ${getStatusColor(job.status).split(' ')[0]}`} />
                          <span className={`text-sm ${getStatusColor(job.status).split(' ')[0]}`}>
                            {getStatusLabel(job.status)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground-muted">
                        {new Date(job.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground">
                            <Eye className="w-4 h-4" />
                          </button>
                          {job.status === 'failed' && (
                            <button className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-primary">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{template.name}</h3>
                    <p className="text-sm text-foreground-muted">{template.description}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-background rounded text-xs text-foreground-muted uppercase">
                  {template.format}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-xs text-foreground-muted mb-2">Campos ({template.fields.length})</p>
                <div className="flex flex-wrap gap-1">
                  {template.fields.map((field) => (
                    <span
                      key={field.name}
                      className={`px-2 py-0.5 rounded text-xs ${
                        field.required
                          ? 'bg-red-500/20 text-red-500'
                          : 'bg-background text-foreground-muted'
                      }`}
                    >
                      {field.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="bg-surface rounded-lg border border-border p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
          <h3 className="font-medium text-foreground mb-1">Importacoes Agendadas</h3>
          <p className="text-sm text-foreground-muted mb-4">
            Configure importacoes automaticas em intervalos regulares
          </p>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Agendar Importacao
          </button>
        </div>
      )}
    </div>
  );
}
