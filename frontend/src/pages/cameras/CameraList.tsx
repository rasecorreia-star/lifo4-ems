import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Video,
  VideoOff,
  RefreshCw,
  Search,
  Plus,
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronRight,
  Grid3X3,
  List,
  Settings,
  Eye,
  Shield,
  Mic,
  MicOff,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import api from '@/services/api';

// Types
interface Camera {
  id: string;
  name: string;
  location: string;
  model: string;
  manufacturer: string;
  ipAddress: string;
  streamUrl: string;
  thumbnailUrl?: string;
  status: 'online' | 'offline' | 'error' | 'recording';
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  hasPtz: boolean;
  hasAudio: boolean;
  hasTalkback: boolean;
  isRecording: boolean;
  detectionEnabled: boolean;
  securityZonesCount: number;
  lastMotionDetected?: string;
  lastCommunication?: string;
  createdAt: string;
  updatedAt: string;
}

interface CameraStats {
  total: number;
  online: number;
  offline: number;
  recording: number;
  withAlerts: number;
}

export default function CameraList() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [stats, setStats] = useState<CameraStats>({ total: 0, online: 0, offline: 0, recording: 0, withAlerts: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());

  // Fetch cameras
  const fetchCameras = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // API call to get cameras
      const response = await api.get('/cameras');
      const cameraData = response.data.data || [];
      setCameras(cameraData);

      // Calculate stats
      const newStats: CameraStats = {
        total: cameraData.length,
        online: cameraData.filter((c: Camera) => c.status === 'online' || c.status === 'recording').length,
        offline: cameraData.filter((c: Camera) => c.status === 'offline').length,
        recording: cameraData.filter((c: Camera) => c.isRecording).length,
        withAlerts: cameraData.filter((c: Camera) => c.status === 'error').length,
      };
      setStats(newStats);
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
      setError('Falha ao carregar cameras. Tente novamente.');
      // Set mock data for development
      const mockCameras: Camera[] = [
        {
          id: 'cam-001',
          name: 'Entrada Principal',
          location: 'Portao Frontal',
          model: 'DS-2CD2385G1-I',
          manufacturer: 'Hikvision',
          ipAddress: '192.168.1.101',
          streamUrl: 'rtsp://192.168.1.101:554/stream1',
          thumbnailUrl: '/api/cameras/cam-001/thumbnail',
          status: 'online',
          connectionStatus: 'connected',
          hasPtz: true,
          hasAudio: true,
          hasTalkback: true,
          isRecording: true,
          detectionEnabled: true,
          securityZonesCount: 2,
          lastMotionDetected: new Date(Date.now() - 300000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cam-002',
          name: 'Area de Baterias',
          location: 'Container BESS 1',
          model: 'IPC-HFW2831S-S-S2',
          manufacturer: 'Dahua',
          ipAddress: '192.168.1.102',
          streamUrl: 'rtsp://192.168.1.102:554/stream1',
          thumbnailUrl: '/api/cameras/cam-002/thumbnail',
          status: 'recording',
          connectionStatus: 'connected',
          hasPtz: false,
          hasAudio: true,
          hasTalkback: false,
          isRecording: true,
          detectionEnabled: true,
          securityZonesCount: 3,
          lastMotionDetected: new Date(Date.now() - 60000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cam-003',
          name: 'Estacionamento',
          location: 'Area Externa',
          model: 'C6CN',
          manufacturer: 'EZVIZ',
          ipAddress: '192.168.1.103',
          streamUrl: 'rtsp://192.168.1.103:554/stream1',
          status: 'offline',
          connectionStatus: 'disconnected',
          hasPtz: true,
          hasAudio: false,
          hasTalkback: false,
          isRecording: false,
          detectionEnabled: false,
          securityZonesCount: 1,
          lastCommunication: new Date(Date.now() - 3600000).toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cam-004',
          name: 'Sala de Controle',
          location: 'Interior - Sala Tecnica',
          model: 'DS-2DE4425IW-DE',
          manufacturer: 'Hikvision',
          ipAddress: '192.168.1.104',
          streamUrl: 'rtsp://192.168.1.104:554/stream1',
          thumbnailUrl: '/api/cameras/cam-004/thumbnail',
          status: 'online',
          connectionStatus: 'connected',
          hasPtz: true,
          hasAudio: true,
          hasTalkback: true,
          isRecording: true,
          detectionEnabled: true,
          securityZonesCount: 1,
          lastMotionDetected: new Date(Date.now() - 1800000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
      ];
      setCameras(mockCameras);
      setStats({
        total: mockCameras.length,
        online: mockCameras.filter(c => c.status === 'online' || c.status === 'recording').length,
        offline: mockCameras.filter(c => c.status === 'offline').length,
        recording: mockCameras.filter(c => c.isRecording).length,
        withAlerts: mockCameras.filter(c => c.status === 'error').length,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  // Filter cameras
  const filteredCameras = cameras.filter((camera) => {
    const matchesSearch =
      camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camera.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camera.model.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && (camera.status === 'online' || camera.status === 'recording')) ||
      (statusFilter === 'offline' && camera.status === 'offline') ||
      (statusFilter === 'recording' && camera.isRecording) ||
      (statusFilter === 'error' && camera.status === 'error');

    return matchesSearch && matchesStatus;
  });

  // Toggle camera selection
  const toggleSelection = (cameraId: string) => {
    setSelectedCameras((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cameraId)) {
        newSet.delete(cameraId);
      } else {
        newSet.add(cameraId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cameras</h1>
          <p className="text-foreground-muted text-sm">
            {stats.online} de {stats.total} cameras online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cameras/events"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-warning-500/10 hover:bg-warning-500/20 text-warning-500 font-medium rounded-lg transition-colors"
          >
            <AlertTriangle className="w-5 h-5" />
            Eventos
          </Link>
          <Link
            to="/cameras/zones"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors"
          >
            <Shield className="w-5 h-5" />
            Zonas
          </Link>
          <button
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Camera
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} icon={Camera} />
        <StatCard label="Online" value={stats.online} icon={Wifi} color="success" />
        <StatCard label="Offline" value={stats.offline} icon={WifiOff} color="muted" />
        <StatCard label="Gravando" value={stats.recording} icon={Video} color="danger" />
        <StatCard label="Alertas" value={stats.withAlerts} icon={AlertTriangle} color="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, local ou modelo..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="recording">Gravando</option>
            <option value="error">Com erro</option>
          </select>
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'grid' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'list' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={fetchCameras}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-500" />
          <p className="text-foreground">{error}</p>
          <button
            onClick={fetchCameras}
            className="ml-auto px-3 py-1 bg-danger-500/20 hover:bg-danger-500/30 text-danger-500 rounded-lg text-sm transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-4'
        )}>
          {[...Array(8)].map((_, i) => (
            <CameraCardSkeleton key={i} viewMode={viewMode} />
          ))}
        </div>
      ) : filteredCameras.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Camera className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma camera encontrada</h3>
          <p className="text-foreground-muted mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Adicione sua primeira camera para comecar'}
          </p>
        </div>
      ) : (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-4'
        )}>
          {filteredCameras.map((camera) => (
            viewMode === 'grid' ? (
              <CameraCard
                key={camera.id}
                camera={camera}
                isSelected={selectedCameras.has(camera.id)}
                onToggleSelect={() => toggleSelection(camera.id)}
              />
            ) : (
              <CameraListItem
                key={camera.id}
                camera={camera}
                isSelected={selectedCameras.has(camera.id)}
                onToggleSelect={() => toggleSelection(camera.id)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: 'success' | 'danger' | 'warning' | 'muted';
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    success: 'text-success-500',
    danger: 'text-danger-500',
    warning: 'text-warning-500',
    muted: 'text-foreground-subtle',
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-3 flex items-center gap-3">
      <Icon className={cn('w-5 h-5', color ? colorClasses[color] : 'text-primary')} />
      <div>
        <p className={cn('text-lg font-semibold', color ? colorClasses[color] : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-foreground-muted">{label}</p>
      </div>
    </div>
  );
}

// Camera Card Component (Grid View)
interface CameraCardProps {
  camera: Camera;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function CameraCard({ camera, isSelected, onToggleSelect }: CameraCardProps) {
  const isOnline = camera.status === 'online' || camera.status === 'recording';

  return (
    <div className={cn(
      'bg-surface rounded-xl border overflow-hidden group transition-all hover:shadow-lg',
      camera.status === 'error' ? 'border-danger-500/50' : 'border-border'
    )}>
      {/* Thumbnail/Preview */}
      <div className="relative aspect-video bg-background">
        {isOnline && camera.thumbnailUrl ? (
          <img
            src={camera.thumbnailUrl}
            alt={camera.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoOff className="w-12 h-12 text-foreground-subtle" />
          </div>
        )}

        {/* Status Overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            isOnline ? 'bg-success-500/90 text-white' : 'bg-foreground-subtle/90 text-white'
          )}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {camera.isRecording && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-danger-500/90 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              REC
            </span>
          )}
        </div>

        {/* Features Icons */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {camera.hasPtz && (
            <span className="p-1 bg-black/50 rounded text-white" title="PTZ">
              <Settings className="w-3 h-3" />
            </span>
          )}
          {camera.hasAudio && (
            <span className="p-1 bg-black/50 rounded text-white" title="Audio">
              {camera.hasTalkback ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            </span>
          )}
          {camera.detectionEnabled && (
            <span className="p-1 bg-black/50 rounded text-white" title="Deteccao IA">
              <Eye className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* Hover Overlay */}
        <Link
          to={`/cameras/${camera.id}`}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <span className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white font-medium">
            Ver ao vivo
          </span>
        </Link>

        {/* Security Zones Badge */}
        {camera.securityZonesCount > 0 && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-secondary/90 text-white">
              <Shield className="w-3 h-3" />
              {camera.securityZonesCount} zona{camera.securityZonesCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {camera.name}
            </h3>
            <p className="text-sm text-foreground-muted">{camera.location}</p>
          </div>
          <Link
            to={`/cameras/${camera.id}`}
            className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-active transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-foreground-muted" />
          </Link>
        </div>

        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>{camera.manufacturer} {camera.model}</span>
          {camera.lastMotionDetected && isOnline && (
            <span>Movimento: {formatRelativeTime(camera.lastMotionDetected)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Camera List Item Component (List View)
function CameraListItem({ camera, isSelected, onToggleSelect }: CameraCardProps) {
  const isOnline = camera.status === 'online' || camera.status === 'recording';

  return (
    <Link
      to={`/cameras/${camera.id}`}
      className={cn(
        'flex items-center gap-4 bg-surface rounded-xl border p-4 hover:bg-surface-hover transition-all',
        camera.status === 'error' ? 'border-danger-500/50' : 'border-border'
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-background shrink-0">
        {isOnline && camera.thumbnailUrl ? (
          <img
            src={camera.thumbnailUrl}
            alt={camera.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-foreground-subtle" />
          </div>
        )}
        {camera.isRecording && (
          <span className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 text-2xs font-medium rounded bg-danger-500/90 text-white">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            REC
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-foreground truncate">{camera.name}</h3>
          <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full shrink-0',
            isOnline ? 'bg-success-500/20 text-success-500' : 'bg-foreground-subtle/20 text-foreground-subtle'
          )}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-sm text-foreground-muted mb-2">{camera.location}</p>
        <div className="flex items-center gap-4 text-xs text-foreground-subtle">
          <span>{camera.manufacturer} {camera.model}</span>
          <span>{camera.ipAddress}</span>
          {camera.securityZonesCount > 0 && (
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {camera.securityZonesCount} zona{camera.securityZonesCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex items-center gap-2 shrink-0">
        {camera.hasPtz && (
          <span className="p-2 bg-surface-hover rounded-lg" title="PTZ">
            <Settings className="w-4 h-4 text-foreground-muted" />
          </span>
        )}
        {camera.hasAudio && (
          <span className="p-2 bg-surface-hover rounded-lg" title="Audio">
            <Mic className="w-4 h-4 text-foreground-muted" />
          </span>
        )}
        {camera.detectionEnabled && (
          <span className="p-2 bg-surface-hover rounded-lg" title="Deteccao IA">
            <Eye className="w-4 h-4 text-foreground-muted" />
          </span>
        )}
      </div>

      <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
    </Link>
  );
}

// Skeleton Component
function CameraCardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-4 bg-surface rounded-xl border border-border p-4 animate-pulse">
        <div className="w-32 h-20 rounded-lg bg-surface-hover shrink-0" />
        <div className="flex-1">
          <div className="h-5 w-40 bg-surface-hover rounded mb-2" />
          <div className="h-4 w-24 bg-surface-hover rounded mb-2" />
          <div className="h-3 w-48 bg-surface-hover rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface-hover" />
          <div className="w-8 h-8 rounded-lg bg-surface-hover" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden animate-pulse">
      <div className="aspect-video bg-surface-hover" />
      <div className="p-4">
        <div className="h-5 w-32 bg-surface-hover rounded mb-2" />
        <div className="h-4 w-24 bg-surface-hover rounded mb-3" />
        <div className="h-3 w-full bg-surface-hover rounded" />
      </div>
    </div>
  );
}
