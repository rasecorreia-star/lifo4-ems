import { useState, useEffect } from 'react';
import {
  Power,
  Play,
  Pause,
  Square,
  RefreshCw,
  Battery,
  Zap,
  Thermometer,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Gauge,
  ToggleLeft,
  ToggleRight,
  Shield,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemStatus {
  mode: 'auto' | 'manual' | 'standby' | 'emergency';
  state: 'idle' | 'charging' | 'discharging' | 'balancing' | 'fault';
  soc: number;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  frequency: number;
  contactorMain: boolean;
  contactorPrecharge: boolean;
  coolingActive: boolean;
  heatingActive: boolean;
  bmsOnline: boolean;
  inverterOnline: boolean;
  gridConnected: boolean;
}

interface ControlCommand {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  requiresConfirmation: boolean;
  enabled: boolean;
}

const initialStatus: SystemStatus = {
  mode: 'auto',
  state: 'discharging',
  soc: 72,
  power: 45.2,
  voltage: 51.8,
  current: 87.3,
  temperature: 32,
  frequency: 60.02,
  contactorMain: true,
  contactorPrecharge: false,
  coolingActive: true,
  heatingActive: false,
  bmsOnline: true,
  inverterOnline: true,
  gridConnected: true,
};

export default function ControlPanel() {
  const [status, setStatus] = useState<SystemStatus>(initialStatus);
  const [selectedMode, setSelectedMode] = useState<'auto' | 'manual'>('auto');
  const [isLocked, setIsLocked] = useState(true);
  const [targetPower, setTargetPower] = useState(50);
  const [targetSoc, setTargetSoc] = useState(80);
  const [confirmingCommand, setConfirmingCommand] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<{ time: string; command: string; user: string }[]>([
    { time: '20:12:45', command: 'Modo alterado para AUTO', user: 'admin' },
    { time: '19:45:30', command: 'Potencia ajustada: 50kW', user: 'admin' },
    { time: '18:30:15', command: 'Sistema iniciado', user: 'system' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        soc: Math.max(10, Math.min(100, prev.soc + (prev.state === 'charging' ? 0.1 : prev.state === 'discharging' ? -0.1 : 0))),
        power: prev.power + (Math.random() - 0.5) * 2,
        voltage: 51.8 + (Math.random() - 0.5) * 0.5,
        current: prev.power * 1.93 + (Math.random() - 0.5) * 2,
        temperature: 32 + (Math.random() - 0.5) * 1,
        frequency: 60 + (Math.random() - 0.5) * 0.1,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const executeCommand = (command: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCommandHistory(prev => [{ time, command, user: 'admin' }, ...prev.slice(0, 9)]);
    setConfirmingCommand(null);

    // Simulate command execution
    switch (command) {
      case 'start_charge':
        setStatus(prev => ({ ...prev, state: 'charging' }));
        break;
      case 'start_discharge':
        setStatus(prev => ({ ...prev, state: 'discharging' }));
        break;
      case 'stop':
        setStatus(prev => ({ ...prev, state: 'idle', power: 0 }));
        break;
      case 'emergency_stop':
        setStatus(prev => ({ ...prev, state: 'idle', power: 0, mode: 'emergency', contactorMain: false }));
        break;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'charging':
        return 'text-success-500';
      case 'discharging':
        return 'text-warning-500';
      case 'idle':
        return 'text-foreground-muted';
      case 'balancing':
        return 'text-primary';
      case 'fault':
        return 'text-danger-500';
      default:
        return 'text-foreground-muted';
    }
  };

  const getStateBg = (state: string) => {
    switch (state) {
      case 'charging':
        return 'bg-success-500';
      case 'discharging':
        return 'bg-warning-500';
      case 'idle':
        return 'bg-foreground-muted';
      case 'balancing':
        return 'bg-primary';
      case 'fault':
        return 'bg-danger-500';
      default:
        return 'bg-foreground-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
          <p className="text-foreground-muted mt-1">
            Controle em tempo real do sistema BESS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
            <div className={cn('w-2 h-2 rounded-full animate-pulse', getStateBg(status.state))} />
            <span className={cn('text-sm font-medium', getStateColor(status.state))}>
              {status.state === 'charging' ? 'Carregando' :
               status.state === 'discharging' ? 'Descarregando' :
               status.state === 'idle' ? 'Parado' :
               status.state === 'balancing' ? 'Balanceando' : 'Falha'}
            </span>
          </div>
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              isLocked
                ? 'bg-danger-500/20 text-danger-500 border border-danger-500/30'
                : 'bg-success-500/20 text-success-500 border border-success-500/30'
            )}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Bloqueado' : 'Desbloqueado'}
          </button>
        </div>
      </div>

      {/* Lock Warning */}
      {isLocked && (
        <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-warning-500" />
          <div>
            <p className="font-medium text-foreground">Controles Bloqueados</p>
            <p className="text-sm text-foreground-muted">
              Clique no botao "Bloqueado" para desbloquear os controles manuais.
            </p>
          </div>
        </div>
      )}

      {/* Main Status Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Live Metrics */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Metricas em Tempo Real</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-surface-hover rounded-xl">
              <Battery className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-3xl font-bold text-foreground">{status.soc.toFixed(1)}%</div>
              <p className="text-sm text-foreground-muted">SOC</p>
            </div>
            <div className="text-center p-4 bg-surface-hover rounded-xl">
              <Zap className={cn('w-8 h-8 mx-auto mb-2', status.state === 'charging' ? 'text-success-500' : 'text-warning-500')} />
              <div className="text-3xl font-bold text-foreground">{Math.abs(status.power).toFixed(1)}</div>
              <p className="text-sm text-foreground-muted">kW {status.state === 'charging' ? '(IN)' : '(OUT)'}</p>
            </div>
            <div className="text-center p-4 bg-surface-hover rounded-xl">
              <Activity className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-3xl font-bold text-foreground">{status.voltage.toFixed(1)}</div>
              <p className="text-sm text-foreground-muted">Volts DC</p>
            </div>
            <div className="text-center p-4 bg-surface-hover rounded-xl">
              <Thermometer className={cn('w-8 h-8 mx-auto mb-2', status.temperature > 40 ? 'text-danger-500' : 'text-success-500')} />
              <div className="text-3xl font-bold text-foreground">{status.temperature.toFixed(1)}°</div>
              <p className="text-sm text-foreground-muted">Temperatura</p>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-sm text-foreground-muted">Corrente</span>
              <span className="font-medium text-foreground">{status.current.toFixed(1)} A</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-sm text-foreground-muted">Frequencia</span>
              <span className="font-medium text-foreground">{status.frequency.toFixed(2)} Hz</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-sm text-foreground-muted">Modo</span>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                status.mode === 'auto' ? 'bg-success-500/20 text-success-500' :
                status.mode === 'manual' ? 'bg-primary/20 text-primary' :
                status.mode === 'emergency' ? 'bg-danger-500/20 text-danger-500' :
                'bg-foreground-muted/20 text-foreground-muted'
              )}>
                {status.mode.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-sm text-foreground-muted">Grid</span>
              <span className={cn(
                'flex items-center gap-1',
                status.gridConnected ? 'text-success-500' : 'text-danger-500'
              )}>
                <Radio className="w-4 h-4" />
                {status.gridConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        {/* Right - System Status */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Status do Sistema</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', status.bmsOnline ? 'bg-success-500' : 'bg-danger-500')} />
                <span className="text-sm text-foreground">BMS</span>
              </div>
              <span className={cn('text-sm font-medium', status.bmsOnline ? 'text-success-500' : 'text-danger-500')}>
                {status.bmsOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', status.inverterOnline ? 'bg-success-500' : 'bg-danger-500')} />
                <span className="text-sm text-foreground">Inversor</span>
              </div>
              <span className={cn('text-sm font-medium', status.inverterOnline ? 'text-success-500' : 'text-danger-500')}>
                {status.inverterOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', status.contactorMain ? 'bg-success-500' : 'bg-foreground-muted')} />
                <span className="text-sm text-foreground">Contator Principal</span>
              </div>
              <span className={cn('text-sm font-medium', status.contactorMain ? 'text-success-500' : 'text-foreground-muted')}>
                {status.contactorMain ? 'Fechado' : 'Aberto'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', status.coolingActive ? 'bg-primary' : 'bg-foreground-muted')} />
                <span className="text-sm text-foreground">Refrigeracao</span>
              </div>
              <span className={cn('text-sm font-medium', status.coolingActive ? 'text-primary' : 'text-foreground-muted')}>
                {status.coolingActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', status.heatingActive ? 'bg-warning-500' : 'bg-foreground-muted')} />
                <span className="text-sm text-foreground">Aquecimento</span>
              </div>
              <span className={cn('text-sm font-medium', status.heatingActive ? 'text-warning-500' : 'text-foreground-muted')}>
                {status.heatingActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Controles de Operacao</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-muted">Modo:</span>
            <div className="flex items-center gap-1 bg-surface-hover rounded-lg p-1">
              <button
                onClick={() => !isLocked && setSelectedMode('auto')}
                disabled={isLocked}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  selectedMode === 'auto' ? 'bg-success-500 text-white' : 'text-foreground-muted',
                  isLocked && 'opacity-50 cursor-not-allowed'
                )}
              >
                AUTO
              </button>
              <button
                onClick={() => !isLocked && setSelectedMode('manual')}
                disabled={isLocked}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  selectedMode === 'manual' ? 'bg-primary text-white' : 'text-foreground-muted',
                  isLocked && 'opacity-50 cursor-not-allowed'
                )}
              >
                MANUAL
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => !isLocked && setConfirmingCommand('start_charge')}
            disabled={isLocked || status.state === 'charging'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              isLocked || status.state === 'charging'
                ? 'border-border bg-surface-hover opacity-50 cursor-not-allowed'
                : 'border-success-500/30 bg-success-500/10 hover:bg-success-500/20 cursor-pointer'
            )}
          >
            <ArrowDown className="w-8 h-8 text-success-500" />
            <span className="font-medium text-foreground">Carregar</span>
            <span className="text-xs text-foreground-muted">Iniciar carga</span>
          </button>

          <button
            onClick={() => !isLocked && setConfirmingCommand('start_discharge')}
            disabled={isLocked || status.state === 'discharging'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              isLocked || status.state === 'discharging'
                ? 'border-border bg-surface-hover opacity-50 cursor-not-allowed'
                : 'border-warning-500/30 bg-warning-500/10 hover:bg-warning-500/20 cursor-pointer'
            )}
          >
            <ArrowUp className="w-8 h-8 text-warning-500" />
            <span className="font-medium text-foreground">Descarregar</span>
            <span className="text-xs text-foreground-muted">Iniciar descarga</span>
          </button>

          <button
            onClick={() => !isLocked && setConfirmingCommand('stop')}
            disabled={isLocked || status.state === 'idle'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              isLocked || status.state === 'idle'
                ? 'border-border bg-surface-hover opacity-50 cursor-not-allowed'
                : 'border-primary/30 bg-primary/10 hover:bg-primary/20 cursor-pointer'
            )}
          >
            <Square className="w-8 h-8 text-primary" />
            <span className="font-medium text-foreground">Parar</span>
            <span className="text-xs text-foreground-muted">Modo standby</span>
          </button>

          <button
            onClick={() => !isLocked && setConfirmingCommand('emergency_stop')}
            disabled={isLocked}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              isLocked
                ? 'border-border bg-surface-hover opacity-50 cursor-not-allowed'
                : 'border-danger-500 bg-danger-500/20 hover:bg-danger-500/30 cursor-pointer'
            )}
          >
            <Shield className="w-8 h-8 text-danger-500" />
            <span className="font-medium text-danger-500">EMERGENCIA</span>
            <span className="text-xs text-foreground-muted">Parada total</span>
          </button>
        </div>

        {/* Power/SOC Setpoints */}
        {selectedMode === 'manual' && !isLocked && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-surface-hover rounded-xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Potencia Alvo</label>
                <span className="text-lg font-bold text-primary">{targetPower} kW</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={targetPower}
                onChange={(e) => setTargetPower(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-foreground-muted mt-1">
                <span>0 kW</span>
                <span>100 kW</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">SOC Alvo</label>
                <span className="text-lg font-bold text-primary">{targetSoc}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={targetSoc}
                onChange={(e) => setTargetSoc(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-foreground-muted mt-1">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Command History */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Historico de Comandos</h2>
        <div className="space-y-2">
          {commandHistory.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-3 bg-surface-hover rounded-lg text-sm"
            >
              <span className="text-foreground-muted font-mono">{item.time}</span>
              <span className="flex-1 text-foreground">{item.command}</span>
              <span className="text-foreground-muted">{item.user}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmingCommand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-warning-500" />
              <h3 className="text-lg font-semibold text-foreground">Confirmar Comando</h3>
            </div>
            <p className="text-foreground-muted mb-6">
              {confirmingCommand === 'start_charge' && 'Tem certeza que deseja iniciar a carga da bateria?'}
              {confirmingCommand === 'start_discharge' && 'Tem certeza que deseja iniciar a descarga da bateria?'}
              {confirmingCommand === 'stop' && 'Tem certeza que deseja parar o sistema?'}
              {confirmingCommand === 'emergency_stop' && (
                <span className="text-danger-500 font-medium">
                  ATENCAO: Isto ira executar uma parada de emergencia, abrindo todos os contatores!
                </span>
              )}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmingCommand(null)}
                className="px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeCommand(confirmingCommand)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  confirmingCommand === 'emergency_stop'
                    ? 'bg-danger-500 text-white hover:bg-danger-600'
                    : 'bg-primary text-white hover:bg-primary/90'
                )}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
