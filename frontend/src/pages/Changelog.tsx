import { useState, useMemo } from 'react';
import {
  History,
  Plus,
  Bug,
  Sparkles,
  Wrench,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  User,
  ExternalLink,
  Filter,
  Search,
  Rocket,
  Zap,
  GitBranch,
} from 'lucide-react';

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: 'major' | 'minor' | 'patch';
  author: string;
  changes: {
    type: 'feature' | 'bugfix' | 'improvement' | 'security' | 'breaking' | 'deprecated';
    description: string;
    issue?: string;
  }[];
}

export default function Changelog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedVersions, setExpandedVersions] = useState<string[]>(['1']);

  const changelog = useMemo<ChangelogEntry[]>(() => [
    {
      id: '1',
      version: '2.5.0',
      date: '2025-01-25',
      title: 'Previsao de Energia com ML',
      description: 'Adicionado modulo completo de previsao de energia com machine learning, incluindo previsao de demanda, geracao solar e precos.',
      type: 'minor',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'feature', description: 'Novo modulo de previsao de energia com ML', issue: 'LIFO4-456' },
        { type: 'feature', description: 'Calculadora ROI para sistemas BESS', issue: 'LIFO4-457' },
        { type: 'feature', description: 'Dashboard de importacao de dados', issue: 'LIFO4-458' },
        { type: 'improvement', description: 'Performance otimizada do dashboard principal', issue: 'LIFO4-459' },
        { type: 'bugfix', description: 'Corrigido calculo de eficiencia round-trip', issue: 'LIFO4-460' },
        { type: 'security', description: 'Atualizadas dependencias com vulnerabilidades', issue: 'LIFO4-461' },
      ],
    },
    {
      id: '2',
      version: '2.4.2',
      date: '2025-01-20',
      title: 'Correcoes e Melhorias',
      description: 'Release de manutencao com correcoes de bugs e melhorias de performance.',
      type: 'patch',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'bugfix', description: 'Corrigido erro de exibicao no grafico de SoC', issue: 'LIFO4-450' },
        { type: 'bugfix', description: 'Corrigido problema de sincronizacao de dados', issue: 'LIFO4-451' },
        { type: 'improvement', description: 'Melhorada responsividade em dispositivos moveis', issue: 'LIFO4-452' },
        { type: 'improvement', description: 'Otimizada query de historico de alertas', issue: 'LIFO4-453' },
      ],
    },
    {
      id: '3',
      version: '2.4.1',
      date: '2025-01-15',
      title: 'Hotfix de Seguranca',
      description: 'Correcao urgente de vulnerabilidade de seguranca.',
      type: 'patch',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'security', description: 'Corrigida vulnerabilidade de autenticacao', issue: 'LIFO4-445' },
        { type: 'security', description: 'Implementada protecao contra CSRF', issue: 'LIFO4-446' },
      ],
    },
    {
      id: '4',
      version: '2.4.0',
      date: '2025-01-10',
      title: 'Gestao de Ativos e Contratos',
      description: 'Novos modulos de gestao de ativos fisicos, contratos de manutencao e ordens de servico.',
      type: 'minor',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'feature', description: 'Modulo de gestao de ativos', issue: 'LIFO4-430' },
        { type: 'feature', description: 'Gestao de contratos de manutencao', issue: 'LIFO4-431' },
        { type: 'feature', description: 'Sistema de ordens de servico', issue: 'LIFO4-432' },
        { type: 'feature', description: 'Templates de notificacao', issue: 'LIFO4-433' },
        { type: 'improvement', description: 'Novo design do sidebar com categorias', issue: 'LIFO4-434' },
        { type: 'deprecated', description: 'API v1 de notificacoes sera removida em 3.0', issue: 'LIFO4-435' },
      ],
    },
    {
      id: '5',
      version: '2.3.0',
      date: '2025-01-05',
      title: 'Administracao do Sistema',
      description: 'Novos recursos administrativos incluindo backup, licencas, sessoes e logs.',
      type: 'minor',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'feature', description: 'Gestao de backup e restauracao', issue: 'LIFO4-420' },
        { type: 'feature', description: 'Gestao de licencas', issue: 'LIFO4-421' },
        { type: 'feature', description: 'Monitoramento de sessoes ativas', issue: 'LIFO4-422' },
        { type: 'feature', description: 'Visualizador de logs do sistema', issue: 'LIFO4-423' },
        { type: 'feature', description: 'Configuracao de rede', issue: 'LIFO4-424' },
        { type: 'improvement', description: 'Melhorada exportacao de relatorios', issue: 'LIFO4-425' },
      ],
    },
    {
      id: '6',
      version: '2.2.0',
      date: '2024-12-20',
      title: 'Centro de Treinamento e Suporte',
      description: 'Adicionados recursos de treinamento, documentacao e suporte ao usuario.',
      type: 'minor',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'feature', description: 'Centro de treinamento interativo', issue: 'LIFO4-400' },
        { type: 'feature', description: 'Centro de documentacao', issue: 'LIFO4-401' },
        { type: 'feature', description: 'Sistema de tickets de suporte', issue: 'LIFO4-402' },
        { type: 'improvement', description: 'Adicionados tooltips de ajuda', issue: 'LIFO4-403' },
        { type: 'bugfix', description: 'Corrigido problema de navegacao mobile', issue: 'LIFO4-404' },
      ],
    },
    {
      id: '7',
      version: '2.1.0',
      date: '2024-12-15',
      title: 'Integracoes e Diagnosticos',
      description: 'Novos recursos de integracao com sistemas externos e diagnosticos remotos.',
      type: 'minor',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'feature', description: 'Hub de integracoes', issue: 'LIFO4-380' },
        { type: 'feature', description: 'Diagnosticos remotos', issue: 'LIFO4-381' },
        { type: 'feature', description: 'Dashboard multi-site', issue: 'LIFO4-382' },
        { type: 'feature', description: 'SLA Dashboard', issue: 'LIFO4-383' },
        { type: 'improvement', description: 'APIs de integracao otimizadas', issue: 'LIFO4-384' },
      ],
    },
    {
      id: '8',
      version: '2.0.0',
      date: '2024-12-01',
      title: 'Lifo4 EMS 2.0',
      description: 'Major release com redesign completo da interface, nova arquitetura e muitos novos recursos.',
      type: 'major',
      author: 'Equipe Lifo4',
      changes: [
        { type: 'feature', description: 'Nova interface de usuario moderna', issue: 'LIFO4-300' },
        { type: 'feature', description: 'Tema dark/light', issue: 'LIFO4-301' },
        { type: 'feature', description: 'VPP - Virtual Power Plant', issue: 'LIFO4-302' },
        { type: 'feature', description: 'Trading de energia', issue: 'LIFO4-303' },
        { type: 'feature', description: 'Simulacao de cenarios', issue: 'LIFO4-304' },
        { type: 'breaking', description: 'Nova API v2 - v1 descontinuada', issue: 'LIFO4-305' },
        { type: 'breaking', description: 'Novo formato de configuracao', issue: 'LIFO4-306' },
        { type: 'security', description: 'Autenticacao JWT implementada', issue: 'LIFO4-307' },
      ],
    },
  ], []);

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'feature': return Plus;
      case 'bugfix': return Bug;
      case 'improvement': return Sparkles;
      case 'security': return Shield;
      case 'breaking': return AlertTriangle;
      case 'deprecated': return AlertTriangle;
      default: return Wrench;
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'feature': return 'text-success-500 bg-success-500/20';
      case 'bugfix': return 'text-danger-500 bg-danger-500/20';
      case 'improvement': return 'text-primary bg-primary/20';
      case 'security': return 'text-warning-500 bg-warning-500/20';
      case 'breaking': return 'text-danger-500 bg-danger-500/20';
      case 'deprecated': return 'text-warning-500 bg-warning-500/20';
      default: return 'text-foreground-muted bg-surface-hover';
    }
  };

  const getVersionColor = (type: string) => {
    switch (type) {
      case 'major': return 'bg-danger-500 text-white';
      case 'minor': return 'bg-primary text-white';
      case 'patch': return 'bg-success-500 text-white';
      default: return 'bg-surface-hover text-foreground';
    }
  };

  const getChangeLabel = (type: string) => {
    switch (type) {
      case 'feature': return 'Novo';
      case 'bugfix': return 'Correcao';
      case 'improvement': return 'Melhoria';
      case 'security': return 'Seguranca';
      case 'breaking': return 'Breaking';
      case 'deprecated': return 'Deprecado';
      default: return type;
    }
  };

  const toggleVersion = (id: string) => {
    setExpandedVersions((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const filteredChangelog = useMemo(() => {
    return changelog.filter((entry) => {
      const matchesSearch = searchTerm === '' ||
        entry.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.changes.some((c) => c.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = selectedType === 'all' ||
        entry.changes.some((c) => c.type === selectedType);

      return matchesSearch && matchesType;
    });
  }, [changelog, searchTerm, selectedType]);

  const stats = useMemo(() => {
    const allChanges = changelog.flatMap((e) => e.changes);
    return {
      total: allChanges.length,
      features: allChanges.filter((c) => c.type === 'feature').length,
      bugfixes: allChanges.filter((c) => c.type === 'bugfix').length,
      improvements: allChanges.filter((c) => c.type === 'improvement').length,
      security: allChanges.filter((c) => c.type === 'security').length,
    };
  }, [changelog]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Changelog</h1>
            <p className="text-foreground-muted">Historico de atualizacoes do sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">Versao atual:</span>
          <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-medium">
            v{changelog[0].version}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-foreground-muted" />
            <span className="text-xs text-foreground-muted">Total Mudancas</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-success-500" />
            <span className="text-xs text-foreground-muted">Novos Recursos</span>
          </div>
          <p className="text-2xl font-bold text-success-500">{stats.features}</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="w-4 h-4 text-danger-500" />
            <span className="text-xs text-foreground-muted">Correcoes</span>
          </div>
          <p className="text-2xl font-bold text-danger-500">{stats.bugfixes}</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs text-foreground-muted">Melhorias</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.improvements}</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-warning-500" />
            <span className="text-xs text-foreground-muted">Seguranca</span>
          </div>
          <p className="text-2xl font-bold text-warning-500">{stats.security}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar no changelog..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-muted" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">Todos os tipos</option>
            <option value="feature">Novos recursos</option>
            <option value="bugfix">Correcoes</option>
            <option value="improvement">Melhorias</option>
            <option value="security">Seguranca</option>
            <option value="breaking">Breaking Changes</option>
            <option value="deprecated">Deprecados</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-6">
          {filteredChangelog.map((entry) => {
            const isExpanded = expandedVersions.includes(entry.id);

            return (
              <div key={entry.id} className="relative pl-14">
                {/* Timeline Dot */}
                <div className="absolute left-4 top-6 w-4 h-4 rounded-full bg-primary border-4 border-background" />

                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  {/* Version Header */}
                  <button
                    onClick={() => toggleVersion(entry.id)}
                    className="w-full p-6 text-left hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-3 py-1 text-sm font-bold rounded-full ${getVersionColor(entry.type)}`}>
                            v{entry.version}
                          </span>
                          <span className="text-xs text-foreground-muted capitalize">{entry.type}</span>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{entry.title}</h3>
                          <p className="text-sm text-foreground-muted mt-1">{entry.description}</p>

                          <div className="flex items-center gap-4 mt-3 text-xs text-foreground-muted">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {entry.date}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {entry.author}
                            </div>
                            <div className="flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              {entry.changes.length} mudancas
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Change type badges */}
                        <div className="hidden md:flex items-center gap-1">
                          {entry.changes.some((c) => c.type === 'feature') && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-success-500/20 text-success-500 rounded-full">
                              {entry.changes.filter((c) => c.type === 'feature').length} novos
                            </span>
                          )}
                          {entry.changes.some((c) => c.type === 'bugfix') && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-danger-500/20 text-danger-500 rounded-full">
                              {entry.changes.filter((c) => c.type === 'bugfix').length} fixes
                            </span>
                          )}
                          {entry.changes.some((c) => c.type === 'breaking') && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-danger-500/20 text-danger-500 rounded-full">
                              breaking
                            </span>
                          )}
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-foreground-muted" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-foreground-muted" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Changes List */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="divide-y divide-border">
                        {entry.changes.map((change, index) => {
                          const Icon = getChangeIcon(change.type);

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-4 px-6 py-3 hover:bg-surface-hover"
                            >
                              <div className={`w-8 h-8 rounded-lg ${getChangeColor(change.type)} flex items-center justify-center flex-shrink-0`}>
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">{change.description}</p>
                              </div>

                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getChangeColor(change.type)}`}>
                                {getChangeLabel(change.type)}
                              </span>

                              {change.issue && (
                                <a
                                  href={`#${change.issue}`}
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  {change.issue}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roadmap Preview */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Proximas Atualizacoes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-hover rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-warning-500/20 text-warning-500 rounded-full">
                Em Desenvolvimento
              </span>
            </div>
            <h3 className="font-medium text-foreground">v2.6.0</h3>
            <p className="text-sm text-foreground-muted mt-1">
              Integracao com SCADA e novos protocolos de comunicacao
            </p>
          </div>

          <div className="p-4 bg-surface-hover rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                Planejado
              </span>
            </div>
            <h3 className="font-medium text-foreground">v2.7.0</h3>
            <p className="text-sm text-foreground-muted mt-1">
              App mobile nativo e notificacoes push
            </p>
          </div>

          <div className="p-4 bg-surface-hover rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-foreground-muted/20 text-foreground-muted rounded-full">
                Roadmap
              </span>
            </div>
            <h3 className="font-medium text-foreground">v3.0.0</h3>
            <p className="text-sm text-foreground-muted mt-1">
              Nova arquitetura de microservicos e APIs GraphQL
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
