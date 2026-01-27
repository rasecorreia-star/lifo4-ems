/**
 * API Keys Management Page
 * Manage API keys for external integrations
 */

import { useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Activity,
  Shield,
  ExternalLink,
  Code,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  permissions: string[];
  status: 'active' | 'expired' | 'revoked';
  usageCount: number;
  rateLimit: number;
}

// Mock API keys
const mockApiKeys: ApiKey[] = [
  {
    id: 'key-1',
    name: 'Producao - Sistema Principal',
    key: 'lf4_prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    prefix: 'lf4_prod',
    createdAt: new Date('2025-10-15'),
    lastUsed: new Date('2026-01-25T10:30:00'),
    permissions: ['read:telemetry', 'write:control', 'read:systems'],
    status: 'active',
    usageCount: 45230,
    rateLimit: 1000,
  },
  {
    id: 'key-2',
    name: 'Integracao SCADA',
    key: 'lf4_int_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
    prefix: 'lf4_int',
    createdAt: new Date('2025-12-01'),
    lastUsed: new Date('2026-01-24T18:45:00'),
    permissions: ['read:telemetry', 'read:alerts'],
    status: 'active',
    usageCount: 12450,
    rateLimit: 500,
  },
  {
    id: 'key-3',
    name: 'Teste Desenvolvimento',
    key: 'lf4_test_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    prefix: 'lf4_test',
    createdAt: new Date('2026-01-10'),
    lastUsed: new Date('2026-01-20T14:20:00'),
    expiresAt: new Date('2026-02-10'),
    permissions: ['read:telemetry'],
    status: 'active',
    usageCount: 856,
    rateLimit: 100,
  },
  {
    id: 'key-4',
    name: 'API Antiga',
    key: 'lf4_old_wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    prefix: 'lf4_old',
    createdAt: new Date('2025-06-01'),
    lastUsed: new Date('2025-09-15'),
    expiresAt: new Date('2025-12-01'),
    permissions: ['read:telemetry'],
    status: 'expired',
    usageCount: 8920,
    rateLimit: 500,
  },
];

