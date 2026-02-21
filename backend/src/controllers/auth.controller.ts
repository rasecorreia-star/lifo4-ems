import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { generateTokens } from '../middlewares/auth.middleware.js';
import { config } from '../config/index.js';
import { UserRole, User } from '../models/types.js';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../utils/validation.js';

/**
 * Register new user
 * POST /api/v1/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, tokens } = await authService.register(input);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      tokens,
    },
  });
});

/**
 * Login with email and password
 * POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);

  if (result.requires2FA) {
    res.status(200).json({
      success: true,
      data: {
        requires2FA: true,
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organizationId: result.user.organizationId,
        notificationPreferences: result.user.notificationPreferences,
        language: result.user.language,
        theme: result.user.theme,
      },
      tokens: result.tokens,
    },
  });
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  const tokens = await authService.refreshToken(refreshToken);

  res.status(200).json({
    success: true,
    data: { tokens },
  });
});

/**
 * Logout
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.user!.id, req.token!);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      permissions: user.permissions,
      twoFactorEnabled: user.twoFactorEnabled,
      notificationPreferences: user.notificationPreferences,
      language: user.language,
      theme: user.theme,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    },
  });
});

/**
 * Change password
 * POST /api/v1/auth/change-password
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.id, currentPassword, newPassword);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Setup 2FA
 * POST /api/v1/auth/2fa/setup
 */
export const setup2FA = asyncHandler(async (req: Request, res: Response) => {
  const { secret, qrCodeUrl } = await authService.setup2FA(req.user!.id);

  res.status(200).json({
    success: true,
    data: {
      secret,
      qrCodeUrl,
    },
  });
});

/**
 * Verify and enable 2FA
 * POST /api/v1/auth/2fa/verify
 */
export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  await authService.verify2FA(req.user!.id, code);

  res.status(200).json({
    success: true,
    message: '2FA enabled successfully',
  });
});

/**
 * Disable 2FA
 * POST /api/v1/auth/2fa/disable
 */
export const disable2FA = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  await authService.disable2FA(req.user!.id, code);

  res.status(200).json({
    success: true,
    message: '2FA disabled successfully',
  });
});

/**
 * Development-only login (bypasses Firebase)
 * POST /api/v1/auth/dev-login
 */
export const devLogin = asyncHandler(async (req: Request, res: Response) => {
  // Only available in development mode
  if (config.env === 'production') {
    res.status(404).json({
      success: false,
      error: { message: 'Not found' },
    });
    return;
  }

  const { email, password } = req.body;

  // Demo credentials
  const demoUsers: Record<string, { password: string; role: UserRole; name: string }> = {
    'admin@lifo4.com.br': { password: 'admin123', role: UserRole.ADMIN, name: 'Administrador' },
    'operator@lifo4.com.br': { password: 'operator123', role: UserRole.OPERATOR, name: 'Operador' },
    'viewer@lifo4.com.br': { password: 'viewer123', role: UserRole.VIEWER, name: 'Visualizador' },
  };

  const demoUser = demoUsers[email];

  if (!demoUser || demoUser.password !== password) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid email or password' },
    });
    return;
  }

  const now = new Date();
  const mockUser: User = {
    id: 'dev-user-' + Date.now(),
    email,
    name: demoUser.name,
    phone: '(86) 99999-9999',
    role: demoUser.role,
    organizationId: 'org-demo',
    permissions: demoUser.role === UserRole.ADMIN ? ['*'] : [],
    isActive: true,
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
    lastLogin: now,
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

  const tokens = generateTokens(mockUser);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        organizationId: mockUser.organizationId,
        notificationPreferences: mockUser.notificationPreferences,
        language: mockUser.language,
        theme: mockUser.theme,
      },
      tokens,
    },
    _devMode: true,
  });
});
