import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  User,
  UserPlus,
  Search,
  Filter,
  Download,
  Mail,
  Phone,
  Car,
  CreditCard,
  Trophy,
  Star,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Send,
  Gift,
  Target,
  Activity,
  RefreshCw,
  BarChart3,
  Crown,
  Shield,
  Heart,
  Award,
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

interface EVUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'suspended' | 'churned';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
  totalSessions: number;
  totalEnergy: number;
  totalSpent: number;
  lastSessionDate: string;
  registeredAt: string;
  vehicles: {
    id: string;
    model: string;
    plate: string;
    connectorType: string;
  }[];
  paymentMethods: {
    id: string;
    type: string;
    last4: string;
    isDefault: boolean;
  }[];
  rfmScore: {
    recency: number;
    frequency: number;
    monetary: number;
    total: number;
  };
  churnRisk: 'low' | 'medium' | 'high';
  tags: string[];
}

interface UserSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  criteria: string[];
  color: string;
}

// ============================================
// MOCK DATA
// ============================================

const mockUsers: EVUser[] = [
  {
    id: '1',
    name: 'João Silva',
    email: 'joao.silva@email.com',
    phone: '(11) 99999-1234',
    status: 'active',
    tier: 'gold',
    points: 4520,
    totalSessions: 156,
    totalEnergy: 4680,
    totalSpent: 7020,
    lastSessionDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    registeredAt: '2023-03-15',
    vehicles: [
      { id: 'v1', model: 'Tesla Model 3', plate: 'ABC-1234', connectorType: 'Tesla' },
      { id: 'v2', model: 'BYD Dolphin', plate: 'DEF-5678', connectorType: 'CCS2' },
    ],
    paymentMethods: [
      { id: 'p1', type: 'credit_card', last4: '4242', isDefault: true },
      { id: 'p2', type: 'pix', last4: '', isDefault: false },
    ],
    rfmScore: { recency: 90, frequency: 85, monetary: 88, total: 88 },
    churnRisk: 'low',
    tags: ['early_adopter', 'multi_vehicle', 'high_value'],
  },
  {
    id: '2',
    name: 'Maria Santos',
    email: 'maria.santos@email.com',
    phone: '(21) 98888-5678',
    status: 'active',
    tier: 'platinum',
    points: 12450,
    totalSessions: 342,
    totalEnergy: 10260,
    totalSpent: 15390,
    lastSessionDate: new Date(Date.now() - 1 * 86400000).toISOString(),
    registeredAt: '2022-08-20',
    vehicles: [
      { id: 'v3', model: 'Porsche Taycan', plate: 'GHI-9012', connectorType: 'CCS2' },
    ],
    paymentMethods: [
      { id: 'p3', type: 'credit_card', last4: '8765', isDefault: true },
    ],
    rfmScore: { recency: 95, frequency: 95, monetary: 98, total: 96 },
    churnRisk: 'low',
    tags: ['vip', 'premium_vehicle', 'ambassador'],
  },
  {
    id: '3',
    name: 'Carlos Oliveira',
    email: 'carlos.oliveira@email.com',
    phone: '(31) 97777-4321',
    status: 'active',
    tier: 'silver',
    points: 1890,
    totalSessions: 45,
    totalEnergy: 1350,
    totalSpent: 2025,
    lastSessionDate: new Date(Date.now() - 15 * 86400000).toISOString(),
    registeredAt: '2024-01-10',
    vehicles: [
      { id: 'v4', model: 'Nissan Leaf', plate: 'JKL-3456', connectorType: 'CHAdeMO' },
    ],
    paymentMethods: [
      { id: 'p4', type: 'pix', last4: '', isDefault: true },
    ],
    rfmScore: { recency: 55, frequency: 50, monetary: 45, total: 50 },
    churnRisk: 'medium',
    tags: ['new_user'],
  },
  {
    id: '4',
    name: 'Ana Costa',
    email: 'ana.costa@email.com',
    phone: '(41) 96666-8765',
    status: 'inactive',
    tier: 'bronze',
    points: 340,
    totalSessions: 8,
    totalEnergy: 240,
    totalSpent: 360,
    lastSessionDate: new Date(Date.now() - 45 * 86400000).toISOString(),
    registeredAt: '2024-02-28',
    vehicles: [
      { id: 'v5', model: 'Renault Zoe', plate: 'MNO-7890', connectorType: 'Type2' },
    ],
    paymentMethods: [],
    rfmScore: { recency: 20, frequency: 15, monetary: 10, total: 15 },
    churnRisk: 'high',
    tags: ['at_risk'],
  },
  {
    id: '5',
    name: 'Pedro Mendes',
    email: 'pedro.mendes@email.com',
    phone: '(51) 95555-2109',
    status: 'active',
    tier: 'gold',
    points: 5670,
    totalSessions: 189,
    totalEnergy: 5670,
    totalSpent: 8505,
    lastSessionDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    registeredAt: '2023-06-05',
    vehicles: [
      { id: 'v6', model: 'Volvo XC40 Recharge', plate: 'PQR-1234', connectorType: 'CCS2' },
    ],
    paymentMethods: [
      { id: 'p5', type: 'credit_card', last4: '1111', isDefault: true },
    ],
    rfmScore: { recency: 85, frequency: 88, monetary: 90, total: 88 },
    churnRisk: 'low',
    tags: ['loyal', 'consistent'],
  },
];

