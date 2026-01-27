/**
 * Maintenance Page
 * Preventive maintenance scheduling, history, and health monitoring
 */

import { useState, useEffect } from 'react';
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Filter,
  Search,
  ChevronRight,
  Battery,
  Thermometer,
  Activity,
  FileText,
  User,
  Bell,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
type MaintenanceType = 'preventive' | 'corrective' | 'predictive' | 'inspection';
type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

interface MaintenanceTask {
  id: string;
  title: string;
  description: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  systemId: string;
  systemName: string;
  scheduledDate: Date;
  completedDate?: Date;
  assignedTo?: string;
  estimatedDuration: number; // minutes
  actualDuration?: number;
  checklist: ChecklistItem[];
  notes?: string;
  createdAt: Date;
}

interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
}

interface MaintenanceStats {
  scheduled: number;
  inProgress: number;
  completed: number;
  overdue: number;
  thisMonth: number;
  avgCompletionTime: number;
}

const MAINTENANCE_TYPES: Record<MaintenanceType, { label: string; color: string }> = {
  preventive: { label: 'Preventiva', color: 'blue' },
  corrective: { label: 'Corretiva', color: 'red' },
  predictive: { label: 'Preditiva', color: 'purple' },
  inspection: { label: 'Inspecao', color: 'green' },
};

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  scheduled: { label: 'Agendada', color: 'blue', icon: Calendar },
  in_progress: { label: 'Em Andamento', color: 'yellow', icon: Clock },
  completed: { label: 'Concluida', color: 'green', icon: CheckCircle },
  overdue: { label: 'Atrasada', color: 'red', icon: AlertTriangle },
  cancelled: { label: 'Cancelada', color: 'gray', icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<MaintenancePriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'gray' },
  medium: { label: 'Media', color: 'blue' },
  high: { label: 'Alta', color: 'yellow' },
  critical: { label: 'Critica', color: 'red' },
};

// Mock data generator
const generateMockTasks = (): MaintenanceTask[] => {
  const tasks: MaintenanceTask[] = [
    {
      id: '1',
      title: 'Inspecao Visual Mensal',
      description: 'Verificacao visual de conexoes, vazamentos e condicao geral do sistema',
      type: 'inspection',
      priority: 'medium',
      status: 'scheduled',
      systemId: 'sys-001',
      systemName: 'BESS Industrial 01',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      estimatedDuration: 60,
      assignedTo: 'Carlos Silva',
      checklist: [
        { id: '1', task: 'Verificar conexoes eletricas', completed: false },
        { id: '2', task: 'Inspecionar cabos e terminais', completed: false },
        { id: '3', task: 'Checar indicadores do BMS', completed: false },
        { id: '4', task: 'Verificar sistema de refrigeracao', completed: false },
        { id: '5', task: 'Documentar anomalias', completed: false },
      ],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: '2',
      title: 'Balanceamento de Celulas',
      description: 'Balanceamento preventivo das celulas do rack 2 - desvio >50mV detectado',
      type: 'preventive',
      priority: 'high',
      status: 'in_progress',
      systemId: 'sys-001',
      systemName: 'BESS Industrial 01',
      scheduledDate: new Date(),
      estimatedDuration: 240,
      assignedTo: 'Pedro Santos',
      checklist: [
        { id: '1', task: 'Medir tensao individual das celulas', completed: true, completedAt: new Date() },
        { id: '2', task: 'Identificar celulas com desvio', completed: true, completedAt: new Date() },
        { id: '3', task: 'Iniciar balanceamento ativo', completed: false },
        { id: '4', task: 'Monitorar temperatura durante processo', completed: false },
        { id: '5', task: 'Verificar resultado apos 24h', completed: false },
      ],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: '3',
      title: 'Substituicao de Ventilador',
      description: 'Ventilador do rack 3 apresentando ruido - substituicao preventiva',
      type: 'corrective',
      priority: 'medium',
      status: 'overdue',
      systemId: 'sys-002',
      systemName: 'BESS Comercial 02',
      scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      estimatedDuration: 90,
      assignedTo: 'Ana Costa',
      checklist: [
        { id: '1', task: 'Desligar sistema de refrigeracao', completed: false },
        { id: '2', task: 'Remover ventilador defeituoso', completed: false },
        { id: '3', task: 'Instalar ventilador novo', completed: false },
        { id: '4', task: 'Testar funcionamento', completed: false },
        { id: '5', task: 'Registrar troca no historico', completed: false },
      ],
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      id: '4',
      title: 'Calibracao de Sensores',
      description: 'Calibracao trimestral dos sensores de temperatura e corrente',
      type: 'preventive',
      priority: 'low',
      status: 'completed',
      systemId: 'sys-001',
      systemName: 'BESS Industrial 01',
      scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      estimatedDuration: 120,
      actualDuration: 100,
      assignedTo: 'Carlos Silva',
      checklist: [
        { id: '1', task: 'Verificar sensores de temperatura', completed: true },
        { id: '2', task: 'Calibrar sensores de corrente', completed: true },
        { id: '3', task: 'Testar leituras com equipamento de referencia', completed: true },
        { id: '4', task: 'Ajustar offsets no BMS', completed: true },
        { id: '5', task: 'Documentar valores de calibracao', completed: true },
      ],
      notes: 'Calibracao concluida com sucesso. Todos os sensores dentro da especificacao.',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      id: '5',
      title: 'Teste de Black Start',
      description: 'Teste trimestral de capacidade de black start e transferencia de carga',
      type: 'inspection',
      priority: 'high',
      status: 'scheduled',
      systemId: 'sys-001',
      systemName: 'BESS Industrial 01',
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedDuration: 180,
      assignedTo: 'Pedro Santos',
      checklist: [
        { id: '1', task: 'Verificar capacidade do BESS (>80% SOC)', completed: false },
        { id: '2', task: 'Testar desconexao da rede', completed: false },
        { id: '3', task: 'Verificar transicao para modo ilha', completed: false },
        { id: '4', task: 'Medir tempo de resposta', completed: false },
        { id: '5', task: 'Testar reconexao a rede', completed: false },
        { id: '6', task: 'Documentar resultados', completed: false },
      ],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  return tasks;
};

const generateStats = (tasks: MaintenanceTask[]): MaintenanceStats => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    scheduled: tasks.filter(t => t.status === 'scheduled').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    thisMonth: tasks.filter(t => t.scheduledDate >= startOfMonth).length,
    avgCompletionTime: 95, // mock
  };
};

