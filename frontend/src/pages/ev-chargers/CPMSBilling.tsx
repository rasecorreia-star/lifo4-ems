import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  Percent,
  Tag,
  Zap,
  Timer,
  Car,
  MapPin,
  Users,
  Gift,
  Settings,
  RefreshCw,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface TariffPlan {
  id: string;
  name: string;
  description: string;
  type: 'standard' | 'time_of_use' | 'dynamic' | 'subscription';
  isActive: boolean;
  components: {
    energyRateKwh: number;
    timeRateMin?: number;
    connectionFee?: number;
    idleFeeMin?: number;
    peakMultiplier?: number;
    offPeakDiscount?: number;
  };
  applicableTo: string[];
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  period: { start: string; end: string };
  sessionsCount: number;
  totalEnergy: number;
  subtotal: number;
  taxes: number;
  total: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
}

interface Promotion {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_sessions' | 'happy_hour';
  value: number;
  maxUses: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  conditions: string[];
}

interface Transaction {
  id: string;
  type: 'charge' | 'refund' | 'payout' | 'fee';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  customerName?: string;
  chargerName?: string;
  gateway: string;
  timestamp: string;
}

// ============================================
// MOCK DATA
// ============================================

const mockTariffs: TariffPlan[] = [
  {
    id: '1',
    name: 'Tarifa Padrão',
    description: 'Tarifa base para todos os usuários',
    type: 'standard',
    isActive: true,
    components: { energyRateKwh: 1.50, connectionFee: 2.00, idleFeeMin: 0.10 },
    applicableTo: ['all'],
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Horário de Pico',
    description: 'Tarifa diferenciada por horário',
    type: 'time_of_use',
    isActive: true,
    components: { energyRateKwh: 1.20, peakMultiplier: 1.5, offPeakDiscount: 0.3, connectionFee: 1.50 },
    applicableTo: ['dc_fast', 'ultra_fast'],
    createdAt: '2024-02-15',
  },
  {
    id: '3',
    name: 'Assinatura Premium',
    description: 'Plano mensal com desconto',
    type: 'subscription',
    isActive: true,
    components: { energyRateKwh: 1.00, connectionFee: 0 },
    applicableTo: ['premium_users'],
    createdAt: '2024-03-01',
  },
  {
    id: '4',
    name: 'Tarifa Dinâmica',
    description: 'Baseada no preço do mercado livre',
    type: 'dynamic',
    isActive: false,
    components: { energyRateKwh: 0, connectionFee: 1.00, idleFeeMin: 0.15 },
    applicableTo: ['commercial'],
    createdAt: '2024-04-01',
  },
];

const mockInvoices: Invoice[] = [
  { id: '1', invoiceNumber: 'INV-2024-001234', customerId: 'c1', customerName: 'João Silva', customerEmail: 'joao@email.com', period: { start: '2024-01-01', end: '2024-01-31' }, sessionsCount: 15, totalEnergy: 450, subtotal: 675.00, taxes: 81.00, total: 756.00, status: 'paid', dueDate: '2024-02-10', paidAt: '2024-02-08', paymentMethod: 'Cartão de Crédito' },
  { id: '2', invoiceNumber: 'INV-2024-001235', customerId: 'c2', customerName: 'Maria Santos', customerEmail: 'maria@email.com', period: { start: '2024-01-01', end: '2024-01-31' }, sessionsCount: 8, totalEnergy: 240, subtotal: 360.00, taxes: 43.20, total: 403.20, status: 'pending', dueDate: '2024-02-15' },
  { id: '3', invoiceNumber: 'INV-2024-001236', customerId: 'c3', customerName: 'Carlos Oliveira', customerEmail: 'carlos@email.com', period: { start: '2024-01-01', end: '2024-01-31' }, sessionsCount: 22, totalEnergy: 680, subtotal: 1020.00, taxes: 122.40, total: 1142.40, status: 'overdue', dueDate: '2024-02-05' },
  { id: '4', invoiceNumber: 'INV-2024-001237', customerId: 'c4', customerName: 'Ana Costa', customerEmail: 'ana@email.com', period: { start: '2024-01-01', end: '2024-01-31' }, sessionsCount: 5, totalEnergy: 125, subtotal: 187.50, taxes: 22.50, total: 210.00, status: 'draft', dueDate: '2024-02-20' },
];

