import { useMemo, useState } from 'react';
import {
  Network,
  Wifi,
  Globe,
  Server,
  Shield,
  CheckCircle,
  AlertTriangle,
  Settings,
  RefreshCw,
  Activity,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Save,
  TestTube,
} from 'lucide-react';

interface NetworkInterface {
  id: string;
  name: string;
  type: 'ethernet' | 'wifi' | 'cellular';
  status: 'connected' | 'disconnected' | 'error';
  ipAddress: string;
  subnet: string;
  gateway: string;
  dns: string[];
  mac: string;
  speed: string;
  dhcp: boolean;
}

interface FirewallRule {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  protocol: string;
  port: string;
  action: 'allow' | 'deny';
  enabled: boolean;
}

export default function NetworkConfig() {
  const [activeTab, setActiveTab] = useState<'interfaces' | 'firewall' | 'proxy' | 'dns'>('interfaces');
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const interfaces = useMemo<NetworkInterface[]>(() => [
    {
      id: 'eth0',
      name: 'Ethernet Principal',
      type: 'ethernet',
      status: 'connected',
      ipAddress: '192.168.1.100',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: ['8.8.8.8', '8.8.4.4'],
      mac: '00:1A:2B:3C:4D:5E',
      speed: '1 Gbps',
      dhcp: false,
    },
    {
      id: 'eth1',
      name: 'Ethernet Backup',
      type: 'ethernet',
      status: 'disconnected',
      ipAddress: '192.168.2.100',
      subnet: '255.255.255.0',
      gateway: '192.168.2.1',
      dns: ['8.8.8.8'],
      mac: '00:1A:2B:3C:4D:5F',
      speed: '100 Mbps',
      dhcp: true,
    },
    {
      id: 'wlan0',
      name: 'WiFi',
      type: 'wifi',
      status: 'connected',
      ipAddress: '192.168.1.101',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: ['8.8.8.8', '8.8.4.4'],
      mac: '00:1A:2B:3C:4D:60',
      speed: '450 Mbps',
      dhcp: true,
    },
    {
      id: 'cell0',
      name: '4G LTE Backup',
      type: 'cellular',
      status: 'connected',
      ipAddress: '10.0.0.50',
      subnet: '255.255.255.0',
      gateway: '10.0.0.1',
      dns: ['10.0.0.1'],
      mac: 'N/A',
      speed: '50 Mbps',
      dhcp: true,
    },
  ], []);

  const firewallRules = useMemo<FirewallRule[]>(() => [
    { id: 'fw-1', name: 'HTTP', direction: 'inbound', protocol: 'TCP', port: '80', action: 'allow', enabled: true },
    { id: 'fw-2', name: 'HTTPS', direction: 'inbound', protocol: 'TCP', port: '443', action: 'allow', enabled: true },
    { id: 'fw-3', name: 'SSH', direction: 'inbound', protocol: 'TCP', port: '22', action: 'allow', enabled: true },
    { id: 'fw-4', name: 'MQTT', direction: 'inbound', protocol: 'TCP', port: '1883', action: 'allow', enabled: true },
    { id: 'fw-5', name: 'MQTT SSL', direction: 'inbound', protocol: 'TCP', port: '8883', action: 'allow', enabled: true },
    { id: 'fw-6', name: 'Modbus TCP', direction: 'inbound', protocol: 'TCP', port: '502', action: 'allow', enabled: true },
    { id: 'fw-7', name: 'API Backend', direction: 'inbound', protocol: 'TCP', port: '3001', action: 'allow', enabled: true },
    { id: 'fw-8', name: 'WebSocket', direction: 'inbound', protocol: 'TCP', port: '8080', action: 'allow', enabled: true },
    { id: 'fw-9', name: 'Telnet', direction: 'inbound', protocol: 'TCP', port: '23', action: 'deny', enabled: true },
    { id: 'fw-10', name: 'FTP', direction: 'inbound', protocol: 'TCP', port: '21', action: 'deny', enabled: true },
  ], []);

  const getStatusColor = (status: NetworkInterface['status']) => {
    switch (status) {
      case 'connected': return 'text-green-500 bg-green-500/20';
      case 'disconnected': return 'text-gray-500 bg-gray-500/20';
      case 'error': return 'text-red-500 bg-red-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: NetworkInterface['status']) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      default: return status;
    }
  };

  const getTypeIcon = (type: NetworkInterface['type']) => {
    switch (type) {
      case 'ethernet': return Network;
      case 'wifi': return Wifi;
      case 'cellular': return Globe;
      default: return Network;
    }
  };

  const testConnection = () => {
    setTestingConnection(true);
    setTimeout(() => setTestingConnection(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuracao de Rede</h1>
          <p className="text-foreground-muted">Gerencie interfaces de rede, firewall e conectividade</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={testConnection}
            disabled={testingConnection}
            className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {testingConnection ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
            Testar Conexao
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Internet</p>
              <p className="font-semibold text-green-500">Conectado</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Servidor Cloud</p>
              <p className="font-semibold text-blue-500">Online</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Latencia</p>
              <p className="font-semibold text-foreground">23 ms</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Firewall</p>
              <p className="font-semibold text-primary">Ativo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: 'interfaces', label: 'Interfaces', icon: Network },
            { id: 'firewall', label: 'Firewall', icon: Shield },
            { id: 'proxy', label: 'Proxy', icon: Server },
            { id: 'dns', label: 'DNS', icon: Globe },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'interfaces' && (
        <div className="space-y-4">
          {interfaces.map((iface) => {
            const TypeIcon = getTypeIcon(iface.type);
            return (
              <div key={iface.id} className="bg-surface rounded-lg border border-border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-lg">
                      <TypeIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{iface.name}</h3>
                      <p className="text-sm text-foreground-muted">{iface.id} • {iface.mac}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(iface.status)}`}>
                      {getStatusLabel(iface.status)}
                    </span>
                    <button className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Endereco IP</p>
                    <p className="text-sm font-medium text-foreground">{iface.ipAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Mascara</p>
                    <p className="text-sm font-medium text-foreground">{iface.subnet}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Gateway</p>
                    <p className="text-sm font-medium text-foreground">{iface.gateway}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Velocidade</p>
                    <p className="text-sm font-medium text-foreground">{iface.speed}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={iface.dhcp}
                        onChange={() => {}}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">DHCP</span>
                    </label>
                    <span className="text-sm text-foreground-muted">
                      DNS: {iface.dns.join(', ')}
                    </span>
                  </div>
                  {iface.status === 'connected' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'firewall' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Regras de Firewall</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
              + Nova Regra
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Nome</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Direcao</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Protocolo</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Porta</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Acao</th>
                  <th className="text-center p-4 text-sm font-medium text-foreground-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {firewallRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-surface-hover">
                    <td className="p-4 font-medium text-foreground">{rule.name}</td>
                    <td className="p-4 text-sm text-foreground-muted capitalize">{rule.direction === 'inbound' ? 'Entrada' : 'Saida'}</td>
                    <td className="p-4 text-sm text-foreground">{rule.protocol}</td>
                    <td className="p-4 text-sm text-foreground">{rule.port}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rule.action === 'allow'
                          ? 'text-green-500 bg-green-500/20'
                          : 'text-red-500 bg-red-500/20'
                      }`}>
                        {rule.action === 'allow' ? 'Permitir' : 'Bloquear'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => {}}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-background peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'proxy' && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h3 className="font-semibold text-foreground mb-4">Configuracao de Proxy</h3>
          <div className="space-y-4 max-w-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="proxy" defaultChecked className="text-primary" />
              <span className="text-foreground">Sem Proxy</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="proxy" className="text-primary" />
              <span className="text-foreground">Detectar automaticamente</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="proxy" className="text-primary" />
              <span className="text-foreground">Configuracao manual</span>
            </label>

            <div className="pt-4 border-t border-border space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Servidor HTTP</label>
                  <input
                    type="text"
                    placeholder="proxy.exemplo.com"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Porta</label>
                  <input
                    type="text"
                    placeholder="8080"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Usuario</label>
                  <input
                    type="text"
                    placeholder="usuario"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="******"
                      className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Excecoes (separadas por virgula)</label>
                <input
                  type="text"
                  placeholder="localhost, 127.0.0.1, *.local"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dns' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Servidores DNS</h3>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">DNS Primario</label>
                <input
                  type="text"
                  defaultValue="8.8.8.8"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">DNS Secundario</label>
                <input
                  type="text"
                  defaultValue="8.8.4.4"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">DNS Terciario (opcional)</label>
                <input
                  type="text"
                  placeholder="1.1.1.1"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Hosts Locais</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-background rounded-lg">
                <span className="w-32 text-sm font-mono text-foreground">127.0.0.1</span>
                <span className="text-sm text-foreground-muted">localhost</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-background rounded-lg">
                <span className="w-32 text-sm font-mono text-foreground">192.168.1.100</span>
                <span className="text-sm text-foreground-muted">ems.local</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-background rounded-lg">
                <span className="w-32 text-sm font-mono text-foreground">192.168.1.50</span>
                <span className="text-sm text-foreground-muted">bms-controller.local</span>
              </div>
              <button className="text-sm text-primary hover:underline">+ Adicionar Host</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