const availablePermissions = [
  { id: 'read:telemetry', label: 'Ler Telemetria', description: 'Acesso de leitura aos dados de telemetria' },
  { id: 'write:control', label: 'Controlar Sistemas', description: 'Comandos de carga/descarga' },
  { id: 'read:systems', label: 'Ler Sistemas', description: 'Listar e visualizar sistemas' },
  { id: 'write:systems', label: 'Gerenciar Sistemas', description: 'Criar e editar sistemas' },
  { id: 'read:alerts', label: 'Ler Alertas', description: 'Visualizar alertas e notificacoes' },
  { id: 'write:alerts', label: 'Gerenciar Alertas', description: 'Reconhecer e editar alertas' },
  { id: 'read:reports', label: 'Ler Relatorios', description: 'Gerar e baixar relatorios' },
  { id: 'admin', label: 'Administrador', description: 'Acesso total ao sistema' },
];

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState<{ key: string; name: string } | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDeleteKey = (keyId: string) => {
    if (confirm('Tem certeza que deseja revogar esta chave? Esta acao nao pode ser desfeita.')) {
      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked' as const } : k))
      );
    }
  };

  const handleCreateKey = (name: string, permissions: string[], rateLimit: number, expiresIn?: number) => {
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name,
      key: `lf4_${name.toLowerCase().replace(/\s/g, '_').slice(0, 4)}_${generateRandomKey()}`,
      prefix: `lf4_${name.toLowerCase().replace(/\s/g, '_').slice(0, 4)}`,
      createdAt: new Date(),
      permissions,
      status: 'active',
      usageCount: 0,
      rateLimit,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : undefined,
    };
    setApiKeys((prev) => [newKey, ...prev]);
    setShowCreateModal(false);
    setShowKeyModal({ key: newKey.key, name: newKey.name });
  };

  const activeKeys = apiKeys.filter((k) => k.status === 'active');
  const totalUsage = apiKeys.reduce((sum, k) => sum + k.usageCount, 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" />
            Chaves de API
          </h1>
          <p className="text-foreground-muted text-sm">
            Gerencie as chaves de acesso para integracoes externas
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Chave
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Chaves Ativas" value={activeKeys.length} icon={Key} color="success" />
        <StatCard
          label="Requisicoes Totais"
          value={totalUsage.toLocaleString('pt-BR')}
          icon={Activity}
          color="primary"
        />
        <StatCard
          label="Expiram em 30 dias"
          value={apiKeys.filter((k) => k.expiresAt && k.expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000).length}
          icon={Calendar}
          color="warning"
        />
        <StatCard
          label="Revogadas"
          value={apiKeys.filter((k) => k.status === 'revoked').length}
          icon={Shield}
          color="muted"
        />
      </div>

      {/* API Keys List */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Suas Chaves de API</h3>
        </div>
        <div className="divide-y divide-border">
          {apiKeys.map((apiKey) => (
            <ApiKeyRow
              key={apiKey.id}
              apiKey={apiKey}
              isVisible={visibleKeys[apiKey.id]}
              onToggleVisibility={() =>
                setVisibleKeys((prev) => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))
              }
              onCopy={() => handleCopyKey(apiKey.key)}
              onDelete={() => handleDeleteKey(apiKey.id)}
              isCopied={copiedKey === apiKey.key}
            />
          ))}
        </div>
      </div>

      {/* Documentation Link */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Documentacao da API</h3>
            <p className="text-sm text-foreground-muted mt-1">
              Consulte nossa documentacao completa para integrar sua aplicacao com o Lifo4 EMS.
            </p>
            <div className="flex gap-3 mt-4">
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Ver Documentacao
              </button>
              <button className="px-4 py-2 bg-surface-hover text-foreground rounded-lg hover:bg-surface-active transition-colors">
                Baixar SDK
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Example Usage */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">Exemplo de Uso</h3>
        <div className="bg-background rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-foreground-muted font-mono">
{`curl -X GET "https://api.lifo4.com.br/v1/systems" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
          </pre>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-warning-500 font-medium">Seguranca</p>
          <p className="text-foreground-muted">
            Nunca compartilhe suas chaves de API. Trate-as como senhas e nunca as exponha em codigo
            do lado do cliente ou repositorios publicos.
          </p>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateKey}
        />
      )}

      {/* Show New Key Modal */}
      {showKeyModal && (
        <ShowKeyModal
          keyData={showKeyModal}
          onClose={() => setShowKeyModal(null)}
          onCopy={() => handleCopyKey(showKeyModal.key)}
        />
      )}
    </div>
  );
}

// Helper function to generate random key
function generateRandomKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Stat Card
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: 'success' | 'primary' | 'warning' | 'muted';
}) {
  const colorClasses = {
    success: 'text-success-500 bg-success-500/10',
    primary: 'text-primary bg-primary/10',
    warning: 'text-warning-500 bg-warning-500/10',
    muted: 'text-foreground-muted bg-surface-hover',
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className={cn('p-2 rounded-lg w-fit mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

// API Key Row
function ApiKeyRow({
  apiKey,
  isVisible,
  onToggleVisibility,
  onCopy,
  onDelete,
  isCopied,
}: {
  apiKey: ApiKey;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onCopy: () => void;
  onDelete: () => void;
  isCopied: boolean;
}) {
  const isExpired = apiKey.expiresAt && apiKey.expiresAt < new Date();
  const isExpiringSoon =
    apiKey.expiresAt &&
    !isExpired &&
    apiKey.expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className={cn('p-4', apiKey.status !== 'active' && 'opacity-60')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground">{apiKey.name}</h4>
            <span
              className={cn(
                'px-2 py-0.5 text-2xs font-medium rounded-full',
                apiKey.status === 'active'
                  ? 'bg-success-500/20 text-success-500'
                  : apiKey.status === 'expired'
                  ? 'bg-warning-500/20 text-warning-500'
                  : 'bg-foreground-subtle/20 text-foreground-subtle'
              )}
            >
              {apiKey.status === 'active' ? 'Ativa' : apiKey.status === 'expired' ? 'Expirada' : 'Revogada'}
            </span>
            {isExpiringSoon && (
              <span className="px-2 py-0.5 text-2xs bg-warning-500/20 text-warning-500 rounded-full">
                Expira em breve
              </span>
            )}
          </div>

          {/* Key Display */}
          <div className="flex items-center gap-2 my-2">
            <code className="px-3 py-1.5 bg-background rounded text-sm font-mono text-foreground-muted">
              {isVisible ? apiKey.key : `${apiKey.prefix}_${'•'.repeat(32)}`}
            </code>
            <button
              onClick={onToggleVisibility}
              className="p-1.5 hover:bg-surface-hover rounded transition-colors"
              title={isVisible ? 'Ocultar' : 'Mostrar'}
            >
              {isVisible ? (
                <EyeOff className="w-4 h-4 text-foreground-muted" />
              ) : (
                <Eye className="w-4 h-4 text-foreground-muted" />
              )}
            </button>
            <button
              onClick={onCopy}
              className="p-1.5 hover:bg-surface-hover rounded transition-colors"
              title="Copiar"
            >
              {isCopied ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <Copy className="w-4 h-4 text-foreground-muted" />
              )}
            </button>
          </div>

          {/* Permissions */}
          <div className="flex flex-wrap gap-1 mb-2">
            {apiKey.permissions.map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 text-2xs bg-surface-hover text-foreground-muted rounded"
              >
                {perm}
              </span>
            ))}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-foreground-muted">
            <span>Criada: {formatRelativeTime(apiKey.createdAt)}</span>
            {apiKey.lastUsed && <span>Ultimo uso: {formatRelativeTime(apiKey.lastUsed)}</span>}
            {apiKey.expiresAt && (
              <span className={isExpired ? 'text-danger-500' : ''}>
                {isExpired ? 'Expirou' : 'Expira'}: {formatRelativeTime(apiKey.expiresAt)}
              </span>
            )}
            <span>{apiKey.usageCount.toLocaleString('pt-BR')} requisicoes</span>
            <span>Limite: {apiKey.rateLimit}/min</span>
          </div>
        </div>

        {apiKey.status === 'active' && (
          <button
            onClick={onDelete}
            className="p-2 hover:bg-danger-500/10 text-foreground-muted hover:text-danger-500 rounded-lg transition-colors"
            title="Revogar chave"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Create Key Modal
function CreateKeyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, permissions: string[], rateLimit: number, expiresIn?: number) => void;
}) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read:telemetry']);
  const [rateLimit, setRateLimit] = useState(100);
  const [expiresIn, setExpiresIn] = useState<number | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && permissions.length > 0) {
      onCreate(name, permissions, rateLimit, expiresIn);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Criar Nova Chave de API</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <span className="text-foreground-muted text-lg">&times;</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome da Chave</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Integracao SCADA"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Permissoes</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availablePermissions.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissions([...permissions, perm.id]);
                      } else {
                        setPermissions(permissions.filter((p) => p !== perm.id));
                      }
                    }}
                    className="mt-1 w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{perm.label}</p>
                    <p className="text-xs text-foreground-muted">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Rate Limit (req/min)
              </label>
              <input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value))}
                min={10}
                max={10000}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Expira em (dias)
              </label>
              <input
                type="number"
                value={expiresIn || ''}
                onChange={(e) => setExpiresIn(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Nunca"
                min={1}
                max={365}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-hover text-foreground rounded-lg hover:bg-surface-active transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Criar Chave
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Show New Key Modal
function ShowKeyModal({
  keyData,
  onClose,
  onCopy,
}: {
  keyData: { key: string; name: string };
  onClose: () => void;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 text-success-500">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-semibold">Chave Criada com Sucesso!</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-500 shrink-0" />
            <p className="text-sm text-foreground-muted">
              Esta e a unica vez que voce vera esta chave. Copie e guarde em local seguro.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{keyData.name}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-background rounded-lg text-sm font-mono text-foreground break-all">
                {keyData.key}
              </code>
              <button
                onClick={handleCopy}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  copied ? 'bg-success-500/20 text-success-500' : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                )}
              >
                {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Entendi, Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
