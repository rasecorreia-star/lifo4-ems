import { useState, useMemo } from 'react';
import {
  Plug,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  Clock,
  Zap,
  Cloud,
  Database,
  Mail,
  MessageSquare,
  BarChart3,
  Shield,
  Key,
  Link,
  Unlink,
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'mqtt' | 'modbus' | 'database' | 'email' | 'sms' | 'scada';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: string;
  syncInterval?: number;
  dataPoints?: number;
  description: string;
  config?: Record<string, string>;
}

interface WebhookEvent {
  id: string;
  event: string;
  url: string;
  status: 'active' | 'inactive';
  lastTriggered?: string;
  successRate: number;
}

export default function IntegrationHub() {
  const [activeTab, setActiveTab] = useState<'integrations' | 'webhooks' | 'protocols' | 'logs'>('integrations');
  const [showAddModal, setShowAddModal] = useState(false);

  const integrations: Integration[] = useMemo(() => [
    {
      id: '1',
      name: 'SCADA Central',
      type: 'scada',
      provider: 'Schneider Electric',
      status: 'connected',
      lastSync: '2025-01-25T14:45:00',
      syncInterval: 5,
      dataPoints: 1250,
      description: 'Integracao com sistema SCADA central para supervisao',
    },
    {
      id: '2',
      name: 'API CCEE',
      type: 'api',
      provider: 'CCEE Brasil',
      status: 'connected',
      lastSync: '2025-01-25T14:40:00',
      syncInterval: 60,
      dataPoints: 45,
      description: 'Precos de energia do mercado spot',
    },
    {
      id: '3',
      name: 'Weather Service',
      type: 'api',
      provider: 'OpenWeatherMap',
      status: 'connected',
      lastSync: '2025-01-25T14:30:00',
      syncInterval: 30,
      dataPoints: 12,
      description: 'Dados meteorologicos para previsao solar',
    },
    {
      id: '4',
      name: 'BMS Modbus',
      type: 'modbus',
      provider: 'Orion BMS',
      status: 'connected',
      lastSync: '2025-01-25T14:45:30',
      syncInterval: 1,
      dataPoints: 856,
      description: 'Comunicacao com Battery Management System',
    },
    {
      id: '5',
      name: 'MQTT Broker',
      type: 'mqtt',
      provider: 'Eclipse Mosquitto',
      status: 'connected',
      lastSync: '2025-01-25T14:45:45',
      syncInterval: 1,
      dataPoints: 2340,
      description: 'Broker para comunicacao IoT em tempo real',
    },
    {
      id: '6',
      name: 'InfluxDB',
      type: 'database',
      provider: 'InfluxData',
      status: 'connected',
      lastSync: '2025-01-25T14:45:50',
      syncInterval: 1,
      dataPoints: 50000,
      description: 'Banco de dados de series temporais',
    },
    {
      id: '7',
      name: 'Email SMTP',
      type: 'email',
      provider: 'SendGrid',
      status: 'connected',
      lastSync: '2025-01-25T12:00:00',
      description: 'Envio de alertas e relatorios por email',
    },
    {
      id: '8',
      name: 'SMS Gateway',
      type: 'sms',
      provider: 'Twilio',
      status: 'error',
      lastSync: '2025-01-25T10:30:00',
      description: 'Envio de alertas criticos por SMS',
    },
  ], []);

  const webhooks: WebhookEvent[] = useMemo(() => [
    { id: '1', event: 'alert.critical', url: 'https://api.cliente.com/webhooks/alerts', status: 'active', lastTriggered: '2025-01-25T14:30:00', successRate: 98.5 },
    { id: '2', event: 'system.status_change', url: 'https://api.cliente.com/webhooks/status', status: 'active', lastTriggered: '2025-01-25T14:00:00', successRate: 100 },
    { id: '3', event: 'energy.threshold', url: 'https://monitoring.exemplo.com/webhook', status: 'active', lastTriggered: '2025-01-24T18:45:00', successRate: 95.2 },
    { id: '4', event: 'maintenance.scheduled', url: 'https://manutencao.local/api/events', status: 'inactive', successRate: 100 },
  ], []);

  const protocolStats = useMemo(() => [
    { protocol: 'Modbus TCP', devices: 12, messages: 45000, errors: 3 },
    { protocol: 'Modbus RTU', devices: 8, messages: 32000, errors: 0 },
    { protocol: 'MQTT', topics: 45, messages: 120000, errors: 12 },
    { protocol: 'REST API', endpoints: 28, requests: 8500, errors: 45 },
    { protocol: 'OPC-UA', nodes: 156, reads: 25000, errors: 2 },
  ], []);

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500"><CheckCircle className="w-3 h-3" /> Conectado</span>;
      case 'disconnected':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-foreground-muted/20 text-foreground-muted"><XCircle className="w-3 h-3" /> Desconectado</span>;
      case 'error':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500"><AlertTriangle className="w-3 h-3" /> Erro</span>;
      case 'pending':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500"><Clock className="w-3 h-3" /> Pendente</span>;
    }
  };

  const getTypeIcon = (type: Integration['type']) => {
    switch (type) {
      case 'api': return <Cloud className="w-5 h-5 text-primary" />;
      case 'webhook': return <Zap className="w-5 h-5 text-warning-500" />;
      case 'mqtt': return <MessageSquare className="w-5 h-5 text-success-500" />;
      case 'modbus': return <Plug className="w-5 h-5 text-orange-500" />;
      case 'database': return <Database className="w-5 h-5 text-purple-500" />;
      case 'email': return <Mail className="w-5 h-5 text-blue-500" />;
      case 'sms': return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'scada': return <BarChart3 className="w-5 h-5 text-cyan-500" />;
    }
  };

  const stats = useMemo(() => {
    const connected = integrations.filter(i => i.status === 'connected').length;
    const errors = integrations.filter(i => i.status === 'error').length;
    const totalDataPoints = integrations.reduce((sum, i) => sum + (i.dataPoints || 0), 0);
    return { connected, errors, total: integrations.length, totalDataPoints };
  }, [integrations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hub de Integracoes</h1>
          <p className="text-foreground-muted">Gerencie conexoes com sistemas externos</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
            <RefreshCw className="w-4 h-4" />
            Sincronizar Todos
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Integracao
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Plug className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Total Integracoes</p>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Conectadas</p>
              <p className="text-xl font-bold text-success-500">{stats.connected}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Com Erro</p>
              <p className="text-xl font-bold text-danger-500">{stats.errors}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Data Points</p>
              <p className="text-xl font-bold text-foreground">{(stats.totalDataPoints / 1000).toFixed(1)}k</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'integrations'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Plug className="w-4 h-4 inline mr-2" />
          Integracoes
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'webhooks'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Webhooks
        </button>
        <button
          onClick={() => setActiveTab('protocols')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'protocols'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Link className="w-4 h-4 inline mr-2" />
          Protocolos
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Logs
        </button>
      </div>

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="grid md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`bg-surface rounded-xl border p-4 ${
                integration.status === 'error' ? 'border-danger-500' :
                integration.status === 'connected' ? 'border-border' : 'border-warning-500'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-surface-hover rounded-lg">
                    {getTypeIcon(integration.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{integration.name}</h3>
                    <p className="text-xs text-foreground-muted">{integration.provider}</p>
                  </div>
                </div>
                {getStatusBadge(integration.status)}
              </div>

              <p className="text-sm text-foreground-muted mb-4">{integration.description}</p>

              <div className="flex flex-wrap items-center gap-4 mb-4">
                {integration.syncInterval && (
                  <div className="flex items-center gap-1 text-xs text-foreground-muted">
                    <Clock className="w-3 h-3" />
                    <span>Sync: {integration.syncInterval}s</span>
                  </div>
                )}
                {integration.dataPoints && (
                  <div className="flex items-center gap-1 text-xs text-foreground-muted">
                    <Database className="w-3 h-3" />
                    <span>{integration.dataPoints.toLocaleString()} pontos</span>
                  </div>
                )}
                {integration.lastSync && (
                  <div className="flex items-center gap-1 text-xs text-foreground-muted">
                    <RefreshCw className="w-3 h-3" />
                    <span>{new Date(integration.lastSync).toLocaleTimeString('pt-BR')}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button className="p-2 hover:bg-surface-hover rounded-lg" title="Configurar">
                  <Settings className="w-4 h-4 text-foreground-muted" />
                </button>
                <button className="p-2 hover:bg-surface-hover rounded-lg" title="Testar Conexao">
                  <RefreshCw className="w-4 h-4 text-foreground-muted" />
                </button>
                {integration.status === 'connected' ? (
                  <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-danger-500/10 text-danger-500 rounded-lg hover:bg-danger-500/20">
                    <Unlink className="w-3 h-3" /> Desconectar
                  </button>
                ) : (
                  <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-success-500/10 text-success-500 rounded-lg hover:bg-success-500/20">
                    <Link className="w-3 h-3" /> Conectar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Webhooks Configurados</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Novo Webhook
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-hover">
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Evento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">URL</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Taxa Sucesso</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Ultimo Disparo</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {webhooks.map((webhook) => (
                  <tr key={webhook.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-primary">{webhook.event}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground-muted truncate block max-w-xs">{webhook.url}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {webhook.status === 'active' ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Ativo</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-foreground-muted/20 text-foreground-muted">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${
                        webhook.successRate >= 95 ? 'text-success-500' :
                        webhook.successRate >= 80 ? 'text-warning-500' : 'text-danger-500'
                      }`}>
                        {webhook.successRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-foreground-muted">
                        {webhook.lastTriggered
                          ? new Date(webhook.lastTriggered).toLocaleString('pt-BR')
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1 hover:bg-surface-hover rounded" title="Testar">
                          <Zap className="w-4 h-4 text-foreground-muted" />
                        </button>
                        <button className="p-1 hover:bg-surface-hover rounded" title="Editar">
                          <Edit className="w-4 h-4 text-foreground-muted" />
                        </button>
                        <button className="p-1 hover:bg-danger-500/10 rounded" title="Excluir">
                          <Trash2 className="w-4 h-4 text-danger-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Protocols Tab */}
      {activeTab === 'protocols' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocolStats.map((protocol, index) => (
              <div key={index} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">{protocol.protocol}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    protocol.errors === 0 ? 'bg-success-500/20 text-success-500' :
                    protocol.errors < 10 ? 'bg-warning-500/20 text-warning-500' :
                    'bg-danger-500/20 text-danger-500'
                  }`}>
                    {protocol.errors} erros
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-muted">
                      {'devices' in protocol ? 'Dispositivos' : 'topics' in protocol ? 'Topicos' : 'nodes' in protocol ? 'Nodes' : 'Endpoints'}
                    </span>
                    <span className="text-foreground font-medium">
                      {(protocol as { devices?: number }).devices ||
                       (protocol as { topics?: number }).topics ||
                       (protocol as { nodes?: number }).nodes ||
                       (protocol as { endpoints?: number }).endpoints}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-muted">Mensagens/Requests</span>
                    <span className="text-foreground font-medium">
                      {((protocol as { messages?: number }).messages || (protocol as { requests?: number }).requests || (protocol as { reads?: number }).reads || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Protocol Configuration */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Configuracao de Protocolos</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-foreground-muted mb-2">Modbus TCP - Porta</label>
                <input
                  type="number"
                  defaultValue={502}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-2">MQTT - Broker URL</label>
                <input
                  type="text"
                  defaultValue="mqtt://192.168.1.50:1883"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-2">OPC-UA - Endpoint</label>
                <input
                  type="text"
                  defaultValue="opc.tcp://localhost:4840"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-2">API Rate Limit (req/min)</label>
                <input
                  type="number"
                  defaultValue={60}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                Salvar Configuracoes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Logs de Integracao</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
            {[
              { time: '14:45:30', level: 'INFO', source: 'MQTT', message: 'Published to topic bess/telemetry/1' },
              { time: '14:45:28', level: 'DEBUG', source: 'Modbus', message: 'Read holding registers 0-99 from device 1' },
              { time: '14:45:25', level: 'INFO', source: 'API', message: 'GET /api/ccee/prices - 200 OK (125ms)' },
              { time: '14:45:20', level: 'WARN', source: 'SMS', message: 'Connection timeout - retrying in 30s' },
              { time: '14:45:15', level: 'INFO', source: 'SCADA', message: 'Heartbeat sent to central server' },
              { time: '14:45:10', level: 'ERROR', source: 'SMS', message: 'Failed to send alert: API key invalid' },
              { time: '14:45:05', level: 'INFO', source: 'InfluxDB', message: 'Batch write: 500 points in 45ms' },
              { time: '14:45:00', level: 'DEBUG', source: 'Webhook', message: 'Triggered alert.critical -> success' },
            ].map((log, index) => (
              <div key={index} className={`flex items-start gap-4 px-3 py-2 rounded ${
                log.level === 'ERROR' ? 'bg-danger-500/10' :
                log.level === 'WARN' ? 'bg-warning-500/10' : 'bg-surface-hover'
              }`}>
                <span className="text-foreground-muted">{log.time}</span>
                <span className={`w-12 ${
                  log.level === 'ERROR' ? 'text-danger-500' :
                  log.level === 'WARN' ? 'text-warning-500' :
                  log.level === 'INFO' ? 'text-primary' : 'text-foreground-muted'
                }`}>{log.level}</span>
                <span className="text-primary">[{log.source}]</span>
                <span className="text-foreground flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
