import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  Clock,
  Search,
  RefreshCw,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  Play,
  Download,
  Eye,
  User,
  Car,
  Flame,
  Wind,
  Activity,
  Shield,
  Video,
  X,
  Check,
  MapPin,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import api from '@/services/api';

// Types
interface SecurityEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  cameraLocation: string;
  type: 'person' | 'vehicle' | 'fire' | 'smoke' | 'motion' | 'intrusion' | 'tripwire' | 'loitering' | 'line_crossing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  timestamp: string;
  zoneId?: string;
  zoneName?: string;
  thumbnailUrl?: string;
  videoClipUrl?: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  notes?: string;
  metadata?: {
    objectCount?: number;
    duration?: number;
    direction?: string;
  };
}

interface EventStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unacknowledged: number;
}

interface CameraFilter {
  id: string;
  name: string;
}

const EVENT_TYPE_ICONS: Record<string, React.ElementType> = {
  person: User,
  vehicle: Car,
  fire: Flame,
  smoke: Wind,
  motion: Activity,
  intrusion: Shield,
  tripwire: Shield,
  loitering: Clock,
  line_crossing: Shield,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  person: 'Pessoa',
  vehicle: 'Veiculo',
  fire: 'Fogo',
  smoke: 'Fumaca',
  motion: 'Movimento',
  intrusion: 'Intrusao',
  tripwire: 'Tripwire',
  loitering: 'Permanencia',
  line_crossing: 'Cruzamento de Linha',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-danger-500 text-white',
  high: 'bg-warning-500 text-white',
  medium: 'bg-secondary text-white',
  low: 'bg-foreground-subtle text-white',
};

