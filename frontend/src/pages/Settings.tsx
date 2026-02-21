import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
  Loader2,
  Mail,
  MessageSquare,
  Smartphone,
  Moon,
  Sun,
  Monitor,
  Volume2,
  BellRing,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import { User } from '@/types';

type TabId = 'notifications' | 'security' | 'appearance' | 'language';

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('notifications');
  const [isSaving, setIsSaving] = useState(false);

  // Local state for settings
  const [notifications, setNotifications] = useState(user?.notificationPreferences || {
    email: { enabled: true, criticalOnly: false },
    whatsapp: { enabled: false, criticalOnly: true },
    push: { enabled: true },
    telegram: { enabled: false },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
  });

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(user?.theme || 'dark');
  const [language, setLanguage] = useState<'pt-BR' | 'en' | 'es'>(user?.language || 'pt-BR');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateUser({
        notificationPreferences: notifications,
        theme,
        language,
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'notifications' as const, label: 'Notificações', icon: Bell },
    { id: 'security' as const, label: 'Segurança', icon: Shield },
    { id: 'appearance' as const, label: 'Aparência', icon: Palette },
    { id: 'language' as const, label: 'Idioma', icon: Globe },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-foreground-muted text-sm">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <nav className="lg:w-64 bg-surface rounded-xl border border-border p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 bg-surface rounded-xl border border-border p-6">
          {activeTab === 'notifications' && (
            <NotificationsTab
              notifications={notifications}
              setNotifications={setNotifications}
            />
          )}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'appearance' && (
            <AppearanceTab theme={theme} setTheme={setTheme} />
          )}
          {activeTab === 'language' && (
            <LanguageTab language={language} setLanguage={setLanguage} />
          )}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-border flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Notifications Tab
interface NotificationsTabProps {
  notifications: User['notificationPreferences'];
  setNotifications: (n: User['notificationPreferences']) => void;
}

function NotificationsTab({ notifications, setNotifications }: NotificationsTabProps) {
  const { soundEnabled, desktopNotificationsEnabled, toggleSound, toggleDesktopNotifications } = useNotificationStore();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Notificações</h2>
          <p className="text-sm text-foreground-muted">
            Configure como você deseja receber alertas e notificações
          </p>
        </div>
        <Link
          to="/notifications"
          className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
        >
          Regras de Alerta
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* In-App Sound */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Volume2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Som de Notificacao</h3>
              <p className="text-sm text-foreground-muted">Tocar som ao receber alertas criticos</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={soundEnabled}
            onChange={toggleSound}
          />
        </div>
      </div>

      {/* Desktop Notifications */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BellRing className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Notificacoes Desktop</h3>
              <p className="text-sm text-foreground-muted">Exibir notificacoes do navegador</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={desktopNotificationsEnabled}
            onChange={toggleDesktopNotifications}
          />
        </div>
      </div>

      {/* Email */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Email</h3>
              <p className="text-sm text-foreground-muted">Receba alertas por email</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={notifications.email.enabled}
            onChange={(enabled) =>
              setNotifications({
                ...notifications,
                email: { ...notifications.email, enabled },
              })
            }
          />
        </div>
        {notifications.email.enabled && (
          <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer ml-12">
            <input
              type="checkbox"
              checked={notifications.email.criticalOnly}
              onChange={(e) =>
                setNotifications({
                  ...notifications,
                  email: { ...notifications.email, criticalOnly: e.target.checked },
                })
              }
              className="rounded border-border bg-background text-primary focus:ring-primary"
            />
            Apenas alertas críticos
          </label>
        )}
      </div>

      {/* WhatsApp */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">WhatsApp</h3>
              <p className="text-sm text-foreground-muted">Receba alertas no WhatsApp</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={notifications.whatsapp.enabled}
            onChange={(enabled) =>
              setNotifications({
                ...notifications,
                whatsapp: { ...notifications.whatsapp, enabled },
              })
            }
          />
        </div>
        {notifications.whatsapp.enabled && (
          <div className="ml-12 space-y-3">
            <input
              type="tel"
              placeholder="Número do WhatsApp"
              value={notifications.whatsapp.phone || ''}
              onChange={(e) =>
                setNotifications({
                  ...notifications,
                  whatsapp: { ...notifications.whatsapp, phone: e.target.value },
                })
              }
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.whatsapp.criticalOnly}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    whatsapp: { ...notifications.whatsapp, criticalOnly: e.target.checked },
                  })
                }
                className="rounded border-border bg-background text-primary focus:ring-primary"
              />
              Apenas alertas críticos
            </label>
          </div>
        )}
      </div>

      {/* Push */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Smartphone className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Push Notifications</h3>
              <p className="text-sm text-foreground-muted">Notificações do navegador</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={notifications.push.enabled}
            onChange={(enabled) =>
              setNotifications({
                ...notifications,
                push: { enabled },
              })
            }
          />
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-500/10 rounded-lg">
              <Moon className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Horário de Silêncio</h3>
              <p className="text-sm text-foreground-muted">Pausar notificações em horários específicos</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={notifications.quietHours.enabled}
            onChange={(enabled) =>
              setNotifications({
                ...notifications,
                quietHours: { ...notifications.quietHours, enabled },
              })
            }
          />
        </div>
        {notifications.quietHours.enabled && (
          <div className="ml-12 flex items-center gap-4">
            <div>
              <label className="text-xs text-foreground-muted">Início</label>
              <input
                type="time"
                value={notifications.quietHours.start}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    quietHours: { ...notifications.quietHours, start: e.target.value },
                  })
                }
                className="block mt-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Fim</label>
              <input
                type="time"
                value={notifications.quietHours.end}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    quietHours: { ...notifications.quietHours, end: e.target.value },
                  })
                }
                className="block mt-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Security Tab
