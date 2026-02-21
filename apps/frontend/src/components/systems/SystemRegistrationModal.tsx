/**
 * System Registration Modal
 * Complete multi-step wizard for registering a new BESS system
 * with all technical specifications
 */

import { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Battery,
  Cpu,
  Zap,
  Shield,
  MapPin,
  Settings,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SystemFormData) => void;
}

export interface SystemFormData {
  // Step 1: Basic Info
  name: string;
  description: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  installationDate: string;
  commissioningDate: string;

  // Step 2: Battery Configuration
  batteryChemistry: string;
  cellManufacturer: string;
  cellModel: string;
  nominalCellVoltage: number;
  maxCellVoltage: number;
  minCellVoltage: number;
  cellCapacityAh: number;
  cellInternalResistance: number; // mOhm

  // Step 3: Pack/Module Configuration
  cellsInSeries: number;
  cellsInParallel: number;
  modulesPerRack: number;
  racksInSystem: number;
  totalCapacityKwh: number;
  nominalVoltage: number;
  maxVoltage: number;
  minVoltage: number;

  // Step 4: BMS Configuration
  bmsManufacturer: string;
  bmsModel: string;
  bmsProtocol: string;
  bmsAddress: string;
  bmsPort: number;
  balancingType: string;
  balancingCurrent: number; // mA

  // Step 5: Inverter/PCS Configuration
  inverterManufacturer: string;
  inverterModel: string;
  inverterPowerKw: number;
  inverterPhases: number;
  inverterProtocol: string;
  inverterAddress: string;
  acVoltage: number;
  acFrequency: number;

  // Step 6: Protection Settings
  overVoltageProtection: number;
  underVoltageProtection: number;
  overCurrentCharge: number;
  overCurrentDischarge: number;
  overTempCharge: number;
  overTempDischarge: number;
  underTempCharge: number;
  underTempDischarge: number;
  maxSoc: number;
  minSoc: number;
}

const BATTERY_CHEMISTRIES = [
  { value: 'LFP', label: 'LiFePO4 (LFP)', description: 'Fosfato de Ferro Litio - Seguro e duravel' },
  { value: 'NMC', label: 'NMC', description: 'Niquel Manganes Cobalto - Alta densidade' },
  { value: 'NCA', label: 'NCA', description: 'Niquel Cobalto Aluminio - Alta energia' },
  { value: 'LTO', label: 'LTO', description: 'Titanato de Litio - Carga ultra-rapida' },
  { value: 'LCO', label: 'LCO', description: 'Oxido de Cobalto Litio' },
  { value: 'LMO', label: 'LMO', description: 'Oxido de Manganes Litio' },
];

const CELL_MANUFACTURERS = [
  'CATL', 'BYD', 'EVE Energy', 'CALB', 'Gotion', 'Lishen', 'Ganfeng', 'Farasis',
  'Samsung SDI', 'LG Energy', 'Panasonic', 'SK On', 'SVOLT', 'Outro'
];

const BMS_MANUFACTURERS = [
  'Daly', 'JBD', 'ANT', 'Seplos', 'Batrium', 'Orion', 'REC',
  'Victron', 'SMA', 'Studer', 'Outro'
];

const INVERTER_MANUFACTURERS = [
  'SMA', 'Fronius', 'Huawei', 'Sungrow', 'Growatt', 'Goodwe', 'Deye',
  'Victron', 'Schneider', 'ABB', 'Siemens', 'Outro'
];

const BMS_PROTOCOLS = [
  { value: 'modbus_rtu', label: 'Modbus RTU' },
  { value: 'modbus_tcp', label: 'Modbus TCP' },
  { value: 'canbus', label: 'CAN Bus' },
  { value: 'rs485', label: 'RS-485' },
  { value: 'uart', label: 'UART/Serial' },
];

const BALANCING_TYPES = [
  { value: 'passive', label: 'Passivo', description: 'Dissipa energia em resistores' },
  { value: 'active', label: 'Ativo', description: 'Transfere energia entre celulas' },
  { value: 'none', label: 'Nenhum', description: 'Sem balanceamento integrado' },
];

const STEPS = [
  { id: 1, title: 'Informacoes Basicas', icon: Info },
  { id: 2, title: 'Celulas/Quimica', icon: Battery },
  { id: 3, title: 'Configuracao Pack', icon: Settings },
  { id: 4, title: 'BMS', icon: Cpu },
  { id: 5, title: 'Inversor/PCS', icon: Zap },
  { id: 6, title: 'Protecoes', icon: Shield },
];

