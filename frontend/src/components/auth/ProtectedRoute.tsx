import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // MODO DEMO: Permitir acesso sem autenticacao para testes
  // TODO: Remover em producao
  const isDemoMode = true;

  if (!isAuthenticated && !isDemoMode) {
    // Redirect to login, saving the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for required roles if specified
  if (requiredRoles && requiredRoles.length > 0) {
    if (!user || !requiredRoles.includes(user.role)) {
      // User doesn't have required role
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
