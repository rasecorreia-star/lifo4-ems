import { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  Building,
  Shield,
  Calendar,
  Edit2,
  Save,
  X,
  Loader2,
  Camera,
  UserPlus,
  Users,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole, User } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { usersApi } from '@/services/api';

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const { isEndUser, canInviteFamily } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState<User[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Fetch family members for end users
  useEffect(() => {
    if (isEndUser && canInviteFamily) {
      fetchFamilyMembers();
    }
  }, [isEndUser, canInviteFamily]);

  const fetchFamilyMembers = async () => {
    try {
      const response = await usersApi.getAll();
      const members = (response.data.data || []).filter(
        (u) => u.invitedBy === user?.id
      );
      setFamilyMembers(members);
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateUser({ name, phone });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setIsEditing(false);
  };

  const roleLabels: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Administrador',
    [UserRole.ADMIN]: 'Administrador',
    [UserRole.MANAGER]: 'Gerente',
    [UserRole.TECHNICIAN]: 'Técnico',
    [UserRole.OPERATOR]: 'Operador',
    [UserRole.VIEWER]: 'Visualizador',
    [UserRole.USER]: 'Usuário Final',
  };

  const roleColors: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'bg-purple-500/20 text-purple-500',
    [UserRole.ADMIN]: 'bg-primary/20 text-primary',
    [UserRole.MANAGER]: 'bg-secondary/20 text-secondary',
    [UserRole.TECHNICIAN]: 'bg-warning-500/20 text-warning-500',
    [UserRole.OPERATOR]: 'bg-success-500/20 text-success-500',
    [UserRole.VIEWER]: 'bg-foreground-subtle/20 text-foreground-muted',
    [UserRole.USER]: 'bg-cyan-500/20 text-cyan-500',
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-foreground-muted text-sm">
            Visualize e edite suas informações pessoais
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-primary-900 via-primary-800 to-secondary-900 relative">
          <div className="absolute -bottom-12 left-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/20 border-4 border-surface flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {isEditing && (
                <button className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-white hover:bg-primary-600 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-16 px-6 pb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xl font-bold text-foreground bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
              )}
              <p className="text-foreground-muted">{user.email}</p>
            </div>
            <span
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                roleColors[user.role]
              )}
            >
              {roleLabels[user.role]}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard
              icon={Mail}
              label="Email"
              value={user.email}
            />
            <InfoCard
              icon={Phone}
              label="Telefone"
              value={phone}
              isEditing={isEditing}
              onChange={setPhone}
            />
            <InfoCard
              icon={Building}
              label="Organização"
              value={user.organizationId}
            />
            <InfoCard
              icon={Shield}
              label="2FA"
              value={user.twoFactorEnabled ? 'Habilitada' : 'Desabilitada'}
              valueClassName={user.twoFactorEnabled ? 'text-success-500' : 'text-foreground-muted'}
            />
            <InfoCard
              icon={Calendar}
              label="Último Acesso"
              value={user.lastLogin ? formatDate(user.lastLogin) : 'N/A'}
            />
            <InfoCard
              icon={Calendar}
              label="Conta Criada"
              value={formatDate(user.createdAt)}
            />
          </div>
        </div>
      </div>

      {/* Permissions - hide for end users */}
      {!isEndUser && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Permissões</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {user.permissions.map((permission, index) => (
              <div
                key={index}
                className="bg-background rounded-lg border border-border p-4"
              >
                <h4 className="font-medium text-foreground capitalize mb-2">
                  {permission.resource}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {permission.actions.map((action) => (
                    <span
                      key={action}
                      className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family Members - only for end users with invite permission */}
      {isEndUser && canInviteFamily && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Membros da Família</h3>
              <p className="text-sm text-foreground-muted">
                Convide familiares para acompanhar seu sistema
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Convidar
            </button>
          </div>

          {familyMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-3 text-foreground-subtle" />
              <p className="text-foreground-muted">Nenhum familiar convidado ainda</p>
              <p className="text-sm text-foreground-subtle">
                Convide familiares para que eles também possam acompanhar o sistema
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-background rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <span className="text-cyan-500 font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-sm text-foreground-muted">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        member.isActive
                          ? 'bg-success-500/20 text-success-500'
                          : 'bg-warning-500/20 text-warning-500'
                      )}
                    >
                      {member.isActive ? 'Ativo' : 'Pendente'}
                    </span>
                    <button className="p-2 hover:bg-danger-500/10 rounded-lg transition-colors text-foreground-muted hover:text-danger-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Family Modal */}
      {showInviteModal && (
        <InviteFamilyModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            fetchFamilyMembers();
          }}
        />
      )}

      {/* Activity */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h3>
        <div className="space-y-4">
          <ActivityItem
            action="Login realizado"
            description="Acesso via navegador"
            time="Há 2 horas"
          />
          <ActivityItem
            action="Senha alterada"
            description="Senha atualizada com sucesso"
            time="Há 3 dias"
          />
          <ActivityItem
            action="2FA habilitada"
            description="Autenticação em duas etapas ativada"
            time="Há 1 semana"
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-surface rounded-xl border border-danger-500/30 p-6">
        <h3 className="text-lg font-semibold text-danger-500 mb-2">Zona de Perigo</h3>
        <p className="text-foreground-muted text-sm mb-4">
          Ações irreversíveis relacionadas à sua conta
        </p>
        <div className="flex flex-wrap gap-4">
          <button className="px-4 py-2 bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 font-medium rounded-lg transition-colors">
            Desativar Conta
          </button>
          <button className="px-4 py-2 border border-danger-500/30 hover:border-danger-500 text-danger-500 font-medium rounded-lg transition-colors">
            Excluir Conta
          </button>
        </div>
      </div>
    </div>
  );
}

// Info Card
interface InfoCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  isEditing?: boolean;
  onChange?: (v: string) => void;
  valueClassName?: string;
}

function InfoCard({ icon: Icon, label, value, isEditing, onChange, valueClassName }: InfoCardProps) {
  return (
    <div className="bg-background rounded-lg border border-border p-4">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-4 h-4 text-foreground-muted" />
        <span className="text-sm text-foreground-muted">{label}</span>
      </div>
      {isEditing && onChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Digite o ${label.toLowerCase()}`}
          className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        <p className={cn('font-medium', valueClassName || 'text-foreground')}>
          {value || 'Não informado'}
        </p>
      )}
    </div>
  );
}

// Activity Item
function ActivityItem({ action, description, time }: { action: string; description: string; time: string }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
      <div className="flex-1">
        <p className="font-medium text-foreground">{action}</p>
        <p className="text-sm text-foreground-muted">{description}</p>
      </div>
      <span className="text-xs text-foreground-subtle">{time}</span>
    </div>
  );
}

// Invite Family Modal
interface InviteFamilyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function InviteFamilyModal({ onClose, onSuccess }: InviteFamilyModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);

    try {
      await usersApi.inviteFamily({ name, email });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao enviar convite');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-cyan-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Convidar Familiar</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-6 text-center">
            <div className="p-3 bg-success-500/10 rounded-full w-fit mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-success-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Convite Enviado!
            </h3>
            <p className="text-foreground-muted">
              Um email foi enviado para {email} com as instruções de acesso.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-foreground-muted">
              Convide um familiar para acompanhar o sistema de energia. Ele terá acesso
              apenas às informações básicas (SOC, economia, alertas não-técnicos).
            </p>

            {error && (
              <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
                <p className="text-sm text-danger-500">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome do familiar
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Maria Silva"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email do familiar
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@exemplo.com"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <p className="text-sm text-cyan-600 dark:text-cyan-400">
                <strong>Importante:</strong> O familiar convidado terá acesso aos mesmos
                sistemas que você, mas apenas em modo visualização simplificado.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-foreground-muted hover:text-foreground font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Enviar Convite
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
