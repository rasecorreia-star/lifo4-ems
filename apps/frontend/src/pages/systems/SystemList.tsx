import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Battery,
  Plus,
  Search,
  RefreshCw,
  WifiOff,
  Wifi,
  Zap,
  AlertTriangle,
  ChevronRight,
  GitCompare,
  MapPin,
  Radio,
  FileEdit,
  X,
} from 'lucide-react';
import { cn, formatPercent, formatPower, formatRelativeTime, getSystemStatusLabel } from '@/lib/utils';
import { systemsApi, telemetryApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { BessSystem, TelemetryData } from '@/types';
import SystemRegistrationModal, { SystemFormData } from '@/components/systems/SystemRegistrationModal';
import DeviceDiscovery from '@/components/systems/DeviceDiscovery';

export default function SystemList() {
  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isAddSystemModalOpen, setIsAddSystemModalOpen] = useState(false);
  const [showAutoDiscovery, setShowAutoDiscovery] = useState(false);

  // Handle new system registration
  const handleRegisterSystem = async (formData: SystemFormData) => {
    try {
      console.log('Registering new system:', formData);

      // Chamar API para criar sistema
      const systemData = {
        name: formData.name,
        model: `${formData.batteryChemistry} ${formData.cellsInSeries}S${formData.cellsInParallel}P`,
        capacity: formData.totalCapacityKwh,
        nominalVoltage: formData.nominalVoltage,
        maxChargePower: formData.inverterPowerKw * 1000,
        maxDischargePower: formData.inverterPowerKw * 1000,
        location: {
          lat: formData.location.latitude,
          lng: formData.location.longitude,
          address: formData.location.address,
          city: formData.location.city,
          state: formData.location.state,
        },
        batterySpec: {
          chemistry: formData.batteryChemistry,
          cellManufacturer: formData.cellManufacturer,
          cellModel: formData.cellModel,
          nominalCellVoltage: formData.nominalCellVoltage,
          cellsInSeries: formData.cellsInSeries,
          cellsInParallel: formData.cellsInParallel,
        },
        bmsConfig: {
          manufacturer: formData.bmsManufacturer,
          model: formData.bmsModel,
          protocol: formData.bmsProtocol,
          address: formData.bmsAddress,
          port: formData.bmsPort,
        },
        inverterConfig: {
          manufacturer: formData.inverterManufacturer,
          model: formData.inverterModel,
          powerKw: formData.inverterPowerKw,
        },
      };

      await systemsApi.create(systemData as any);

      // Recarregar lista de sistemas
      fetchSystems();

      alert('Sistema cadastrado com sucesso!');
    } catch (error) {
      console.error('Failed to register system:', error);
      alert('Erro ao cadastrar sistema. Tente novamente.');
    }
  };

  // Fetch systems
  const fetchSystems = async (showLoading = false) => {
    try {
      // Só mostra loading na primeira carga
      if (showLoading || systems.length === 0) {
        setIsLoading(true);
      }
      const response = await systemsApi.getAll();
      const systemsList = response.data.data || [];
      setSystems(systemsList);

      // Fetch telemetry for online systems
      const telemetry: Record<string, TelemetryData> = {};
      for (const system of systemsList) {
        if (system.connectionStatus === 'online') {
          try {
            const telRes = await telemetryApi.getCurrent(system.id);
            if (telRes.data.data) {
              telemetry[system.id] = telRes.data.data;
            }
          } catch {
            // Ignore individual errors
          }
        }
      }
      setTelemetryMap(telemetry);
    } catch (error) {
      console.error('Failed to fetch systems:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystems(true); // Primeira carga com loading
    const interval = setInterval(() => fetchSystems(false), 3000); // Atualizações silenciosas
    return () => clearInterval(interval);
  }, []);

  // Real-time telemetry updates
  useEffect(() => {
    const unsubscribe = socketService.onTelemetryUpdate((data) => {
      setTelemetryMap((prev) => ({
        ...prev,
        [data.systemId]: data,
      }));
    });
    return unsubscribe;
  }, []);

  // Filter systems
  const filteredSystems = systems.filter((system) => {
    const matchesSearch =
      system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      system.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      system.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && system.connectionStatus === 'online') ||
      (statusFilter === 'offline' && system.connectionStatus === 'offline') ||
      (statusFilter === 'error' && system.status === 'error');

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: systems.length,
    online: systems.filter((s) => s.connectionStatus === 'online').length,
    offline: systems.filter((s) => s.connectionStatus === 'offline').length,
    error: systems.filter((s) => s.status === 'error').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sistemas</h1>
          <p className="text-foreground-muted text-sm">
            {stats.online} de {stats.total} sistemas online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/systems/map"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-medium rounded-lg transition-colors"
          >
            <MapPin className="w-5 h-5" />
            Mapa
          </Link>
          <Link
            to="/systems/compare"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors"
          >
            <GitCompare className="w-5 h-5" />
            Comparar
          </Link>
          <button
            onClick={() => setIsAddSystemModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Sistema
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBadge label="Total" value={stats.total} icon={Battery} />
        <StatBadge label="Online" value={stats.online} icon={Wifi} color="success" />
        <StatBadge label="Offline" value={stats.offline} icon={WifiOff} color="muted" />
        <StatBadge label="Com Erro" value={stats.error} icon={AlertTriangle} color="danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, modelo ou serial..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">Todos</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Com erro</option>
          </select>
          <button
            onClick={() => fetchSystems()}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Systems Grid */}
      {isLoading && systems.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SystemCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSystems.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Battery className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum sistema encontrado</h3>
          <p className="text-foreground-muted mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Adicione seu primeiro sistema para começar'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => setIsAddSystemModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Adicionar Sistema
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSystems.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              telemetry={telemetryMap[system.id]}
            />
          ))}
        </div>
      )}

      {/* Add System Selection Modal */}
      {isAddSystemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsAddSystemModalOpen(false)}
          />
          <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <button
              onClick={() => setIsAddSystemModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-foreground mb-2">Adicionar Novo Sistema</h2>
            <p className="text-foreground-muted text-sm mb-6">
              Escolha como deseja adicionar o sistema BESS
            </p>

            <div className="grid gap-4">
              {/* Opção Automático */}
              <button
                onClick={() => {
                  setIsAddSystemModalOpen(false);
                  setShowAutoDiscovery(true);
                }}
                className="flex items-start gap-4 p-4 bg-surface-hover hover:bg-primary/10 border border-border hover:border-primary rounded-xl transition-all text-left group"
              >
                <div className="p-3 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
                  <Radio className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Descoberta Automática</h3>
                  <p className="text-sm text-foreground-muted">
                    Escaneia a rede local para encontrar dispositivos BESS compatíveis (BMS, Inversores, Medidores).
                    Após conectar, você pode editar os dados.
                  </p>
                  <span className="inline-block mt-2 text-xs text-primary font-medium">
                    Recomendado para dispositivos na mesma rede
                  </span>
                </div>
              </button>

              {/* Opção Manual */}
              <button
                onClick={() => {
                  setIsAddSystemModalOpen(false);
                  setIsRegistrationModalOpen(true);
                }}
                className="flex items-start gap-4 p-4 bg-surface-hover hover:bg-secondary/10 border border-border hover:border-secondary rounded-xl transition-all text-left group"
              >
                <div className="p-3 bg-secondary/20 rounded-lg group-hover:bg-secondary/30 transition-colors">
                  <FileEdit className="w-6 h-6 text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Cadastro Manual</h3>
                  <p className="text-sm text-foreground-muted">
                    Preencha manualmente todas as especificações técnicas do sistema BESS,
                    incluindo BMS, bateria, inversor e proteções.
                  </p>
                  <span className="inline-block mt-2 text-xs text-secondary font-medium">
                    Para configuração detalhada ou dispositivos remotos
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Discovery Modal */}
      {showAutoDiscovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAutoDiscovery(false)}
          />
          <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setShowAutoDiscovery(false)}
              className="absolute top-4 right-4 p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-foreground mb-4">Descoberta Automática de Dispositivos</h2>
            <DeviceDiscovery
              onDeviceAdded={(device) => {
                console.log('Device added:', device);
                setShowAutoDiscovery(false);
                fetchSystems();
              }}
            />
          </div>
        </div>
      )}

      {/* Registration Modal */}
      <SystemRegistrationModal
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        onSubmit={handleRegisterSystem}
      />
    </div>
  );
}

