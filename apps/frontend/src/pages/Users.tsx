import { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserCog,
  Shield,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { usersApi, systemsApi } from '@/services/api';
import { User, UserRole, BessSystem } from '@/types';

// Role labels in Portuguese
const roleLabels: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.MANAGER]: 'Gerente',
  [UserRole.TECHNICIAN]: 'Técnico',
  [UserRole.OPERATOR]: 'Operador',
  [UserRole.VIEWER]: 'Visualizador',
  [UserRole.USER]: 'Usuário Final',
};

// Role colors
const roleColors: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'bg-purple-500/20 text-purple-500',
  [UserRole.ADMIN]: 'bg-primary/20 text-primary',
  [UserRole.MANAGER]: 'bg-secondary/20 text-secondary',
  [UserRole.TECHNICIAN]: 'bg-warning-500/20 text-warning-500',
  [UserRole.OPERATOR]: 'bg-success-500/20 text-success-500',
  [UserRole.VIEWER]: 'bg-foreground-subtle/20 text-foreground-subtle',
  [UserRole.USER]: 'bg-cyan-500/20 text-cyan-500',
};

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [systems, setSystems] = useState<BessSystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Check if current user can manage users
  const canManageUsers = currentUser && [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  ].includes(currentUser.role as UserRole);

  // Fetch users and systems
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, systemsRes] = await Promise.all([
        usersApi.getAll(),
        systemsApi.getAll(),
      ]);
      setUsers(usersRes.data.data || []);
      setSystems(systemsRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Handle delete user
  const handleDelete = async (userId: string) => {
    try {
      await usersApi.delete(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  // Handle toggle user status
  const handleToggleStatus = async (user: User) => {
    try {
      if (user.isActive) {
        await usersApi.deactivate(user.id);
      } else {
        await usersApi.activate(user.id);
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isActive: !u.isActive } : u
        )
      );
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-foreground-subtle" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Restrito</h2>
          <p className="text-foreground-muted">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <UsersSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-foreground-muted text-sm">
            Gerencie os usuários e suas permissões
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-subtle" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-subtle" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-surface border border-border rounded-lg text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
          >
            <option value="all">Todos os níveis</option>
            {Object.entries(roleLabels).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-hover">
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">
                  Usuário
                </th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">
                  Nível
                </th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted hidden md:table-cell">
                  Contato
                </th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted hidden lg:table-cell">
                  Sistemas
                </th>
                <th className="text-left p-4 text-sm font-medium text-foreground-muted">
                  Status
                </th>
                <th className="text-right p-4 text-sm font-medium text-foreground-muted">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-foreground-muted">
                    <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors"
                  >
                    {/* User info */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-sm text-foreground-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-full',
                          roleColors[user.role as UserRole]
                        )}
                      >
                        {roleLabels[user.role as UserRole]}
                      </span>
                    </td>

                    {/* Contact */}
                    <td className="p-4 hidden md:table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-foreground-muted">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-sm text-foreground-muted">
                            <Phone className="w-4 h-4" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Systems count */}
                    <td className="p-4 hidden lg:table-cell">
                      {user.role === UserRole.USER && user.allowedSystems ? (
                        <span className="text-sm text-foreground-muted">
                          {user.allowedSystems.length} sistema(s)
                        </span>
                      ) : user.role === UserRole.SUPER_ADMIN ? (
                        <span className="text-sm text-foreground-muted">Todos</span>
                      ) : (
                        <span className="text-sm text-foreground-muted">Organização</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
                          user.isActive
                            ? 'bg-success-500/20 text-success-500'
                            : 'bg-danger-500/20 text-danger-500'
                        )}
                      >
                        {user.isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setActiveDropdown(activeDropdown === user.id ? null : user.id)
                          }
                          className="p-2 hover:bg-surface-active rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-foreground-muted" />
                        </button>

                        {activeDropdown === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg z-10 py-1">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowCreateModal(true);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-hover flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                handleToggleStatus(user);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-hover flex items-center gap-2"
                            >
                              {user.isActive ? (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Ativar
                                </>
                              )}
                            </button>
                            <hr className="my-1 border-border" />
                            <button
                              onClick={() => {
                                setShowDeleteConfirm(user.id);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-danger-500 hover:bg-danger-500/10 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {showCreateModal && (
        <UserFormModal
          user={editingUser}
          systems={systems}
          onClose={() => {
            setShowCreateModal(false);
            setEditingUser(null);
          }}
          onSave={(savedUser) => {
            if (editingUser) {
              setUsers((prev) =>
                prev.map((u) => (u.id === savedUser.id ? savedUser : u))
              );
            } else {
              setUsers((prev) => [...prev, savedUser]);
            }
            setShowCreateModal(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {/* Close dropdown on outside click */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}

// User Form Modal Component
interface UserFormModalProps {
  user: User | null;
  systems: BessSystem[];
  onClose: () => void;
  onSave: (user: User) => void;
}

function UserFormModal({ user, systems, onClose, onSave }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || UserRole.VIEWER,
    isEndUser: user?.isEndUser || false,
    allowedSystems: user?.allowedSystems || [] as string[],
    canInviteFamily: user?.canInviteFamily || false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!user;
  const showSystemSelection = formData.role === UserRole.USER || formData.isEndUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      let savedUser: User;

      if (isEditMode) {
        const response = await usersApi.update(user.id, {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
          allowedSystems: formData.allowedSystems,
          canInviteFamily: formData.canInviteFamily,
        });
        savedUser = response.data.data!;
      } else {
        const response = await usersApi.create({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          isEndUser: formData.isEndUser,
          allowedSystems: formData.allowedSystems,
          canInviteFamily: formData.canInviteFamily,
        });
        savedUser = response.data.data!;
      }

      onSave(savedUser);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao salvar usuário');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSystemToggle = (systemId: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedSystems: prev.allowedSystems.includes(systemId)
        ? prev.allowedSystems.filter((id) => id !== systemId)
        : [...prev.allowedSystems, systemId],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEditMode ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-500">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nome completo
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isEditMode}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Telefone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nível de Acesso
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(roleLabels).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role as UserRole })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-sm font-medium transition-all text-left',
                    formData.role === role
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* End User Toggle */}
          {formData.role === UserRole.USER && (
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-cyan-500" />
                  <span className="font-medium text-foreground">Usuário Final</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isEndUser}
                    onChange={(e) =>
                      setFormData({ ...formData, isEndUser: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-active rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <p className="text-sm text-foreground-muted">
                Usuário final terá acesso apenas aos sistemas selecionados abaixo.
              </p>
            </div>
          )}

          {/* System Selection (for End Users) */}
          {showSystemSelection && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sistemas Permitidos
              </label>
              <div className="p-4 bg-warning-500/10 border border-warning-500/20 rounded-lg mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-warning-500">
                    Este usuário <strong>APENAS</strong> verá os sistemas selecionados abaixo.
                    Nenhum outro sistema ou dados serão acessíveis.
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {systems.map((system) => (
                  <label
                    key={system.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      formData.allowedSystems.includes(system.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-surface-hover'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.allowedSystems.includes(system.id)}
                      onChange={() => handleSystemToggle(system.id)}
                      className="rounded border-border bg-background text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">{system.name}</p>
                      <p className="text-sm text-foreground-muted">
                        {system.model} - {system.serialNumber}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Can Invite Family (for End Users) */}
          {showSystemSelection && (
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">Pode convidar familiares</p>
                  <p className="text-sm text-foreground-muted">
                    Permite que o usuário convide membros da família com o mesmo acesso.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canInviteFamily}
                  onChange={(e) =>
                    setFormData({ ...formData, canInviteFamily: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-active rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-foreground-muted hover:text-foreground font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  {isEditMode ? 'Salvar Alterações' : 'Criar Usuário'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-danger-500/10 rounded-full">
            <AlertTriangle className="w-6 h-6 text-danger-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Excluir Usuário</h3>
            <p className="text-sm text-foreground-muted">
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <p className="text-foreground-muted mb-6">
          Tem certeza que deseja excluir este usuário? Todos os dados associados serão
          permanentemente removidos.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-foreground-muted hover:text-foreground font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-danger-500 hover:bg-danger-600 text-white font-medium rounded-lg transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function UsersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-32 bg-surface rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-surface rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-surface rounded-lg animate-pulse" />
      </div>
      <div className="flex gap-4">
        <div className="h-10 flex-1 bg-surface rounded-lg animate-pulse" />
        <div className="h-10 w-44 bg-surface rounded-lg animate-pulse" />
      </div>
      <div className="bg-surface rounded-xl border border-border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border-b border-border last:border-0 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-hover animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-surface-hover rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-surface-hover rounded animate-pulse" />
            </div>
            <div className="h-6 w-20 bg-surface-hover rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
