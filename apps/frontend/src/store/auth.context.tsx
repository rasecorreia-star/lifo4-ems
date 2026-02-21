/**
 * Auth Context
 * Global authentication state management
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'TECHNICIAN'
  | 'OPERATOR'
  | 'VIEWER'
  | 'USER';

export interface User {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  systemIds: string[];
  avatar?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasSystemAccess: (systemId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock login - replace with real API call
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();

      setToken(data.token);
      setUser(data.user);

      // Persist to localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }, []);

  const hasRole = useCallback(
    (role: UserRole) => {
      if (!user) return false;

      // Role hierarchy
      const roleHierarchy: Record<UserRole, number> = {
        SUPER_ADMIN: 7,
        ADMIN: 6,
        MANAGER: 5,
        TECHNICIAN: 4,
        OPERATOR: 3,
        VIEWER: 2,
        USER: 1,
      };

      return roleHierarchy[user.role] >= roleHierarchy[role];
    },
    [user]
  );

  const hasSystemAccess = useCallback(
    (systemId: string) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return user.systemIds.includes(systemId);
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    hasSystemAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
