import { useState, useEffect } from 'react';
import {
  Wifi,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Radio,
  Zap,
  Battery,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscoveredDevice {
  id: string;
  name: string;
  type: 'bms' | 'inverter' | 'meter';
  manufacturer: string;
  model: string;
  protocol: 'mqtt' | 'modbus_tcp' | 'modbus_rtu' | 'http';
  address: string;
  port?: number;
  topic?: string;
  serialNumber?: string;
  firmware?: string;
  discoveredAt: string;
  signalStrength?: number; // RSSI for wireless
  status: 'new' | 'adding' | 'added' | 'error';
}

interface DeviceDiscoveryProps {
  onDeviceAdded?: (device: DiscoveredDevice) => void;
}

export default function DeviceDiscovery({ onDeviceAdded }: DeviceDiscoveryProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [newDeviceAlert, setNewDeviceAlert] = useState<DiscoveredDevice | null>(null);

  // Auto-scan for devices periodically
  useEffect(() => {
    if (autoScan) {
      scanForDevices();
      const interval = setInterval(scanForDevices, 30000); // Scan every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoScan]);

  // Check for new devices via WebSocket/polling
  useEffect(() => {
    const checkNewDevices = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/v1/discovery/new');
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            const newDevice = data.data[0];
            setNewDeviceAlert(newDevice);
            setDevices(prev => {
              const exists = prev.some(d => d.id === newDevice.id);
              if (!exists) {
                return [...prev, newDevice];
              }
              return prev;
            });
          }
        }
      } catch (error) {
        // Silently fail
      }
    };

    const interval = setInterval(checkNewDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const scanForDevices = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('http://localhost:3001/api/v1/discovery/scan', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.data || []);
        setLastScan(new Date());
      }
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const addDevice = async (device: DiscoveredDevice) => {
    setDevices(prev => prev.map(d =>
      d.id === device.id ? { ...d, status: 'adding' } : d
    ));

    try {
      const response = await fetch('http://localhost:3001/api/v1/discovery/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device),
      });

      if (response.ok) {
        setDevices(prev => prev.map(d =>
          d.id === device.id ? { ...d, status: 'added' } : d
        ));
        onDeviceAdded?.(device);

        // Clear alert if this was the alerted device
        if (newDeviceAlert?.id === device.id) {
          setNewDeviceAlert(null);
        }
      } else {
        setDevices(prev => prev.map(d =>
          d.id === device.id ? { ...d, status: 'error' } : d
        ));
      }
    } catch (error) {
      setDevices(prev => prev.map(d =>
        d.id === device.id ? { ...d, status: 'error' } : d
      ));
    }
  };

  const dismissDevice = (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    if (newDeviceAlert?.id === deviceId) {
      setNewDeviceAlert(null);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'bms':
        return <Battery className="w-5 h-5" />;
      case 'inverter':
        return <Zap className="w-5 h-5" />;
      default:
        return <Radio className="w-5 h-5" />;
    }
  };

  const newDevicesCount = devices.filter(d => d.status === 'new').length;

  return (
    <>
      {/* Floating Alert for New Device */}
      {newDeviceAlert && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
          <div className="bg-surface border border-primary/50 rounded-xl shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Novo Dispositivo Detectado!</h4>
                <p className="text-sm text-foreground-muted mt-1">
                  {newDeviceAlert.manufacturer} {newDeviceAlert.model}
                </p>
                <p className="text-xs text-foreground-muted font-mono">
                  {newDeviceAlert.address}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => addDevice(newDeviceAlert)}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                  <button
                    onClick={() => setNewDeviceAlert(null)}
                    className="px-3 py-1.5 bg-surface-hover rounded-lg text-sm"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNewDeviceAlert(null)}
                className="text-foreground-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Button (shows in header/toolbar) */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={cn(
          "relative px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors",
          showPanel || newDevicesCount > 0
            ? "bg-primary/20 text-primary"
            : "bg-surface-hover hover:bg-surface-hover/80 text-foreground-muted"
        )}
      >
        <Search className={cn("w-4 h-4", isScanning && "animate-pulse")} />
        Auto-Discovery
        {newDevicesCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
            {newDevicesCount}
          </span>
        )}
      </button>

      {/* Discovery Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPanel(false)} />
          <div className="relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[70vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Descoberta de Dispositivos</h3>
                  <p className="text-sm text-foreground-muted">
                    {isScanning ? 'Procurando...' : `${devices.length} dispositivo(s) encontrado(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScan}
                    onChange={(e) => setAutoScan(e.target.checked)}
                    className="rounded"
                  />
                  Auto-scan
                </label>
                <button
                  onClick={scanForDevices}
                  disabled={isScanning}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 text-sm font-medium"
                >
                  <RefreshCw className={cn("w-4 h-4", isScanning && "animate-spin")} />
                  {isScanning ? 'Procurando...' : 'Escanear'}
                </button>
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-2 hover:bg-surface-hover rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Device List */}
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {devices.length === 0 ? (
                <div className="text-center py-12 text-foreground-muted">
                  <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum dispositivo encontrado</p>
                  <p className="text-sm mt-1">Clique em "Escanear" para procurar dispositivos na rede</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className={cn(
                        "p-4 rounded-lg border transition-colors",
                        device.status === 'new' && "border-primary/50 bg-primary/5",
                        device.status === 'added' && "border-green-500/50 bg-green-500/5",
                        device.status === 'error' && "border-red-500/50 bg-red-500/5",
                        device.status === 'adding' && "border-yellow-500/50 bg-yellow-500/5"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            device.status === 'new' && "bg-primary/20 text-primary",
                            device.status === 'added' && "bg-green-500/20 text-green-500",
                            device.status === 'error' && "bg-red-500/20 text-red-500",
                            device.status === 'adding' && "bg-yellow-500/20 text-yellow-500"
                          )}>
                            {getDeviceIcon(device.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">{device.name}</h4>
                              {device.status === 'new' && (
                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                                  Novo
                                </span>
                              )}
                              {device.status === 'added' && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Adicionado
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground-muted">
                              {device.manufacturer} {device.model}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-foreground-muted">
                              <span className="font-mono">{device.address}{device.port ? `:${device.port}` : ''}</span>
                              <span className="uppercase">{device.protocol.replace('_', ' ')}</span>
                              {device.serialNumber && (
                                <span>S/N: {device.serialNumber}</span>
                              )}
                              {device.signalStrength && (
                                <span className="flex items-center gap-1">
                                  <Wifi className="w-3 h-3" />
                                  {device.signalStrength} dBm
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {device.status === 'new' && (
                            <>
                              <button
                                onClick={() => addDevice(device)}
                                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Adicionar
                              </button>
                              <button
                                onClick={() => dismissDevice(device.id)}
                                className="p-1.5 hover:bg-surface-hover rounded-lg text-foreground-muted"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {device.status === 'adding' && (
                            <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
                          )}
                          {device.status === 'error' && (
                            <button
                              onClick={() => addDevice(device)}
                              className="px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-sm flex items-center gap-1"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Tentar Novamente
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {lastScan && (
              <div className="p-3 border-t border-border text-center text-xs text-foreground-muted">
                Ultimo scan: {lastScan.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
