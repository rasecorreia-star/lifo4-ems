import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Server,
  Cpu,
  Cable,
  Wifi,
  WifiOff,
  RefreshCw,
  Save,
  TestTube,
  Check,
  X,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Settings,
  Radio,
  Network,
  Power,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModbusDevice {
  id: string;
  name: string;
  type: 'inverter' | 'bms' | 'meter' | 'sensor' | 'pcs';
  protocol: 'tcp' | 'rtu';
  address: string;
  port?: number;
  slaveId: number;
  baudRate?: number;
  dataBits?: number;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: number;
  status: 'online' | 'offline' | 'error';
  lastSeen?: Date;
  registers: ModbusRegister[];
}

interface ModbusRegister {
  id: string;
  name: string;
  address: number;
  type: 'holding' | 'input' | 'coil' | 'discrete';
  dataType: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'string';
  scale?: number;
  unit?: string;
  writable: boolean;
}

const defaultRegisters: ModbusRegister[] = [
  { id: '1', name: 'Tensao DC', address: 100, type: 'input', dataType: 'uint16', scale: 0.1, unit: 'V', writable: false },
  { id: '2', name: 'Corrente DC', address: 101, type: 'input', dataType: 'int16', scale: 0.01, unit: 'A', writable: false },
  { id: '3', name: 'Potencia AC', address: 102, type: 'input', dataType: 'int32', scale: 1, unit: 'W', writable: false },
  { id: '4', name: 'SOC', address: 200, type: 'input', dataType: 'uint16', scale: 0.1, unit: '%', writable: false },
  { id: '5', name: 'SOH', address: 201, type: 'input', dataType: 'uint16', scale: 0.1, unit: '%', writable: false },
  { id: '6', name: 'Temperatura', address: 202, type: 'input', dataType: 'int16', scale: 0.1, unit: 'C', writable: false },
  { id: '7', name: 'Comando Modo', address: 300, type: 'holding', dataType: 'uint16', scale: 1, unit: '', writable: true },
  { id: '8', name: 'Setpoint Potencia', address: 301, type: 'holding', dataType: 'int32', scale: 1, unit: 'W', writable: true },
];

