import { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingDown,
  Box,
  Truck,
  BarChart3,
  Filter,
  Download,
  Edit,
  Trash2,
  ShoppingCart,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface InventoryItem {
  id: string;
  partNumber: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  location: string;
  unitCost: number;
  supplier: string;
  leadTime: number;
  lastRestock: string;
  status: 'ok' | 'low' | 'critical' | 'out';
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  items: number;
  totalValue: number;
  status: 'pending' | 'approved' | 'shipped' | 'received';
  createdAt: string;
  expectedDelivery: string;
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'analytics'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const inventoryItems: InventoryItem[] = useMemo(() => [
    {
      id: '1',
      partNumber: 'BAT-LFP-100',
      name: 'Celula LFP 100Ah',
      category: 'Baterias',
      quantity: 48,
      minStock: 20,
      maxStock: 100,
      location: 'Armazem A - Prateleira 1',
      unitCost: 450.00,
      supplier: 'CATL Brasil',
      leadTime: 45,
      lastRestock: '2025-01-10',
      status: 'ok',
    },
    {
      id: '2',
      partNumber: 'BMS-CTRL-V3',
      name: 'Controlador BMS v3.2',
      category: 'Eletronicos',
      quantity: 8,
      minStock: 10,
      maxStock: 30,
      location: 'Armazem B - Prateleira 3',
      unitCost: 1200.00,
      supplier: 'Orion BMS',
      leadTime: 30,
      lastRestock: '2025-01-05',
      status: 'low',
    },
    {
      id: '3',
      partNumber: 'INV-50KW-TRF',
      name: 'Inversor Trifasico 50kW',
      category: 'Inversores',
      quantity: 2,
      minStock: 3,
      maxStock: 10,
      location: 'Armazem A - Area Especial',
      unitCost: 25000.00,
      supplier: 'SMA Solar',
      leadTime: 60,
      lastRestock: '2024-12-20',
      status: 'critical',
    },
    {
      id: '4',
      partNumber: 'FUSE-250A',
      name: 'Fusivel NH 250A',
      category: 'Protecao',
      quantity: 25,
      minStock: 15,
      maxStock: 50,
      location: 'Armazem B - Prateleira 7',
      unitCost: 85.00,
      supplier: 'ABB Brasil',
      leadTime: 7,
      lastRestock: '2025-01-15',
      status: 'ok',
    },
    {
      id: '5',
      partNumber: 'COOL-FAN-48V',
      name: 'Ventilador 48V DC',
      category: 'Refrigeracao',
      quantity: 0,
      minStock: 10,
      maxStock: 40,
      location: 'Armazem B - Prateleira 5',
      unitCost: 180.00,
      supplier: 'Nidec Brasil',
      leadTime: 14,
      lastRestock: '2024-11-30',
      status: 'out',
    },
    {
      id: '6',
      partNumber: 'CABLE-95MM',
      name: 'Cabo 95mm2 Flexivel (m)',
      category: 'Cabos',
      quantity: 150,
      minStock: 100,
      maxStock: 500,
      location: 'Armazem C - Bobinas',
      unitCost: 45.00,
      supplier: 'Prysmian',
      leadTime: 5,
      lastRestock: '2025-01-12',
      status: 'ok',
    },
    {
      id: '7',
      partNumber: 'SENS-TEMP-PT100',
      name: 'Sensor Temperatura PT100',
      category: 'Sensores',
      quantity: 12,
      minStock: 20,
      maxStock: 60,
      location: 'Armazem B - Prateleira 2',
      unitCost: 65.00,
      supplier: 'Omega Eng.',
      leadTime: 10,
      lastRestock: '2025-01-08',
      status: 'low',
    },
    {
      id: '8',
      partNumber: 'CONT-DC-400A',
      name: 'Contator DC 400A',
      category: 'Protecao',
      quantity: 6,
      minStock: 5,
      maxStock: 20,
      location: 'Armazem A - Prateleira 4',
      unitCost: 890.00,
      supplier: 'Schneider',
      leadTime: 21,
      lastRestock: '2025-01-02',
      status: 'ok',
    },
  ], []);

  const purchaseOrders: PurchaseOrder[] = useMemo(() => [
    {
      id: '1',
      orderNumber: 'PO-2025-001',
      supplier: 'CATL Brasil',
      items: 3,
      totalValue: 45000.00,
      status: 'shipped',
      createdAt: '2025-01-10',
      expectedDelivery: '2025-02-15',
    },
    {
      id: '2',
      orderNumber: 'PO-2025-002',
      supplier: 'Orion BMS',
      items: 2,
      totalValue: 18500.00,
      status: 'approved',
      createdAt: '2025-01-18',
      expectedDelivery: '2025-02-20',
    },
    {
      id: '3',
      orderNumber: 'PO-2025-003',
      supplier: 'Nidec Brasil',
      items: 1,
      totalValue: 3600.00,
      status: 'pending',
      createdAt: '2025-01-20',
      expectedDelivery: '2025-02-05',
    },
    {
      id: '4',
      orderNumber: 'PO-2024-089',
      supplier: 'SMA Solar',
      items: 2,
      totalValue: 52000.00,
      status: 'received',
      createdAt: '2024-12-15',
      expectedDelivery: '2025-01-15',
    },
  ], []);

  const categories = useMemo(() => {
    const cats = new Set(inventoryItems.map(item => item.category));
    return ['all', ...Array.from(cats)];
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [inventoryItems, searchTerm, categoryFilter]);

  const stats = useMemo(() => {
    const totalItems = inventoryItems.length;
    const lowStock = inventoryItems.filter(i => i.status === 'low').length;
    const critical = inventoryItems.filter(i => i.status === 'critical').length;
    const outOfStock = inventoryItems.filter(i => i.status === 'out').length;
    const totalValue = inventoryItems.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
    return { totalItems, lowStock, critical, outOfStock, totalValue };
  }, [inventoryItems]);

  const categoryData = useMemo(() => {
    const catMap = new Map<string, number>();
    inventoryItems.forEach(item => {
      const current = catMap.get(item.category) || 0;
      catMap.set(item.category, current + (item.quantity * item.unitCost));
    });
    return Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
  }, [inventoryItems]);

  const stockLevelData = useMemo(() => {
    return inventoryItems.slice(0, 6).map(item => ({
      name: item.partNumber,
      atual: item.quantity,
      minimo: item.minStock,
      maximo: item.maxStock,
    }));
  }, [inventoryItems]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const getStatusBadge = (status: InventoryItem['status']) => {
    switch (status) {
      case 'ok':
        return <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">OK</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Baixo</span>;
      case 'critical':
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Critico</span>;
      case 'out':
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Esgotado</span>;
    }
  };

  const getOrderStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500"><Clock className="w-3 h-3" /> Pendente</span>;
      case 'approved':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/20 text-primary"><CheckCircle className="w-3 h-3" /> Aprovado</span>;
      case 'shipped':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-info-500/20 text-info-500"><Truck className="w-3 h-3" /> Enviado</span>;
      case 'received':
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500"><Package className="w-3 h-3" /> Recebido</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
          <p className="text-foreground-muted">Gestao de pecas de reposicao e estoque</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Nova Peca
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Box className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Total Itens</p>
              <p className="text-xl font-bold text-foreground">{stats.totalItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-500/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Estoque Baixo</p>
              <p className="text-xl font-bold text-warning-500">{stats.lowStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Critico</p>
              <p className="text-xl font-bold text-danger-500">{stats.critical}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-500/20 rounded-lg">
              <XCircle className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Esgotado</p>
              <p className="text-xl font-bold text-danger-500">{stats.outOfStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Valor Total</p>
              <p className="text-lg font-bold text-foreground">R$ {(stats.totalValue / 1000).toFixed(0)}k</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Estoque
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <ShoppingCart className="w-4 h-4 inline mr-2" />
          Pedidos
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Analytics
        </button>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <input
                type="text"
                placeholder="Buscar por nome ou codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-foreground-muted" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'Todas Categorias' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-hover">
                    <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Codigo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Item</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Categoria</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Qtd</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Min/Max</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Localizacao</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Custo Unit.</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-foreground-muted uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-primary">{item.partNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-foreground-muted">{item.supplier}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-surface-hover text-foreground">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${
                          item.quantity <= item.minStock ? 'text-danger-500' : 'text-foreground'
                        }`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-foreground-muted">
                          {item.minStock} / {item.maxStock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-foreground-muted">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-foreground">
                          R$ {item.unitCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button className="p-1 hover:bg-surface-hover rounded" title="Editar">
                            <Edit className="w-4 h-4 text-foreground-muted" />
                          </button>
                          <button className="p-1 hover:bg-danger-500/10 rounded" title="Excluir">
                            <Trash2 className="w-4 h-4 text-danger-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Pedidos de Compra</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Novo Pedido
            </button>
          </div>

          <div className="grid gap-4">
            {purchaseOrders.map((order) => (
              <div key={order.id} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-lg">
                      <ShoppingCart className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{order.orderNumber}</p>
                      <p className="text-sm text-foreground-muted">{order.supplier}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Itens</p>
                      <p className="font-semibold text-foreground">{order.items}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Valor Total</p>
                      <p className="font-semibold text-foreground">
                        R$ {order.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground-muted">Previsao</p>
                      <p className="text-sm text-foreground">
                        {new Date(order.expectedDelivery).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      {getOrderStatusBadge(order.status)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Stock Levels Chart */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Niveis de Estoque</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockLevelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--foreground-muted))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--foreground-muted))', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="atual" name="Atual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minimo" name="Minimo" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Valor por Categoria</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Alertas de Reposicao</h3>
            <div className="space-y-3">
              {inventoryItems
                .filter(item => item.status !== 'ok')
                .map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.status === 'out' ? 'bg-danger-500/10' :
                      item.status === 'critical' ? 'bg-danger-500/5' :
                      'bg-warning-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${
                        item.status === 'out' || item.status === 'critical'
                          ? 'text-danger-500'
                          : 'text-warning-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-foreground-muted">
                          {item.quantity} em estoque (min: {item.minStock})
                        </p>
                      </div>
                    </div>
                    <button className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">
                      Repor
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Supplier Lead Times */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Lead Time por Fornecedor</h3>
            <div className="space-y-3">
              {[
                { supplier: 'CATL Brasil', leadTime: 45, items: 12 },
                { supplier: 'SMA Solar', leadTime: 60, items: 3 },
                { supplier: 'Orion BMS', leadTime: 30, items: 8 },
                { supplier: 'ABB Brasil', leadTime: 7, items: 15 },
                { supplier: 'Schneider', leadTime: 21, items: 10 },
              ].map((supplier, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{supplier.supplier}</p>
                    <p className="text-xs text-foreground-muted">{supplier.items} itens cadastrados</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          supplier.leadTime <= 14 ? 'bg-success-500' :
                          supplier.leadTime <= 30 ? 'bg-warning-500' : 'bg-danger-500'
                        }`}
                        style={{ width: `${Math.min(100, (supplier.leadTime / 60) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-foreground-muted w-12 text-right">
                      {supplier.leadTime}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
