/**
 * Firmware Management Page
 * Manage BMS firmware updates across all systems
 */

import { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Info,
  Shield,
  FileCode,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface FirmwareVersion {
  version: string;
  releaseDate: Date;
  changelog: string[];
  size: string;
  isLatest: boolean;
  isCritical: boolean;
  minVersion?: string;
}

interface SystemFirmware {
  id: string;
  name: string;
  model: string;
  currentVersion: string;
  targetVersion?: string;
  status: 'online' | 'offline';
  updateStatus: 'idle' | 'downloading' | 'installing' | 'success' | 'failed' | 'scheduled';
  updateProgress?: number;
  lastUpdate?: Date;
  isCompatible: boolean;
  scheduledUpdate?: Date;
}

// Mock firmware versions
const firmwareVersions: FirmwareVersion[] = [
  {
    version: '2.5.0',
    releaseDate: new Date('2026-01-20'),
    changelog: [
      'Novo algoritmo de balanceamento adaptativo',
      'Melhoria na precisao do SOC',
      'Correcao de bug no calculo de temperatura',
      'Suporte a novos protocolos Modbus',
    ],
    size: '4.2 MB',
    isLatest: true,
    isCritical: false,
  },
  {
    version: '2.4.2',
    releaseDate: new Date('2026-01-05'),
    changelog: [
      'Correcao critica de seguranca',
      'Melhoria na estabilidade de comunicacao',
    ],
    size: '3.8 MB',
    isLatest: false,
    isCritical: true,
  },
  {
    version: '2.4.1',
    releaseDate: new Date('2025-12-15'),
    changelog: [
      'Otimizacao de consumo de energia',
      'Novos parametros de protecao',
    ],
    size: '3.7 MB',
    isLatest: false,
    isCritical: false,
  },
  {
    version: '2.4.0',
    releaseDate: new Date('2025-11-20'),
    changelog: [
      'Suporte a celulas NMC',
      'Interface de configuracao melhorada',
    ],
    size: '3.5 MB',
    isLatest: false,
    isCritical: false,
  },
];

// Mock systems
const mockSystems: SystemFirmware[] = [
  {
    id: 'sys-1',
    name: 'BESS Principal',
    model: 'LiFePO4 16S4P',
    currentVersion: '2.4.1',
    status: 'online',
    updateStatus: 'idle',
    lastUpdate: new Date('2025-12-20'),
    isCompatible: true,
  },
  {
    id: 'sys-2',
    name: 'BESS Backup',
    model: 'LiFePO4 16S2P',
    currentVersion: '2.4.2',
    status: 'online',
    updateStatus: 'idle',
    lastUpdate: new Date('2026-01-10'),
    isCompatible: true,
  },
  {
    id: 'sys-3',
    name: 'BESS Solar',
    model: 'NMC 14S6P',
    currentVersion: '2.3.0',
    status: 'online',
    updateStatus: 'downloading',
    updateProgress: 45,
    targetVersion: '2.5.0',
    isCompatible: true,
  },
  {
    id: 'sys-4',
    name: 'BESS Industrial',
    model: 'LiFePO4 32S8P',
    currentVersion: '2.5.0',
    status: 'online',
    updateStatus: 'success',
    lastUpdate: new Date('2026-01-22'),
    isCompatible: true,
  },
  {
    id: 'sys-5',
    name: 'BESS Comercial',
    model: 'NCA 12S4P',
    currentVersion: '2.2.0',
    status: 'offline',
    updateStatus: 'scheduled',
    scheduledUpdate: new Date('2026-01-26T03:00:00'),
    targetVersion: '2.5.0',
    isCompatible: false,
  },
];

export default function FirmwareManagement() {
  const [systems, setSystems] = useState<SystemFirmware[]>(mockSystems);
  const [selectedVersion, setSelectedVersion] = useState<FirmwareVersion>(firmwareVersions[0]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Simulate update progress
  useEffect(() => {
    const interval = setInterval(() => {
      setSystems((prev) =>
        prev.map((sys) => {
          if (sys.updateStatus === 'downloading' && sys.updateProgress !== undefined) {
            const newProgress = sys.updateProgress + Math.random() * 5;
            if (newProgress >= 100) {
              return { ...sys, updateStatus: 'installing', updateProgress: 0 };
            }
            return { ...sys, updateProgress: Math.min(newProgress, 99) };
          }
          if (sys.updateStatus === 'installing' && sys.updateProgress !== undefined) {
            const newProgress = sys.updateProgress + Math.random() * 3;
            if (newProgress >= 100) {
              return {
                ...sys,
                updateStatus: 'success',
                currentVersion: sys.targetVersion || sys.currentVersion,
                targetVersion: undefined,
                updateProgress: undefined,
                lastUpdate: new Date(),
              };
            }
            return { ...sys, updateProgress: Math.min(newProgress, 99) };
          }
          return sys;
        })
      );
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleSelectAll = () => {
    const eligibleSystems = systems.filter(
      (s) => s.status === 'online' && s.currentVersion !== selectedVersion.version
    );
    if (selectedSystems.length === eligibleSystems.length) {
      setSelectedSystems([]);
    } else {
      setSelectedSystems(eligibleSystems.map((s) => s.id));
    }
  };

  const handleStartUpdate = () => {
    setIsUpdating(true);
    setSystems((prev) =>
      prev.map((sys) => {
        if (selectedSystems.includes(sys.id)) {
          return {
            ...sys,
            updateStatus: 'downloading',
            updateProgress: 0,
            targetVersion: selectedVersion.version,
          };
        }
        return sys;
      })
    );
    setSelectedSystems([]);
    setTimeout(() => setIsUpdating(false), 1000);
  };

  const stats = {
    total: systems.length,
    upToDate: systems.filter((s) => s.currentVersion === firmwareVersions[0].version).length,
    needsUpdate: systems.filter((s) => s.currentVersion !== firmwareVersions[0].version).length,
    updating: systems.filter((s) => ['downloading', 'installing'].includes(s.updateStatus)).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            Gerenciamento de Firmware
          </h1>
          <p className="text-foreground-muted text-sm">
            Atualize o firmware do BMS em todos os sistemas
          </p>
        </div>
        <button
          onClick={() => {}}
          className="px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg transition-colors flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Firmware
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Sistemas" value={stats.total} icon={HardDrive} color="primary" />
        <StatCard label="Atualizados" value={stats.upToDate} icon={CheckCircle} color="success" />
        <StatCard
          label="Precisam Atualizar"
          value={stats.needsUpdate}
          icon={AlertTriangle}
          color="warning"
        />
        <StatCard label="Atualizando" value={stats.updating} icon={RefreshCw} color="secondary" />
      </div>

      {/* Latest Version Info */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FileCode className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Versao {selectedVersion.version}
                </h3>
                {selectedVersion.isLatest && (
                  <span className="px-2 py-0.5 bg-success-500/20 text-success-500 text-xs font-medium rounded-full">
                    Mais Recente
                  </span>
                )}
                {selectedVersion.isCritical && (
                  <span className="px-2 py-0.5 bg-danger-500/20 text-danger-500 text-xs font-medium rounded-full">
                    Critica
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground-muted mt-1">
                Lancado em {selectedVersion.releaseDate.toLocaleDateString('pt-BR')} • {selectedVersion.size}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowChangelog(!showChangelog)}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary-400 transition-colors"
          >
            Changelog
            {showChangelog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showChangelog && (
          <div className="mt-4 pt-4 border-t border-border animate-fade-in">
            <h4 className="text-sm font-medium text-foreground mb-2">Alteracoes:</h4>
            <ul className="space-y-1">
              {selectedVersion.changelog.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle className="w-4 h-4 text-success-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Version Selector */}
        <div className="mt-4 pt-4 border-t border-border">
          <label className="text-sm text-foreground-muted block mb-2">
            Selecionar versao para atualizar:
          </label>
          <div className="flex flex-wrap gap-2">
            {firmwareVersions.map((version) => (
              <button
                key={version.version}
                onClick={() => setSelectedVersion(version)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  selectedVersion.version === version.version
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                )}
              >
                v{version.version}
                {version.isLatest && ' (Mais Recente)'}
                {version.isCritical && ' ⚠️'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Systems List */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  selectedSystems.length > 0 &&
                  selectedSystems.length ===
                    systems.filter(
                      (s) => s.status === 'online' && s.currentVersion !== selectedVersion.version
                    ).length
                }
                onChange={handleSelectAll}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
              />
              <span className="text-sm text-foreground">Selecionar todos</span>
            </label>
            {selectedSystems.length > 0 && (
              <span className="text-sm text-foreground-muted">
                {selectedSystems.length} selecionado(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedSystems.length > 0 && (
              <>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="px-3 py-1.5 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Agendar
                </button>
                <button
                  onClick={handleStartUpdate}
                  disabled={isUpdating}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Atualizar Agora
                </button>
              </>
            )}
          </div>
        </div>

        <div className="divide-y divide-border">
          {systems.map((system) => (
            <SystemRow
              key={system.id}
              system={system}
              targetVersion={selectedVersion.version}
              isSelected={selectedSystems.includes(system.id)}
              onSelect={(selected) => {
                if (selected) {
                  setSelectedSystems([...selectedSystems, system.id]);
                } else {
                  setSelectedSystems(selectedSystems.filter((id) => id !== system.id));
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Warning */}
      <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-warning-500 font-medium">Aviso Importante</p>
          <p className="text-foreground-muted">
            Atualizacoes de firmware podem reiniciar o sistema. Recomendamos agendar atualizacoes
            para horarios de baixo consumo e garantir que o sistema nao esteja em operacao critica.
          </p>
        </div>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'primary' | 'success' | 'warning' | 'secondary';
}) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    secondary: 'text-secondary bg-secondary/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className={cn('p-2 rounded-lg w-fit mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

// System Row
function SystemRow({
  system,
  targetVersion,
  isSelected,
  onSelect,
}: {
  system: SystemFirmware;
  targetVersion: string;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const isUpToDate = system.currentVersion === targetVersion;
  const canUpdate = system.status === 'online' && !isUpToDate && system.updateStatus === 'idle';

  const getStatusBadge = () => {
    switch (system.updateStatus) {
      case 'downloading':
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${system.updateProgress}%` }}
              />
            </div>
            <span className="text-xs text-primary">Baixando {system.updateProgress?.toFixed(0)}%</span>
          </div>
        );
      case 'installing':
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary transition-all"
                style={{ width: `${system.updateProgress}%` }}
              />
            </div>
            <span className="text-xs text-secondary">Instalando {system.updateProgress?.toFixed(0)}%</span>
          </div>
        );
      case 'success':
        return (
          <span className="flex items-center gap-1 text-xs text-success-500">
            <CheckCircle className="w-4 h-4" />
            Atualizado
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-xs text-danger-500">
            <XCircle className="w-4 h-4" />
            Falhou
          </span>
        );
      case 'scheduled':
        return (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Clock className="w-4 h-4" />
            Agendado para {system.scheduledUpdate?.toLocaleString('pt-BR')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-4 p-4">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelect(e.target.checked)}
        disabled={!canUpdate}
        className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary disabled:opacity-50"
      />

      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          system.status === 'online' ? 'bg-primary/10' : 'bg-surface-hover'
        )}
      >
        {system.status === 'online' ? (
          <Wifi className="w-5 h-5 text-primary" />
        ) : (
          <WifiOff className="w-5 h-5 text-foreground-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground">{system.name}</h4>
          <span
            className={cn(
              'px-2 py-0.5 text-2xs rounded-full',
              system.status === 'online'
                ? 'bg-success-500/20 text-success-500'
                : 'bg-foreground-subtle/20 text-foreground-subtle'
            )}
          >
            {system.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-sm text-foreground-muted">{system.model}</p>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-foreground">v{system.currentVersion}</p>
        <p className="text-2xs text-foreground-muted">Versao atual</p>
      </div>

      <div className="w-32">
        {isUpToDate ? (
          <span className="flex items-center gap-1 text-xs text-success-500">
            <CheckCircle className="w-4 h-4" />
            Atualizado
          </span>
        ) : (
          getStatusBadge() || (
            <span className="text-xs text-warning-500">
              Atualizacao disponivel
            </span>
          )
        )}
      </div>

      {system.lastUpdate && (
        <div className="text-right hidden sm:block">
          <p className="text-2xs text-foreground-muted">Ultima atualizacao</p>
          <p className="text-xs text-foreground">{formatRelativeTime(system.lastUpdate)}</p>
        </div>
      )}
    </div>
  );
}
