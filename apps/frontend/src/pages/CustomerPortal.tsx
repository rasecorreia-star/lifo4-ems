import { useState, useMemo } from 'react';
import {
  Battery,
  Zap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  FileText,
  Sun,
  Moon,
  Clock,
  Leaf,
  AlertCircle,
  CheckCircle,
  Phone,
  Mail,
  MessageSquare,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

export default function CustomerPortal() {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');

  const systemOverview = useMemo(() => ({
    systemName: 'BESS Residencial - Teresina',
    capacity: 13.5,
    currentSoc: 78,
    status: 'online',
    lastUpdate: new Date().toLocaleString('pt-BR'),
    installDate: '2024-06-15',
    warrantyEnd: '2034-06-15',
  }), []);

  const energyStats = useMemo(() => ({
    todayGeneration: 28.5,
    todayConsumption: 32.1,
    todaySavings: 45.80,
    monthSavings: 892.50,
    yearSavings: 8540.00,
    co2Avoided: 1.2,
  }), []);

  const weeklyData = useMemo(() => [
    { day: 'Seg', solar: 25, consumo: 30, bateria: 8 },
    { day: 'Ter', solar: 32, consumo: 28, bateria: 12 },
    { day: 'Qua', solar: 28, consumo: 35, bateria: 6 },
    { day: 'Qui', solar: 35, consumo: 32, bateria: 10 },
    { day: 'Sex', solar: 30, consumo: 38, bateria: 5 },
    { day: 'Sab', solar: 22, consumo: 25, bateria: 8 },
    { day: 'Dom', solar: 18, consumo: 20, bateria: 6 },
  ], []);

  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      solar: i >= 6 && i <= 18 ? Math.floor(Math.random() * 3 + (i > 10 && i < 15 ? 4 : 1)) : 0,
      consumo: Math.floor(Math.random() * 2 + (i >= 18 && i <= 22 ? 3 : 1)),
      bateria: i >= 18 ? Math.floor(Math.random() * 2) : 0,
    }));
  }, []);

  const energyDistribution = useMemo(() => [
    { name: 'Solar Direto', value: 45, color: '#f59e0b' },
    { name: 'Bateria', value: 30, color: '#3b82f6' },
    { name: 'Rede', value: 25, color: '#6b7280' },
  ], []);

  const recentAlerts = useMemo(() => [
    { id: '1', message: 'Bateria carregada a 100%', time: 'Hoje, 14:30', type: 'info' },
    { id: '2', message: 'Economia recorde no mes!', time: 'Ontem', type: 'success' },
    { id: '3', message: 'Manutencao preventiva agendada', time: '20/01', type: 'warning' },
  ], []);

  const invoices = useMemo(() => [
    { month: 'Janeiro 2025', value: 892.50, status: 'economia' },
    { month: 'Dezembro 2024', value: 756.30, status: 'economia' },
    { month: 'Novembro 2024', value: 845.20, status: 'economia' },
  ], []);

  const COLORS = ['#f59e0b', '#3b82f6', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Sistema Solar + Bateria</h1>
          <p className="text-foreground-muted">{systemOverview.systemName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            systemOverview.status === 'online'
              ? 'bg-success-500/20 text-success-500'
              : 'bg-danger-500/20 text-danger-500'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {systemOverview.status === 'online' ? 'Sistema Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Battery className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Bateria</p>
              <p className="text-2xl font-bold text-foreground">{systemOverview.currentSoc}%</p>
              <p className="text-xs text-foreground-muted">{systemOverview.capacity} kWh</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-warning-500/20 to-warning-500/5 rounded-xl p-4 border border-warning-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning-500/20 rounded-xl">
              <Sun className="w-6 h-6 text-warning-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Geracao Hoje</p>
              <p className="text-2xl font-bold text-foreground">{energyStats.todayGeneration} kWh</p>
              <p className="text-xs text-success-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12% vs ontem
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500/20 to-success-500/5 rounded-xl p-4 border border-success-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-success-500/20 rounded-xl">
              <DollarSign className="w-6 h-6 text-success-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Economia Hoje</p>
              <p className="text-2xl font-bold text-success-500">R$ {energyStats.todaySavings.toFixed(2)}</p>
              <p className="text-xs text-foreground-muted">R$ {energyStats.monthSavings.toFixed(2)} no mes</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Leaf className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">CO2 Evitado</p>
              <p className="text-2xl font-bold text-foreground">{energyStats.co2Avoided} ton</p>
              <p className="text-xs text-foreground-muted">Este ano</p>
            </div>
          </div>
        </div>
      </div>

      {/* Energy Flow - Simplified */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {/* Solar */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-warning-500/20 flex items-center justify-center mx-auto mb-2">
              <Sun className="w-10 h-10 text-warning-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Solar</p>
            <p className="text-lg font-bold text-warning-500">2.8 kW</p>
          </div>

          {/* Arrow */}
          <div className="text-foreground-muted">→</div>

          {/* Battery */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
              <Battery className="w-10 h-10 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Bateria</p>
            <p className="text-lg font-bold text-primary">{systemOverview.currentSoc}%</p>
          </div>

          {/* Arrow */}
          <div className="text-foreground-muted">→</div>

          {/* Home */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-success-500/20 flex items-center justify-center mx-auto mb-2">
              <Zap className="w-10 h-10 text-success-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Consumo</p>
            <p className="text-lg font-bold text-success-500">1.5 kW</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Energy Chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Energia da Semana</h3>
            <div className="flex gap-2">
              {['day', 'week', 'month'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period as typeof selectedPeriod)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    selectedPeriod === period
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {period === 'day' ? 'Hoje' : period === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
              <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} unit=" kWh" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="solar" name="Solar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bateria" name="Bateria" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="consumo" name="Consumo" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-warning-500" />
              <span className="text-sm text-foreground-muted">Solar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-foreground-muted">Bateria</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success-500" />
              <span className="text-sm text-foreground-muted">Consumo</span>
            </div>
          </div>
        </div>

        {/* Energy Distribution */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Fonte de Energia</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={energyDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {energyDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `${value}%`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {energyDistribution.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-foreground">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Savings Summary */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Resumo de Economia</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-success-500/10 rounded-lg">
              <span className="text-sm text-foreground">Hoje</span>
              <span className="text-lg font-bold text-success-500">R$ {energyStats.todaySavings.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-sm text-foreground">Este Mes</span>
              <span className="text-lg font-bold text-foreground">R$ {energyStats.monthSavings.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
              <span className="text-sm text-foreground">Este Ano</span>
              <span className="text-lg font-bold text-foreground">R$ {energyStats.yearSavings.toFixed(2)}</span>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-foreground-muted text-center">
                Voce ja economizou o equivalente a <strong className="text-foreground">14 meses</strong> de conta de luz!
              </p>
            </div>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Notificacoes</h3>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-surface-hover rounded-lg">
                {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-success-500 mt-0.5" />}
                {alert.type === 'warning' && <AlertCircle className="w-5 h-5 text-warning-500 mt-0.5" />}
                {alert.type === 'info' && <Zap className="w-5 h-5 text-primary mt-0.5" />}
                <div>
                  <p className="text-sm text-foreground">{alert.message}</p>
                  <p className="text-xs text-foreground-muted">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Acoes Rapidas</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
              <FileText className="w-6 h-6 text-primary" />
              <span className="text-sm text-foreground">Relatorios</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
              <Download className="w-6 h-6 text-primary" />
              <span className="text-sm text-foreground">Exportar</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
              <Calendar className="w-6 h-6 text-primary" />
              <span className="text-sm text-foreground">Agendar</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 bg-surface-hover hover:bg-primary/10 rounded-lg transition-colors">
              <MessageSquare className="w-6 h-6 text-primary" />
              <span className="text-sm text-foreground">Suporte</span>
            </button>
          </div>
        </div>
      </div>

      {/* Support Section */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Precisa de Ajuda?</h3>
            <p className="text-sm text-foreground-muted">Nossa equipe esta pronta para atender voce</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="tel:+558631234567"
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              <Phone className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">(86) 3123-4567</span>
            </a>
            <a
              href="mailto:suporte@lifo4.com.br"
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">suporte@lifo4.com.br</span>
            </a>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <MessageSquare className="w-4 h-4" />
              Chat Online
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Informacoes do Sistema</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-surface-hover rounded-lg">
            <p className="text-xs text-foreground-muted">Capacidade da Bateria</p>
            <p className="text-sm font-semibold text-foreground">{systemOverview.capacity} kWh</p>
          </div>
          <div className="p-3 bg-surface-hover rounded-lg">
            <p className="text-xs text-foreground-muted">Data de Instalacao</p>
            <p className="text-sm font-semibold text-foreground">
              {new Date(systemOverview.installDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="p-3 bg-surface-hover rounded-lg">
            <p className="text-xs text-foreground-muted">Garantia ate</p>
            <p className="text-sm font-semibold text-foreground">
              {new Date(systemOverview.warrantyEnd).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="p-3 bg-surface-hover rounded-lg">
            <p className="text-xs text-foreground-muted">Ultima Atualizacao</p>
            <p className="text-sm font-semibold text-foreground">{systemOverview.lastUpdate}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