const mockSegments: UserSegment[] = [
  { id: '1', name: 'VIPs', description: 'Usuários platinum com alto LTV', count: 45, criteria: ['Tier Platinum', '>R$ 10k gastos', '>200 sessões'], color: '#8b5cf6' },
  { id: '2', name: 'Em Risco', description: 'Usuários com alta probabilidade de churn', count: 128, criteria: ['Sem sessão há 30+ dias', 'RFM < 40'], color: '#ef4444' },
  { id: '3', name: 'Novos', description: 'Registrados nos últimos 30 dias', count: 312, criteria: ['Cadastro < 30 dias'], color: '#3b82f6' },
  { id: '4', name: 'Leais', description: 'Usuários regulares com boa frequência', count: 567, criteria: ['5+ sessões/mês', 'RFM > 70'], color: '#10b981' },
  { id: '5', name: 'Dormentes', description: 'Sem atividade recente', count: 234, criteria: ['Sem sessão há 60+ dias', 'Já teve 5+ sessões'], color: '#f59e0b' },
];

const userGrowthData = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
  newUsers: Math.floor(Math.random() * 200) + 100,
  activeUsers: Math.floor(Math.random() * 500) + 800,
  churnedUsers: Math.floor(Math.random() * 30) + 10,
}));

const tierDistribution = [
  { name: 'Bronze', value: 45, color: '#cd7f32' },
  { name: 'Silver', value: 30, color: '#c0c0c0' },
  { name: 'Gold', value: 18, color: '#ffd700' },
  { name: 'Platinum', value: 7, color: '#e5e4e2' },
];

