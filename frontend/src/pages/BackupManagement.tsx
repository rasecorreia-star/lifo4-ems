import { useMemo, useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Settings,
  Play,
  Calendar,
  FileArchive,
  Shield,
  Cloud,
} from 'lucide-react';

interface Backup {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'config';
  status: 'completed' | 'in_progress' | 'failed' | 'scheduled';
  size: string;
  createdAt: string;
  expiresAt: string;
  location: 'local' | 'cloud';
  encrypted: boolean;
  systems: string[];
}

interface BackupSchedule {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'config';
  frequency: string;
  time: string;
  nextRun: string;
  enabled: boolean;
  retention: number;
}

export default function BackupManagement() {
  const [activeTab, setActiveTab] = useState<'backups' | 'schedules' | 'restore' | 'settings'>('backups');
  const [showNewBackup, setShowNewBackup] = useState(false);

  const backups = useMemo<Backup[]>(() => [
    {
      id: 'bkp-1',
      name: 'Backup Completo - 22/01/2025',
      type: 'full',
      status: 'completed',
      size: '2.4 GB',
      createdAt: '2025-01-22T03:00:00',
      expiresAt: '2025-04-22T03:00:00',
      location: 'cloud',
      encrypted: true,
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul', 'BESS Centro'],
    },
    {
      id: 'bkp-2',
      name: 'Backup Incremental - 22/01/2025',
      type: 'incremental',
      status: 'completed',
      size: '156 MB',
      createdAt: '2025-01-22T12:00:00',
      expiresAt: '2025-02-22T12:00:00',
      location: 'local',
      encrypted: true,
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul', 'BESS Centro'],
    },
    {
      id: 'bkp-3',
      name: 'Backup Config - 21/01/2025',
      type: 'config',
      status: 'completed',
      size: '45 MB',
      createdAt: '2025-01-21T18:00:00',
      expiresAt: '2025-07-21T18:00:00',
      location: 'cloud',
      encrypted: true,
      systems: ['BESS Teresina Norte'],
    },
    {
      id: 'bkp-4',
      name: 'Backup Completo - 15/01/2025',
      type: 'full',
      status: 'completed',
      size: '2.3 GB',
      createdAt: '2025-01-15T03:00:00',
      expiresAt: '2025-04-15T03:00:00',
      location: 'cloud',
      encrypted: true,
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul', 'BESS Centro'],
    },
    {
      id: 'bkp-5',
      name: 'Backup Agendado',
      type: 'full',
      status: 'scheduled',
      size: '-',
      createdAt: '2025-01-29T03:00:00',
      expiresAt: '-',
      location: 'cloud',
      encrypted: true,
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul', 'BESS Centro'],
    },
    {
      id: 'bkp-6',
      name: 'Backup Manual - 10/01/2025',
      type: 'full',
      status: 'failed',
      size: '1.2 GB',
      createdAt: '2025-01-10T14:30:00',
      expiresAt: '-',
      location: 'local',
      encrypted: true,
      systems: ['BESS Piauí Sul'],
    },
  ], []);

  const schedules = useMemo<BackupSchedule[]>(() => [
    {
      id: 'sch-1',
      name: 'Backup Semanal Completo',
      type: 'full',
      frequency: 'Semanal',
      time: '03:00',
      nextRun: '2025-01-29T03:00:00',
      enabled: true,
      retention: 90,
    },
    {
      id: 'sch-2',
      name: 'Backup Diario Incremental',
      type: 'incremental',
      frequency: 'Diario',
      time: '12:00',
      nextRun: '2025-01-23T12:00:00',
      enabled: true,
      retention: 30,
    },
    {
      id: 'sch-3',
      name: 'Backup Config Mensal',
      type: 'config',
      frequency: 'Mensal',
      time: '18:00',
      nextRun: '2025-02-01T18:00:00',
      enabled: true,
      retention: 180,
    },
  ], []);

  const stats = useMemo(() => ({
    totalBackups: backups.filter(b => b.status === 'completed').length,
    totalSize: '4.9 GB',
    lastBackup: '22/01/2025 12:00',
    nextBackup: '23/01/2025 12:00',
    cloudUsage: '65%',
    localUsage: '23%',
  }), [backups]);

  const getTypeColor = (type: Backup['type']) => {
    switch (type) {
      case 'full': return 'text-blue-500 bg-blue-500/20';
      case 'incremental': return 'text-green-500 bg-green-500/20';
      case 'config': return 'text-purple-500 bg-purple-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getTypeLabel = (type: Backup['type']) => {
    switch (type) {
      case 'full': return 'Completo';
      case 'incremental': return 'Incremental';
      case 'config': return 'Configuracao';
      default: return type;
    }
  };

  const getStatusColor = (status: Backup['status']) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-500/20';
      case 'in_progress': return 'text-amber-500 bg-amber-500/20';
      case 'failed': return 'text-red-500 bg-red-500/20';
      case 'scheduled': return 'text-blue-500 bg-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: Backup['status']) => {
    switch (status) {
      case 'completed': return 'Concluido';
      case 'in_progress': return 'Em Progresso';
      case 'failed': return 'Falhou';
      case 'scheduled': return 'Agendado';
      default: return status;
    }
  };

  const getStatusIcon = (status: Backup['status']) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return RefreshCw;
      case 'failed': return AlertTriangle;
      case 'scheduled': return Clock;
      default: return Clock;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Backup</h1>
          <p className="text-foreground-muted">Backup e restauracao de dados do sistema</p>
        </div>
        <button
          onClick={() => setShowNewBackup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Play className="w-4 h-4" />
          Novo Backup
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground-muted">Total Backups</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalBackups}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Tamanho Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalSize}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Ultimo Backup</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{stats.lastBackup}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-foreground-muted">Proximo Backup</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{stats.nextBackup}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-cyan-500" />
            <span className="text-sm text-foreground-muted">Cloud</span>
          </div>
          <p className="text-2xl font-bold text-cyan-500">{stats.cloudUsage}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Local</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.localUsage}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: 'backups', label: 'Backups', icon: FileArchive },
            { id: 'schedules', label: 'Agendamentos', icon: Calendar },
            { id: 'restore', label: 'Restaurar', icon: Upload },
            { id: 'settings', label: 'Configuracoes', icon: Settings },
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
      {activeTab === 'backups' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Historico de Backups</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Nome</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Tipo</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Tamanho</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Data</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Local</th>
                  <th className="text-right p-4 text-sm font-medium text-foreground-muted">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backups.map((backup) => {
                  const StatusIcon = getStatusIcon(backup.status);
                  return (
                    <tr key={backup.id} className="hover:bg-surface-hover">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileArchive className="w-5 h-5 text-foreground-muted" />
                          <div>
                            <p className="font-medium text-foreground">{backup.name}</p>
                            <p className="text-xs text-foreground-muted">
                              {backup.systems.length} sistema(s)
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(backup.type)}`}>
                          {getTypeLabel(backup.type)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`w-4 h-4 ${getStatusColor(backup.status).split(' ')[0]}`} />
                          <span className={`text-sm ${getStatusColor(backup.status).split(' ')[0]}`}>
                            {getStatusLabel(backup.status)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground">{backup.size}</td>
                      <td className="p-4 text-sm text-foreground-muted">
                        {new Date(backup.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {backup.location === 'cloud' ? (
                            <Cloud className="w-4 h-4 text-cyan-500" />
                          ) : (
                            <Server className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="text-sm text-foreground-muted capitalize">{backup.location}</span>
                          {backup.encrypted && (
                            <Shield className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {backup.status === 'completed' && (
                            <>
                              <button
                                className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-primary transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-primary transition-colors"
                                title="Restaurar"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-red-500 transition-colors"
                            title="Excluir"
                          >
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

      {activeTab === 'schedules' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Agendamentos</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
              <Calendar className="w-4 h-4" />
              Novo Agendamento
            </button>
          </div>
          <div className="divide-y divide-border">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="p-4 hover:bg-surface-hover">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${getTypeColor(schedule.type)}`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{schedule.name}</h4>
                      <p className="text-sm text-foreground-muted">
                        {schedule.frequency} as {schedule.time} • Retencao: {schedule.retention} dias
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-foreground-muted">Proxima execucao</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(schedule.nextRun).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={() => {}}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-background peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'restore' && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="max-w-xl mx-auto text-center">
            <Upload className="w-16 h-16 mx-auto text-foreground-muted mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Restaurar Backup</h3>
            <p className="text-foreground-muted mb-6">
              Selecione um backup existente ou faca upload de um arquivo de backup
            </p>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors cursor-pointer">
                <FileArchive className="w-8 h-8 mx-auto text-foreground-muted mb-2" />
                <p className="text-sm text-foreground-muted">
                  Arraste um arquivo de backup ou clique para selecionar
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  Formatos suportados: .bkp, .zip, .tar.gz
                </p>
              </div>

              <div className="text-foreground-muted">ou</div>

              <select className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Selecione um backup existente</option>
                {backups.filter(b => b.status === 'completed').map((backup) => (
                  <option key={backup.id} value={backup.id}>
                    {backup.name} ({backup.size})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-4 mt-6 pt-6 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-sm text-foreground">Restaurar apenas configuracoes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-sm text-foreground">Restaurar dados historicos</span>
                </label>
              </div>

              <button className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
                Iniciar Restauracao
              </button>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-left">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-500">Atencao</p>
                    <p className="text-sm text-foreground-muted mt-1">
                      A restauracao ira sobrescrever os dados atuais. Certifique-se de ter um backup recente antes de prosseguir.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Armazenamento Local</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Diretorio de Backup
                </label>
                <input
                  type="text"
                  value="/var/backups/lifo4ems"
                  readOnly
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Espaco Disponivel
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '23%' }} />
                  </div>
                  <span className="text-sm text-foreground">23% de 50 GB</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Retencao Padrao (dias)
                </label>
                <input
                  type="number"
                  defaultValue={30}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Armazenamento Cloud</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Provedor
                </label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option>Amazon S3</option>
                  <option>Google Cloud Storage</option>
                  <option>Azure Blob Storage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Bucket/Container
                </label>
                <input
                  type="text"
                  value="lifo4-ems-backups"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Espaco Utilizado
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-sm text-foreground">65% de 100 GB</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Seguranca</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Criptografia AES-256</p>
                  <p className="text-sm text-foreground-muted">Criptografar todos os backups</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Verificacao de Integridade</p>
                  <p className="text-sm text-foreground-muted">Validar checksum apos backup</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Compressao</p>
                  <p className="text-sm text-foreground-muted">Comprimir backups para economizar espaco</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Notificacoes</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Backup Concluido</p>
                  <p className="text-sm text-foreground-muted">Notificar quando backup finalizar</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Falha no Backup</p>
                  <p className="text-sm text-foreground-muted">Alertar quando backup falhar</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Espaco Baixo</p>
                  <p className="text-sm text-foreground-muted">Alertar quando espaco estiver acabando</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* New Backup Modal */}
      {showNewBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Novo Backup</h3>
              <button
                onClick={() => setShowNewBackup(false)}
                className="p-1 hover:bg-surface-hover rounded"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Tipo de Backup
                </label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="full">Completo (todos os dados)</option>
                  <option value="incremental">Incremental (apenas mudancas)</option>
                  <option value="config">Configuracao (apenas configs)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Sistemas
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span className="text-sm text-foreground">BESS Teresina Norte</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span className="text-sm text-foreground">BESS Piauí Sul</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span className="text-sm text-foreground">BESS Centro</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Destino
                </label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="cloud">Cloud (recomendado)</option>
                  <option value="local">Local</option>
                  <option value="both">Ambos</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-border" />
                <span className="text-sm text-foreground">Criptografar backup</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowNewBackup(false)}
                className="px-4 py-2 text-foreground-muted hover:bg-surface-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Iniciar Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
