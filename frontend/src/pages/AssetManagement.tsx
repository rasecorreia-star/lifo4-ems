import { useMemo, useState } from 'react';
import {
  Package,
  Search,
  Plus,
  QrCode,
  MapPin,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  History,
  FileText,
  Barcode,
  Truck,
  Building,
  LayoutGrid,
  List,
} from 'lucide-react';

interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: 'battery' | 'inverter' | 'bms' | 'sensor' | 'transformer' | 'cable' | 'other';
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: 'operational' | 'maintenance' | 'faulty' | 'retired';
  location: string;
  systemId?: string;
  systemName?: string;
  purchaseDate: string;
  purchaseCost: number;
  warrantyExpiry: string;
  lastMaintenance: string;
  nextMaintenance: string;
  specifications: Record<string, string>;
  documents: number;
}

export default function AssetManagement() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const assets = useMemo<Asset[]>(() => [
    {
      id: 'ast-1',
      assetTag: 'AST-BAT-001',
      name: 'Modulo de Bateria LFP',
      category: 'battery',
      manufacturer: 'BYD',
      model: 'B-Box Premium HVS',
      serialNumber: 'BYD2024001234',
      status: 'operational',
      location: 'Rack A1',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      purchaseDate: '2024-01-15',
      purchaseCost: 45000,
      warrantyExpiry: '2029-01-15',
      lastMaintenance: '2025-01-10',
      nextMaintenance: '2025-04-10',
      specifications: {
        'Capacidade': '280 Ah',
        'Tensao Nominal': '51.2V',
        'Ciclos': '6000+',
        'Peso': '125 kg',
      },
      documents: 3,
    },
    {
      id: 'ast-2',
      assetTag: 'AST-INV-001',
      name: 'Inversor Hibrido',
      category: 'inverter',
      manufacturer: 'SMA',
      model: 'Sunny Tripower X 15',
      serialNumber: 'SMA2024005678',
      status: 'operational',
      location: 'Sala Tecnica',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      purchaseDate: '2024-01-15',
      purchaseCost: 32000,
      warrantyExpiry: '2029-01-15',
      lastMaintenance: '2025-01-05',
      nextMaintenance: '2025-07-05',
      specifications: {
        'Potencia': '15 kW',
        'Eficiencia': '98.3%',
        'Tensao AC': '220/380V',
        'Frequencia': '60 Hz',
      },
      documents: 5,
    },
    {
      id: 'ast-3',
      assetTag: 'AST-BMS-001',
      name: 'Sistema de Gerenciamento de Bateria',
      category: 'bms',
      manufacturer: 'Lifo4',
      model: 'BMS-Pro 500',
      serialNumber: 'LF4BMS2024001',
      status: 'operational',
      location: 'Rack A1',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      purchaseDate: '2024-01-15',
      purchaseCost: 8500,
      warrantyExpiry: '2027-01-15',
      lastMaintenance: '2025-01-10',
      nextMaintenance: '2025-04-10',
      specifications: {
        'Celulas Suportadas': '16S',
        'Corrente Max': '500A',
        'Protecoes': 'OVP, UVP, OCP, OTP',
        'Comunicacao': 'CAN, RS485',
      },
      documents: 2,
    },
    {
      id: 'ast-4',
      assetTag: 'AST-SEN-001',
      name: 'Sensor de Temperatura',
      category: 'sensor',
      manufacturer: 'Siemens',
      model: 'TempSense Pro',
      serialNumber: 'SIE2024TS001',
      status: 'maintenance',
      location: 'Rack A1',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      purchaseDate: '2024-03-20',
      purchaseCost: 450,
      warrantyExpiry: '2026-03-20',
      lastMaintenance: '2025-01-15',
      nextMaintenance: '2025-01-25',
      specifications: {
        'Faixa': '-40 a 125°C',
        'Precisao': '±0.5°C',
        'Saida': '4-20mA',
      },
      documents: 1,
    },
    {
      id: 'ast-5',
      assetTag: 'AST-TRF-001',
      name: 'Transformador de Isolacao',
      category: 'transformer',
      manufacturer: 'WEG',
      model: 'ISO-TRF 50kVA',
      serialNumber: 'WEG2024TRF001',
      status: 'operational',
      location: 'Subestacao',
      systemId: 'sys-1',
      systemName: 'BESS Teresina Norte',
      purchaseDate: '2024-01-10',
      purchaseCost: 28000,
      warrantyExpiry: '2034-01-10',
      lastMaintenance: '2024-12-15',
      nextMaintenance: '2025-06-15',
      specifications: {
        'Potencia': '50 kVA',
        'Tensao Primaria': '13.8 kV',
        'Tensao Secundaria': '380V',
        'Refrigeracao': 'ONAN',
      },
      documents: 4,
    },
    {
      id: 'ast-6',
      assetTag: 'AST-BAT-002',
      name: 'Modulo de Bateria LFP',
      category: 'battery',
      manufacturer: 'CATL',
      model: 'EnerOne',
      serialNumber: 'CATL2024002345',
      status: 'faulty',
      location: 'Rack B2',
      systemId: 'sys-2',
      systemName: 'BESS Piaui Sul',
      purchaseDate: '2024-02-20',
      purchaseCost: 42000,
      warrantyExpiry: '2029-02-20',
      lastMaintenance: '2025-01-18',
      nextMaintenance: '2025-02-01',
      specifications: {
        'Capacidade': '306 Ah',
        'Tensao Nominal': '51.2V',
        'Ciclos': '10000+',
        'Peso': '135 kg',
      },
      documents: 2,
    },
    {
      id: 'ast-7',
      assetTag: 'AST-INV-002',
      name: 'Inversor String',
      category: 'inverter',
      manufacturer: 'Huawei',
      model: 'SUN2000-100KTL',
      serialNumber: 'HW2023INV100',
      status: 'retired',
      location: 'Deposito',
      purchaseDate: '2022-06-15',
      purchaseCost: 55000,
      warrantyExpiry: '2027-06-15',
      lastMaintenance: '2024-10-01',
      nextMaintenance: '-',
      specifications: {
        'Potencia': '100 kW',
        'Eficiencia': '99%',
        'MPPT': '10',
      },
      documents: 6,
    },
  ], []);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = searchTerm === '' ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || asset.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [assets, searchTerm, filterCategory, filterStatus]);

  const stats = useMemo(() => {
    const totalValue = assets.reduce((sum, a) => sum + a.purchaseCost, 0);
    return {
      total: assets.length,
      operational: assets.filter(a => a.status === 'operational').length,
      maintenance: assets.filter(a => a.status === 'maintenance').length,
      faulty: assets.filter(a => a.status === 'faulty').length,
      totalValue,
    };
  }, [assets]);

  const getCategoryColor = (category: Asset['category']) => {
    switch (category) {
      case 'battery': return 'text-green-500 bg-green-500/20';
      case 'inverter': return 'text-blue-500 bg-blue-500/20';
      case 'bms': return 'text-purple-500 bg-purple-500/20';
      case 'sensor': return 'text-cyan-500 bg-cyan-500/20';
      case 'transformer': return 'text-amber-500 bg-amber-500/20';
      case 'cable': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getCategoryLabel = (category: Asset['category']) => {
    switch (category) {
      case 'battery': return 'Bateria';
      case 'inverter': return 'Inversor';
      case 'bms': return 'BMS';
      case 'sensor': return 'Sensor';
      case 'transformer': return 'Transformador';
      case 'cable': return 'Cabo';
      default: return 'Outro';
    }
  };

  const getStatusColor = (status: Asset['status']) => {
    switch (status) {
      case 'operational': return 'text-green-500 bg-green-500/20';
      case 'maintenance': return 'text-amber-500 bg-amber-500/20';
      case 'faulty': return 'text-red-500 bg-red-500/20';
      case 'retired': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: Asset['status']) => {
    switch (status) {
      case 'operational': return 'Operacional';
      case 'maintenance': return 'Manutencao';
      case 'faulty': return 'Defeituoso';
      case 'retired': return 'Desativado';
      default: return status;
    }
  };

  const getStatusIcon = (status: Asset['status']) => {
    switch (status) {
      case 'operational': return CheckCircle;
      case 'maintenance': return Settings;
      case 'faulty': return AlertTriangle;
      case 'retired': return XCircle;
      default: return Package;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestao de Ativos</h1>
          <p className="text-foreground-muted">Controle de equipamentos e patrimonio</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Novo Ativo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">Total de Ativos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground-muted">Operacionais</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.operational}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground-muted">Em Manutencao</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.maintenance}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-foreground-muted">Defeituosos</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.faulty}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground-muted">Valor Total</span>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {stats.totalValue.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, tag ou serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground"
        >
          <option value="all">Todas Categorias</option>
          <option value="battery">Baterias</option>
          <option value="inverter">Inversores</option>
          <option value="bms">BMS</option>
          <option value="sensor">Sensores</option>
          <option value="transformer">Transformadores</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-foreground"
        >
          <option value="all">Todos Status</option>
          <option value="operational">Operacional</option>
          <option value="maintenance">Manutencao</option>
          <option value="faulty">Defeituoso</option>
          <option value="retired">Desativado</option>
        </select>
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Assets */}
      {viewMode === 'list' ? (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Ativo</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Categoria</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Local</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Garantia</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground-muted">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map((asset) => {
                  const StatusIcon = getStatusIcon(asset.status);
                  const warrantyExpired = new Date(asset.warrantyExpiry) < new Date();
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="hover:bg-surface-hover cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getCategoryColor(asset.category)}`}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{asset.name}</p>
                            <p className="text-sm text-foreground-muted">{asset.assetTag}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(asset.category)}`}>
                          {getCategoryLabel(asset.category)}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-foreground">{asset.location}</p>
                        {asset.systemName && (
                          <p className="text-xs text-foreground-muted">{asset.systemName}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`w-4 h-4 ${getStatusColor(asset.status).split(' ')[0]}`} />
                          <span className={`text-sm ${getStatusColor(asset.status).split(' ')[0]}`}>
                            {getStatusLabel(asset.status)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className={`text-sm ${warrantyExpired ? 'text-red-500' : 'text-foreground'}`}>
                          {new Date(asset.warrantyExpiry).toLocaleDateString('pt-BR')}
                        </p>
                        {warrantyExpired && (
                          <p className="text-xs text-red-500">Expirada</p>
                        )}
                      </td>
                      <td className="p-4 text-sm text-foreground">
                        R$ {asset.purchaseCost.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => {
            const StatusIcon = getStatusIcon(asset.status);
            return (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className="bg-surface rounded-lg border border-border p-4 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${getCategoryColor(asset.category)}`}>
                    <Package className="w-6 h-6" />
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                    {getStatusLabel(asset.status)}
                  </span>
                </div>
                <h3 className="font-medium text-foreground mb-1">{asset.name}</h3>
                <p className="text-sm text-foreground-muted mb-3">{asset.assetTag}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <Building className="w-4 h-4" />
                    <span>{asset.manufacturer} {asset.model}</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <MapPin className="w-4 h-4" />
                    <span>{asset.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <DollarSign className="w-4 h-4" />
                    <span>R$ {asset.purchaseCost.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredAssets.length === 0 && (
        <div className="bg-surface rounded-lg border border-border p-8 text-center">
          <Package className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
          <p className="text-foreground-muted">Nenhum ativo encontrado</p>
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getCategoryColor(selectedAsset.category)}`}>
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedAsset.name}</h3>
                  <p className="text-sm text-foreground-muted">{selectedAsset.assetTag}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-2 hover:bg-surface-hover rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-6">
              {/* General Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Fabricante</p>
                  <p className="text-sm font-medium text-foreground">{selectedAsset.manufacturer}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Modelo</p>
                  <p className="text-sm font-medium text-foreground">{selectedAsset.model}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Numero de Serie</p>
                  <p className="text-sm font-medium text-foreground font-mono">{selectedAsset.serialNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedAsset.status)}`}>
                    {getStatusLabel(selectedAsset.status)}
                  </span>
                </div>
              </div>

              {/* Location */}
              <div className="p-4 bg-background rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-3">Localizacao</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Local</p>
                    <p className="text-sm text-foreground">{selectedAsset.location}</p>
                  </div>
                  {selectedAsset.systemName && (
                    <div>
                      <p className="text-xs text-foreground-muted mb-1">Sistema</p>
                      <p className="text-sm text-foreground">{selectedAsset.systemName}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial */}
              <div className="p-4 bg-background rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-3">Informacoes Financeiras</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Data de Compra</p>
                    <p className="text-sm text-foreground">{new Date(selectedAsset.purchaseDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Valor de Aquisicao</p>
                    <p className="text-sm font-medium text-foreground">R$ {selectedAsset.purchaseCost.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Garantia ate</p>
                    <p className={`text-sm ${new Date(selectedAsset.warrantyExpiry) < new Date() ? 'text-red-500' : 'text-foreground'}`}>
                      {new Date(selectedAsset.warrantyExpiry).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Maintenance */}
              <div className="p-4 bg-background rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-3">Manutencao</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Ultima Manutencao</p>
                    <p className="text-sm text-foreground">{new Date(selectedAsset.lastMaintenance).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Proxima Manutencao</p>
                    <p className="text-sm text-foreground">{selectedAsset.nextMaintenance !== '-' ? new Date(selectedAsset.nextMaintenance).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="p-4 bg-background rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-3">Especificacoes Tecnicas</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedAsset.specifications).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-foreground-muted">{key}</p>
                      <p className="text-sm font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                  <Settings className="w-4 h-4" />
                  Editar
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-surface-hover transition-colors">
                  <History className="w-4 h-4" />
                  Historico
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-surface-hover transition-colors">
                  <QrCode className="w-4 h-4" />
                  QR Code
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-surface-hover transition-colors">
                  <FileText className="w-4 h-4" />
                  Documentos ({selectedAsset.documents})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
