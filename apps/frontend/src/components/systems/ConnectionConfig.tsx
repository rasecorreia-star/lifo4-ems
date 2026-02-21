import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Settings,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  TestTube,
  Plug,
  Unplug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildApiUrl } from '@/services/config';

interface ConnectionConfig {
  id: string;
  systemId: string;
  protocol: 'mqtt' | 'modbus_tcp' | 'modbus_rtu' | 'http';
  enabled: boolean;

  // MQTT Config
  mqttBroker?: string;
  mqttPort?: number;
  mqttTopic?: string;
  mqttUsername?: string;
  mqttPassword?: string;

  // Modbus TCP Config
  modbusHost?: string;
  modbusPort?: number;
  modbusSlaveId?: number;

  // Modbus RTU Config
  serialPort?: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';

  // HTTP/API Config
  apiUrl?: string;
  apiKey?: string;

  // BMS Model (for data interpretation)
  bmsModel: string;
  bmsManufacturer: string;

  // Status
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'testing';
  lastConnected?: string;
  lastError?: string;
}

interface ConnectionConfigProps {
  systemId: string;
  systemName: string;
  onConnectionChange?: (connected: boolean) => void;
}

const BMS_MODELS = [
  { manufacturer: 'JK BMS', models: ['PB2A16S20P', 'PB2A8S20P', 'PB2A24S20P', 'BD6A20S10P'] },
  { manufacturer: 'Daly BMS', models: ['Smart BMS 16S', 'Smart BMS 8S', 'Smart BMS 24S'] },
  { manufacturer: 'JBD BMS', models: ['SP04S020', 'SP10S020', 'SP15S020', 'SP16S020'] },
  { manufacturer: 'ANT BMS', models: ['16S 100A', '16S 200A', '24S 100A'] },
  { manufacturer: 'Generic', models: ['Modbus Standard', 'CAN Standard'] },
];

const PROTOCOLS = [
  { value: 'mqtt', label: 'MQTT', description: 'Message Queue (IoT)' },
  { value: 'modbus_tcp', label: 'Modbus TCP', description: 'Ethernet/IP' },
  { value: 'modbus_rtu', label: 'Modbus RTU', description: 'Serial RS485' },
  { value: 'http', label: 'HTTP/API', description: 'REST API' },
];