const initialFormData: SystemFormData = {
  // Step 1
  name: '',
  description: '',
  location: {
    address: '',
    city: '',
    state: '',
    country: 'Brasil',
    latitude: 0,
    longitude: 0,
  },
  installationDate: '',
  commissioningDate: '',

  // Step 2
  batteryChemistry: 'LFP',
  cellManufacturer: '',
  cellModel: '',
  nominalCellVoltage: 3.2,
  maxCellVoltage: 3.65,
  minCellVoltage: 2.5,
  cellCapacityAh: 280,
  cellInternalResistance: 0.3,

  // Step 3
  cellsInSeries: 16,
  cellsInParallel: 1,
  modulesPerRack: 1,
  racksInSystem: 1,
  totalCapacityKwh: 0,
  nominalVoltage: 51.2,
  maxVoltage: 58.4,
  minVoltage: 40,

  // Step 4
  bmsManufacturer: '',
  bmsModel: '',
  bmsProtocol: 'modbus_rtu',
  bmsAddress: '/dev/ttyUSB0',
  bmsPort: 1,
  balancingType: 'passive',
  balancingCurrent: 60,

  // Step 5
  inverterManufacturer: '',
  inverterModel: '',
  inverterPowerKw: 5,
  inverterPhases: 1,
  inverterProtocol: 'modbus_tcp',
  inverterAddress: '192.168.1.100',
  acVoltage: 220,
  acFrequency: 60,

  // Step 6
  overVoltageProtection: 3.65,
  underVoltageProtection: 2.5,
  overCurrentCharge: 100,
  overCurrentDischarge: 100,
  overTempCharge: 45,
  overTempDischarge: 55,
  underTempCharge: 0,
  underTempDischarge: -10,
  maxSoc: 100,
  minSoc: 10,
};

