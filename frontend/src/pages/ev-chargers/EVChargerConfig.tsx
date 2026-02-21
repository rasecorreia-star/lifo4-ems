import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  Save,
  Wifi,
  Shield,
  Clock,
  Zap,
  Server,
  Key,
  FileText,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Info,
  Power,
  Trash2,
  RotateCcw,
  Terminal,
  Globe,
} from 'lucide-react';
import {
  cn,
  formatDate,
  formatRelativeTime,
} from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

export interface OCPPConfiguration {
  key: string;
  readonly: boolean;
  value?: string;
  description?: string;
  unit?: string;
  type?: 'boolean' | 'integer' | 'string' | 'CSL';
}

export interface ChargerConfig {
  id: string;
  chargerId: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  ocppVersion: '1.6' | '2.0.1';
  ocppEndpoint: string;
  chargeBoxIdentity: string;

  // Connection settings
  connectionSettings: {
    heartbeatInterval: number;
    connectionTimeout: number;
    messageTimeout: number;
    reconnectMaxRetries: number;
    reconnectInterval: number;
    pingInterval: number;
  };

  // Authorization settings
  authorizationSettings: {
    authorizationCacheEnabled: boolean;
    localAuthListEnabled: boolean;
    localAuthListMaxLength: number;
    idTagLength: number;
    authorizationTimeout: number;
  };

  // Charging settings
  chargingSettings: {
    maxChargingProfiles: number;
    defaultChargingProfile?: string;
    meterValuesInterval: number;
    meterValuesSampleData: string[];
    clockAlignedDataInterval: number;
    stopTransactionOnEVSideDisconnect: boolean;
    stopTransactionOnInvalidId: boolean;
    unlockConnectorOnEVSideDisconnect: boolean;
  };

  // Security settings
  securitySettings: {
    securityProfile: 0 | 1 | 2 | 3;
    basicAuthEnabled: boolean;
    basicAuthUsername?: string;
    tlsEnabled: boolean;
    certificateInstalled: boolean;
    certificateExpiry?: string;
  };

  // Firmware
  firmware: {
    version: string;
    lastUpdateDate?: string;
    updateAvailable: boolean;
    availableVersion?: string;
  };

  // Diagnostics
  diagnostics: {
    lastDiagnosticsDate?: string;
    lastDiagnosticsStatus?: string;
    logRetention: number;
  };

  updatedAt: string;
}

export interface LocalAuthListEntry {
  idTag: string;
  idTagInfo: {
    status: 'Accepted' | 'Blocked' | 'Expired' | 'Invalid' | 'ConcurrentTx';
    expiryDate?: string;
    parentIdTag?: string;
  };
}

// ============================================
// API FUNCTIONS
// ============================================