// Stat Badge
interface StatBadgeProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: 'success' | 'danger' | 'muted';
}

function StatBadge({ label, value, icon: Icon, color }: StatBadgeProps) {
  const colorClasses = {
    success: 'text-success-500',
    danger: 'text-danger-500',
    muted: 'text-foreground-subtle',
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-3 flex items-center gap-3">
      <Icon className={cn('w-5 h-5', color ? colorClasses[color] : 'text-primary')} />
      <div>
        <p className={cn('text-lg font-semibold', color ? colorClasses[color] : 'text-foreground')}>
          {value}
        </p>
        <p className="text-xs text-foreground-muted">{label}</p>
      </div>
    </div>
  );
}

// System Card
interface SystemCardProps {
  system: BessSystem;
  telemetry?: TelemetryData;
}

function SystemCard({ system, telemetry }: SystemCardProps) {
  const isOnline = system.connectionStatus === 'online';
  const hasError = system.status === 'error';
  const hasAlarms = telemetry?.alarms && (telemetry.alarms as string[]).length > 0;

  return (
    <Link
      to={`/systems/${system.id}`}
      className={cn(
        'bg-surface rounded-xl border p-4 hover:bg-surface-hover transition-all group relative',
        hasAlarms ? 'border-red-500 border-2 bg-red-500/10 animate-pulse' : hasError ? 'border-danger-500/50' : 'border-border'
      )}
    >
      {/* Alarm Badge */}
      {hasAlarms && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg z-10">
          <AlertTriangle className="w-3 h-3" />
          {(telemetry?.alarms as string[]).length} ALARME{(telemetry?.alarms as string[]).length > 1 ? 'S' : ''}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              hasAlarms ? 'bg-red-500/20' : isOnline ? 'bg-primary/10' : 'bg-surface-active'
            )}
          >
            {hasAlarms ? (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            ) : (
              <Battery className={cn('w-6 h-6', isOnline ? 'text-primary' : 'text-foreground-subtle')} />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {system.name}
            </h3>
            <p className="text-sm text-foreground-muted">{system.model}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            isOnline ? 'bg-success-500/20 text-success-500' : 'bg-foreground-subtle/20 text-foreground-subtle'
          )}
        >
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {hasError && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-danger-500/20 text-danger-500">
            Erro
          </span>
        )}
        {system.status && system.status !== 'error' && system.status !== 'offline' && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary/20 text-secondary">
            {getSystemStatusLabel(system.status)}
          </span>
        )}
      </div>

      {/* Telemetry */}
      {telemetry && isOnline ? (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="relative w-full h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: '#334155' }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, telemetry.soc || 0))}%`,
                  backgroundColor: telemetry.soc > 20 ? '#10b981' : '#ef4444'
                }}
              />
            </div>
            <p className="text-lg font-semibold text-primary">{formatPercent(telemetry.soc, 0)}</p>
            <p className="text-2xs text-foreground-muted">SOC</p>
          </div>
          <div className="text-center">
            <Zap
              className={cn(
                'w-4 h-4 mx-auto mb-1',
                telemetry.isCharging
                  ? 'text-success-500'
                  : telemetry.isDischarging
                  ? 'text-warning-500'
                  : 'text-foreground-muted'
              )}
            />
            <p className="text-sm font-medium text-foreground">{formatPower(telemetry.power)}</p>
            <p className="text-2xs text-foreground-muted">Potência</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">{formatPercent(telemetry.soh, 0)}</p>
            <p className="text-2xs text-foreground-muted">SOH</p>
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-border text-center text-sm text-foreground-muted">
          {isOnline ? 'Carregando dados...' : 'Sistema offline'}
          {system.lastCommunication && (
            <p className="text-2xs mt-1">
              Última comunicação: {formatRelativeTime(system.lastCommunication)}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

function SystemCardSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-surface-hover" />
        <div>
          <div className="h-5 w-32 bg-surface-hover rounded mb-2" />
          <div className="h-4 w-24 bg-surface-hover rounded" />
        </div>
      </div>
      <div className="h-6 w-20 bg-surface-hover rounded mb-4" />
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="h-12 bg-surface-hover rounded" />
        <div className="h-12 bg-surface-hover rounded" />
        <div className="h-12 bg-surface-hover rounded" />
      </div>
    </div>
  );
}
