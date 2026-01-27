import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Shield,
  Zap,
  Thermometer,
  Battery,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  Unlock,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { systemsApi } from '@/services/api';
import { BessSystem } from '@/types';

// BMS Parameter Schema with Dependencies
const bmsConfigSchema = z.object({
  // Voltage Protection
  cellOvervoltage: z.number().min(3.4).max(3.8),
  cellOvervoltageRelease: z.number().min(3.3).max(3.7),
  cellOvervoltageDelay: z.number().min(1).max(60),
  cellUndervoltage: z.number().min(2.0).max(3.0),
  cellUndervoltageRelease: z.number().min(2.2).max(3.2),
  cellUndervoltageDelay: z.number().min(1).max(60),
  packOvervoltage: z.number().min(48).max(60),
  packUndervoltage: z.number().min(40).max(50),

  // Temperature Protection
  chargeOvertemp: z.number().min(35).max(60),
  chargeOvertempRelease: z.number().min(30).max(55),
  dischargeOvertemp: z.number().min(40).max(70),
  dischargeOvertempRelease: z.number().min(35).max(65),
  chargeUndertemp: z.number().min(-20).max(10),
  chargeUndertempRelease: z.number().min(-15).max(15),
  dischargeUndertemp: z.number().min(-30).max(0),
  dischargeUndertempRelease: z.number().min(-25).max(5),

  // Current Protection
  chargeOvercurrent: z.number().min(10).max(200),
  chargeOvercurrentDelay: z.number().min(1).max(120),
  dischargeOvercurrent: z.number().min(10).max(300),
  dischargeOvercurrentDelay: z.number().min(1).max(120),
  shortCircuitCurrent: z.number().min(100).max(1000),
  shortCircuitDelay: z.number().min(100).max(1000),

  // Balancing
  balanceStartVoltage: z.number().min(3.3).max(3.5),
  balanceDeltaVoltage: z.number().min(0.005).max(0.1),
  balanceMinSOC: z.number().min(20).max(80),

  // SOC Settings
  socFullCharge: z.number().min(95).max(100),
  socLowWarning: z.number().min(10).max(30),
  socCritical: z.number().min(5).max(15),

  // Communication
  canBaudRate: z.enum(['125', '250', '500', '1000']),
  modbusAddress: z.number().min(1).max(247),
  modbusProtocol: z.enum(['RTU', 'TCP']),
}).refine(
  data => data.cellOvervoltageRelease < data.cellOvervoltage,
  { message: 'Liberacao de sobretensao deve ser menor que limite', path: ['cellOvervoltageRelease'] }
).refine(
  data => data.cellUndervoltageRelease > data.cellUndervoltage,
  { message: 'Liberacao de subtensao deve ser maior que limite', path: ['cellUndervoltageRelease'] }
).refine(
  data => data.chargeOvertempRelease < data.chargeOvertemp,
  { message: 'Liberacao deve ser menor que limite', path: ['chargeOvertempRelease'] }
).refine(
  data => data.dischargeOvertempRelease < data.dischargeOvertemp,
  { message: 'Liberacao deve ser menor que limite', path: ['dischargeOvertempRelease'] }
).refine(
  data => data.chargeUndertempRelease > data.chargeUndertemp,
  { message: 'Liberacao deve ser maior que limite', path: ['chargeUndertempRelease'] }
).refine(
  data => data.dischargeUndertempRelease > data.dischargeUndertemp,
  { message: 'Liberacao deve ser maior que limite', path: ['dischargeUndertempRelease'] }
);

type BMSConfigFormData = z.infer<typeof bmsConfigSchema>;

