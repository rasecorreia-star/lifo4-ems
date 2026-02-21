import { useState, useMemo } from 'react';
import {
  Scale,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
  TrendingUp,
  Shield,
  Download,
  ExternalLink,
  ChevronRight,
  Bell,
  Building2,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface Regulation {
  id: string;
  code: string;
  name: string;
  agency: 'ANEEL' | 'ONS' | 'ABNT' | 'INMETRO';
  category: string;
  status: 'compliant' | 'pending' | 'non_compliant' | 'in_review';
  lastAudit: string;
  nextAudit: string;
  compliance: number;
  requirements: number;
  fulfilled: number;
}

interface Deadline {
  id: string;
  title: string;
  regulation: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'overdue';
}

export default function Compliance() {
  const [activeTab, setActiveTab] = useState<'overview' | 'regulations' | 'deadlines' | 'reports'>('overview');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');

  const regulations: Regulation[] = useMemo(() => [
    {
      id: '1',
      code: 'REN 482/2012',
      name: 'Geracao Distribuida',
      agency: 'ANEEL',
      category: 'Geracao',
      status: 'compliant',
      lastAudit: '2024-12-15',
      nextAudit: '2025-06-15',
      compliance: 100,
      requirements: 12,
      fulfilled: 12,
    },
    {
      id: '2',
      code: 'REN 1000/2021',
      name: 'Consolidacao Regulatoria',
      agency: 'ANEEL',
      category: 'Geral',
      status: 'compliant',
      lastAudit: '2024-11-20',
      nextAudit: '2025-05-20',
      compliance: 100,
      requirements: 28,
      fulfilled: 28,
    },
    {
      id: '3',
      code: 'PRODIST Mod. 3',
      name: 'Acesso ao Sistema de Distribuicao',
      agency: 'ANEEL',
      category: 'Conexao',
      status: 'pending',
      lastAudit: '2024-10-10',
      nextAudit: '2025-04-10',
      compliance: 85,
      requirements: 20,
      fulfilled: 17,
    },
    {
      id: '4',
      code: 'ONS NT 034',
      name: 'Requisitos Tecnicos de Conexao',
      agency: 'ONS',
      category: 'Conexao',
      status: 'in_review',
      lastAudit: '2024-12-01',
      nextAudit: '2025-03-01',
      compliance: 92,
      requirements: 15,
      fulfilled: 14,
    },
    {
      id: '5',
      code: 'ABNT NBR 16690',
      name: 'Instalacoes Eletricas de Baixa Tensao',
      agency: 'ABNT',
      category: 'Seguranca',
      status: 'compliant',
      lastAudit: '2024-09-15',
      nextAudit: '2025-09-15',
      compliance: 100,
      requirements: 45,
      fulfilled: 45,
    },
    {
      id: '6',
      code: 'ABNT NBR 5410',
      name: 'Instalacoes Eletricas de Baixa Tensao - Geral',
      agency: 'ABNT',
      category: 'Seguranca',
      status: 'compliant',
      lastAudit: '2024-08-20',
      nextAudit: '2025-08-20',
      compliance: 100,
      requirements: 62,
      fulfilled: 62,
    },
    {
      id: '7',
      code: 'INMETRO NR-10',
      name: 'Seguranca em Instalacoes Eletricas',
      agency: 'INMETRO',
      category: 'Seguranca',
      status: 'compliant',
      lastAudit: '2024-11-01',
      nextAudit: '2025-11-01',
      compliance: 100,
      requirements: 35,
      fulfilled: 35,
    },
    {
      id: '8',
      code: 'REN 1059/2023',
      name: 'Armazenamento de Energia',
      agency: 'ANEEL',
      category: 'Armazenamento',
      status: 'pending',
      lastAudit: '2025-01-10',
      nextAudit: '2025-07-10',
      compliance: 75,
      requirements: 8,
      fulfilled: 6,
    },
  ], []);

  const deadlines: Deadline[] = useMemo(() => [
    {
      id: '1',
      title: 'Relatorio de Desempenho Trimestral',
      regulation: 'REN 482/2012',
      dueDate: '2025-01-31',
      priority: 'high',
      status: 'pending',
    },
    {
      id: '2',
      title: 'Atualizacao de Documentacao Tecnica',
      regulation: 'PRODIST Mod. 3',
      dueDate: '2025-02-15',
      priority: 'medium',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Auditoria de Seguranca NR-10',
      regulation: 'INMETRO NR-10',
      dueDate: '2025-02-28',
      priority: 'high',
      status: 'pending',
    },
    {
      id: '4',
      title: 'Teste de Resposta a Emergencia',
      regulation: 'ABNT NBR 16690',
      dueDate: '2025-01-20',
      priority: 'high',
      status: 'overdue',
    },
    {
      id: '5',
      title: 'Certificacao de Equipamentos',
      regulation: 'ONS NT 034',
      dueDate: '2025-03-10',
      priority: 'medium',
      status: 'pending',
    },
  ], []);

  const filteredRegulations = useMemo(() => {
    if (agencyFilter === 'all') return regulations;
    return regulations.filter(r => r.agency === agencyFilter);
  }, [regulations, agencyFilter]);

  const stats = useMemo(() => {
    const compliant = regulations.filter(r => r.status === 'compliant').length;
    const pending = regulations.filter(r => r.status === 'pending' || r.status === 'in_review').length;
    const nonCompliant = regulations.filter(r => r.status === 'non_compliant').length;
    const avgCompliance = regulations.reduce((sum, r) => sum + r.compliance, 0) / regulations.length;
    return { compliant, pending, nonCompliant, avgCompliance, total: regulations.length };
  }, [regulations]);

  const radarData = useMemo(() => [
    { category: 'Geracao', value: 100 },
    { category: 'Conexao', value: 88 },
    { category: 'Seguranca', value: 100 },
    { category: 'Armazenamento', value: 75 },
    { category: 'Geral', value: 100 },
  ], []);

  const complianceByAgency = useMemo(() => {
    const agencies = ['ANEEL', 'ONS', 'ABNT', 'INMETRO'];
    return agencies.map(agency => {
      const agencyRegs = regulations.filter(r => r.agency === agency);
      const avg = agencyRegs.length > 0
        ? agencyRegs.reduce((sum, r) => sum + r.compliance, 0) / agencyRegs.length
        : 0;
      return { agency, compliance: avg };
    });
  }, [regulations]);

  const getStatusBadge = (status: Regulation['status']) => {
    switch (status) {
      case 'compliant':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500"><CheckCircle className="w-3 h-3" /> Conforme</span>;
      case 'pending':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500"><Clock className="w-3 h-3" /> Pendente</span>;
      case 'in_review':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/20 text-primary"><FileText className="w-3 h-3" /> Em Revisao</span>;
      case 'non_compliant':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500"><AlertTriangle className="w-3 h-3" /> Nao Conforme</span>;
    }
  };

  const getPriorityBadge = (priority: Deadline['priority']) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Alta</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Media</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Baixa</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conformidade Regulatoria</h1>
          <p className="text-foreground-muted">Acompanhamento de normas ANEEL, ONS, ABNT e INMETRO</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Total Normas</p>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Conformes</p>
              <p className="text-xl font-bold text-success-500">{stats.compliant}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Pendentes</p>
              <p className="text-xl font-bold text-warning-500">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Nao Conformes</p>
              <p className="text-xl font-bold text-danger-500">{stats.nonCompliant}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Conformidade</p>
              <p className="text-xl font-bold text-foreground">{stats.avgCompliance.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          Visao Geral
        </button>
        <button
          onClick={() => setActiveTab('regulations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'regulations'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          Normas
        </button>
        <button
          onClick={() => setActiveTab('deadlines')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'deadlines'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          Prazos
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          Relatorios
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Conformidade por Categoria</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(var(--foreground-muted))', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <Radar name="Conformidade" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Compliance by Agency */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Conformidade por Orgao</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceByAgency} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--foreground-muted))' }} />
                <YAxis type="category" dataKey="agency" tick={{ fill: 'hsl(var(--foreground-muted))' }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => `${value.toFixed(0)}%`}
                />
                <Bar dataKey="compliance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Proximos Prazos</h3>
              <button className="text-sm text-primary hover:underline">Ver todos</button>
            </div>
            <div className="space-y-3">
              {deadlines.slice(0, 4).map((deadline) => (
                <div
                  key={deadline.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    deadline.status === 'overdue' ? 'bg-danger-500/10' : 'bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className={`w-5 h-5 ${
                      deadline.status === 'overdue' ? 'text-danger-500' : 'text-foreground-muted'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{deadline.title}</p>
                      <p className="text-xs text-foreground-muted">{deadline.regulation}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${
                      deadline.status === 'overdue' ? 'text-danger-500' : 'text-foreground'
                    }`}>
                      {new Date(deadline.dueDate).toLocaleDateString('pt-BR')}
                    </p>
                    {getPriorityBadge(deadline.priority)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Links Uteis</h3>
            <div className="space-y-3">
              {[
                { name: 'Portal ANEEL', url: 'https://www.aneel.gov.br', agency: 'ANEEL' },
                { name: 'ONS - Procedimentos de Rede', url: 'https://www.ons.org.br', agency: 'ONS' },
                { name: 'ABNT Catalogo', url: 'https://www.abntcatalogo.com.br', agency: 'ABNT' },
                { name: 'INMETRO Regulamentos', url: 'https://www.inmetro.gov.br', agency: 'INMETRO' },
              ].map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-surface-hover rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{link.name}</p>
                      <p className="text-xs text-foreground-muted">{link.agency}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-foreground-muted" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Regulations Tab */}
      {activeTab === 'regulations' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'ANEEL', 'ONS', 'ABNT', 'INMETRO'].map((agency) => (
              <button
                key={agency}
                onClick={() => setAgencyFilter(agency)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  agencyFilter === agency
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-foreground hover:bg-surface-hover'
                }`}
              >
                {agency === 'all' ? 'Todos' : agency}
              </button>
            ))}
          </div>

          {/* Regulations List */}
          <div className="space-y-3">
            {filteredRegulations.map((regulation) => (
              <div key={regulation.id} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      regulation.status === 'compliant' ? 'bg-success-500/20' :
                      regulation.status === 'non_compliant' ? 'bg-danger-500/20' :
                      'bg-warning-500/20'
                    }`}>
                      <Scale className={`w-6 h-6 ${
                        regulation.status === 'compliant' ? 'text-success-500' :
                        regulation.status === 'non_compliant' ? 'text-danger-500' :
                        'text-warning-500'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-primary">{regulation.code}</span>
                        <span className="px-2 py-0.5 text-xs bg-surface-hover rounded">{regulation.agency}</span>
                      </div>
                      <h3 className="font-semibold text-foreground">{regulation.name}</h3>
                      <p className="text-sm text-foreground-muted">Categoria: {regulation.category}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Requisitos</p>
                      <p className="text-sm font-semibold text-foreground">
                        {regulation.fulfilled}/{regulation.requirements}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Conformidade</p>
                      <p className={`text-lg font-bold ${
                        regulation.compliance >= 90 ? 'text-success-500' :
                        regulation.compliance >= 70 ? 'text-warning-500' :
                        'text-danger-500'
                      }`}>
                        {regulation.compliance}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Prox. Auditoria</p>
                      <p className="text-sm text-foreground">
                        {new Date(regulation.nextAudit).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      {getStatusBadge(regulation.status)}
                    </div>
                    <button className="p-2 hover:bg-surface-hover rounded-lg">
                      <ChevronRight className="w-5 h-5 text-foreground-muted" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadlines Tab */}
      {activeTab === 'deadlines' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-hover">
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Tarefa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Norma</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Prazo</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Prioridade</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deadlines.map((deadline) => (
                  <tr key={deadline.id} className={`hover:bg-surface-hover ${
                    deadline.status === 'overdue' ? 'bg-danger-500/5' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Bell className={`w-4 h-4 ${
                          deadline.status === 'overdue' ? 'text-danger-500' : 'text-foreground-muted'
                        }`} />
                        <span className="text-sm font-medium text-foreground">{deadline.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground-muted">{deadline.regulation}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm ${
                        deadline.status === 'overdue' ? 'text-danger-500 font-semibold' : 'text-foreground'
                      }`}>
                        {new Date(deadline.dueDate).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getPriorityBadge(deadline.priority)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {deadline.status === 'overdue' ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Atrasado</span>
                      ) : deadline.status === 'completed' ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Concluido</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">
                        {deadline.status === 'completed' ? 'Ver' : 'Completar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Relatorio de Conformidade Geral', date: '2025-01-15', type: 'PDF' },
            { title: 'Auditoria ANEEL Q4 2024', date: '2024-12-20', type: 'PDF' },
            { title: 'Checklist ONS NT 034', date: '2025-01-10', type: 'XLSX' },
            { title: 'Certificados e Laudos', date: '2024-11-30', type: 'ZIP' },
            { title: 'Plano de Acao Pendencias', date: '2025-01-05', type: 'PDF' },
            { title: 'Historico de Auditorias', date: '2024-12-01', type: 'PDF' },
          ].map((report, index) => (
            <div key={index} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{report.title}</p>
                    <p className="text-xs text-foreground-muted mt-1">
                      {new Date(report.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 text-xs bg-surface-hover rounded">{report.type}</span>
              </div>
              <button className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-surface-hover hover:bg-primary/10 rounded-lg text-sm transition-colors">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
