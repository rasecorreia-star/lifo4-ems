import { useMemo, useState } from 'react';
import {
  Mail,
  MessageSquare,
  Bell,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Eye,
  Send,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap,
  Clock,
  Tag,
  Code,
} from 'lucide-react';

interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  category: 'alert' | 'report' | 'maintenance' | 'system' | 'user';
  subject?: string;
  content: string;
  variables: string[];
  enabled: boolean;
  lastUsed?: string;
  usageCount: number;
}

export default function NotificationTemplates() {
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms' | 'push'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const templates = useMemo<NotificationTemplate[]>(() => [
    {
      id: 'tpl-1',
      name: 'Alerta Critico de Sistema',
      description: 'Notificacao enviada quando um alerta critico e detectado',
      type: 'email',
      category: 'alert',
      subject: '[CRITICO] Alerta no Sistema {{system_name}}',
      content: `Prezado(a) {{user_name}},

Foi detectado um alerta critico no sistema {{system_name}}.

**Detalhes do Alerta:**
- Tipo: {{alert_type}}
- Severidade: {{severity}}
- Data/Hora: {{timestamp}}
- Descricao: {{description}}

**Acoes Recomendadas:**
{{recommended_actions}}

Por favor, verifique o sistema imediatamente.

Atenciosamente,
Equipe Lifo4 EMS`,
      variables: ['user_name', 'system_name', 'alert_type', 'severity', 'timestamp', 'description', 'recommended_actions'],
      enabled: true,
      lastUsed: '2025-01-22T15:30:00',
      usageCount: 45,
    },
    {
      id: 'tpl-2',
      name: 'Alerta SMS',
      description: 'Mensagem SMS para alertas urgentes',
      type: 'sms',
      category: 'alert',
      content: 'ALERTA {{severity}}: {{system_name}} - {{description}}. Verificar imediatamente. Ref: {{alert_id}}',
      variables: ['severity', 'system_name', 'description', 'alert_id'],
      enabled: true,
      lastUsed: '2025-01-22T14:00:00',
      usageCount: 23,
    },
    {
      id: 'tpl-3',
      name: 'Relatorio Diario',
      description: 'Resumo diario de performance do sistema',
      type: 'email',
      category: 'report',
      subject: 'Relatorio Diario - {{system_name}} - {{date}}',
      content: `Prezado(a) {{user_name}},

Segue o relatorio diario do sistema {{system_name}} referente ao dia {{date}}.

**Resumo de Performance:**
- Energia Gerada: {{energy_generated}} kWh
- Energia Consumida: {{energy_consumed}} kWh
- Economia: R$ {{savings}}
- Eficiencia: {{efficiency}}%
- Disponibilidade: {{availability}}%

**Alertas do Periodo:**
- Criticos: {{critical_alerts}}
- Avisos: {{warning_alerts}}
- Informativos: {{info_alerts}}

Para mais detalhes, acesse o painel em: {{dashboard_url}}

Atenciosamente,
Equipe Lifo4 EMS`,
      variables: ['user_name', 'system_name', 'date', 'energy_generated', 'energy_consumed', 'savings', 'efficiency', 'availability', 'critical_alerts', 'warning_alerts', 'info_alerts', 'dashboard_url'],
      enabled: true,
      lastUsed: '2025-01-22T08:00:00',
      usageCount: 156,
    },
    {
      id: 'tpl-4',
      name: 'Lembrete de Manutencao',
      description: 'Notificacao de manutencao programada',
      type: 'email',
      category: 'maintenance',
      subject: 'Lembrete: Manutencao Programada - {{system_name}}',
      content: `Prezado(a) {{user_name}},

Este e um lembrete de manutencao programada.

**Detalhes:**
- Sistema: {{system_name}}
- Tipo: {{maintenance_type}}
- Data: {{scheduled_date}}
- Responsavel: {{technician_name}}

**Checklist:**
{{checklist}}

Em caso de duvidas, entre em contato com a equipe de manutencao.

Atenciosamente,
Equipe Lifo4 EMS`,
      variables: ['user_name', 'system_name', 'maintenance_type', 'scheduled_date', 'technician_name', 'checklist'],
      enabled: true,
      lastUsed: '2025-01-20T09:00:00',
      usageCount: 34,
    },
    {
      id: 'tpl-5',
      name: 'Push - Bateria Baixa',
      description: 'Notificacao push quando nivel de bateria esta baixo',
      type: 'push',
      category: 'alert',
      content: 'Bateria baixa em {{system_name}}: {{battery_level}}%. Considere ajustar o consumo ou iniciar carga.',
      variables: ['system_name', 'battery_level'],
      enabled: true,
      lastUsed: '2025-01-22T10:30:00',
      usageCount: 89,
    },
    {
      id: 'tpl-6',
      name: 'Bem-vindo ao Sistema',
      description: 'Email de boas-vindas para novos usuarios',
      type: 'email',
      category: 'user',
      subject: 'Bem-vindo ao Lifo4 EMS!',
      content: `Ola {{user_name}},

Seja bem-vindo ao Lifo4 EMS!

Sua conta foi criada com sucesso. Aqui estao suas informacoes de acesso:

- Email: {{user_email}}
- Funcao: {{user_role}}

**Primeiros Passos:**
1. Acesse o sistema em: {{login_url}}
2. Complete seu perfil
3. Explore o dashboard
4. Configure suas notificacoes

Precisa de ajuda? Acesse nossa central de ajuda ou entre em contato.

Atenciosamente,
Equipe Lifo4 EMS`,
      variables: ['user_name', 'user_email', 'user_role', 'login_url'],
      enabled: true,
      lastUsed: '2025-01-18T11:00:00',
      usageCount: 12,
    },
    {
      id: 'tpl-7',
      name: 'Garantia Expirando',
      description: 'Aviso de garantia proxima do vencimento',
      type: 'email',
      category: 'system',
      subject: 'Aviso: Garantia Expirando - {{asset_name}}',
      content: `Prezado(a) {{user_name}},

A garantia do equipamento abaixo esta proxima do vencimento:

**Equipamento:**
- Nome: {{asset_name}}
- Numero de Serie: {{serial_number}}
- Sistema: {{system_name}}
- Vencimento: {{expiry_date}}
- Dias Restantes: {{days_remaining}}

Recomendamos avaliar a renovacao da garantia ou planejar eventual substituicao.

Atenciosamente,
Equipe Lifo4 EMS`,
      variables: ['user_name', 'asset_name', 'serial_number', 'system_name', 'expiry_date', 'days_remaining'],
      enabled: true,
      lastUsed: '2025-01-15T14:00:00',
      usageCount: 8,
    },
    {
      id: 'tpl-8',
      name: 'Webhook - Integracao',
      description: 'Payload para integracoes externas',
      type: 'webhook',
      category: 'system',
      content: `{
  "event": "{{event_type}}",
  "timestamp": "{{timestamp}}",
  "system_id": "{{system_id}}",
  "system_name": "{{system_name}}",
  "data": {
    "metric": "{{metric_name}}",
    "value": {{metric_value}},
    "unit": "{{metric_unit}}"
  },
  "severity": "{{severity}}"
}`,
      variables: ['event_type', 'timestamp', 'system_id', 'system_name', 'metric_name', 'metric_value', 'metric_unit', 'severity'],
      enabled: true,
      lastUsed: '2025-01-22T16:00:00',
      usageCount: 1250,
    },
  ], []);

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesTab = activeTab === 'all' || template.type === activeTab;
      const matchesSearch = searchTerm === '' ||
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [templates, activeTab, searchTerm]);

  const stats = useMemo(() => ({
    total: templates.length,
    email: templates.filter(t => t.type === 'email').length,
    sms: templates.filter(t => t.type === 'sms').length,
    push: templates.filter(t => t.type === 'push').length,
    webhook: templates.filter(t => t.type === 'webhook').length,
  }), [templates]);

  const getTypeIcon = (type: NotificationTemplate['type']) => {
    switch (type) {
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      case 'push': return Bell;
      case 'webhook': return Code;
      default: return Bell;
    }
  };

  const getTypeColor = (type: NotificationTemplate['type']) => {
    switch (type) {
      case 'email': return 'text-blue-500 bg-blue-500/20';
      case 'sms': return 'text-green-500 bg-green-500/20';
      case 'push': return 'text-purple-500 bg-purple-500/20';
      case 'webhook': return 'text-amber-500 bg-amber-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getCategoryColor = (category: NotificationTemplate['category']) => {
    switch (category) {
      case 'alert': return 'text-red-500 bg-red-500/20';
      case 'report': return 'text-blue-500 bg-blue-500/20';
      case 'maintenance': return 'text-amber-500 bg-amber-500/20';
      case 'system': return 'text-purple-500 bg-purple-500/20';
      case 'user': return 'text-green-500 bg-green-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getCategoryLabel = (category: NotificationTemplate['category']) => {
    switch (category) {
      case 'alert': return 'Alerta';
      case 'report': return 'Relatorio';
      case 'maintenance': return 'Manutencao';
      case 'system': return 'Sistema';
      case 'user': return 'Usuario';
      default: return category;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Notificacao</h1>
          <p className="text-foreground-muted">Gerencie templates de email, SMS e notificacoes push</p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-foreground-muted">Email</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.email}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">SMS</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.sms}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-foreground-muted">Push</span>
          </div>
          <p className="text-2xl font-bold text-purple-500">{stats.push}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Webhook</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.webhook}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
          {[
            { id: 'all', label: 'Todos', icon: Bell },
            { id: 'email', label: 'Email', icon: Mail },
            { id: 'sms', label: 'SMS', icon: MessageSquare },
            { id: 'push', label: 'Push', icon: Bell },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const TypeIcon = getTypeIcon(template.type);
          return (
            <div
              key={template.id}
              className="bg-surface rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(template.type)}`}>
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{template.name}</h3>
                    <p className="text-sm text-foreground-muted">{template.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(template.category)}`}>
                    {getCategoryLabel(template.category)}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={template.enabled}
                      onChange={() => {}}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-background peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {template.subject && (
                <div className="mb-3 p-2 bg-background rounded text-sm">
                  <span className="text-foreground-muted">Assunto: </span>
                  <span className="text-foreground">{template.subject}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {template.variables.slice(0, 4).map((variable) => (
                  <span
                    key={variable}
                    className="px-2 py-0.5 bg-background rounded text-xs text-foreground-muted font-mono"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}
                {template.variables.length > 4 && (
                  <span className="text-xs text-foreground-muted">
                    +{template.variables.length - 4} mais
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-4 text-sm text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {template.usageCount} usos
                  </span>
                  {template.lastUsed && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(template.lastUsed).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setPreviewMode(true);
                    }}
                    className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                    title="Duplicar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="bg-surface rounded-lg border border-border p-8 text-center">
          <Bell className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
          <p className="text-foreground-muted">Nenhum template encontrado</p>
        </div>
      )}

      {/* Preview Modal */}
      {previewMode && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
              <div className="flex items-center gap-3">
                {(() => {
                  const TypeIcon = getTypeIcon(selectedTemplate.type);
                  return (
                    <div className={`p-2 rounded-lg ${getTypeColor(selectedTemplate.type)}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-semibold text-foreground">{selectedTemplate.name}</h3>
                  <p className="text-sm text-foreground-muted">{selectedTemplate.type.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewMode(false);
                  setSelectedTemplate(null);
                }}
                className="p-2 hover:bg-surface-hover rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {selectedTemplate.subject && (
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Assunto</p>
                  <p className="text-sm font-medium text-foreground p-3 bg-background rounded-lg">
                    {selectedTemplate.subject}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-foreground-muted mb-1">Conteudo</p>
                <pre className="text-sm text-foreground p-4 bg-background rounded-lg whitespace-pre-wrap font-mono overflow-x-auto">
                  {selectedTemplate.content}
                </pre>
              </div>

              <div>
                <p className="text-xs text-foreground-muted mb-2">Variaveis Disponiveis</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable) => (
                    <span
                      key={variable}
                      className="px-3 py-1.5 bg-primary/20 text-primary rounded-full text-sm font-mono"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  <Send className="w-4 h-4" />
                  Enviar Teste
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors">
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
