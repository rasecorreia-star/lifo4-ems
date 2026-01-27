import { useMemo, useState } from 'react';
import {
  Key,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Cpu,
  Battery,
  RefreshCw,
  Download,
  Copy,
  ExternalLink,
  Calendar,
  Zap,
} from 'lucide-react';

interface License {
  id: string;
  name: string;
  type: 'enterprise' | 'professional' | 'standard' | 'trial';
  status: 'active' | 'expiring' | 'expired' | 'suspended';
  key: string;
  activatedAt: string;
  expiresAt: string;
  maxSystems: number;
  usedSystems: number;
  maxUsers: number;
  usedUsers: number;
  features: string[];
  supportLevel: 'premium' | 'standard' | 'basic';
}

interface Feature {
  name: string;
  included: boolean;
  limit?: string;
}

export default function LicenseManagement() {
  const [showActivate, setShowActivate] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  const license = useMemo<License>(() => ({
    id: 'lic-1',
    name: 'Lifo4 EMS Enterprise',
    type: 'enterprise',
    status: 'active',
    key: 'LF4E-XXXX-XXXX-XXXX-XXXX',
    activatedAt: '2024-01-15',
    expiresAt: '2026-01-15',
    maxSystems: 50,
    usedSystems: 12,
    maxUsers: 100,
    usedUsers: 23,
    features: [
      'Monitoramento em Tempo Real',
      'Analytics Avancado',
      'Otimizacao Automatica',
      'Integracao Grid',
      'VPP (Virtual Power Plant)',
      'API Acesso Completo',
      'Suporte Premium 24/7',
      'Backup Cloud Ilimitado',
      'Multi-Site Dashboard',
      'Relatorios Customizados',
    ],
    supportLevel: 'premium',
  }), []);

  const features = useMemo<Feature[]>(() => [
    { name: 'Monitoramento em Tempo Real', included: true },
    { name: 'Dashboard Multi-Site', included: true },
    { name: 'Analytics Avancado', included: true },
    { name: 'Otimizacao Automatica', included: true },
    { name: 'Integracao com Rede', included: true },
    { name: 'Virtual Power Plant (VPP)', included: true },
    { name: 'Trading de Energia', included: true },
    { name: 'Resposta a Demanda', included: true },
    { name: 'API REST Completa', included: true, limit: 'Ilimitado' },
    { name: 'Webhooks', included: true, limit: 'Ilimitado' },
    { name: 'Integracao MQTT', included: true },
    { name: 'Integracao Modbus', included: true },
    { name: 'Backup Automatico', included: true, limit: 'Cloud Ilimitado' },
    { name: 'Relatorios Customizados', included: true },
    { name: 'Exportacao de Dados', included: true },
    { name: 'Manutencao Preditiva', included: true },
    { name: 'Treinamento Online', included: true },
    { name: 'Suporte Premium 24/7', included: true },
  ], []);

  const usageHistory = useMemo(() => [
    { month: 'Jul', systems: 8, users: 15 },
    { month: 'Ago', systems: 9, users: 17 },
    { month: 'Set', systems: 10, users: 19 },
    { month: 'Out', systems: 10, users: 20 },
    { month: 'Nov', systems: 11, users: 21 },
    { month: 'Dez', systems: 12, users: 23 },
  ], []);

  const getStatusColor = (status: License['status']) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/20';
      case 'expiring': return 'text-amber-500 bg-amber-500/20';
      case 'expired': return 'text-red-500 bg-red-500/20';
      case 'suspended': return 'text-gray-500 bg-gray-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: License['status']) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'expiring': return 'Expirando';
      case 'expired': return 'Expirada';
      case 'suspended': return 'Suspensa';
      default: return status;
    }
  };

  const getTypeColor = (type: License['type']) => {
    switch (type) {
      case 'enterprise': return 'text-purple-500 bg-purple-500/20';
      case 'professional': return 'text-blue-500 bg-blue-500/20';
      case 'standard': return 'text-green-500 bg-green-500/20';
      case 'trial': return 'text-amber-500 bg-amber-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const daysUntilExpiry = useMemo(() => {
    const expiry = new Date(license.expiresAt);
    const today = new Date();
    const diff = expiry.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [license.expiresAt]);

  const copyLicenseKey = () => {
    navigator.clipboard.writeText(license.key);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Licenca</h1>
          <p className="text-foreground-muted">Gerencie sua licenca e recursos do sistema</p>
        </div>
        <button
          onClick={() => setShowActivate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Key className="w-4 h-4" />
          Ativar Licenca
        </button>
      </div>

      {/* License Status Card */}
      <div className="bg-gradient-to-br from-primary/20 via-surface to-surface rounded-lg border border-primary/30 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary/20 rounded-xl">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{license.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(license.type)}`}>
                  Enterprise
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(license.status)}`}>
                  {getStatusLabel(license.status)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-foreground-muted">Valida ate</p>
            <p className="text-lg font-semibold text-foreground">
              {new Date(license.expiresAt).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-sm text-green-500">{daysUntilExpiry} dias restantes</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-background/50 rounded-lg mb-6">
          <Key className="w-4 h-4 text-foreground-muted" />
          <code className="flex-1 text-sm text-foreground font-mono">{license.key}</code>
          <button
            onClick={copyLicenseKey}
            className="p-2 hover:bg-surface rounded-lg text-foreground-muted hover:text-foreground transition-colors"
            title="Copiar"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Battery className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground-muted">Sistemas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {license.usedSystems}/{license.maxSystems}
            </p>
            <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(license.usedSystems / license.maxSystems) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-background/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-foreground-muted">Usuarios</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {license.usedUsers}/{license.maxUsers}
            </p>
            <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(license.usedUsers / license.maxUsers) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-background/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-green-500" />
              <span className="text-sm text-foreground-muted">API Calls</span>
            </div>
            <p className="text-2xl font-bold text-foreground">Ilimitado</p>
            <p className="text-sm text-foreground-muted mt-2">Sem restricoes</p>
          </div>
          <div className="bg-background/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-foreground-muted">Suporte</span>
            </div>
            <p className="text-2xl font-bold text-foreground">Premium</p>
            <p className="text-sm text-foreground-muted mt-2">24/7 disponivel</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Features */}
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Recursos Incluidos</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="flex items-center gap-3 p-2"
              >
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${feature.included ? 'text-green-500' : 'text-foreground-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{feature.name}</p>
                  {feature.limit && (
                    <p className="text-xs text-foreground-muted">{feature.limit}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage History */}
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Historico de Uso</h3>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {usageHistory.map((item) => (
                <div key={item.month} className="flex items-center gap-4">
                  <span className="w-12 text-sm text-foreground-muted">{item.month}</span>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-xs text-foreground-muted">Sistemas</span>
                      <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(item.systems / license.maxSystems) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-foreground">{item.systems}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-xs text-foreground-muted">Usuarios</span>
                      <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(item.users / license.maxUsers) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-foreground">{item.users}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* License Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Ativada em</p>
              <p className="font-medium text-foreground">
                {new Date(license.activatedAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            Licenca ativa ha {Math.floor((new Date().getTime() - new Date(license.activatedAt).getTime()) / (1000 * 60 * 60 * 24))} dias
          </p>
        </div>

        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Expira em</p>
              <p className="font-medium text-foreground">
                {new Date(license.expiresAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            {daysUntilExpiry} dias restantes para renovacao
          </p>
        </div>

        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <RefreshCw className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Renovacao</p>
              <p className="font-medium text-foreground">Automatica</p>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            Sua licenca sera renovada automaticamente
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="font-semibold text-foreground mb-4">Acoes</h3>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Renovar Licenca
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Exportar Certificado
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-surface-hover transition-colors">
            <ExternalLink className="w-4 h-4" />
            Portal do Cliente
          </button>
        </div>
      </div>

      {/* Upgrade Banner */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Precisa de mais recursos?</h3>
            <p className="text-foreground-muted">
              Atualize sua licenca para obter mais sistemas, usuarios e recursos avancados.
            </p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
            Ver Planos
          </button>
        </div>
      </div>

      {/* Activate Modal */}
      {showActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-lg border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Ativar Nova Licenca</h3>
              <button
                onClick={() => setShowActivate(false)}
                className="p-1 hover:bg-surface-hover rounded"
              >
                <AlertTriangle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Chave de Licenca
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground font-mono placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground-muted">
                    Ativar uma nova licenca ira substituir a licenca atual. Esta acao nao pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowActivate(false)}
                className="px-4 py-2 text-foreground-muted hover:bg-surface-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Ativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
