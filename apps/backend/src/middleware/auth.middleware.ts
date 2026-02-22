/**
 * Authentication Middleware
 * JWT token validation and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'TECHNICIAN'
  | 'OPERATOR'
  | 'VIEWER'
  | 'USER';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  systemIds: string[];
}

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PUBLIC_PATHS = ['/health', '/api/v1/auth/login', '/api/v1/auth/register', '/metrics'];

// Role hierarchy — higher index = more privileged
const ROLE_HIERARCHY: UserRole[] = [
  'USER',
  'VIEWER',
  'OPERATOR',
  'TECHNICIAN',
  'MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
];

// ---------------------------------------------------------------------------
// JWT secret validation at startup
// ---------------------------------------------------------------------------

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const msg =
      'JWT_SECRET env var is missing or too short (minimum 32 chars). ' +
      'Set a strong random secret before starting the server.';
    logger.error(msg);
    // Hard fail in production; warn in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    logger.warn('Using insecure fallback JWT secret — NOT suitable for production');
    return 'dev-only-insecure-secret-change-me-before-production';
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

// ---------------------------------------------------------------------------
// Demo mode — ONLY in non-production environments
// ---------------------------------------------------------------------------

function isDemoMode(): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.VITE_DEMO_MODE === 'true') {
    logger.error('Demo mode is DISABLED in production — ignoring VITE_DEMO_MODE=true');
    return false;
  }
  return process.env.VITE_DEMO_MODE === 'true';
}

// ---------------------------------------------------------------------------
// Main auth middleware
// ---------------------------------------------------------------------------

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow public paths without auth
  if (PUBLIC_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header with Bearer token required',
    });
  }

  const token = authHeader.substring(7);

  // Demo mode — only allowed outside production
  if (isDemoMode() && token === 'demo-token') {
    logger.warn('Demo token used — demo mode is enabled', {
      ip: req.ip,
      path: req.path,
    });
    req.user = {
      userId: 'demo-user-001',
      email: 'demo@lifo4.com.br',
      role: 'ADMIN',
      organizationId: 'demo-org',
      systemIds: [],
    };
    return next();
  }

  // Verify JWT
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER ?? 'lifo4-ems',
    }) as jwt.JwtPayload;

    // Validate required claims
    if (
      !payload.sub ||
      !payload.email ||
      !payload.role ||
      !payload.organizationId
    ) {
      logger.warn('JWT missing required claims', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token claims' });
    }

    req.user = {
      userId: payload.sub,
      email: payload.email as string,
      role: payload.role as UserRole,
      organizationId: payload.organizationId as string,
      systemIds: (payload.systemIds as string[]) ?? [],
    };

    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT', { ip: req.ip, path: req.path, error: err.message });
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
    logger.error('Unexpected JWT error', { error: err });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// ---------------------------------------------------------------------------
// Role-based access control
// ---------------------------------------------------------------------------

/**
 * Require that the authenticated user has one of the specified roles.
 * Roles are checked hierarchically — a higher role always satisfies a lower requirement.
 */
export function requireRole(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

    if (userRoleIndex < requiredRoleIndex) {
      logger.warn('Access denied — insufficient role', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRole: minimumRole,
        path: req.path,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires role ${minimumRole} or higher`,
        currentRole: req.user.role,
      });
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// System-level access control
// ---------------------------------------------------------------------------

/**
 * Require that the authenticated user has access to the system specified in req.params.systemId.
 * SUPER_ADMIN and ADMIN bypass system-level restrictions.
 */
export function requireSystemAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const systemId = req.params.systemId ?? (req.body as { systemId?: string }).systemId;

    if (!systemId) {
      return res.status(400).json({ error: 'systemId is required' });
    }

    // SUPER_ADMIN and ADMIN can access all systems
    const adminRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN'];
    if (adminRoles.includes(req.user.role)) {
      return next();
    }

    if (!req.user.systemIds.includes(systemId)) {
      logger.warn('System access denied', {
        userId: req.user.userId,
        systemId,
        assignedSystems: req.user.systemIds,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this system',
      });
    }

    return next();
  };
}
