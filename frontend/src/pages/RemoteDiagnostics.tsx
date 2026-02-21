import { useState, useMemo, useEffect } from 'react';
import {
  Terminal,
  Play,
  Square,
  RefreshCw,
  Download,
  Upload,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  HardDrive,
  Thermometer,
  Activity,
  FileText,
  Send,
  Trash2,
  Copy,
  Search,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DiagnosticTest {
  id: string;
  name: string;
  category: string;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'warning';
  duration?: number;
  result?: string;
  lastRun?: string;
}

interface SystemLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
}

export default function RemoteDiagnostics() {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'terminal' | 'logs' | 'health'>('diagnostics');
  const [selectedSystem, setSelectedSystem] = useState('1');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '> Sistema conectado: BESS Teresina Centro',
    '> Firmware: v3.2.1',
    '> Uptime: 45 dias, 12 horas',
    '> Aguardando comandos...',
  ]);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [runningTests, setRunningTests] = useState<string[]>([]);

  const systems = useMemo(() => [
    { id: '1', name: 'BESS Teresina Centro', status: 'online' },
    { id: '2', name: 'BESS Parnaiba Industrial', status: 'online' },
    { id: '3', name: 'BESS Floriano Solar', status: 'offline' },
    { id: '4', name: 'BESS Picos Comercial', status: 'online' },
  ], []);

  const [diagnosticTests, setDiagnosticTests] = useState<DiagnosticTest[]>([
    { id: '1', name: 'Teste de Comunicacao BMS', category: 'Comunicacao', status: 'passed', duration: 2.3, result: 'Todos os modulos respondendo', lastRun: '2025-01-25T14:30' },
    { id: '2', name: 'Verificacao de Tensao das Celulas', category: 'Bateria', status: 'passed', duration: 15.2, result: 'Delta max: 12mV (OK)', lastRun: '2025-01-25T14:32' },
    { id: '3', name: 'Teste de Isolamento', category: 'Seguranca', status: 'passed', duration: 8.5, result: 'Resistencia: 2.5 MOhm', lastRun: '2025-01-25T14:35' },
    { id: '4', name: 'Calibracao de Sensores', category: 'Sensores', status: 'warning', duration: 12.1, result: 'Sensor T3 com desvio de 0.5C', lastRun: '2025-01-25T14:40' },
    { id: '5', name: 'Teste de Inversor', category: 'Inversor', status: 'idle', lastRun: '2025-01-24T10:00' },
    { id: '6', name: 'Verificacao de Firmware', category: 'Sistema', status: 'idle', lastRun: '2025-01-24T10:05' },
    { id: '7', name: 'Teste de Rede', category: 'Comunicacao', status: 'idle', lastRun: '2025-01-24T10:10' },
    { id: '8', name: 'Diagnostico de Memoria', category: 'Sistema', status: 'idle', lastRun: '2025-01-24T10:15' },
  ]);

  const systemLogs: SystemLog[] = useMemo(() => [
    { timestamp: '2025-01-25T14:45:32', level: 'info', source: 'BMS', message: 'Balanceamento de celulas iniciado no modulo 3' },
    { timestamp: '2025-01-25T14:44:15', level: 'warning', source: 'Thermal', message: 'Temperatura do modulo 2 acima de 35C - ventilacao aumentada' },
    { timestamp: '2025-01-25T14:43:00', level: 'info', source: 'Inverter', message: 'Modo de operacao alterado para descarga' },
    { timestamp: '2025-01-25T14:42:30', level: 'debug', source: 'SCADA', message: 'Heartbeat recebido do servidor central' },
    { timestamp: '2025-01-25T14:40:00', level: 'error', source: 'Sensor', message: 'Timeout na leitura do sensor de corrente CT-05' },
    { timestamp: '2025-01-25T14:38:45', level: 'info', source: 'System', message: 'Backup de configuracao realizado com sucesso' },
    { timestamp: '2025-01-25T14:35:20', level: 'info', source: 'BMS', message: 'SOC atualizado: 72%' },
    { timestamp: '2025-01-25T14:30:00', level: 'info', source: 'Grid', message: 'Conexao com rede estabelecida - tensao: 380V' },
  ], []);

  const healthMetrics = useMemo(() => ({
    cpu: 23,
    memory: 45,
    disk: 32,
    network: 98,
    temperature: 42,
    uptime: '45d 12h 34m',
  }), []);

  const [realtimeData, setRealtimeData] = useState<{ time: string; cpu: number; memory: number }[]>([]);

  useEffect(() => {
    const initial = Array.from({ length: 20 }, (_, i) => ({
      time: `${i}`,
      cpu: Math.floor(Math.random() * 30) + 15,
      memory: Math.floor(Math.random() * 20) + 40,
    }));
    setRealtimeData(initial);

    const interval = setInterval(() => {
      setRealtimeData(prev => {
        const newData = [...prev.slice(1), {
          time: `${parseInt(prev[prev.length - 1].time) + 1}`,
          cpu: Math.floor(Math.random() * 30) + 15,
          memory: Math.floor(Math.random() * 20) + 40,
        }];
        return newData;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const runTest = (testId: string) => {
    setRunningTests(prev => [...prev, testId]);
    setDiagnosticTests(prev => prev.map(t =>
      t.id === testId ? { ...t, status: 'running' } : t
    ));

    setTimeout(() => {
      const success = Math.random() > 0.1;
      setDiagnosticTests(prev => prev.map(t =>
        t.id === testId ? {
          ...t,
          status: success ? 'passed' : 'failed',
          duration: Math.floor(Math.random() * 20) + 5,
          result: success ? 'Teste concluido com sucesso' : 'Falha detectada - verificar logs',
          lastRun: new Date().toISOString(),
        } : t
      ));
      setRunningTests(prev => prev.filter(id => id !== testId));
    }, 3000);
  };

  const runAllTests = () => {
    diagnosticTests.forEach((test, index) => {
      setTimeout(() => runTest(test.id), index * 500);
    });
  };

  const handleTerminalCommand = () => {
    if (!terminalInput.trim()) return;

    const command = terminalInput.trim();
    setTerminalOutput(prev => [...prev, `> ${command}`]);

    // Simulate command responses
    setTimeout(() => {
      let response = '';
      if (command === 'help') {
        response = 'Comandos disponiveis:\n  status - Status do sistema\n  reboot - Reiniciar controlador\n  logs - Ver logs recentes\n  config - Ver configuracao\n  clear - Limpar terminal';
      } else if (command === 'status') {
        response = 'Sistema: ONLINE\nSOC: 72%\nPotencia: +1250 kW\nTemperatura: 28C\nAlertas: 0';
      } else if (command === 'clear') {
        setTerminalOutput(['> Terminal limpo']);
        setTerminalInput('');
        return;
      } else if (command === 'config') {
        response = 'Capacidade: 5000 kWh\nInversor: 2500 kW\nModulos: 10\nFirmware: v3.2.1\nIP: 192.168.1.100';
      } else if (command === 'logs') {
        response = '[14:45] INFO: Balanceamento iniciado\n[14:44] WARN: Temp alta modulo 2\n[14:43] INFO: Modo descarga\n[14:40] ERROR: Timeout sensor CT-05';
      } else if (command === 'reboot') {
        response = 'ATENCAO: Comando de reinicializacao requer confirmacao.\nDigite "reboot confirm" para confirmar.';
      } else {
        response = `Comando nao reconhecido: ${command}\nDigite "help" para ver comandos disponiveis.`;
      }
      setTerminalOutput(prev => [...prev, response]);
    }, 500);

    setTerminalInput('');
  };

  const getStatusIcon = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-danger-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-foreground-muted" />;
    }
  };

  const getLogLevelBadge = (level: SystemLog['level']) => {
    switch (level) {
      case 'error':
        return <span className="px-2 py-0.5 text-xs rounded bg-danger-500/20 text-danger-500">ERROR</span>;
      case 'warning':
        return <span className="px-2 py-0.5 text-xs rounded bg-warning-500/20 text-warning-500">WARN</span>;
      case 'info':
        return <span className="px-2 py-0.5 text-xs rounded bg-primary/20 text-primary">INFO</span>;
      case 'debug':
        return <span className="px-2 py-0.5 text-xs rounded bg-foreground-muted/20 text-foreground-muted">DEBUG</span>;
    }
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return systemLogs;
    return systemLogs.filter(log => log.level === logFilter);
  }, [systemLogs, logFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnostico Remoto</h1>
          <p className="text-foreground-muted">Troubleshooting e monitoramento avancado</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          >
            {systems.map(sys => (
              <option key={sys.id} value={sys.id} disabled={sys.status === 'offline'}>
                {sys.name} {sys.status === 'offline' ? '(Offline)' : ''}
              </option>
            ))}
          </select>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            connectionStatus === 'connected' ? 'bg-success-500/20 text-success-500' :
            connectionStatus === 'connecting' ? 'bg-warning-500/20 text-warning-500' :
            'bg-danger-500/20 text-danger-500'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {connectionStatus === 'connected' ? 'Conectado' :
               connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'diagnostics'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Diagnosticos
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'terminal'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Terminal className="w-4 h-4 inline mr-2" />
          Terminal
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Logs
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'health'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Cpu className="w-4 h-4 inline mr-2" />
          Saude do Sistema
        </button>
      </div>

      {/* Diagnostics Tab */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Testes de Diagnostico</h2>
            <button
              onClick={runAllTests}
              disabled={runningTests.length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Play className="w-4 h-4" />
              Executar Todos
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {diagnosticTests.map((test) => (
              <div
                key={test.id}
                className={`bg-surface rounded-xl border p-4 ${
                  test.status === 'running' ? 'border-primary' :
                  test.status === 'failed' ? 'border-danger-500' :
                  'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <h3 className="font-medium text-foreground">{test.name}</h3>
                      <p className="text-xs text-foreground-muted">{test.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => runTest(test.id)}
                    disabled={runningTests.includes(test.id)}
                    className="p-2 hover:bg-surface-hover rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {runningTests.includes(test.id) ? (
                      <Square className="w-4 h-4 text-foreground-muted" />
                    ) : (
                      <Play className="w-4 h-4 text-primary" />
                    )}
                  </button>
                </div>

                {test.result && (
                  <p className={`text-sm mb-2 ${
                    test.status === 'passed' ? 'text-success-500' :
                    test.status === 'failed' ? 'text-danger-500' :
                    test.status === 'warning' ? 'text-warning-500' :
                    'text-foreground-muted'
                  }`}>
                    {test.result}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-foreground-muted">
                  {test.duration && <span>Duracao: {test.duration}s</span>}
                  {test.lastRun && (
                    <span>Ultimo: {new Date(test.lastRun).toLocaleString('pt-BR')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal Tab */}
      {activeTab === 'terminal' && (
        <div className="bg-gray-900 rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">Terminal Remoto - {systems.find(s => s.id === selectedSystem)?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(terminalOutput.join('\n'))}
                className="p-1 hover:bg-gray-700 rounded"
                title="Copiar"
              >
                <Copy className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setTerminalOutput(['> Terminal limpo'])}
                className="p-1 hover:bg-gray-700 rounded"
                title="Limpar"
              >
                <Trash2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          <div className="p-4 h-96 overflow-y-auto font-mono text-sm">
            {terminalOutput.map((line, index) => (
              <div key={index} className="text-green-400 whitespace-pre-wrap">{line}</div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-t border-gray-700">
            <span className="text-green-400">{'>'}</span>
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTerminalCommand()}
              placeholder="Digite um comando..."
              className="flex-1 bg-transparent text-green-400 focus:outline-none font-mono"
            />
            <button
              onClick={handleTerminalCommand}
              className="p-2 hover:bg-gray-700 rounded"
            >
              <Send className="w-4 h-4 text-green-400" />
            </button>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-foreground-muted" />
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="all">Todos os Niveis</option>
                <option value="error">Erros</option>
                <option value="warning">Warnings</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
              <Download className="w-4 h-4" />
              Exportar Logs
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-4 px-4 py-3 border-b border-border last:border-0 ${
                    log.level === 'error' ? 'bg-danger-500/5' :
                    log.level === 'warning' ? 'bg-warning-500/5' : ''
                  }`}
                >
                  <span className="text-xs text-foreground-muted font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                  {getLogLevelBadge(log.level)}
                  <span className="text-xs text-primary font-mono">[{log.source}]</span>
                  <span className="text-sm text-foreground flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* System Metrics */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Metricas do Controlador</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> CPU
                  </span>
                  <span className="text-sm font-semibold text-foreground">{healthMetrics.cpu}%</span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      healthMetrics.cpu < 50 ? 'bg-success-500' :
                      healthMetrics.cpu < 80 ? 'bg-warning-500' : 'bg-danger-500'
                    }`}
                    style={{ width: `${healthMetrics.cpu}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <HardDrive className="w-4 h-4" /> Memoria
                  </span>
                  <span className="text-sm font-semibold text-foreground">{healthMetrics.memory}%</span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      healthMetrics.memory < 60 ? 'bg-success-500' :
                      healthMetrics.memory < 85 ? 'bg-warning-500' : 'bg-danger-500'
                    }`}
                    style={{ width: `${healthMetrics.memory}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <HardDrive className="w-4 h-4" /> Disco
                  </span>
                  <span className="text-sm font-semibold text-foreground">{healthMetrics.disk}%</span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success-500"
                    style={{ width: `${healthMetrics.disk}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <Wifi className="w-4 h-4" /> Rede
                  </span>
                  <span className="text-sm font-semibold text-foreground">{healthMetrics.network}%</span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success-500"
                    style={{ width: `${healthMetrics.network}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <Thermometer className="w-4 h-4" /> Temperatura
                  </span>
                  <span className="text-sm font-semibold text-foreground">{healthMetrics.temperature}C</span>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      healthMetrics.temperature < 50 ? 'bg-success-500' :
                      healthMetrics.temperature < 70 ? 'bg-warning-500' : 'bg-danger-500'
                    }`}
                    style={{ width: `${(healthMetrics.temperature / 100) * 100}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-muted">Uptime</span>
                  <span className="text-sm font-semibold text-foreground">{healthMetrics.uptime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Realtime Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Uso de Recursos (Tempo Real)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={realtimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="memory" name="Memoria %" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Acoes Rapidas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
                <RefreshCw className="w-6 h-6 text-primary" />
                <span className="text-sm text-foreground">Reiniciar BMS</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
                <Download className="w-6 h-6 text-primary" />
                <span className="text-sm text-foreground">Baixar Logs</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
                <Upload className="w-6 h-6 text-primary" />
                <span className="text-sm text-foreground">Atualizar Config</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
                <Activity className="w-6 h-6 text-primary" />
                <span className="text-sm text-foreground">Calibrar Sensores</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
