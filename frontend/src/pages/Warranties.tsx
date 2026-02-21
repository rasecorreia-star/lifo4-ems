import { useState } from 'react';
import {
  Shield,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Download,
  Search,
  Filter,
  ChevronRight,
  Building,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  DollarSign,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Warranty {
  id: string;
  type: 'battery' | 'inverter' | 'bms' | 'structure' | 'labor';
  component: string;
  provider: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring' | 'expired';
  coverage: string[];
  maxClaims: number;
  usedClaims: number;
  value: number;
  documentUrl: string;
}

interface ServiceContract {
  id: string;
  name: string;
  provider: string;
  type: 'maintenance' | 'monitoring' | 'support' | 'full_service';
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  monthlyFee: number;
  slaResponse: string;
  includes: string[];
  contact: {
    name: string;
    phone: string;
    email: string;
  };
}

interface Claim {
  id: string;
  warrantyId: string;
  component: string;
  issue: string;
  dateSubmitted: string;
  status: 'submitted' | 'in_review' | 'approved' | 'rejected' | 'completed';
  amount: number;
}

const warranties: Warranty[] = [
  {
    id: 'W001',
    type: 'battery',
    component: 'Modulos de Bateria LFP',
    provider: 'CATL',
    startDate: '2024-01-15',
    endDate: '2034-01-15',
    status: 'active',
    coverage: ['Defeitos de fabricacao', 'Capacidade < 80%', 'Falha de celulas'],
    maxClaims: 5,
    usedClaims: 0,
    value: 150000,
    documentUrl: '#',
  },
  {
    id: 'W002',
    type: 'inverter',
    component: 'Inversor Hibrido 100kW',
    provider: 'SMA',
    startDate: '2024-01-15',
    endDate: '2029-01-15',
    status: 'active',
    coverage: ['Defeitos de fabricacao', 'Falha de componentes', 'Software'],
    maxClaims: 3,
    usedClaims: 1,
    value: 45000,
    documentUrl: '#',
  },
  {
    id: 'W003',
    type: 'bms',
    component: 'Sistema de Gerenciamento BMS',
    provider: 'Orion BMS',
    startDate: '2024-01-15',
    endDate: '2027-01-15',
    status: 'active',
    coverage: ['Hardware', 'Firmware', 'Sensores'],
    maxClaims: 2,
    usedClaims: 0,
    value: 25000,
    documentUrl: '#',
  },
  {
    id: 'W004',
    type: 'structure',
    component: 'Container e Estrutura',
    provider: 'MetalBox',
    startDate: '2024-01-15',
    endDate: '2026-01-15',
    status: 'expiring',
    coverage: ['Corrosao', 'Defeitos estruturais'],
    maxClaims: 1,
    usedClaims: 0,
    value: 15000,
    documentUrl: '#',
  },
];

const serviceContracts: ServiceContract[] = [
  {
    id: 'SC001',
    name: 'Contrato de Manutencao Preventiva',
    provider: 'Lifo4 Energia',
    type: 'maintenance',
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    status: 'active',
    monthlyFee: 2500,
    slaResponse: '4 horas',
    includes: ['Visitas trimestrais', 'Manutencao preventiva', 'Relatorios mensais', 'Pecas de desgaste'],
    contact: { name: 'Carlos Silva', phone: '(86) 99999-1234', email: 'carlos@lifo4.com.br' },
  },
  {
    id: 'SC002',
    name: 'Monitoramento 24/7',
    provider: 'Lifo4 Energia',
    type: 'monitoring',
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    status: 'active',
    monthlyFee: 800,
    slaResponse: '15 minutos',
    includes: ['Monitoramento continuo', 'Alertas em tempo real', 'Dashboard dedicado', 'Relatorios semanais'],
    contact: { name: 'Ana Costa', phone: '(86) 99999-5678', email: 'ana@lifo4.com.br' },
  },
  {
    id: 'SC003',
    name: 'Suporte Tecnico Premium',
    provider: 'SMA Brasil',
    type: 'support',
    startDate: '2024-01-15',
    endDate: '2026-01-14',
    status: 'active',
    monthlyFee: 500,
    slaResponse: '2 horas',
    includes: ['Suporte telefonico', 'Acesso remoto', 'Atualizacoes de firmware', 'Treinamento anual'],
    contact: { name: 'Suporte SMA', phone: '0800-123-4567', email: 'suporte@sma.com.br' },
  },
];

const recentClaims: Claim[] = [
  {
    id: 'CL001',
    warrantyId: 'W002',
    component: 'Inversor - Placa de controle',
    issue: 'Falha na placa de controle principal',
    dateSubmitted: '2025-11-15',
    status: 'completed',
    amount: 8500,
  },
  {
    id: 'CL002',
    warrantyId: 'W001',
    component: 'Modulo #5 - Celulas',
    issue: 'Capacidade abaixo do especificado',
    dateSubmitted: '2026-01-10',
    status: 'in_review',
    amount: 12000,
  },
];

export default function Warranties() {
  const [selectedTab, setSelectedTab] = useState<'warranties' | 'contracts' | 'claims'>('warranties');
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-500/20 text-success-500';
      case 'expiring':
        return 'bg-warning-500/20 text-warning-500';
      case 'expired':
        return 'bg-danger-500/20 text-danger-500';
      case 'pending':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-foreground-muted/20 text-foreground-muted';
    }
  };

  const getClaimStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-500/20 text-success-500';
      case 'approved':
        return 'bg-success-500/20 text-success-500';
      case 'in_review':
        return 'bg-warning-500/20 text-warning-500';
      case 'submitted':
        return 'bg-primary/20 text-primary';
      case 'rejected':
        return 'bg-danger-500/20 text-danger-500';
      default:
        return 'bg-foreground-muted/20 text-foreground-muted';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'battery':
        return '🔋';
      case 'inverter':
        return '⚡';
      case 'bms':
        return '🖥️';
      case 'structure':
        return '🏗️';
      case 'labor':
        return '👷';
      default:
        return '📄';
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Calculate stats
  const activeWarranties = warranties.filter(w => w.status === 'active' || w.status === 'expiring').length;
  const expiringWarranties = warranties.filter(w => w.status === 'expiring').length;
  const totalCoverage = warranties.reduce((sum, w) => sum + w.value, 0);
  const monthlyContractCost = serviceContracts.filter(c => c.status === 'active').reduce((sum, c) => sum + c.monthlyFee, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Garantias e Contratos
          </h1>
          <p className="text-foreground-muted mt-1">
            Gerencie garantias, contratos de servico e sinistros
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Garantias Ativas</span>
            <Shield className="w-5 h-5 text-success-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{activeWarranties}</div>
          {expiringWarranties > 0 && (
            <div className="text-xs text-warning-500 mt-1">
              {expiringWarranties} expirando em breve
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Cobertura Total</span>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {(totalCoverage / 1000).toFixed(0)}k
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            em garantias ativas
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Contratos Ativos</span>
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {serviceContracts.filter(c => c.status === 'active').length}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            de {serviceContracts.length} contratos
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground-muted text-sm">Custo Mensal</span>
            <Calendar className="w-5 h-5 text-warning-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            R$ {monthlyContractCost.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-foreground-muted mt-1">
            em contratos de servico
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {(['warranties', 'contracts', 'claims'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              selectedTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            {tab === 'warranties' ? 'Garantias' : tab === 'contracts' ? 'Contratos' : 'Sinistros'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-muted"
        />
      </div>

      {selectedTab === 'warranties' && (
        <div className="space-y-4">
          {warranties.map((warranty) => {
            const daysRemaining = getDaysRemaining(warranty.endDate);

            return (
              <div
                key={warranty.id}
                className="bg-surface border border-border rounded-xl p-6 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getTypeIcon(warranty.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{warranty.component}</h3>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(warranty.status))}>
                        {warranty.status === 'active' ? 'Ativa' : warranty.status === 'expiring' ? 'Expirando' : 'Expirada'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-muted mt-1">
                      Fornecedor: {warranty.provider} | ID: {warranty.id}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1 text-foreground-muted">
                        <Calendar className="w-4 h-4" />
                        {new Date(warranty.startDate).toLocaleDateString('pt-BR')} - {new Date(warranty.endDate).toLocaleDateString('pt-BR')}
                      </span>
                      <span className={cn(
                        'flex items-center gap-1',
                        daysRemaining < 180 ? 'text-warning-500' : 'text-foreground-muted'
                      )}>
                        <Clock className="w-4 h-4" />
                        {daysRemaining} dias restantes
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {warranty.coverage.map((item, index) => (
                        <span key={index} className="px-2 py-1 bg-surface-hover rounded text-xs text-foreground-muted">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      R$ {warranty.value.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-foreground-muted">cobertura maxima</p>
                    <div className="mt-2">
                      <p className="text-sm text-foreground-muted">
                        Sinistros: {warranty.usedClaims}/{warranty.maxClaims}
                      </p>
                    </div>
                    <button className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
                      <Download className="w-4 h-4" />
                      Documento
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTab === 'contracts' && (
        <div className="space-y-4">
          {serviceContracts.map((contract) => (
            <div
              key={contract.id}
              className="bg-surface border border-border rounded-xl p-6 hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{contract.name}</h3>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(contract.status))}>
                      {contract.status === 'active' ? 'Ativo' : contract.status === 'expiring' ? 'Expirando' : contract.status === 'pending' ? 'Pendente' : 'Expirado'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground-muted mt-1">
                    {contract.provider} | SLA: {contract.slaResponse}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-foreground-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(contract.startDate).toLocaleDateString('pt-BR')} - {new Date(contract.endDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {contract.includes.map((item, index) => (
                      <span key={index} className="px-2 py-1 bg-success-500/10 text-success-500 rounded text-xs">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-surface-hover rounded-lg">
                    <p className="text-xs text-foreground-muted mb-2">Contato</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-foreground">{contract.contact.name}</span>
                      <span className="flex items-center gap-1 text-foreground-muted">
                        <Phone className="w-3 h-3" />
                        {contract.contact.phone}
                      </span>
                      <span className="flex items-center gap-1 text-foreground-muted">
                        <Mail className="w-3 h-3" />
                        {contract.contact.email}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">
                    R$ {contract.monthlyFee.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-foreground-muted">/mes</p>
                  <button className="mt-3 px-3 py-1 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                    Renovar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTab === 'claims' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Historico de Sinistros</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Novo Sinistro
            </button>
          </div>
          <div className="space-y-4">
            {recentClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-surface border border-border rounded-xl p-4 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    claim.status === 'completed' || claim.status === 'approved'
                      ? 'bg-success-500/20'
                      : claim.status === 'rejected'
                      ? 'bg-danger-500/20'
                      : 'bg-warning-500/20'
                  )}>
                    {claim.status === 'completed' || claim.status === 'approved' ? (
                      <CheckCircle className="w-5 h-5 text-success-500" />
                    ) : claim.status === 'rejected' ? (
                      <XCircle className="w-5 h-5 text-danger-500" />
                    ) : (
                      <RefreshCw className="w-5 h-5 text-warning-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{claim.component}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getClaimStatusColor(claim.status))}>
                        {claim.status === 'completed' ? 'Concluido' :
                         claim.status === 'approved' ? 'Aprovado' :
                         claim.status === 'in_review' ? 'Em Analise' :
                         claim.status === 'submitted' ? 'Enviado' : 'Rejeitado'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-muted">{claim.issue}</p>
                    <p className="text-xs text-foreground-muted mt-1">
                      Submetido em {new Date(claim.dateSubmitted).toLocaleDateString('pt-BR')} | ID: {claim.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">R$ {claim.amount.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-foreground-muted">valor estimado</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-foreground-muted" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Expiring Warnings */}
      {expiringWarranties > 0 && (
        <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Garantias Expirando</p>
              <p className="text-sm text-foreground-muted mt-1">
                {expiringWarranties} garantia(s) expirando nos proximos 12 meses.
                Considere renovar ou estender a cobertura.
              </p>
              <button className="mt-2 text-sm text-warning-500 hover:underline">
                Ver detalhes →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
