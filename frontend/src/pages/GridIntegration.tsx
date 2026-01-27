/**
 * Grid Integration Page
 * Manages Solar + BESS + Grid integration, power flow visualization,
 * control modes, and energy management
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Zap,
  Sun,
  Battery,
  Home,
  Settings,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Power,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { PowerFlowDiagram } from '@/components/grid/PowerFlowDiagram';
import { gridApi, systemsApi, telemetryApi } from '@/services/api';
import { cn } from '@/lib/utils';

// Control modes for grid integration
const CONTROL_MODES = [
  {
    id: 'grid_following',
    name: 'Grid Following',
    description: 'Segue a rede eletrica, injetando ou absorvendo potencia conforme necessario',
    icon: TrendingUp,
    color: 'blue',
  },
  {
    id: 'grid_forming',
    name: 'Grid Forming',
    description: 'Forma a referencia de tensao/frequencia, operando como fonte de tensao',
    icon: Zap,
    color: 'green',
  },
  {
    id: 'islanding',
    name: 'Islanding',
    description: 'Operacao em ilha, desconectado da rede com suprimento local autonomo',
    icon: Power,
    color: 'orange',
  },
  {
    id: 'droop',
    name: 'Droop Control',
    description: 'Controle de queda para compartilhamento de carga entre multiplas fontes',
    icon: BarChart3,
    color: 'purple',
  },
];

// Generate mock power flow data
const generatePowerFlowData = () => ({
  solarPower: 15 + Math.random() * 10,
  bessPower: Math.random() > 0.5 ? -(5 + Math.random() * 8) : (3 + Math.random() * 5),
  gridPower: Math.random() > 0.6 ? (2 + Math.random() * 5) : -(1 + Math.random() * 3),
  loadPower: 12 + Math.random() * 8,
  bessSoc: 45 + Math.random() * 40,
  bessState: Math.random() > 0.5 ? 'charging' : 'discharging' as 'charging' | 'discharging' | 'idle' | 'standby',
  selfConsumptionRate: 70 + Math.random() * 25,
  solarEnergyToday: 45 + Math.random() * 20,
  gridImportToday: 8 + Math.random() * 10,
  gridExportToday: 12 + Math.random() * 8,
});

// Generate mock energy history
const generateEnergyHistory = () => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return hours.map((hour) => {
    const isSolarHour = hour >= 6 && hour <= 18;
    const isPeakHour = (hour >= 18 && hour <= 21) || (hour >= 7 && hour <= 9);
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      solar: isSolarHour ? Math.sin((hour - 6) / 12 * Math.PI) * 20 + Math.random() * 5 : 0,
      bess: isPeakHour ? -(5 + Math.random() * 8) : (2 + Math.random() * 4),
      grid: isPeakHour ? (3 + Math.random() * 5) : -(2 + Math.random() * 3),
      load: 8 + Math.random() * 10 + (isPeakHour ? 5 : 0),
    };
  });
};

// Generate weekly energy data
const generateWeeklyData = () => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return days.map((day) => ({
    day,
    solar: 40 + Math.random() * 30,
    gridImport: 15 + Math.random() * 15,
    gridExport: 10 + Math.random() * 20,
    selfConsumption: 25 + Math.random() * 20,
  }));
};

export default function GridIntegration() {
  const { systemId } = useParams<{ systemId: string }>();
  const [powerFlowData, setPowerFlowData] = useState(generatePowerFlowData());
  const [energyHistory, setEnergyHistory] = useState(generateEnergyHistory());
  const [weeklyData, setWeeklyData] = useState(generateWeeklyData());
  const [selectedMode, setSelectedMode] = useState('grid_following');
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string>(systemId || 'sys-demo-001');
  const [systems, setSystems] = useState<any[]>([]);
  const [showModeDetails, setShowModeDetails] = useState(false);

  // Fetch systems list
  useEffect(() => {
    systemsApi.getAll().then((res) => {
      setSystems(res.data.data || []);
    }).catch(console.error);
  }, []);

  // Real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPowerFlowData(generatePowerFlowData());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle mode change
  const handleModeChange = async (modeId: string) => {
    setIsChangingMode(true);
    try {
      await gridApi.setControlMode(selectedSystem, modeId);
      setSelectedMode(modeId);
    } catch (error) {
      console.error('Failed to change mode:', error);
    } finally {
      setIsChangingMode(false);
    }
  };

  const currentMode = CONTROL_MODES.find((m) => m.id === selectedMode);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integracao com a Rede</h1>
          <p className="text-foreground-muted mt-1">
            Gerenciamento de fluxo de energia Solar + BESS + Rede
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary"
          >
            {systems.map((sys) => (
              <option key={sys.id} value={sys.id}>
                {sys.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setPowerFlowData(generatePowerFlowData());
              setEnergyHistory(generateEnergyHistory());
            }}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Sun className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Geracao Solar</p>
              <p className="text-xl font-bold text-foreground">{powerFlowData.solarPower.toFixed(1)} kW</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              powerFlowData.bessPower < 0 ? 'bg-green-500/20' : 'bg-orange-500/20'
            )}>
              <Battery className={cn(
                'w-5 h-5',
                powerFlowData.bessPower < 0 ? 'text-green-400' : 'text-orange-400'
              )} />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">BESS ({powerFlowData.bessSoc.toFixed(0)}%)</p>
              <p className="text-xl font-bold text-foreground">
                {powerFlowData.bessPower < 0 ? '+' : '-'}{Math.abs(powerFlowData.bessPower).toFixed(1)} kW
              </p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              powerFlowData.gridPower > 0 ? 'bg-blue-500/20' : 'bg-green-500/20'
            )}>
              <Zap className={cn(
                'w-5 h-5',
                powerFlowData.gridPower > 0 ? 'text-blue-400' : 'text-green-400'
              )} />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">
                {powerFlowData.gridPower > 0 ? 'Importando' : 'Exportando'}
              </p>
              <p className="text-xl font-bold text-foreground">{Math.abs(powerFlowData.gridPower).toFixed(1)} kW</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Home className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Consumo</p>
              <p className="text-xl font-bold text-foreground">{powerFlowData.loadPower.toFixed(1)} kW</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Power Flow Diagram */}
        <div className="lg:col-span-2">
          <PowerFlowDiagram data={powerFlowData} className="h-full" />
        </div>

        {/* Control Mode Panel */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Modo de Operacao
          </h3>

          <div className="space-y-3">
            {CONTROL_MODES.map((mode) => {
              const isSelected = selectedMode === mode.id;
              const ModeIcon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(mode.id)}
                  disabled={isChangingMode}
                  className={cn(
                    'w-full p-4 rounded-lg border text-left transition-all',
                    isSelected
                      ? `border-${mode.color}-500 bg-${mode.color}-500/10`
                      : 'border-border hover:border-primary/50 hover:bg-surface-hover'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      isSelected ? `bg-${mode.color}-500/20` : 'bg-surface-hover'
                    )}>
                      <ModeIcon className={cn(
                        'w-5 h-5',
                        isSelected ? `text-${mode.color}-400` : 'text-foreground-muted'
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium',
                          isSelected ? 'text-foreground' : 'text-foreground-muted'
                        )}>
                          {mode.name}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-foreground-muted mt-1">
                        {mode.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode Status */}
          <div className="mt-4 p-3 bg-surface-hover rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-foreground-muted">Status:</span>
              <span className="text-foreground font-medium">{currentMode?.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-2">
              <Clock className="w-4 h-4 text-foreground-muted" />
              <span className="text-foreground-muted">Ativo desde:</span>
              <span className="text-foreground">14:35</span>
            </div>
          </div>
        </div>
      </div>

      {/* Energy History Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 24h Power Flow */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Fluxo de Potencia (24h)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#F9FAFB' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="solar"
                  name="Solar"
                  stackId="1"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="grid"
                  name="Rede"
                  stackId="2"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="bess"
                  name="BESS"
                  stackId="3"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="load"
                  name="Carga"
                  stroke="#8B5CF6"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Energy Summary */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Resumo Semanal de Energia</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} unit=" kWh" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#F9FAFB' }}
                  formatter={(value: number) => [`${value.toFixed(1)} kWh`]}
                />
                <Legend />
                <Bar dataKey="solar" name="Solar" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gridImport" name="Import Rede" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gridExport" name="Export Rede" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="selfConsumption" name="Autoconsumo" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid Connection Status and Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Status */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Status da Conexao
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-foreground-muted">Tensao da Rede</span>
              <span className="font-medium text-foreground">220.5 V</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-foreground-muted">Frequencia</span>
              <span className="font-medium text-foreground">60.02 Hz</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-foreground-muted">Fator de Potencia</span>
              <span className="font-medium text-foreground">0.98</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-foreground-muted">THD</span>
              <span className="font-medium text-green-400">2.3%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-green-400">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-medium text-green-400">Conectado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Energy Balance */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Balanco Energetico (Hoje)
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-yellow-400" />
                  <span className="text-foreground">Geracao Solar</span>
                </div>
                <span className="text-xl font-bold text-yellow-400">
                  {powerFlowData.solarEnergyToday.toFixed(1)} kWh
                </span>
              </div>
            </div>
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5 text-blue-400" />
                  <span className="text-foreground">Importado da Rede</span>
                </div>
                <span className="text-xl font-bold text-blue-400">
                  {powerFlowData.gridImportToday.toFixed(1)} kWh
                </span>
              </div>
            </div>
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                  <span className="text-foreground">Exportado para Rede</span>
                </div>
                <span className="text-xl font-bold text-green-400">
                  {powerFlowData.gridExportToday.toFixed(1)} kWh
                </span>
              </div>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-purple-400" />
                  <span className="text-foreground">Autoconsumo</span>
                </div>
                <span className="text-xl font-bold text-purple-400">
                  {powerFlowData.selfConsumptionRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Power className="w-5 h-5 text-primary" />
            Acoes Rapidas
          </h3>
          <div className="space-y-3">
            <button className="w-full p-3 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors text-left">
              <div className="flex items-center gap-3">
                <Battery className="w-5 h-5 text-green-400" />
                <div>
                  <span className="font-medium text-foreground">Carregar BESS</span>
                  <p className="text-xs text-foreground-muted">Iniciar carga a partir da rede</p>
                </div>
              </div>
            </button>
            <button className="w-full p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-colors text-left">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-orange-400" />
                <div>
                  <span className="font-medium text-foreground">Descarregar BESS</span>
                  <p className="text-xs text-foreground-muted">Exportar energia para a rede</p>
                </div>
              </div>
            </button>
            <button className="w-full p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors text-left">
              <div className="flex items-center gap-3">
                <RefreshCcw className="w-5 h-5 text-blue-400" />
                <div>
                  <span className="font-medium text-foreground">Modo Automatico</span>
                  <p className="text-xs text-foreground-muted">Otimizacao baseada em horario</p>
                </div>
              </div>
            </button>
            <button className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-left">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div>
                  <span className="font-medium text-foreground">Isolamento de Rede</span>
                  <p className="text-xs text-foreground-muted">Desconectar da rede eletrica</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Tariff Information */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Tarifas Atuais</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="text-sm text-foreground-muted">Fora Ponta (22h - 17h)</div>
            <div className="text-2xl font-bold text-green-400 mt-1">R$ 0.45/kWh</div>
            <div className="text-xs text-foreground-muted mt-2">
              <span className="text-green-400 font-medium">Ativo agora</span> - Melhor horario para carregar
            </div>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-sm text-foreground-muted">Intermediario (17h - 18h / 21h - 22h)</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">R$ 0.65/kWh</div>
            <div className="text-xs text-foreground-muted mt-2">
              Horario de transicao
            </div>
          </div>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="text-sm text-foreground-muted">Ponta (18h - 21h)</div>
            <div className="text-2xl font-bold text-red-400 mt-1">R$ 1.25/kWh</div>
            <div className="text-xs text-foreground-muted mt-2">
              Maior economia ao descarregar BESS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