const rfmDistribution = [
  { name: 'Champions', value: 15, color: '#10b981' },
  { name: 'Loyal', value: 25, color: '#3b82f6' },
  { name: 'Potential', value: 20, color: '#8b5cf6' },
  { name: 'New', value: 18, color: '#f59e0b' },
  { name: 'At Risk', value: 12, color: '#ef4444' },
  { name: 'Hibernating', value: 10, color: '#6b7280' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function CPMSUsers() {
  const [users] = useState<EVUser[]>(mockUsers);
  const [segments] = useState<UserSegment[]>(mockSegments);
  const [activeTab, setActiveTab] = useState<'users' | 'segments' | 'loyalty' | 'analytics'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesTier = tierFilter === 'all' || user.tier === tierFilter;

      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [users, searchQuery, statusFilter, tierFilter]);

  // KPIs
  const kpis = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    newUsersMonth: 156,
    churnRate: 4.2,
    avgLTV: users.reduce((sum, u) => sum + u.totalSpent, 0) / users.length,
    avgSessionsPerUser: users.reduce((sum, u) => sum + u.totalSessions, 0) / users.length,
    totalPoints: users.reduce((sum, u) => sum + u.points, 0),
    atRiskUsers: users.filter(u => u.churnRisk === 'high').length,
  }), [users]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
              <p className="text-foreground-muted text-sm">
                {kpis.totalUsers.toLocaleString()} usuários • {kpis.activeUsers.toLocaleString()} ativos
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
          <button className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium rounded-lg transition-colors flex items-center gap-2">
            <Send className="w-4 h-4" />
            Campanha
          </button>
          <button className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard
          title="Total Usuários"
          value={kpis.totalUsers.toLocaleString()}
          icon={Users}
          color="primary"
        />
        <KPICard
          title="Usuários Ativos"
          value={kpis.activeUsers.toLocaleString()}
          icon={Activity}
          color="success"
        />
        <KPICard
          title="Novos no Mês"
          value={`+${kpis.newUsersMonth}`}
          icon={UserPlus}
          color="blue"
          trend={+12}
        />
        <KPICard
          title="Churn Rate"
          value={`${kpis.churnRate}%`}
          icon={TrendingDown}
          color={kpis.churnRate < 5 ? 'success' : 'warning'}
          trend={-0.5}
        />
        <KPICard
          title="LTV Médio"
          value={formatCurrency(kpis.avgLTV)}
          icon={DollarSign}
          color="emerald"
        />
        <KPICard
          title="Sessões/Usuário"
          value={kpis.avgSessionsPerUser.toFixed(1)}
          icon={Zap}
          color="warning"
        />
        <KPICard
          title="Pontos Emitidos"
          value={formatNumber(kpis.totalPoints)}
          icon={Star}
          color="purple"
        />
        <KPICard
          title="Em Risco"
          value={kpis.atRiskUsers.toString()}
          icon={AlertTriangle}
          color={kpis.atRiskUsers > 10 ? 'danger' : 'warning'}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-8">
          {[
            { id: 'users', label: 'Usuários', icon: Users },
            { id: 'segments', label: 'Segmentos', icon: Target },
            { id: 'loyalty', label: 'Loyalty & Pontos', icon: Trophy },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
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
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, email ou telefone..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="suspended">Suspensos</option>
                <option value="churned">Churned</option>
              </select>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Todos os tiers</option>
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-primary font-medium">
                {selectedUsers.length} usuário(s) selecionado(s)
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-sm rounded-lg transition-colors">
                  Enviar Email
                </button>
                <button className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-sm rounded-lg transition-colors">
                  Enviar Push
                </button>
                <button className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-sm rounded-lg transition-colors">
                  Adicionar Tag
                </button>
                <button className="px-3 py-1.5 bg-danger-500/20 hover:bg-danger-500/30 text-danger-500 text-sm rounded-lg transition-colors">
                  Suspender
                </button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-hover">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase">Usuário</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Tier</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Sessões</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Gasto Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">RFM</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Risco</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Última Sessão</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-foreground-muted uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-foreground-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TierBadge tier={user.tier} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{user.totalSessions}</td>
                    <td className="px-4 py-3 text-center font-medium">{formatCurrency(user.totalSpent)}</td>
                    <td className="px-4 py-3 text-center">
                      <RFMScore score={user.rfmScore.total} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChurnRiskBadge risk={user.churnRisk} />
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground-muted">
                      {new Date(user.lastSessionDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 hover:bg-surface-active rounded" title="Ver detalhes">
                          <Eye className="w-4 h-4 text-foreground-muted" />
                        </button>
                        <button className="p-1.5 hover:bg-surface-active rounded" title="Editar">
                          <Edit className="w-4 h-4 text-foreground-muted" />
                        </button>
                        <button className="p-1.5 hover:bg-surface-active rounded" title="Enviar mensagem">
                          <Send className="w-4 h-4 text-foreground-muted" />
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

      {activeTab === 'segments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Segmentos de Usuários
            </h3>
            <button className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
              <Target className="w-4 h-4" />
              Criar Segmento
            </button>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {segments.map((segment) => (
              <SegmentCard key={segment.id} segment={segment} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Tier Distribution */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Distribuição por Tier
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tierDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {tierDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {tierDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground-muted">{item.name}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Loyalty Tiers Info */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Programa de Fidelidade
              </h3>
              <div className="space-y-4">
                <TierInfo
                  tier="platinum"
                  name="Platinum"
                  minPoints={10000}
                  benefits={['5% cashback', 'Suporte prioritário', 'Reserva antecipada', 'Eventos exclusivos']}
                />
                <TierInfo
                  tier="gold"
                  name="Gold"
                  minPoints={5000}
                  benefits={['3% cashback', 'Happy Hour grátis', 'Bônus de aniversário']}
                />
                <TierInfo
                  tier="silver"
                  name="Silver"
                  minPoints={1000}
                  benefits={['1% cashback', 'Promoções exclusivas']}
                />
                <TierInfo
                  tier="bronze"
                  name="Bronze"
                  minPoints={0}
                  benefits={['Acúmulo de pontos', 'Acesso ao app']}
                />
              </div>
            </div>
          </div>

          {/* Points Activity */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Atividade de Pontos (Últimos 30 dias)
            </h3>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-hover rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-success-500">+45,670</p>
                <p className="text-sm text-foreground-muted">Pontos Emitidos</p>
              </div>
              <div className="bg-surface-hover rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-danger-500">-12,340</p>
                <p className="text-sm text-foreground-muted">Pontos Resgatados</p>
              </div>
              <div className="bg-surface-hover rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">33,330</p>
                <p className="text-sm text-foreground-muted">Saldo Líquido</p>
              </div>
              <div className="bg-surface-hover rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">234</p>
                <p className="text-sm text-foreground-muted">Resgates</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* User Growth */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Crescimento de Usuários
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-foreground-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <defs>
                    <linearGradient id="newUsersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="activeUsers"
                    name="Ativos"
                    stroke="#3b82f6"
                    fill="none"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="newUsers"
                    name="Novos"
                    stroke="#10b981"
                    fill="url(#newUsersGradient)"
                    strokeWidth={2}
                  />
                  <Bar dataKey="churnedUsers" name="Churned" fill="#ef4444" opacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* RFM Distribution */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Distribuição RFM
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={rfmDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {rfmDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {rfmDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground-muted">{item.name}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cohort Retention */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Retenção por Coorte
            </h3>
            <p className="text-sm text-foreground-muted mb-4">
              Porcentagem de usuários ativos por mês após o cadastro
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-foreground-muted font-medium">Coorte</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 0</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 1</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 2</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 3</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 4</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 5</th>
                    <th className="px-3 py-2 text-center text-foreground-muted font-medium">Mês 6</th>
                  </tr>
                </thead>
                <tbody>
                  {['Jan 2024', 'Fev 2024', 'Mar 2024', 'Abr 2024'].map((cohort, i) => (
                    <tr key={cohort}>
                      <td className="px-3 py-2 font-medium">{cohort}</td>
                      {[100, 78, 65, 58, 52, 48, 45].slice(0, 7 - i).map((retention, j) => (
                        <td key={j} className="px-3 py-2 text-center">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            retention >= 70 ? 'bg-success-500/20 text-success-500' :
                            retention >= 50 ? 'bg-warning-500/20 text-warning-500' :
                            'bg-danger-500/20 text-danger-500'
                          )}>
                            {retention}%
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  icon: React.ElementType;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'blue' | 'emerald' | 'purple';
  trend?: number;
}

function KPICard({ title, value, icon: Icon, color, trend }: KPICardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    danger: 'text-danger-500 bg-danger-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            trend >= 0 ? 'text-success-500' : 'text-danger-500'
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted">{title}</p>
    </div>
  );
}

function TierBadge({ tier }: { tier: EVUser['tier'] }) {
  const tierConfig = {
    platinum: { label: 'Platinum', class: 'bg-gradient-to-r from-gray-300 to-gray-100 text-gray-800', icon: Crown },
    gold: { label: 'Gold', class: 'bg-gradient-to-r from-yellow-500 to-yellow-300 text-yellow-900', icon: Star },
    silver: { label: 'Silver', class: 'bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800', icon: Award },
    bronze: { label: 'Bronze', class: 'bg-gradient-to-r from-orange-600 to-orange-400 text-white', icon: Shield },
  };

  const config = tierConfig[tier];
  const TierIcon = config.icon;

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1', config.class)}>
      <TierIcon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: EVUser['status'] }) {
  const statusConfig = {
    active: { label: 'Ativo', class: 'bg-success-500/20 text-success-500' },
    inactive: { label: 'Inativo', class: 'bg-gray-500/20 text-gray-400' },
    suspended: { label: 'Suspenso', class: 'bg-danger-500/20 text-danger-500' },
    churned: { label: 'Churned', class: 'bg-purple-500/20 text-purple-400' },
  };

  const config = statusConfig[status];

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', config.class)}>
      {config.label}
    </span>
  );
}

function RFMScore({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-2 bg-surface-active rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            score >= 80 ? 'bg-success-500' :
            score >= 50 ? 'bg-warning-500' : 'bg-danger-500'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium">{score}</span>
    </div>
  );
}

function ChurnRiskBadge({ risk }: { risk: EVUser['churnRisk'] }) {
  const riskConfig = {
    low: { label: 'Baixo', class: 'bg-success-500/20 text-success-500' },
    medium: { label: 'Médio', class: 'bg-warning-500/20 text-warning-500' },
    high: { label: 'Alto', class: 'bg-danger-500/20 text-danger-500' },
  };

  const config = riskConfig[risk];

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', config.class)}>
      {config.label}
    </span>
  );
}

function SegmentCard({ segment }: { segment: UserSegment }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${segment.color}20` }}
          >
            <Target className="w-5 h-5" style={{ color: segment.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{segment.name}</h3>
            <p className="text-xs text-foreground-muted">{segment.description}</p>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-2xl font-bold text-foreground">{segment.count.toLocaleString()}</p>
        <p className="text-xs text-foreground-muted">usuários</p>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {segment.criteria.map((criterion, i) => (
          <span key={i} className="text-xs bg-surface-hover px-2 py-0.5 rounded text-foreground-muted">
            {criterion}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <button className="text-xs text-primary hover:underline">Ver usuários</button>
        <button className="text-xs text-foreground-muted hover:text-foreground">Editar</button>
      </div>
    </div>
  );
}

function TierInfo({ tier, name, minPoints, benefits }: {
  tier: EVUser['tier'];
  name: string;
  minPoints: number;
  benefits: string[];
}) {
  const tierColors = {
    platinum: 'border-gray-300 bg-gradient-to-r from-gray-100 to-gray-50',
    gold: 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-25',
    silver: 'border-gray-300 bg-gradient-to-r from-gray-50 to-white',
    bronze: 'border-orange-400 bg-gradient-to-r from-orange-50 to-orange-25',
  };

  return (
    <div className={cn('rounded-lg border-2 p-3', tierColors[tier])}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TierBadge tier={tier} />
          <span className="text-sm font-medium text-foreground">{name}</span>
        </div>
        <span className="text-xs text-foreground-muted">{minPoints.toLocaleString()}+ pts</span>
      </div>
      <ul className="text-xs text-foreground-muted space-y-1">
        {benefits.map((benefit, i) => (
          <li key={i} className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-success-500" />
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  );
}
