import { useMemo, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Wrench,
  Calendar,
  MapPin,
  FileText,
  MessageSquare,
  Paperclip,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  description: string;
  type: 'preventive' | 'corrective' | 'emergency' | 'inspection';
  status: 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  systemId: string;
  systemName: string;
  location: string;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  scheduledDate: string;
  completedAt?: string;
  estimatedHours: number;
  actualHours?: number;
  parts: { name: string; quantity: number; cost: number }[];
  comments: number;
  attachments: number;
}

export default function WorkOrders() {
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in_progress' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);

  const workOrders = useMemo<WorkOrder[]>(() => [
    {
      id: 'wo-1',
      number: 'WO-2025-001',
      title: 'Manutencao Preventiva Trimestral',
      description: 'Realizar manutencao preventiva trimestral conforme checklist padrao',
      type: 'preventive',
      status: 'in_progress',
      priority: 'medium',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      location: 'Teresina, PI',
      assignedTo: 'Carlos Silva',
      createdBy: 'Sistema',
      createdAt: '2025-01-20T08:00:00',
      scheduledDate: '2025-01-22T08:00:00',
      estimatedHours: 8,
      actualHours: 4,
      parts: [
        { name: 'Filtro de Ar', quantity: 2, cost: 150 },
        { name: 'Oleo Lubrificante', quantity: 5, cost: 80 },
      ],
      comments: 3,
      attachments: 2,
    },
    {
      id: 'wo-2',
      number: 'WO-2025-002',
      title: 'Substituicao de Celula Defeituosa',
      description: 'Substituir celula M3-C12 que apresentou queda de capacidade',
      type: 'corrective',
      status: 'open',
      priority: 'high',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      location: 'Teresina, PI',
      assignedTo: 'Joao Pereira',
      createdBy: 'Ana Costa',
      createdAt: '2025-01-21T14:30:00',
      scheduledDate: '2025-01-23T08:00:00',
      estimatedHours: 4,
      parts: [
        { name: 'Celula LFP 280Ah', quantity: 1, cost: 2500 },
      ],
      comments: 1,
      attachments: 1,
    },
    {
      id: 'wo-3',
      number: 'WO-2025-003',
      title: 'Reparo Emergencial - Inversor',
      description: 'Inversor apresentou falha E-401 apos queda de energia',
      type: 'emergency',
      status: 'completed',
      priority: 'critical',
      systemId: 'sys-2',
      systemName: 'BESS Piaui Sul',
      location: 'Floriano, PI',
      assignedTo: 'Pedro Santos',
      createdBy: 'Sistema',
      createdAt: '2025-01-19T03:45:00',
      scheduledDate: '2025-01-19T06:00:00',
      completedAt: '2025-01-19T10:30:00',
      estimatedHours: 6,
      actualHours: 4.5,
      parts: [
        { name: 'Placa Controladora', quantity: 1, cost: 3500 },
        { name: 'Fusivel 100A', quantity: 3, cost: 45 },
      ],
      comments: 5,
      attachments: 4,
    },
    {
      id: 'wo-4',
      number: 'WO-2025-004',
      title: 'Inspecao Mensal de Seguranca',
      description: 'Realizar inspecao mensal de todos os sistemas de seguranca',
      type: 'inspection',
      status: 'open',
      priority: 'medium',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      location: 'Teresina, PI',
      assignedTo: 'Maria Souza',
      createdBy: 'Sistema',
      createdAt: '2025-01-22T00:00:00',
      scheduledDate: '2025-01-25T08:00:00',
      estimatedHours: 3,
      parts: [],
      comments: 0,
      attachments: 0,
    },
    {
      id: 'wo-5',
      number: 'WO-2025-005',
      title: 'Calibracao de Sensores',
      description: 'Calibrar sensores de temperatura e tensao',
      type: 'preventive',
      status: 'on_hold',
      priority: 'low',
      systemId: 'sys-3',
      systemName: 'BESS Centro',
      location: 'Teresina, PI',
      assignedTo: 'Lucas Oliveira',
      createdBy: 'Ana Costa',
      createdAt: '2025-01-18T10:00:00',
      scheduledDate: '2025-01-24T14:00:00',
      estimatedHours: 2,
      parts: [],
      comments: 2,
      attachments: 0,
    },
    {
      id: 'wo-6',
      number: 'WO-2025-006',
      title: 'Limpeza de Paineis Solares',
      description: 'Limpeza geral dos paineis solares do sistema hibrido',
      type: 'preventive',
      status: 'completed',
      priority: 'low',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      location: 'Teresina, PI',
      assignedTo: 'Carlos Silva',
      createdBy: 'Sistema',
      createdAt: '2025-01-15T08:00:00',
      scheduledDate: '2025-01-17T06:00:00',
      completedAt: '2025-01-17T09:30:00',
      estimatedHours: 4,
      actualHours: 3.5,
      parts: [
        { name: 'Detergente Especial', quantity: 2, cost: 120 },
      ],
      comments: 1,
      attachments: 3,
    },
  ], []);

  const filteredOrders = useMemo(() => {
    return workOrders.filter(order => {
      const matchesTab = activeTab === 'all' ||
        (activeTab === 'open' && order.status === 'open') ||
        (activeTab === 'in_progress' && (order.status === 'in_progress' || order.status === 'on_hold')) ||
        (activeTab === 'completed' && (order.status === 'completed' || order.status === 'cancelled'));
      const matchesSearch = searchTerm === '' ||
        order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.systemName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [workOrders, activeTab, searchTerm]);

  const stats = useMemo(() => ({
    total: workOrders.length,
    open: workOrders.filter(o => o.status === 'open').length,
    inProgress: workOrders.filter(o => o.status === 'in_progress' || o.status === 'on_hold').length,
    completed: workOrders.filter(o => o.status === 'completed').length,
    overdue: workOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && new Date(o.scheduledDate) < new Date()).length,
  }), [workOrders]);

  const getTypeColor = (type: WorkOrder['type']) => {
    switch (type) {
      case 'preventive': return 'text-blue-500 bg-blue-500/20';
      case 'corrective': return 'text-amber-500 bg-amber-500/20';
      case 'emergency': return 'text-red-500 bg-red-500/20';
      case 'inspection': return 'text-purple-500 bg-purple-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getTypeLabel = (type: WorkOrder['type']) => {
    switch (type) {
      case 'preventive': return 'Preventiva';
      case 'corrective': return 'Corretiva';
      case 'emergency': return 'Emergencia';
      case 'inspection': return 'Inspecao';
      default: return type;
    }
  };

  const getStatusColor = (status: WorkOrder['status']) => {
    switch (status) {
      case 'open': return 'text-blue-500 bg-blue-500/20';
      case 'in_progress': return 'text-amber-500 bg-amber-500/20';
      case 'on_hold': return 'text-purple-500 bg-purple-500/20';
      case 'completed': return 'text-green-500 bg-green-500/20';
      case 'cancelled': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: WorkOrder['status']) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'in_progress': return 'Em Andamento';
      case 'on_hold': return 'Em Espera';
      case 'completed': return 'Concluida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusIcon = (status: WorkOrder['status']) => {
    switch (status) {
      case 'open': return Clock;
      case 'in_progress': return Play;
      case 'on_hold': return Pause;
      case 'completed': return CheckCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  const getPriorityColor = (priority: WorkOrder['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
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
          <h1 className="text-2xl font-bold text-foreground">Ordens de Servico</h1>
          <p className="text-foreground-muted">Gerencie ordens de trabalho e manutencao</p>
        </div>
        <button
          onClick={() => setShowNewOrder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-foreground-muted">Abertas</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.open}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Em Andamento</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.inProgress}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Concluidas</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Atrasadas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Buscar ordens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'open', label: 'Abertas' },
            { id: 'in_progress', label: 'Em Andamento' },
            { id: 'completed', label: 'Concluidas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredOrders.map((order) => {
            const StatusIcon = getStatusIcon(order.status);
            const isOverdue = order.status !== 'completed' && order.status !== 'cancelled' && new Date(order.scheduledDate) < new Date();

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`bg-surface rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedOrder?.id === order.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(order.type)}`}>
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground-muted font-mono">{order.number}</span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-500 rounded text-xs font-medium">
                            Atrasada
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-foreground">{order.title}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getPriorityColor(order.priority)} bg-current`} />
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-foreground-muted mb-3 line-clamp-2">{order.description}</p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {order.systemName}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {order.assignedTo}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(order.scheduledDate).toLocaleDateString('pt-BR')}
                  </span>
                  {order.comments > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {order.comments}
                    </span>
                  )}
                  {order.attachments > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="w-4 h-4" />
                      {order.attachments}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="bg-surface rounded-lg border border-border p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
              <p className="text-foreground-muted">Nenhuma ordem encontrada</p>
            </div>
          )}
        </div>

        {/* Order Detail */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <div className="bg-surface rounded-lg border border-border sticky top-4">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-foreground-muted font-mono">{selectedOrder.number}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(selectedOrder.type)}`}>
                    {getTypeLabel(selectedOrder.type)}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground">{selectedOrder.title}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Descricao</p>
                  <p className="text-sm text-foreground">{selectedOrder.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Sistema</p>
                    <p className="text-sm font-medium text-foreground">{selectedOrder.systemName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Local</p>
                    <p className="text-sm font-medium text-foreground">{selectedOrder.location}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Responsavel</p>
                    <p className="text-sm font-medium text-foreground">{selectedOrder.assignedTo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Criado por</p>
                    <p className="text-sm font-medium text-foreground">{selectedOrder.createdBy}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Agendado</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(selectedOrder.scheduledDate).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Horas Est./Real</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedOrder.estimatedHours}h / {selectedOrder.actualHours || '-'}h
                    </p>
                  </div>
                </div>

                {selectedOrder.parts.length > 0 && (
                  <div>
                    <p className="text-xs text-foreground-muted mb-2">Pecas/Materiais</p>
                    <div className="space-y-2">
                      {selectedOrder.parts.map((part, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-background rounded">
                          <span className="text-sm text-foreground">{part.name} x{part.quantity}</span>
                          <span className="text-sm text-foreground-muted">R$ {part.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border flex flex-wrap gap-2">
                  {selectedOrder.status === 'open' && (
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                      <Play className="w-4 h-4" />
                      Iniciar
                    </button>
                  )}
                  {selectedOrder.status === 'in_progress' && (
                    <>
                      <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors">
                        <CheckCircle className="w-4 h-4" />
                        Concluir
                      </button>
                      <button className="flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors">
                        <Pause className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {selectedOrder.status === 'on_hold' && (
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                      Retomar
                    </button>
                  )}
                  <button className="flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors">
                    <FileText className="w-4 h-4" />
                    Detalhes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-lg border border-border p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
              <p className="text-foreground-muted">Selecione uma ordem para ver detalhes</p>
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
              <h3 className="font-semibold text-foreground">Nova Ordem de Servico</h3>
              <button onClick={() => setShowNewOrder(false)} className="p-1 hover:bg-surface-hover rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Titulo</label>
                <input
                  type="text"
                  placeholder="Titulo da ordem"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
                  <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                    <option value="preventive">Preventiva</option>
                    <option value="corrective">Corretiva</option>
                    <option value="emergency">Emergencia</option>
                    <option value="inspection">Inspecao</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
                  <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                    <option value="low">Baixa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Critica</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sistema</label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="">Selecione</option>
                  <option value="sys-1">BESS Teresina Norte</option>
                  <option value="sys-2">BESS Piaui Sul</option>
                  <option value="sys-3">BESS Centro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Responsavel</label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="">Selecione</option>
                  <option value="1">Carlos Silva</option>
                  <option value="2">Joao Pereira</option>
                  <option value="3">Maria Souza</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Data Agendada</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Horas Estimadas</label>
                  <input
                    type="number"
                    placeholder="Ex: 4"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descricao</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o servico a ser realizado..."
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border sticky bottom-0 bg-surface">
              <button
                onClick={() => setShowNewOrder(false)}
                className="px-4 py-2 text-foreground-muted hover:bg-surface-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Criar Ordem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
