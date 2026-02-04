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
  Thermometer,
  Flame,
  Wind,
  Bell,
  LayoutGrid,
  Play,
  Circle,
  Zap,
  Activity,
  Clock,
  MapPin,
  ThermometerSun,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  MoreVertical,
  Save,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import api from '@/services/api';

// Types
interface CameraDevice {
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
  type: 'standard' | 'thermal' | 'ptz' | 'dome';
  hasPtz: boolean;
  hasAudio: boolean;
  hasTalkback: boolean;
  isRecording: boolean;
  detectionEnabled: boolean;
  thermalEnabled?: boolean;
  securityZonesCount: number;
  lastMotionDetected?: string;
  lastCommunication?: string;
  createdAt: string;
  updatedAt: string;
  // Thermal specific
  minTemp?: number;
  maxTemp?: number;
  avgTemp?: number;
  thermalAlerts?: number;
  // Associated BESS
  associatedBessId?: string;
  associatedBessName?: string;
}

interface CameraStats {
  total: number;
  online: number;
  offline: number;
  recording: number;
  withAlerts: number;
  thermalCameras: number;
  activeDetections: number;
}

interface ThermalAlert {
  id: string;
  cameraId: string;
  cameraName: string;
  temperature: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  acknowledged: boolean;
}

export default function CameraList() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [stats, setStats] = useState<CameraStats>({
    total: 0, online: 0, offline: 0, recording: 0, withAlerts: 0, thermalCameras: 0, activeDetections: 0
  });
  const [thermalAlerts, setThermalAlerts] = useState<ThermalAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'multiview'>('grid');
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [multiviewLayout, setMultiviewLayout] = useState<'2x2' | '3x3' | '4x4'>('2x2');
  const [editingCamera, setEditingCamera] = useState<CameraDevice | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<CameraDevice | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch cameras
  const fetchCameras = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get('/cameras');
      const cameraData = response.data.data || [];
      setCameras(cameraData);
      calculateStats(cameraData);
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
      // Mock data for development - Enhanced with thermal cameras
      const mockCameras: CameraDevice[] = [
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
          type: 'ptz',
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
          name: 'BESS Container 1 - Termica',
          location: 'Container BESS 1 - Interior',
          model: 'FLIR A500f',
          manufacturer: 'FLIR',
          ipAddress: '192.168.1.102',
          streamUrl: 'rtsp://192.168.1.102:554/stream1',
          thumbnailUrl: '/api/cameras/cam-002/thumbnail',
          status: 'recording',
          connectionStatus: 'connected',
          type: 'thermal',
          hasPtz: false,
          hasAudio: false,
          hasTalkback: false,
          isRecording: true,
          detectionEnabled: true,
          thermalEnabled: true,
          securityZonesCount: 4,
          lastMotionDetected: new Date(Date.now() - 60000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
          minTemp: 22.5,
          maxTemp: 38.2,
          avgTemp: 28.7,
          thermalAlerts: 0,
          associatedBessId: 'bess-001',
          associatedBessName: 'BESS Principal',
        },
        {
          id: 'cam-003',
          name: 'BESS Container 2 - Termica',
          location: 'Container BESS 2 - Interior',
          model: 'FLIR A700f',
          manufacturer: 'FLIR',
          ipAddress: '192.168.1.103',
          streamUrl: 'rtsp://192.168.1.103:554/stream1',
          thumbnailUrl: '/api/cameras/cam-003/thumbnail',
          status: 'recording',
          connectionStatus: 'connected',
          type: 'thermal',
          hasPtz: false,
          hasAudio: false,
          hasTalkback: false,
          isRecording: true,
          detectionEnabled: true,
          thermalEnabled: true,
          securityZonesCount: 4,
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
          minTemp: 24.1,
          maxTemp: 45.8,
          avgTemp: 32.4,
          thermalAlerts: 2,
          associatedBessId: 'bess-002',
          associatedBessName: 'BESS Secundario',
        },
        {
          id: 'cam-004',
          name: 'Area de Baterias - Visao Geral',
          location: 'Container BESS 1 - Externo',
          model: 'IPC-HFW2831S-S-S2',
          manufacturer: 'Dahua',
          ipAddress: '192.168.1.104',
          streamUrl: 'rtsp://192.168.1.104:554/stream1',
          thumbnailUrl: '/api/cameras/cam-004/thumbnail',
          status: 'online',
          connectionStatus: 'connected',
          type: 'dome',
          hasPtz: true,
          hasAudio: true,
          hasTalkback: false,
          isRecording: true,
          detectionEnabled: true,
          securityZonesCount: 3,
          lastMotionDetected: new Date(Date.now() - 1800000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cam-005',
          name: 'Estacionamento',
          location: 'Area Externa',
          model: 'C6CN',
          manufacturer: 'EZVIZ',
          ipAddress: '192.168.1.105',
          streamUrl: 'rtsp://192.168.1.105:554/stream1',
          status: 'offline',
          connectionStatus: 'disconnected',
          type: 'standard',
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
          id: 'cam-006',
          name: 'Sala de Controle',
          location: 'Interior - Sala Tecnica',
          model: 'DS-2DE4425IW-DE',
          manufacturer: 'Hikvision',
          ipAddress: '192.168.1.106',
          streamUrl: 'rtsp://192.168.1.106:554/stream1',
          thumbnailUrl: '/api/cameras/cam-006/thumbnail',
          status: 'online',
          connectionStatus: 'connected',
          type: 'ptz',
          hasPtz: true,
          hasAudio: true,
          hasTalkback: true,
          isRecording: true,
          detectionEnabled: true,
          securityZonesCount: 1,
          lastMotionDetected: new Date(Date.now() - 900000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cam-007',
          name: 'Perimetro Norte',
          location: 'Cerca Perimetral',
          model: 'IPC-PFW8800-A180',
          manufacturer: 'Dahua',
          ipAddress: '192.168.1.107',
          streamUrl: 'rtsp://192.168.1.107:554/stream1',
          thumbnailUrl: '/api/cameras/cam-007/thumbnail',
          status: 'online',
          connectionStatus: 'connected',
          type: 'standard',
          hasPtz: false,
          hasAudio: false,
          hasTalkback: false,
          isRecording: true,
          detectionEnabled: true,
          securityZonesCount: 2,
          lastMotionDetected: new Date(Date.now() - 7200000).toISOString(),
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cam-008',
          name: 'Inversor PCS - Termica',
          location: 'Sala de Inversores',
          model: 'FLIR A400',
          manufacturer: 'FLIR',
          ipAddress: '192.168.1.108',
          streamUrl: 'rtsp://192.168.1.108:554/stream1',
          thumbnailUrl: '/api/cameras/cam-008/thumbnail',
          status: 'online',
          connectionStatus: 'connected',
          type: 'thermal',
          hasPtz: false,
          hasAudio: false,
          hasTalkback: false,
          isRecording: true,
          detectionEnabled: true,
          thermalEnabled: true,
          securityZonesCount: 2,
          lastCommunication: new Date().toISOString(),
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: new Date().toISOString(),
          minTemp: 28.3,
          maxTemp: 52.1,
          avgTemp: 38.9,
          thermalAlerts: 0,
        },
      ];

      const mockAlerts: ThermalAlert[] = [
        {
          id: 'alert-001',
          cameraId: 'cam-003',
          cameraName: 'BESS Container 2 - Termica',
          temperature: 45.8,
          threshold: 45,
          severity: 'warning',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          acknowledged: false,
        },
        {
          id: 'alert-002',
          cameraId: 'cam-003',
          cameraName: 'BESS Container 2 - Termica',
          temperature: 44.2,
          threshold: 45,
          severity: 'warning',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          acknowledged: true,
        },
      ];

      setCameras(mockCameras);
      setThermalAlerts(mockAlerts);
      calculateStats(mockCameras);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle camera update
  const handleUpdateCamera = (updatedCamera: CameraDevice) => {
    setCameras(prev => prev.map(cam =>
      cam.id === updatedCamera.id ? updatedCamera : cam
    ));
    setEditingCamera(null);
  };

  // Handle camera delete
  const handleDeleteCamera = (cameraId: string) => {
    setCameras(prev => prev.filter(cam => cam.id !== cameraId));
    setDeletingCamera(null);
  };

  // Handle add new camera
  const handleAddCamera = (newCamera: Omit<CameraDevice, 'id' | 'createdAt' | 'updatedAt'>) => {
    const camera: CameraDevice = {
      ...newCamera,
      id: `cam-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as CameraDevice;
    setCameras(prev => [...prev, camera]);
    setShowAddModal(false);
  };

  const calculateStats = (cameraData: CameraDevice[]) => {
    const newStats: CameraStats = {
      total: cameraData.length,
      online: cameraData.filter((c) => c.status === 'online' || c.status === 'recording').length,
      offline: cameraData.filter((c) => c.status === 'offline').length,
      recording: cameraData.filter((c) => c.isRecording).length,
      withAlerts: cameraData.filter((c) => c.status === 'error' || (c.thermalAlerts && c.thermalAlerts > 0)).length,
      thermalCameras: cameraData.filter((c) => c.type === 'thermal').length,
      activeDetections: cameraData.filter((c) => c.detectionEnabled).length,
    };
    setStats(newStats);
  };

  useEffect(() => {
    fetchCameras();
    // Real-time updates
    const interval = setInterval(() => {
      // Simulate temperature updates for thermal cameras
      setCameras(prev => prev.map(cam => {
        if (cam.type === 'thermal' && cam.thermalEnabled) {
          return {
            ...cam,
            minTemp: (cam.minTemp || 20) + (Math.random() - 0.5) * 0.5,
            maxTemp: (cam.maxTemp || 40) + (Math.random() - 0.5) * 1,
            avgTemp: (cam.avgTemp || 30) + (Math.random() - 0.5) * 0.3,
          };
        }
        return cam;
      }));
    }, 5000);
    return () => clearInterval(interval);
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
      (statusFilter === 'alerts' && (camera.status === 'error' || (camera.thermalAlerts && camera.thermalAlerts > 0)));

    const matchesType =
      typeFilter === 'all' ||
      camera.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Multiview cameras
  const multiviewCameras = filteredCameras.filter(c => c.status === 'online' || c.status === 'recording');
  const multiviewCount = multiviewLayout === '2x2' ? 4 : multiviewLayout === '3x3' ? 9 : 16;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cameras e Monitoramento</h1>
          <p className="text-foreground-muted text-sm">
            {stats.online} de {stats.total} cameras online | {stats.thermalCameras} termicas ativas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/cameras/thermal"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 font-medium rounded-lg transition-colors"
          >
            <Thermometer className="w-5 h-5" />
            Termicas
          </Link>
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
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Camera
          </button>
        </div>
      </div>

      {/* Thermal Alerts Banner */}
      {thermalAlerts.filter(a => !a.acknowledged).length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-400">Alertas Termicos Ativos</h3>
              <p className="text-sm text-foreground-muted">
                {thermalAlerts.filter(a => !a.acknowledged).length} alerta(s) de temperatura elevada detectado(s)
              </p>
            </div>
            <Link
              to="/cameras/thermal"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              Ver Detalhes
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {thermalAlerts.filter(a => !a.acknowledged).slice(0, 3).map(alert => (
              <div key={alert.id} className="flex items-center justify-between bg-background/50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <ThermometerSun className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-foreground">{alert.cameraName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-orange-400">{alert.temperature.toFixed(1)}C</span>
                  <span className="text-xs text-foreground-muted">{formatRelativeTime(alert.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard label="Total" value={stats.total} icon={Camera} />
        <StatCard label="Online" value={stats.online} icon={Wifi} color="success" />
        <StatCard label="Offline" value={stats.offline} icon={WifiOff} color="muted" />
        <StatCard label="Gravando" value={stats.recording} icon={Video} color="danger" />
        <StatCard label="Termicas" value={stats.thermalCameras} icon={Thermometer} color="warning" />
        <StatCard label="Com IA" value={stats.activeDetections} icon={Eye} color="secondary" />
        <StatCard label="Alertas" value={stats.withAlerts} icon={AlertTriangle} color="danger" highlight={stats.withAlerts > 0} />
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
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="recording">Gravando</option>
            <option value="alerts">Com alertas</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos tipos</option>
            <option value="standard">Padrao</option>
            <option value="thermal">Termica</option>
            <option value="ptz">PTZ</option>
            <option value="dome">Dome</option>
          </select>
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'grid' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
              title="Grade"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'list' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
              title="Lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('multiview')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'multiview' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
              title="Multiview"
            >
              <LayoutGrid className="w-4 h-4" />
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

      {/* Multiview Layout Selector */}
      {viewMode === 'multiview' && (
        <div className="flex items-center gap-4 bg-surface border border-border rounded-lg p-3">
          <span className="text-sm text-foreground-muted">Layout:</span>
          {(['2x2', '3x3', '4x4'] as const).map(layout => (
            <button
              key={layout}
              onClick={() => setMultiviewLayout(layout)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                multiviewLayout === layout
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-foreground-muted hover:text-foreground'
              )}
            >
              {layout}
            </button>
          ))}
          <span className="text-sm text-foreground-muted ml-auto">
            Mostrando {Math.min(multiviewCameras.length, multiviewCount)} cameras
          </span>
        </div>
      )}

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

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : filteredCameras.length === 0 ? (
        <EmptyState searchQuery={searchQuery} statusFilter={statusFilter} typeFilter={typeFilter} />
      ) : viewMode === 'multiview' ? (
        <MultiviewGrid cameras={multiviewCameras} layout={multiviewLayout} />
      ) : viewMode === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
              onEdit={setEditingCamera}
              onDelete={setDeletingCamera}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCameras.map((camera) => (
            <CameraListItem
              key={camera.id}
              camera={camera}
              onEdit={setEditingCamera}
              onDelete={setDeletingCamera}
            />
          ))}
        </div>
      )}

      {/* Edit Camera Modal */}
      {editingCamera && (
        <EditCameraModal
          camera={editingCamera}
          onSave={handleUpdateCamera}
          onClose={() => setEditingCamera(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCamera && (
        <DeleteCameraModal
          camera={deletingCamera}
          onConfirm={() => handleDeleteCamera(deletingCamera.id)}
          onClose={() => setDeletingCamera(null)}
        />
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <AddCameraModal
          onSave={handleAddCamera}
          onClose={() => setShowAddModal(false)}
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
  color?: 'success' | 'danger' | 'warning' | 'muted' | 'secondary';
  highlight?: boolean;
}

function StatCard({ label, value, icon: Icon, color, highlight }: StatCardProps) {
  const colorClasses = {
    success: 'text-success-500',
    danger: 'text-danger-500',
    warning: 'text-warning-500',
    muted: 'text-foreground-subtle',
    secondary: 'text-secondary',
  };

  return (
    <div className={cn(
      'bg-surface rounded-lg border p-3 flex items-center gap-3',
      highlight ? 'border-danger-500/50 animate-pulse' : 'border-border'
    )}>
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
  camera: CameraDevice;
  onEdit: (camera: CameraDevice) => void;
  onDelete: (camera: CameraDevice) => void;
}

function CameraCard({ camera, onEdit, onDelete }: CameraCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isOnline = camera.status === 'online' || camera.status === 'recording';
  const isThermal = camera.type === 'thermal';
  const hasAlerts = camera.thermalAlerts && camera.thermalAlerts > 0;

  return (
    <div className={cn(
      'bg-surface rounded-xl border group transition-all hover:shadow-lg',
      hasAlerts ? 'border-orange-500/50' : camera.status === 'error' ? 'border-danger-500/50' : 'border-border'
    )}>
      {/* Thumbnail/Preview */}
      <div className="relative aspect-video bg-background overflow-hidden rounded-t-xl">
        {isOnline && camera.thumbnailUrl ? (
          <img
            src={camera.thumbnailUrl}
            alt={camera.name}
            className={cn('w-full h-full object-cover', isThermal && 'hue-rotate-180 saturate-150')}
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
              <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
              REC
            </span>
          )}
          {isThermal && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/90 text-white">
              Termica
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

        {/* Thermal Temperature Overlay */}
        {isThermal && isOnline && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex items-center justify-between bg-black/70 rounded-lg p-2 text-xs text-white">
              <div className="flex items-center gap-1">
                <ThermometerSun className="w-3 h-3 text-blue-400" />
                <span>{camera.minTemp?.toFixed(1)}C</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-green-400" />
                <span>{camera.avgTemp?.toFixed(1)}C</span>
              </div>
              <div className="flex items-center gap-1">
                <Flame className={cn('w-3 h-3', (camera.maxTemp || 0) > 45 ? 'text-orange-400' : 'text-yellow-400')} />
                <span className={(camera.maxTemp || 0) > 45 ? 'text-orange-400 font-bold' : ''}>
                  {camera.maxTemp?.toFixed(1)}C
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        <Link
          to={`/cameras/${camera.id}`}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <span className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white font-medium flex items-center gap-2">
            <Play className="w-4 h-4" />
            Ver ao vivo
          </span>
        </Link>

        {/* Alert Badge */}
        {hasAlerts && (
          <div className="absolute bottom-2 right-2">
            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-500/90 text-white animate-pulse">
              <AlertCircle className="w-3 h-3" />
              {camera.thermalAlerts} alerta{camera.thermalAlerts! > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Security Zones Badge */}
        {!isThermal && camera.securityZonesCount > 0 && (
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
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {camera.name}
            </h3>
            <p className="text-sm text-foreground-muted truncate flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {camera.location}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-active transition-colors shrink-0"
            >
              <MoreVertical className="w-4 h-4 text-foreground-muted" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(camera);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors rounded-t-lg"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(camera);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-500 hover:bg-danger-500/10 transition-colors rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Apagar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>{camera.manufacturer} {camera.model}</span>
          {camera.lastMotionDetected && isOnline && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(camera.lastMotionDetected)}
            </span>
          )}
        </div>

        {camera.associatedBessName && (
          <div className="mt-2 pt-2 border-t border-border">
            <span className="text-xs text-foreground-muted flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              Vinculada: {camera.associatedBessName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Camera List Item Component (List View)
interface CameraListItemProps {
  camera: CameraDevice;
  onEdit: (camera: CameraDevice) => void;
  onDelete: (camera: CameraDevice) => void;
}

function CameraListItem({ camera, onEdit, onDelete }: CameraListItemProps) {
  const isOnline = camera.status === 'online' || camera.status === 'recording';
  const isThermal = camera.type === 'thermal';
  const hasAlerts = camera.thermalAlerts && camera.thermalAlerts > 0;

  return (
    <Link
      to={`/cameras/${camera.id}`}
      className={cn(
        'flex items-center gap-4 bg-surface rounded-xl border p-4 hover:bg-surface-hover transition-all',
        hasAlerts ? 'border-orange-500/50' : camera.status === 'error' ? 'border-danger-500/50' : 'border-border'
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        'relative w-32 h-20 rounded-lg overflow-hidden bg-background shrink-0',
        isThermal && 'ring-2 ring-orange-500/50'
      )}>
        {isOnline && camera.thumbnailUrl ? (
          <img
            src={camera.thumbnailUrl}
            alt={camera.name}
            className={cn('w-full h-full object-cover', isThermal && 'hue-rotate-180 saturate-150')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-foreground-subtle" />
          </div>
        )}
        {camera.isRecording && (
          <span className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 text-2xs font-medium rounded bg-danger-500/90 text-white">
            <Circle className="w-1 h-1 fill-current animate-pulse" />
            REC
          </span>
        )}
        {isThermal && (
          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-2xs font-medium rounded bg-orange-500/90 text-white">
            <Thermometer className="w-3 h-3 inline" />
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
          {hasAlerts && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/20 text-orange-500 shrink-0 animate-pulse">
              {camera.thermalAlerts} alerta(s)
            </span>
          )}
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

      {/* Thermal Info */}
      {isThermal && isOnline && (
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-xs text-foreground-muted">Min</p>
            <p className="text-sm font-medium text-blue-400">{camera.minTemp?.toFixed(1)}C</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-foreground-muted">Media</p>
            <p className="text-sm font-medium text-foreground">{camera.avgTemp?.toFixed(1)}C</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-foreground-muted">Max</p>
            <p className={cn(
              'text-sm font-medium',
              (camera.maxTemp || 0) > 45 ? 'text-orange-400' : 'text-foreground'
            )}>
              {camera.maxTemp?.toFixed(1)}C
            </p>
          </div>
        </div>
      )}

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

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(camera);
          }}
          className="p-2 bg-surface-hover hover:bg-primary/20 hover:text-primary rounded-lg transition-colors"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(camera);
          }}
          className="p-2 bg-surface-hover hover:bg-danger-500/20 hover:text-danger-500 rounded-lg transition-colors"
          title="Apagar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
    </Link>
  );
}

// Multiview Grid Component
function MultiviewGrid({ cameras, layout }: { cameras: CameraDevice[]; layout: '2x2' | '3x3' | '4x4' }) {
  const cols = layout === '2x2' ? 2 : layout === '3x3' ? 3 : 4;
  const count = cols * cols;
  const displayCameras = cameras.slice(0, count);

  return (
    <div className={cn(
      'grid gap-2 bg-black rounded-xl p-2',
      layout === '2x2' && 'grid-cols-2',
      layout === '3x3' && 'grid-cols-3',
      layout === '4x4' && 'grid-cols-4'
    )}>
      {displayCameras.map(camera => (
        <Link
          key={camera.id}
          to={`/cameras/${camera.id}`}
          className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden group"
        >
          {camera.thumbnailUrl ? (
            <img
              src={camera.thumbnailUrl}
              alt={camera.name}
              className={cn(
                'w-full h-full object-cover',
                camera.type === 'thermal' && 'hue-rotate-180 saturate-150'
              )}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-600" />
            </div>
          )}

          {/* Camera Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white truncate">{camera.name}</span>
              <div className="flex items-center gap-1">
                {camera.isRecording && (
                  <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
                )}
                {camera.type === 'thermal' && camera.maxTemp && (
                  <span className={cn(
                    'text-xs font-medium',
                    camera.maxTemp > 45 ? 'text-orange-400' : 'text-green-400'
                  )}>
                    {camera.maxTemp.toFixed(0)}C
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hover Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <Play className="w-8 h-8 text-white" />
          </div>
        </Link>
      ))}

      {/* Empty slots */}
      {Array(Math.max(0, count - displayCameras.length)).fill(0).map((_, i) => (
        <div key={`empty-${i}`} className="aspect-video bg-gray-900/50 rounded-lg flex items-center justify-center">
          <Camera className="w-8 h-8 text-gray-700" />
        </div>
      ))}
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton({ viewMode }: { viewMode: string }) {
  if (viewMode === 'multiview') {
    return (
      <div className="grid grid-cols-2 gap-2 bg-black rounded-xl p-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-video bg-gray-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-surface rounded-xl border border-border p-4 animate-pulse">
            <div className="w-32 h-20 rounded-lg bg-surface-hover shrink-0" />
            <div className="flex-1">
              <div className="h-5 w-40 bg-surface-hover rounded mb-2" />
              <div className="h-4 w-24 bg-surface-hover rounded mb-2" />
              <div className="h-3 w-48 bg-surface-hover rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-surface rounded-xl border border-border overflow-hidden animate-pulse">
          <div className="aspect-video bg-surface-hover" />
          <div className="p-4">
            <div className="h-5 w-32 bg-surface-hover rounded mb-2" />
            <div className="h-4 w-24 bg-surface-hover rounded mb-3" />
            <div className="h-3 w-full bg-surface-hover rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty State
function EmptyState({ searchQuery, statusFilter, typeFilter }: { searchQuery: string; statusFilter: string; typeFilter: string }) {
  const hasFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="bg-surface rounded-xl border border-border p-12 text-center">
      <Camera className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
      <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma camera encontrada</h3>
      <p className="text-foreground-muted mb-6">
        {hasFilters
          ? 'Tente ajustar os filtros de busca'
          : 'Adicione sua primeira camera para comecar'}
      </p>
      {!hasFilters && (
        <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors">
          <Plus className="w-5 h-5" />
          Adicionar Camera
        </button>
      )}
    </div>
  );
}

// Edit Camera Modal
interface EditCameraModalProps {
  camera: CameraDevice;
  onSave: (camera: CameraDevice) => void;
  onClose: () => void;
}

function EditCameraModal({ camera, onSave, onClose }: EditCameraModalProps) {
  const [formData, setFormData] = useState({
    name: camera.name,
    location: camera.location,
    ipAddress: camera.ipAddress,
    model: camera.model,
    manufacturer: camera.manufacturer,
    type: camera.type,
    streamUrl: camera.streamUrl,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...camera,
      ...formData,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Editar Camera</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Localizacao</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fabricante</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Modelo</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Endereco IP</label>
            <input
              type="text"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">URL do Stream (RTSP)</label>
            <input
              type="text"
              value={formData.streamUrl}
              onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="rtsp://192.168.1.100:554/stream1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CameraDevice['type'] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="standard">Padrao</option>
              <option value="thermal">Termica</option>
              <option value="ptz">PTZ</option>
              <option value="dome">Dome</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Camera Modal
interface DeleteCameraModalProps {
  camera: CameraDevice;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteCameraModal({ camera, onConfirm, onClose }: DeleteCameraModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-danger-500/20 rounded-full flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-danger-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Apagar Camera</h2>
          <p className="text-foreground-muted mb-2">
            Tem certeza que deseja apagar a camera:
          </p>
          <p className="font-semibold text-foreground mb-4">"{camera.name}"</p>
          <p className="text-sm text-foreground-subtle mb-6">
            Esta acao nao pode ser desfeita. Todos os dados e configuracoes da camera serao perdidos.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex items-center gap-2 px-6 py-2 bg-danger-500 hover:bg-danger-600 text-white font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Apagar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Camera Modal
interface AddCameraModalProps {
  onSave: (camera: Omit<CameraDevice, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

function AddCameraModal({ onSave, onClose }: AddCameraModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    ipAddress: '',
    model: '',
    manufacturer: '',
    type: 'standard' as CameraDevice['type'],
    streamUrl: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      status: 'offline',
      connectionStatus: 'disconnected',
      hasPtz: formData.type === 'ptz',
      hasAudio: false,
      hasTalkback: false,
      isRecording: false,
      detectionEnabled: false,
      thermalEnabled: formData.type === 'thermal',
      securityZonesCount: 0,
    } as Omit<CameraDevice, 'id' | 'createdAt' | 'updatedAt'>);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Nova Camera</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Entrada Principal"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Localizacao *</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Portao Frontal"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fabricante</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: Hikvision"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Modelo</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: DS-2CD2385G1-I"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Endereco IP *</label>
            <input
              type="text"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="192.168.1.100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">URL do Stream (RTSP)</label>
            <input
              type="text"
              value={formData.streamUrl}
              onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="rtsp://192.168.1.100:554/stream1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CameraDevice['type'] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="standard">Padrao</option>
              <option value="thermal">Termica</option>
              <option value="ptz">PTZ</option>
              <option value="dome">Dome</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