const mockPromotions: Promotion[] = [
  { id: '1', name: 'Primeira Carga Grátis', code: 'BEMVINDO', type: 'free_sessions', value: 1, maxUses: 1000, usedCount: 456, startDate: '2024-01-01', endDate: '2024-12-31', isActive: true, conditions: ['Novos usuários', 'Máximo 50kWh'] },
  { id: '2', name: 'Happy Hour', code: 'HAPPY20', type: 'percentage', value: 20, maxUses: 0, usedCount: 1234, startDate: '2024-01-01', endDate: '2024-12-31', isActive: true, conditions: ['Válido das 22h às 6h', 'Somente AC'] },
  { id: '3', name: 'Desconto Corporativo', code: 'CORP30', type: 'percentage', value: 30, maxUses: 500, usedCount: 89, startDate: '2024-02-01', endDate: '2024-06-30', isActive: true, conditions: ['Clientes corporativos', 'Mínimo 10 sessões/mês'] },
  { id: '4', name: 'Crédito Indicação', code: 'INDICA50', type: 'fixed', value: 50, maxUses: 200, usedCount: 67, startDate: '2024-01-15', endDate: '2024-04-15', isActive: false, conditions: ['Por indicação válida'] },
];

const mockTransactions: Transaction[] = [
  { id: '1', type: 'charge', amount: 45.75, currency: 'BRL', status: 'completed', description: 'Sessão #12345 - CCS2', customerName: 'João Silva', chargerName: 'SP-Paulista #1', gateway: 'Stripe', timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '2', type: 'charge', amount: 32.40, currency: 'BRL', status: 'completed', description: 'Sessão #12346 - Type2', customerName: 'Maria Santos', chargerName: 'RJ-Centro #3', gateway: 'PagSeguro', timestamp: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '3', type: 'refund', amount: -15.00, currency: 'BRL', status: 'completed', description: 'Reembolso parcial - Sessão interrompida', customerName: 'Carlos Oliveira', chargerName: 'BH-Savassi #2', gateway: 'Stripe', timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '4', type: 'charge', amount: 128.90, currency: 'BRL', status: 'pending', description: 'Sessão #12347 - Tesla', customerName: 'Ana Costa', chargerName: 'Miami #5', gateway: 'Stripe', timestamp: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: '5', type: 'payout', amount: -5420.00, currency: 'BRL', status: 'completed', description: 'Repasse semanal - Site São Paulo', gateway: 'Banco do Brasil', timestamp: new Date(Date.now() - 24 * 3600000).toISOString() },
];

const revenueByDay = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  revenue: Math.floor(Math.random() * 5000) + 3000,
  sessions: Math.floor(Math.random() * 80) + 40,
}));