function SecurityTab() {
  const { user, updateUser } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isToggling2FA, setIsToggling2FA] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [twoFAMessage, setTwoFAMessage] = useState('');

  const handleToggle2FA = async () => {
    setIsToggling2FA(true);
    setTwoFAMessage('');
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const newValue = !user?.twoFactorEnabled;
      updateUser({ twoFactorEnabled: newValue });
      setTwoFAMessage(newValue ? '2FA habilitado com sucesso!' : '2FA desabilitado com sucesso!');
    } catch (error) {
      setTwoFAMessage('Erro ao alterar configuracao de 2FA');
    } finally {
      setIsToggling2FA(false);
      setTimeout(() => setTwoFAMessage(''), 3000);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!currentPassword) {
      setPasswordError('Digite a senha atual');
      return;
    }
    if (!newPassword) {
      setPasswordError('Digite a nova senha');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas nao coincidem');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setPasswordSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError('Erro ao alterar senha. Verifique a senha atual.');
    } finally {
      setIsChangingPassword(false);
      setTimeout(() => setPasswordSuccess(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Seguranca</h2>
        <p className="text-sm text-foreground-muted">
          Gerencie a seguranca da sua conta
        </p>
      </div>

      {/* 2FA */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Autenticacao em duas etapas</h3>
              <p className="text-sm text-foreground-muted">
                {user?.twoFactorEnabled ? 'Habilitada' : 'Desabilitada'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle2FA}
            disabled={isToggling2FA}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
              user?.twoFactorEnabled
                ? 'bg-danger-500/10 text-danger-500 hover:bg-danger-500/20'
                : 'bg-primary hover:bg-primary-600 text-white'
            )}
          >
            {isToggling2FA ? 'Processando...' : user?.twoFactorEnabled ? 'Desabilitar' : 'Habilitar'}
          </button>
        </div>
        {twoFAMessage && (
          <p className={cn('text-sm mt-2', twoFAMessage.includes('sucesso') ? 'text-success-500' : 'text-danger-500')}>
            {twoFAMessage}
          </p>
        )}
      </div>

      {/* Change Password */}
      <div className="p-4 bg-background rounded-lg border border-border">
        <h3 className="font-medium text-foreground mb-4">Alterar Senha</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-foreground-muted mb-1">Senha Atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-muted mb-1">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-muted mb-1">Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {passwordError && <p className="text-sm text-danger-500">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-success-500">{passwordSuccess}</p>}
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Appearance Tab
interface AppearanceTabProps {
  theme: 'dark' | 'light' | 'system';
  setTheme: (t: 'dark' | 'light' | 'system') => void;
}

function AppearanceTab({ theme, setTheme }: AppearanceTabProps) {
  const themes = [
    { id: 'dark' as const, label: 'Escuro', icon: Moon },
    { id: 'light' as const, label: 'Claro', icon: Sun },
    { id: 'system' as const, label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Aparência</h2>
        <p className="text-sm text-foreground-muted">
          Personalize a aparência do sistema
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              'p-4 rounded-xl border-2 transition-all text-center',
              theme === t.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            )}
          >
            <t.icon className={cn('w-8 h-8 mx-auto mb-2', theme === t.id ? 'text-primary' : 'text-foreground-muted')} />
            <span className={cn('text-sm font-medium', theme === t.id ? 'text-primary' : 'text-foreground')}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Language Tab
interface LanguageTabProps {
  language: 'pt-BR' | 'en' | 'es';
  setLanguage: (l: 'pt-BR' | 'en' | 'es') => void;
}

function LanguageTab({ language, setLanguage }: LanguageTabProps) {
  const languages = [
    { id: 'pt-BR' as const, label: 'Português (Brasil)', flag: '🇧🇷' },
    { id: 'en' as const, label: 'English', flag: '🇺🇸' },
    { id: 'es' as const, label: 'Español', flag: '🇪🇸' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Idioma</h2>
        <p className="text-sm text-foreground-muted">
          Selecione o idioma da interface
        </p>
      </div>

      <div className="space-y-2">
        {languages.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setLanguage(lang.id)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
              language === lang.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            )}
          >
            <span className="text-2xl">{lang.flag}</span>
            <span className={cn('font-medium', language === lang.id ? 'text-primary' : 'text-foreground')}>
              {lang.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Toggle Switch
function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-12 h-6 rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-surface-active'
      )}
    >
      <span
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-7' : 'translate-x-1'
        )}
      />
    </button>
  );
}
