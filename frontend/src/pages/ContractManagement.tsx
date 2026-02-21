import { useMemo, useState } from 'react';
import {
  FileText,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Building,
  Phone,
  Mail,
  MapPin,
  Plus,
  Eye,
  Download,
  RefreshCw,
  Shield,
  Wrench,
  Zap,
} from 'lucide-react';

interface Contract {
  id: string;
  number: string;
  title: string;
  type: 'maintenance' | 'warranty' | 'service' | 'support' | 'lease';
  status: 'active' | 'expiring' | 'expired' | 'pending';
  vendor: {
    name: string;
    contact: string;
    email: string;
    phone: string;
  };
  startDate: string;
  endDate: string;
  value: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  systems: string[];
  coverage: string[];
  slaLevel: 'gold' | 'silver' | 'bronze';
  autoRenew: boolean;
}

export default function ContractManagement() {
  const [activeTab, setActiveTab] = useState<'contracts' | 'vendors' | 'renewals'>('contracts');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const contracts = useMemo<Contract[]>(() => [
    {
      id: 'ctr-1',
      number: 'CTR-2024-001',
      title: 'Manutencao Preventiva Anual',
      type: 'maintenance',
      status: 'active',
      vendor: {
        name: 'TechServ Energia',
        contact: 'Carlos Mendes',
        email: 'carlos@techserv.com.br',
        phone: '(86) 99999-1111',
      },
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      value: 48000,
      paymentFrequency: 'monthly',
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul'],
      coverage: ['Manutencao preventiva trimestral', 'Suporte tecnico 8x5', 'Pecas incluidas', 'Relatorios mensais'],
      slaLevel: 'gold',
      autoRenew: true,
    },
    {
      id: 'ctr-2',
      number: 'CTR-2024-002',
      title: 'Garantia Estendida Baterias',
      type: 'warranty',
      status: 'active',
      vendor: {
        name: 'BYD Brasil',
        contact: 'Ana Paula Silva',
        email: 'ana.silva@byd.com',
        phone: '(11) 3333-4444',
      },
      startDate: '2024-01-01',
      endDate: '2029-01-01',
      value: 150000,
      paymentFrequency: 'one-time',
      systems: ['BESS Teresina Norte'],
      coverage: ['Garantia de 5 anos', 'Substituicao de celulas defeituosas', 'Capacidade minima 80%'],
      slaLevel: 'gold',
      autoRenew: false,
    },
    {
      id: 'ctr-3',
      number: 'CTR-2024-003',
      title: 'Suporte Tecnico Premium',
      type: 'support',
      status: 'expiring',
      vendor: {
        name: 'EMS Solutions',
        contact: 'Roberto Santos',
        email: 'roberto@emssolutions.com.br',
        phone: '(86) 98888-2222',
      },
      startDate: '2024-01-01',
      endDate: '2025-02-28',
      value: 24000,
      paymentFrequency: 'quarterly',
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul', 'BESS Centro'],
      coverage: ['Suporte 24/7', 'Tempo resposta 2h', 'Acesso remoto', 'Atualizacoes de software'],
      slaLevel: 'gold',
      autoRenew: true,
    },
    {
      id: 'ctr-4',
      number: 'CTR-2023-005',
      title: 'Servico de Calibracao',
      type: 'service',
      status: 'expired',
      vendor: {
        name: 'MetroCal Instrumentos',
        contact: 'Lucia Ferreira',
        email: 'lucia@metrocal.com.br',
        phone: '(85) 3232-5555',
      },
      startDate: '2023-06-01',
      endDate: '2024-05-31',
      value: 12000,
      paymentFrequency: 'annual',
      systems: ['BESS Teresina Norte'],
      coverage: ['Calibracao anual de sensores', 'Certificados rastreáveis', 'Relatorio tecnico'],
      slaLevel: 'silver',
      autoRenew: false,
    },
    {
      id: 'ctr-5',
      number: 'CTR-2024-004',
      title: 'Leasing Equipamento Monitoramento',
      type: 'lease',
      status: 'active',
      vendor: {
        name: 'IoT Leasing',
        contact: 'Pedro Almeida',
        email: 'pedro@iotleasing.com.br',
        phone: '(11) 4444-6666',
      },
      startDate: '2024-03-01',
      endDate: '2027-02-28',
      value: 36000,
      paymentFrequency: 'monthly',
      systems: ['BESS Teresina Norte', 'BESS Piauí Sul'],
      coverage: ['Equipamentos de monitoramento', 'Manutencao inclusa', 'Upgrade tecnologico'],
      slaLevel: 'silver',
      autoRenew: true,
    },
  ], []);

  const stats = useMemo(() => {
    const totalValue = contracts.reduce((sum, c) => sum + c.value, 0);
    const activeContracts = contracts.filter(c => c.status === 'active').length;
    const expiringContracts = contracts.filter(c => c.status === 'expiring').length;
    const expiredContracts = contracts.filter(c => c.status === 'expired').length;
    return { totalValue, activeContracts, expiringContracts, expiredContracts };
  }, [contracts]);

  const getTypeIcon = (type: Contract['type']) => {
    switch (type) {
      case 'maintenance': return Wrench;
      case 'warranty': return Shield;
      case 'service': return Zap;
      case 'support': return Phone;
      case 'lease': return Building;
      default: return FileText;
    }
  };

  const getTypeColor = (type: Contract['type']) => {
    switch (type) {
      case 'maintenance': return 'text-blue-500 bg-blue-500/20';
      case 'warranty': return 'text-green-500 bg-green-500/20';
      case 'service': return 'text-purple-500 bg-purple-500/20';
      case 'support': return 'text-amber-500 bg-amber-500/20';
      case 'lease': return 'text-cyan-500 bg-cyan-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getTypeLabel = (type: Contract['type']) => {
    switch (type) {
      case 'maintenance': return 'Manutencao';
      case 'warranty': return 'Garantia';
      case 'service': return 'Servico';
      case 'support': return 'Suporte';
      case 'lease': return 'Leasing';
      default: return type;
    }
  };

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/20';
      case 'expiring': return 'text-amber-500 bg-amber-500/20';
      case 'expired': return 'text-red-500 bg-red-500/20';
      case 'pending': return 'text-blue-500 bg-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: Contract['status']) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'expiring': return 'Expirando';
      case 'expired': return 'Expirado';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  const getSlaColor = (sla: Contract['slaLevel']) => {
    switch (sla) {
      case 'gold': return 'text-amber-500 bg-amber-500/20';
      case 'silver': return 'text-gray-400 bg-gray-400/20';
      case 'bronze': return 'text-orange-600 bg-orange-600/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getDaysUntilExpiry = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestao de Contratos</h1>
          <p className="text-foreground-muted">Gerencie contratos de servico, garantias e fornecedores</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Novo Contrato
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground-muted">Valor Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalValue.toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Contratos Ativos</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.activeContracts}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Expirando</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.expiringContracts}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Expirados</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.expiredContracts}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: 'contracts', label: 'Contratos', icon: FileText },
            { id: 'vendors', label: 'Fornecedores', icon: Building },
            { id: 'renewals', label: 'Renovacoes', icon: RefreshCw },
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
      {activeTab === 'contracts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contract List */}
          <div className="lg:col-span-2 bg-surface rounded-lg border border-border">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Todos os Contratos</h3>
            </div>
            <div className="divide-y divide-border">
              {contracts.map((contract) => {
                const TypeIcon = getTypeIcon(contract.type);
                const daysLeft = getDaysUntilExpiry(contract.endDate);
                return (
                  <div
                    key={contract.id}
                    onClick={() => setSelectedContract(contract)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedContract?.id === contract.id
                        ? 'bg-primary/10'
                        : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getTypeColor(contract.type)}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{contract.title}</p>
                          <p className="text-sm text-foreground-muted">{contract.number}</p>
                          <p className="text-sm text-foreground-muted">{contract.vendor.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                          {getStatusLabel(contract.status)}
                        </span>
                        <p className="text-sm font-semibold text-foreground mt-2">
                          R$ {contract.value.toLocaleString('pt-BR')}
                        </p>
                        {daysLeft > 0 && daysLeft < 90 && (
                          <p className="text-xs text-amber-500">{daysLeft} dias restantes</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contract Detail */}
          <div className="lg:col-span-1">
            {selectedContract ? (
              <div className="bg-surface rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Detalhes</h3>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-sm text-foreground-muted">Numero</p>
                    <p className="font-medium text-foreground">{selectedContract.number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Tipo</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(selectedContract.type)}`}>
                      {getTypeLabel(selectedContract.type)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Nivel SLA</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getSlaColor(selectedContract.slaLevel)}`}>
                      {selectedContract.slaLevel}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Periodo</p>
                    <p className="text-foreground">
                      {new Date(selectedContract.startDate).toLocaleDateString('pt-BR')} - {new Date(selectedContract.endDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Valor</p>
                    <p className="text-lg font-semibold text-foreground">
                      R$ {selectedContract.value.toLocaleString('pt-BR')}
                      <span className="text-sm font-normal text-foreground-muted ml-1">
                        ({selectedContract.paymentFrequency === 'monthly' ? '/mes' :
                          selectedContract.paymentFrequency === 'quarterly' ? '/trimestre' :
                          selectedContract.paymentFrequency === 'annual' ? '/ano' : 'unico'})
                      </span>
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Fornecedor</p>
                    <div className="space-y-2">
                      <p className="text-sm text-foreground flex items-center gap-2">
                        <Building className="w-4 h-4 text-foreground-muted" />
                        {selectedContract.vendor.name}
                      </p>
                      <p className="text-sm text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-foreground-muted" />
                        {selectedContract.vendor.contact}
                      </p>
                      <p className="text-sm text-foreground flex items-center gap-2">
                        <Mail className="w-4 h-4 text-foreground-muted" />
                        {selectedContract.vendor.email}
                      </p>
                      <p className="text-sm text-foreground flex items-center gap-2">
                        <Phone className="w-4 h-4 text-foreground-muted" />
                        {selectedContract.vendor.phone}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Cobertura</p>
                    <ul className="space-y-1">
                      {selectedContract.coverage.map((item, idx) => (
                        <li key={idx} className="text-sm text-foreground-muted flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Sistemas Cobertos</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedContract.systems.map((sys, idx) => (
                        <span key={idx} className="px-2 py-1 bg-background rounded text-xs text-foreground">
                          {sys}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                      Renovar
                    </button>
                    <button className="px-4 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-surface-hover transition-colors">
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-lg border border-border p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
                <p className="text-foreground-muted">Selecione um contrato para ver detalhes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(new Set(contracts.map(c => c.vendor.name))).map((vendorName) => {
            const vendor = contracts.find(c => c.vendor.name === vendorName)?.vendor;
            const vendorContracts = contracts.filter(c => c.vendor.name === vendorName);
            const totalValue = vendorContracts.reduce((sum, c) => sum + c.value, 0);

            return vendor && (
              <div key={vendorName} className="bg-surface rounded-lg border border-border p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Building className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{vendor.name}</h3>
                    <p className="text-sm text-foreground-muted">{vendor.contact}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4 text-foreground-muted" />
                    {vendor.email}
                  </p>
                  <p className="text-sm text-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4 text-foreground-muted" />
                    {vendor.phone}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs text-foreground-muted">Contratos</p>
                    <p className="font-semibold text-foreground">{vendorContracts.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-foreground-muted">Valor Total</p>
                    <p className="font-semibold text-foreground">R$ {totalValue.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'renewals' && (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Contratos para Renovacao</h3>
          </div>
          <div className="divide-y divide-border">
            {contracts
              .filter(c => c.status === 'expiring' || getDaysUntilExpiry(c.endDate) < 90)
              .sort((a, b) => getDaysUntilExpiry(a.endDate) - getDaysUntilExpiry(b.endDate))
              .map((contract) => {
                const daysLeft = getDaysUntilExpiry(contract.endDate);
                return (
                  <div key={contract.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{contract.title}</p>
                      <p className="text-sm text-foreground-muted">{contract.vendor.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-sm font-medium ${daysLeft < 30 ? 'text-red-500' : 'text-amber-500'}`}>
                          {daysLeft > 0 ? `${daysLeft} dias` : 'Expirado'}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          Vence em {new Date(contract.endDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                        Renovar
                      </button>
                    </div>
                  </div>
                );
              })}
            {contracts.filter(c => c.status === 'expiring' || getDaysUntilExpiry(c.endDate) < 90).length === 0 && (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <p className="text-foreground-muted">Nenhum contrato proximo da renovacao</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
