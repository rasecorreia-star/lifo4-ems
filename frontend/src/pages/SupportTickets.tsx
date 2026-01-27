import { useMemo, useState } from 'react';
import {
  TicketIcon,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Circle,
  ChevronRight,
  Paperclip,
  Send,
  X,
} from 'lucide-react';

interface Ticket {
  id: string;
  number: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  systemId?: string;
  systemName?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo?: string;
  messages: Message[];
}

interface Message {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  isSupport: boolean;
  attachments?: string[];
}

export default function SupportTickets() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');

  const tickets = useMemo<Ticket[]>(() => [
    {
      id: 'tkt-1',
      number: 'TKT-2025-001',
      title: 'Erro na leitura do BMS',
      description: 'O sistema esta apresentando erro intermitente na leitura dos dados do BMS. Os valores de tensao ficam congelados por alguns segundos.',
      status: 'in_progress',
      priority: 'high',
      category: 'Tecnico',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      createdAt: '2025-01-20T10:30:00',
      updatedAt: '2025-01-21T14:15:00',
      createdBy: 'Carlos Silva',
      assignedTo: 'Suporte Tecnico',
      messages: [
        {
          id: 'msg-1',
          author: 'Carlos Silva',
          content: 'O sistema esta apresentando erro intermitente na leitura dos dados do BMS. Os valores de tensao ficam congelados por alguns segundos.',
          timestamp: '2025-01-20T10:30:00',
          isSupport: false,
        },
        {
          id: 'msg-2',
          author: 'Suporte Tecnico',
          content: 'Olá Carlos, obrigado pelo relato. Poderia informar se o problema ocorre em horários específicos ou de forma aleatória?',
          timestamp: '2025-01-20T11:45:00',
          isSupport: true,
        },
        {
          id: 'msg-3',
          author: 'Carlos Silva',
          content: 'Parece ser aleatório, mas acontece mais durante o período da tarde.',
          timestamp: '2025-01-20T14:20:00',
          isSupport: false,
        },
        {
          id: 'msg-4',
          author: 'Suporte Tecnico',
          content: 'Identificamos que pode ser um problema de latência na comunicação. Estamos trabalhando em uma atualização de firmware que deve resolver o problema.',
          timestamp: '2025-01-21T14:15:00',
          isSupport: true,
        },
      ],
    },
    {
      id: 'tkt-2',
      number: 'TKT-2025-002',
      title: 'Dúvida sobre configuração de alarmes',
      description: 'Gostaria de saber como configurar alarmes personalizados para temperatura das células.',
      status: 'resolved',
      priority: 'low',
      category: 'Suporte',
      createdAt: '2025-01-18T09:00:00',
      updatedAt: '2025-01-18T16:30:00',
      createdBy: 'Maria Santos',
      assignedTo: 'Suporte Tecnico',
      messages: [
        {
          id: 'msg-5',
          author: 'Maria Santos',
          content: 'Gostaria de saber como configurar alarmes personalizados para temperatura das células.',
          timestamp: '2025-01-18T09:00:00',
          isSupport: false,
        },
        {
          id: 'msg-6',
          author: 'Suporte Tecnico',
          content: 'Olá Maria! Você pode configurar alarmes personalizados em Config. Alarmes > Novo Alarme. Selecione a métrica "Temperatura" e defina os limites desejados.',
          timestamp: '2025-01-18T10:15:00',
          isSupport: true,
        },
        {
          id: 'msg-7',
          author: 'Maria Santos',
          content: 'Perfeito, consegui configurar! Obrigada pela ajuda.',
          timestamp: '2025-01-18T16:30:00',
          isSupport: false,
        },
      ],
    },
    {
      id: 'tkt-3',
      number: 'TKT-2025-003',
      title: 'Falha crítica no inversor',
      description: 'Inversor parou de funcionar após queda de energia. Sistema mostra erro E-401.',
      status: 'open',
      priority: 'critical',
      category: 'Emergencia',
      systemId: 'sys-2',
      systemName: 'BESS Piauí Sul',
      createdAt: '2025-01-22T08:45:00',
      updatedAt: '2025-01-22T08:45:00',
      createdBy: 'João Pereira',
      messages: [
        {
          id: 'msg-8',
          author: 'João Pereira',
          content: 'Inversor parou de funcionar após queda de energia. Sistema mostra erro E-401. Preciso de suporte urgente!',
          timestamp: '2025-01-22T08:45:00',
          isSupport: false,
          attachments: ['erro_E401.png'],
        },
      ],
    },
    {
      id: 'tkt-4',
      number: 'TKT-2025-004',
      title: 'Solicitação de novo relatório',
      description: 'Precisamos de um relatório customizado com métricas de eficiência por período.',
      status: 'waiting',
      priority: 'medium',
      category: 'Funcionalidade',
      createdAt: '2025-01-19T11:00:00',
      updatedAt: '2025-01-20T09:30:00',
      createdBy: 'Ana Costa',
      assignedTo: 'Desenvolvimento',
      messages: [
        {
          id: 'msg-9',
          author: 'Ana Costa',
          content: 'Precisamos de um relatório customizado com métricas de eficiência por período do dia.',
          timestamp: '2025-01-19T11:00:00',
          isSupport: false,
        },
        {
          id: 'msg-10',
          author: 'Desenvolvimento',
          content: 'Olá Ana, estamos analisando sua solicitação. Poderia detalhar quais métricas específicas você precisa no relatório?',
          timestamp: '2025-01-20T09:30:00',
          isSupport: true,
        },
      ],
    },
    {
      id: 'tkt-5',
      number: 'TKT-2025-005',
      title: 'Agendamento de manutenção preventiva',
      description: 'Solicito agendamento de manutenção preventiva para o sistema BESS Centro.',
      status: 'closed',
      priority: 'low',
      category: 'Manutencao',
      systemId: 'sys-3',
      systemName: 'BESS Centro',
      createdAt: '2025-01-15T14:00:00',
      updatedAt: '2025-01-17T10:00:00',
      createdBy: 'Pedro Lima',
      assignedTo: 'Equipe Manutencao',
      messages: [
        {
          id: 'msg-11',
          author: 'Pedro Lima',
          content: 'Solicito agendamento de manutenção preventiva para o sistema BESS Centro.',
          timestamp: '2025-01-15T14:00:00',
          isSupport: false,
        },
        {
          id: 'msg-12',
          author: 'Equipe Manutencao',
          content: 'Manutenção agendada para dia 25/01/2025 às 08:00. Nossa equipe entrará em contato para confirmar.',
          timestamp: '2025-01-16T09:00:00',
          isSupport: true,
        },
        {
          id: 'msg-13',
          author: 'Pedro Lima',
          content: 'Perfeito, obrigado!',
          timestamp: '2025-01-17T10:00:00',
          isSupport: false,
        },
      ],
    },
  ], []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
      const matchesSearch = searchTerm === '' ||
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.number.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tickets, filterStatus, searchTerm]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  }), [tickets]);

  const getStatusColor = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return 'text-blue-500 bg-blue-500/20';
      case 'in_progress': return 'text-amber-500 bg-amber-500/20';
      case 'waiting': return 'text-purple-500 bg-purple-500/20';
      case 'resolved': return 'text-green-500 bg-green-500/20';
      case 'closed': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'waiting': return 'Aguardando';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getPriorityColor = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-500 bg-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/20';
      case 'medium': return 'text-amber-500 bg-amber-500/20';
      case 'low': return 'text-green-500 bg-green-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getPriorityLabel = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'critical': return 'Critica';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusIcon = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return Circle;
      case 'in_progress': return Clock;
      case 'waiting': return AlertCircle;
      case 'resolved': return CheckCircle;
      case 'closed': return CheckCircle;
      default: return Circle;
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    // In production, this would send to API
    console.log('Sending message:', newMessage);
    setNewMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets de Suporte</h1>
          <p className="text-foreground-muted">Gerencie suas solicitacoes e acompanhe o atendimento</p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-sm text-foreground-muted">Total</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-sm text-foreground-muted">Abertos</p>
          <p className="text-2xl font-bold text-blue-500">{stats.open}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-sm text-foreground-muted">Em Andamento</p>
          <p className="text-2xl font-bold text-amber-500">{stats.inProgress}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-sm text-foreground-muted">Aguardando</p>
          <p className="text-2xl font-bold text-purple-500">{stats.waiting}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-sm text-foreground-muted">Resolvidos</p>
          <p className="text-2xl font-bold text-green-500">{stats.resolved}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1 bg-surface rounded-lg border border-border">
          {/* Filters */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <input
                type="text"
                placeholder="Buscar tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-foreground-muted" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
              >
                <option value="all">Todos</option>
                <option value="open">Abertos</option>
                <option value="in_progress">Em Andamento</option>
                <option value="waiting">Aguardando</option>
                <option value="resolved">Resolvidos</option>
                <option value="closed">Fechados</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {filteredTickets.map((ticket) => {
              const StatusIcon = getStatusIcon(ticket.status);
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedTicket?.id === ticket.id
                      ? 'bg-primary/10 border-l-2 border-l-primary'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs text-foreground-muted font-mono">{ticket.number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                      {getPriorityLabel(ticket.priority)}
                    </span>
                  </div>
                  <h4 className="font-medium text-foreground text-sm mb-1">{ticket.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                    <StatusIcon className="w-3 h-3" />
                    <span className={getStatusColor(ticket.status).split(' ')[0]}>
                      {getStatusLabel(ticket.status)}
                    </span>
                    <span>•</span>
                    <span>{new Date(ticket.updatedAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {ticket.systemName && (
                    <p className="text-xs text-foreground-muted mt-1">
                      Sistema: {ticket.systemName}
                    </p>
                  )}
                </div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="p-8 text-center">
                <TicketIcon className="w-8 h-8 mx-auto text-foreground-muted mb-2" />
                <p className="text-sm text-foreground-muted">Nenhum ticket encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Ticket Detail */}
        <div className="lg:col-span-2 bg-surface rounded-lg border border-border">
          {selectedTicket ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-foreground-muted font-mono">{selectedTicket.number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                        {getStatusLabel(selectedTicket.status)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                        {getPriorityLabel(selectedTicket.priority)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">{selectedTicket.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="p-1 hover:bg-surface-hover rounded lg:hidden"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {selectedTicket.createdBy}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedTicket.createdAt).toLocaleString('pt-BR')}
                  </span>
                  <span className="px-2 py-0.5 bg-background rounded text-xs">
                    {selectedTicket.category}
                  </span>
                  {selectedTicket.assignedTo && (
                    <span className="flex items-center gap-1">
                      <ChevronRight className="w-4 h-4" />
                      {selectedTicket.assignedTo}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[400px]">
                {selectedTicket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isSupport ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.isSupport
                          ? 'bg-background border border-border'
                          : 'bg-primary/20 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-foreground">
                          {message.author}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          {new Date(message.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Paperclip className="w-3 h-3 text-foreground-muted" />
                          {message.attachments.map((att, idx) => (
                            <span key={idx} className="text-xs text-primary hover:underline cursor-pointer">
                              {att}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply */}
              {selectedTicket.status !== 'closed' && (
                <div className="p-4 border-t border-border">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <textarea
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted">
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleSendMessage}
                        className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="w-12 h-12 text-foreground-muted mb-3" />
              <h3 className="font-medium text-foreground mb-1">Selecione um Ticket</h3>
              <p className="text-sm text-foreground-muted">
                Clique em um ticket para ver detalhes e historico de mensagens
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Novo Ticket</h3>
              <button
                onClick={() => setShowNewTicket(false)}
                className="p-1 hover:bg-surface-hover rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Titulo</label>
                <input
                  type="text"
                  placeholder="Descreva o problema brevemente"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                  <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">Selecione</option>
                    <option value="tecnico">Tecnico</option>
                    <option value="suporte">Suporte</option>
                    <option value="funcionalidade">Funcionalidade</option>
                    <option value="manutencao">Manutencao</option>
                    <option value="emergencia">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
                  <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="low">Baixa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Critica</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sistema (opcional)</label>
                <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Nenhum sistema especifico</option>
                  <option value="sys-1">BESS Teresina Norte</option>
                  <option value="sys-2">BESS Piauí Sul</option>
                  <option value="sys-3">BESS Centro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descricao</label>
                <textarea
                  rows={4}
                  placeholder="Descreva o problema em detalhes..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Anexos</label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Paperclip className="w-6 h-6 mx-auto text-foreground-muted mb-2" />
                  <p className="text-sm text-foreground-muted">
                    Arraste arquivos ou clique para selecionar
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 text-foreground-muted hover:bg-surface-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Criar Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
