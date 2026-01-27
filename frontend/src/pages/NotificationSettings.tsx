/**
 * Notification Settings Page
 * Configure how users receive alerts and notifications
 */

import { useState } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Save,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Volume2,
  VolumeX,
  Clock,
  Shield,
  Zap,
  Thermometer,
  Battery,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationChannel {
  id: string;
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  config: Record<string, string>;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    webhook: boolean;
  };
  enabled: boolean;
}

export default function NotificationSettings() {
  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      id: 'email',
      name: 'Email',
      icon: Mail,
      enabled: true,
      config: { address: 'admin@lifo4.com.br' },
    },
    {
      id: 'sms',
      name: 'SMS',
      icon: Smartphone,
      enabled: false,
      config: { phone: '' },
    },
    {
      id: 'push',
      name: 'Push',
      icon: Bell,
      enabled: true,
      config: {},
    },
    {
      id: 'webhook',
      name: 'Webhook',
      icon: MessageSquare,
      enabled: false,
      config: { url: '' },
    },
  ]);

  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      id: 'temp_critical',
      name: 'Temperatura Critica',
      description: 'Temperatura acima de 45°C ou abaixo de 0°C',
      icon: Thermometer,
      severity: 'critical',
      channels: { email: true, sms: true, push: true, webhook: true },
      enabled: true,
    },
    {
      id: 'soc_low',
      name: 'SOC Muito Baixo',
      description: 'Estado de carga abaixo de 10%',
      icon: Battery,
      severity: 'critical',
      channels: { email: true, sms: true, push: true, webhook: false },
      enabled: true,
    },
    {
      id: 'overcurrent',
      name: 'Sobrecorrente',
      description: 'Corrente acima do limite de seguranca',
      icon: Zap,
      severity: 'critical',
      channels: { email: true, sms: true, push: true, webhook: true },
      enabled: true,
    },
    {
      id: 'voltage_imbalance',
      name: 'Desbalanceamento de Tensao',
      description: 'Delta de tensao entre celulas acima de 100mV',
      icon: Activity,
      severity: 'high',
      channels: { email: true, sms: false, push: true, webhook: false },
      enabled: true,
    },
    {
      id: 'system_offline',
      name: 'Sistema Offline',
      description: 'Perda de comunicacao com o BMS',
      icon: XCircle,
      severity: 'high',
      channels: { email: true, sms: true, push: true, webhook: true },
      enabled: true,
    },
    {
      id: 'soh_degradation',
      name: 'Degradacao de SOH',
      description: 'Estado de saude abaixo de 80%',
      icon: Shield,
      severity: 'medium',
      channels: { email: true, sms: false, push: false, webhook: false },
      enabled: true,
    },
    {
      id: 'scheduled_maintenance',
      name: 'Manutencao Programada',
      description: 'Lembrete de manutencao preventiva',
      icon: Clock,
      severity: 'low',
      channels: { email: true, sms: false, push: true, webhook: false },
      enabled: true,
    },
  ]);

  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: '22:00',
    end: '07:00',
    allowCritical: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleChannel = (channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, enabled: !ch.enabled } : ch
      )
    );
  };

  const toggleAlertRule = (ruleId: string) => {
    setAlertRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const toggleAlertChannel = (
    ruleId: string,
    channel: 'email' | 'sms' | 'push' | 'webhook'
  ) => {
    setAlertRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              channels: { ...rule.channels, [channel]: !rule.channels[channel] },
            }
          : rule
      )
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-danger-500 bg-danger-500/10';
      case 'high':
        return 'text-warning-500 bg-warning-500/10';
      case 'medium':
        return 'text-blue-400 bg-blue-500/10';
      case 'low':
        return 'text-foreground-muted bg-surface-hover';
      default:
        return 'text-foreground-muted bg-surface-hover';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Configuracoes de Notificacao
          </h1>
          <p className="text-foreground-muted text-sm">
            Configure como voce deseja receber alertas e notificacoes
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
            saveSuccess
              ? 'bg-success-500 text-white'
              : 'bg-primary text-white hover:bg-primary-600'
          )}
        >
          {saveSuccess ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Salvo!
            </>
          ) : isSaving ? (
            'Salvando...'
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar
            </>
          )}
        </button>
      </div>

      {/* Notification Channels */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Canais de Notificacao</h2>
          <p className="text-sm text-foreground-muted">
            Configure os canais pelos quais voce deseja receber notificacoes
          </p>
        </div>
        <div className="divide-y divide-border">
          {channels.map((channel) => (
            <div key={channel.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      channel.enabled
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-hover text-foreground-muted'
                    )}
                  >
                    <channel.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{channel.name}</p>
                    {channel.id === 'email' && channel.config.address && (
                      <p className="text-sm text-foreground-muted">
                        {channel.config.address}
                      </p>
                    )}
                    {channel.id === 'sms' && (
                      <input
                        type="tel"
                        placeholder="+55 (00) 00000-0000"
                        value={channel.config.phone || ''}
                        onChange={(e) =>
                          setChannels((prev) =>
                            prev.map((ch) =>
                              ch.id === 'sms'
                                ? { ...ch, config: { ...ch.config, phone: e.target.value } }
                                : ch
                            )
                          )
                        }
                        className="mt-1 px-3 py-1 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    )}
                    {channel.id === 'webhook' && (
                      <input
                        type="url"
                        placeholder="https://seu-webhook.com/endpoint"
                        value={channel.config.url || ''}
                        onChange={(e) =>
                          setChannels((prev) =>
                            prev.map((ch) =>
                              ch.id === 'webhook'
                                ? { ...ch, config: { ...ch.config, url: e.target.value } }
                                : ch
                            )
                          )
                        }
                        className="mt-1 w-full max-w-md px-3 py-1 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel(channel.id)}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    channel.enabled ? 'bg-primary' : 'bg-surface-hover'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      channel.enabled ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                quietHours.enabled
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'bg-surface-hover text-foreground-muted'
              )}
            >
              {quietHours.enabled ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Horario de Silencio</p>
              <p className="text-sm text-foreground-muted">
                Silenciar notificacoes durante determinado periodo
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              setQuietHours((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              quietHours.enabled ? 'bg-primary' : 'bg-surface-hover'
            )}
          >
            <span
              className={cn(
                'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                quietHours.enabled ? 'translate-x-7' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {quietHours.enabled && (
          <div className="pl-12 space-y-4 animate-fade-in">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm text-foreground-muted block mb-1">
                  Inicio
                </label>
                <input
                  type="time"
                  value={quietHours.start}
                  onChange={(e) =>
                    setQuietHours((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-sm text-foreground-muted block mb-1">
                  Fim
                </label>
                <input
                  type="time"
                  value={quietHours.end}
                  onChange={(e) =>
                    setQuietHours((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={quietHours.allowCritical}
                onChange={(e) =>
                  setQuietHours((prev) => ({
                    ...prev,
                    allowCritical: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
              />
              <span className="text-sm text-foreground">
                Permitir alertas criticos durante horario de silencio
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Alert Rules */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Regras de Alerta</h2>
          <p className="text-sm text-foreground-muted">
            Configure quais alertas voce deseja receber e por qual canal
          </p>
        </div>
        <div className="divide-y divide-border">
          {alertRules.map((rule) => (
            <div key={rule.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      rule.enabled
                        ? getSeverityColor(rule.severity)
                        : 'bg-surface-hover text-foreground-muted'
                    )}
                  >
                    <rule.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{rule.name}</p>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-2xs font-medium rounded-full uppercase',
                          getSeverityColor(rule.severity)
                        )}
                      >
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      {rule.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleAlertRule(rule.id)}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors shrink-0',
                    rule.enabled ? 'bg-primary' : 'bg-surface-hover'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      rule.enabled ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {rule.enabled && (
                <div className="pl-12 flex flex-wrap gap-2 animate-fade-in">
                  {(['email', 'sms', 'push', 'webhook'] as const).map((channel) => {
                    const channelConfig = channels.find((c) => c.id === channel);
                    const isChannelEnabled = channelConfig?.enabled;

                    return (
                      <button
                        key={channel}
                        onClick={() => toggleAlertChannel(rule.id, channel)}
                        disabled={!isChannelEnabled}
                        className={cn(
                          'px-3 py-1 text-sm rounded-lg transition-colors flex items-center gap-1',
                          !isChannelEnabled
                            ? 'bg-surface-hover text-foreground-subtle cursor-not-allowed'
                            : rule.channels[channel]
                            ? 'bg-primary/20 text-primary'
                            : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                        )}
                      >
                        {channel === 'email' && <Mail className="w-3 h-3" />}
                        {channel === 'sms' && <Smartphone className="w-3 h-3" />}
                        {channel === 'push' && <Bell className="w-3 h-3" />}
                        {channel === 'webhook' && <MessageSquare className="w-3 h-3" />}
                        {channel.toUpperCase()}
                        {rule.channels[channel] && isChannelEnabled && (
                          <CheckCircle className="w-3 h-3" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test Notification */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Testar Notificacoes</h3>
            <p className="text-sm text-foreground-muted">
              Envie uma notificacao de teste para verificar sua configuracao
            </p>
          </div>
          <button className="px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg transition-colors">
            Enviar Teste
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium">Dica</p>
          <p className="text-foreground-muted">
            Alertas criticos sao sempre enviados independente das configuracoes de
            horario de silencio para garantir a seguranca do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