export default function HardwareConfig() {
  const { systemId } = useParams<{ systemId: string }>();
  const [activeTab, setActiveTab] = useState<'devices' | 'protocols' | 'mapping'>('devices');
  const [devices, setDevices] = useState<ModbusDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ModbusDevice | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Load mock devices
  useEffect(() => {
    const mockDevices: ModbusDevice[] = [
      {
        id: 'inv-001',
        name: 'Inversor Principal',
        type: 'inverter',
        protocol: 'tcp',
        address: '192.168.1.100',
        port: 502,
        slaveId: 1,
        status: 'online',
        lastSeen: new Date(),
        registers: defaultRegisters.filter(r => r.address >= 100 && r.address < 200),
      },
      {
        id: 'bms-001',
        name: 'BMS Rack 1',
        type: 'bms',
        protocol: 'rtu',
        address: '/dev/ttyUSB0',
        slaveId: 1,
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        status: 'online',
        lastSeen: new Date(),
        registers: defaultRegisters.filter(r => r.address >= 200 && r.address < 300),
      },
      {
        id: 'bms-002',
        name: 'BMS Rack 2',
        type: 'bms',
        protocol: 'rtu',
        address: '/dev/ttyUSB0',
        slaveId: 2,
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        status: 'error',
        lastSeen: new Date(Date.now() - 300000),
        registers: defaultRegisters.filter(r => r.address >= 200 && r.address < 300),
      },
      {
        id: 'meter-001',
        name: 'Medidor Grid',
        type: 'meter',
        protocol: 'tcp',
        address: '192.168.1.101',
        port: 502,
        slaveId: 1,
        status: 'online',
        lastSeen: new Date(),
        registers: [],
      },
    ];
    setDevices(mockDevices);
  }, [systemId]);

  const handleTestConnection = async (device: ModbusDevice) => {
    setIsTesting(true);
    setTestResult(null);

    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 2000));

    setTestResult(Math.random() > 0.3 ? 'success' : 'error');
    setIsTesting(false);
  };

  const handleSaveDevice = (device: ModbusDevice) => {
    setDevices(prev =>
      prev.map(d => d.id === device.id ? device : d)
    );
    setIsEditing(false);
    setSelectedDevice(null);
  };

  const handleDeleteDevice = (deviceId: string) => {
    if (confirm('Tem certeza que deseja remover este dispositivo?')) {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
    }
  };

  const getDeviceIcon = (type: ModbusDevice['type']) => {
    switch (type) {
      case 'inverter': return Power;
      case 'bms': return Cpu;
      case 'meter': return Activity;
      case 'sensor': return Radio;
      case 'pcs': return Server;
      default: return Cable;
    }
  };

  const getStatusColor = (status: ModbusDevice['status']) => {
    switch (status) {
      case 'online': return 'text-success-500 bg-success-500/10';
      case 'offline': return 'text-foreground-muted bg-surface-hover';
      case 'error': return 'text-danger-500 bg-danger-500/10';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/systems/${systemId}`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuracao de Hardware</h1>
            <p className="text-foreground-muted text-sm">
              Gerencie dispositivos Modbus e comunicacao
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setSelectedDevice({
              id: `new-${Date.now()}`,
              name: 'Novo Dispositivo',
              type: 'inverter',
              protocol: 'tcp',
              address: '',
              port: 502,
              slaveId: 1,
              status: 'offline',
              registers: [],
            });
            setIsEditing(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Dispositivo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border w-fit">
        {[
          { id: 'devices', label: 'Dispositivos', icon: Server },
          { id: 'protocols', label: 'Protocolos', icon: Network },
          { id: 'mapping', label: 'Mapeamento', icon: Cable },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'devices' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Devices List */}
          <div className="lg:col-span-2 space-y-4">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.type);

              return (
                <div
                  key={device.id}
                  className={cn(
                    'bg-surface rounded-xl border p-4 transition-all cursor-pointer',
                    selectedDevice?.id === device.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => {
                    setSelectedDevice(device);
                    setIsEditing(false);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn('p-3 rounded-lg', getStatusColor(device.status))}>
                        <DeviceIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{device.name}</h3>
                          <span className={cn(
                            'px-2 py-0.5 text-xs rounded-full',
                            getStatusColor(device.status)
                          )}>
                            {device.status === 'online' ? 'Online' : device.status === 'offline' ? 'Offline' : 'Erro'}
                          </span>
                        </div>
                        <p className="text-sm text-foreground-muted mt-1">
                          {device.protocol.toUpperCase()} - {device.address}
                          {device.port && `:${device.port}`}
                          {' '}(Slave ID: {device.slaveId})
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-foreground-muted">
                          <span className="capitalize">{device.type}</span>
                          {device.lastSeen && (
                            <span>
                              Visto: {device.lastSeen.toLocaleTimeString('pt-BR')}
                            </span>
                          )}
                          <span>{device.registers.length} registradores</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestConnection(device);
                        }}
                        disabled={isTesting}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                        title="Testar conexao"
                      >
                        {isTesting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDevice(device);
                          setIsEditing(true);
                        }}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDevice(device.id);
                        }}
                        className="p-2 hover:bg-danger-500/10 rounded-lg transition-colors text-danger-500"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Device Details / Editor */}
          <div className="bg-surface rounded-xl border border-border p-6">
            {selectedDevice ? (
              isEditing ? (
                <DeviceEditor
                  device={selectedDevice}
                  onSave={handleSaveDevice}
                  onCancel={() => {
                    setIsEditing(false);
                    if (selectedDevice.id.startsWith('new-')) {
                      setSelectedDevice(null);
                    }
                  }}
                />
              ) : (
                <DeviceDetails
                  device={selectedDevice}
                  testResult={testResult}
                  onEdit={() => setIsEditing(true)}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-foreground-muted">
                <Server className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Selecione um dispositivo</p>
                <p className="text-xs">ou adicione um novo</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'protocols' && <ProtocolsTab />}
      {activeTab === 'mapping' && <MappingTab devices={devices} />}
    </div>
  );
}

// Device Details Component
function DeviceDetails({ device, testResult, onEdit }: {
  device: ModbusDevice;
  testResult: 'success' | 'error' | null;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{device.name}</h2>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </button>
      </div>

      {testResult && (
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-lg text-sm',
          testResult === 'success'
            ? 'bg-success-500/10 text-success-500'
            : 'bg-danger-500/10 text-danger-500'
        )}>
          {testResult === 'success' ? (
            <>
              <Check className="w-4 h-4" />
              Conexao estabelecida com sucesso!
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              Falha na conexao. Verifique as configuracoes.
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-xs text-foreground-muted">Tipo</label>
          <p className="text-sm font-medium text-foreground capitalize">{device.type}</p>
        </div>
        <div>
          <label className="text-xs text-foreground-muted">Protocolo</label>
          <p className="text-sm font-medium text-foreground">{device.protocol.toUpperCase()}</p>
        </div>
        <div>
          <label className="text-xs text-foreground-muted">Endereco</label>
          <p className="text-sm font-medium text-foreground">
            {device.address}{device.port && `:${device.port}`}
          </p>
        </div>
        <div>
          <label className="text-xs text-foreground-muted">Slave ID</label>
          <p className="text-sm font-medium text-foreground">{device.slaveId}</p>
        </div>

        {device.protocol === 'rtu' && (
          <>
            <div>
              <label className="text-xs text-foreground-muted">Baud Rate</label>
              <p className="text-sm font-medium text-foreground">{device.baudRate}</p>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Data Bits</label>
              <p className="text-sm font-medium text-foreground">{device.dataBits}</p>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Paridade</label>
              <p className="text-sm font-medium text-foreground capitalize">{device.parity}</p>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Stop Bits</label>
              <p className="text-sm font-medium text-foreground">{device.stopBits}</p>
            </div>
          </>
        )}
      </div>

      {/* Registers Preview */}
      {device.registers.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-3">Registradores ({device.registers.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {device.registers.map((reg) => (
              <div
                key={reg.id}
                className="flex items-center justify-between text-xs p-2 bg-background rounded-lg"
              >
                <span className="text-foreground">{reg.name}</span>
                <span className="text-foreground-muted">
                  {reg.address} ({reg.type})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Device Editor Component
function DeviceEditor({ device, onSave, onCancel }: {
  device: ModbusDevice;
  onSave: (device: ModbusDevice) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(device);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {device.id.startsWith('new-') ? 'Novo Dispositivo' : 'Editar Dispositivo'}
      </h2>

      <div>
        <label className="block text-sm text-foreground-muted mb-1">Nome</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-foreground-muted mb-1">Tipo</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as ModbusDevice['type'] })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="inverter">Inversor</option>
          <option value="bms">BMS</option>
          <option value="meter">Medidor</option>
          <option value="sensor">Sensor</option>
          <option value="pcs">PCS</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-foreground-muted mb-1">Protocolo</label>
        <select
          value={formData.protocol}
          onChange={(e) => setFormData({ ...formData, protocol: e.target.value as 'tcp' | 'rtu' })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="tcp">Modbus TCP</option>
          <option value="rtu">Modbus RTU</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-foreground-muted mb-1">
          {formData.protocol === 'tcp' ? 'Endereco IP' : 'Porta Serial'}
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder={formData.protocol === 'tcp' ? '192.168.1.100' : '/dev/ttyUSB0'}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      {formData.protocol === 'tcp' && (
        <div>
          <label className="block text-sm text-foreground-muted mb-1">Porta TCP</label>
          <input
            type="number"
            value={formData.port || 502}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {formData.protocol === 'rtu' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-foreground-muted mb-1">Baud Rate</label>
              <select
                value={formData.baudRate || 9600}
                onChange={(e) => setFormData({ ...formData, baudRate: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={4800}>4800</option>
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-foreground-muted mb-1">Data Bits</label>
              <select
                value={formData.dataBits || 8}
                onChange={(e) => setFormData({ ...formData, dataBits: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-foreground-muted mb-1">Paridade</label>
              <select
                value={formData.parity || 'none'}
                onChange={(e) => setFormData({ ...formData, parity: e.target.value as 'none' | 'even' | 'odd' })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="none">Nenhuma</option>
                <option value="even">Par</option>
                <option value="odd">Impar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-foreground-muted mb-1">Stop Bits</label>
              <select
                value={formData.stopBits || 1}
                onChange={(e) => setFormData({ ...formData, stopBits: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm text-foreground-muted mb-1">Slave ID</label>
        <input
          type="number"
          min={1}
          max={247}
          value={formData.slaveId}
          onChange={(e) => setFormData({ ...formData, slaveId: parseInt(e.target.value) })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar
        </button>
      </div>
    </form>
  );
}

// Protocols Tab
function ProtocolsTab() {
  const protocols = [
    {
      name: 'Modbus TCP/IP',
      enabled: true,
      description: 'Comunicacao via rede Ethernet',
      settings: {
        timeout: 3000,
        retries: 3,
        pollInterval: 1000,
      },
    },
    {
      name: 'Modbus RTU',
      enabled: true,
      description: 'Comunicacao serial RS-485',
      settings: {
        timeout: 1000,
        retries: 3,
        pollInterval: 500,
      },
    },
    {
      name: 'CAN Bus',
      enabled: false,
      description: 'Barramento automotivo (em desenvolvimento)',
      settings: null,
    },
    {
      name: 'MQTT',
      enabled: true,
      description: 'Protocolo de mensagens IoT',
      settings: {
        broker: 'localhost',
        port: 1883,
        qos: 1,
      },
    },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {protocols.map((protocol) => (
        <div
          key={protocol.name}
          className={cn(
            'bg-surface rounded-xl border p-6',
            protocol.enabled ? 'border-border' : 'border-border opacity-60'
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                protocol.enabled ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-foreground-muted'
              )}>
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{protocol.name}</h3>
                <p className="text-xs text-foreground-muted">{protocol.description}</p>
              </div>
            </div>
            <div className={cn(
              'px-2 py-1 text-xs rounded-full',
              protocol.enabled
                ? 'bg-success-500/10 text-success-500'
                : 'bg-surface-hover text-foreground-muted'
            )}>
              {protocol.enabled ? 'Ativo' : 'Inativo'}
            </div>
          </div>

          {protocol.settings && (
            <div className="space-y-2 pt-4 border-t border-border">
              {Object.entries(protocol.settings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}

          <button
            disabled={!protocol.enabled}
            className={cn(
              'w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
              protocol.enabled
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-surface-hover text-foreground-muted cursor-not-allowed'
            )}
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      ))}
    </div>
  );
}

// Mapping Tab
function MappingTab({ devices }: { devices: ModbusDevice[] }) {
  const [selectedDevice, setSelectedDevice] = useState<ModbusDevice | null>(devices[0] || null);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0]);
    }
  }, [devices]);

  return (
    <div className="bg-surface rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mapeamento de Registradores</h2>
          <p className="text-sm text-foreground-muted">
            Configure o mapeamento de registradores Modbus para variaveis do sistema
          </p>
        </div>
        <select
          value={selectedDevice?.id || ''}
          onChange={(e) => setSelectedDevice(devices.find(d => d.id === e.target.value) || null)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {selectedDevice && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Nome</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Endereco</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Data Type</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Escala</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Unidade</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase">R/W</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-foreground-muted uppercase">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {defaultRegisters.map((reg) => (
                <tr key={reg.id} className="hover:bg-surface-hover">
                  <td className="py-3 px-4 text-sm text-foreground font-medium">{reg.name}</td>
                  <td className="py-3 px-4 text-sm text-foreground-muted font-mono">{reg.address}</td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      reg.type === 'holding' ? 'bg-blue-500/10 text-blue-500' :
                      reg.type === 'input' ? 'bg-success-500/10 text-success-500' :
                      reg.type === 'coil' ? 'bg-warning-500/10 text-warning-500' :
                      'bg-purple-500/10 text-purple-500'
                    )}>
                      {reg.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground-muted font-mono">{reg.dataType}</td>
                  <td className="py-3 px-4 text-sm text-foreground-muted">{reg.scale || 1}</td>
                  <td className="py-3 px-4 text-sm text-foreground-muted">{reg.unit || '-'}</td>
                  <td className="py-3 px-4">
                    {reg.writable ? (
                      <span className="text-success-500 text-sm">R/W</span>
                    ) : (
                      <span className="text-foreground-muted text-sm">R</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="p-1 hover:bg-surface-hover rounded transition-colors">
                      <Edit2 className="w-4 h-4 text-foreground-muted" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
        <button className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Registrador
        </button>
        <button className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar Mapeamento
        </button>
      </div>
    </div>
  );
}
