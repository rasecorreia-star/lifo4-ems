import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Filter,
  ChevronRight,
  Mail,
  Phone,
  Building2,
  Calendar,
  Activity,
  ArrowRight,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Target,
  TrendingUp,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// ============================================
// TYPES
// ============================================

export enum ProspectStage {
  LEAD = 'lead',
  QUALIFIED = 'qualified',
  ANALYSIS = 'analysis',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export enum ProspectPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface ProspectContact {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
}

export interface AnalyzerKit {
  id: string;
  serialNumber: string;
  installedAt?: Date;
  returnedAt?: Date;
  status: 'available' | 'installed' | 'returned' | 'lost';
}

export interface Prospect {
  id: string;
  companyName: string;
  tradeName?: string;
  cnpj?: string;
  segment: string;
  contacts: ProspectContact[];
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  stage: ProspectStage;
  priority: ProspectPriority;
  source: string;
  assignedTo: string;
  assignedToName?: string;
  estimatedValue?: number;
  estimatedCapacityKwh?: number;
  analyzerKit?: AnalyzerKit;
  analysisStartDate?: Date;
  analysisEndDate?: Date;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastContactAt?: Date;
  nextFollowUp?: Date;
}

// ============================================
// CONSTANTS
// ============================================

const STAGES: { key: ProspectStage; label: string; color: string; bgColor: string }[] = [
  { key: ProspectStage.LEAD, label: 'Lead', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  { key: ProspectStage.QUALIFIED, label: 'Qualificado', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { key: ProspectStage.ANALYSIS, label: 'Analise', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  { key: ProspectStage.PROPOSAL, label: 'Proposta', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  { key: ProspectStage.NEGOTIATION, label: 'Negociacao', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { key: ProspectStage.WON, label: 'Ganho', color: 'text-success-500', bgColor: 'bg-success-500/20' },
  { key: ProspectStage.LOST, label: 'Perdido', color: 'text-danger-500', bgColor: 'bg-danger-500/20' },
];

const PRIORITY_CONFIG = {
  [ProspectPriority.HIGH]: { label: 'Alta', color: 'text-danger-500', bgColor: 'bg-danger-500/20' },
  [ProspectPriority.MEDIUM]: { label: 'Media', color: 'text-warning-500', bgColor: 'bg-warning-500/20' },
  [ProspectPriority.LOW]: { label: 'Baixa', color: 'text-foreground-muted', bgColor: 'bg-surface-hover' },
};

// ============================================
// MOCK DATA
// ============================================

const MOCK_PROSPECTS: Prospect[] = [
  {
    id: 'p1',
    companyName: 'Industria ABC Ltda',
    tradeName: 'ABC Industrial',
    cnpj: '12.345.678/0001-90',
    segment: 'Industrial',
    contacts: [
      { name: 'Carlos Silva', email: 'carlos@abcindustrial.com', phone: '(11) 99999-1234', role: 'Diretor de Operacoes', isPrimary: true },
    ],
    address: { street: 'Av. Industrial, 1500', city: 'Sao Paulo', state: 'SP', zipCode: '04000-000' },
    stage: ProspectStage.ANALYSIS,
    priority: ProspectPriority.HIGH,
    source: 'Indicacao',
    assignedTo: 'user1',
    assignedToName: 'Joao Vendedor',
    estimatedValue: 450000,
    estimatedCapacityKwh: 500,
    analyzerKit: { id: 'kit1', serialNumber: 'AK-2024-001', installedAt: new Date('2024-01-15'), status: 'installed' },
    analysisStartDate: new Date('2024-01-15'),
    analysisEndDate: new Date('2024-01-29'),
    tags: ['energia solar', 'peak shaving'],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date(),
    lastContactAt: new Date('2024-01-20'),
    nextFollowUp: new Date('2024-01-25'),
  },
  {
    id: 'p2',
    companyName: 'Comercio XYZ SA',
    segment: 'Comercial',
    contacts: [
      { name: 'Maria Santos', email: 'maria@xyz.com', phone: '(11) 98888-5678', role: 'Gerente Financeiro', isPrimary: true },
    ],
    address: { street: 'Rua do Comercio, 500', city: 'Campinas', state: 'SP', zipCode: '13000-000' },
    stage: ProspectStage.PROPOSAL,
    priority: ProspectPriority.HIGH,
    source: 'Website',
    assignedTo: 'user2',
    assignedToName: 'Ana Consultora',
    estimatedValue: 280000,
    estimatedCapacityKwh: 300,
    tags: ['comercio', 'backup'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date(),
    lastContactAt: new Date('2024-01-22'),
    nextFollowUp: new Date('2024-01-26'),
  },
  {
    id: 'p3',
    companyName: 'Hospital Regional',
    segment: 'Saude',
    contacts: [
      { name: 'Dr. Paulo Mendes', email: 'paulo@hospital.com', phone: '(19) 97777-3456', role: 'Diretor Administrativo', isPrimary: true },
    ],
    address: { street: 'Av. da Saude, 200', city: 'Santos', state: 'SP', zipCode: '11000-000' },
    stage: ProspectStage.QUALIFIED,
    priority: ProspectPriority.MEDIUM,
    source: 'Evento',
    assignedTo: 'user1',
    assignedToName: 'Joao Vendedor',
    estimatedValue: 750000,
    estimatedCapacityKwh: 1000,
    tags: ['saude', 'backup critico', 'nobreak'],
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date(),
    lastContactAt: new Date('2024-01-18'),
  },
  {
    id: 'p4',
    companyName: 'Fazenda Sol Nascente',
    segment: 'Agronegocio',
    contacts: [
      { name: 'Roberto Campos', email: 'roberto@solnascente.com', phone: '(18) 96666-7890', role: 'Proprietario', isPrimary: true },
    ],
    address: { street: 'Estrada Rural km 15', city: 'Ribeirao Preto', state: 'SP', zipCode: '14000-000' },
    stage: ProspectStage.LEAD,
    priority: ProspectPriority.LOW,
    source: 'Cold Call',
    assignedTo: 'user2',
    assignedToName: 'Ana Consultora',
    estimatedValue: 180000,
    tags: ['agro', 'irrigacao'],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date(),
  },
  {
    id: 'p5',
    companyName: 'Data Center TechCorp',
    segment: 'Tecnologia',
    contacts: [
      { name: 'Fernando Tech', email: 'fernando@techcorp.com', phone: '(11) 95555-2222', role: 'CTO', isPrimary: true },
    ],
    address: { street: 'Av. Paulista, 1000', city: 'Sao Paulo', state: 'SP', zipCode: '01310-000' },
    stage: ProspectStage.WON,
    priority: ProspectPriority.HIGH,
    source: 'LinkedIn',
    assignedTo: 'user1',
    assignedToName: 'Joao Vendedor',
    estimatedValue: 1200000,
    estimatedCapacityKwh: 2000,
    tags: ['data center', 'alta disponibilidade', 'UPS'],
    createdAt: new Date('2023-11-01'),
    updatedAt: new Date(),
    lastContactAt: new Date('2024-01-15'),
  },
  {
    id: 'p6',
    companyName: 'Supermercados Unidos',
    segment: 'Varejo',
    contacts: [
      { name: 'Patricia Souza', email: 'patricia@unidos.com', isPrimary: true },
    ],
    address: { street: 'Av. Brasil, 3000', city: 'Guarulhos', state: 'SP', zipCode: '07000-000' },
    stage: ProspectStage.LOST,
    priority: ProspectPriority.MEDIUM,
    source: 'Website',
    assignedTo: 'user2',
    assignedToName: 'Ana Consultora',
    estimatedValue: 350000,
    tags: ['varejo', 'refrigeracao'],
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date(),
    notes: 'Perdido para concorrente - preco menor',
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProspectList() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch prospects
  const fetchProspects = async () => {
    try {
      setIsLoading(true);
      // In production, this would call the API
      // const response = await api.get('/prospects');
      // setProspects(response.data.data);

      // Using mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setProspects(MOCK_PROSPECTS);
    } catch (error) {
      console.error('Failed to fetch prospects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  // Filter prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter(prospect => {
      const matchesSearch =
        prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.tradeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.contacts.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage =
        stageFilter === 'all' ||
        (stageFilter === 'active' && ![ProspectStage.WON, ProspectStage.LOST].includes(prospect.stage)) ||
        prospect.stage === stageFilter;

      const matchesPriority =
        priorityFilter === 'all' ||
        prospect.priority === priorityFilter;

      return matchesSearch && matchesStage && matchesPriority;
    });
  }, [prospects, searchQuery, stageFilter, priorityFilter]);

  // Group by stage for pipeline view
  const prospectsByStage = useMemo(() => {
    const grouped: Record<ProspectStage, Prospect[]> = {
      [ProspectStage.LEAD]: [],
      [ProspectStage.QUALIFIED]: [],
      [ProspectStage.ANALYSIS]: [],
      [ProspectStage.PROPOSAL]: [],
      [ProspectStage.NEGOTIATION]: [],
      [ProspectStage.WON]: [],
      [ProspectStage.LOST]: [],
    };

    filteredProspects.forEach(prospect => {
      grouped[prospect.stage].push(prospect);
    });

    return grouped;
  }, [filteredProspects]);

  // Stats
  const stats = useMemo(() => {
    const activeProspects = prospects.filter(p => ![ProspectStage.WON, ProspectStage.LOST].includes(p.stage));
    const totalValue = activeProspects.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);
    const wonValue = prospects
      .filter(p => p.stage === ProspectStage.WON)
      .reduce((sum, p) => sum + (p.estimatedValue || 0), 0);

    return {
      total: prospects.length,
      active: activeProspects.length,
      totalValue,
      wonValue,
      wonCount: prospects.filter(p => p.stage === ProspectStage.WON).length,
      lostCount: prospects.filter(p => p.stage === ProspectStage.LOST).length,
      analysisInProgress: prospects.filter(p => p.stage === ProspectStage.ANALYSIS && p.analyzerKit).length,
    };
  }, [prospects]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospectos</h1>
          <p className="text-foreground-muted text-sm">
            {stats.active} oportunidades ativas | Pipeline: {formatCurrency(stats.totalValue)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/prospects/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Prospecto
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.active}</p>
              <p className="text-xs text-foreground-muted">Ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.analysisInProgress}</p>
              <p className="text-xs text-foreground-muted">Em Analise</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <DollarSign className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{formatCurrency(stats.totalValue)}</p>
              <p className="text-xs text-foreground-muted">Pipeline</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-500/10">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success-500">{stats.wonCount}</p>
              <p className="text-xs text-foreground-muted">Ganhos</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger-500/10">
              <XCircle className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-danger-500">{stats.lostCount}</p>
              <p className="text-xs text-foreground-muted">Perdidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por empresa ou contato..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="active">Ativos</option>
            <option value="all">Todos</option>
            {STAGES.map(stage => (
              <option key={stage.key} value={stage.key}>{stage.label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todas Prioridades</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baixa</option>
          </select>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={cn(
                'px-3 py-2 transition-colors',
                viewMode === 'pipeline' ? 'bg-primary text-white' : 'bg-surface text-foreground-muted hover:bg-surface-hover'
              )}
              title="Visualizacao Pipeline"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-2 transition-colors',
                viewMode === 'list' ? 'bg-primary text-white' : 'bg-surface text-foreground-muted hover:bg-surface-hover'
              )}
              title="Visualizacao Lista"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={fetchProspects}
            className="p-2.5 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-foreground-muted', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4 h-96 animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'pipeline' ? (
        /* Pipeline View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter(stage =>
            stageFilter === 'all' ||
            stageFilter === 'active' && ![ProspectStage.WON, ProspectStage.LOST].includes(stage.key) ||
            stage.key === stageFilter
          ).map(stage => (
            <div key={stage.key} className="flex-shrink-0 w-72">
              <div className="bg-surface rounded-xl border border-border">
                {/* Stage Header */}
                <div className={cn('p-3 rounded-t-xl border-b border-border', stage.bgColor)}>
                  <div className="flex items-center justify-between">
                    <h3 className={cn('font-semibold', stage.color)}>{stage.label}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-background/50 text-foreground-muted">
                      {prospectsByStage[stage.key].length}
                    </span>
                  </div>
                  {prospectsByStage[stage.key].length > 0 && (
                    <p className="text-xs text-foreground-muted mt-1">
                      {formatCurrency(prospectsByStage[stage.key].reduce((sum, p) => sum + (p.estimatedValue || 0), 0))}
                    </p>
                  )}
                </div>
                {/* Stage Cards */}
                <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                  {prospectsByStage[stage.key].map(prospect => (
                    <ProspectCard key={prospect.id} prospect={prospect} formatCurrency={formatCurrency} />
                  ))}
                  {prospectsByStage[stage.key].length === 0 && (
                    <div className="p-4 text-center text-foreground-muted text-sm">
                      Nenhum prospecto
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Empresa</th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Contato</th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Estagio</th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Prioridade</th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Valor Est.</th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Responsavel</th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">Proximo Contato</th>
                <th className="text-right p-4 text-sm font-medium text-foreground-muted">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredProspects.map(prospect => {
                const stageConfig = STAGES.find(s => s.key === prospect.stage);
                const priorityConfig = PRIORITY_CONFIG[prospect.priority];
                const primaryContact = prospect.contacts.find(c => c.isPrimary);

                return (
                  <tr key={prospect.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                    <td className="p-4">
                      <Link to={`/prospects/${prospect.id}`} className="hover:text-primary">
                        <p className="font-medium text-foreground">{prospect.companyName}</p>
                        <p className="text-sm text-foreground-muted">{prospect.segment}</p>
                      </Link>
                    </td>
                    <td className="p-4">
                      {primaryContact && (
                        <div>
                          <p className="text-foreground">{primaryContact.name}</p>
                          <p className="text-sm text-foreground-muted">{primaryContact.email}</p>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={cn('px-2 py-1 text-xs font-medium rounded-full', stageConfig?.bgColor, stageConfig?.color)}>
                        {stageConfig?.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={cn('px-2 py-1 text-xs font-medium rounded-full', priorityConfig.bgColor, priorityConfig.color)}>
                        {priorityConfig.label}
                      </span>
                    </td>
                    <td className="p-4 text-foreground">
                      {prospect.estimatedValue ? formatCurrency(prospect.estimatedValue) : '-'}
                    </td>
                    <td className="p-4 text-foreground-muted">
                      {prospect.assignedToName || '-'}
                    </td>
                    <td className="p-4 text-foreground-muted">
                      {formatDate(prospect.nextFollowUp)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/prospects/${prospect.id}`}
                          className="p-1.5 hover:bg-surface-active rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-foreground-muted" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// PROSPECT CARD COMPONENT
// ============================================

interface ProspectCardProps {
  prospect: Prospect;
  formatCurrency: (value: number) => string;
}

function ProspectCard({ prospect, formatCurrency }: ProspectCardProps) {
  const priorityConfig = PRIORITY_CONFIG[prospect.priority];
  const primaryContact = prospect.contacts.find(c => c.isPrimary);

  return (
    <Link
      to={`/prospects/${prospect.id}`}
      className="block p-3 bg-background rounded-lg hover:bg-surface-hover transition-all border border-transparent hover:border-border group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
          {prospect.companyName}
        </h4>
        <span className={cn('px-1.5 py-0.5 text-2xs font-medium rounded', priorityConfig.bgColor, priorityConfig.color)}>
          {priorityConfig.label}
        </span>
      </div>

      {primaryContact && (
        <p className="text-xs text-foreground-muted mb-2 line-clamp-1">
          {primaryContact.name}
        </p>
      )}

      {prospect.estimatedValue && (
        <p className="text-sm font-semibold text-secondary mb-2">
          {formatCurrency(prospect.estimatedValue)}
        </p>
      )}

      {prospect.analyzerKit?.status === 'installed' && (
        <div className="flex items-center gap-1 text-xs text-purple-400 mb-2">
          <Zap className="w-3 h-3" />
          <span>Kit em analise</span>
        </div>
      )}

      <div className="flex items-center justify-between text-2xs text-foreground-subtle">
        {prospect.nextFollowUp && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date(prospect.nextFollowUp).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
        <span>{prospect.segment}</span>
      </div>

      {prospect.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {prospect.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 text-2xs bg-surface-hover text-foreground-muted rounded">
              {tag}
            </span>
          ))}
          {prospect.tags.length > 2 && (
            <span className="px-1.5 py-0.5 text-2xs text-foreground-subtle">
              +{prospect.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
