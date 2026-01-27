import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Camera,
  Shield,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Home,
  RotateCcw,
  Crosshair,
  Play,
  Pause,
  Circle,
  AlertTriangle,
  Clock,
  MapPin,
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
  hlsUrl?: string;
  status: 'online' | 'offline' | 'error' | 'recording';
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  hasPtz: boolean;
  hasAudio: boolean;
  hasTalkback: boolean;
  isRecording: boolean;
  detectionEnabled: boolean;
  ptzPresets?: PtzPreset[];
  securityZones?: SecurityZone[];
  lastMotionDetected?: string;
  lastCommunication?: string;
}

interface PtzPreset {
  id: string;
  name: string;
  pan: number;
  tilt: number;
  zoom: number;
}

interface SecurityZone {
  id: string;
  name: string;
  type: 'intrusion' | 'tripwire' | 'loitering' | 'fire' | 'smoke';
  isActive: boolean;
  polygon: { x: number; y: number }[];
  color: string;
}

interface DetectionEvent {
  id: string;
  type: 'person' | 'vehicle' | 'fire' | 'smoke' | 'motion' | 'intrusion';
  confidence: number;
  timestamp: string;
  zoneId?: string;
  zoneName?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export default function CameraDetail() {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [camera, setCamera] = useState<Camera | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stream state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isTalkbackActive, setIsTalkbackActive] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showDetections, setShowDetections] = useState(true);

  // PTZ state
  const [isPtzActive, setIsPtzActive] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Detection events
  const [recentDetections, setRecentDetections] = useState<DetectionEvent[]>([]);

  // Fetch camera details
  const fetchCamera = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get(`/cameras/${id}`);
      setCamera(response.data.data);
    } catch (err) {
      console.error('Failed to fetch camera:', err);
      setError('Falha ao carregar camera.');
      // Mock data for development
      setCamera({
        id: id,
        name: 'Entrada Principal',
        location: 'Portao Frontal',
        model: 'DS-2CD2385G1-I',
        manufacturer: 'Hikvision',
        ipAddress: '192.168.1.101',
        streamUrl: 'rtsp://192.168.1.101:554/stream1',
        hlsUrl: '/api/cameras/cam-001/stream.m3u8',
        status: 'online',
        connectionStatus: 'connected',
        hasPtz: true,
        hasAudio: true,
        hasTalkback: true,
        isRecording: true,
        detectionEnabled: true,
        ptzPresets: [
          { id: 'preset-1', name: 'Portao', pan: 0, tilt: 0, zoom: 1 },
          { id: 'preset-2', name: 'Estacionamento', pan: 45, tilt: -10, zoom: 2 },
          { id: 'preset-3', name: 'Entrada Pedestres', pan: -30, tilt: 5, zoom: 1.5 },
        ],
        securityZones: [
          {
            id: 'zone-1',
            name: 'Zona de Intrusao',
            type: 'intrusion',
            isActive: true,
            polygon: [
              { x: 0.1, y: 0.5 },
              { x: 0.4, y: 0.5 },
              { x: 0.4, y: 0.9 },
              { x: 0.1, y: 0.9 },
            ],
            color: '#ef4444',
          },
          {
            id: 'zone-2',
            name: 'Linha de Tripwire',
            type: 'tripwire',
            isActive: true,
            polygon: [
              { x: 0.5, y: 0.3 },
              { x: 0.9, y: 0.7 },
            ],
            color: '#f59e0b',
          },
        ],
        lastMotionDetected: new Date(Date.now() - 300000).toISOString(),
        lastCommunication: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Fetch recent detections
  const fetchDetections = useCallback(async () => {
    if (!id) return;

    try {
      const response = await api.get(`/cameras/${id}/detections`, {
        params: { limit: 10 },
      });
      setRecentDetections(response.data.data || []);
    } catch (err) {
      // Mock data
      setRecentDetections([
        {
          id: 'det-1',
          type: 'person',
          confidence: 0.95,
          timestamp: new Date(Date.now() - 60000).toISOString(),
          zoneId: 'zone-1',
          zoneName: 'Zona de Intrusao',
          boundingBox: { x: 0.2, y: 0.4, width: 0.1, height: 0.3 },
        },
        {
          id: 'det-2',
          type: 'vehicle',
          confidence: 0.88,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          zoneName: 'Area Externa',
        },
        {
          id: 'det-3',
          type: 'motion',
          confidence: 0.72,
          timestamp: new Date(Date.now() - 600000).toISOString(),
        },
      ]);
    }
  }, [id]);

  useEffect(() => {
    fetchCamera();
    fetchDetections();
  }, [fetchCamera, fetchDetections]);

  // PTZ Controls
  const handlePtzMove = async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!camera?.hasPtz || !id) return;

    try {
      await api.post(`/cameras/${id}/ptz/move`, { direction, speed: 0.5 });
    } catch (err) {
      console.error('PTZ move failed:', err);
    }
  };

  const handlePtzZoom = async (direction: 'in' | 'out') => {
    if (!camera?.hasPtz || !id) return;

    try {
      await api.post(`/cameras/${id}/ptz/zoom`, { direction, speed: 0.3 });
      setZoomLevel((prev) => direction === 'in' ? Math.min(prev + 0.5, 10) : Math.max(prev - 0.5, 1));
    } catch (err) {
      console.error('PTZ zoom failed:', err);
    }
  };

  const handlePtzPreset = async (presetId: string) => {
    if (!camera?.hasPtz || !id) return;

    try {
      await api.post(`/cameras/${id}/ptz/preset`, { presetId });
      setSelectedPreset(presetId);
    } catch (err) {
      console.error('PTZ preset failed:', err);
    }
  };

  const handlePtzHome = async () => {
    if (!camera?.hasPtz || !id) return;

    try {
      await api.post(`/cameras/${id}/ptz/home`);
      setZoomLevel(1);
      setSelectedPreset(null);
    } catch (err) {
      console.error('PTZ home failed:', err);
    }
  };

  // Talkback
  const toggleTalkback = async () => {
    if (!camera?.hasTalkback || !id) return;

    try {
      if (isTalkbackActive) {
        await api.post(`/cameras/${id}/talkback/stop`);
      } else {
        await api.post(`/cameras/${id}/talkback/start`);
      }
      setIsTalkbackActive(!isTalkbackActive);
    } catch (err) {
      console.error('Talkback toggle failed:', err);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (!isFullscreen) {
      videoRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const isOnline = camera?.status === 'online' || camera?.status === 'recording';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="h-8 w-48 bg-surface-hover rounded animate-pulse" />
        </div>
        <div className="aspect-video bg-surface-hover rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-surface-hover rounded-xl animate-pulse" />
          <div className="h-64 bg-surface-hover rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !camera) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link
            to="/cameras"
            className="p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Camera</h1>
        </div>
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-danger-500" />
          <h3 className="text-lg font-medium text-foreground mb-2">Erro ao carregar camera</h3>
          <p className="text-foreground-muted mb-4">{error || 'Camera nao encontrada'}</p>
          <button
            onClick={fetchCamera}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/cameras"
            className="p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{camera.name}</h1>
            <div className="flex items-center gap-2 text-foreground-muted text-sm">
              <MapPin className="w-4 h-4" />
              <span>{camera.location}</span>
              <span className="text-foreground-subtle">|</span>
              <span>{camera.manufacturer} {camera.model}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
            isOnline ? 'bg-success-500/20 text-success-500' : 'bg-foreground-subtle/20 text-foreground-subtle'
          )}>
            {isOnline ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {camera.isRecording && (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-danger-500/20 text-danger-500">
              <Circle className="w-3 h-3 fill-current animate-pulse" />
              Gravando
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Stream */}
        <div className="lg:col-span-3 space-y-4">
          {/* Video Container */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video group">
            {isOnline ? (
              <>
                {/* Video Element - Placeholder for HLS/RTSP stream */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  muted={isMuted}
                  autoPlay
                  playsInline
                >
                  <source src={camera.hlsUrl || camera.streamUrl} type="application/x-mpegURL" />
                </video>

                {/* Security Zones Overlay */}
                {showZones && camera.securityZones && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {camera.securityZones.map((zone) => {
                      if (zone.type === 'tripwire' && zone.polygon.length === 2) {
                        return (
                          <line
                            key={zone.id}
                            x1={`${zone.polygon[0].x * 100}%`}
                            y1={`${zone.polygon[0].y * 100}%`}
                            x2={`${zone.polygon[1].x * 100}%`}
                            y2={`${zone.polygon[1].y * 100}%`}
                            stroke={zone.color}
                            strokeWidth="3"
                            strokeDasharray="5,5"
                            opacity={zone.isActive ? 0.8 : 0.3}
                          />
                        );
                      }
                      const points = zone.polygon.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ');
                      return (
                        <polygon
                          key={zone.id}
                          points={points}
                          fill={zone.color}
                          fillOpacity={zone.isActive ? 0.2 : 0.1}
                          stroke={zone.color}
                          strokeWidth="2"
                          opacity={zone.isActive ? 0.8 : 0.3}
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Detection Boxes Overlay */}
                {showDetections && recentDetections.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {recentDetections
                      .filter(d => d.boundingBox && Date.now() - new Date(d.timestamp).getTime() < 30000)
                      .map((detection) => (
                        <div
                          key={detection.id}
                          className="absolute border-2 border-primary rounded"
                          style={{
                            left: `${(detection.boundingBox?.x || 0) * 100}%`,
                            top: `${(detection.boundingBox?.y || 0) * 100}%`,
                            width: `${(detection.boundingBox?.width || 0) * 100}%`,
                            height: `${(detection.boundingBox?.height || 0) * 100}%`,
                          }}
                        >
                          <span className="absolute -top-6 left-0 px-2 py-0.5 bg-primary text-white text-xs rounded">
                            {detection.type} ({Math.round(detection.confidence * 100)}%)
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Controls Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Top Bar */}
                  <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-black/50 rounded text-white text-sm">
                        {camera.name}
                      </span>
                      <span className="px-2 py-1 bg-black/50 rounded text-white text-xs">
                        {new Date().toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowZones(!showZones)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          showZones ? 'bg-secondary text-white' : 'bg-black/50 text-white hover:bg-black/70'
                        )}
                        title="Mostrar zonas"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDetections(!showDetections)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          showDetections ? 'bg-primary text-white' : 'bg-black/50 text-white hover:bg-black/70'
                        )}
                        title="Mostrar deteccoes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Bar */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      {camera.hasTalkback && (
                        <button
                          onClick={toggleTalkback}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            isTalkbackActive ? 'bg-danger-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
                          )}
                        >
                          {isTalkbackActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-black/50 rounded text-white text-sm">
                        Zoom: {zoomLevel.toFixed(1)}x
                      </span>
                      <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white">
                <VideoOff className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Camera Offline</p>
                <p className="text-sm opacity-70">
                  Ultima comunicacao: {camera.lastCommunication ? formatRelativeTime(camera.lastCommunication) : 'N/A'}
                </p>
              </div>
            )}
          </div>

          {/* PTZ Controls */}
          {camera.hasPtz && isOnline && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Controles PTZ</h3>
                <button
                  onClick={() => setIsPtzActive(!isPtzActive)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isPtzActive ? 'bg-primary text-white' : 'bg-surface-hover text-foreground-muted'
                  )}
                >
                  {isPtzActive ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <div className="flex items-start gap-6">
                {/* Directional Controls */}
                <div className="grid grid-cols-3 gap-1">
                  <div />
                  <button
                    onClick={() => handlePtzMove('up')}
                    disabled={!isPtzActive}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-5 h-5 text-foreground" />
                  </button>
                  <div />
                  <button
                    onClick={() => handlePtzMove('left')}
                    disabled={!isPtzActive}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    onClick={handlePtzHome}
                    disabled={!isPtzActive}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Crosshair className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    onClick={() => handlePtzMove('right')}
                    disabled={!isPtzActive}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                  <div />
                  <button
                    onClick={() => handlePtzMove('down')}
                    disabled={!isPtzActive}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 text-foreground" />
                  </button>
                  <div />
                </div>

                {/* Zoom Controls */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handlePtzZoom('in')}
                    disabled={!isPtzActive || zoomLevel >= 10}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ZoomIn className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    onClick={() => handlePtzZoom('out')}
                    disabled={!isPtzActive || zoomLevel <= 1}
                    className="p-3 bg-surface-hover hover:bg-surface-active rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ZoomOut className="w-5 h-5 text-foreground" />
                  </button>
                </div>

                {/* Presets */}
                {camera.ptzPresets && camera.ptzPresets.length > 0 && (
                  <div className="flex-1">
                    <p className="text-sm text-foreground-muted mb-2">Presets</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handlePtzHome}
                        disabled={!isPtzActive}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          !selectedPreset ? 'bg-primary text-white' : 'bg-surface-hover text-foreground hover:bg-surface-active',
                          !isPtzActive && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Home className="w-4 h-4 inline mr-1" />
                        Home
                      </button>
                      {camera.ptzPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handlePtzPreset(preset.id)}
                          disabled={!isPtzActive}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            selectedPreset === preset.id ? 'bg-primary text-white' : 'bg-surface-hover text-foreground hover:bg-surface-active',
                            !isPtzActive && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Camera Info */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-4">Informacoes</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">IP</span>
                <span className="text-foreground font-mono">{camera.ipAddress}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Modelo</span>
                <span className="text-foreground">{camera.model}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Fabricante</span>
                <span className="text-foreground">{camera.manufacturer}</span>
              </div>
              <div className="border-t border-border my-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">PTZ</span>
                <span className={camera.hasPtz ? 'text-success-500' : 'text-foreground-subtle'}>
                  {camera.hasPtz ? 'Sim' : 'Nao'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Audio</span>
                <span className={camera.hasAudio ? 'text-success-500' : 'text-foreground-subtle'}>
                  {camera.hasAudio ? 'Sim' : 'Nao'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Talkback</span>
                <span className={camera.hasTalkback ? 'text-success-500' : 'text-foreground-subtle'}>
                  {camera.hasTalkback ? 'Sim' : 'Nao'}
                </span>
              </div>
            </div>
          </div>

          {/* Security Zones */}
          {camera.securityZones && camera.securityZones.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Zonas de Seguranca</h3>
                <Link
                  to={`/cameras/zones?camera=${camera.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Editar
                </Link>
              </div>
              <div className="space-y-2">
                {camera.securityZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between p-2 bg-surface-hover rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="text-sm text-foreground">{zone.name}</span>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      zone.isActive ? 'bg-success-500/20 text-success-500' : 'bg-foreground-subtle/20 text-foreground-subtle'
                    )}>
                      {zone.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Detections */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Deteccoes Recentes</h3>
              <Link
                to={`/cameras/events?camera=${camera.id}`}
                className="text-sm text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>
            {recentDetections.length === 0 ? (
              <p className="text-sm text-foreground-muted text-center py-4">
                Nenhuma deteccao recente
              </p>
            ) : (
              <div className="space-y-2">
                {recentDetections.slice(0, 5).map((detection) => (
                  <div
                    key={detection.id}
                    className="flex items-center justify-between p-2 bg-surface-hover rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        detection.type === 'person' ? 'bg-primary' :
                        detection.type === 'vehicle' ? 'bg-secondary' :
                        detection.type === 'fire' || detection.type === 'smoke' ? 'bg-danger-500' :
                        'bg-warning-500'
                      )} />
                      <div>
                        <span className="text-sm text-foreground capitalize">{detection.type}</span>
                        {detection.zoneName && (
                          <span className="text-xs text-foreground-muted ml-1">
                            - {detection.zoneName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-foreground-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(detection.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-4">Acoes Rapidas</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={`/cameras/events?camera=${camera.id}`}
                className="flex flex-col items-center gap-2 p-3 bg-surface-hover hover:bg-surface-active rounded-lg transition-colors"
              >
                <AlertTriangle className="w-5 h-5 text-warning-500" />
                <span className="text-xs text-foreground">Eventos</span>
              </Link>
              <Link
                to={`/cameras/zones?camera=${camera.id}`}
                className="flex flex-col items-center gap-2 p-3 bg-surface-hover hover:bg-surface-active rounded-lg transition-colors"
              >
                <Shield className="w-5 h-5 text-secondary" />
                <span className="text-xs text-foreground">Zonas</span>
              </Link>
              <Link
                to="/cameras/voice-messages"
                className="flex flex-col items-center gap-2 p-3 bg-surface-hover hover:bg-surface-active rounded-lg transition-colors"
              >
                <Volume2 className="w-5 h-5 text-primary" />
                <span className="text-xs text-foreground">Mensagens</span>
              </Link>
              <button
                className="flex flex-col items-center gap-2 p-3 bg-surface-hover hover:bg-surface-active rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground-muted" />
                <span className="text-xs text-foreground">Config</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