// Default LiFePO4 Parameters
const DEFAULT_LIFEPO4_PARAMS: BMSConfigFormData = {
  cellOvervoltage: 3.65,
  cellOvervoltageRelease: 3.55,
  cellOvervoltageDelay: 5,
  cellUndervoltage: 2.5,
  cellUndervoltageRelease: 2.8,
  cellUndervoltageDelay: 5,
  packOvervoltage: 58.4,
  packUndervoltage: 40,

  chargeOvertemp: 45,
  chargeOvertempRelease: 40,
  dischargeOvertemp: 55,
  dischargeOvertempRelease: 50,
  chargeUndertemp: 0,
  chargeUndertempRelease: 5,
  dischargeUndertemp: -20,
  dischargeUndertempRelease: -15,

  chargeOvercurrent: 100,
  chargeOvercurrentDelay: 10,
  dischargeOvercurrent: 150,
  dischargeOvercurrentDelay: 10,
  shortCircuitCurrent: 500,
  shortCircuitDelay: 200,

  balanceStartVoltage: 3.4,
  balanceDeltaVoltage: 0.02,
  balanceMinSOC: 50,

  socFullCharge: 100,
  socLowWarning: 20,
  socCritical: 10,

  canBaudRate: '500',
  modbusAddress: 1,
  modbusProtocol: 'RTU',
};

interface ParameterGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  parameters: ParameterDef[];
}

interface ParameterDef {
  key: keyof BMSConfigFormData;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  type: 'number' | 'select';
  options?: { value: string; label: string }[];
  description?: string;
  dependency?: {
    field: keyof BMSConfigFormData;
    relation: 'lt' | 'gt' | 'lte' | 'gte';
    message: string;
  };
  dangerous?: boolean;
}

