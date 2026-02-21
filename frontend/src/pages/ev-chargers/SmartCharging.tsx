import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Zap,
  Clock,
  Calendar,
  Settings,
  Trash2,
  Edit,
  Power,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Sun,
  Moon,
  DollarSign,
  Battery,
  BarChart3,
  Save,
  X,
} from 'lucide-react';
import {
  cn,
  formatDate,
  formatNumber,
  formatCurrency,
} from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

export type ProfileType = 'TxDefaultProfile' | 'TxProfile' | 'ChargePointMaxProfile';
export type ChargingRateUnit = 'W' | 'A';
export type RecurrencyKind = 'Daily' | 'Weekly';
export type ProfilePurpose = 'ChargePointMaxProfile' | 'TxDefaultProfile' | 'TxProfile';

export interface ChargingSchedulePeriod {
  startPeriod: number; // seconds from start
  limit: number; // in W or A
  numberPhases?: number;
}

export interface ChargingProfile {
  id: string;
  chargerId: string;
  stackLevel: number;
  chargingProfilePurpose: ProfilePurpose;
  chargingProfileKind: 'Absolute' | 'Recurring' | 'Relative';
  recurrencyKind?: RecurrencyKind;
  validFrom?: string;
  validTo?: string;
  chargingSchedule: {
    duration?: number;
    startSchedule?: string;
    chargingRateUnit: ChargingRateUnit;
    chargingSchedulePeriod: ChargingSchedulePeriod[];
    minChargingRate?: number;
  };
  transactionId?: string;
  connectorId?: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartChargingSettings {
  enabled: boolean;
  maxSitePowerKw: number;
  priorityMode: 'first_come' | 'equal_share' | 'priority_based';
  solarIntegration: boolean;
  gridLimitKw?: number;
  peakShavingEnabled: boolean;
  peakShavingThresholdKw?: number;
  dynamicPricing: boolean;
}

export interface LoadForecast {
  hour: number;
  demandKw: number;
  solarKw: number;
  evLoadKw: number;
  gridImportKw: number;
  tariffRate: number;
}

// ============================================
// API FUNCTIONS
// ============================================

const smartChargingApi = {
  getProfiles: (chargerId?: string) =>
    api.get<{ success: boolean; data: ChargingProfile[] }>('/ev-chargers/smart-charging/profiles', {
      params: { chargerId },
    }),

  getProfile: (profileId: string) =>
    api.get<{ success: boolean; data: ChargingProfile }>(`/ev-chargers/smart-charging/profiles/${profileId}`),

  createProfile: (profile: Partial<ChargingProfile>) =>
    api.post<{ success: boolean; data: ChargingProfile }>('/ev-chargers/smart-charging/profiles', profile),

  updateProfile: (profileId: string, profile: Partial<ChargingProfile>) =>
    api.patch<{ success: boolean; data: ChargingProfile }>(`/ev-chargers/smart-charging/profiles/${profileId}`, profile),

  deleteProfile: (profileId: string) =>
    api.delete(`/ev-chargers/smart-charging/profiles/${profileId}`),

  setProfileOnCharger: (chargerId: string, profileId: string, connectorId?: number) =>
    api.post(`/ev-chargers/${chargerId}/set-charging-profile`, { profileId, connectorId }),

  clearProfiles: (chargerId: string, connectorId?: number) =>
    api.post(`/ev-chargers/${chargerId}/clear-charging-profiles`, { connectorId }),

  getSettings: () =>
    api.get<{ success: boolean; data: SmartChargingSettings }>('/ev-chargers/smart-charging/settings'),

  updateSettings: (settings: Partial<SmartChargingSettings>) =>
    api.patch<{ success: boolean; data: SmartChargingSettings }>('/ev-chargers/smart-charging/settings', settings),

  getLoadForecast: () =>
    api.get<{ success: boolean; data: LoadForecast[] }>('/ev-chargers/smart-charging/forecast'),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SmartCharging() {
  const { chargerId } = useParams<{ chargerId: string }>();

  const [profiles, setProfiles] = useState<ChargingProfile[]>([]);
  const [settings, setSettings] = useState<SmartChargingSettings | null>(null);
  const [forecast, setForecast] = useState<LoadForecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ChargingProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'profiles' | 'settings' | 'forecast'>('profiles');

  // Fetch data
  const fetchData = async () => {
    try {
      setIsLoading(true);

      const [profilesRes, settingsRes, forecastRes] = await Promise.all([
        smartChargingApi.getProfiles(chargerId).catch(() => null),
        smartChargingApi.getSettings().catch(() => null),
        smartChargingApi.getLoadForecast().catch(() => null),
      ]);

      setProfiles(profilesRes?.data.data || getMockProfiles(chargerId));
      setSettings(settingsRes?.data.data || getMockSettings());
      setForecast(forecastRes?.data.data || getMockForecast());
    } catch (error) {
      console.error('Failed to fetch smart charging data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chargerId]);

  // Handlers
  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Tem certeza que deseja excluir este perfil?')) return;

    try {
      await smartChargingApi.deleteProfile(profileId);
      setProfiles(profiles.filter((p) => p.id !== profileId));
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const handleToggleProfile = async (profile: ChargingProfile) => {
    try {
      const updated = { ...profile, isActive: !profile.isActive };
      await smartChargingApi.updateProfile(profile.id, { isActive: updated.isActive });
      setProfiles(profiles.map((p) => (p.id === profile.id ? updated : p)));
    } catch (error) {
      console.error('Failed to toggle profile:', error);
    }
  };

  const handleSaveSettings = async (newSettings: SmartChargingSettings) => {
    try {
      await smartChargingApi.updateSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {chargerId && (
            <Link
              to={`/ev-chargers/${chargerId}`}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-muted" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Smart Charging</h1>
            <p className="text-foreground-muted text-sm">
              {chargerId
                ? 'Gerenciar perfis de carregamento inteligente'
                : 'Configuracoes globais de carregamento inteligente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Perfil
          </button>
          <button
            onClick={fetchData}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <TabButton
          active={activeTab === 'profiles'}
          onClick={() => setActiveTab('profiles')}
          icon={Zap}
          label="Perfis de Carregamento"
        />
        <TabButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={Settings}
          label="Configuracoes"
        />
        <TabButton
          active={activeTab === 'forecast'}
          onClick={() => setActiveTab('forecast')}
          icon={BarChart3}
          label="Previsao de Carga"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {activeTab === 'profiles' && (
            <ProfilesTab
              profiles={profiles}
              onEdit={setEditingProfile}
              onDelete={handleDeleteProfile}
              onToggle={handleToggleProfile}
            />
          )}

          {activeTab === 'settings' && settings && (
            <SettingsTab settings={settings} onSave={handleSaveSettings} />
          )}

          {activeTab === 'forecast' && <ForecastTab forecast={forecast} />}
        </>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingProfile) && (
        <ProfileModal
          profile={editingProfile}
          chargerId={chargerId}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProfile(null);
          }}
          onSave={(profile) => {
            if (editingProfile) {
              setProfiles(profiles.map((p) => (p.id === profile.id ? profile : p)));
            } else {
              setProfiles([profile, ...profiles]);
            }
            setShowCreateModal(false);
            setEditingProfile(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// TAB BUTTON
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 -mb-px transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-foreground-muted hover:text-foreground'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ============================================
// PROFILES TAB
// ============================================

interface ProfilesTabProps {
  profiles: ChargingProfile[];
  onEdit: (profile: ChargingProfile) => void;
  onDelete: (profileId: string) => void;
  onToggle: (profile: ChargingProfile) => void;
}

function ProfilesTab({ profiles, onEdit, onDelete, onToggle }: ProfilesTabProps) {
  if (profiles.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-12 text-center">
        <Zap className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">Nenhum perfil encontrado</h3>
        <p className="text-foreground-muted">
          Crie perfis de carregamento inteligente para otimizar o uso de energia.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {profiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          onEdit={() => onEdit(profile)}
          onDelete={() => onDelete(profile.id)}
          onToggle={() => onToggle(profile)}
        />
      ))}
    </div>
  );
}

// ============================================
// PROFILE CARD
// ============================================

interface ProfileCardProps {
  profile: ChargingProfile;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function ProfileCard({ profile, onEdit, onDelete, onToggle }: ProfileCardProps) {
  const purposeLabels: Record<ProfilePurpose, string> = {
    ChargePointMaxProfile: 'Limite Max. do Ponto',
    TxDefaultProfile: 'Perfil Padrao',
    TxProfile: 'Perfil de Transacao',
  };

  const kindIcons: Record<string, React.ElementType> = {
    Absolute: Calendar,
    Recurring: Clock,
    Relative: TrendingUp,
  };

  const KindIcon = kindIcons[profile.chargingProfileKind] || Calendar;

  const maxLimit = Math.max(...profile.chargingSchedule.chargingSchedulePeriod.map((p) => p.limit));

  return (
    <div className={cn(
      'bg-surface rounded-xl border p-4 transition-all',
      profile.isActive ? 'border-primary/50' : 'border-border'
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            profile.isActive ? 'bg-primary/10' : 'bg-surface-hover'
          )}>
            <KindIcon className={cn('w-5 h-5', profile.isActive ? 'text-primary' : 'text-foreground-muted')} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{profile.name}</h3>
            <p className="text-sm text-foreground-muted">{purposeLabels[profile.chargingProfilePurpose]}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            profile.isActive
              ? 'bg-success-500/10 text-success-500 hover:bg-success-500/20'
              : 'bg-surface-hover text-foreground-muted hover:bg-surface-active'
          )}
        >
          {profile.isActive ? <CheckCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
        </button>
      </div>

      {profile.description && (
        <p className="text-sm text-foreground-muted mb-4">{profile.description}</p>
      )}

      {/* Schedule Summary */}
      <div className="bg-background rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-foreground-muted">Limite Maximo</span>
          <span className="text-sm font-medium text-foreground">
            {maxLimit} {profile.chargingSchedule.chargingRateUnit}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-foreground-muted">Periodos</span>
          <span className="text-sm font-medium text-foreground">
            {profile.chargingSchedule.chargingSchedulePeriod.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">Tipo</span>
          <span className="text-sm text-foreground">
            {profile.chargingProfileKind}
            {profile.recurrencyKind && ` (${profile.recurrencyKind})`}
          </span>
        </div>
      </div>

      {/* Schedule Visualization */}
      <div className="mb-4">
        <div className="flex items-end gap-0.5 h-12">
          {profile.chargingSchedule.chargingSchedulePeriod.map((period, index) => {
            const height = (period.limit / maxLimit) * 100;
            return (
              <div
                key={index}
                className="flex-1 bg-primary/60 rounded-t transition-all hover:bg-primary"
                style={{ height: `${height}%` }}
                title={`${period.limit}${profile.chargingSchedule.chargingRateUnit} @ ${period.startPeriod}s`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-2xs text-foreground-muted mt-1">
          <span>Inicio</span>
          <span>Fim</span>
        </div>
      </div>

      {/* Valid Period */}
      {(profile.validFrom || profile.validTo) && (
        <div className="text-xs text-foreground-muted mb-4">
          {profile.validFrom && <span>De: {formatDate(profile.validFrom, 'dd/MM/yyyy')}</span>}
          {profile.validFrom && profile.validTo && <span> - </span>}
          {profile.validTo && <span>Ate: {formatDate(profile.validTo, 'dd/MM/yyyy')}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-surface-hover hover:bg-surface-active text-foreground text-sm font-medium rounded-lg transition-colors"
        >
          <Edit className="w-4 h-4" />
          Editar
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 text-sm font-medium rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

interface SettingsTabProps {
  settings: SmartChargingSettings;
  onSave: (settings: SmartChargingSettings) => void;
}

function SettingsTab({ settings: initialSettings, onSave }: SettingsTabProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (key: keyof SmartChargingSettings, value: unknown) => {
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(settings);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Main Settings */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Configuracoes Gerais</h3>

        <div className="space-y-6">
          {/* Enable Smart Charging */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Smart Charging Habilitado</p>
              <p className="text-sm text-foreground-muted">Ativar gerenciamento inteligente de carga</p>
            </div>
            <ToggleSwitch
              enabled={settings.enabled}
              onChange={(v) => handleChange('enabled', v)}
            />
          </div>

          {/* Max Site Power */}
          <div>
            <label className="block font-medium text-foreground mb-2">
              Potencia Maxima do Site (kW)
            </label>
            <input
              type="number"
              value={settings.maxSitePowerKw}
              onChange={(e) => handleChange('maxSitePowerKw', Number(e.target.value))}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-sm text-foreground-muted mt-1">
              Limite maximo de potencia para todos os carregadores combinados
            </p>
          </div>

          {/* Priority Mode */}
          <div>
            <label className="block font-medium text-foreground mb-2">
              Modo de Prioridade
            </label>
            <select
              value={settings.priorityMode}
              onChange={(e) => handleChange('priorityMode', e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="first_come">Primeiro a Chegar</option>
              <option value="equal_share">Divisao Igual</option>
              <option value="priority_based">Baseado em Prioridade</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Integration */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Integracao com a Rede</h3>

        <div className="space-y-6">
          {/* Solar Integration */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Integracao Solar</p>
              <p className="text-sm text-foreground-muted">Priorizar carga quando ha excesso de geracao solar</p>
            </div>
            <ToggleSwitch
              enabled={settings.solarIntegration}
              onChange={(v) => handleChange('solarIntegration', v)}
            />
          </div>

          {/* Grid Limit */}
          <div>
            <label className="block font-medium text-foreground mb-2">
              Limite de Importacao da Rede (kW)
            </label>
            <input
              type="number"
              value={settings.gridLimitKw || ''}
              onChange={(e) => handleChange('gridLimitKw', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Sem limite"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Peak Shaving */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Peak Shaving</p>
              <p className="text-sm text-foreground-muted">Reduzir carga durante horarios de pico de demanda</p>
            </div>
            <ToggleSwitch
              enabled={settings.peakShavingEnabled}
              onChange={(v) => handleChange('peakShavingEnabled', v)}
            />
          </div>

          {settings.peakShavingEnabled && (
            <div>
              <label className="block font-medium text-foreground mb-2">
                Limite de Peak Shaving (kW)
              </label>
              <input
                type="number"
                value={settings.peakShavingThresholdKw || ''}
                onChange={(e) => handleChange('peakShavingThresholdKw', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Dynamic Pricing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Precificacao Dinamica</p>
              <p className="text-sm text-foreground-muted">Ajustar carga baseado no preco da energia</p>
            </div>
            <ToggleSwitch
              enabled={settings.dynamicPricing}
              onChange={(v) => handleChange('dynamicPricing', v)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Save className="w-5 h-5" />
            Salvar Alteracoes
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// FORECAST TAB
// ============================================

interface ForecastTabProps {
  forecast: LoadForecast[];
}

function ForecastTab({ forecast }: ForecastTabProps) {
  const maxDemand = Math.max(...forecast.map((f) => f.demandKw));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label="Pico de Demanda"
          value={`${maxDemand.toFixed(0)} kW`}
          color="warning"
        />
        <SummaryCard
          icon={Sun}
          label="Geracao Solar Esperada"
          value={`${forecast.reduce((s, f) => s + f.solarKw, 0).toFixed(0)} kWh`}
          color="success"
        />
        <SummaryCard
          icon={Battery}
          label="Carga EV Prevista"
          value={`${forecast.reduce((s, f) => s + f.evLoadKw, 0).toFixed(0)} kWh`}
          color="primary"
        />
        <SummaryCard
          icon={DollarSign}
          label="Custo Estimado"
          value={formatCurrency(forecast.reduce((s, f) => s + (f.gridImportKw * f.tariffRate), 0))}
        />
      </div>

      {/* Forecast Chart */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Previsao de Carga 24h</h3>

        <div className="relative">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-2xs text-foreground-muted">
            <span>{maxDemand.toFixed(0)} kW</span>
            <span>{(maxDemand / 2).toFixed(0)} kW</span>
            <span>0 kW</span>
          </div>

          {/* Chart */}
          <div className="ml-14">
            <div className="flex items-end gap-1 h-48 border-l border-b border-border pl-2 pb-2">
              {forecast.map((hour, index) => {
                const demandHeight = (hour.demandKw / maxDemand) * 100;
                const solarHeight = (hour.solarKw / maxDemand) * 100;
                const evHeight = (hour.evLoadKw / maxDemand) * 100;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center justify-end gap-0.5"
                    title={`${hour.hour}:00 - Demanda: ${hour.demandKw}kW, Solar: ${hour.solarKw}kW, EV: ${hour.evLoadKw}kW`}
                  >
                    <div className="w-full flex flex-col gap-0.5">
                      <div
                        className="w-full bg-warning-500/60 rounded-t"
                        style={{ height: `${(demandHeight / 100) * 180}px` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between text-2xs text-foreground-muted mt-2 pl-2">
              {forecast.filter((_, i) => i % 4 === 0).map((hour) => (
                <span key={hour.hour}>{hour.hour}:00</span>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-warning-500" />
            <span className="text-sm text-foreground-muted">Demanda Total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-success-500" />
            <span className="text-sm text-foreground-muted">Solar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-sm text-foreground-muted">EV</span>
          </div>
        </div>
      </div>

      {/* Hourly Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Detalhamento Horario</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-hover">
                <th className="text-left py-2 px-4 text-foreground-muted text-sm font-medium">Hora</th>
                <th className="text-left py-2 px-4 text-foreground-muted text-sm font-medium">Demanda</th>
                <th className="text-left py-2 px-4 text-foreground-muted text-sm font-medium">Solar</th>
                <th className="text-left py-2 px-4 text-foreground-muted text-sm font-medium">EV</th>
                <th className="text-left py-2 px-4 text-foreground-muted text-sm font-medium">Rede</th>
                <th className="text-left py-2 px-4 text-foreground-muted text-sm font-medium">Tarifa</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((hour) => (
                <tr key={hour.hour} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="py-2 px-4 text-foreground text-sm">{hour.hour}:00</td>
                  <td className="py-2 px-4 text-foreground text-sm">{hour.demandKw.toFixed(1)} kW</td>
                  <td className="py-2 px-4 text-success-500 text-sm">{hour.solarKw.toFixed(1)} kW</td>
                  <td className="py-2 px-4 text-primary text-sm">{hour.evLoadKw.toFixed(1)} kW</td>
                  <td className="py-2 px-4 text-foreground text-sm">{hour.gridImportKw.toFixed(1)} kW</td>
                  <td className="py-2 px-4 text-foreground text-sm">{formatCurrency(hour.tariffRate)}/kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PROFILE MODAL
// ============================================

interface ProfileModalProps {
  profile: ChargingProfile | null;
  chargerId?: string;
  onClose: () => void;
  onSave: (profile: ChargingProfile) => void;
}

function ProfileModal({ profile, chargerId, onClose, onSave }: ProfileModalProps) {
  const [formData, setFormData] = useState<Partial<ChargingProfile>>(
    profile || {
      name: '',
      description: '',
      chargerId: chargerId,
      stackLevel: 1,
      chargingProfilePurpose: 'TxDefaultProfile',
      chargingProfileKind: 'Recurring',
      recurrencyKind: 'Daily',
      chargingSchedule: {
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [
          { startPeriod: 0, limit: 11000 },
        ],
      },
      isActive: true,
    }
  );

  const [periods, setPeriods] = useState(
    profile?.chargingSchedule.chargingSchedulePeriod || [{ startPeriod: 0, limit: 11000 }]
  );

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        chargingSchedule: {
          ...formData.chargingSchedule,
          chargingSchedulePeriod: periods,
        },
      };

      if (profile) {
        const res = await smartChargingApi.updateProfile(profile.id, data);
        onSave(res.data.data || { ...profile, ...data } as ChargingProfile);
      } else {
        const res = await smartChargingApi.createProfile(data);
        onSave(res.data.data || { id: `profile-${Date.now()}`, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ChargingProfile);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      // Save locally anyway for demo
      const savedProfile = {
        id: profile?.id || `profile-${Date.now()}`,
        ...formData,
        chargingSchedule: {
          ...formData.chargingSchedule,
          chargingSchedulePeriod: periods,
        },
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ChargingProfile;
      onSave(savedProfile);
    }
  };

  const addPeriod = () => {
    const lastPeriod = periods[periods.length - 1];
    setPeriods([...periods, { startPeriod: lastPeriod.startPeriod + 3600, limit: lastPeriod.limit }]);
  };

  const removePeriod = (index: number) => {
    if (periods.length > 1) {
      setPeriods(periods.filter((_, i) => i !== index));
    }
  };

  const updatePeriod = (index: number, field: keyof ChargingSchedulePeriod, value: number) => {
    setPeriods(periods.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {profile ? 'Editar Perfil' : 'Novo Perfil de Carregamento'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg">
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Stack Level</label>
              <input
                type="number"
                value={formData.stackLevel || 1}
                onChange={(e) => setFormData({ ...formData, stackLevel: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descricao</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Profile Type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Proposito</label>
              <select
                value={formData.chargingProfilePurpose}
                onChange={(e) => setFormData({ ...formData, chargingProfilePurpose: e.target.value as ProfilePurpose })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="TxDefaultProfile">Perfil Padrao</option>
                <option value="TxProfile">Perfil de Transacao</option>
                <option value="ChargePointMaxProfile">Limite Max. do Ponto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
              <select
                value={formData.chargingProfileKind}
                onChange={(e) => setFormData({ ...formData, chargingProfileKind: e.target.value as 'Absolute' | 'Recurring' | 'Relative' })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Absolute">Absoluto</option>
                <option value="Recurring">Recorrente</option>
                <option value="Relative">Relativo</option>
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">Periodos de Carregamento</label>
              <button
                onClick={addPeriod}
                className="text-sm text-primary hover:text-primary-400 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar Periodo
              </button>
            </div>
            <div className="space-y-3">
              {periods.map((period, index) => (
                <div key={index} className="flex items-center gap-3 bg-background rounded-lg p-3">
                  <div className="flex-1">
                    <label className="block text-xs text-foreground-muted mb-1">Inicio (segundos)</label>
                    <input
                      type="number"
                      value={period.startPeriod}
                      onChange={(e) => updatePeriod(index, 'startPeriod', Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-surface border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-foreground-muted mb-1">Limite ({formData.chargingSchedule?.chargingRateUnit || 'W'})</label>
                    <input
                      type="number"
                      value={period.limit}
                      onChange={(e) => updatePeriod(index, 'limit', Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-surface border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {periods.length > 1 && (
                    <button
                      onClick={() => removePeriod(index)}
                      className="p-2 text-danger-500 hover:bg-danger-500/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rate Unit */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Unidade</label>
            <select
              value={formData.chargingSchedule?.chargingRateUnit || 'W'}
              onChange={(e) => setFormData({
                ...formData,
                chargingSchedule: { ...formData.chargingSchedule!, chargingRateUnit: e.target.value as ChargingRateUnit },
              })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="W">Watts (W)</option>
              <option value="A">Amperes (A)</option>
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            {profile ? 'Salvar' : 'Criar Perfil'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
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
          'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
          enabled ? 'left-7' : 'left-1'
        )}
      />
    </button>
  );
}

interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

function SummaryCard({ icon: Icon, label, value, color }: SummaryCardProps) {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success-500',
    warning: 'text-warning-500',
    danger: 'text-danger-500',
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <Icon className={cn('w-5 h-5', color ? colorClasses[color] : 'text-foreground-muted')} />
        <div>
          <p className={cn('text-lg font-semibold', color ? colorClasses[color] : 'text-foreground')}>
            {value}
          </p>
          <p className="text-xs text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 h-64 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MOCK DATA
// ============================================

function getMockProfiles(chargerId?: string): ChargingProfile[] {
  return [
    {
      id: 'profile-001',
      chargerId: chargerId || 'charger-001',
      name: 'Horario de Pico',
      description: 'Reduzir potencia durante horario de pico (17h-21h)',
      stackLevel: 1,
      chargingProfilePurpose: 'TxDefaultProfile',
      chargingProfileKind: 'Recurring',
      recurrencyKind: 'Daily',
      chargingSchedule: {
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [
          { startPeriod: 0, limit: 11000 },
          { startPeriod: 61200, limit: 3000 }, // 17:00
          { startPeriod: 75600, limit: 11000 }, // 21:00
        ],
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'profile-002',
      chargerId: chargerId || 'charger-001',
      name: 'Carregamento Noturno',
      description: 'Carga completa durante tarifa noturna',
      stackLevel: 2,
      chargingProfilePurpose: 'TxDefaultProfile',
      chargingProfileKind: 'Recurring',
      recurrencyKind: 'Daily',
      chargingSchedule: {
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [
          { startPeriod: 0, limit: 3000 },
          { startPeriod: 79200, limit: 22000 }, // 22:00
          { startPeriod: 21600, limit: 3000 }, // 06:00
        ],
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'profile-003',
      chargerId: chargerId || 'charger-001',
      name: 'Limite de Potencia',
      description: 'Limite maximo do ponto de carga',
      stackLevel: 0,
      chargingProfilePurpose: 'ChargePointMaxProfile',
      chargingProfileKind: 'Absolute',
      chargingSchedule: {
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [
          { startPeriod: 0, limit: 50000 },
        ],
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function getMockSettings(): SmartChargingSettings {
  return {
    enabled: true,
    maxSitePowerKw: 150,
    priorityMode: 'equal_share',
    solarIntegration: true,
    gridLimitKw: 100,
    peakShavingEnabled: true,
    peakShavingThresholdKw: 80,
    dynamicPricing: false,
  };
}

function getMockForecast(): LoadForecast[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const isSunny = hour >= 6 && hour <= 18;
    const isPeak = hour >= 17 && hour <= 21;
    const isNight = hour >= 22 || hour <= 5;

    return {
      hour,
      demandKw: isPeak ? 120 + Math.random() * 30 : isNight ? 30 + Math.random() * 20 : 60 + Math.random() * 30,
      solarKw: isSunny ? (hour - 6) * (hour <= 12 ? 8 : 18 - hour) * 2 + Math.random() * 10 : 0,
      evLoadKw: isPeak ? 20 + Math.random() * 10 : isNight ? 40 + Math.random() * 20 : 30 + Math.random() * 15,
      gridImportKw: isPeak ? 80 + Math.random() * 20 : isNight ? 10 + Math.random() * 10 : 40 + Math.random() * 20,
      tariffRate: isPeak ? 0.85 : isNight ? 0.35 : 0.55,
    };
  });
}
