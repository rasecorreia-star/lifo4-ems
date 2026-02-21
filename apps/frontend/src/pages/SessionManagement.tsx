import { useMemo, useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  MapPin,
  Shield,
  LogOut,
  AlertTriangle,
  CheckCircle,
  User,
  Activity,
  Eye,
  Ban,
  RefreshCw,
} from 'lucide-react';

interface Session {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  device: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ip: string;
  location: string;
  startedAt: string;
  lastActivity: string;
  status: 'active' | 'idle' | 'expired';
  isCurrent: boolean;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  ip: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export default function SessionManagement() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'activity' | 'security'>('sessions');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

  const sessions = useMemo<Session[]>(() => [
    {
      id: 'sess-1',
      userId: 'user-1',
      userName: 'Carlos Silva',
      userEmail: 'carlos@lifo4.com.br',
      device: 'desktop',
      browser: 'Chrome 120',
      os: 'Windows 11',
      ip: '187.45.123.45',
      location: 'Teresina, PI',
      startedAt: '2025-01-22T08:30:00',
      lastActivity: '2025-01-22T19:45:00',
      status: 'active',
      isCurrent: true,
    },
    {
      id: 'sess-2',
      userId: 'user-2',
      userName: 'Maria Santos',
      userEmail: 'maria@lifo4.com.br',
      device: 'desktop',
      browser: 'Firefox 121',
      os: 'macOS Sonoma',
      ip: '187.45.123.46',
      location: 'Teresina, PI',
      startedAt: '2025-01-22T09:15:00',
      lastActivity: '2025-01-22T19:30:00',
      status: 'active',
      isCurrent: false,
    },
    {
      id: 'sess-3',
      userId: 'user-3',
      userName: 'Joao Pereira',
      userEmail: 'joao@lifo4.com.br',
      device: 'mobile',
      browser: 'Safari Mobile',
      os: 'iOS 17',
      ip: '187.45.123.47',
      location: 'Parnaiba, PI',
      startedAt: '2025-01-22T14:00:00',
      lastActivity: '2025-01-22T18:20:00',
      status: 'idle',
      isCurrent: false,
    },
    {
      id: 'sess-4',
      userId: 'user-4',
      userName: 'Ana Costa',
      userEmail: 'ana@lifo4.com.br',
      device: 'tablet',
      browser: 'Chrome 120',
      os: 'Android 14',
      ip: '187.45.123.48',
      location: 'Picos, PI',
      startedAt: '2025-01-22T10:45:00',
      lastActivity: '2025-01-22T16:00:00',
      status: 'idle',
      isCurrent: false,
    },
    {
      id: 'sess-5',
      userId: 'user-1',
      userName: 'Carlos Silva',
      userEmail: 'carlos@lifo4.com.br',
      device: 'mobile',
      browser: 'Chrome Mobile',
      os: 'Android 14',
      ip: '187.45.200.15',
      location: 'Teresina, PI',
      startedAt: '2025-01-21T20:00:00',
      lastActivity: '2025-01-21T22:30:00',
      status: 'expired',
      isCurrent: false,
    },
  ], []);