const PARAMETER_GROUPS: ParameterGroup[] = [
  {
    id: 'voltage',
    title: 'Protecao de Tensao',
    icon: Zap,
    color: 'text-warning-500',
    parameters: [
      { key: 'cellOvervoltage', label: 'Sobretensao Celula', unit: 'V', min: 3.4, max: 3.8, step: 0.01, type: 'number', description: 'Tensao maxima permitida por celula', dangerous: true },
      { key: 'cellOvervoltageRelease', label: 'Liberacao Sobretensao', unit: 'V', min: 3.3, max: 3.7, step: 0.01, type: 'number', dependency: { field: 'cellOvervoltage', relation: 'lt', message: 'Deve ser menor que sobretensao' } },
      { key: 'cellOvervoltageDelay', label: 'Atraso Sobretensao', unit: 's', min: 1, max: 60, step: 1, type: 'number' },
      { key: 'cellUndervoltage', label: 'Subtensao Celula', unit: 'V', min: 2.0, max: 3.0, step: 0.01, type: 'number', description: 'Tensao minima permitida por celula', dangerous: true },
      { key: 'cellUndervoltageRelease', label: 'Liberacao Subtensao', unit: 'V', min: 2.2, max: 3.2, step: 0.01, type: 'number', dependency: { field: 'cellUndervoltage', relation: 'gt', message: 'Deve ser maior que subtensao' } },
      { key: 'cellUndervoltageDelay', label: 'Atraso Subtensao', unit: 's', min: 1, max: 60, step: 1, type: 'number' },
      { key: 'packOvervoltage', label: 'Sobretensao Pack', unit: 'V', min: 48, max: 60, step: 0.1, type: 'number' },
      { key: 'packUndervoltage', label: 'Subtensao Pack', unit: 'V', min: 40, max: 50, step: 0.1, type: 'number' },
    ],
  },
  {
    id: 'temperature',
    title: 'Protecao de Temperatura',
    icon: Thermometer,
    color: 'text-danger-500',
    parameters: [
      { key: 'chargeOvertemp', label: 'Sobretemperatura Carga', unit: 'C', min: 35, max: 60, step: 1, type: 'number', dangerous: true },
      { key: 'chargeOvertempRelease', label: 'Liberacao Sobretemp. Carga', unit: 'C', min: 30, max: 55, step: 1, type: 'number', dependency: { field: 'chargeOvertemp', relation: 'lt', message: 'Deve ser menor' } },
      { key: 'dischargeOvertemp', label: 'Sobretemperatura Descarga', unit: 'C', min: 40, max: 70, step: 1, type: 'number', dangerous: true },
      { key: 'dischargeOvertempRelease', label: 'Liberacao Sobretemp. Descarga', unit: 'C', min: 35, max: 65, step: 1, type: 'number', dependency: { field: 'dischargeOvertemp', relation: 'lt', message: 'Deve ser menor' } },
      { key: 'chargeUndertemp', label: 'Subtemperatura Carga', unit: 'C', min: -20, max: 10, step: 1, type: 'number' },
      { key: 'chargeUndertempRelease', label: 'Liberacao Subtemp. Carga', unit: 'C', min: -15, max: 15, step: 1, type: 'number', dependency: { field: 'chargeUndertemp', relation: 'gt', message: 'Deve ser maior' } },
      { key: 'dischargeUndertemp', label: 'Subtemperatura Descarga', unit: 'C', min: -30, max: 0, step: 1, type: 'number' },
      { key: 'dischargeUndertempRelease', label: 'Liberacao Subtemp. Descarga', unit: 'C', min: -25, max: 5, step: 1, type: 'number', dependency: { field: 'dischargeUndertemp', relation: 'gt', message: 'Deve ser maior' } },
    ],
  },
  {
    id: 'current',
    title: 'Protecao de Corrente',
    icon: Zap,
    color: 'text-primary',
    parameters: [
      { key: 'chargeOvercurrent', label: 'Sobrecorrente Carga', unit: 'A', min: 10, max: 200, step: 1, type: 'number', dangerous: true },
      { key: 'chargeOvercurrentDelay', label: 'Atraso Sobrecorrente Carga', unit: 's', min: 1, max: 120, step: 1, type: 'number' },
      { key: 'dischargeOvercurrent', label: 'Sobrecorrente Descarga', unit: 'A', min: 10, max: 300, step: 1, type: 'number', dangerous: true },
      { key: 'dischargeOvercurrentDelay', label: 'Atraso Sobrecorrente Descarga', unit: 's', min: 1, max: 120, step: 1, type: 'number' },
      { key: 'shortCircuitCurrent', label: 'Corrente Curto-Circuito', unit: 'A', min: 100, max: 1000, step: 10, type: 'number', description: 'Corrente que dispara protecao de curto', dangerous: true },
      { key: 'shortCircuitDelay', label: 'Atraso Curto-Circuito', unit: 'us', min: 100, max: 1000, step: 50, type: 'number' },
    ],
  },
  {
    id: 'balancing',
    title: 'Balanceamento',
    icon: Sliders,
    color: 'text-secondary',
    parameters: [
      { key: 'balanceStartVoltage', label: 'Tensao Inicio Balanceamento', unit: 'V', min: 3.3, max: 3.5, step: 0.01, type: 'number', description: 'Tensao minima para iniciar balanceamento' },
      { key: 'balanceDeltaVoltage', label: 'Delta Balanceamento', unit: 'V', min: 0.005, max: 0.1, step: 0.001, type: 'number', description: 'Diferenca minima para balancear' },
      { key: 'balanceMinSOC', label: 'SOC Minimo Balanceamento', unit: '%', min: 20, max: 80, step: 5, type: 'number' },
    ],
  },
  {
    id: 'soc',
    title: 'Configuracoes de SOC',
    icon: Battery,
    color: 'text-success-500',
    parameters: [
      { key: 'socFullCharge', label: 'SOC Carga Completa', unit: '%', min: 95, max: 100, step: 1, type: 'number' },
      { key: 'socLowWarning', label: 'SOC Alerta Baixo', unit: '%', min: 10, max: 30, step: 1, type: 'number' },
      { key: 'socCritical', label: 'SOC Critico', unit: '%', min: 5, max: 15, step: 1, type: 'number' },
    ],
  },
  {
    id: 'communication',
    title: 'Comunicacao',
    icon: Shield,
    color: 'text-foreground-muted',
    parameters: [
      { key: 'canBaudRate', label: 'Baud Rate CAN', type: 'select', options: [
        { value: '125', label: '125 kbps' },
        { value: '250', label: '250 kbps' },
        { value: '500', label: '500 kbps' },
        { value: '1000', label: '1 Mbps' },
      ]},
      { key: 'modbusAddress', label: 'Endereco Modbus', min: 1, max: 247, step: 1, type: 'number' },
      { key: 'modbusProtocol', label: 'Protocolo Modbus', type: 'select', options: [
        { value: 'RTU', label: 'RTU' },
        { value: 'TCP', label: 'TCP' },
      ]},
    ],
  },
];

