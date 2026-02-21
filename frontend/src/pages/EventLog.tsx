/**
 * Event Log Page
 * System events, alarms, control actions, and activity history
 */

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  History,
  RefreshCw,
  Download,
  Filter,
  Search,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Zap,
  Wifi,
  WifiOff,
  Settings,
  User,
  Clock,
  ChevronDown,
  ArrowUpRight,
  Battery,
  Thermometer,
  Activity,
  Shield,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

type EventType = 'system' | 'alarm' | 'control' | 'telemetry' | 'config' | 'auth';
type EventSeverity = 'info' | 'warning' | 'error' | 'success';

interface SystemEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  severity: EventSeverity;
  title: string;
  message: string;
  systemId?: string;
  systemName?: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

// Generate mock events
const generateMockEvents = (): SystemEvent[] => {
  const eventTypes: Array<{
    type: EventType;
    severity: EventSeverity;
    title: string;
    message: string;
  }> = [
    { type: 'system', severity: 'success', title: 'Sistema conectado', message: 'Conexao estabelecida com sucesso' },
    { type: 'system', severity: 'error', title: 'Sistema desconectado', message: 'Perda de comunicacao com o dispositivo' },
    { type: 'system', severity: 'info', title: 'Heartbeat recebido', message: 'Sinal de vida recebido do BMS' },
    { type: 'alarm', severity: 'error', title: 'Temperatura alta', message: 'Temperatura excedeu limite maximo de 45°C' },
    { type: 'alarm', severity: 'warning', title: 'SOC baixo', message: 'Estado de carga abaixo de 20%' },
    { type: 'alarm', severity: 'warning', title: 'Tensao desbalanceada', message: 'Delta de tensao entre celulas acima de 100mV' },
    { type: 'alarm', severity: 'error', title: 'Sobrecorrente', message: 'Corrente de descarga excedeu limite de seguranca' },
    { type: 'control', severity: 'info', title: 'Carga iniciada', message: 'Processo de carga iniciado pelo usuario' },
    { type: 'control', severity: 'info', title: 'Descarga iniciada', message: 'Processo de descarga iniciado automaticamente' },
    { type: 'control', severity: 'warning', title: 'Parada de emergencia', message: 'Sistema parado por comando de emergencia' },
    { type: 'control', severity: 'success', title: 'Balanceamento concluido', message: 'Balanceamento de celulas finalizado' },
    { type: 'telemetry', severity: 'info', title: 'Dados recebidos', message: 'Telemetria atualizada via Modbus TCP' },
    { type: 'telemetry', severity: 'warning', title: 'Timeout de comunicacao', message: 'Resposta Modbus nao recebida no tempo esperado' },
    { type: 'config', severity: 'info', title: 'Configuracao alterada', message: 'Parametros de protecao atualizados' },
    { type: 'config', severity: 'info', title: 'Agendamento criado', message: 'Novo agendamento de carga configurado' },
    { type: 'auth', severity: 'info', title: 'Login realizado', message: 'Usuario autenticado com sucesso' },
    { type: 'auth', severity: 'warning', title: 'Tentativa de login falhou', message: 'Credenciais invalidas' },
    { type: 'auth', severity: 'info', title: 'Permissoes alteradas', message: 'Nivel de acesso do usuario modificado' },
  ];

  const systems = [
    { id: 'sys-1', name: 'BESS Principal' },
    { id: 'sys-2', name: 'BESS Backup' },
    { id: 'sys-3', name: 'Sistema Solar' },
  ];

  const users = [
    { id: 'user-1', name: 'Admin' },
    { id: 'user-2', name: 'Tecnico' },
    { id: 'user-3', name: 'Sistema' },
  ];

  const events: SystemEvent[] = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const template = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const system = systems[Math.floor(Math.random() * systems.length)];
    const user = users[Math.floor(Math.random() * users.length)];

    events.push({
      id: `evt-${i}`,
      timestamp: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      type: template.type,
      severity: template.severity,
      title: template.title,
      message: template.message,
      systemId: template.type !== 'auth' ? system.id : undefined,
      systemName: template.type !== 'auth' ? system.name : undefined,
      userId: user.id,
      userName: user.name,
      metadata: {
        ip: '192.168.1.' + Math.floor(Math.random() * 255),
        details: `Evento ${i + 1} gerado para teste`,
      },
    });
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export default function EventLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<SystemEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockEvents = generateMockEvents();
      setEvents(mockEvents);
      setFilteredEvents(mockEvents);
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    let filtered = events;

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.message.toLowerCase().includes(query) ||
          e.systemName?.toLowerCase().includes(query) ||
          e.userName?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((e) => e.type === typeFilter);
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter((e) => e.severity === severityFilter);
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, typeFilter, severityFilter]);

  const eventStats = {
    total: events.length,
    errors: events.filter((e) => e.severity === 'error').length,
    warnings: events.filter((e) => e.severity === 'warning').length,
    info: events.filter((e) => e.severity === 'info').length,
  };

  if (isLoading) {
    return <EventLogSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Log de Eventos
          </h1>
          <p className="text-foreground-muted text-sm">
            Historico de eventos, alarmes e atividades do sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsLoading(true);
              setTimeout(() => {
                setEvents(generateMockEvents());
                setIsLoading(false);
              }, 500);
            }}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de Eventos"
          value={eventStats.total}
          icon={Activity}
          color="primary"
        />
        <StatCard
          label="Erros"
          value={eventStats.errors}
          icon={XCircle}
          color="danger"
        />
        <StatCard
          label="Avisos"
          value={eventStats.warnings}
          icon={AlertTriangle}
          color="warning"
        />
        <StatCard
          label="Informativos"
          value={eventStats.info}
          icon={Info}
          color="secondary"
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Buscar eventos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              showFilters ? 'bg-primary text-white' : 'bg-surface-hover text-foreground-muted hover:text-foreground'
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
            <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 animate-fade-in">
            {/* Type Filter */}
            <div>
              <label className="text-sm text-foreground-muted block mb-2">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'system', 'alarm', 'control', 'telemetry', 'config', 'auth'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'px-3 py-1 text-sm rounded-full transition-colors',
                      typeFilter === type
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                    )}
                  >
                    {type === 'all' ? 'Todos' : getTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="text-sm text-foreground-muted block mb-2">Severidade</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'error', 'warning', 'info', 'success'] as const).map((severity) => (
                  <button
                    key={severity}
                    onClick={() => setSeverityFilter(severity)}
                    className={cn(
                      'px-3 py-1 text-sm rounded-full transition-colors',
                      severityFilter === severity
                        ? getSeverityClasses(severity === 'all' ? 'info' : severity).bg + ' ' + getSeverityClasses(severity === 'all' ? 'info' : severity).text
                        : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                    )}
                  >
                    {severity === 'all' ? 'Todos' : getSeverityLabel(severity)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-sm text-foreground-muted">
            {filteredEvents.length} eventos encontrados
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 mx-auto mb-4 text-foreground-subtle" />
            <p className="text-foreground-muted">Nenhum evento encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {filteredEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onClick={() => setSelectedEvent(event)}
                isSelected={selectedEvent?.id === event.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

// Helper functions
function getTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    system: 'Sistema',
    alarm: 'Alarme',
    control: 'Controle',
    telemetry: 'Telemetria',
    config: 'Config',
    auth: 'Auth',
  };
  return labels[type];
}

function getTypeIcon(type: EventType) {
  const icons: Record<EventType, React.ElementType> = {
    system: Wifi,
    alarm: AlertTriangle,
    control: Zap,
    telemetry: Activity,
    config: Settings,
    auth: User,
  };
  return icons[type];
}

function getSeverityLabel(severity: EventSeverity): string {
  const labels: Record<EventSeverity, string> = {
    info: 'Info',
    warning: 'Aviso',
    error: 'Erro',
    success: 'Sucesso',
  };
  return labels[severity];
}

function getSeverityClasses(severity: EventSeverity) {
  const classes: Record<EventSeverity, { bg: string; text: string; icon: React.ElementType }> = {
    info: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Info },
    warning: { bg: 'bg-warning-500/20', text: 'text-warning-500', icon: AlertTriangle },
    error: { bg: 'bg-danger-500/20', text: 'text-danger-500', icon: XCircle },
    success: { bg: 'bg-success-500/20', text: 'text-success-500', icon: CheckCircle },
  };
  return classes[severity];
}

// Stat Card
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'primary' | 'danger' | 'warning' | 'secondary';
}) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    danger: 'text-danger-500 bg-danger-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    secondary: 'text-secondary bg-secondary/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className={cn('p-2 rounded-lg w-fit mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

// Event Row
function EventRow({
  event,
  onClick,
  isSelected,
}: {
  event: SystemEvent;
  onClick: () => void;
  isSelected: boolean;
}) {
  const TypeIcon = getTypeIcon(event.type);
  const severityClasses = getSeverityClasses(event.severity);
  const SeverityIcon = severityClasses.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-4 p-4 hover:bg-surface-hover transition-colors text-left',
        isSelected && 'bg-surface-hover'
      )}
    >
      {/* Severity Icon */}
      <div className={cn('p-2 rounded-lg shrink-0', severityClasses.bg)}>
        <SeverityIcon className={cn('w-4 h-4', severityClasses.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">{event.title}</span>
          <span className={cn('px-2 py-0.5 text-2xs rounded-full', severityClasses.bg, severityClasses.text)}>
            {getTypeLabel(event.type)}
          </span>
        </div>
        <p className="text-sm text-foreground-muted truncate">{event.message}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-foreground-subtle">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(event.timestamp)}
          </span>
          {event.systemName && (
            <span className="flex items-center gap-1">
              <Battery className="w-3 h-3" />
              {event.systemName}
            </span>
          )}
          {event.userName && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {event.userName}
            </span>
          )}
        </div>
      </div>

      <ArrowUpRight className="w-4 h-4 text-foreground-muted shrink-0" />
    </button>
  );
}