  const activityLogs = useMemo<ActivityLog[]>(() => [
    {
      id: 'act-1',
      userId: 'user-1',
      userName: 'Carlos Silva',
      action: 'Login',
      resource: 'Sistema',
      ip: '187.45.123.45',
      timestamp: '2025-01-22T08:30:00',
      status: 'success',
    },
    {
      id: 'act-2',
      userId: 'user-1',
      userName: 'Carlos Silva',
      action: 'Visualizou',
      resource: 'Dashboard',
      ip: '187.45.123.45',
      timestamp: '2025-01-22T08:31:00',
      status: 'success',
    },
    {
      id: 'act-3',
      userId: 'user-2',
      userName: 'Maria Santos',
      action: 'Editou',
      resource: 'Configuracoes BESS-001',
      ip: '187.45.123.46',
      timestamp: '2025-01-22T09:45:00',
      status: 'success',
    },
    {
      id: 'act-4',
      userId: 'user-3',
      userName: 'Joao Pereira',
      action: 'Exportou',
      resource: 'Relatorio Mensal',
      ip: '187.45.123.47',
      timestamp: '2025-01-22T14:30:00',
      status: 'success',
    },
    {
      id: 'act-5',
      userId: 'user-4',
      userName: 'Ana Costa',
      action: 'Tentou acessar',
      resource: 'Configuracoes Admin',
      ip: '187.45.123.48',
      timestamp: '2025-01-22T11:00:00',
      status: 'warning',
    },
    {
      id: 'act-6',
      userId: 'user-5',
      userName: 'Desconhecido',
      action: 'Login falhou',
      resource: 'Sistema',
      ip: '45.123.45.67',
      timestamp: '2025-01-22T03:15:00',
      status: 'error',
    },
    {
      id: 'act-7',
      userId: 'user-1',
      userName: 'Carlos Silva',
      action: 'Criou',
      resource: 'Agendamento Backup',
      ip: '187.45.123.45',
      timestamp: '2025-01-22T15:00:00',
      status: 'success',
    },
    {
      id: 'act-8',
      userId: 'user-2',
      userName: 'Maria Santos',
      action: 'Alterou senha',
      resource: 'Perfil',
      ip: '187.45.123.46',
      timestamp: '2025-01-22T10:30:00',
      status: 'success',
    },
  ], []);

  const stats = useMemo(() => ({
    activeSessions: sessions.filter(s => s.status === 'active').length,
    idleSessions: sessions.filter(s => s.status === 'idle').length,
    uniqueUsers: new Set(sessions.map(s => s.userId)).size,
    todayLogins: 15,
    failedAttempts: 3,
  }), [sessions]);

