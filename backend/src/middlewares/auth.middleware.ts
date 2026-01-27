import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { getFirestore, Collections } from '../config/firebase.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { User, UserRole } from '../models/types.js';
import { logger } from '../utils/logger.js';

// System filter type for tenant isolation
export interface SystemFilter {
  type: 'allowedSystems' | 'organization';
  systemIds?: string[];
  organizationId?: string;
}

// Extend Express Request to include user and system filter
declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
      systemFilter?: SystemFilter;
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  iat: number;
  exp: number;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    req.token = token;

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Check if this is a dev-mode user (userId starts with 'dev-user-')
    if (config.env === 'development' && decoded.userId.startsWith('dev-user-')) {
      // Create mock user for development
      const mockUser: User = {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.email === 'admin@lifo4.com.br' ? 'Administrador' :
              decoded.email === 'operator@lifo4.com.br' ? 'Operador' : 'Visualizador',
        phone: '(86) 99999-9999',
        role: decoded.role,
        organizationId: decoded.organizationId,
        permissions: decoded.role === UserRole.ADMIN ? ['*'] : [],
        isActive: true,
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        notificationPreferences: {
          email: { enabled: true, criticalOnly: false },
          whatsapp: { enabled: false, criticalOnly: true },
          push: { enabled: true },
          telegram: { enabled: false },
          quietHours: { enabled: false, start: '22:00', end: '07:00' },
        },
        language: 'pt-BR',
        theme: 'dark',
      };
      req.user = mockUser;
      return next();
    }

    // Get user from database (production mode)
    const db = getFirestore();
    const userDoc = await db.collection(Collections.USERS).doc(decoded.userId).get();

    if (!userDoc.exists) {
      throw new UnauthorizedError('User not found');
    }

    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const db = getFirestore();
    const userDoc = await db.collection(Collections.USERS).doc(decoded.userId).get();

    if (userDoc.exists) {
      const user = { id: userDoc.id, ...userDoc.data() } as User;
      if (user.isActive) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch {
    // Ignore token errors in optional auth
    next();
  }
};

/**
 * Middleware to check user roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role}`);
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Middleware to check specific permissions
 */
export const requirePermission = (resource: string, action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Super admin has all permissions
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Check user permissions
    const hasPermission = req.user.permissions?.some(
      p => p.resource === resource && p.actions.includes(action as never)
    );

    if (!hasPermission) {
      logger.warn(`Permission denied: ${req.user.id} cannot ${action} ${resource}`);
      return next(new ForbiddenError(`Permission denied for ${action} on ${resource}`));
    }

    next();
  };
};

/**
 * Middleware to check organization access
 */
export const requireOrganizationAccess = (getOrgId: (req: Request) => string | undefined) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Super admin can access all organizations
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    const targetOrgId = getOrgId(req);
    if (!targetOrgId) {
      return next();
    }

    if (req.user.organizationId !== targetOrgId) {
      logger.warn(`Organization access denied: ${req.user.id} cannot access ${targetOrgId}`);
      return next(new ForbiddenError('Access to this organization is denied'));
    }

    next();
  };
};

/**
 * Middleware to check system access
 * Handles both organization-based and user-specific (allowedSystems) access
 */
export const requireSystemAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Super admin can access all systems
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    const systemId = req.params.systemId || req.body?.systemId;
    if (!systemId) {
      return next();
    }

    // Get system and check organization
    const db = getFirestore();
    const systemDoc = await db.collection(Collections.SYSTEMS).doc(systemId).get();

    if (!systemDoc.exists) {
      return next(); // Let the controller handle not found
    }

    const system = systemDoc.data();

    // For USER role (end user), check allowedSystems
    if (req.user.role === UserRole.USER) {
      if (!req.user.allowedSystems || !req.user.allowedSystems.includes(systemId)) {
        logger.warn(`System access denied: User ${req.user.id} not allowed to access ${systemId}`);
        throw new ForbiddenError('Access to this system is denied');
      }
      return next();
    }

    // For other roles, check organization
    if (system?.organizationId !== req.user.organizationId) {
      logger.warn(`System access denied: ${req.user.id} cannot access ${systemId}`);
      throw new ForbiddenError('Access to this system is denied');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to filter systems for end users
 * Adds allowedSystems filter to the request for queries
 */
export const filterSystemsForUser = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  // For USER role, add filter to request
  if (req.user.role === UserRole.USER) {
    req.systemFilter = {
      type: 'allowedSystems',
      systemIds: req.user.allowedSystems || [],
    };
  } else if (req.user.role !== UserRole.SUPER_ADMIN) {
    // For other non-super-admin roles, filter by organization
    req.systemFilter = {
      type: 'organization',
      organizationId: req.user.organizationId,
    };
  }
  // Super admin has no filter

  next();
};

/**
 * Role hierarchy for permission checks
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MANAGER]: 60,
  [UserRole.TECHNICIAN]: 40,
  [UserRole.OPERATOR]: 30,
  [UserRole.VIEWER]: 20,
  [UserRole.USER]: 10,
};

/**
 * Check if user has at least the minimum required role level
 */
export const requireMinRole = (minRole: UserRole) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userLevel = ROLE_HIERARCHY[req.user.role];
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      logger.warn(`Role level denied: ${req.user.id} (${req.user.role}) requires ${minRole}`);
      return next(new ForbiddenError('Insufficient role level'));
    }

    next();
  };
};

/**
 * Check if user can manage other users
 * Only SUPER_ADMIN and ADMIN can manage users
 */
export const canManageUsers = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.user.role)) {
    logger.warn(`User management denied: ${req.user.id} cannot manage users`);
    return next(new ForbiddenError('You cannot manage users'));
  }

  next();
};

/**
 * Check if user can invite family members (for USER role)
 */
export const canInviteFamily = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== UserRole.USER || !req.user.canInviteFamily) {
    logger.warn(`Family invite denied: ${req.user.id} cannot invite family`);
    return next(new ForbiddenError('You cannot invite family members'));
  }

  next();
};

/**
 * Generate JWT tokens
 */
export const generateTokens = (user: User) => {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as string,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
};
