import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

/**
 * Permission definitions by role
 * Each role has a set of permissions that define what they can do
 */
const rolePermissions: Record<UserRole, {
  canViewAllOrganizations: boolean;
  canViewAllSystems: boolean;
  canManageUsers: boolean;
  canManageOrganizations: boolean;
  canEditSystemSettings: boolean;
  canControlSystems: boolean;
  canViewFinancials: boolean;
  canViewTechnicalData: boolean;
  canAcknowledgeAlerts: boolean;
  canGenerateReports: boolean;
  canExportData: boolean;
  canInviteUsers: boolean;
  canInviteFamily: boolean;
  canAccessBilling: boolean;
  canAccessApiKeys: boolean;
  canViewAnalytics: boolean;
}> = {
  [UserRole.SUPER_ADMIN]: {
    canViewAllOrganizations: true,
    canViewAllSystems: true,
    canManageUsers: true,
    canManageOrganizations: true,
    canEditSystemSettings: true,
    canControlSystems: true,
    canViewFinancials: true,
    canViewTechnicalData: true,
    canAcknowledgeAlerts: true,
    canGenerateReports: true,
    canExportData: true,
    canInviteUsers: true,
    canInviteFamily: false,
    canAccessBilling: true,
    canAccessApiKeys: true,
    canViewAnalytics: true,
  },
  [UserRole.ADMIN]: {
    canViewAllOrganizations: false,
    canViewAllSystems: false, // Only their organization's systems
    canManageUsers: true, // Only their organization's users
    canManageOrganizations: false,
    canEditSystemSettings: true,
    canControlSystems: true,
    canViewFinancials: true, // Only their organization's financials
    canViewTechnicalData: true,
    canAcknowledgeAlerts: true,
    canGenerateReports: true,
    canExportData: true,
    canInviteUsers: true,
    canInviteFamily: false,
    canAccessBilling: false,
    canAccessApiKeys: false,
    canViewAnalytics: true,
  },
  [UserRole.MANAGER]: {
    canViewAllOrganizations: false,
    canViewAllSystems: false,
    canManageUsers: false,
    canManageOrganizations: false,
    canEditSystemSettings: false,
    canControlSystems: false,
    canViewFinancials: true,
    canViewTechnicalData: true,
    canAcknowledgeAlerts: true,
    canGenerateReports: true,
    canExportData: true,
    canInviteUsers: false,
    canInviteFamily: false,
    canAccessBilling: false,
    canAccessApiKeys: false,
    canViewAnalytics: true,
  },
  [UserRole.TECHNICIAN]: {
    canViewAllOrganizations: false,
    canViewAllSystems: false,
    canManageUsers: false,
    canManageOrganizations: false,
    canEditSystemSettings: true, // With approval
    canControlSystems: true,
    canViewFinancials: false,
    canViewTechnicalData: true,
    canAcknowledgeAlerts: true,
    canGenerateReports: true,
    canExportData: false,
    canInviteUsers: false,
    canInviteFamily: false,
    canAccessBilling: false,
    canAccessApiKeys: false,
    canViewAnalytics: true,
  },
  [UserRole.OPERATOR]: {
    canViewAllOrganizations: false,
    canViewAllSystems: false,
    canManageUsers: false,
    canManageOrganizations: false,
    canEditSystemSettings: false,
    canControlSystems: true, // Basic control only
    canViewFinancials: false,
    canViewTechnicalData: true,
    canAcknowledgeAlerts: true,
    canGenerateReports: false,
    canExportData: false,
    canInviteUsers: false,
    canInviteFamily: false,
    canAccessBilling: false,
    canAccessApiKeys: false,
    canViewAnalytics: false,
  },
  [UserRole.VIEWER]: {
    canViewAllOrganizations: false,
    canViewAllSystems: false,
    canManageUsers: false,
    canManageOrganizations: false,
    canEditSystemSettings: false,
    canControlSystems: false,
    canViewFinancials: false,
    canViewTechnicalData: true,
    canAcknowledgeAlerts: false,
    canGenerateReports: false,
    canExportData: false,
    canInviteUsers: false,
    canInviteFamily: false,
    canAccessBilling: false,
    canAccessApiKeys: false,
    canViewAnalytics: false,
  },
  [UserRole.USER]: {
    canViewAllOrganizations: false,
    canViewAllSystems: false, // Only allowed systems
    canManageUsers: false,
    canManageOrganizations: false,
    canEditSystemSettings: false,
    canControlSystems: false,
    canViewFinancials: false,
    canViewTechnicalData: false, // Simplified view only
    canAcknowledgeAlerts: false,
    canGenerateReports: true, // Monthly reports only
    canExportData: false,
    canInviteUsers: false,
    canInviteFamily: true, // Can invite family with same access
    canAccessBilling: false,
    canAccessApiKeys: false,
    canViewAnalytics: false,
  },
};

