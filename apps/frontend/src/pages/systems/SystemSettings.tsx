import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Shield,
  Thermometer,
  Zap,
  Battery,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { systemsApi } from '@/services/api';
import { BessSystem, ProtectionSettings } from '@/types';

export default function SystemSettings() {
  const { systemId } = useParams<{ systemId: string }>();
  const [system, setSystem] = useState<BessSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<ProtectionSettings>>({});

  // Fetch data
  const fetchData = async () => {
    if (!systemId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [systemRes, settingsRes] = await Promise.all([
        systemsApi.getById(systemId),
        systemsApi.getProtectionSettings(systemId),
      ]);

      setSystem(systemRes.data.data || null);
      const protectionData = settingsRes.data.data || getDefaultSettings();
      setFormData(protectionData);
    } catch (err) {
      setError('Falha ao carregar configurações');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [systemId]);

  // Get default settings based on LiFePO4 chemistry
  const getDefaultSettings = (): Partial<ProtectionSettings> => ({
    cellOvervoltage: 3.65,
    cellUndervoltage: 2.5,
    cellOvervoltageRecovery: 3.55,
    cellUndervoltageRecovery: 2.8,
    maxChargeCurrent: 100,
    maxDischargeCurrent: 150,
    chargeHighTemp: 45,
    chargeLowTemp: 0,
    dischargeHighTemp: 55,
    dischargeLowTemp: -20,
    balanceStartVoltage: 3.4,
    balanceDeltaVoltage: 0.03,
    minSoc: 10,
    maxSoc: 95,
  });

  // Update form field
  const updateField = (field: keyof ProtectionSettings, value: number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Reset to defaults
  const handleReset = () => {
    const defaults = getDefaultSettings();
    setFormData(defaults);
    setHasChanges(true);
  };

  // Save settings
  const handleSave = async () => {
    if (!systemId) return;

    setIsSaving(true);
    try {
      await systemsApi.updateProtectionSettings(systemId, formData);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !system) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Sistema não encontrado'}
        </h2>
        <Link
          to="/systems"
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para sistemas
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
            to={`/systems/${systemId}`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Configurações de Proteção
            </h1>
            <p className="text-foreground-muted text-sm">
              {system.name} • {system.model}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar Padrões
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
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

      {/* Warning Banner */}
      <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-warning-500">Atenção</h3>
          <p className="text-sm text-foreground-muted">
            Alterar as configurações de proteção pode afetar a segurança e vida útil da bateria.
            Apenas técnicos qualificados devem modificar estes parâmetros.
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Voltage Protection */}
        <SettingsCard
          title="Proteção de Tensão"
          icon={Zap}
          iconColor="text-primary"
        >
          <SettingsField
            label="Sobretensão Célula"
            value={formData.cellOvervoltage || 0}
            onChange={(v) => updateField('cellOvervoltage', v)}
            unit="V"
            min={3.4}
            max={3.8}
            step={0.01}
            description="Tensão máxima permitida por célula"
          />
          <SettingsField
            label="Recuperação Sobretensão"
            value={formData.cellOvervoltageRecovery || 0}
            onChange={(v) => updateField('cellOvervoltageRecovery', v)}
            unit="V"
            min={3.3}
            max={3.7}
            step={0.01}
            description="Tensão para retomar operação após sobretensão"
          />
          <SettingsField
            label="Subtensão Célula"
            value={formData.cellUndervoltage || 0}
            onChange={(v) => updateField('cellUndervoltage', v)}
            unit="V"
            min={2.0}
            max={2.8}
            step={0.01}
            description="Tensão mínima permitida por célula"
          />
          <SettingsField
            label="Recuperação Subtensão"
            value={formData.cellUndervoltageRecovery || 0}
            onChange={(v) => updateField('cellUndervoltageRecovery', v)}
            unit="V"
            min={2.5}
            max={3.0}
            step={0.01}
            description="Tensão para retomar operação após subtensão"
          />
        </SettingsCard>

        {/* Current Protection */}
        <SettingsCard
          title="Proteção de Corrente"
          icon={Zap}
          iconColor="text-secondary"
        >
          <SettingsField
            label="Corrente Máx. Carga"
            value={formData.maxChargeCurrent || 0}
            onChange={(v) => updateField('maxChargeCurrent', v)}
            unit="A"
            min={10}
            max={200}
            step={5}
            description="Corrente máxima durante carga"
          />
          <SettingsField
            label="Corrente Máx. Descarga"
            value={formData.maxDischargeCurrent || 0}
            onChange={(v) => updateField('maxDischargeCurrent', v)}
            unit="A"
            min={10}
            max={300}
            step={5}
            description="Corrente máxima durante descarga"
          />
        </SettingsCard>

        {/* Temperature Protection */}
        <SettingsCard
          title="Proteção de Temperatura"
          icon={Thermometer}
          iconColor="text-warning-500"
        >
          <SettingsField
            label="Temp. Alta (Carga)"
            value={formData.chargeHighTemp || 0}
            onChange={(v) => updateField('chargeHighTemp', v)}
            unit="°C"
            min={35}
            max={55}
            step={1}
            description="Temperatura máxima para permitir carga"
          />
          <SettingsField
            label="Temp. Baixa (Carga)"
            value={formData.chargeLowTemp || 0}
            onChange={(v) => updateField('chargeLowTemp', v)}
            unit="°C"
            min={-10}
            max={15}
            step={1}
            description="Temperatura mínima para permitir carga"
          />
          <SettingsField
            label="Temp. Alta (Descarga)"
            value={formData.dischargeHighTemp || 0}
            onChange={(v) => updateField('dischargeHighTemp', v)}
            unit="°C"
            min={45}
            max={65}
            step={1}
            description="Temperatura máxima para permitir descarga"
          />
          <SettingsField
            label="Temp. Baixa (Descarga)"
            value={formData.dischargeLowTemp || 0}
            onChange={(v) => updateField('dischargeLowTemp', v)}
            unit="°C"
            min={-30}
            max={0}
            step={1}
            description="Temperatura mínima para permitir descarga"
          />
        </SettingsCard>

        {/* Balancing Settings */}
        <SettingsCard
          title="Balanceamento"
          icon={Battery}
          iconColor="text-success-500"
        >
          <SettingsField
            label="Tensão Início Balance"
            value={formData.balanceStartVoltage || 0}
            onChange={(v) => updateField('balanceStartVoltage', v)}
            unit="V"
            min={3.2}
            max={3.5}
            step={0.01}
            description="Tensão mínima para iniciar balanceamento"
          />
          <SettingsField
            label="Delta Máximo"
            value={(formData.balanceDeltaVoltage || 0) * 1000}
            onChange={(v) => updateField('balanceDeltaVoltage', v / 1000)}
            unit="mV"
            min={10}
            max={50}
            step={5}
            description="Diferença máxima entre células"
          />
        </SettingsCard>

        {/* SOC Limits */}
        <SettingsCard
          title="Limites de SOC"
          icon={Shield}
          iconColor="text-danger-500"
        >
          <SettingsField
            label="SOC Mínimo"
            value={formData.minSoc || 0}
            onChange={(v) => updateField('minSoc', v)}
            unit="%"
            min={5}
            max={30}
            step={1}
            description="SOC mínimo antes de parar descarga"
          />
          <SettingsField
            label="SOC Máximo"
            value={formData.maxSoc || 0}
            onChange={(v) => updateField('maxSoc', v)}
            unit="%"
            min={80}
            max={100}
            step={1}
            description="SOC máximo antes de parar carga"
          />
        </SettingsCard>
      </div>

      {/* Current Values Info */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Especificações da Bateria
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoItem label="Química" value={system.batterySpec.chemistry} />
          <InfoItem label="Capacidade" value={`${system.batterySpec.nominalCapacity}Ah`} />
          <InfoItem label="Tensão Nominal" value={`${system.batterySpec.nominalVoltage}V`} />
          <InfoItem label="Células" value={`${system.batterySpec.cellCount}S${system.batterySpec.cellsInParallel}P`} />
          <InfoItem label="Max Carga" value={`${system.batterySpec.maxChargeCurrent}A`} />
          <InfoItem label="Max Descarga" value={`${system.batterySpec.maxDischargeCurrent}A`} />
          <InfoItem label="Temp Máx" value={`${system.batterySpec.maxTemperature}°C`} />
          <InfoItem label="Temp Mín" value={`${system.batterySpec.minTemperature}°C`} />
        </div>
      </div>
    </div>
  );
}

// Settings Card
interface SettingsCardProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
}

function SettingsCard({ title, icon: Icon, iconColor, children }: SettingsCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={cn('p-2 rounded-lg', iconColor.replace('text-', 'bg-').replace('-500', '-500/10'))}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}

// Settings Field
interface SettingsFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
}

function SettingsField({ label, value, onChange, unit, min, max, step, description }: SettingsFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={min}
            max={max}
            step={step}
            className="w-24 px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-sm text-foreground-muted w-8">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <p className="text-xs text-foreground-subtle mt-1">{description}</p>
    </div>
  );
}

// Info Item
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background rounded-lg p-3 border border-border">
      <p className="text-xs text-foreground-muted mb-1">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