const configApi = {
  getConfig: (chargerId: string) =>
    api.get<{ success: boolean; data: ChargerConfig }>(`/ev-chargers/${chargerId}/config`),

  updateConfig: (chargerId: string, config: Partial<ChargerConfig>) =>
    api.patch<{ success: boolean; data: ChargerConfig }>(`/ev-chargers/${chargerId}/config`, config),

  getOCPPConfig: (chargerId: string) =>
    api.get<{ success: boolean; data: OCPPConfiguration[] }>(`/ev-chargers/${chargerId}/ocpp-config`),

  setOCPPConfigKey: (chargerId: string, key: string, value: string) =>
    api.post(`/ev-chargers/${chargerId}/ocpp-config`, { key, value }),

  triggerMessage: (chargerId: string, message: string, connectorId?: number) =>
    api.post(`/ev-chargers/${chargerId}/trigger-message`, { message, connectorId }),

  updateFirmware: (chargerId: string, location: string, retrieveDate: string) =>
    api.post(`/ev-chargers/${chargerId}/update-firmware`, { location, retrieveDate }),

  getDiagnostics: (chargerId: string, location: string) =>
    api.post<{ success: boolean; data: { fileName: string } }>(`/ev-chargers/${chargerId}/get-diagnostics`, { location }),

  getLocalAuthList: (chargerId: string) =>
    api.get<{ success: boolean; data: LocalAuthListEntry[] }>(`/ev-chargers/${chargerId}/local-auth-list`),

  sendLocalAuthList: (chargerId: string, listVersion: number, entries: LocalAuthListEntry[], updateType: 'Full' | 'Differential') =>
    api.post(`/ev-chargers/${chargerId}/local-auth-list`, { listVersion, entries, updateType }),

  clearCache: (chargerId: string) =>
    api.post(`/ev-chargers/${chargerId}/clear-cache`),

  reset: (chargerId: string, type: 'Soft' | 'Hard') =>
    api.post(`/ev-chargers/${chargerId}/reset`, { type }),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function EVChargerConfig() {
  const { chargerId } = useParams<{ chargerId: string }>();

  const [config, setConfig] = useState<ChargerConfig | null>(null);
  const [ocppConfig, setOcppConfig] = useState<OCPPConfiguration[]>([]);
  const [localAuthList, setLocalAuthList] = useState<LocalAuthListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'ocpp' | 'auth' | 'firmware' | 'security'>('general');
  const [commandStatus, setCommandStatus] = useState<{ type: string; status: 'loading' | 'success' | 'error' } | null>(null);

  // Fetch data
  const fetchData = async () => {
    if (!chargerId) return;

    try {
      setIsLoading(true);

      const [configRes, ocppRes, authRes] = await Promise.all([
        configApi.getConfig(chargerId).catch(() => null),
        configApi.getOCPPConfig(chargerId).catch(() => null),
        configApi.getLocalAuthList(chargerId).catch(() => null),
      ]);

      setConfig(configRes?.data.data || getMockConfig(chargerId));
      setOcppConfig(ocppRes?.data.data || getMockOCPPConfig());
      setLocalAuthList(authRes?.data.data || getMockLocalAuthList());
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chargerId]);

  // Save config
  const handleSave = async () => {
    if (!chargerId || !config) return;

    try {
      setIsSaving(true);
      await configApi.updateConfig(chargerId, config);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Update config field
  const updateConfig = <K extends keyof ChargerConfig>(
    section: K,
    field: keyof ChargerConfig[K],
    value: unknown
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      [section]: {
        ...(config[section] as object),
        [field]: value,
      },
    });
    setHasChanges(true);
  };

  // OCPP Commands
  const executeCommand = async (command: string, action: () => Promise<unknown>) => {
    setCommandStatus({ type: command, status: 'loading' });
    try {
      await action();
      setCommandStatus({ type: command, status: 'success' });
      setTimeout(() => setCommandStatus(null), 3000);
    } catch {
      setCommandStatus({ type: command, status: 'error' });
      setTimeout(() => setCommandStatus(null), 3000);
    }
  };

  const handleTriggerMessage = (message: string) => {
    if (!chargerId) return;
    executeCommand(`trigger-${message}`, () => configApi.triggerMessage(chargerId, message));
  };

  const handleClearCache = () => {
    if (!chargerId) return;
    executeCommand('clear-cache', () => configApi.clearCache(chargerId));
  };

  const handleReset = (type: 'Soft' | 'Hard') => {
    if (!chargerId) return;
    if (type === 'Hard' && !confirm('Tem certeza? Isso ira reiniciar completamente o carregador.')) return;
    executeCommand(`reset-${type}`, () => configApi.reset(chargerId, type));
  };

  const handleSetOCPPKey = async (key: string, value: string) => {
    if (!chargerId) return;
    try {
      await configApi.setOCPPConfigKey(chargerId, key, value);
      setOcppConfig(ocppConfig.map((c) => (c.key === key ? { ...c, value } : c)));
    } catch (error) {
      console.error('Failed to set OCPP config key:', error);
    }
  };

  if (isLoading) {
    return <ConfigSkeleton />;
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Configuracao nao encontrada</h2>
        <Link
          to="/ev-chargers"
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para carregadores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/ev-chargers/${chargerId}`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuracao do Carregador</h1>
            <p className="text-foreground-muted text-sm">
              {config.name} - {config.serialNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Salvando...' : 'Salvar Alteracoes'}
            </button>
          )}
          <button
            onClick={fetchData}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={Settings} label="Geral" />
        <TabButton active={activeTab === 'ocpp'} onClick={() => setActiveTab('ocpp')} icon={Terminal} label="OCPP Config" />
        <TabButton active={activeTab === 'auth'} onClick={() => setActiveTab('auth')} icon={Key} label="Autorizacao" />
        <TabButton active={activeTab === 'firmware'} onClick={() => setActiveTab('firmware')} icon={Download} label="Firmware" />
        <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={Shield} label="Seguranca" />
      </div>

      {/* Content */}
      {activeTab === 'general' && (
        <GeneralTab
          config={config}
          onUpdate={updateConfig}
          commandStatus={commandStatus}
          onTriggerMessage={handleTriggerMessage}
          onClearCache={handleClearCache}
          onReset={handleReset}
        />
      )}

      {activeTab === 'ocpp' && (
        <OCPPConfigTab
          ocppConfig={ocppConfig}
          ocppVersion={config.ocppVersion}
          onSetKey={handleSetOCPPKey}
        />
      )}

      {activeTab === 'auth' && (
        <AuthorizationTab
          config={config}
          localAuthList={localAuthList}
          onUpdate={updateConfig}
          onUpdateAuthList={setLocalAuthList}
        />
      )}

      {activeTab === 'firmware' && (
        <FirmwareTab
          config={config}
          chargerId={chargerId!}
          onUpdate={updateConfig}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          config={config}
          onUpdate={updateConfig}
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
// GENERAL TAB
// ============================================

interface GeneralTabProps {
  config: ChargerConfig;
  onUpdate: <K extends keyof ChargerConfig>(section: K, field: keyof ChargerConfig[K], value: unknown) => void;
  commandStatus: { type: string; status: 'loading' | 'success' | 'error' } | null;
  onTriggerMessage: (message: string) => void;
  onClearCache: () => void;
  onReset: (type: 'Soft' | 'Hard') => void;
}

function GeneralTab({ config, onUpdate, commandStatus, onTriggerMessage, onClearCache, onReset }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          Informacoes Basicas
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoField label="Nome" value={config.name} />
          <InfoField label="Modelo" value={config.model} />
          <InfoField label="Fabricante" value={config.manufacturer} />
          <InfoField label="Serial" value={config.serialNumber} />
          <InfoField label="Versao OCPP" value={config.ocppVersion} />
          <InfoField label="Firmware" value={config.firmware.version} />
        </div>
      </div>

      {/* Connection Settings */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-primary" />
          Configuracoes de Conexao
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label="Charge Box Identity"
            value={config.chargeBoxIdentity}
            disabled
          />
          <InputField
            label="Endpoint OCPP"
            value={config.ocppEndpoint}
            disabled
          />
          <InputField
            label="Heartbeat Interval (s)"
            type="number"
            value={config.connectionSettings.heartbeatInterval}
            onChange={(v) => onUpdate('connectionSettings', 'heartbeatInterval', Number(v))}
          />
          <InputField
            label="Connection Timeout (s)"
            type="number"
            value={config.connectionSettings.connectionTimeout}
            onChange={(v) => onUpdate('connectionSettings', 'connectionTimeout', Number(v))}
          />
          <InputField
            label="Message Timeout (s)"
            type="number"
            value={config.connectionSettings.messageTimeout}
            onChange={(v) => onUpdate('connectionSettings', 'messageTimeout', Number(v))}
          />
          <InputField
            label="Reconnect Interval (s)"
            type="number"
            value={config.connectionSettings.reconnectInterval}
            onChange={(v) => onUpdate('connectionSettings', 'reconnectInterval', Number(v))}
          />
        </div>
      </div>

      {/* Charging Settings */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Configuracoes de Carregamento
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label="Meter Values Interval (s)"
            type="number"
            value={config.chargingSettings.meterValuesInterval}
            onChange={(v) => onUpdate('chargingSettings', 'meterValuesInterval', Number(v))}
          />
          <InputField
            label="Clock Aligned Data Interval (s)"
            type="number"
            value={config.chargingSettings.clockAlignedDataInterval}
            onChange={(v) => onUpdate('chargingSettings', 'clockAlignedDataInterval', Number(v))}
          />
          <ToggleField
            label="Stop on EV Disconnect"
            description="Parar transacao quando EV desconecta"
            value={config.chargingSettings.stopTransactionOnEVSideDisconnect}
            onChange={(v) => onUpdate('chargingSettings', 'stopTransactionOnEVSideDisconnect', v)}
          />
          <ToggleField
            label="Stop on Invalid ID"
            description="Parar transacao com ID invalido"
            value={config.chargingSettings.stopTransactionOnInvalidId}
            onChange={(v) => onUpdate('chargingSettings', 'stopTransactionOnInvalidId', v)}
          />
          <ToggleField
            label="Unlock on EV Disconnect"
            description="Desbloquear conector quando EV desconecta"
            value={config.chargingSettings.unlockConnectorOnEVSideDisconnect}
            onChange={(v) => onUpdate('chargingSettings', 'unlockConnectorOnEVSideDisconnect', v)}
          />
        </div>
      </div>

      {/* Quick Commands */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" />
          Comandos Rapidos
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CommandButton
            label="Trigger StatusNotification"
            icon={Wifi}
            onClick={() => onTriggerMessage('StatusNotification')}
            status={commandStatus?.type === 'trigger-StatusNotification' ? commandStatus.status : undefined}
          />
          <CommandButton
            label="Trigger MeterValues"
            icon={Zap}
            onClick={() => onTriggerMessage('MeterValues')}
            status={commandStatus?.type === 'trigger-MeterValues' ? commandStatus.status : undefined}
          />
          <CommandButton
            label="Clear Cache"
            icon={Trash2}
            onClick={onClearCache}
            status={commandStatus?.type === 'clear-cache' ? commandStatus.status : undefined}
          />
          <CommandButton
            label="Soft Reset"
            icon={RotateCcw}
            onClick={() => onReset('Soft')}
            status={commandStatus?.type === 'reset-Soft' ? commandStatus.status : undefined}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => onReset('Hard')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 font-medium rounded-lg transition-colors"
          >
            <Power className="w-4 h-4" />
            Hard Reset
          </button>
          <p className="text-sm text-foreground-muted mt-2">
            Hard reset ira reiniciar completamente o carregador. Use com cuidado.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// OCPP CONFIG TAB
// ============================================

interface OCPPConfigTabProps {
  ocppConfig: OCPPConfiguration[];
  ocppVersion: '1.6' | '2.0.1';
  onSetKey: (key: string, value: string) => void;
}

function OCPPConfigTab({ ocppConfig, ocppVersion, onSetKey }: OCPPConfigTabProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConfig = ocppConfig.filter(
    (c) => c.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (key: string, currentValue?: string) => {
    setEditingKey(key);
    setEditValue(currentValue || '');
  };

  const handleSave = (key: string) => {
    onSetKey(key, editValue);
    setEditingKey(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Configuracao OCPP {ocppVersion}
          </h3>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar chave..."
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Settings className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Chave</th>
                <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Valor</th>
                <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Tipo</th>
                <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Acesso</th>
                <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredConfig.map((item) => (
                <tr key={item.key} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="py-2 px-3">
                    <span className="text-foreground text-sm font-mono">{item.key}</span>
                    {item.description && (
                      <p className="text-foreground-muted text-xs mt-0.5">{item.description}</p>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {editingKey === item.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="px-2 py-1 bg-background border border-primary rounded text-foreground text-sm w-full focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="text-foreground text-sm">{item.value || '-'}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-foreground-muted text-xs">{item.type || 'string'}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      item.readonly
                        ? 'bg-foreground-subtle/20 text-foreground-subtle'
                        : 'bg-success-500/20 text-success-500'
                    )}>
                      {item.readonly ? 'Somente Leitura' : 'Leitura/Escrita'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {!item.readonly && (
                      editingKey === item.key ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(item.key)}
                            className="p-1 bg-success-500/10 hover:bg-success-500/20 text-success-500 rounded"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="p-1 bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 rounded"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(item.key, item.value)}
                          className="text-primary hover:text-primary-400 text-sm"
                        >
                          Editar
                        </button>
                      )
                    )}
                  </td>
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
// AUTHORIZATION TAB
// ============================================

interface AuthorizationTabProps {
  config: ChargerConfig;
  localAuthList: LocalAuthListEntry[];
  onUpdate: <K extends keyof ChargerConfig>(section: K, field: keyof ChargerConfig[K], value: unknown) => void;
  onUpdateAuthList: (list: LocalAuthListEntry[]) => void;
}

function AuthorizationTab({ config, localAuthList, onUpdate, onUpdateAuthList }: AuthorizationTabProps) {
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newIdTag, setNewIdTag] = useState('');
  const [newStatus, setNewStatus] = useState<LocalAuthListEntry['idTagInfo']['status']>('Accepted');

  const handleAddEntry = () => {
    if (!newIdTag) return;
    onUpdateAuthList([
      ...localAuthList,
      {
        idTag: newIdTag,
        idTagInfo: { status: newStatus },
      },
    ]);
    setNewIdTag('');
    setShowAddEntry(false);
  };

  const handleRemoveEntry = (idTag: string) => {
    onUpdateAuthList(localAuthList.filter((e) => e.idTag !== idTag));
  };

  return (
    <div className="space-y-6">
      {/* Authorization Settings */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          Configuracoes de Autorizacao
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <ToggleField
            label="Cache de Autorizacao"
            description="Permitir cache de autorizacoes"
            value={config.authorizationSettings.authorizationCacheEnabled}
            onChange={(v) => onUpdate('authorizationSettings', 'authorizationCacheEnabled', v)}
          />
          <ToggleField
            label="Lista Local de Autorizacao"
            description="Usar lista local de IDs autorizados"
            value={config.authorizationSettings.localAuthListEnabled}
            onChange={(v) => onUpdate('authorizationSettings', 'localAuthListEnabled', v)}
          />
          <InputField
            label="Tamanho Maximo da Lista"
            type="number"
            value={config.authorizationSettings.localAuthListMaxLength}
            onChange={(v) => onUpdate('authorizationSettings', 'localAuthListMaxLength', Number(v))}
          />
          <InputField
            label="Timeout de Autorizacao (s)"
            type="number"
            value={config.authorizationSettings.authorizationTimeout}
            onChange={(v) => onUpdate('authorizationSettings', 'authorizationTimeout', Number(v))}
          />
        </div>
      </div>

      {/* Local Auth List */}
      {config.authorizationSettings.localAuthListEnabled && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Lista Local de Autorizacao
            </h3>
            <button
              onClick={() => setShowAddEntry(true)}
              className="text-sm text-primary hover:text-primary-400"
            >
              + Adicionar Entrada
            </button>
          </div>

          {showAddEntry && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-background rounded-lg">
              <input
                type="text"
                value={newIdTag}
                onChange={(e) => setNewIdTag(e.target.value)}
                placeholder="ID Tag"
                className="flex-1 px-3 py-2 bg-surface border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as LocalAuthListEntry['idTagInfo']['status'])}
                className="px-3 py-2 bg-surface border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Accepted">Aceito</option>
                <option value="Blocked">Bloqueado</option>
                <option value="Expired">Expirado</option>
              </select>
              <button
                onClick={handleAddEntry}
                className="px-3 py-2 bg-primary hover:bg-primary-600 text-white text-sm font-medium rounded transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => setShowAddEntry(false)}
                className="px-3 py-2 bg-surface-hover hover:bg-surface-active text-foreground text-sm font-medium rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {localAuthList.length === 0 ? (
            <p className="text-foreground-muted text-center py-8">Nenhuma entrada na lista local</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">ID Tag</th>
                    <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Expiracao</th>
                    <th className="text-left py-2 px-3 text-foreground-muted text-sm font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {localAuthList.map((entry) => (
                    <tr key={entry.idTag} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="py-2 px-3 text-foreground text-sm font-mono">{entry.idTag}</td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          entry.idTagInfo.status === 'Accepted' ? 'bg-success-500/20 text-success-500' :
                          entry.idTagInfo.status === 'Blocked' ? 'bg-danger-500/20 text-danger-500' :
                          'bg-warning-500/20 text-warning-500'
                        )}>
                          {entry.idTagInfo.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-foreground-muted text-sm">
                        {entry.idTagInfo.expiryDate ? formatDate(entry.idTagInfo.expiryDate) : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => handleRemoveEntry(entry.idTag)}
                          className="text-danger-500 hover:text-danger-400 text-sm"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// FIRMWARE TAB
// ============================================

interface FirmwareTabProps {
  config: ChargerConfig;
  chargerId: string;
  onUpdate: <K extends keyof ChargerConfig>(section: K, field: keyof ChargerConfig[K], value: unknown) => void;
}

function FirmwareTab({ config, chargerId, onUpdate }: FirmwareTabProps) {
  const [firmwareUrl, setFirmwareUrl] = useState('');
  const [retrieveDate, setRetrieveDate] = useState('');
  const [diagnosticsUrl, setDiagnosticsUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateFirmware = async () => {
    if (!firmwareUrl || !retrieveDate) return;
    try {
      setIsUpdating(true);
      await configApi.updateFirmware(chargerId, firmwareUrl, retrieveDate);
    } catch (error) {
      console.error('Failed to update firmware:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGetDiagnostics = async () => {
    if (!diagnosticsUrl) return;
    try {
      await configApi.getDiagnostics(chargerId, diagnosticsUrl);
    } catch (error) {
      console.error('Failed to get diagnostics:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Firmware */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          Firmware Atual
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoField label="Versao Atual" value={config.firmware.version} />
          <InfoField
            label="Ultima Atualizacao"
            value={config.firmware.lastUpdateDate ? formatDate(config.firmware.lastUpdateDate) : 'N/A'}
          />
          {config.firmware.updateAvailable && (
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm font-medium text-primary">Nova versao disponivel!</p>
              <p className="text-xs text-foreground-muted">{config.firmware.availableVersion}</p>
            </div>
          )}
        </div>
      </div>

      {/* Update Firmware */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Atualizar Firmware
        </h3>
        <div className="space-y-4">
          <InputField
            label="URL do Firmware"
            value={firmwareUrl}
            onChange={setFirmwareUrl}
            placeholder="https://firmware.example.com/charger/v2.0.0.bin"
          />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Data de Atualizacao</label>
            <input
              type="datetime-local"
              value={retrieveDate}
              onChange={(e) => setRetrieveDate(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleUpdateFirmware}
            disabled={!firmwareUrl || !retrieveDate || isUpdating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isUpdating ? 'Iniciando...' : 'Iniciar Atualizacao'}
          </button>
          <p className="text-sm text-foreground-muted">
            A atualizacao sera baixada e instalada na data/hora especificada.
          </p>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Diagnosticos
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <InfoField
            label="Ultimo Diagnostico"
            value={config.diagnostics.lastDiagnosticsDate ? formatDate(config.diagnostics.lastDiagnosticsDate) : 'N/A'}
          />
          <InfoField
            label="Status"
            value={config.diagnostics.lastDiagnosticsStatus || 'N/A'}
          />
        </div>
        <div className="space-y-4">
          <InputField
            label="URL de Upload"
            value={diagnosticsUrl}
            onChange={setDiagnosticsUrl}
            placeholder="ftp://diagnostics.example.com/uploads/"
          />
          <button
            onClick={handleGetDiagnostics}
            disabled={!diagnosticsUrl}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Solicitar Diagnosticos
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECURITY TAB
// ============================================

interface SecurityTabProps {
  config: ChargerConfig;
  onUpdate: <K extends keyof ChargerConfig>(section: K, field: keyof ChargerConfig[K], value: unknown) => void;
}

function SecurityTab({ config, onUpdate }: SecurityTabProps) {
  return (
    <div className="space-y-6">
      {/* Security Profile */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Perfil de Seguranca
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Perfil de Seguranca OCPP</label>
            <select
              value={config.securitySettings.securityProfile}
              onChange={(e) => onUpdate('securitySettings', 'securityProfile', Number(e.target.value))}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={0}>Perfil 0 - Sem Seguranca</option>
              <option value={1}>Perfil 1 - Basic Authentication</option>
              <option value={2}>Perfil 2 - TLS com Basic Auth</option>
              <option value={3}>Perfil 3 - TLS com Certificado Cliente</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className={cn(
              'rounded-lg p-4 border',
              config.securitySettings.securityProfile >= 1 ? 'border-success-500/50 bg-success-500/5' : 'border-border'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-foreground-muted" />
                <span className="font-medium text-foreground">Basic Authentication</span>
              </div>
              <p className="text-sm text-foreground-muted">
                {config.securitySettings.basicAuthEnabled ? 'Habilitado' : 'Desabilitado'}
              </p>
            </div>

            <div className={cn(
              'rounded-lg p-4 border',
              config.securitySettings.securityProfile >= 2 ? 'border-success-500/50 bg-success-500/5' : 'border-border'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-foreground-muted" />
                <span className="font-medium text-foreground">TLS/SSL</span>
              </div>
              <p className="text-sm text-foreground-muted">
                {config.securitySettings.tlsEnabled ? 'Habilitado' : 'Desabilitado'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate */}
      {config.securitySettings.securityProfile >= 2 && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Certificado
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              {config.securitySettings.certificateInstalled ? (
                <CheckCircle className="w-6 h-6 text-success-500" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-warning-500" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {config.securitySettings.certificateInstalled ? 'Certificado Instalado' : 'Sem Certificado'}
                </p>
                {config.securitySettings.certificateExpiry && (
                  <p className="text-sm text-foreground-muted">
                    Expira em: {formatDate(config.securitySettings.certificateExpiry)}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors">
              <Upload className="w-4 h-4" />
              Instalar Certificado
            </button>
          </div>
        </div>
      )}

      {/* Basic Auth Credentials */}
      {config.securitySettings.basicAuthEnabled && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Credenciais Basic Auth
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <InputField
              label="Username"
              value={config.securitySettings.basicAuthUsername || ''}
              onChange={(v) => onUpdate('securitySettings', 'basicAuthUsername', v)}
            />
            <InputField
              label="Password"
              type="password"
              value="********"
              onChange={() => {}}
              placeholder="Insira nova senha para alterar"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

interface InfoFieldProps {
  label: string;
  value: string;
}

function InfoField({ label, value }: InfoFieldProps) {
  return (
    <div>
      <p className="text-sm text-foreground-muted mb-1">{label}</p>
      <p className="text-foreground font-medium">{value}</p>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  type?: 'text' | 'number' | 'password';
  disabled?: boolean;
  placeholder?: string;
}

function InputField({ label, value, onChange, type = 'text', disabled, placeholder }: InputFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleField({ label, description, value, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-background rounded-lg">
      <div>
        <p className="font-medium text-foreground text-sm">{label}</p>
        {description && <p className="text-xs text-foreground-muted">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-10 h-5 rounded-full transition-colors',
          value ? 'bg-primary' : 'bg-surface-active'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
            value ? 'left-5.5' : 'left-0.5'
          )}
          style={{ left: value ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

interface CommandButtonProps {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  status?: 'loading' | 'success' | 'error';
}

function CommandButton({ label, icon: Icon, onClick, status }: CommandButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={status === 'loading'}
      className={cn(
        'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
        status === 'success' ? 'border-success-500 bg-success-500/10 text-success-500' :
        status === 'error' ? 'border-danger-500 bg-danger-500/10 text-danger-500' :
        'border-border bg-background hover:bg-surface-hover text-foreground'
      )}
    >
      {status === 'loading' ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : status === 'success' ? (
        <CheckCircle className="w-4 h-4" />
      ) : status === 'error' ? (
        <AlertTriangle className="w-4 h-4" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function ConfigSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="h-12 bg-surface rounded-lg animate-pulse" />
      <div className="bg-surface rounded-xl border border-border p-6 h-96 animate-pulse" />
    </div>
  );
}

// ============================================
// MOCK DATA
// ============================================

function getMockConfig(chargerId: string): ChargerConfig {
  return {
    id: `config-${chargerId}`,
    chargerId,
    name: 'Carregador Estacionamento A1',
    model: 'ABB Terra 54',
    manufacturer: 'ABB',
    serialNumber: 'ABB-54-001',
    ocppVersion: '1.6',
    ocppEndpoint: 'wss://ocpp.lifo4.com/ocpp',
    chargeBoxIdentity: 'ABB-54-001',
    connectionSettings: {
      heartbeatInterval: 300,
      connectionTimeout: 30,
      messageTimeout: 30,
      reconnectMaxRetries: 5,
      reconnectInterval: 10,
      pingInterval: 60,
    },
    authorizationSettings: {
      authorizationCacheEnabled: true,
      localAuthListEnabled: true,
      localAuthListMaxLength: 100,
      idTagLength: 20,
      authorizationTimeout: 30,
    },
    chargingSettings: {
      maxChargingProfiles: 10,
      meterValuesInterval: 60,
      meterValuesSampleData: ['Energy.Active.Import.Register', 'Power.Active.Import', 'Current.Import', 'Voltage'],
      clockAlignedDataInterval: 900,
      stopTransactionOnEVSideDisconnect: true,
      stopTransactionOnInvalidId: true,
      unlockConnectorOnEVSideDisconnect: true,
    },
    securitySettings: {
      securityProfile: 1,
      basicAuthEnabled: true,
      basicAuthUsername: 'charger',
      tlsEnabled: false,
      certificateInstalled: false,
    },
    firmware: {
      version: '2.1.0',
      lastUpdateDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updateAvailable: true,
      availableVersion: '2.2.0',
    },
    diagnostics: {
      lastDiagnosticsDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastDiagnosticsStatus: 'Uploaded',
      logRetention: 30,
    },
    updatedAt: new Date().toISOString(),
  };
}

function getMockOCPPConfig(): OCPPConfiguration[] {
  return [
    { key: 'HeartbeatInterval', readonly: false, value: '300', type: 'integer', description: 'Intervalo de heartbeat em segundos' },
    { key: 'ConnectionTimeOut', readonly: false, value: '30', type: 'integer', description: 'Timeout de conexao' },
    { key: 'MeterValueSampleInterval', readonly: false, value: '60', type: 'integer', description: 'Intervalo de amostragem de medidores' },
    { key: 'MeterValuesAlignedData', readonly: false, value: 'Energy.Active.Import.Register', type: 'CSL', description: 'Dados alinhados do medidor' },
    { key: 'NumberOfConnectors', readonly: true, value: '2', type: 'integer', description: 'Numero de conectores' },
    { key: 'ChargePointVendor', readonly: true, value: 'ABB', type: 'string', description: 'Fabricante do carregador' },
    { key: 'ChargePointModel', readonly: true, value: 'Terra 54', type: 'string', description: 'Modelo do carregador' },
    { key: 'ChargePointSerialNumber', readonly: true, value: 'ABB-54-001', type: 'string', description: 'Numero serial' },
    { key: 'FirmwareVersion', readonly: true, value: '2.1.0', type: 'string', description: 'Versao do firmware' },
    { key: 'LocalAuthListEnabled', readonly: false, value: 'true', type: 'boolean', description: 'Lista de autorizacao local habilitada' },
    { key: 'LocalAuthListMaxLength', readonly: true, value: '100', type: 'integer', description: 'Tamanho maximo da lista local' },
    { key: 'AuthorizationCacheEnabled', readonly: false, value: 'true', type: 'boolean', description: 'Cache de autorizacao habilitado' },
    { key: 'StopTransactionOnEVSideDisconnect', readonly: false, value: 'true', type: 'boolean', description: 'Parar transacao quando EV desconecta' },
    { key: 'StopTransactionOnInvalidId', readonly: false, value: 'true', type: 'boolean', description: 'Parar transacao com ID invalido' },
    { key: 'UnlockConnectorOnEVSideDisconnect', readonly: false, value: 'true', type: 'boolean', description: 'Desbloquear conector quando EV desconecta' },
  ];
}

function getMockLocalAuthList(): LocalAuthListEntry[] {
  return [
    { idTag: 'TAG001', idTagInfo: { status: 'Accepted' } },
    { idTag: 'TAG002', idTagInfo: { status: 'Accepted' } },
    { idTag: 'TAG003', idTagInfo: { status: 'Blocked' } },
    { idTag: 'TAG004', idTagInfo: { status: 'Accepted', expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } },
  ];
}
