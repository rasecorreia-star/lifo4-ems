import { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Settings,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  History,
  Timer,
  Zap,
  Database,
  Mail,
  FileText,
  HardDrive,
} from 'lucide-react';

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  type: 'backup' | 'report' | 'optimization' | 'maintenance' | 'notification' | 'sync';
  schedule: string;
  nextRun: string;
  lastRun: string;
  lastStatus: 'success' | 'failed' | 'warning' | 'pending';
  enabled: boolean;
  priority: 'high' | 'medium' | 'low';
  duration?: string;
}

interface TaskExecution {
  id: string;
  taskId: string;
  taskName: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'failed' | 'warning';
  duration: string;
  details?: string;
}

export default function ScheduledTasks() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'history' | 'settings'>('tasks');
  const [showNewTask, setShowNewTask] = useState(false);

  const tasks = useMemo<ScheduledTask[]>(() => [
    {
      id: 'task-1',
      name: 'Backup Diario',
      description: 'Backup incremental de todos os dados do sistema',
      type: 'backup',
      schedule: 'Diariamente as 03:00',
      nextRun: '2025-01-23T03:00:00',
      lastRun: '2025-01-22T03:00:00',
      lastStatus: 'success',
      enabled: true,
      priority: 'high',
      duration: '15 min',
    },
    {
      id: 'task-2',
      name: 'Relatorio Semanal',
      description: 'Gerar e enviar relatorio semanal de performance',
      type: 'report',
      schedule: 'Segunda-feira as 08:00',
      nextRun: '2025-01-27T08:00:00',
      lastRun: '2025-01-20T08:00:00',
      lastStatus: 'success',
      enabled: true,
      priority: 'medium',
      duration: '5 min',
    },
    {
      id: 'task-3',
      name: 'Otimizacao de Carga',
      description: 'Executar algoritmo de otimizacao de carga/descarga',
      type: 'optimization',
      schedule: 'A cada 15 minutos',
      nextRun: '2025-01-22T20:00:00',
      lastRun: '2025-01-22T19:45:00',
      lastStatus: 'success',
      enabled: true,
      priority: 'high',
      duration: '30 seg',
    },
    {
      id: 'task-4',
      name: 'Verificacao de Saude',
      description: 'Verificar saude das baterias e gerar alertas',
      type: 'maintenance',
      schedule: 'A cada hora',
      nextRun: '2025-01-22T20:00:00',
      lastRun: '2025-01-22T19:00:00',
      lastStatus: 'warning',
      enabled: true,
      priority: 'high',
      duration: '2 min',
    },
    {
      id: 'task-5',
      name: 'Sincronizacao Cloud',
      description: 'Sincronizar dados com servidor cloud',
      type: 'sync',
      schedule: 'A cada 5 minutos',
      nextRun: '2025-01-22T19:50:00',
      lastRun: '2025-01-22T19:45:00',
      lastStatus: 'success',
      enabled: true,
      priority: 'medium',
      duration: '10 seg',
    },
    {
      id: 'task-6',
      name: 'Limpeza de Logs',
      description: 'Remover logs antigos (mais de 90 dias)',
      type: 'maintenance',
      schedule: 'Mensalmente no dia 1',
      nextRun: '2025-02-01T02:00:00',
      lastRun: '2025-01-01T02:00:00',
      lastStatus: 'success',
      enabled: true,
      priority: 'low',
      duration: '8 min',
    },
    {
      id: 'task-7',
      name: 'Notificacao de Expiracao',
      description: 'Verificar e notificar sobre garantias expirando',
      type: 'notification',
      schedule: 'Diariamente as 09:00',
      nextRun: '2025-01-23T09:00:00',
      lastRun: '2025-01-22T09:00:00',
      lastStatus: 'success',
      enabled: true,
      priority: 'low',
      duration: '1 min',
    },
    {
      id: 'task-8',
      name: 'Backup Completo',
      description: 'Backup completo semanal de todos os dados',
      type: 'backup',
      schedule: 'Domingo as 02:00',
      nextRun: '2025-01-26T02:00:00',
      lastRun: '2025-01-19T02:00:00',
      lastStatus: 'failed',
      enabled: false,
      priority: 'high',
      duration: '45 min',
    },
  ], []);

  const executions = useMemo<TaskExecution[]>(() => [
    {
      id: 'exec-1',
      taskId: 'task-1',
      taskName: 'Backup Diario',
      startedAt: '2025-01-22T03:00:00',
      completedAt: '2025-01-22T03:15:00',
      status: 'success',
      duration: '15 min',
      details: 'Backup concluido. 2.4 GB processados.',
    },
    {
      id: 'exec-2',
      taskId: 'task-3',
      taskName: 'Otimizacao de Carga',
      startedAt: '2025-01-22T19:45:00',
      completedAt: '2025-01-22T19:45:30',
      status: 'success',
      duration: '30 seg',
      details: 'Otimizacao aplicada. Economia estimada: R$ 234.56',
    },
    {
      id: 'exec-3',
      taskId: 'task-4',
      taskName: 'Verificacao de Saude',
      startedAt: '2025-01-22T19:00:00',
      completedAt: '2025-01-22T19:02:00',
      status: 'warning',
      duration: '2 min',
      details: 'Verificacao concluida com alertas. 2 celulas com temperatura elevada.',
    },
    {
      id: 'exec-4',
      taskId: 'task-5',
      taskName: 'Sincronizacao Cloud',
      startedAt: '2025-01-22T19:45:00',
      completedAt: '2025-01-22T19:45:10',
      status: 'success',
      duration: '10 seg',
    },
    {
      id: 'exec-5',
      taskId: 'task-8',
      taskName: 'Backup Completo',
      startedAt: '2025-01-19T02:00:00',
      completedAt: '2025-01-19T02:30:00',
      status: 'failed',
      duration: '30 min',
      details: 'Erro: Espaco em disco insuficiente no destino.',
    },
  ], []);

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter(t => t.enabled).length,
    successful: executions.filter(e => e.status === 'success').length,
    failed: executions.filter(e => e.status === 'failed').length,
  }), [tasks, executions]);

  const getTypeIcon = (type: ScheduledTask['type']) => {
    switch (type) {
      case 'backup': return HardDrive;
      case 'report': return FileText;
      case 'optimization': return Zap;
      case 'maintenance': return Settings;
      case 'notification': return Mail;
      case 'sync': return Database;
      default: return Clock;
    }
  };

  const getTypeColor = (type: ScheduledTask['type']) => {
    switch (type) {
      case 'backup': return 'text-blue-500 bg-blue-500/20';
      case 'report': return 'text-purple-500 bg-purple-500/20';
      case 'optimization': return 'text-amber-500 bg-amber-500/20';
      case 'maintenance': return 'text-green-500 bg-green-500/20';
      case 'notification': return 'text-pink-500 bg-pink-500/20';
      case 'sync': return 'text-cyan-500 bg-cyan-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusColor = (status: ScheduledTask['lastStatus'] | TaskExecution['status']) => {
    switch (status) {
      case 'success': return 'text-green-500 bg-green-500/20';
      case 'failed': return 'text-red-500 bg-red-500/20';
      case 'warning': return 'text-amber-500 bg-amber-500/20';
      case 'pending': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: ScheduledTask['lastStatus'] | TaskExecution['status']) => {
    switch (status) {
      case 'success': return CheckCircle;
      case 'failed': return XCircle;
      case 'warning': return AlertTriangle;
      case 'pending': return Clock;
      default: return Clock;
    }
  };

  const getPriorityColor = (priority: ScheduledTask['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas Agendadas</h1>
          <p className="text-foreground-muted">Gerencie tarefas automatizadas do sistema</p>
        </div>
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Total de Tarefas</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Tarefas Ativas</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.active}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground-muted">Execucoes OK</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.successful}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Falhas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: 'tasks', label: 'Tarefas', icon: Calendar },
            { id: 'history', label: 'Historico', icon: History },
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
      {activeTab === 'tasks' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Tarefa</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Agendamento</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Proxima Execucao</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Ultima Execucao</th>
                  <th className="text-center p-4 text-sm font-medium text-foreground-muted">Status</th>
                  <th className="text-right p-4 text-sm font-medium text-foreground-muted">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((task) => {
                  const TypeIcon = getTypeIcon(task.type);
                  const StatusIcon = getStatusIcon(task.lastStatus);
                  return (
                    <tr key={task.id} className={`hover:bg-surface-hover ${!task.enabled ? 'opacity-50' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getTypeColor(task.type)}`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{task.name}</p>
                            <p className="text-sm text-foreground-muted">{task.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-foreground">{task.schedule}</p>
                        <p className="text-xs text-foreground-muted flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {task.duration}
                        </p>
                      </td>
                      <td className="p-4 text-sm text-foreground">
                        {new Date(task.nextRun).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-sm text-foreground-muted">
                        {new Date(task.lastRun).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <StatusIcon className={`w-4 h-4 ${getStatusColor(task.lastStatus).split(' ')[0]}`} />
                          <span className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)} bg-current`} title={`Prioridade ${task.priority}`} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-green-500 transition-colors"
                            title="Executar Agora"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                            title={task.enabled ? 'Pausar' : 'Ativar'}
                          >
                            {task.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                            title="Configurar"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
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

      {activeTab === 'history' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Historico de Execucoes</h3>
            <select className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground">
              <option>Ultimas 24 horas</option>
              <option>Ultima semana</option>
              <option>Ultimo mes</option>
            </select>
          </div>
          <div className="divide-y divide-border">
            {executions.map((exec) => {
              const StatusIcon = getStatusIcon(exec.status);
              return (
                <div key={exec.id} className="p-4 hover:bg-surface-hover">
                  <div className="flex items-start gap-4">
                    <StatusIcon className={`w-5 h-5 ${getStatusColor(exec.status).split(' ')[0]} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{exec.taskName}</p>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(exec.status)}`}>
                          {exec.status === 'success' ? 'Sucesso' : exec.status === 'failed' ? 'Falhou' : 'Alerta'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-foreground-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(exec.startedAt).toLocaleString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {exec.duration}
                        </span>
                      </div>
                      {exec.details && (
                        <p className="mt-2 text-sm text-foreground-muted bg-background rounded p-2">
                          {exec.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Configuracoes Gerais</h3>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Maximo de Execucoes Simultaneas
                </label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option>1</option>
                  <option>2</option>
                  <option selected>3</option>
                  <option>5</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Timeout Padrao (minutos)
                </label>
                <input
                  type="number"
                  defaultValue={30}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Retentacao de Historico (dias)
                </label>
                <input
                  type="number"
                  defaultValue={90}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Notificacoes</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Notificar Falhas</p>
                  <p className="text-sm text-foreground-muted">Enviar alerta quando uma tarefa falhar</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Notificar Alertas</p>
                  <p className="text-sm text-foreground-muted">Enviar alerta para tarefas com warnings</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Resumo Diario</p>
                  <p className="text-sm text-foreground-muted">Enviar resumo diario de todas as execucoes</p>
                </div>
                <input type="checkbox" className="rounded border-border" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Nova Tarefa Agendada</h3>
              <button onClick={() => setShowNewTask(false)} className="p-1 hover:bg-surface-hover rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input
                  type="text"
                  placeholder="Nome da tarefa"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="backup">Backup</option>
                  <option value="report">Relatorio</option>
                  <option value="optimization">Otimizacao</option>
                  <option value="maintenance">Manutencao</option>
                  <option value="notification">Notificacao</option>
                  <option value="sync">Sincronizacao</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Agendamento</label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option>A cada 5 minutos</option>
                  <option>A cada 15 minutos</option>
                  <option>A cada hora</option>
                  <option>Diariamente</option>
                  <option>Semanalmente</option>
                  <option>Mensalmente</option>
                  <option>Personalizado (cron)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descricao</label>
                <textarea
                  rows={2}
                  placeholder="Descricao da tarefa"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowNewTask(false)}
                className="px-4 py-2 text-foreground-muted hover:bg-surface-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Criar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