export default function Maintenance() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [filter, setFilter] = useState<MaintenanceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<MaintenanceType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  useEffect(() => {
    const mockTasks = generateMockTasks();
    setTasks(mockTasks);
    setStats(generateStats(mockTasks));
  }, []);

  const filteredTasks = tasks.filter(task => {
    if (filter !== 'all' && task.status !== filter) return false;
    if (typeFilter !== 'all' && task.type !== typeFilter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.systemName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleChecklistToggle = (taskId: string, itemId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        checklist: task.checklist.map(item => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? new Date() : undefined,
          };
        }),
      };
    }));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manutencao</h1>
          <p className="text-foreground-muted text-sm">
            Gerenciamento de manutencao preventiva e corretiva
          </p>
        </div>
        <button
          onClick={() => setShowNewTaskModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Agendadas"
            value={stats.scheduled}
            icon={Calendar}
            color="blue"
          />
          <StatCard
            label="Em Andamento"
            value={stats.inProgress}
            icon={Clock}
            color="yellow"
          />
          <StatCard
            label="Concluidas"
            value={stats.completed}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            label="Atrasadas"
            value={stats.overdue}
            icon={AlertTriangle}
            color="red"
            highlight={stats.overdue > 0}
          />
          <StatCard
            label="Este Mes"
            value={stats.thisMonth}
            icon={Calendar}
            color="purple"
          />
          <StatCard
            label="Tempo Medio"
            value={`${stats.avgCompletionTime}min`}
            icon={Clock}
            color="gray"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por titulo ou sistema..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos Tipos</option>
            {Object.entries(MAINTENANCE_TYPES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tasks List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 text-foreground-muted opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma tarefa encontrada</h3>
              <p className="text-foreground-muted">Ajuste os filtros ou crie uma nova tarefa</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const statusConfig = STATUS_CONFIG[task.status];
              const typeConfig = MAINTENANCE_TYPES[task.type];
              const priorityConfig = PRIORITY_CONFIG[task.priority];
              const StatusIcon = statusConfig.icon;
              const completedItems = task.checklist.filter(i => i.completed).length;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={cn(
                    'bg-surface rounded-xl border p-4 cursor-pointer transition-all hover:border-primary/50',
                    selectedTask?.id === task.id ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                    task.status === 'overdue' && 'border-danger-500/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          `bg-${typeConfig.color}-500/10 text-${typeConfig.color}-500`
                        )}>
                          {typeConfig.label}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          `bg-${priorityConfig.color}-500/10 text-${priorityConfig.color}-500`
                        )}>
                          {priorityConfig.label}
                        </span>
                        <span className={cn(
                          'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                          `bg-${statusConfig.color}-500/10 text-${statusConfig.color}-500`
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>

                      <h3 className="font-semibold text-foreground mb-1">{task.title}</h3>
                      <p className="text-sm text-foreground-muted line-clamp-2">{task.description}</p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-foreground-muted">
                        <span className="flex items-center gap-1">
                          <Battery className="w-3 h-3" />
                          {task.systemName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.scheduledDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(task.estimatedDuration)}
                        </span>
                        {task.assignedTo && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {task.assignedTo}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-foreground-muted">Checklist</span>
                          <span className="text-foreground">{completedItems}/{task.checklist.length}</span>
                        </div>
                        <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              completedItems === task.checklist.length ? 'bg-success-500' : 'bg-primary'
                            )}
                            style={{ width: `${(completedItems / task.checklist.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-foreground-muted" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Task Detail */}
        <div className="bg-surface rounded-xl border border-border p-6">
          {selectedTask ? (
            <TaskDetail
              task={selectedTask}
              onChecklistToggle={handleChecklistToggle}
              formatDate={formatDate}
              formatDuration={formatDuration}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-foreground-muted">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Selecione uma tarefa</p>
              <p className="text-xs">para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon: Icon, color, highlight }: {
  label: string;
  value: number | string;
  icon: typeof Wrench;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'bg-surface rounded-lg border p-4',
      highlight ? 'border-danger-500 shadow-glow-red' : 'border-border'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', `bg-${color}-500/10`)}>
          <Icon className={cn('w-5 h-5', `text-${color}-500`)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Task Detail Component
function TaskDetail({ task, onChecklistToggle, formatDate, formatDuration }: {
  task: MaintenanceTask;
  onChecklistToggle: (taskId: string, itemId: string) => void;
  formatDate: (date: Date) => string;
  formatDuration: (minutes: number) => string;
}) {
  const statusConfig = STATUS_CONFIG[task.status];
  const typeConfig = MAINTENANCE_TYPES[task.type];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            `bg-${typeConfig.color}-500/10 text-${typeConfig.color}-500`
          )}>
            {typeConfig.label}
          </span>
          <span className={cn(
            'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
            `bg-${statusConfig.color}-500/10 text-${statusConfig.color}-500`
          )}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{task.title}</h2>
        <p className="text-sm text-foreground-muted mt-1">{task.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-foreground-muted">Sistema</span>
          <p className="font-medium text-foreground">{task.systemName}</p>
        </div>
        <div>
          <span className="text-foreground-muted">Responsavel</span>
          <p className="font-medium text-foreground">{task.assignedTo || 'Nao atribuido'}</p>
        </div>
        <div>
          <span className="text-foreground-muted">Data Agendada</span>
          <p className="font-medium text-foreground">{formatDate(task.scheduledDate)}</p>
        </div>
        <div>
          <span className="text-foreground-muted">Duracao Est.</span>
          <p className="font-medium text-foreground">{formatDuration(task.estimatedDuration)}</p>
        </div>
      </div>

      {/* Checklist */}
      <div>
        <h3 className="font-medium text-foreground mb-3">Checklist</h3>
        <div className="space-y-2">
          {task.checklist.map((item) => (
            <label
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                item.completed ? 'bg-success-500/10' : 'bg-surface-hover hover:bg-surface-active'
              )}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => onChecklistToggle(task.id, item.id)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className={cn(
                'text-sm',
                item.completed ? 'text-foreground-muted line-through' : 'text-foreground'
              )}>
                {item.task}
              </span>
            </label>
          ))}
        </div>
      </div>

      {task.notes && (
        <div>
          <h3 className="font-medium text-foreground mb-2">Observacoes</h3>
          <p className="text-sm text-foreground-muted bg-surface-hover p-3 rounded-lg">
            {task.notes}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        {task.status === 'scheduled' && (
          <button className="flex-1 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">
            Iniciar Tarefa
          </button>
        )}
        {task.status === 'in_progress' && (
          <button className="flex-1 px-4 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg text-sm font-medium transition-colors">
            Concluir Tarefa
          </button>
        )}
        <button className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover text-sm font-medium transition-colors">
          Editar
        </button>
      </div>
    </div>
  );
}
