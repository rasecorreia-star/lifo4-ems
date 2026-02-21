import { useMemo, useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Clock,
  Server,
  Database,
  Cpu,
  Wifi,
  ChevronDown,
  ChevronRight,
  X,
  Play,
  Pause,
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  source: string;
  message: string;
  details?: string;
  systemId?: string;
  systemName?: string;
}

export default function SystemLogs() {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const initialLogs = useMemo<LogEntry[]>(() => [
    {
      id: 'log-1',
      timestamp: '2025-01-22T19:45:23.456',
      level: 'info',
      source: 'BMS Controller',
      message: 'Ciclo de monitoramento concluido com sucesso',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
    },
    {
      id: 'log-2',
      timestamp: '2025-01-22T19:45:20.123',
      level: 'warning',
      source: 'Inverter',
      message: 'Temperatura do inversor acima do normal: 52°C',
      details: 'Temperatura registrada: 52.3°C\nLimite configurado: 50°C\nAcao: Monitoramento intensificado',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
    },
    {
      id: 'log-3',
      timestamp: '2025-01-22T19:44:55.789',
      level: 'info',
      source: 'Grid Interface',
      message: 'Sincronizacao com rede concluida',
      systemId: 'sys-2',
      systemName: 'BESS Piaui Sul',
    },
    {
      id: 'log-4',
      timestamp: '2025-01-22T19:44:30.456',
      level: 'error',
      source: 'MQTT Client',
      message: 'Falha na conexao com broker MQTT',
      details: 'Error: Connection refused\nHost: mqtt.lifo4.com.br\nPort: 1883\nRetrying in 5 seconds...',
    },
    {
      id: 'log-5',
      timestamp: '2025-01-22T19:44:15.123',
      level: 'debug',
      source: 'Database',
      message: 'Query executada: SELECT * FROM telemetry WHERE timestamp > ?',
      details: 'Execution time: 45ms\nRows returned: 1250',
    },
    {
      id: 'log-6',
      timestamp: '2025-01-22T19:43:50.789',
      level: 'info',
      source: 'Scheduler',
      message: 'Backup agendado iniciado',
    },
    {
      id: 'log-7',
      timestamp: '2025-01-22T19:43:30.456',
      level: 'warning',
      source: 'Battery Module',
      message: 'Desequilibrio de tensao detectado entre celulas',
      details: 'Cell 1: 3.42V\nCell 2: 3.41V\nCell 3: 3.38V (baixa)\nCell 4: 3.42V\nDiferenca maxima: 40mV',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
    },
    {
      id: 'log-8',
      timestamp: '2025-01-22T19:43:00.123',
      level: 'info',
      source: 'API Gateway',
      message: 'Request processado: GET /api/v1/systems/sys-1/telemetry',
      details: 'Status: 200\nDuration: 125ms\nClient IP: 187.45.123.45',
    },
    {
      id: 'log-9',
      timestamp: '2025-01-22T19:42:45.789',
      level: 'error',
      source: 'WebSocket',
      message: 'Conexao WebSocket perdida',
      details: 'Client ID: ws-client-234\nReason: Network timeout\nReconnecting...',
    },
    {
      id: 'log-10',
      timestamp: '2025-01-22T19:42:30.456',
      level: 'info',
      source: 'Auth Service',
      message: 'Login bem-sucedido: carlos@lifo4.com.br',
      details: 'IP: 187.45.123.45\nDevice: Chrome/Windows',
    },
    {
      id: 'log-11',
      timestamp: '2025-01-22T19:42:00.123',
      level: 'debug',
      source: 'Cache',
      message: 'Cache invalidado para chave: system:sys-1:metrics',
    },
    {
      id: 'log-12',
      timestamp: '2025-01-22T19:41:45.789',
      level: 'info',
      source: 'Optimizer',
      message: 'Algoritmo de otimizacao executado',
      details: 'Strategy: Peak Shaving\nSavings estimated: R$ 1,234.56\nDuration: 2.3s',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
    },
  ], []);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Simulate auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: ['info', 'warning', 'debug'][Math.floor(Math.random() * 3)] as LogEntry['level'],
        source: ['BMS Controller', 'Inverter', 'Grid Interface', 'API Gateway'][Math.floor(Math.random() * 4)],
        message: 'Monitoramento em tempo real ativo',
        systemId: 'sys-1',
        systemName: 'BESS Teresina Norte',
      };
      setLogs(prev => [newLog, ...prev.slice(0, 99)]);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
      const matchesSource = filterSource === 'all' || log.source === filterSource;
      const matchesSearch = searchTerm === '' ||
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLevel && matchesSource && matchesSearch;
    });
  }, [logs, filterLevel, filterSource, searchTerm]);

  const sources = useMemo(() => {
    const uniqueSources = new Set(logs.map(l => l.source));
    return Array.from(uniqueSources);
  }, [logs]);

  const stats = useMemo(() => ({
    total: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warning').length,
    info: logs.filter(l => l.level === 'info').length,
    debug: logs.filter(l => l.level === 'debug').length,
  }), [logs]);

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return AlertCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      case 'debug': return Bug;
      default: return Info;
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-500 bg-red-500/20';
      case 'warning': return 'text-amber-500 bg-amber-500/20';
      case 'info': return 'text-blue-500 bg-blue-500/20';
      case 'debug': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getSourceIcon = (source: string) => {
    if (source.includes('Database')) return Database;
    if (source.includes('API') || source.includes('WebSocket')) return Server;
    if (source.includes('MQTT') || source.includes('Grid')) return Wifi;
    return Cpu;
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs do Sistema</h1>
          <p className="text-foreground-muted">Visualize logs de todos os componentes do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              autoRefresh
                ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                : 'bg-surface border border-border text-foreground-muted'
            }`}
          >
            {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Erros</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.errors}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Alertas</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.warnings}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-foreground-muted">Info</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.info}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-foreground-muted">Debug</span>
          </div>
          <p className="text-2xl font-bold text-gray-500">{stats.debug}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="Buscar nos logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-foreground-muted" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none"
            >
              <option value="all">Todos os Niveis</option>
              <option value="error">Erros</option>
              <option value="warning">Alertas</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none"
            >
              <option value="all">Todas as Fontes</option>
              {sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          {(filterLevel !== 'all' || filterSource !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setFilterLevel('all');
                setFilterSource('all');
                setSearchTerm('');
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-foreground-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="bg-surface rounded-lg border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Logs ({filteredLogs.length})
          </h3>
          <button
            onClick={() => setLogs(initialLogs)}
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto font-mono text-sm">
          {filteredLogs.map((log) => {
            const LevelIcon = getLevelIcon(log.level);
            const SourceIcon = getSourceIcon(log.source);
            const isExpanded = expandedLogs.has(log.id);

            return (
              <div key={log.id} className="hover:bg-surface-hover">
                <div
                  className="p-3 flex items-start gap-3 cursor-pointer"
                  onClick={() => log.details && toggleExpand(log.id)}
                >
                  <span className={`p-1 rounded ${getLevelColor(log.level)}`}>
                    <LevelIcon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-foreground-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
                      </span>
                      <span className="text-foreground-muted flex items-center gap-1">
                        <SourceIcon className="w-3 h-3" />
                        {log.source}
                      </span>
                      {log.systemName && (
                        <span className="text-xs px-2 py-0.5 bg-background rounded text-foreground-muted">
                          {log.systemName}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground break-all">{log.message}</p>
                  </div>
                  {log.details && (
                    <button className="p-1 text-foreground-muted">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                {log.details && isExpanded && (
                  <div className="px-3 pb-3 pl-12">
                    <pre className="p-3 bg-background rounded-lg text-foreground-muted text-xs overflow-x-auto whitespace-pre-wrap">
                      {log.details}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
              <p className="text-foreground-muted">Nenhum log encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