export default function ConnectionConfig({ systemId, systemName, onConnectionChange }: ConnectionConfigProps) {
  const [config, setConfig] = useState<ConnectionConfig>({
    id: `conn-${systemId}`,
    systemId,
    protocol: 'mqtt',
    enabled: false,
    mqttBroker: 'localhost',
    mqttPort: 1883,
    mqttTopic: `lifo4/${systemId}/telemetry`,
    modbusHost: '192.168.1.100',
    modbusPort: 502,
    modbusSlaveId: 1,
    serialPort: 'COM3',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    apiUrl: 'http://localhost:3002',
    bmsModel: 'PB2A16S20P',
    bmsManufacturer: 'JK BMS',
    connectionStatus: 'disconnected',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load saved config
  useEffect(() => {
    loadConfig();
  }, [systemId]);

  const loadConfig = async () => {
    try {
      const url = buildApiUrl(`/systems/${systemId}/connection`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setConfig(prev => ({ ...prev, ...data.data }));
        }
      }
    } catch (error) {
      // Use default config if not found
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const url = buildApiUrl(`/systems/${systemId}/connection`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setIsEditing(false);
        setTestResult({ success: true, message: 'Configuracao salva com sucesso!' });
      } else {
        setTestResult({ success: false, message: 'Erro ao salvar configuracao' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Erro de conexao com o servidor' });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setConfig(prev => ({ ...prev, connectionStatus: 'testing' }));

    try {
      const response = await fetch(buildApiUrl(`/systems/${systemId}/connection/test`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: `Conexao OK! ${data.data?.message || ''}` });
        setConfig(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      } else {
        setTestResult({ success: false, message: data.error?.message || 'Falha no teste de conexao' });
        setConfig(prev => ({ ...prev, connectionStatus: 'error', lastError: data.error?.message }));
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Nao foi possivel conectar ao servidor' });
      setConfig(prev => ({ ...prev, connectionStatus: 'error' }));
    } finally {
      setIsTesting(false);
    }
  };

  const toggleConnection = async () => {
    const newEnabled = !config.enabled;

    try {
      const response = await fetch(buildApiUrl(`/systems/${systemId}/connection/${newEnabled ? 'connect' : 'disconnect'}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        setConfig(prev => ({
          ...prev,
          enabled: newEnabled,
          connectionStatus: newEnabled ? 'connected' : 'disconnected',
          lastConnected: newEnabled ? new Date().toISOString() : prev.lastConnected,
        }));
        onConnectionChange?.(newEnabled);
        setTestResult({
          success: true,
          message: newEnabled ? 'Conectado com sucesso!' : 'Desconectado'
        });
      } else {
        setTestResult({ success: false, message: data.error?.message || 'Erro ao alterar conexao' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Erro de comunicacao' });
    }
  };

  const getStatusIcon = () => {
    switch (config.connectionStatus) {
      case 'connected':
        return <Wifi className="w-5 h-5 text-green-500" />;
      case 'testing':
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error':
        return <WifiOff className="w-5 h-5 text-red-500" />;
      default:
        return <WifiOff className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (config.connectionStatus) {
      case 'connected':
        return 'Conectado';
      case 'testing':
        return 'Testando...';
      case 'error':
        return 'Erro';
      default:
        return 'Desconectado';
    }
  };

  const selectedManufacturer = BMS_MODELS.find(m => m.manufacturer === config.bmsManufacturer);

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            config.connectionStatus === 'connected' ? 'bg-green-500/20' : 'bg-gray-500/20'
          )}>
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Conexao do Dispositivo</h3>
            <p className="text-sm text-foreground-muted">
              {getStatusText()} {config.enabled && config.connectionStatus === 'connected' && '• Recebendo dados'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 text-sm bg-surface-hover hover:bg-surface-hover/80 rounded-lg flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          )}

          <button
            onClick={toggleConnection}
            disabled={isTesting || !config.protocol}
            className={cn(
              "px-5 py-2.5 text-sm rounded-lg flex items-center gap-2 font-semibold transition-all shadow-lg",
              config.enabled
                ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/30"
                : "bg-green-500 text-white hover:bg-green-600 shadow-green-500/30",
              (isTesting || !config.protocol) && "opacity-50 cursor-not-allowed"
            )}
          >
            {config.enabled ? (
              <>
                <Unplug className="w-5 h-5" />
                Desconectar
              </>
            ) : (
              <>
                <Plug className="w-5 h-5" />
                Conectar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Test Result Message */}
      {testResult && (
        <div className={cn(
          "mb-4 p-3 rounded-lg flex items-center gap-2 text-sm",
          testResult.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}>
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          {testResult.message}
        </div>
      )}

      {/* Connection Info (when not editing) */}
      {!isEditing && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface-hover rounded-lg">
          <div>
            <p className="text-xs text-foreground-muted uppercase">Protocolo</p>
            <p className="font-medium">{PROTOCOLS.find(p => p.value === config.protocol)?.label || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted uppercase">Endereco</p>
            <p className="font-medium font-mono text-sm">
              {config.protocol === 'mqtt' && `${config.mqttBroker}:${config.mqttPort}`}
              {config.protocol === 'modbus_tcp' && `${config.modbusHost}:${config.modbusPort}`}
              {config.protocol === 'modbus_rtu' && `${config.serialPort} @ ${config.baudRate}`}
              {config.protocol === 'http' && config.apiUrl}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted uppercase">BMS</p>
            <p className="font-medium">{config.bmsManufacturer} {config.bmsModel}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted uppercase">Topico/ID</p>
            <p className="font-medium font-mono text-sm truncate">
              {config.protocol === 'mqtt' && config.mqttTopic}
              {config.protocol === 'modbus_tcp' && `Slave ${config.modbusSlaveId}`}
              {config.protocol === 'modbus_rtu' && `Slave ${config.modbusSlaveId}`}
              {config.protocol === 'http' && 'REST API'}
            </p>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {isEditing && (
        <div className="space-y-6">
          {/* Protocol Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Protocolo de Comunicacao
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROTOCOLS.map((protocol) => (
                <button
                  key={protocol.value}
                  onClick={() => setConfig(prev => ({ ...prev, protocol: protocol.value as any }))}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    config.protocol === protocol.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="font-medium text-sm">{protocol.label}</p>
                  <p className="text-xs text-foreground-muted">{protocol.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Protocol-specific config */}
          {config.protocol === 'mqtt' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Broker MQTT</label>
                <input
                  type="text"
                  value={config.mqttBroker}
                  onChange={(e) => setConfig(prev => ({ ...prev, mqttBroker: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="localhost ou IP"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Porta</label>
                <input
                  type="number"
                  value={config.mqttPort}
                  onChange={(e) => setConfig(prev => ({ ...prev, mqttPort: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="1883"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Topico MQTT</label>
                <input
                  type="text"
                  value={config.mqttTopic}
                  onChange={(e) => setConfig(prev => ({ ...prev, mqttTopic: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground font-mono text-sm"
                  placeholder="lifo4/bess-001/telemetry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Usuario (opcional)</label>
                <input
                  type="text"
                  value={config.mqttUsername || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, mqttUsername: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Senha (opcional)</label>
                <input
                  type="password"
                  value={config.mqttPassword || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, mqttPassword: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="********"
                />
              </div>
            </div>
          )}

          {config.protocol === 'modbus_tcp' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Host/IP</label>
                <input
                  type="text"
                  value={config.modbusHost}
                  onChange={(e) => setConfig(prev => ({ ...prev, modbusHost: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Porta</label>
                <input
                  type="number"
                  value={config.modbusPort}
                  onChange={(e) => setConfig(prev => ({ ...prev, modbusPort: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="502"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Slave ID</label>
                <input
                  type="number"
                  value={config.modbusSlaveId}
                  onChange={(e) => setConfig(prev => ({ ...prev, modbusSlaveId: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="1"
                />
              </div>
            </div>
          )}

          {config.protocol === 'modbus_rtu' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Porta Serial</label>
                <input
                  type="text"
                  value={config.serialPort}
                  onChange={(e) => setConfig(prev => ({ ...prev, serialPort: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="COM3 ou /dev/ttyUSB0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Baud Rate</label>
                <select
                  value={config.baudRate}
                  onChange={(e) => setConfig(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                >
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Paridade</label>
                <select
                  value={config.parity}
                  onChange={(e) => setConfig(prev => ({ ...prev, parity: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                >
                  <option value="none">Nenhuma</option>
                  <option value="even">Par (Even)</option>
                  <option value="odd">Impar (Odd)</option>
                </select>
              </div>
            </div>
          )}

          {config.protocol === 'http' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">URL da API</label>
                <input
                  type="text"
                  value={config.apiUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground font-mono text-sm"
                  placeholder="http://localhost:3002"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">API Key (opcional)</label>
                <input
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
                  placeholder="sua-api-key"
                />
              </div>
            </div>
          )}

          {/* BMS Model Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fabricante do BMS</label>
              <select
                value={config.bmsManufacturer}
                onChange={(e) => {
                  const manufacturer = e.target.value;
                  const models = BMS_MODELS.find(m => m.manufacturer === manufacturer)?.models || [];
                  setConfig(prev => ({
                    ...prev,
                    bmsManufacturer: manufacturer,
                    bmsModel: models[0] || ''
                  }));
                }}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
              >
                {BMS_MODELS.map((m) => (
                  <option key={m.manufacturer} value={m.manufacturer}>{m.manufacturer}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Modelo do BMS</label>
              <select
                value={config.bmsModel}
                onChange={(e) => setConfig(prev => ({ ...prev, bmsModel: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-foreground"
              >
                {selectedManufacturer?.models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={testConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 rounded-lg flex items-center gap-2 text-sm font-medium"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
              Testar Conexao
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  loadConfig(); // Reset to saved values
                }}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-hover/80 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                disabled={isSaving}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg flex items-center gap-2 text-sm font-medium"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Configuracao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