/**
 * Hook to get the current user's permissions
 */
export function usePermissions() {
  const { user } = useAuthStore();

  const permissions = useMemo(() => {
    if (!user) {
      return {
        // Default permissions for unauthenticated users
        canViewAllOrganizations: false,
        canViewAllSystems: false,
        canManageUsers: false,
        canManageOrganizations: false,
        canEditSystemSettings: false,
        canControlSystems: false,
        canViewFinancials: false,
        canViewTechnicalData: false,
        canAcknowledgeAlerts: false,
        canGenerateReports: false,
        canExportData: false,
        canInviteUsers: false,
        canInviteFamily: false,
        canAccessBilling: false,
        canAccessApiKeys: false,
        canViewAnalytics: false,
      };
    }

    const basePermissions = rolePermissions[user.role as UserRole] || rolePermissions[UserRole.VIEWER];

    // For USER role, check if they can invite family
    if (user.role === UserRole.USER) {
      return {
        ...basePermissions,
        canInviteFamily: user.canInviteFamily || false,
      };
    }

    return basePermissions;
  }, [user]);

  // Check if user can access a specific system
  const canAccessSystem = (systemId: string) => {
    if (!user) return false;

    // Super admin can access all
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // End users can only access their allowed systems
    if (user.role === UserRole.USER && user.allowedSystems) {
      return user.allowedSystems.includes(systemId);
    }

    // Other roles can access all systems in their organization
    return true;
  };

  // Check if user has a specific role
  const hasRole = (role: UserRole | UserRole[]) => {
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role as UserRole);
  };

  // Check if user is an end user
  const isEndUser = useMemo(() => {
    return user?.role === UserRole.USER || user?.isEndUser === true;
  }, [user]);

  // Check if user is an admin (Super Admin or Admin)
  const isAdmin = useMemo(() => {
    return user && [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(user.role as UserRole);
  }, [user]);

  // Check if user is a super admin
  const isSuperAdmin = useMemo(() => {
    return user?.role === UserRole.SUPER_ADMIN;
  }, [user]);

  // Get allowed system IDs for the user
  const allowedSystemIds = useMemo(() => {
    if (!user) return [];
    if (user.role === UserRole.SUPER_ADMIN) return null; // null means all systems
    if (user.role === UserRole.USER && user.allowedSystems) {
      return user.allowedSystems;
    }
    return null; // null means all systems in organization
  }, [user]);

  return {
    ...permissions,
    canAccessSystem,
    hasRole,
    isEndUser,
    isAdmin,
    isSuperAdmin,
    allowedSystemIds,
    user,
  };
}

/**
 * Higher-order component for permission-based access control
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: keyof ReturnType<typeof usePermissions>
) {
  return function PermissionGuard(props: P) {
    const permissions = usePermissions();

    if (!permissions[requiredPermission]) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Component that renders children only if user has required permission
 */
export function PermissionGate({
  children,
  permission,
  fallback = null,
}: {
  children: React.ReactNode;
  permission: keyof ReturnType<typeof usePermissions>;
  fallback?: React.ReactNode;
}) {
  const permissions = usePermissions();

  if (!permissions[permission]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Component that renders children only if user has one of the required roles
 */
export function RoleGate({
  children,
  roles,
  fallback = null,
}: {
  children: React.ReactNode;
  roles: UserRole | UserRole[];
  fallback?: React.ReactNode;
}) {
  const { hasRole } = usePermissions();

  if (!hasRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
