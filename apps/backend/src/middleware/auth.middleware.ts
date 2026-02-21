/**
 * Authentication Middleware
 * JWT token validation and role-based access control
 */

import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'OPERATOR' | 'VIEWER' | 'USER';
        organizationId: string;
        systemIds: string[];
      };
    }
  }
}

/**
 * Verify JWT token (simple implementation - use jsonwebtoken in production)
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // Allow public endpoints, reject protected ones
    const publicPaths = ['/api/v1/health', '/api/v1/docs'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    return res.status(401).json({
      error: 'No token provided',
      message: 'Authorization header with Bearer token required',
    });
  }

  const token = authHeader.substring(7);

  // In production, use jsonwebtoken library to verify
  // For now, only accept exact demo token
  if (token === 'demo-token') {
    // Mock user - in production, decode JWT
    req.user = {
      userId: 'user-001',
      email: 'demo@lifo4.com.br',
      role: 'ADMIN',
      organizationId: 'org-001',
      systemIds: ['bess-001', 'bess-002'],
    };
    return next();
  }

  return res.status(401).json({
    error: 'Invalid token',
    message: 'Token validation failed',
  });
}

/**
 * Role-based access control middleware
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    return next();
  };
}

/**
 * System-level access control
 */
export function requireSystemAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const systemId = req.params.systemId || req.body.systemId;

    if (!systemId) {
      return res.status(400).json({ error: 'systemId required' });
    }

    // SUPER_ADMIN can access all systems
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Others can only access assigned systems
    if (!req.user.systemIds.includes(systemId)) {
      return res.status(403).json({
        error: 'Access denied to this system',
        systemId,
      });
    }

    return next();
  };
}
