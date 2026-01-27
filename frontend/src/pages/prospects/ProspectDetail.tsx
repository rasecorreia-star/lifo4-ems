import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Edit,
  Trash2,
  MoreVertical,
  Plus,
  FileText,
  Activity,
  DollarSign,
  Target,
  Zap,
  ChevronRight,
  User,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Tag,
  Paperclip,
  Download,
  BarChart3,
  Settings,
  History,
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
  id: string;
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

export interface LoadAnalysisSummary {
  id: string;
  analyzedDays: number;
  avgDailyConsumption: number;
  peakDemand: number;
  avgDemand: number;
  peakShavingPotential: number;
  arbitragePotential: number;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: Date;
}

export interface ProposalSummary {
  id: string;
  version: number;
  tierName: string;
  systemSizeKwh: number;
  totalValue: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date;
  sentAt?: Date;
  validUntil?: Date;
}

export interface ActivityLog {
  id: string;
  type: 'note' | 'email' | 'call' | 'meeting' | 'stage_change' | 'proposal' | 'system';
  title: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
}

export interface Prospect {
  id: string;
  companyName: string;
  tradeName?: string;
  cnpj?: string;
  segment: string;
  website?: string;
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
  loadAnalysis?: LoadAnalysisSummary;
  proposals: ProposalSummary[];
  activities: ActivityLog[];
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastContactAt?: Date;
  nextFollowUp?: Date;
  lostReason?: string;
  wonDate?: Date;
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

const ACTIVITY_ICONS = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Calendar,
  stage_change: Activity,
  proposal: FileText,
  system: Settings,
};

// ============================================
// MOCK DATA
// ============================================