export default function BMSConfig() {
  const { systemId } = useParams<{ systemId: string }>();
  const [system, setSystem] = useState<BessSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['voltage']);
  const [isLocked, setIsLocked] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<BMSConfigFormData>({
    resolver: zodResolver(bmsConfigSchema),
    defaultValues: DEFAULT_LIFEPO4_PARAMS,
  });

  const watchedValues = watch();

  // Fetch system data
  useEffect(() => {
    const fetchSystem = async () => {
      if (!systemId) return;
      try {
        setIsLoading(true);
        const res = await systemsApi.getById(systemId);
        setSystem(res.data.data);
        // In real implementation, load actual BMS config
        reset(DEFAULT_LIFEPO4_PARAMS);
      } catch (err) {
        setError('Falha ao carregar dados do sistema');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystem();
  }, [systemId, reset]);

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };

  // Check dependency validation
  const checkDependency = (param: ParameterDef): { valid: boolean; message?: string } => {
    if (!param.dependency) return { valid: true };

    const currentValue = watchedValues[param.key];
    const dependentValue = watchedValues[param.dependency.field];

    if (typeof currentValue !== 'number' || typeof dependentValue !== 'number') {
      return { valid: true };
    }

    switch (param.dependency.relation) {
      case 'lt':
        return {
          valid: currentValue < dependentValue,
          message: param.dependency.message,
        };
      case 'gt':
        return {
          valid: currentValue > dependentValue,
          message: param.dependency.message,
        };
      case 'lte':
        return {
          valid: currentValue <= dependentValue,
          message: param.dependency.message,
        };
      case 'gte':
        return {
          valid: currentValue >= dependentValue,
          message: param.dependency.message,
        };
      default:
        return { valid: true };
    }
  };

  // Count validation issues
  const validationIssues = useMemo(() => {
    let count = 0;
    PARAMETER_GROUPS.forEach(group => {
      group.parameters.forEach(param => {
        const dep = checkDependency(param);
        if (!dep.valid) count++;
        if (errors[param.key]) count++;
      });
    });
    return count;
  }, [watchedValues, errors]);

  // Handle form submit
  const onSubmit = async (data: BMSConfigFormData) => {
    if (isLocked) {
      alert('Desbloqueie os parametros para salvar alteracoes');
      return;
    }

    if (validationIssues > 0) {
      alert('Corrija os problemas de validacao antes de salvar');
      return;
    }

    try {
      setIsSaving(true);
      // In real implementation, save to backend
      console.log('Saving BMS config:', data);
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Configuracoes salvas com sucesso!');
    } catch (err) {
      console.error('Failed to save BMS config:', err);
      alert('Falha ao salvar configuracoes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !system) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Sistema nao encontrado'}
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
            <h1 className="text-2xl font-bold text-foreground">Configuracao BMS</h1>
            <p className="text-foreground-muted text-sm">{system.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Historico de alteracoes"
          >
            <History className="w-5 h-5 text-foreground-muted" />
          </button>
          <button
            onClick={() => reset(DEFAULT_LIFEPO4_PARAMS)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Restaurar padrao"
          >
            <RefreshCw className="w-5 h-5 text-foreground-muted" />
          </button>
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              isLocked
                ? 'bg-surface-hover text-foreground-muted hover:bg-surface-active'
                : 'bg-warning-500 text-white hover:bg-warning-600'
            )}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Desbloquear' : 'Bloqueado'}
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving || isLocked || !isDirty || validationIssues > 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Validation Warning */}
      {validationIssues > 0 && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0" />
          <div>
            <p className="font-medium text-danger-500">
              {validationIssues} problema(s) de validacao encontrado(s)
            </p>
            <p className="text-sm text-foreground-muted">
              Corrija os erros antes de salvar as configuracoes
            </p>
          </div>
        </div>
      )}

      {/* Lock Warning */}
      {!isLocked && (
        <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 flex items-center gap-3">
          <Unlock className="w-5 h-5 text-warning-500 shrink-0" />
          <div>
            <p className="font-medium text-warning-500">
              Modo de edicao ativo
            </p>
            <p className="text-sm text-foreground-muted">
              Cuidado ao modificar parametros de protecao. Valores incorretos podem danificar a bateria.
            </p>
          </div>
        </div>
      )}

      {/* Parameter Groups */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {PARAMETER_GROUPS.map(group => {
          const Icon = group.icon;
          const isExpanded = expandedGroups.includes(group.id);
          const groupErrors = group.parameters.filter(p =>
            errors[p.key] || !checkDependency(p).valid
          ).length;

          return (
            <div
              key={group.id}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-background', group.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{group.title}</h3>
                  {groupErrors > 0 && (
                    <span className="px-2 py-0.5 bg-danger-500/20 text-danger-500 text-xs font-medium rounded-full">
                      {groupErrors} erro(s)
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-foreground-muted" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-foreground-muted" />
                )}
              </button>

              {isExpanded && (
                <div className="p-4 pt-0 border-t border-border">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.parameters.map(param => {
                      const depCheck = checkDependency(param);
                      const hasError = errors[param.key] || !depCheck.valid;
                      const isModified = dirtyFields[param.key];

                      return (
                        <div
                          key={param.key}
                          className={cn(
                            'p-3 rounded-lg border transition-colors',
                            hasError
                              ? 'border-danger-500/50 bg-danger-500/5'
                              : isModified
                              ? 'border-warning-500/50 bg-warning-500/5'
                              : 'border-border bg-background'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <label className="text-sm font-medium text-foreground">
                              {param.label}
                              {param.dangerous && (
                                <AlertTriangle className="w-3 h-3 text-danger-500 inline ml-1" />
                              )}
                            </label>
                            {param.description && (
                              <div className="group relative">
                                <Info className="w-4 h-4 text-foreground-subtle cursor-help" />
                                <div className="absolute right-0 top-6 w-48 p-2 bg-surface border border-border rounded-lg shadow-lg text-xs text-foreground-muted hidden group-hover:block z-10">
                                  {param.description}
                                </div>
                              </div>
                            )}
                          </div>

                          <Controller
                            name={param.key}
                            control={control}
                            render={({ field }) => (
                              param.type === 'select' ? (
                                <select
                                  {...field}
                                  disabled={isLocked}
                                  className={cn(
                                    'w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                                    isLocked && 'opacity-50 cursor-not-allowed'
                                  )}
                                >
                                  {param.options?.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    {...field}
                                    type="number"
                                    min={param.min}
                                    max={param.max}
                                    step={param.step}
                                    disabled={isLocked}
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    className={cn(
                                      'flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                                      isLocked && 'opacity-50 cursor-not-allowed'
                                    )}
                                  />
                                  {param.unit && (
                                    <span className="text-sm text-foreground-muted min-w-[2rem]">
                                      {param.unit}
                                    </span>
                                  )}
                                </div>
                              )
                            )}
                          />

                          {/* Error messages */}
                          {errors[param.key] && (
                            <p className="mt-1 text-xs text-danger-500">
                              {errors[param.key]?.message}
                            </p>
                          )}
                          {!depCheck.valid && (
                            <p className="mt-1 text-xs text-danger-500">
                              {depCheck.message}
                            </p>
                          )}

                          {/* Range hint */}
                          {param.min !== undefined && param.max !== undefined && (
                            <p className="mt-1 text-2xs text-foreground-subtle">
                              Faixa: {param.min} - {param.max} {param.unit}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </form>

      {/* History Panel */}
      {showHistory && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-4">Historico de Alteracoes</h3>
          <div className="space-y-2 text-sm text-foreground-muted">
            <p>2024-01-25 14:30 - Parametros de tensao atualizados por Admin</p>
            <p>2024-01-24 10:15 - Configuracao inicial carregada</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-5 w-32 bg-surface rounded animate-pulse" />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
      ))}
    </div>
  );
}
