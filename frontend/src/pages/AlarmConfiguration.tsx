import { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Battery,
  Thermometer,
  Zap,
  Activity,
  Clock,
  CheckCircle,
  Volume2,
  VolumeX,
  Mail,
  MessageSquare,
  Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlarmRule {
  id: string;
  name: string;
  category: 'battery' | 'temperature' | 'power' | 'system';
  parameter: string;
  condition: 'gt' | 'lt' | 'eq' | 'between';
  threshold: number;
  threshold2?: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  delay: number;
  channels: ('email' | 'sms' | 'push' | 'webhook')[];
  actions: string[];
}

interface AlarmCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  parameters: { id: string; name: string; unit: string }[];
}

const categories: AlarmCategory[] = [
  {
    id: 'battery',
    name: 'Bateria',
    icon: Battery,
    color: 'text-primary',
    parameters: [
      { id: 'soc', name: 'Estado de Carga (SOC)', unit: '%' },
      { id: 'soh', name: 'Estado de Saude (SOH)', unit: '%' },
      { id: 'voltage', name: 'Tensao', unit: 'V' },
      { id: 'current', name: 'Corrente', unit: 'A' },
      { id: 'cell_imbalance', name: 'Desbalanceamento', unit: 'mV' },
    ],
  },
  {
    id: 'temperature',
    name: 'Temperatura',
    icon: Thermometer,
    color: 'text-danger-500',
    parameters: [
      { id: 'cell_temp', name: 'Temperatura Celula', unit: '°C' },
      { id: 'ambient_temp', name: 'Temperatura Ambiente', unit: '°C' },
      { id: 'inverter_temp', name: 'Temperatura Inversor', unit: '°C' },
      { id: 'temp_delta', name: 'Delta Temperatura', unit: '°C' },
    ],
  },
  {
    id: 'power',
    name: 'Potencia',
    icon: Zap,
    color: 'text-warning-500',
    parameters: [
      { id: 'power_output', name: 'Potencia de Saida', unit: 'kW' },
      { id: 'power_input', name: 'Potencia de Entrada', unit: 'kW' },
      { id: 'frequency', name: 'Frequencia', unit: 'Hz' },
      { id: 'power_factor', name: 'Fator de Potencia', unit: '' },
    ],
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: Activity,
    color: 'text-success-500',
    parameters: [
      { id: 'communication', name: 'Comunicacao', unit: '' },
      { id: 'bms_status', name: 'Status BMS', unit: '' },
      { id: 'inverter_status', name: 'Status Inversor', unit: '' },
      { id: 'contactor', name: 'Contator Principal', unit: '' },
    ],
  },
];

const defaultRules: AlarmRule[] = [
  {
    id: '1',
    name: 'SOC Baixo',
    category: 'battery',
    parameter: 'soc',
    condition: 'lt',
    threshold: 20,
    severity: 'warning',
    enabled: true,
    delay: 60,
    channels: ['email', 'push'],
    actions: ['Reduzir descarga'],
  },
  {
    id: '2',
    name: 'SOC Critico',
    category: 'battery',
    parameter: 'soc',
    condition: 'lt',
    threshold: 10,
    severity: 'critical',
    enabled: true,
    delay: 0,
    channels: ['email', 'sms', 'push', 'webhook'],
    actions: ['Parar descarga', 'Notificar equipe'],
  },
  {
    id: '3',
    name: 'Temperatura Alta',
    category: 'temperature',
    parameter: 'cell_temp',
    condition: 'gt',
    threshold: 45,
    severity: 'warning',
    enabled: true,
    delay: 30,
    channels: ['email', 'push'],
    actions: ['Ativar refrigeracao'],
  },
  {
    id: '4',
    name: 'Temperatura Critica',
    category: 'temperature',
    parameter: 'cell_temp',
    condition: 'gt',
    threshold: 55,
    severity: 'critical',
    enabled: true,
    delay: 0,
    channels: ['email', 'sms', 'push', 'webhook'],
    actions: ['Desligar sistema', 'Acionar emergencia'],
  },
  {
    id: '5',
    name: 'Sobretensao',
    category: 'battery',
    parameter: 'voltage',
    condition: 'gt',
    threshold: 58,
    severity: 'critical',
    enabled: true,
    delay: 5,
    channels: ['email', 'sms', 'push'],
    actions: ['Parar carga'],
  },
  {
    id: '6',
    name: 'Desbalanceamento Alto',
    category: 'battery',
    parameter: 'cell_imbalance',
    condition: 'gt',
    threshold: 100,
    severity: 'warning',
    enabled: true,
    delay: 300,
    channels: ['email'],
    actions: ['Iniciar balanceamento'],
  },
  {
    id: '7',
    name: 'Perda de Comunicacao',
    category: 'system',
    parameter: 'communication',
    condition: 'eq',
    threshold: 0,
    severity: 'critical',
    enabled: true,
    delay: 60,
    channels: ['email', 'sms', 'push'],
    actions: ['Verificar conectividade'],
  },
];