// Event Detail Modal
function EventDetailModal({
  event,
  onClose,
}: {
  event: SystemEvent;
  onClose: () => void;
}) {
  const TypeIcon = getTypeIcon(event.type);
  const severityClasses = getSeverityClasses(event.severity);
  const SeverityIcon = severityClasses.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', severityClasses.bg)}>
              <SeverityIcon className={cn('w-5 h-5', severityClasses.text)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{event.title}</h3>
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
                <span className={cn('px-2 py-0.5 rounded-full', severityClasses.bg, severityClasses.text)}>
                  {getSeverityLabel(event.severity)}
                </span>
                <span>{getTypeLabel(event.type)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-foreground-muted">Mensagem</label>
            <p className="text-foreground mt-1">{event.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-foreground-muted">Data/Hora</label>
              <p className="text-foreground mt-1">
                {event.timestamp.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <label className="text-sm text-foreground-muted">ID do Evento</label>
              <p className="text-foreground mt-1 font-mono text-sm">{event.id}</p>
            </div>
          </div>

          {event.systemName && (
            <div>
              <label className="text-sm text-foreground-muted">Sistema</label>
              <Link
                to={`/systems/${event.systemId}`}
                className="text-primary hover:text-primary-400 mt-1 flex items-center gap-1"
              >
                <Battery className="w-4 h-4" />
                {event.systemName}
              </Link>
            </div>
          )}

          {event.userName && (
            <div>
              <label className="text-sm text-foreground-muted">Usuario</label>
              <p className="text-foreground mt-1 flex items-center gap-1">
                <User className="w-4 h-4" />
                {event.userName}
              </p>
            </div>
          )}

          {event.metadata && (
            <div>
              <label className="text-sm text-foreground-muted">Detalhes</label>
              <pre className="mt-1 p-3 bg-background rounded-lg text-xs text-foreground-muted overflow-x-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function EventLogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
        ))}
      </div>
      <div className="bg-surface rounded-xl border border-border h-96 animate-pulse" />
    </div>
  );
}
