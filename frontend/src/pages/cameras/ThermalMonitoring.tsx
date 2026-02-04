/**
 * Thermal Monitoring Page for BESS Safety
 * Real-time thermal camera monitoring for battery thermal runaway detection
 * Based on FLIR industrial thermal monitoring best practices
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Thermometer,
  ThermometerSun,
  Flame,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Zap,
  Battery,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Download,
  History,
  Target,
  Maximize2,
  Grid3X3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { cn, formatRelativeTime, formatDate } from '@/lib/utils';
import api from '@/services/api';

// Types
interface ThermalCamera {
  id: string;
  name: string;
  location: string;
  model: string;
  manufacturer: string;
  status: 'online' | 'offline' | 'error';
  resolution: string;
  fov: string;
  temperatureRange: { min: number; max: number };
  currentReadings: {
    minTemp: number;
    maxTemp: number;
    avgTemp: number;
    spotTemp?: number;
  };
  thresholds: {
    warning: number;
    critical: number;
  };
  associatedBess: {
    id: string;
    name: string;
    soc: number;
    status: string;
  };
  zones: ThermalZone[];
  alertsEnabled: boolean;
  lastUpdate: string;
}

interface ThermalZone {
  id: string;
  name: string;
  type: 'roi' | 'line' | 'spot';
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  status: 'normal' | 'warning' | 'critical';
}

interface ThermalAlert {
  id: string;
  cameraId: string;
  cameraName: string;
  zoneId?: string;
  zoneName?: string;
  bessId?: string;
  bessName?: string;
  temperature: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  notes?: string;
}

interface TemperatureHistory {
  time: string;
  min: number;
  max: number;
  avg: number;
  warning: number;
  critical: number;
}

// Generate mock temperature history
const generateTempHistory = (hours: number = 24): TemperatureHistory[] => {
  const data: TemperatureHistory[] = [];
  const now = new Date();
  for (let i = hours * 4; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 15 * 60000);
    const baseTemp = 30 + Math.sin(i / 10) * 5;
    data.push({
      time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      min: baseTemp - 5 + Math.random() * 2,
      max: baseTemp + 10 + Math.random() * 5,
      avg: baseTemp + 2 + Math.random() * 2,
      warning: 45,
      critical: 55,
    });
  }
  return data;
};

export default function ThermalMonitoring() {
  const [cameras, setCameras] = useState<ThermalCamera[]>([]);
  const [alerts, setAlerts] = useState<ThermalAlert[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<ThermalCamera | null>(null);
  const [tempHistory, setTempHistory] = useState<TemperatureHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'grid'>('dashboard');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  // Fetch thermal cameras
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Mock data for development
      const mockCameras: ThermalCamera[] = [
        {
          id: 'thermal-001',
          name: 'BESS Container 1 - Interior',
          location: 'Container BESS 1',
          model: 'FLIR A500f',
          manufacturer: 'FLIR',
          status: 'online',
          resolution: '640x480',
          fov: '80deg',
          temperatureRange: { min: -20, max: 150 },
          currentReadings: {
            minTemp: 22.5,
            maxTemp: 38.2,
            avgTemp: 28.7,
            spotTemp: 35.1,
          },
          thresholds: { warning: 45, critical: 55 },
          associatedBess: {
            id: 'bess-001',
            name: 'BESS Principal',
            soc: 72,
            status: 'charging',
          },
          zones: [
            { id: 'z1', name: 'Rack 1', type: 'roi', minTemp: 22.5, maxTemp: 35.2, avgTemp: 27.8, status: 'normal' },
            { id: 'z2', name: 'Rack 2', type: 'roi', minTemp: 24.1, maxTemp: 38.2, avgTemp: 30.2, status: 'normal' },
            { id: 'z3', name: 'Rack 3', type: 'roi', minTemp: 23.8, maxTemp: 36.5, avgTemp: 29.1, status: 'normal' },
            { id: 'z4', name: 'Rack 4', type: 'roi', minTemp: 25.2, maxTemp: 34.8, avgTemp: 28.9, status: 'normal' },
          ],
          alertsEnabled: true,
          lastUpdate: new Date().toISOString(),
        },
        {
          id: 'thermal-002',
          name: 'BESS Container 2 - Interior',
          location: 'Container BESS 2',
          model: 'FLIR A700f',
          manufacturer: 'FLIR',
          status: 'online',
          resolution: '640x480',
          fov: '80deg',
          temperatureRange: { min: -40, max: 200 },
          currentReadings: {
            minTemp: 24.1,
            maxTemp: 48.8,
            avgTemp: 34.4,
            spotTemp: 46.2,
          },
          thresholds: { warning: 45, critical: 55 },
          associatedBess: {
            id: 'bess-002',
            name: 'BESS Secundario',
            soc: 45,
            status: 'discharging',
          },
          zones: [
            { id: 'z1', name: 'Rack 1', type: 'roi', minTemp: 28.3, maxTemp: 42.1, avgTemp: 34.2, status: 'normal' },
            { id: 'z2', name: 'Rack 2', type: 'roi', minTemp: 30.5, maxTemp: 48.8, avgTemp: 38.5, status: 'warning' },
            { id: 'z3', name: 'Rack 3', type: 'roi', minTemp: 27.9, maxTemp: 44.2, avgTemp: 35.1, status: 'normal' },
            { id: 'z4', name: 'Rack 4', type: 'roi', minTemp: 26.8, maxTemp: 41.5, avgTemp: 33.8, status: 'normal' },
          ],
          alertsEnabled: true,
          lastUpdate: new Date().toISOString(),
        },
        {
          id: 'thermal-003',
          name: 'Inversor PCS',
          location: 'Sala de Inversores',
          model: 'FLIR A400',
          manufacturer: 'FLIR',
          status: 'online',
          resolution: '320x240',
          fov: '60deg',
          temperatureRange: { min: -20, max: 120 },
          currentReadings: {
            minTemp: 28.3,
            maxTemp: 52.1,
            avgTemp: 38.9,
            spotTemp: 49.8,
          },
          thresholds: { warning: 60, critical: 75 },
          associatedBess: {
            id: 'pcs-001',
            name: 'PCS Principal',
            soc: 0,
            status: 'operating',
          },
          zones: [
            { id: 'z1', name: 'IGBTs', type: 'roi', minTemp: 35.2, maxTemp: 52.1, avgTemp: 42.5, status: 'normal' },
            { id: 'z2', name: 'Capacitores', type: 'roi', minTemp: 28.3, maxTemp: 45.8, avgTemp: 36.2, status: 'normal' },
          ],
          alertsEnabled: true,
          lastUpdate: new Date().toISOString(),
        },
      ];

      const mockAlerts: ThermalAlert[] = [
        {
          id: 'alert-001',
          cameraId: 'thermal-002',
          cameraName: 'BESS Container 2 - Interior',
          zoneId: 'z2',
          zoneName: 'Rack 2',
          bessId: 'bess-002',
          bessName: 'BESS Secundario',
          temperature: 48.8,
          threshold: 45,
          severity: 'warning',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          acknowledged: false,
        },
        {
          id: 'alert-002',
          cameraId: 'thermal-002',
          cameraName: 'BESS Container 2 - Interior',
          zoneId: 'z2',
          zoneName: 'Rack 2',
          bessId: 'bess-002',
          bessName: 'BESS Secundario',
          temperature: 46.2,
          threshold: 45,
          severity: 'warning',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          acknowledged: true,
          acknowledgedBy: 'operador@lifo4.com',
          acknowledgedAt: new Date(Date.now() - 540000).toISOString(),
          notes: 'Monitorando - carga alta momentanea',
        },
        {
          id: 'alert-003',
          cameraId: 'thermal-002',
          cameraName: 'BESS Container 2 - Interior',
          temperature: 47.5,
          threshold: 45,
          severity: 'warning',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          acknowledged: true,
          acknowledgedBy: 'admin@lifo4.com',
          acknowledgedAt: new Date(Date.now() - 1700000).toISOString(),
        },
      ];

      setCameras(mockCameras);
      setAlerts(mockAlerts);
      setSelectedCamera(mockCameras[0]);
      setTempHistory(generateTempHistory(24));
    } catch (err) {
      setError('Falha ao carregar dados termicos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Real-time updates every 2 seconds
    const interval = setInterval(() => {
      setCameras(prev => prev.map(cam => ({
        ...cam,
        currentReadings: {
          minTemp: cam.currentReadings.minTemp + (Math.random() - 0.5) * 0.3,
          maxTemp: cam.currentReadings.maxTemp + (Math.random() - 0.5) * 0.5,
          avgTemp: cam.currentReadings.avgTemp + (Math.random() - 0.5) * 0.2,
          spotTemp: cam.currentReadings.spotTemp ? cam.currentReadings.spotTemp + (Math.random() - 0.5) * 0.4 : undefined,
        },
        zones: cam.zones.map(z => ({
          ...z,
          minTemp: z.minTemp + (Math.random() - 0.5) * 0.2,
          maxTemp: z.maxTemp + (Math.random() - 0.5) * 0.3,
          avgTemp: z.avgTemp + (Math.random() - 0.5) * 0.2,
        })),
        lastUpdate: new Date().toISOString(),
      })));

      // Update selected camera too
      setSelectedCamera(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentReadings: {
            minTemp: prev.currentReadings.minTemp + (Math.random() - 0.5) * 0.3,
            maxTemp: prev.currentReadings.maxTemp + (Math.random() - 0.5) * 0.5,
            avgTemp: prev.currentReadings.avgTemp + (Math.random() - 0.5) * 0.2,
            spotTemp: prev.currentReadings.spotTemp ? prev.currentReadings.spotTemp + (Math.random() - 0.5) * 0.4 : undefined,
          },
          lastUpdate: new Date().toISOString(),
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAcknowledgeAlert = async (alertId: string, notes?: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId
        ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString(), notes }
        : a
    ));
  };

  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const getTemperatureColor = (temp: number, warning: number, critical: number) => {
    if (temp >= critical) return 'text-red-500';
    if (temp >= warning) return 'text-orange-500';
    if (temp >= warning - 10) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getTemperatureBg = (temp: number, warning: number, critical: number) => {
    if (temp >= critical) return 'bg-red-500/20 border-red-500/50';
    if (temp >= warning) return 'bg-orange-500/20 border-orange-500/50';
    if (temp >= warning - 10) return 'bg-yellow-500/20 border-yellow-500/50';
    return 'bg-green-500/20 border-green-500/50';
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/cameras" className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Thermometer className="w-7 h-7 text-orange-500" />
              Monitoramento Termico BESS
            </h1>
            <p className="text-foreground-muted text-sm">
              Deteccao de thermal runaway em tempo real | {cameras.filter(c => c.status === 'online').length} cameras ativas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('dashboard')}
              className={cn(
                'px-3 py-1.5 rounded text-sm transition-colors',
                viewMode === 'dashboard' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-1.5 rounded text-sm transition-colors',
                viewMode === 'grid' ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={fetchData}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
          <Link
            to="/cameras/events"
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Historico
          </Link>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className={cn(
          'rounded-xl p-4 border-2',
          activeAlerts.some(a => a.severity === 'critical')
            ? 'bg-red-500/10 border-red-500/50'
            : 'bg-orange-500/10 border-orange-500/50'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-3 rounded-lg',
              activeAlerts.some(a => a.severity === 'critical') ? 'bg-red-500/20' : 'bg-orange-500/20'
            )}>
              <Flame className={cn(
                'w-8 h-8 animate-pulse',
                activeAlerts.some(a => a.severity === 'critical') ? 'text-red-500' : 'text-orange-500'
              )} />
            </div>
            <div className="flex-1">
              <h3 className={cn(
                'text-lg font-bold',
                activeAlerts.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-orange-400'
              )}>
                {activeAlerts.some(a => a.severity === 'critical') ? 'ALERTA CRITICO' : 'Alertas de Temperatura'}
              </h3>
              <p className="text-sm text-foreground-muted">
                {activeAlerts.length} alerta(s) ativo(s) - Temperatura acima do limite detectada
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
                {Math.max(...activeAlerts.map(a => a.temperature)).toFixed(1)}C
              </p>
              <p className="text-xs text-foreground-muted">Temp. maxima</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {activeAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="flex items-center justify-between bg-background/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className={cn(
                    'w-5 h-5',
                    alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'
                  )} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {alert.cameraName} {alert.zoneName && `- ${alert.zoneName}`}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {alert.bessName} | {formatRelativeTime(alert.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={cn(
                      'text-lg font-bold',
                      alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'
                    )}>
                      {alert.temperature.toFixed(1)}C
                    </p>
                    <p className="text-xs text-foreground-muted">Limite: {alert.threshold}C</p>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="px-3 py-1.5 bg-surface hover:bg-surface-hover rounded-lg text-sm transition-colors"
                  >
                    Reconhecer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-5 h-5 text-primary" />
            <span className="text-sm text-foreground-muted">Cameras</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{cameras.length}</p>
          <p className="text-xs text-success-500">{cameras.filter(c => c.status === 'online').length} online</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Battery className="w-5 h-5 text-green-500" />
            <span className="text-sm text-foreground-muted">BESS Monitorados</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {new Set(cameras.map(c => c.associatedBess.id)).size}
          </p>
          <p className="text-xs text-foreground-muted">sistemas vinculados</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ThermometerSun className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-foreground-muted">Temp. Min</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">
            {Math.min(...cameras.map(c => c.currentReadings.minTemp)).toFixed(1)}C
          </p>
          <p className="text-xs text-foreground-muted">global</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-foreground" />
            <span className="text-sm text-foreground-muted">Temp. Media</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {(cameras.reduce((sum, c) => sum + c.currentReadings.avgTemp, 0) / cameras.length).toFixed(1)}C
          </p>
          <p className="text-xs text-foreground-muted">global</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className={cn(
              'w-5 h-5',
              Math.max(...cameras.map(c => c.currentReadings.maxTemp)) > 45 ? 'text-orange-500' : 'text-yellow-500'
            )} />
            <span className="text-sm text-foreground-muted">Temp. Max</span>
          </div>
          <p className={cn(
            'text-2xl font-bold',
            Math.max(...cameras.map(c => c.currentReadings.maxTemp)) > 45 ? 'text-orange-500' : 'text-foreground'
          )}>
            {Math.max(...cameras.map(c => c.currentReadings.maxTemp)).toFixed(1)}C
          </p>
          <p className="text-xs text-foreground-muted">pico atual</p>
        </div>

        <div className={cn(
          'border rounded-xl p-4',
          activeAlerts.length > 0 ? 'bg-orange-500/10 border-orange-500/50' : 'bg-surface border-border'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={cn(
              'w-5 h-5',
              activeAlerts.length > 0 ? 'text-orange-500' : 'text-foreground-muted'
            )} />
            <span className="text-sm text-foreground-muted">Alertas Ativos</span>
          </div>
          <p className={cn(
            'text-2xl font-bold',
            activeAlerts.length > 0 ? 'text-orange-500' : 'text-foreground'
          )}>
            {activeAlerts.length}
          </p>
          <p className="text-xs text-foreground-muted">
            {alerts.filter(a => a.acknowledged).length} reconhecidos
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Cameras Termicas</h3>
          {cameras.map(camera => {
            const isSelected = selectedCamera?.id === camera.id;
            const hasWarning = camera.currentReadings.maxTemp >= camera.thresholds.warning;
            const hasCritical = camera.currentReadings.maxTemp >= camera.thresholds.critical;

            return (
              <div
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                  hasCritical ? 'border-red-500 bg-red-500/5' : hasWarning ? 'border-orange-500 bg-orange-500/5' : ''
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      camera.status === 'online'
                        ? hasCritical ? 'bg-red-500/20' : hasWarning ? 'bg-orange-500/20' : 'bg-green-500/20'
                        : 'bg-gray-500/20'
                    )}>
                      <Thermometer className={cn(
                        'w-5 h-5',
                        camera.status === 'online'
                          ? hasCritical ? 'text-red-500' : hasWarning ? 'text-orange-500' : 'text-green-500'
                          : 'text-gray-500'
                      )} />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{camera.name}</h4>
                      <p className="text-xs text-foreground-muted">{camera.model}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'px-2 py-1 text-xs rounded-full',
                    camera.status === 'online' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                  )}>
                    {camera.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>

                {/* Temperature Readings */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 bg-background/50 rounded-lg">
                    <p className="text-xs text-foreground-muted">Min</p>
                    <p className="text-sm font-medium text-blue-500">{camera.currentReadings.minTemp.toFixed(1)}C</p>
                  </div>
                  <div className="text-center p-2 bg-background/50 rounded-lg">
                    <p className="text-xs text-foreground-muted">Media</p>
                    <p className="text-sm font-medium text-foreground">{camera.currentReadings.avgTemp.toFixed(1)}C</p>
                  </div>
                  <div className={cn(
                    'text-center p-2 rounded-lg',
                    getTemperatureBg(camera.currentReadings.maxTemp, camera.thresholds.warning, camera.thresholds.critical)
                  )}>
                    <p className="text-xs text-foreground-muted">Max</p>
                    <p className={cn(
                      'text-sm font-bold',
                      getTemperatureColor(camera.currentReadings.maxTemp, camera.thresholds.warning, camera.thresholds.critical)
                    )}>
                      {camera.currentReadings.maxTemp.toFixed(1)}C
                    </p>
                  </div>
                </div>

                {/* Associated BESS */}
                <div className="flex items-center justify-between text-xs text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" />
                    {camera.associatedBess.name}
                  </span>
                  <span>SOC: {camera.associatedBess.soc}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Camera Detail */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCamera && (
            <>
              {/* Camera Header */}
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selectedCamera.name}</h3>
                    <p className="text-foreground-muted flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4" />
                      {selectedCamera.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 bg-surface-hover rounded-lg hover:bg-surface-active transition-colors">
                      <Maximize2 className="w-5 h-5 text-foreground-muted" />
                    </button>
                    <button className="p-2 bg-surface-hover rounded-lg hover:bg-surface-active transition-colors">
                      <Settings className="w-5 h-5 text-foreground-muted" />
                    </button>
                  </div>
                </div>

                {/* Large Temperature Display */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <ThermometerSun className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-500">{selectedCamera.currentReadings.minTemp.toFixed(1)}C</p>
                    <p className="text-xs text-foreground-muted">Minima</p>
                  </div>
                  <div className="text-center p-4 bg-surface-hover border border-border rounded-xl">
                    <Activity className="w-6 h-6 text-foreground mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">{selectedCamera.currentReadings.avgTemp.toFixed(1)}C</p>
                    <p className="text-xs text-foreground-muted">Media</p>
                  </div>
                  <div className={cn(
                    'text-center p-4 border rounded-xl',
                    getTemperatureBg(selectedCamera.currentReadings.maxTemp, selectedCamera.thresholds.warning, selectedCamera.thresholds.critical)
                  )}>
                    <Flame className={cn(
                      'w-6 h-6 mx-auto mb-2',
                      getTemperatureColor(selectedCamera.currentReadings.maxTemp, selectedCamera.thresholds.warning, selectedCamera.thresholds.critical)
                    )} />
                    <p className={cn(
                      'text-2xl font-bold',
                      getTemperatureColor(selectedCamera.currentReadings.maxTemp, selectedCamera.thresholds.warning, selectedCamera.thresholds.critical)
                    )}>
                      {selectedCamera.currentReadings.maxTemp.toFixed(1)}C
                    </p>
                    <p className="text-xs text-foreground-muted">Maxima</p>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <Target className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-500">
                      {selectedCamera.currentReadings.spotTemp?.toFixed(1) || '--'}C
                    </p>
                    <p className="text-xs text-foreground-muted">Spot</p>
                  </div>
                </div>

                {/* Thermal Zones */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">Zonas de Monitoramento</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedCamera.zones.map(zone => (
                      <div
                        key={zone.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          zone.status === 'critical' ? 'bg-red-500/10 border-red-500/50' :
                          zone.status === 'warning' ? 'bg-orange-500/10 border-orange-500/50' :
                          'bg-surface-hover border-border'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground text-sm">{zone.name}</span>
                          {zone.status === 'warning' && <AlertCircle className="w-4 h-4 text-orange-500" />}
                          {zone.status === 'critical' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          {zone.status === 'normal' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground-muted">Max: <span className={cn(
                            'font-medium',
                            zone.status === 'critical' ? 'text-red-500' :
                            zone.status === 'warning' ? 'text-orange-500' : 'text-foreground'
                          )}>{zone.maxTemp.toFixed(1)}C</span></span>
                          <span className="text-foreground-muted">Media: {zone.avgTemp.toFixed(1)}C</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Thresholds */}
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-foreground-muted">Limites:</span>
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">
                      Alerta: {selectedCamera.thresholds.warning}C
                    </span>
                    <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs">
                      Critico: {selectedCamera.thresholds.critical}C
                    </span>
                  </div>
                  <button className="text-sm text-primary hover:underline">Configurar</button>
                </div>
              </div>

              {/* Temperature History Chart */}
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-foreground">Historico de Temperatura</h4>
                  <div className="flex items-center gap-2">
                    {(['1h', '6h', '24h', '7d'] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setSelectedTimeRange(range)}
                        className={cn(
                          'px-3 py-1 text-sm rounded-lg transition-colors',
                          selectedTimeRange === range
                            ? 'bg-primary text-white'
                            : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                        )}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tempHistory}>
                      <defs>
                        <linearGradient id="colorMax" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" stroke="var(--foreground-muted)" fontSize={10} />
                      <YAxis stroke="var(--foreground-muted)" fontSize={12} unit="C" domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}C`]}
                      />
                      <Legend />
                      <ReferenceLine y={45} stroke="#f97316" strokeDasharray="5 5" label={{ value: 'Alerta', fill: '#f97316', fontSize: 10 }} />
                      <ReferenceLine y={55} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Critico', fill: '#ef4444', fontSize: 10 }} />
                      <Area
                        type="monotone"
                        dataKey="max"
                        name="Maxima"
                        stroke="#f97316"
                        fillOpacity={1}
                        fill="url(#colorMax)"
                      />
                      <Area
                        type="monotone"
                        dataKey="avg"
                        name="Media"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorAvg)"
                      />
                      <Line
                        type="monotone"
                        dataKey="min"
                        name="Minima"
                        stroke="#06b6d4"
                        strokeWidth={1}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alert History */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Historico de Alertas Termicos</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={(e) => setShowAcknowledged(e.target.checked)}
                className="rounded"
              />
              Mostrar reconhecidos
            </label>
            <button className="px-3 py-1.5 bg-surface-hover rounded-lg text-sm text-foreground-muted hover:text-foreground flex items-center gap-1">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {alerts
            .filter(a => showAcknowledged || !a.acknowledged)
            .map(alert => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  alert.acknowledged
                    ? 'bg-surface-hover border-border'
                    : alert.severity === 'critical'
                      ? 'bg-red-500/10 border-red-500/50'
                      : 'bg-orange-500/10 border-orange-500/50'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-2 rounded-lg',
                    alert.acknowledged ? 'bg-gray-500/20' :
                    alert.severity === 'critical' ? 'bg-red-500/20' : 'bg-orange-500/20'
                  )}>
                    {alert.acknowledged ? (
                      <CheckCircle className="w-5 h-5 text-gray-500" />
                    ) : (
                      <AlertCircle className={cn(
                        'w-5 h-5',
                        alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'
                      )} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {alert.cameraName} {alert.zoneName && `- ${alert.zoneName}`}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {alert.bessName} | {formatDate(alert.timestamp)}
                    </p>
                    {alert.notes && (
                      <p className="text-xs text-foreground-subtle mt-1 italic">"{alert.notes}"</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={cn(
                      'text-lg font-bold',
                      alert.acknowledged ? 'text-foreground-muted' :
                      alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'
                    )}>
                      {alert.temperature.toFixed(1)}C
                    </p>
                    <p className="text-xs text-foreground-muted">Limite: {alert.threshold}C</p>
                  </div>
                  {alert.acknowledged ? (
                    <div className="text-right">
                      <p className="text-xs text-success-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Reconhecido
                      </p>
                      <p className="text-xs text-foreground-muted">{alert.acknowledgedBy?.split('@')[0]}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="px-4 py-2 bg-surface hover:bg-surface-active border border-border rounded-lg text-sm transition-colors"
                    >
                      Reconhecer
                    </button>
                  )}
                </div>
              </div>
            ))}

          {alerts.filter(a => showAcknowledged || !a.acknowledged).length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success-500/50" />
              <p className="text-foreground-muted">Nenhum alerta {showAcknowledged ? '' : 'pendente'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div className="h-8 w-64 bg-surface rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 border border-border h-40 animate-pulse" />
          ))}
        </div>
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border h-96 animate-pulse" />
      </div>
    </div>
  );
}