export default function AlarmConfiguration() {
  const [rules, setRules] = useState<AlarmRule[]>(defaultRules);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredRules = selectedCategory
    ? rules.filter(r => r.category === selectedCategory)
    : rules;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-danger-500/20 text-danger-500 border-danger-500/30';
      case 'warning':
        return 'bg-warning-500/20 text-warning-500 border-warning-500/30';
      case 'info':
        return 'bg-primary/20 text-primary border-primary/30';
      default:
        return 'bg-foreground-muted/20 text-foreground-muted border-foreground-muted/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      default:
        return Bell;
    }
  };

  const getConditionText = (condition: string, threshold: number, threshold2?: number) => {
    switch (condition) {
      case 'gt':
        return `> ${threshold}`;
      case 'lt':
        return `< ${threshold}`;
      case 'eq':
        return `= ${threshold}`;
      case 'between':
        return `${threshold} - ${threshold2}`;
      default:
        return threshold.toString();
    }
  };

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const getCategoryById = (id: string) => categories.find(c => c.id === id);
  const getParameterName = (categoryId: string, parameterId: string) => {
    const category = getCategoryById(categoryId);
    return category?.parameters.find(p => p.id === parameterId)?.name || parameterId;
  };
  const getParameterUnit = (categoryId: string, parameterId: string) => {
    const category = getCategoryById(categoryId);
    return category?.parameters.find(p => p.id === parameterId)?.unit || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuracao de Alarmes</h1>
          <p className="text-foreground-muted mt-1">
            Defina thresholds e regras de notificacao
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            selectedCategory === null
              ? 'bg-primary text-white'
              : 'bg-surface border border-border text-foreground-muted hover:text-foreground'
          )}
        >
          Todos
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedCategory === category.id
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-foreground-muted hover:text-foreground'
            )}
          >
            <category.icon className="w-4 h-4" />
            {category.name}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Total de Regras</span>
            <Bell className="w-5 h-5 text-foreground-muted" />
          </div>
          <div className="text-2xl font-bold text-foreground">{rules.length}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Regras Ativas</span>
            <CheckCircle className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-success-500">
            {rules.filter(r => r.enabled).length}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Alarmes Criticos</span>
            <AlertCircle className="w-5 h-5 text-danger-500" />
          </div>
          <div className="text-2xl font-bold text-danger-500">
            {rules.filter(r => r.severity === 'critical').length}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Alarmes Warning</span>
            <AlertTriangle className="w-5 h-5 text-warning-500" />
          </div>
          <div className="text-2xl font-bold text-warning-500">
            {rules.filter(r => r.severity === 'warning').length}
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-hover">
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Nome</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Categoria</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Parametro</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Condicao</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Severidade</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Delay</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Canais</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => {
                const category = getCategoryById(rule.category);
                const SeverityIcon = getSeverityIcon(rule.severity);

                return (
                  <tr key={rule.id} className="border-b border-border hover:bg-surface-hover">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={cn(
                          'relative w-10 h-5 rounded-full transition-colors',
                          rule.enabled ? 'bg-success-500' : 'bg-foreground-muted/30'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                            rule.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('font-medium', rule.enabled ? 'text-foreground' : 'text-foreground-muted')}>
                        {rule.name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {category && <category.icon className={cn('w-4 h-4', category.color)} />}
                        <span className="text-foreground-muted">{category?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground-muted">
                      {getParameterName(rule.category, rule.parameter)}
                    </td>
                    <td className="py-3 px-4">
                      <code className="px-2 py-1 bg-surface-hover rounded text-sm text-foreground">
                        {getConditionText(rule.condition, rule.threshold, rule.threshold2)} {getParameterUnit(rule.category, rule.parameter)}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
                        getSeverityColor(rule.severity)
                      )}>
                        <SeverityIcon className="w-3 h-3" />
                        {rule.severity === 'critical' ? 'Critico' : rule.severity === 'warning' ? 'Aviso' : 'Info'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground-muted">
                      {rule.delay > 0 ? `${rule.delay}s` : 'Imediato'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {rule.channels.includes('email') && (
                          <Mail className="w-4 h-4 text-foreground-muted" title="Email" />
                        )}
                        {rule.channels.includes('sms') && (
                          <MessageSquare className="w-4 h-4 text-foreground-muted" title="SMS" />
                        )}
                        {rule.channels.includes('push') && (
                          <Bell className="w-4 h-4 text-foreground-muted" title="Push" />
                        )}
                        {rule.channels.includes('webhook') && (
                          <Webhook className="w-4 h-4 text-foreground-muted" title="Webhook" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingRule(rule.id)}
                          className="p-1.5 hover:bg-surface-hover rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-foreground-muted" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-1.5 hover:bg-danger-500/10 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-danger-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Threshold Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Presets Recomendados</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div>
                <p className="font-medium text-foreground">Conservador</p>
                <p className="text-sm text-foreground-muted">Thresholds mais restritos, mais alertas</p>
              </div>
              <button className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                Aplicar
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div>
                <p className="font-medium text-foreground">Balanceado</p>
                <p className="text-sm text-foreground-muted">Configuracao padrao recomendada</p>
              </div>
              <button className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                Aplicar
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div>
                <p className="font-medium text-foreground">Agressivo</p>
                <p className="text-sm text-foreground-muted">Thresholds mais flexiveis, menos alertas</p>
              </div>
              <button className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                Aplicar
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Configuracao de Canais</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <p className="text-sm text-foreground-muted">admin@lifo4.com.br</p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">SMS</p>
                  <p className="text-sm text-foreground-muted">+55 86 9xxxx-xxxx</p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">Push Notification</p>
                  <p className="text-sm text-foreground-muted">App mobile configurado</p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Webhook className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">Webhook</p>
                  <p className="text-sm text-foreground-muted">https://api.example.com/alerts</p>
                </div>
              </div>
              <button className="px-3 py-1 text-sm border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors">
                Configurar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Escalation Policy */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Politica de Escalacao</h3>
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          <div className="flex-shrink-0 text-center p-4 bg-primary/10 rounded-xl border-2 border-primary/30">
            <Bell className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="font-medium text-foreground">Nivel 1</p>
            <p className="text-sm text-foreground-muted">Notificacao</p>
            <p className="text-xs text-primary mt-1">Imediato</p>
          </div>
          <div className="flex-shrink-0 text-foreground-muted">→</div>
          <div className="flex-shrink-0 text-center p-4 bg-warning-500/10 rounded-xl border-2 border-warning-500/30">
            <Mail className="w-8 h-8 text-warning-500 mx-auto mb-2" />
            <p className="font-medium text-foreground">Nivel 2</p>
            <p className="text-sm text-foreground-muted">Email Supervisor</p>
            <p className="text-xs text-warning-500 mt-1">Apos 5 min</p>
          </div>
          <div className="flex-shrink-0 text-foreground-muted">→</div>
          <div className="flex-shrink-0 text-center p-4 bg-danger-500/10 rounded-xl border-2 border-danger-500/30">
            <MessageSquare className="w-8 h-8 text-danger-500 mx-auto mb-2" />
            <p className="font-medium text-foreground">Nivel 3</p>
            <p className="text-sm text-foreground-muted">SMS Gerente</p>
            <p className="text-xs text-danger-500 mt-1">Apos 15 min</p>
          </div>
          <div className="flex-shrink-0 text-foreground-muted">→</div>
          <div className="flex-shrink-0 text-center p-4 bg-danger-500/20 rounded-xl border-2 border-danger-500/50">
            <AlertCircle className="w-8 h-8 text-danger-500 mx-auto mb-2" />
            <p className="font-medium text-foreground">Nivel 4</p>
            <p className="text-sm text-foreground-muted">Ligacao Emergencia</p>
            <p className="text-xs text-danger-500 mt-1">Apos 30 min</p>
          </div>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Horario de Silencio</h3>
            <p className="text-sm text-foreground-muted">Suprimir notificacoes nao-criticas</p>
          </div>
          <button
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors bg-success-500'
            )}
          >
            <span className="absolute top-0.5 translate-x-5 w-4 h-4 bg-white rounded-full transition-transform" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-surface-hover rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <VolumeX className="w-5 h-5 text-foreground-muted" />
              <span className="font-medium text-foreground">Periodo de Silencio</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs text-foreground-muted">Inicio</label>
                <input
                  type="time"
                  defaultValue="22:00"
                  className="block w-full mt-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Fim</label>
                <input
                  type="time"
                  defaultValue="07:00"
                  className="block w-full mt-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
                />
              </div>
            </div>
          </div>
          <div className="p-4 bg-surface-hover rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-5 h-5 text-danger-500" />
              <span className="font-medium text-foreground">Excecoes (Sempre Notificar)</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-1 bg-danger-500/20 text-danger-500 rounded text-sm">
                Alarmes Criticos
              </span>
              <span className="px-2 py-1 bg-danger-500/20 text-danger-500 rounded text-sm">
                Emergencias
              </span>
              <span className="px-2 py-1 bg-danger-500/20 text-danger-500 rounded text-sm">
                Perda de Comunicacao
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
