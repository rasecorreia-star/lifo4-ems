import { useEffect, useState, useCallback, useRef, MouseEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Camera,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Settings,
  Copy,
  ChevronDown,
  Palette,
  MapPin,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// Types
interface Point {
  x: number;
  y: number;
}

interface SecurityZone {
  id: string;
  cameraId: string;
  name: string;
  type: 'intrusion' | 'tripwire' | 'loitering' | 'line_crossing' | 'fire_detection' | 'smoke_detection';
  polygon: Point[];
  color: string;
  isActive: boolean;
  sensitivity: number;
  minObjectSize: number;
  maxObjectSize: number;
  detectionTypes: string[];
  alertSeverity: 'critical' | 'high' | 'medium' | 'low';
  schedule?: {
    enabled: boolean;
    days: number[];
    startTime: string;
    endTime: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CameraOption {
  id: string;
  name: string;
  location: string;
  thumbnailUrl?: string;
}

const ZONE_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'intrusion', label: 'Intrusao', description: 'Detecta quando objetos entram na area' },
  { value: 'tripwire', label: 'Tripwire', description: 'Detecta quando objetos cruzam a linha' },
  { value: 'loitering', label: 'Permanencia', description: 'Detecta objetos que permanecem na area' },
  { value: 'line_crossing', label: 'Cruzamento de Linha', description: 'Detecta cruzamento em direcao especifica' },
  { value: 'fire_detection', label: 'Deteccao de Fogo', description: 'Detecta chamas na area' },
  { value: 'smoke_detection', label: 'Deteccao de Fumaca', description: 'Detecta fumaca na area' },
];

const DETECTION_TYPES = [
  { value: 'person', label: 'Pessoa' },
  { value: 'vehicle', label: 'Veiculo' },
  { value: 'animal', label: 'Animal' },
  { value: 'object', label: 'Objeto' },
];

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

export default function SecurityZones() {
  const [searchParams] = useSearchParams();
  const initialCameraId = searchParams.get('camera') || '';
  const canvasRef = useRef<HTMLDivElement>(null);

  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [zones, setZones] = useState<SecurityZone[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(initialCameraId);
  const [selectedCamera, setSelectedCamera] = useState<CameraOption | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editingZone, setEditingZone] = useState<SecurityZone | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showAllZones, setShowAllZones] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // New zone form state
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneType, setNewZoneType] = useState<string>('intrusion');
  const [newZoneColor, setNewZoneColor] = useState('#ef4444');
  const [newZoneSensitivity, setNewZoneSensitivity] = useState(50);
  const [newZoneDetectionTypes, setNewZoneDetectionTypes] = useState<string[]>(['person', 'vehicle']);
  const [newZoneAlertSeverity, setNewZoneAlertSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');

  // Fetch cameras
  const fetchCameras = useCallback(async () => {
    try {
      const response = await api.get('/cameras');
      const cameraData = response.data.data || [];
      setCameras(cameraData.map((c: CameraOption) => ({
        id: c.id,
        name: c.name,
        location: c.location,
        thumbnailUrl: c.thumbnailUrl,
      })));

      if (initialCameraId) {
        const camera = cameraData.find((c: CameraOption) => c.id === initialCameraId);
        if (camera) {
          setSelectedCamera(camera);
        }
      }
    } catch (err) {
      // Mock data
      const mockCameras: CameraOption[] = [
        { id: 'cam-001', name: 'Entrada Principal', location: 'Portao Frontal', thumbnailUrl: '/api/cameras/cam-001/thumbnail' },
        { id: 'cam-002', name: 'Area de Baterias', location: 'Container BESS 1', thumbnailUrl: '/api/cameras/cam-002/thumbnail' },
        { id: 'cam-003', name: 'Estacionamento', location: 'Area Externa' },
        { id: 'cam-004', name: 'Sala de Controle', location: 'Interior - Sala Tecnica', thumbnailUrl: '/api/cameras/cam-004/thumbnail' },
      ];
      setCameras(mockCameras);

      if (initialCameraId) {
        const camera = mockCameras.find(c => c.id === initialCameraId);
        if (camera) {
          setSelectedCamera(camera);
        }
      }
    }
  }, [initialCameraId]);

  // Fetch zones for selected camera
  const fetchZones = useCallback(async () => {
    if (!selectedCameraId) {
      setZones([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get(`/cameras/${selectedCameraId}/zones`);
      setZones(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch zones:', err);
      setError('Falha ao carregar zonas.');

      // Mock data
      const mockZones: SecurityZone[] = [
        {
          id: 'zone-001',
          cameraId: selectedCameraId,
          name: 'Zona de Intrusao Principal',
          type: 'intrusion',
          polygon: [
            { x: 0.1, y: 0.4 },
            { x: 0.5, y: 0.4 },
            { x: 0.5, y: 0.9 },
            { x: 0.1, y: 0.9 },
          ],
          color: '#ef4444',
          isActive: true,
          sensitivity: 60,
          minObjectSize: 5,
          maxObjectSize: 80,
          detectionTypes: ['person', 'vehicle'],
          alertSeverity: 'high',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z',
        },
        {
          id: 'zone-002',
          cameraId: selectedCameraId,
          name: 'Linha de Perimetro',
          type: 'tripwire',
          polygon: [
            { x: 0.6, y: 0.3 },
            { x: 0.9, y: 0.7 },
          ],
          color: '#f59e0b',
          isActive: true,
          sensitivity: 50,
          minObjectSize: 10,
          maxObjectSize: 90,
          detectionTypes: ['person'],
          alertSeverity: 'medium',
          createdAt: '2024-01-16T08:00:00Z',
          updatedAt: '2024-01-20T10:00:00Z',
        },
      ];
      setZones(selectedCameraId ? mockZones : []);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCameraId]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Handle camera selection
  const handleCameraSelect = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    const camera = cameras.find(c => c.id === cameraId);
    setSelectedCamera(camera || null);
    setIsEditing(false);
    setEditingZone(null);
    setDrawingPoints([]);
    setSelectedZoneId(null);
  };

  // Handle canvas click for drawing
  const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // For tripwire, only allow 2 points
    if (newZoneType === 'tripwire' && drawingPoints.length >= 2) {
      return;
    }

    setDrawingPoints((prev) => [...prev, { x, y }]);
  };

  // Handle point removal
  const handleRemovePoint = (index: number) => {
    setDrawingPoints((prev) => prev.filter((_, i) => i !== index));
  };

  // Start new zone creation
  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawingPoints([]);
    setNewZoneName('');
    setNewZoneType('intrusion');
    setNewZoneColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setNewZoneSensitivity(50);
    setNewZoneDetectionTypes(['person', 'vehicle']);
    setNewZoneAlertSeverity('high');
  };

  // Cancel drawing
  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
    setEditingZone(null);
  };

  // Save zone
  const handleSaveZone = async () => {
    if (!selectedCameraId || !newZoneName || drawingPoints.length < 2) {
      return;
    }

    try {
      const zoneData = {
        cameraId: selectedCameraId,
        name: newZoneName,
        type: newZoneType,
        polygon: drawingPoints,
        color: newZoneColor,
        isActive: true,
        sensitivity: newZoneSensitivity,
        minObjectSize: 5,
        maxObjectSize: 80,
        detectionTypes: newZoneDetectionTypes,
        alertSeverity: newZoneAlertSeverity,
      };

      if (editingZone) {
        await api.put(`/cameras/${selectedCameraId}/zones/${editingZone.id}`, zoneData);
        setZones((prev) =>
          prev.map((z) =>
            z.id === editingZone.id
              ? { ...z, ...zoneData, updatedAt: new Date().toISOString() }
              : z
          )
        );
      } else {
        const response = await api.post(`/cameras/${selectedCameraId}/zones`, zoneData);
        const newZone = response.data.data || {
          ...zoneData,
          id: `zone-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setZones((prev) => [...prev, newZone]);
      }

      setIsDrawing(false);
      setDrawingPoints([]);
      setEditingZone(null);
    } catch (err) {
      console.error('Failed to save zone:', err);
      // For demo, add mock zone
      const newZone: SecurityZone = {
        id: `zone-${Date.now()}`,
        cameraId: selectedCameraId,
        name: newZoneName,
        type: newZoneType as SecurityZone['type'],
        polygon: drawingPoints,
        color: newZoneColor,
        isActive: true,
        sensitivity: newZoneSensitivity,
        minObjectSize: 5,
        maxObjectSize: 80,
        detectionTypes: newZoneDetectionTypes,
        alertSeverity: newZoneAlertSeverity,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setZones((prev) => [...prev, newZone]);
      setIsDrawing(false);
      setDrawingPoints([]);
    }
  };

  // Edit zone
  const handleEditZone = (zone: SecurityZone) => {
    setEditingZone(zone);
    setDrawingPoints(zone.polygon);
    setNewZoneName(zone.name);
    setNewZoneType(zone.type);
    setNewZoneColor(zone.color);
    setNewZoneSensitivity(zone.sensitivity);
    setNewZoneDetectionTypes(zone.detectionTypes);
    setNewZoneAlertSeverity(zone.alertSeverity);
    setIsDrawing(true);
  };

  // Delete zone
  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta zona?')) return;

    try {
      await api.delete(`/cameras/${selectedCameraId}/zones/${zoneId}`);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      if (selectedZoneId === zoneId) {
        setSelectedZoneId(null);
      }
    } catch (err) {
      console.error('Failed to delete zone:', err);
      // For demo, remove anyway
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
    }
  };

  // Toggle zone active state
  const handleToggleZone = async (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;

    try {
      await api.patch(`/cameras/${selectedCameraId}/zones/${zoneId}`, {
        isActive: !zone.isActive,
      });
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId ? { ...z, isActive: !z.isActive } : z
        )
      );
    } catch (err) {
      console.error('Failed to toggle zone:', err);
      // For demo, toggle anyway
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId ? { ...z, isActive: !z.isActive } : z
        )
      );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zonas de Seguranca</h1>
          <p className="text-foreground-muted text-sm">
            Configure areas de deteccao para suas cameras
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
          <Link
            to="/cameras/events"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-warning-500/10 hover:bg-warning-500/20 text-warning-500 font-medium rounded-lg transition-colors"
          >
            <AlertTriangle className="w-5 h-5" />
            Eventos
          </Link>
        </div>
      </div>

      {/* Camera Selection */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <label className="block text-sm font-medium text-foreground-muted mb-2">
          Selecione uma camera
        </label>
        <div className="flex flex-wrap gap-3">
          {cameras.map((camera) => (
            <button
              key={camera.id}
              onClick={() => handleCameraSelect(camera.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all',
                selectedCameraId === camera.id
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'bg-surface-hover border-border text-foreground-muted hover:border-foreground-subtle'
              )}
            >
              <Camera className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">{camera.name}</p>
                <p className="text-xs opacity-70">{camera.location}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {selectedCameraId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Zone Editor Canvas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {/* Canvas Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {selectedCamera?.name || 'Camera'}
                  </h3>
                  <span className="text-sm text-foreground-muted">
                    {zones.length} zona{zones.length !== 1 ? 's' : ''} configurada{zones.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAllZones(!showAllZones)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      showAllZones ? 'bg-primary text-white' : 'bg-surface-hover text-foreground-muted'
                    )}
                    title={showAllZones ? 'Ocultar zonas' : 'Mostrar zonas'}
                  >
                    {showAllZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  {!isDrawing ? (
                    <button
                      onClick={handleStartDrawing}
                      className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Zona
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelDrawing}
                      className="flex items-center gap-2 px-3 py-2 bg-danger-500/20 hover:bg-danger-500/30 text-danger-500 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Canvas Area */}
              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={cn(
                  'relative aspect-video bg-black',
                  isDrawing && 'cursor-crosshair'
                )}
              >
                {/* Camera Thumbnail/Preview */}
                {selectedCamera?.thumbnailUrl ? (
                  <img
                    src={selectedCamera.thumbnailUrl}
                    alt={selectedCamera.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-hover">
                    <Camera className="w-16 h-16 text-foreground-subtle" />
                  </div>
                )}

                {/* Existing Zones */}
                {showAllZones && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {zones.map((zone) => {
                      const isSelected = selectedZoneId === zone.id;
                      const opacity = zone.isActive ? (isSelected ? 0.5 : 0.3) : 0.1;

                      if (zone.type === 'tripwire' && zone.polygon.length === 2) {
                        return (
                          <g key={zone.id}>
                            <line
                              x1={`${zone.polygon[0].x * 100}%`}
                              y1={`${zone.polygon[0].y * 100}%`}
                              x2={`${zone.polygon[1].x * 100}%`}
                              y2={`${zone.polygon[1].y * 100}%`}
                              stroke={zone.color}
                              strokeWidth={isSelected ? 4 : 3}
                              strokeDasharray={zone.isActive ? 'none' : '10,5'}
                              opacity={zone.isActive ? 1 : 0.5}
                            />
                            {zone.polygon.map((point, i) => (
                              <circle
                                key={i}
                                cx={`${point.x * 100}%`}
                                cy={`${point.y * 100}%`}
                                r={isSelected ? 8 : 6}
                                fill={zone.color}
                                opacity={zone.isActive ? 1 : 0.5}
                              />
                            ))}
                          </g>
                        );
                      }

                      const points = zone.polygon.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ');
                      return (
                        <g key={zone.id}>
                          <polygon
                            points={points}
                            fill={zone.color}
                            fillOpacity={opacity}
                            stroke={zone.color}
                            strokeWidth={isSelected ? 3 : 2}
                            strokeDasharray={zone.isActive ? 'none' : '10,5'}
                          />
                          {isSelected && zone.polygon.map((point, i) => (
                            <circle
                              key={i}
                              cx={`${point.x * 100}%`}
                              cy={`${point.y * 100}%`}
                              r={6}
                              fill={zone.color}
                            />
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                )}

                {/* Drawing Preview */}
                {isDrawing && drawingPoints.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {newZoneType === 'tripwire' ? (
                      <g>
                        {drawingPoints.length === 2 && (
                          <line
                            x1={`${drawingPoints[0].x * 100}%`}
                            y1={`${drawingPoints[0].y * 100}%`}
                            x2={`${drawingPoints[1].x * 100}%`}
                            y2={`${drawingPoints[1].y * 100}%`}
                            stroke={newZoneColor}
                            strokeWidth={4}
                            strokeDasharray="10,5"
                          />
                        )}
                        {drawingPoints.map((point, i) => (
                          <circle
                            key={i}
                            cx={`${point.x * 100}%`}
                            cy={`${point.y * 100}%`}
                            r={8}
                            fill={newZoneColor}
                            className="cursor-pointer"
                          />
                        ))}
                      </g>
                    ) : (
                      <g>
                        {drawingPoints.length > 2 && (
                          <polygon
                            points={drawingPoints.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
                            fill={newZoneColor}
                            fillOpacity={0.3}
                            stroke={newZoneColor}
                            strokeWidth={3}
                            strokeDasharray="10,5"
                          />
                        )}
                        {drawingPoints.length === 2 && (
                          <line
                            x1={`${drawingPoints[0].x * 100}%`}
                            y1={`${drawingPoints[0].y * 100}%`}
                            x2={`${drawingPoints[1].x * 100}%`}
                            y2={`${drawingPoints[1].y * 100}%`}
                            stroke={newZoneColor}
                            strokeWidth={3}
                            strokeDasharray="10,5"
                          />
                        )}
                        {drawingPoints.map((point, i) => (
                          <circle
                            key={i}
                            cx={`${point.x * 100}%`}
                            cy={`${point.y * 100}%`}
                            r={8}
                            fill={newZoneColor}
                            className="cursor-pointer"
                          />
                        ))}
                      </g>
                    )}
                  </svg>
                )}

                {/* Drawing Instructions */}
                {isDrawing && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3 text-white text-sm">
                    {newZoneType === 'tripwire' ? (
                      <p>Clique para definir os 2 pontos da linha de tripwire ({drawingPoints.length}/2)</p>
                    ) : (
                      <p>Clique para adicionar pontos ao poligono ({drawingPoints.length} pontos). Minimo 3 pontos.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Zone Configuration Form (when drawing) */}
            {isDrawing && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-foreground">
                  {editingZone ? 'Editar Zona' : 'Nova Zona'}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Zone Name */}
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Nome da Zona
                    </label>
                    <input
                      type="text"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="Ex: Zona de Entrada"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Zone Type */}
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Tipo de Zona
                    </label>
                    <select
                      value={newZoneType}
                      onChange={(e) => {
                        setNewZoneType(e.target.value);
                        if (e.target.value === 'tripwire' && drawingPoints.length > 2) {
                          setDrawingPoints(drawingPoints.slice(0, 2));
                        }
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ZONE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Zone Color */}
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Cor
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewZoneColor(color)}
                            className={cn(
                              'w-6 h-6 rounded-full border-2 transition-all',
                              newZoneColor === color ? 'border-white scale-110' : 'border-transparent'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Alert Severity */}
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Severidade do Alerta
                    </label>
                    <select
                      value={newZoneAlertSeverity}
                      onChange={(e) => setNewZoneAlertSeverity(e.target.value as SecurityZone['alertSeverity'])}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="critical">Critico</option>
                      <option value="high">Alto</option>
                      <option value="medium">Medio</option>
                      <option value="low">Baixo</option>
                    </select>
                  </div>

                  {/* Sensitivity */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground-muted">
                        Sensibilidade
                      </label>
                      <span className="text-sm text-foreground">{newZoneSensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={newZoneSensitivity}
                      onChange={(e) => setNewZoneSensitivity(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Detection Types */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Tipos de Deteccao
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DETECTION_TYPES.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => {
                            setNewZoneDetectionTypes((prev) =>
                              prev.includes(type.value)
                                ? prev.filter((t) => t !== type.value)
                                : [...prev, type.value]
                            );
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            newZoneDetectionTypes.includes(type.value)
                              ? 'bg-primary text-white'
                              : 'bg-surface-hover text-foreground-muted hover:bg-surface-active'
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Points List */}
                {drawingPoints.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-2">
                      Pontos ({drawingPoints.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {drawingPoints.map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-2 py-1 bg-surface-hover rounded text-sm"
                        >
                          <span className="text-foreground-muted">P{index + 1}:</span>
                          <span className="text-foreground">
                            ({(point.x * 100).toFixed(0)}%, {(point.y * 100).toFixed(0)}%)
                          </span>
                          <button
                            onClick={() => handleRemovePoint(index)}
                            className="text-danger-500 hover:text-danger-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                  <button
                    onClick={handleCancelDrawing}
                    className="px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveZone}
                    disabled={!newZoneName || drawingPoints.length < (newZoneType === 'tripwire' ? 2 : 3)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Zona
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Zones List Sidebar */}
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-xl">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Zonas Configuradas</h3>
              </div>

              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-surface-hover rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : zones.length === 0 ? (
                <div className="p-8 text-center">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-foreground-subtle opacity-50" />
                  <p className="text-foreground-muted">Nenhuma zona configurada</p>
                  <button
                    onClick={handleStartDrawing}
                    className="mt-3 text-primary hover:underline text-sm"
                  >
                    Criar primeira zona
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={cn(
                        'p-4 hover:bg-surface-hover cursor-pointer transition-colors',
                        selectedZoneId === zone.id && 'bg-surface-hover'
                      )}
                      onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: zone.color }}
                          />
                          <span className="font-medium text-foreground">{zone.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleZone(zone.id);
                          }}
                          className={cn(
                            'p-1 rounded transition-colors',
                            zone.isActive ? 'text-success-500' : 'text-foreground-subtle'
                          )}
                        >
                          {zone.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-surface-active text-foreground-muted">
                          {ZONE_TYPES.find(t => t.value === zone.type)?.label || zone.type}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          zone.isActive ? 'bg-success-500/20 text-success-500' : 'bg-foreground-subtle/20 text-foreground-subtle'
                        )}>
                          {zone.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-foreground-muted">
                        <span>Sensibilidade: {zone.sensitivity}%</span>
                        <span className="text-foreground-subtle">|</span>
                        <span>{zone.polygon.length} pontos</span>
                      </div>

                      {/* Zone Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditZone(zone);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-surface-active hover:bg-primary/20 text-foreground-muted hover:text-primary rounded text-xs transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-surface-active hover:bg-danger-500/20 text-foreground-muted hover:text-danger-500 rounded text-xs transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zone Types Info */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="font-medium text-foreground mb-3">Tipos de Zona</h4>
              <div className="space-y-2">
                {ZONE_TYPES.slice(0, 4).map((type) => (
                  <div key={type.value} className="text-sm">
                    <p className="font-medium text-foreground">{type.label}</p>
                    <p className="text-foreground-muted text-xs">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Camera className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Selecione uma Camera</h3>
          <p className="text-foreground-muted">
            Escolha uma camera acima para configurar suas zonas de seguranca
          </p>
        </div>
      )}
    </div>
  );
}