const revenueBySource = [
  { name: 'Energia (kWh)', value: 65, color: '#10b981' },
  { name: 'Taxa de Conexão', value: 15, color: '#3b82f6' },
  { name: 'Taxa de Ociosidade', value: 8, color: '#f59e0b' },
  { name: 'Assinaturas', value: 12, color: '#8b5cf6' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function CPMSBilling() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tariffs' | 'invoices' | 'promotions' | 'transactions'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // KPIs
  const kpis = useMemo(() => ({
    totalRevenue: 145780,
    revenueChange: +12.5,
    avgSessionValue: 42.30,
    avgSessionChange: +5.2,
    pendingInvoices: 23450,
    overdueInvoices: 8900,
    activePromotions: mockPromotions.filter(p => p.isActive).length,
    conversionRate: 94.5,
  }), []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Billing & Faturamento</h1>
              <p className="text-foreground-muted text-sm">
                Gestão de tarifas, faturas e promoções
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
          </button>
          <button className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nova Tarifa
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita do Mês"
          value={formatCurrency(kpis.totalRevenue)}
          change={kpis.revenueChange}
          icon={DollarSign}
          color="emerald"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(kpis.avgSessionValue)}
          change={kpis.avgSessionChange}
          icon={Receipt}
          color="blue"
        />
        <KPICard
          title="Faturas Pendentes"
          value={formatCurrency(kpis.pendingInvoices)}
          subtitle={`${formatCurrency(kpis.overdueInvoices)} vencidas`}
          icon={FileText}
          color="warning"
        />
        <KPICard
          title="Taxa de Conversão"
          value={`${kpis.conversionRate}%`}
          subtitle={`${kpis.activePromotions} promoções ativas`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-8">
          {[
            { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
            { id: 'tariffs', label: 'Tarifas', icon: Tag },
            { id: 'invoices', label: 'Faturas', icon: FileText },
            { id: 'promotions', label: 'Promoções', icon: Gift },
            { id: 'transactions', label: 'Transações', icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Receita e Sessões (Últimos 30 dias)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Receita (R$)"
                  stroke="#10b981"
                  fill="url(#revenueGradient)"
                  strokeWidth={2}
                />
                <Bar yAxisId="right" dataKey="sessions" name="Sessões" fill="#3b82f6" opacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue by Source */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-primary" />
                Receita por Componente
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={revenueBySource}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {revenueBySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {revenueBySource.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground-muted">{item.name}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Transações Recentes
                </h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-primary text-sm hover:underline"
                >
                  Ver todas
                </button>
              </div>
              <div className="divide-y divide-border">
                {mockTransactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center',
                          tx.type === 'charge' && 'bg-success-500/10 text-success-500',
                          tx.type === 'refund' && 'bg-danger-500/10 text-danger-500',
                          tx.type === 'payout' && 'bg-blue-500/10 text-blue-500',
                          tx.type === 'fee' && 'bg-warning-500/10 text-warning-500'
                        )}>
                          {tx.type === 'charge' && <ArrowUpRight className="w-4 h-4" />}
                          {tx.type === 'refund' && <ArrowDownRight className="w-4 h-4" />}
                          {tx.type === 'payout' && <ArrowDownRight className="w-4 h-4" />}
                          {tx.type === 'fee' && <DollarSign className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{tx.description}</p>
                          <p className="text-xs text-foreground-muted">{tx.customerName || tx.gateway}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'font-medium',
                          tx.amount >= 0 ? 'text-success-500' : 'text-danger-500'
                        )}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {new Date(tx.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tariffs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tarifas..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {mockTariffs.map((tariff) => (
              <TariffCard key={tariff.id} tariff={tariff} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar faturas..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select className="px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="paid">Pagas</option>
              <option value="overdue">Vencidas</option>
            </select>
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-hover">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Fatura</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Período</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Sessões</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Vencimento</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{invoice.invoiceNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{invoice.customerName}</p>
                      <p className="text-xs text-foreground-muted">{invoice.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {new Date(invoice.period.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {new Date(invoice.period.end).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{invoice.sessionsCount}</td>
                    <td className="px-4 py-3 text-center font-medium">{formatCurrency(invoice.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 hover:bg-surface-active rounded" title="Ver detalhes">
                          <Eye className="w-4 h-4 text-foreground-muted" />
                        </button>
                        <button className="p-1.5 hover:bg-surface-active rounded" title="Download PDF">
                          <Download className="w-4 h-4 text-foreground-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'promotions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar promoções..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nova Promoção
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {mockPromotions.map((promo) => (
              <PromotionCard key={promo.id} promotion={promo} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar transações..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select className="px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">Todos os tipos</option>
              <option value="charge">Cobranças</option>
              <option value="refund">Reembolsos</option>
              <option value="payout">Repasses</option>
            </select>
            <input
              type="date"
              className="px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-hover">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Cliente/Gateway</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-sm">
                      {new Date(tx.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <TransactionTypeBadge type={tx.type} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground">{tx.description}</p>
                      {tx.chargerName && (
                        <p className="text-xs text-foreground-muted">{tx.chargerName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground">{tx.customerName || '-'}</p>
                      <p className="text-xs text-foreground-muted">{tx.gateway}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'font-medium',
                        tx.amount >= 0 ? 'text-success-500' : 'text-danger-500'
                      )}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TransactionStatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'emerald' | 'blue' | 'warning' | 'purple';
}

function KPICard({ title, value, change, subtitle, icon: Icon, color }: KPICardProps) {
  const colorClasses = {
    emerald: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            change >= 0 ? 'text-success-500' : 'text-danger-500'
          )}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted">{title}</p>
      {subtitle && <p className="text-xs text-foreground-subtle mt-0.5">{subtitle}</p>}
    </div>
  );
}

function TariffCard({ tariff }: { tariff: TariffPlan }) {
  const typeLabels = {
    standard: { label: 'Padrão', color: 'bg-gray-500/20 text-gray-400' },
    time_of_use: { label: 'Horário', color: 'bg-blue-500/20 text-blue-500' },
    dynamic: { label: 'Dinâmica', color: 'bg-purple-500/20 text-purple-500' },
    subscription: { label: 'Assinatura', color: 'bg-emerald-500/20 text-emerald-500' },
  };

  const typeConfig = typeLabels[tariff.type];

  return (
    <div className={cn(
      'bg-surface rounded-xl border p-4',
      tariff.isActive ? 'border-border' : 'border-border opacity-60'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground">{tariff.name}</h3>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', typeConfig.color)}>
              {typeConfig.label}
            </span>
          </div>
          <p className="text-sm text-foreground-muted">{tariff.description}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-surface-hover rounded" title="Editar">
            <Edit className="w-4 h-4 text-foreground-muted" />
          </button>
          <button className="p-1.5 hover:bg-surface-hover rounded" title="Duplicar">
            <Copy className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-surface-hover rounded-lg p-2">
          <p className="text-xs text-foreground-muted">Energia</p>
          <p className="font-semibold text-foreground">{formatCurrency(tariff.components.energyRateKwh)}/kWh</p>
        </div>
        {tariff.components.connectionFee !== undefined && (
          <div className="bg-surface-hover rounded-lg p-2">
            <p className="text-xs text-foreground-muted">Taxa de Conexão</p>
            <p className="font-semibold text-foreground">{formatCurrency(tariff.components.connectionFee)}</p>
          </div>
        )}
        {tariff.components.idleFeeMin !== undefined && (
          <div className="bg-surface-hover rounded-lg p-2">
            <p className="text-xs text-foreground-muted">Taxa Ociosidade</p>
            <p className="font-semibold text-foreground">{formatCurrency(tariff.components.idleFeeMin)}/min</p>
          </div>
        )}
        {tariff.components.peakMultiplier !== undefined && (
          <div className="bg-surface-hover rounded-lg p-2">
            <p className="text-xs text-foreground-muted">Multiplicador Pico</p>
            <p className="font-semibold text-foreground">{tariff.components.peakMultiplier}x</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          {tariff.isActive ? (
            <span className="flex items-center gap-1 text-xs text-success-500">
              <CheckCircle className="w-3 h-3" /> Ativa
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-foreground-muted">
              <Clock className="w-3 h-3" /> Inativa
            </span>
          )}
        </div>
        <p className="text-xs text-foreground-muted">
          Aplicável: {tariff.applicableTo.join(', ')}
        </p>
      </div>
    </div>
  );
}

function PromotionCard({ promotion }: { promotion: Promotion }) {
  const typeLabels = {
    percentage: { label: 'Desconto %', icon: Percent },
    fixed: { label: 'Crédito', icon: DollarSign },
    free_sessions: { label: 'Sessões Grátis', icon: Gift },
    happy_hour: { label: 'Happy Hour', icon: Clock },
  };

  const typeConfig = typeLabels[promotion.type];
  const usagePercent = promotion.maxUses > 0 ? (promotion.usedCount / promotion.maxUses) * 100 : 0;

  return (
    <div className={cn(
      'bg-surface rounded-xl border p-4',
      promotion.isActive ? 'border-border' : 'border-border opacity-60'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            promotion.isActive ? 'bg-primary/10 text-primary' : 'bg-surface-active text-foreground-muted'
          )}>
            <typeConfig.icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{promotion.name}</h3>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-surface-active px-2 py-0.5 rounded font-mono">
                {promotion.code}
              </code>
              <button className="p-1 hover:bg-surface-hover rounded" title="Copiar código">
                <Copy className="w-3 h-3 text-foreground-muted" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-surface-hover rounded" title="Editar">
            <Edit className="w-4 h-4 text-foreground-muted" />
          </button>
          <button className="p-1.5 hover:bg-surface-hover rounded" title="Excluir">
            <Trash2 className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-foreground-muted">Valor:</span>
          <span className="font-semibold text-foreground">
            {promotion.type === 'percentage' && `${promotion.value}% OFF`}
            {promotion.type === 'fixed' && formatCurrency(promotion.value)}
            {promotion.type === 'free_sessions' && `${promotion.value} sessão grátis`}
            {promotion.type === 'happy_hour' && `${promotion.value}% OFF`}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-foreground-muted">Validade:</span>
          <span className="text-foreground">
            {new Date(promotion.startDate).toLocaleDateString('pt-BR')} - {new Date(promotion.endDate).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      {promotion.maxUses > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-foreground-muted mb-1">
            <span>Uso: {promotion.usedCount}/{promotion.maxUses}</span>
            <span>{usagePercent.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-surface-active rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                usagePercent > 90 ? 'bg-danger-500' : usagePercent > 70 ? 'bg-warning-500' : 'bg-primary'
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {promotion.conditions.map((condition, i) => (
          <span key={i} className="text-xs bg-surface-hover px-2 py-0.5 rounded text-foreground-muted">
            {condition}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
        {promotion.isActive ? (
          <span className="flex items-center gap-1 text-xs text-success-500">
            <CheckCircle className="w-3 h-3" /> Ativa
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-foreground-muted">
            <Clock className="w-3 h-3" /> Inativa
          </span>
        )}
        <button className="text-xs text-primary hover:underline">
          Ver estatísticas
        </button>
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const statusConfig = {
    draft: { label: 'Rascunho', class: 'bg-gray-500/20 text-gray-400' },
    pending: { label: 'Pendente', class: 'bg-warning-500/20 text-warning-500' },
    paid: { label: 'Paga', class: 'bg-success-500/20 text-success-500' },
    overdue: { label: 'Vencida', class: 'bg-danger-500/20 text-danger-500' },
    cancelled: { label: 'Cancelada', class: 'bg-gray-500/20 text-gray-400' },
  };

  const config = statusConfig[status];

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', config.class)}>
      {config.label}
    </span>
  );
}

function TransactionTypeBadge({ type }: { type: Transaction['type'] }) {
  const typeConfig = {
    charge: { label: 'Cobrança', class: 'bg-success-500/20 text-success-500' },
    refund: { label: 'Reembolso', class: 'bg-danger-500/20 text-danger-500' },
    payout: { label: 'Repasse', class: 'bg-blue-500/20 text-blue-500' },
    fee: { label: 'Taxa', class: 'bg-warning-500/20 text-warning-500' },
  };

  const config = typeConfig[type];

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', config.class)}>
      {config.label}
    </span>
  );
}

function TransactionStatusBadge({ status }: { status: Transaction['status'] }) {
  const statusConfig = {
    completed: { label: 'Concluída', class: 'bg-success-500/20 text-success-500' },
    pending: { label: 'Pendente', class: 'bg-warning-500/20 text-warning-500' },
    failed: { label: 'Falhou', class: 'bg-danger-500/20 text-danger-500' },
  };

  const config = statusConfig[status];

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', config.class)}>
      {config.label}
    </span>
  );
}