  const getDeviceIcon = (device: Session['device']) => {
    switch (device) {
      case 'desktop': return Monitor;
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/20';
      case 'idle': return 'text-amber-500 bg-amber-500/20';
      case 'expired': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'idle': return 'Inativo';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  const getActivityStatusColor = (status: ActivityLog['status']) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getActivityStatusIcon = (status: ActivityLog['status']) => {
    switch (status) {
      case 'success': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'error': return Ban;
      default: return Activity;
    }
  };

  const toggleSession = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const terminateSelected = () => {
    console.log('Terminating sessions:', Array.from(selectedSessions));
    setSelectedSessions(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Sessoes</h1>
          <p className="text-foreground-muted">Monitore sessoes ativas e atividades dos usuarios</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-surface-hover transition-colors">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Sessoes Ativas</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.activeSessions}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Sessoes Inativas</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.idleSessions}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-foreground-muted">Usuarios Online</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.uniqueUsers}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground-muted">Logins Hoje</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.todayLogins}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Tentativas Falhas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.failedAttempts}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: 'sessions', label: 'Sessoes Ativas', icon: Monitor },
            { id: 'activity', label: 'Log de Atividades', icon: Activity },
            { id: 'security', label: 'Seguranca', icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'sessions' && (
        <div className="bg-surface rounded-lg border border-border">
          {selectedSessions.size > 0 && (
            <div className="p-4 bg-primary/10 border-b border-border flex items-center justify-between">
              <span className="text-sm text-foreground">
                {selectedSessions.size} sessao(oes) selecionada(s)
              </span>
              <button
                onClick={terminateSelected}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Encerrar Selecionadas
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSessions(new Set(sessions.filter(s => !s.isCurrent).map(s => s.id)));
                        } else {
                          setSelectedSessions(new Set());
                        }
                      }}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Usuario</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Dispositivo</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Localizacao</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Ultima Atividade</th>
                  <th className="text-right p-4 text-sm font-medium text-foreground-muted">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.device);
                  return (
                    <tr key={session.id} className="hover:bg-surface-hover">
                      <td className="p-4">
                        {!session.isCurrent && (
                          <input
                            type="checkbox"
                            checked={selectedSessions.has(session.id)}
                            onChange={() => toggleSession(session.id)}
                            className="rounded border-border"
                          />
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-medium">
                              {session.userName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {session.userName}
                              {session.isCurrent && (
                                <span className="ml-2 text-xs text-primary">(Voce)</span>
                              )}
                            </p>
                            <p className="text-sm text-foreground-muted">{session.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <DeviceIcon className="w-4 h-4 text-foreground-muted" />
                          <div>
                            <p className="text-sm text-foreground">{session.browser}</p>
                            <p className="text-xs text-foreground-muted">{session.os}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-foreground-muted" />
                          <div>
                            <p className="text-sm text-foreground">{session.location}</p>
                            <p className="text-xs text-foreground-muted">{session.ip}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                          {getStatusLabel(session.status)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-foreground-muted">
                        {new Date(session.lastActivity).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!session.isCurrent && (
                            <button
                              className="p-2 hover:bg-background rounded-lg text-foreground-muted hover:text-red-500 transition-colors"
                              title="Encerrar Sessao"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Log de Atividades Recentes</h3>
            <div className="flex items-center gap-2">
              <select className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground">
                <option value="all">Todas as Acoes</option>
                <option value="login">Login/Logout</option>
                <option value="edit">Edicoes</option>
                <option value="view">Visualizacoes</option>
                <option value="error">Erros</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-border">
            {activityLogs.map((log) => {
              const StatusIcon = getActivityStatusIcon(log.status);
              return (
                <div key={log.id} className="p-4 hover:bg-surface-hover">
                  <div className="flex items-start gap-4">
                    <StatusIcon className={`w-5 h-5 ${getActivityStatusColor(log.status)} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{log.userName}</span>
                        <span className="text-foreground-muted">{log.action}</span>
                        <span className="font-medium text-foreground">{log.resource}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-foreground-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {log.ip}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-border text-center">
            <button className="text-sm text-primary hover:underline">
              Ver Historico Completo
            </button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security Settings */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Configuracoes de Sessao</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Timeout de Inatividade</p>
                  <p className="text-sm text-foreground-muted">Tempo maximo de inatividade antes de encerrar a sessao</p>
                </div>
                <select className="px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="60" selected>1 hora</option>
                  <option value="120">2 horas</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Sessoes Simultaneas</p>
                  <p className="text-sm text-foreground-muted">Numero maximo de sessoes por usuario</p>
                </div>
                <select className="px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="1">1 sessao</option>
                  <option value="3" selected>3 sessoes</option>
                  <option value="5">5 sessoes</option>
                  <option value="0">Ilimitado</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Bloqueio por Tentativas</p>
                  <p className="text-sm text-foreground-muted">Bloquear apos tentativas de login falhas</p>
                </div>
                <select className="px-4 py-2 bg-background border border-border rounded-lg text-foreground">
                  <option value="3">3 tentativas</option>
                  <option value="5" selected>5 tentativas</option>
                  <option value="10">10 tentativas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security Alerts */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Alertas de Seguranca</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Login de Novo Dispositivo</p>
                  <p className="text-sm text-foreground-muted">Notificar quando um usuario logar de um dispositivo novo</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Login de Local Diferente</p>
                  <p className="text-sm text-foreground-muted">Notificar quando um usuario logar de uma localizacao diferente</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Tentativas de Login Falhas</p>
                  <p className="text-sm text-foreground-muted">Notificar sobre tentativas de login falhas repetidas</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Acesso a Recursos Sensiveis</p>
                  <p className="text-sm text-foreground-muted">Notificar quando usuarios acessarem configuracoes criticas</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
            </div>
          </div>

          {/* Blocked IPs */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">IPs Bloqueados</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex items-center gap-3">
                  <Ban className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-foreground">45.123.45.67</p>
                    <p className="text-xs text-foreground-muted">Bloqueado em 22/01/2025 - Tentativas excessivas</p>
                  </div>
                </div>
                <button className="text-sm text-primary hover:underline">Desbloquear</button>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex items-center gap-3">
                  <Ban className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-foreground">192.168.1.100</p>
                    <p className="text-xs text-foreground-muted">Bloqueado em 20/01/2025 - Atividade suspeita</p>
                  </div>
                </div>
                <button className="text-sm text-primary hover:underline">Desbloquear</button>
              </div>
            </div>
            <button className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline">
              <Globe className="w-4 h-4" />
              Adicionar IP a Lista de Bloqueio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