const MOCK_PROSPECT: Prospect = {
  id: 'p1',
  companyName: 'Industria ABC Ltda',
  tradeName: 'ABC Industrial',
  cnpj: '12.345.678/0001-90',
  segment: 'Industrial',
  website: 'https://www.abcindustrial.com.br',
  contacts: [
    { id: 'c1', name: 'Carlos Silva', email: 'carlos@abcindustrial.com', phone: '(11) 99999-1234', role: 'Diretor de Operacoes', isPrimary: true },
    { id: 'c2', name: 'Ana Pereira', email: 'ana@abcindustrial.com', phone: '(11) 99888-5678', role: 'Gerente de Facilities', isPrimary: false },
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
  loadAnalysis: {
    id: 'la1',
    analyzedDays: 10,
    avgDailyConsumption: 1250,
    peakDemand: 320,
    avgDemand: 180,
    peakShavingPotential: 85000,
    arbitragePotential: 42000,
    status: 'in_progress',
  },
  proposals: [
    {
      id: 'prop1',
      version: 1,
      tierName: 'Recomendado',
      systemSizeKwh: 500,
      totalValue: 425000,
      status: 'draft',
      createdAt: new Date('2024-01-20'),
    },
  ],
  activities: [
    { id: 'a1', type: 'stage_change', title: 'Estagio alterado para Analise', createdAt: new Date('2024-01-15'), createdBy: 'user1', createdByName: 'Joao Vendedor' },
    { id: 'a2', type: 'system', title: 'Kit analisador instalado', description: 'Serial: AK-2024-001', createdAt: new Date('2024-01-15'), createdBy: 'user1', createdByName: 'Joao Vendedor' },
    { id: 'a3', type: 'meeting', title: 'Reuniao de apresentacao', description: 'Apresentado solucao BESS, cliente interessado em reducao de demanda', createdAt: new Date('2024-01-12'), createdBy: 'user1', createdByName: 'Joao Vendedor' },
    { id: 'a4', type: 'call', title: 'Ligacao de qualificacao', description: 'Cliente com conta de energia acima de R$ 50k/mes', createdAt: new Date('2024-01-10'), createdBy: 'user1', createdByName: 'Joao Vendedor' },
    { id: 'a5', type: 'note', title: 'Lead recebido', description: 'Indicacao do cliente TechCorp', createdAt: new Date('2024-01-10'), createdBy: 'user1', createdByName: 'Joao Vendedor' },
  ],
  tags: ['energia solar', 'peak shaving', 'industrial'],
  createdAt: new Date('2024-01-10'),
  updatedAt: new Date(),
  lastContactAt: new Date('2024-01-20'),
  nextFollowUp: new Date('2024-01-25'),
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProspectDetail() {
  const { prospectId } = useParams<{ prospectId: string }>();
  const navigate = useNavigate();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'proposals' | 'activities'>('overview');
  const [newNote, setNewNote] = useState('');
  const [showStageModal, setShowStageModal] = useState(false);

  // Fetch prospect data
  const fetchProspect = async () => {
    if (!prospectId) return;

    try {
      setIsLoading(true);
      setError(null);
      // In production: const response = await api.get(`/prospects/${prospectId}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      setProspect(MOCK_PROSPECT);
    } catch (err) {
      setError('Falha ao carregar dados do prospecto');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProspect();
  }, [prospectId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    // In production: await api.post(`/prospects/${prospectId}/activities`, { type: 'note', title: 'Nota adicionada', description: newNote });
    console.log('Adding note:', newNote);
    setNewNote('');
    // Refresh data
  };

  const handleStageChange = async (newStage: ProspectStage) => {
    // In production: await api.patch(`/prospects/${prospectId}`, { stage: newStage });
    console.log('Changing stage to:', newStage);
    setShowStageModal(false);
    // Refresh data
  };

  if (isLoading) {
    return <ProspectDetailSkeleton />;
  }

  if (error || !prospect) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Prospecto nao encontrado'}
        </h2>
        <Link
          to="/prospects"
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para prospectos
        </Link>
      </div>
    );
  }

  const stageConfig = STAGES.find(s => s.key === prospect.stage);
  const priorityConfig = PRIORITY_CONFIG[prospect.priority];
  const primaryContact = prospect.contacts.find(c => c.isPrimary);
  const currentStageIndex = STAGES.findIndex(s => s.key === prospect.stage);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            to="/prospects"
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors mt-1"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{prospect.companyName}</h1>
              <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', stageConfig?.bgColor, stageConfig?.color)}>
                {stageConfig?.label}
              </span>
              <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', priorityConfig.bgColor, priorityConfig.color)}>
                {priorityConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-foreground-muted">
              {prospect.tradeName && <span>{prospect.tradeName}</span>}
              <span>{prospect.segment}</span>
              {prospect.cnpj && <span>CNPJ: {prospect.cnpj}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStageModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Activity className="w-4 h-4" />
            Mudar Estagio
          </button>
          <Link
            to={`/prospects/${prospect.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-surface-hover rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
            Editar
          </Link>
          {prospect.stage === ProspectStage.ANALYSIS && prospect.loadAnalysis && (
            <Link
              to={`/prospects/${prospect.id}/analysis`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Ver Analise
            </Link>
          )}
          <Link
            to={`/prospects/${prospect.id}/recommendations`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors"
          >
            <Target className="w-4 h-4" />
            Recomendacoes
          </Link>
          <Link
            to={`/prospects/${prospect.id}/proposal/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Nova Proposta
          </Link>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          {STAGES.filter(s => s.key !== ProspectStage.WON && s.key !== ProspectStage.LOST).map((stage, index) => {
            const isActive = stage.key === prospect.stage;
            const isCompleted = index < currentStageIndex && prospect.stage !== ProspectStage.LOST;
            const isLost = prospect.stage === ProspectStage.LOST;

            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                      isActive ? `${stage.bgColor} ${stage.color} border-current` :
                      isCompleted ? 'bg-success-500/20 text-success-500 border-success-500' :
                      isLost ? 'bg-danger-500/10 text-danger-500/50 border-danger-500/30' :
                      'bg-surface-hover text-foreground-muted border-border'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : isLost ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs mt-2 font-medium',
                    isActive ? stage.color : isCompleted ? 'text-success-500' : 'text-foreground-muted'
                  )}>
                    {stage.label}
                  </span>
                </div>
                {index < STAGES.length - 3 && (
                  <div className={cn(
                    'h-0.5 flex-1 -mt-6',
                    isCompleted ? 'bg-success-500' : 'bg-border'
                  )} />
                )}
              </div>
            );
          })}
        </div>
        {prospect.stage === ProspectStage.WON && (
          <div className="mt-4 p-3 bg-success-500/10 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success-500" />
            <span className="text-success-500 font-medium">Negocio fechado em {formatDate(prospect.wonDate)}</span>
          </div>
        )}
        {prospect.stage === ProspectStage.LOST && (
          <div className="mt-4 p-3 bg-danger-500/10 rounded-lg flex items-center gap-3">
            <XCircle className="w-5 h-5 text-danger-500" />
            <span className="text-danger-500 font-medium">
              Oportunidade perdida{prospect.lostReason && `: ${prospect.lostReason}`}
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="flex border-b border-border">
              {[
                { key: 'overview', label: 'Visao Geral', icon: Building2 },
                { key: 'analysis', label: 'Analise', icon: BarChart3 },
                { key: 'proposals', label: 'Propostas', icon: FileText },
                { key: 'activities', label: 'Atividades', icon: History },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-foreground-muted hover:text-foreground'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Contacts */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Contatos
                    </h3>
                    <div className="space-y-3">
                      {prospect.contacts.map(contact => (
                        <div key={contact.id} className="flex items-start justify-between p-3 bg-background rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{contact.name}</p>
                              {contact.isPrimary && (
                                <span className="px-1.5 py-0.5 text-2xs bg-primary/20 text-primary rounded">Principal</span>
                              )}
                            </div>
                            {contact.role && <p className="text-sm text-foreground-muted">{contact.role}</p>}
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </a>
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-foreground-muted hover:text-foreground">
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereco
                    </h3>
                    <p className="text-foreground-muted">
                      {prospect.address.street}<br />
                      {prospect.address.city} - {prospect.address.state}, {prospect.address.zipCode}
                    </p>
                  </div>

                  {/* Tags */}
                  {prospect.tags.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {prospect.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 text-sm bg-surface-hover text-foreground-muted rounded-lg">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {prospect.notes && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Observacoes
                      </h3>
                      <p className="text-foreground-muted whitespace-pre-wrap">{prospect.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-4">
                  {prospect.analyzerKit ? (
                    <>
                      {/* Analyzer Kit Status */}
                      <div className="p-4 bg-purple-500/10 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-purple-400" />
                            <span className="font-medium text-purple-400">Kit Analisador</span>
                          </div>
                          <span className={cn(
                            'px-2 py-0.5 text-xs rounded-full',
                            prospect.analyzerKit.status === 'installed' ? 'bg-success-500/20 text-success-500' :
                            prospect.analyzerKit.status === 'returned' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-surface-hover text-foreground-muted'
                          )}>
                            {prospect.analyzerKit.status === 'installed' ? 'Instalado' :
                             prospect.analyzerKit.status === 'returned' ? 'Devolvido' : prospect.analyzerKit.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-foreground-muted">Serial</p>
                            <p className="text-foreground font-medium">{prospect.analyzerKit.serialNumber}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Instalado em</p>
                            <p className="text-foreground font-medium">{formatDate(prospect.analyzerKit.installedAt)}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Periodo de Analise</p>
                            <p className="text-foreground font-medium">
                              {formatDate(prospect.analysisStartDate)} - {formatDate(prospect.analysisEndDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Dias Analisados</p>
                            <p className="text-foreground font-medium">{prospect.loadAnalysis?.analyzedDays || 0} dias</p>
                          </div>
                        </div>
                      </div>

                      {/* Analysis Summary */}
                      {prospect.loadAnalysis && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-foreground">Resumo da Analise</h4>
                            <Link
                              to={`/prospects/${prospect.id}/analysis`}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              Ver detalhes <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-background rounded-lg">
                              <p className="text-foreground-muted text-sm">Consumo Medio Diario</p>
                              <p className="text-xl font-bold text-foreground">{prospect.loadAnalysis.avgDailyConsumption.toLocaleString()} kWh</p>
                            </div>
                            <div className="p-3 bg-background rounded-lg">
                              <p className="text-foreground-muted text-sm">Demanda de Pico</p>
                              <p className="text-xl font-bold text-foreground">{prospect.loadAnalysis.peakDemand} kW</p>
                            </div>
                            <div className="p-3 bg-background rounded-lg">
                              <p className="text-foreground-muted text-sm">Potencial Peak Shaving</p>
                              <p className="text-xl font-bold text-success-500">{formatCurrency(prospect.loadAnalysis.peakShavingPotential)}/ano</p>
                            </div>
                            <div className="p-3 bg-background rounded-lg">
                              <p className="text-foreground-muted text-sm">Potencial Arbitragem</p>
                              <p className="text-xl font-bold text-secondary">{formatCurrency(prospect.loadAnalysis.arbitragePotential)}/ano</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Zap className="w-12 h-12 mx-auto mb-3 text-foreground-subtle" />
                      <h4 className="font-medium text-foreground mb-2">Nenhum kit instalado</h4>
                      <p className="text-foreground-muted text-sm mb-4">
                        Instale um kit analisador para coletar dados de consumo
                      </p>
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg">
                        <Plus className="w-4 h-4" />
                        Instalar Kit
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'proposals' && (
                <div className="space-y-4">
                  {prospect.proposals.length > 0 ? (
                    prospect.proposals.map(proposal => (
                      <Link
                        key={proposal.id}
                        to={`/prospects/${prospect.id}/proposals/${proposal.id}`}
                        className="block p-4 bg-background rounded-lg hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            <span className="font-medium text-foreground">
                              Proposta v{proposal.version} - {proposal.tierName}
                            </span>
                          </div>
                          <span className={cn(
                            'px-2 py-0.5 text-xs rounded-full',
                            proposal.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                            proposal.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                            proposal.status === 'viewed' ? 'bg-purple-500/20 text-purple-400' :
                            proposal.status === 'accepted' ? 'bg-success-500/20 text-success-500' :
                            proposal.status === 'rejected' ? 'bg-danger-500/20 text-danger-500' :
                            'bg-warning-500/20 text-warning-500'
                          )}>
                            {proposal.status === 'draft' ? 'Rascunho' :
                             proposal.status === 'sent' ? 'Enviada' :
                             proposal.status === 'viewed' ? 'Visualizada' :
                             proposal.status === 'accepted' ? 'Aceita' :
                             proposal.status === 'rejected' ? 'Rejeitada' : 'Expirada'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-foreground-muted">
                          <span>{proposal.systemSizeKwh} kWh</span>
                          <span>{formatCurrency(proposal.totalValue)}</span>
                          <span>Criada em {formatDate(proposal.createdAt)}</span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-foreground-subtle" />
                      <h4 className="font-medium text-foreground mb-2">Nenhuma proposta criada</h4>
                      <p className="text-foreground-muted text-sm mb-4">
                        Crie uma proposta baseada na analise de carga
                      </p>
                      <Link
                        to={`/prospects/${prospect.id}/proposal/new`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg"
                      >
                        <Plus className="w-4 h-4" />
                        Criar Proposta
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activities' && (
                <div className="space-y-4">
                  {/* Add Note */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Adicionar nota..."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Activity Timeline */}
                  <div className="space-y-4">
                    {prospect.activities.map((activity, index) => {
                      const Icon = ACTIVITY_ICONS[activity.type];
                      return (
                        <div key={activity.id} className="flex gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center">
                              <Icon className="w-4 h-4 text-foreground-muted" />
                            </div>
                            {index < prospect.activities.length - 1 && (
                              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-full bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="font-medium text-foreground">{activity.title}</p>
                            {activity.description && (
                              <p className="text-sm text-foreground-muted mt-1">{activity.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-foreground-subtle">
                              <span>{activity.createdByName}</span>
                              <span>-</span>
                              <span>{formatDateTime(activity.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Key Info */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-4">Informacoes Chave</h3>
            <dl className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <dt className="text-foreground-muted text-sm">Valor Estimado</dt>
                <dd className="text-foreground font-semibold">
                  {prospect.estimatedValue ? formatCurrency(prospect.estimatedValue) : '-'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <dt className="text-foreground-muted text-sm">Capacidade Est.</dt>
                <dd className="text-foreground font-medium">
                  {prospect.estimatedCapacityKwh ? `${prospect.estimatedCapacityKwh} kWh` : '-'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <dt className="text-foreground-muted text-sm">Responsavel</dt>
                <dd className="text-foreground font-medium">{prospect.assignedToName || '-'}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <dt className="text-foreground-muted text-sm">Origem</dt>
                <dd className="text-foreground font-medium">{prospect.source}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <dt className="text-foreground-muted text-sm">Criado em</dt>
                <dd className="text-foreground font-medium">{formatDate(prospect.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <dt className="text-foreground-muted text-sm">Ultimo Contato</dt>
                <dd className="text-foreground font-medium">{formatDate(prospect.lastContactAt)}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-foreground-muted text-sm">Proximo Follow-up</dt>
                <dd className={cn(
                  'font-medium',
                  prospect.nextFollowUp && new Date(prospect.nextFollowUp) < new Date()
                    ? 'text-danger-500'
                    : 'text-foreground'
                )}>
                  {formatDate(prospect.nextFollowUp)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="font-semibold text-foreground mb-4">Acoes Rapidas</h3>
            <div className="space-y-2">
              {primaryContact && (
                <>
                  <a
                    href={`mailto:${primaryContact.email}`}
                    className="flex items-center gap-2 w-full px-3 py-2 bg-background hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    <Mail className="w-4 h-4 text-foreground-muted" />
                    <span className="text-foreground">Enviar Email</span>
                  </a>
                  {primaryContact.phone && (
                    <a
                      href={`tel:${primaryContact.phone}`}
                      className="flex items-center gap-2 w-full px-3 py-2 bg-background hover:bg-surface-hover rounded-lg transition-colors"
                    >
                      <Phone className="w-4 h-4 text-foreground-muted" />
                      <span className="text-foreground">Ligar</span>
                    </a>
                  )}
                </>
              )}
              <button
                className="flex items-center gap-2 w-full px-3 py-2 bg-background hover:bg-surface-hover rounded-lg transition-colors"
              >
                <Calendar className="w-4 h-4 text-foreground-muted" />
                <span className="text-foreground">Agendar Reuniao</span>
              </button>
              {prospect.website && (
                <a
                  href={prospect.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 bg-background hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-foreground-muted" />
                  <span className="text-foreground">Visitar Site</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Change Modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl border border-border p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-4">Alterar Estagio</h3>
            <div className="space-y-2">
              {STAGES.map(stage => (
                <button
                  key={stage.key}
                  onClick={() => handleStageChange(stage.key)}
                  disabled={stage.key === prospect.stage}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors',
                    stage.key === prospect.stage
                      ? 'bg-primary/10 text-primary cursor-not-allowed'
                      : 'bg-background hover:bg-surface-hover text-foreground'
                  )}
                >
                  <span className={cn('font-medium', stage.key === prospect.stage && stage.color)}>
                    {stage.label}
                  </span>
                  {stage.key === prospect.stage && (
                    <span className="text-xs">Atual</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStageModal(false)}
              className="w-full mt-4 px-4 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function ProspectDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-border p-4 h-24 animate-pulse" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border h-96 animate-pulse" />
        <div className="bg-surface rounded-xl border border-border h-96 animate-pulse" />
      </div>
    </div>
  );
}