export default function SystemRegistrationModal({
  isOpen,
  onClose,
  onSubmit,
}: SystemRegistrationModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SystemFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const updateField = (field: string, value: any) => {
    setFormData((prev) => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      // Handle nested fields like location.city
      const newData = { ...prev };
      let current: any = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  // Auto-calculate derived values
  const calculateDerivedValues = () => {
    const cellsTotal = formData.cellsInSeries * formData.cellsInParallel *
                       formData.modulesPerRack * formData.racksInSystem;
    const nominalVoltage = formData.cellsInSeries * formData.nominalCellVoltage;
    const maxVoltage = formData.cellsInSeries * formData.maxCellVoltage;
    const minVoltage = formData.cellsInSeries * formData.minCellVoltage;
    const totalCapacityAh = formData.cellCapacityAh * formData.cellsInParallel *
                            formData.modulesPerRack * formData.racksInSystem;
    const totalCapacityKwh = (nominalVoltage * totalCapacityAh) / 1000;

    setFormData((prev) => ({
      ...prev,
      nominalVoltage: Math.round(nominalVoltage * 10) / 10,
      maxVoltage: Math.round(maxVoltage * 10) / 10,
      minVoltage: Math.round(minVoltage * 10) / 10,
      totalCapacityKwh: Math.round(totalCapacityKwh * 10) / 10,
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.name.trim()) newErrors.name = 'Nome e obrigatorio';
        if (!formData.location.city.trim()) newErrors['location.city'] = 'Cidade e obrigatoria';
        break;
      case 2:
        if (!formData.cellManufacturer) newErrors.cellManufacturer = 'Fabricante e obrigatorio';
        if (formData.cellCapacityAh <= 0) newErrors.cellCapacityAh = 'Capacidade invalida';
        break;
      case 3:
        if (formData.cellsInSeries < 1) newErrors.cellsInSeries = 'Minimo 1 celula';
        break;
      case 4:
        if (!formData.bmsManufacturer) newErrors.bmsManufacturer = 'Fabricante BMS obrigatorio';
        break;
      case 5:
        if (!formData.inverterManufacturer) newErrors.inverterManufacturer = 'Fabricante obrigatorio';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 3) {
        calculateDerivedValues();
      }
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      onSubmit(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Cadastrar Novo Sistema BESS</h2>
            <p className="text-sm text-foreground-muted">
              Passo {currentStep} de {STEPS.length}: {STEPS[currentStep - 1].title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface-hover/50 border-b border-border overflow-x-auto">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                    isCurrent && 'bg-primary text-white',
                    isCompleted && 'bg-success-500/20 text-success-500 cursor-pointer',
                    !isCurrent && !isCompleted && 'text-foreground-muted'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    isCurrent && 'bg-white/20',
                    isCompleted && 'bg-success-500/20',
                    !isCurrent && !isCompleted && 'bg-surface-hover'
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <span className="hidden md:inline text-sm font-medium whitespace-nowrap">
                    {step.title}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    'w-8 h-0.5 mx-2',
                    isCompleted ? 'bg-success-500' : 'bg-border'
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && (
            <Step1BasicInfo formData={formData} updateField={updateField} errors={errors} />
          )}
          {currentStep === 2 && (
            <Step2CellChemistry formData={formData} updateField={updateField} errors={errors} />
          )}
          {currentStep === 3 && (
            <Step3PackConfig formData={formData} updateField={updateField} errors={errors} />
          )}
          {currentStep === 4 && (
            <Step4BMSConfig formData={formData} updateField={updateField} errors={errors} />
          )}
          {currentStep === 5 && (
            <Step5InverterConfig formData={formData} updateField={updateField} errors={errors} />
          )}
          {currentStep === 6 && (
            <Step6ProtectionSettings formData={formData} updateField={updateField} errors={errors} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-surface-hover/50">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              currentStep === 1
                ? 'text-foreground-muted cursor-not-allowed'
                : 'text-foreground hover:bg-surface-hover'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-surface-hover transition-colors"
            >
              Cancelar
            </button>
            {currentStep < STEPS.length ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                Proximo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Cadastrar Sistema
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 1: Basic Information
function Step1BasicInfo({ formData, updateField, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Nome do Sistema *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Ex: BESS Unidade Industrial 01"
            className={cn(
              'w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
              errors.name ? 'border-danger-500' : 'border-border'
            )}
          />
          {errors.name && <p className="text-danger-500 text-xs mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Data de Instalacao
          </label>
          <input
            type="date"
            value={formData.installationDate}
            onChange={(e) => updateField('installationDate', e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Descricao
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          placeholder="Descricao detalhada do sistema e sua aplicacao..."
          className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">Localizacao</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Endereco</label>
            <input
              type="text"
              value={formData.location.address}
              onChange={(e) => updateField('location.address', e.target.value)}
              placeholder="Rua, numero, complemento"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Cidade *</label>
            <input
              type="text"
              value={formData.location.city}
              onChange={(e) => updateField('location.city', e.target.value)}
              placeholder="Teresina"
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary',
                errors['location.city'] ? 'border-danger-500' : 'border-border'
              )}
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Estado</label>
            <input
              type="text"
              value={formData.location.state}
              onChange={(e) => updateField('location.state', e.target.value)}
              placeholder="PI"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Pais</label>
            <input
              type="text"
              value={formData.location.country}
              onChange={(e) => updateField('location.country', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={formData.location.latitude}
              onChange={(e) => updateField('location.latitude', parseFloat(e.target.value))}
              placeholder="-5.0892"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={formData.location.longitude}
              onChange={(e) => updateField('location.longitude', parseFloat(e.target.value))}
              placeholder="-42.8019"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 2: Cell/Chemistry Configuration
function Step2CellChemistry({ formData, updateField, errors }: StepProps) {
  return (
    <div className="space-y-6">
      {/* Chemistry Selection */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Quimica da Bateria *
        </label>
        <div className="grid md:grid-cols-3 gap-3">
          {BATTERY_CHEMISTRIES.map((chem) => (
            <button
              key={chem.value}
              onClick={() => {
                updateField('batteryChemistry', chem.value);
                // Auto-fill typical values for chemistry
                if (chem.value === 'LFP') {
                  updateField('nominalCellVoltage', 3.2);
                  updateField('maxCellVoltage', 3.65);
                  updateField('minCellVoltage', 2.5);
                } else if (chem.value === 'NMC' || chem.value === 'NCA') {
                  updateField('nominalCellVoltage', 3.7);
                  updateField('maxCellVoltage', 4.2);
                  updateField('minCellVoltage', 3.0);
                } else if (chem.value === 'LTO') {
                  updateField('nominalCellVoltage', 2.4);
                  updateField('maxCellVoltage', 2.8);
                  updateField('minCellVoltage', 1.8);
                }
              }}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all',
                formData.batteryChemistry === chem.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="font-medium text-foreground">{chem.label}</div>
              <div className="text-xs text-foreground-muted mt-1">{chem.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cell Manufacturer */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Fabricante da Celula *
          </label>
          <select
            value={formData.cellManufacturer}
            onChange={(e) => updateField('cellManufacturer', e.target.value)}
            className={cn(
              'w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
              errors.cellManufacturer ? 'border-danger-500' : 'border-border'
            )}
          >
            <option value="">Selecione...</option>
            {CELL_MANUFACTURERS.map((mfr) => (
              <option key={mfr} value={mfr}>{mfr}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Modelo da Celula
          </label>
          <input
            type="text"
            value={formData.cellModel}
            onChange={(e) => updateField('cellModel', e.target.value)}
            placeholder="Ex: EVE LF280K"
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Cell Specifications */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Battery className="w-4 h-4 text-primary" />
          Especificacoes da Celula
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Capacidade (Ah) *</label>
            <input
              type="number"
              value={formData.cellCapacityAh}
              onChange={(e) => updateField('cellCapacityAh', parseFloat(e.target.value))}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                errors.cellCapacityAh ? 'border-danger-500' : 'border-border'
              )}
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Tensao Nominal (V)</label>
            <input
              type="number"
              step="0.01"
              value={formData.nominalCellVoltage}
              onChange={(e) => updateField('nominalCellVoltage', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Tensao Max (V)</label>
            <input
              type="number"
              step="0.01"
              value={formData.maxCellVoltage}
              onChange={(e) => updateField('maxCellVoltage', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Tensao Min (V)</label>
            <input
              type="number"
              step="0.01"
              value={formData.minCellVoltage}
              onChange={(e) => updateField('minCellVoltage', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Resist. Interna (mOhm)</label>
            <input
              type="number"
              step="0.01"
              value={formData.cellInternalResistance}
              onChange={(e) => updateField('cellInternalResistance', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-foreground-muted">
          <p className="font-medium text-blue-400 mb-1">Dica para LiFePO4:</p>
          <p>Celulas LFP tipicas operam entre 2.5V e 3.65V, com tensao nominal de 3.2V.
             A maioria das celulas prismaticas (280Ah, 304Ah) tem resistencia interna entre 0.2-0.4 mOhm.</p>
        </div>
      </div>
    </div>
  );
}

// Step 3: Pack/Module Configuration
function Step3PackConfig({ formData, updateField, errors }: StepProps) {
  const cellsTotal = formData.cellsInSeries * formData.cellsInParallel *
                     formData.modulesPerRack * formData.racksInSystem;
  const nominalVoltage = formData.cellsInSeries * formData.nominalCellVoltage;
  const totalCapacityAh = formData.cellCapacityAh * formData.cellsInParallel *
                          formData.modulesPerRack * formData.racksInSystem;
  const totalCapacityKwh = (nominalVoltage * totalCapacityAh) / 1000;

  return (
    <div className="space-y-6">
      {/* Configuration Inputs */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 bg-surface-hover rounded-lg border border-border">
          <h4 className="font-medium text-foreground mb-4">Configuracao do String</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-foreground-muted mb-1">Celulas em Serie *</label>
              <input
                type="number"
                min={1}
                value={formData.cellsInSeries}
                onChange={(e) => updateField('cellsInSeries', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Determina a tensao do pack
              </p>
            </div>
            <div>
              <label className="block text-xs text-foreground-muted mb-1">Celulas em Paralelo</label>
              <input
                type="number"
                min={1}
                value={formData.cellsInParallel}
                onChange={(e) => updateField('cellsInParallel', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Aumenta a capacidade (Ah)
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface-hover rounded-lg border border-border">
          <h4 className="font-medium text-foreground mb-4">Configuracao do Sistema</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-foreground-muted mb-1">Modulos por Rack</label>
              <input
                type="number"
                min={1}
                value={formData.modulesPerRack}
                onChange={(e) => updateField('modulesPerRack', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground-muted mb-1">Racks no Sistema</label>
              <input
                type="number"
                min={1}
                value={formData.racksInSystem}
                onChange={(e) => updateField('racksInSystem', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calculated Summary */}
      <div className="p-6 bg-primary/10 border border-primary/30 rounded-lg">
        <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Resumo Calculado
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-primary">{cellsTotal}</div>
            <div className="text-xs text-foreground-muted mt-1">Celulas Totais</div>
          </div>
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-green-400">{nominalVoltage.toFixed(1)}V</div>
            <div className="text-xs text-foreground-muted mt-1">Tensao Nominal</div>
          </div>
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-blue-400">{totalCapacityAh.toFixed(0)} Ah</div>
            <div className="text-xs text-foreground-muted mt-1">Capacidade Total</div>
          </div>
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-yellow-400">{totalCapacityKwh.toFixed(1)} kWh</div>
            <div className="text-xs text-foreground-muted mt-1">Energia Total</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-primary/20 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground-muted">Tensao Maxima:</span>
            <span className="text-foreground font-medium">
              {(formData.cellsInSeries * formData.maxCellVoltage).toFixed(1)}V
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Tensao Minima:</span>
            <span className="text-foreground font-medium">
              {(formData.cellsInSeries * formData.minCellVoltage).toFixed(1)}V
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Configuracao:</span>
            <span className="text-foreground font-medium">
              {formData.cellsInSeries}S{formData.cellsInParallel}P
            </span>
          </div>
        </div>
      </div>

      {/* Common configurations */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Configuracoes Comuns
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { s: 16, p: 1, label: '16S1P (48V)' },
            { s: 15, p: 1, label: '15S1P (48V)' },
            { s: 8, p: 1, label: '8S1P (24V)' },
            { s: 4, p: 1, label: '4S1P (12V)' },
            { s: 16, p: 2, label: '16S2P (48V 2x)' },
            { s: 32, p: 1, label: '32S1P (96V)' },
          ].map((config) => (
            <button
              key={config.label}
              onClick={() => {
                updateField('cellsInSeries', config.s);
                updateField('cellsInParallel', config.p);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                formData.cellsInSeries === config.s && formData.cellsInParallel === config.p
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-foreground-muted hover:text-foreground'
              )}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 4: BMS Configuration
function Step4BMSConfig({ formData, updateField, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Fabricante do BMS *
          </label>
          <select
            value={formData.bmsManufacturer}
            onChange={(e) => updateField('bmsManufacturer', e.target.value)}
            className={cn(
              'w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
              errors.bmsManufacturer ? 'border-danger-500' : 'border-border'
            )}
          >
            <option value="">Selecione...</option>
            {BMS_MANUFACTURERS.map((mfr) => (
              <option key={mfr} value={mfr}>{mfr}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Modelo do BMS
          </label>
          <input
            type="text"
            value={formData.bmsModel}
            onChange={(e) => updateField('bmsModel', e.target.value)}
            placeholder="Ex: Daly Smart BMS 16S 200A"
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Communication Settings */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          Comunicacao
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Protocolo</label>
            <select
              value={formData.bmsProtocol}
              onChange={(e) => updateField('bmsProtocol', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {BMS_PROTOCOLS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">
              {formData.bmsProtocol === 'modbus_tcp' ? 'Endereco IP' : 'Porta Serial'}
            </label>
            <input
              type="text"
              value={formData.bmsAddress}
              onChange={(e) => updateField('bmsAddress', e.target.value)}
              placeholder={formData.bmsProtocol === 'modbus_tcp' ? '192.168.1.100' : '/dev/ttyUSB0'}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">
              {formData.bmsProtocol === 'modbus_tcp' ? 'Porta TCP' : 'Slave ID'}
            </label>
            <input
              type="number"
              value={formData.bmsPort}
              onChange={(e) => updateField('bmsPort', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Balancing */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Tipo de Balanceamento
        </label>
        <div className="grid md:grid-cols-3 gap-3">
          {BALANCING_TYPES.map((bal) => (
            <button
              key={bal.value}
              onClick={() => updateField('balancingType', bal.value)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all',
                formData.balancingType === bal.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="font-medium text-foreground">{bal.label}</div>
              <div className="text-xs text-foreground-muted mt-1">{bal.description}</div>
            </button>
          ))}
        </div>
      </div>

      {formData.balancingType !== 'none' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Corrente de Balanceamento (mA)
          </label>
          <input
            type="number"
            value={formData.balancingCurrent}
            onChange={(e) => updateField('balancingCurrent', parseInt(e.target.value))}
            className="w-full max-w-xs px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-foreground-muted mt-1">
            Tipicamente entre 30-200mA para balanceamento passivo
          </p>
        </div>
      )}
    </div>
  );
}

// Step 5: Inverter/PCS Configuration
function Step5InverterConfig({ formData, updateField, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Fabricante do Inversor *
          </label>
          <select
            value={formData.inverterManufacturer}
            onChange={(e) => updateField('inverterManufacturer', e.target.value)}
            className={cn(
              'w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
              errors.inverterManufacturer ? 'border-danger-500' : 'border-border'
            )}
          >
            <option value="">Selecione...</option>
            {INVERTER_MANUFACTURERS.map((mfr) => (
              <option key={mfr} value={mfr}>{mfr}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Modelo
          </label>
          <input
            type="text"
            value={formData.inverterModel}
            onChange={(e) => updateField('inverterModel', e.target.value)}
            placeholder="Ex: Deye SUN-5K-SG03LP1"
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Power & Phases */}
      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Potencia (kW)
          </label>
          <input
            type="number"
            value={formData.inverterPowerKw}
            onChange={(e) => updateField('inverterPowerKw', parseFloat(e.target.value))}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Fases
          </label>
          <select
            value={formData.inverterPhases}
            onChange={(e) => updateField('inverterPhases', parseInt(e.target.value))}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={1}>Monofasico</option>
            <option value={3}>Trifasico</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Protocolo
          </label>
          <select
            value={formData.inverterProtocol}
            onChange={(e) => updateField('inverterProtocol', e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {BMS_PROTOCOLS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Communication */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4">Comunicacao do Inversor</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Endereco IP</label>
            <input
              type="text"
              value={formData.inverterAddress}
              onChange={(e) => updateField('inverterAddress', e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* AC Grid */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Parametros da Rede AC
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Tensao AC (V)</label>
            <select
              value={formData.acVoltage}
              onChange={(e) => updateField('acVoltage', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={127}>127V</option>
              <option value={220}>220V</option>
              <option value={380}>380V</option>
              <option value={440}>440V</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Frequencia (Hz)</label>
            <select
              value={formData.acFrequency}
              onChange={(e) => updateField('acFrequency', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={50}>50 Hz</option>
              <option value={60}>60 Hz</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 6: Protection Settings
function Step6ProtectionSettings({ formData, updateField, errors }: StepProps) {
  return (
    <div className="space-y-6">
      {/* Warning */}
      <div className="p-4 bg-warning-500/10 border border-warning-500/30 rounded-lg flex gap-3">
        <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-foreground-muted">
          <p className="font-medium text-warning-500 mb-1">Importante!</p>
          <p>Configure os limites de protecao de acordo com as especificacoes do fabricante das celulas.
             Valores incorretos podem causar danos permanentes ou riscos de seguranca.</p>
        </div>
      </div>

      {/* Voltage Protection */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4">Protecao de Tensao (por Celula)</h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Sobretensao (V)</label>
            <input
              type="number"
              step="0.01"
              value={formData.overVoltageProtection}
              onChange={(e) => updateField('overVoltageProtection', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-foreground-muted mt-1">
              LFP tipico: 3.65V | NMC tipico: 4.2V
            </p>
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Subtensao (V)</label>
            <input
              type="number"
              step="0.01"
              value={formData.underVoltageProtection}
              onChange={(e) => updateField('underVoltageProtection', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-foreground-muted mt-1">
              LFP tipico: 2.5V | NMC tipico: 3.0V
            </p>
          </div>
        </div>
      </div>

      {/* Current Protection */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4">Protecao de Corrente</h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Max Corrente Carga (A)</label>
            <input
              type="number"
              value={formData.overCurrentCharge}
              onChange={(e) => updateField('overCurrentCharge', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Max Corrente Descarga (A)</label>
            <input
              type="number"
              value={formData.overCurrentDischarge}
              onChange={(e) => updateField('overCurrentDischarge', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Temperature Protection */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4">Protecao de Temperatura</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Max Temp Carga (°C)</label>
            <input
              type="number"
              value={formData.overTempCharge}
              onChange={(e) => updateField('overTempCharge', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Max Temp Descarga (°C)</label>
            <input
              type="number"
              value={formData.overTempDischarge}
              onChange={(e) => updateField('overTempDischarge', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Min Temp Carga (°C)</label>
            <input
              type="number"
              value={formData.underTempCharge}
              onChange={(e) => updateField('underTempCharge', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Min Temp Descarga (°C)</label>
            <input
              type="number"
              value={formData.underTempDischarge}
              onChange={(e) => updateField('underTempDischarge', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* SOC Limits */}
      <div className="p-4 bg-surface-hover rounded-lg border border-border">
        <h4 className="font-medium text-foreground mb-4">Limites de SOC</h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-foreground-muted mb-1">SOC Maximo (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={formData.maxSoc}
              onChange={(e) => updateField('maxSoc', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Limitar a 90-95% pode aumentar vida util
            </p>
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">SOC Minimo (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={formData.minSoc}
              onChange={(e) => updateField('minSoc', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Manter acima de 10-20% para preservar celulas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  formData: SystemFormData;
  updateField: (field: string, value: any) => void;
  errors: Record<string, string>;
}