export default function CameraEvents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCameraFilter = searchParams.get('camera') || 'all';

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<EventStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0, unacknowledged: 0 });
  const [cameras, setCameras] = useState<CameraFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cameraFilter, setCameraFilter] = useState(initialCameraFilter);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [showFilters, setShowFilters] = useState(false);

  // Selected event for detail view
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  // Fetch cameras for filter
  const fetchCameras = useCallback(async () => {
    try {
      const response = await api.get('/cameras');
      setCameras(response.data.data?.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) || []);
    } catch (err) {
      // Mock data
      setCameras([
        { id: 'cam-001', name: 'Entrada Principal' },
        { id: 'cam-002', name: 'Area de Baterias' },
        { id: 'cam-003', name: 'Estacionamento' },
        { id: 'cam-004', name: 'Sala de Controle' },
      ]);
    }
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: Record<string, string> = {
        startDate: dateRange.start,
        endDate: dateRange.end,
      };
      if (cameraFilter !== 'all') params.cameraId = cameraFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;

      const response = await api.get('/cameras/events', { params });
      const eventData = response.data.data || [];
      setEvents(eventData);

      // Calculate stats
      const newStats: EventStats = {
        total: eventData.length,
        critical: eventData.filter((e: SecurityEvent) => e.severity === 'critical').length,
        high: eventData.filter((e: SecurityEvent) => e.severity === 'high').length,
        medium: eventData.filter((e: SecurityEvent) => e.severity === 'medium').length,
        low: eventData.filter((e: SecurityEvent) => e.severity === 'low').length,
        unacknowledged: eventData.filter((e: SecurityEvent) => !e.isAcknowledged).length,
      };
      setStats(newStats);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError('Falha ao carregar eventos.');

      // Mock data
      const mockEvents: SecurityEvent[] = [
        {
          id: 'evt-001',
          cameraId: 'cam-001',
          cameraName: 'Entrada Principal',
          cameraLocation: 'Portao Frontal',
          type: 'person',
          severity: 'high',
          confidence: 0.95,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          zoneId: 'zone-1',
          zoneName: 'Zona de Intrusao',
          thumbnailUrl: '/api/events/evt-001/thumbnail',
          videoClipUrl: '/api/events/evt-001/clip',
          isAcknowledged: false,
          metadata: { objectCount: 1 },
        },
        {
          id: 'evt-002',
          cameraId: 'cam-002',
          cameraName: 'Area de Baterias',
          cameraLocation: 'Container BESS 1',
          type: 'smoke',
          severity: 'critical',
          confidence: 0.88,
          timestamp: new Date(Date.now() - 600000).toISOString(),
          zoneName: 'Area de Monitoramento',
          thumbnailUrl: '/api/events/evt-002/thumbnail',
          isAcknowledged: true,
          acknowledgedBy: 'admin@lifo4.com',
          acknowledgedAt: new Date(Date.now() - 500000).toISOString(),
          notes: 'Falso alarme - vapor de limpeza',
        },
        {
          id: 'evt-003',
          cameraId: 'cam-001',
          cameraName: 'Entrada Principal',
          cameraLocation: 'Portao Frontal',
          type: 'vehicle',
          severity: 'medium',
          confidence: 0.92,
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          thumbnailUrl: '/api/events/evt-003/thumbnail',
          isAcknowledged: false,
          metadata: { direction: 'entrada' },
        },
        {
          id: 'evt-004',
          cameraId: 'cam-003',
          cameraName: 'Estacionamento',
          cameraLocation: 'Area Externa',
          type: 'motion',
          severity: 'low',
          confidence: 0.75,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          isAcknowledged: true,
          acknowledgedBy: 'operador@lifo4.com',
          acknowledgedAt: new Date(Date.now() - 3000000).toISOString(),
        },
        {
          id: 'evt-005',
          cameraId: 'cam-002',
          cameraName: 'Area de Baterias',
          cameraLocation: 'Container BESS 1',
          type: 'intrusion',
          severity: 'high',
          confidence: 0.89,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          zoneId: 'zone-2',
          zoneName: 'Perimetro',
          thumbnailUrl: '/api/events/evt-005/thumbnail',
          videoClipUrl: '/api/events/evt-005/clip',
          isAcknowledged: false,
        },
      ];
      setEvents(mockEvents);
      setStats({
        total: mockEvents.length,
        critical: mockEvents.filter(e => e.severity === 'critical').length,
        high: mockEvents.filter(e => e.severity === 'high').length,
        medium: mockEvents.filter(e => e.severity === 'medium').length,
        low: mockEvents.filter(e => e.severity === 'low').length,
        unacknowledged: mockEvents.filter(e => !e.isAcknowledged).length,
      });
    } finally {
      setIsLoading(false);
    }
  }, [cameraFilter, typeFilter, severityFilter, dateRange]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Update URL when camera filter changes
  useEffect(() => {
    if (cameraFilter !== 'all') {
      setSearchParams({ camera: cameraFilter });
    } else {
      setSearchParams({});
    }
  }, [cameraFilter, setSearchParams]);

  // Filter events by search
  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.cameraLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      EVENT_TYPE_LABELS[event.type]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.zoneName?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Acknowledge event
  const handleAcknowledge = async (eventId: string, notes?: string) => {
    try {
      await api.post(`/cameras/events/${eventId}/acknowledge`, { notes });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, isAcknowledged: true, acknowledgedAt: new Date().toISOString(), notes }
            : e
        )
      );
      setStats((prev) => ({ ...prev, unacknowledged: Math.max(0, prev.unacknowledged - 1) }));
      setSelectedEvent(null);
    } catch (err) {
      console.error('Failed to acknowledge event:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Eventos de Seguranca</h1>
          <p className="text-foreground-muted text-sm">
            {stats.unacknowledged} evento{stats.unacknowledged !== 1 ? 's' : ''} pendente{stats.unacknowledged !== 1 ? 's' : ''} de {stats.total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cameras"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg transition-colors"
          >
            <Camera className="w-5 h-5" />
            Cameras
          </Link>
          <button
            onClick={fetchEvents}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <StatCard label="Total" value={stats.total} icon={AlertTriangle} />
        <StatCard label="Criticos" value={stats.critical} icon={AlertTriangle} color="danger" />
        <StatCard label="Altos" value={stats.high} icon={AlertTriangle} color="warning" />
        <StatCard label="Medios" value={stats.medium} icon={AlertTriangle} color="secondary" />
        <StatCard label="Baixos" value={stats.low} icon={AlertTriangle} color="muted" />
        <StatCard label="Pendentes" value={stats.unacknowledged} icon={Clock} color="primary" highlight />
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar eventos..."
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas cameras</option>
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>{camera.name}</option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas severidades</option>
              <option value="critical">Critico</option>
              <option value="high">Alto</option>
              <option value="medium">Medio</option>
              <option value="low">Baixo</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'px-4 py-2.5 rounded-lg border transition-colors flex items-center gap-2',
                showFilters ? 'bg-primary text-white border-primary' : 'bg-background border-border text-foreground hover:bg-surface-hover'
              )}
            >
              <Filter className="w-4 h-4" />
              Filtros
              <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
            </button>
          </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-2">Tipo de Evento</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Todos tipos</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-2">Data Inicial</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-2">Data Final</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-500" />
          <p className="text-foreground">{error}</p>
          <button
            onClick={fetchEvents}
            className="ml-auto px-3 py-1 bg-danger-500/20 hover:bg-danger-500/30 text-danger-500 rounded-lg text-sm transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Events Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <EventSkeleton key={i} />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum evento encontrado</h3>
          <p className="text-foreground-muted">
            {searchQuery || cameraFilter !== 'all' || typeFilter !== 'all' || severityFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Nenhum evento de seguranca registrado no periodo'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: 'primary' | 'danger' | 'warning' | 'secondary' | 'muted';
  highlight?: boolean;
}

function StatCard({ label, value, icon: Icon, color, highlight }: StatCardProps) {
  const colorClasses = {
    primary: 'text-primary',
    danger: 'text-danger-500',
    warning: 'text-warning-500',
    secondary: 'text-secondary',
    muted: 'text-foreground-subtle',
  };

  return (
    <div className={cn(
      'bg-surface rounded-lg border p-3 flex items-center gap-3',
      highlight && value > 0 ? 'border-primary' : 'border-border'
    )}>
      <Icon className={cn('w-5 h-5', color ? colorClasses[color] : 'text-foreground-muted')} />
      <div>
        <p className={cn('text-lg font-semibold', color ? colorClasses[color] : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-foreground-muted">{label}</p>
      </div>
    </div>
  );
}

// Event Card Component
interface EventCardProps {
  event: SecurityEvent;
  onClick: () => void;
}

function EventCard({ event, onClick }: EventCardProps) {
  const Icon = EVENT_TYPE_ICONS[event.type] || AlertTriangle;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface rounded-xl border p-4 hover:bg-surface-hover cursor-pointer transition-all',
        !event.isAcknowledged ? 'border-l-4 border-l-primary border-t border-r border-b border-border' : 'border-border'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        {event.thumbnailUrl ? (
          <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-background shrink-0">
            <img
              src={event.thumbnailUrl}
              alt={`Evento ${event.type}`}
              className="w-full h-full object-cover"
            />
            {event.videoClipUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-24 h-16 rounded-lg bg-background flex items-center justify-center shrink-0">
            <Icon className="w-8 h-8 text-foreground-subtle" />
          </div>
        )}

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              SEVERITY_COLORS[event.severity]
            )}>
              {event.severity.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-surface-hover text-foreground">
              {EVENT_TYPE_LABELS[event.type]}
            </span>
            <span className="text-xs text-foreground-muted">
              {Math.round(event.confidence * 100)}% confianca
            </span>
          </div>

          <h3 className="font-medium text-foreground mb-1">
            {event.cameraName}
            {event.zoneName && <span className="text-foreground-muted"> - {event.zoneName}</span>}
          </h3>

          <div className="flex items-center gap-4 text-sm text-foreground-muted">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {event.cameraLocation}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 shrink-0">
          {event.isAcknowledged ? (
            <span className="flex items-center gap-1 px-2 py-1 bg-success-500/20 text-success-500 text-xs rounded-lg">
              <Check className="w-3 h-3" />
              Reconhecido
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 bg-warning-500/20 text-warning-500 text-xs rounded-lg">
              <Clock className="w-3 h-3" />
              Pendente
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-foreground-muted" />
        </div>
      </div>
    </div>
  );
}

// Event Detail Modal
interface EventDetailModalProps {
  event: SecurityEvent;
  onClose: () => void;
  onAcknowledge: (eventId: string, notes?: string) => void;
}

function EventDetailModal({ event, onClose, onAcknowledge }: EventDetailModalProps) {
  const [notes, setNotes] = useState('');
  const Icon = EVENT_TYPE_ICONS[event.type] || AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              event.severity === 'critical' ? 'bg-danger-500/20' :
              event.severity === 'high' ? 'bg-warning-500/20' :
              event.severity === 'medium' ? 'bg-secondary/20' : 'bg-surface-hover'
            )}>
              <Icon className={cn(
                'w-5 h-5',
                event.severity === 'critical' ? 'text-danger-500' :
                event.severity === 'high' ? 'text-warning-500' :
                event.severity === 'medium' ? 'text-secondary' : 'text-foreground-muted'
              )} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{EVENT_TYPE_LABELS[event.type]}</h3>
              <p className="text-sm text-foreground-muted">{event.cameraName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Thumbnail/Video */}
          {event.thumbnailUrl && (
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <img
                src={event.thumbnailUrl}
                alt={`Evento ${event.type}`}
                className="w-full h-full object-contain"
              />
              {event.videoClipUrl && (
                <a
                  href={event.videoClipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                >
                  <Play className="w-16 h-16 text-white" />
                </a>
              )}
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-hover rounded-lg p-3">
              <p className="text-xs text-foreground-muted mb-1">Severidade</p>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                SEVERITY_COLORS[event.severity]
              )}>
                {event.severity.toUpperCase()}
              </span>
            </div>
            <div className="bg-surface-hover rounded-lg p-3">
              <p className="text-xs text-foreground-muted mb-1">Confianca</p>
              <p className="text-foreground font-medium">{Math.round(event.confidence * 100)}%</p>
            </div>
            <div className="bg-surface-hover rounded-lg p-3">
              <p className="text-xs text-foreground-muted mb-1">Data/Hora</p>
              <p className="text-foreground font-medium">{formatDate(event.timestamp)}</p>
            </div>
            <div className="bg-surface-hover rounded-lg p-3">
              <p className="text-xs text-foreground-muted mb-1">Camera</p>
              <p className="text-foreground font-medium">{event.cameraName}</p>
            </div>
            {event.zoneName && (
              <div className="bg-surface-hover rounded-lg p-3">
                <p className="text-xs text-foreground-muted mb-1">Zona</p>
                <p className="text-foreground font-medium">{event.zoneName}</p>
              </div>
            )}
            <div className="bg-surface-hover rounded-lg p-3">
              <p className="text-xs text-foreground-muted mb-1">Localizacao</p>
              <p className="text-foreground font-medium">{event.cameraLocation}</p>
            </div>
          </div>

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="bg-surface-hover rounded-lg p-3">
              <p className="text-xs text-foreground-muted mb-2">Informacoes Adicionais</p>
              <div className="space-y-1">
                {event.metadata.objectCount && (
                  <p className="text-sm text-foreground">Objetos detectados: {event.metadata.objectCount}</p>
                )}
                {event.metadata.duration && (
                  <p className="text-sm text-foreground">Duracao: {event.metadata.duration}s</p>
                )}
                {event.metadata.direction && (
                  <p className="text-sm text-foreground">Direcao: {event.metadata.direction}</p>
                )}
              </div>
            </div>
          )}

          {/* Acknowledgment Status */}
          {event.isAcknowledged ? (
            <div className="bg-success-500/10 border border-success-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-5 h-5 text-success-500" />
                <span className="font-medium text-success-500">Evento Reconhecido</span>
              </div>
              <p className="text-sm text-foreground-muted">
                Por {event.acknowledgedBy} em {event.acknowledgedAt ? formatDate(event.acknowledgedAt) : 'N/A'}
              </p>
              {event.notes && (
                <p className="text-sm text-foreground mt-2 p-2 bg-surface rounded">
                  "{event.notes}"
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione notas sobre este evento..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex items-center gap-2">
            {event.videoClipUrl && (
              <a
                href={event.videoClipUrl}
                download
                className="flex items-center gap-2 px-3 py-2 bg-surface-hover hover:bg-surface-active rounded-lg text-foreground-muted transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar video
              </a>
            )}
            <Link
              to={`/cameras/${event.cameraId}`}
              className="flex items-center gap-2 px-3 py-2 bg-surface-hover hover:bg-surface-active rounded-lg text-foreground-muted transition-colors"
            >
              <Eye className="w-4 h-4" />
              Ver camera
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
            >
              Fechar
            </button>
            {!event.isAcknowledged && (
              <button
                onClick={() => onAcknowledge(event.id, notes || undefined)}
                className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                Reconhecer Evento
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton Component
function EventSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-24 h-16 rounded-lg bg-surface-hover shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-16 bg-surface-hover rounded-full" />
            <div className="h-5 w-20 bg-surface-hover rounded-full" />
          </div>
          <div className="h-5 w-48 bg-surface-hover rounded mb-2" />
          <div className="h-4 w-32 bg-surface-hover rounded" />
        </div>
        <div className="h-6 w-24 bg-surface-hover rounded" />
      </div>
    </div>
  );
}
