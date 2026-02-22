/**
 * Authentication Routes
 * Login, refresh, and 2FA (TOTP) setup/verification
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { twoFactorService } from '../services/auth/TwoFactorService.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// In-memory user store (replace with PostgreSQL query in production)
// Stores totp_secret per userId — encrypted in production
// ---------------------------------------------------------------------------
const totpSecretStore = new Map<string, string>(); // userId → secret
const totpEnabledStore = new Set<string>();         // userId → 2FA active

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// Validates credentials and issues JWT. If user has 2FA enabled, requires totpToken.
// ---------------------------------------------------------------------------
router.post('/login', (req: Request, res: Response) => {
  const { email, password, totpToken } = req.body as {
    email?: string;
    password?: string;
    totpToken?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'email and password are required' });
  }

  // TODO: replace with actual database lookup + bcrypt.compare()
  // Demo stub: accept any credentials in non-production
  if (process.env.NODE_ENV === 'production') {
    return res.status(501).json({
      error: 'Not Implemented',
      message: 'Connect this endpoint to the user database',
    });
  }

  // Stub user for development
  const stubUser = {
    userId: 'user-001',
    email,
    role: email.includes('admin') ? 'ADMIN' : 'OPERATOR',
    organizationId: 'org-001',
    systemIds: [] as string[],
  };

  // 2FA check: if role requires 2FA and user has it enabled, validate TOTP
  if (twoFactorService.roleRequires2FA(stubUser.role) && totpEnabledStore.has(stubUser.userId)) {
    const secret = totpSecretStore.get(stubUser.userId);
    if (!secret) {
      logger.error('2FA enabled but no secret stored', { userId: stubUser.userId });
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!totpToken) {
      return res.status(403).json({
        error: 'Forbidden',
        code: '2FA_REQUIRED',
        message: '2FA token required for this account. Use your authenticator app.',
        setupUrl: '/api/v1/auth/2fa/setup',
      });
    }

    if (!twoFactorService.verifyToken(secret, totpToken)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid 2FA token' });
    }
  } else if (twoFactorService.roleRequires2FA(stubUser.role) && !totpEnabledStore.has(stubUser.userId)) {
    // ADMIN/SUPER_ADMIN without 2FA set up — warn but allow in development
    if (process.env.ENFORCE_2FA === 'true') {
      return res.status(403).json({
        error: 'Forbidden',
        code: '2FA_SETUP_REQUIRED',
        message: 'Your role requires 2FA. Please set it up before logging in.',
        setupUrl: '/api/v1/auth/2fa/setup',
      });
    }
    logger.warn('ADMIN login without 2FA — set ENFORCE_2FA=true to require it', {
      userId: stubUser.userId,
    });
  }

  const secret = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me-before-production';
  const token = jwt.sign(
    {
      sub: stubUser.userId,
      email: stubUser.email,
      role: stubUser.role,
      organizationId: stubUser.organizationId,
      systemIds: stubUser.systemIds,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: process.env.JWT_ISSUER ?? 'lifo4-ems',
    },
  );

  return res.json({
    success: true,
    data: {
      accessToken: token,
      expiresIn: 3600,
      user: stubUser,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/2fa/setup
// Generate a new TOTP secret for the authenticated user
// Returns QR code URL for authenticator app scanning
// ---------------------------------------------------------------------------
router.post('/2fa/setup', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user!;

  if (totpEnabledStore.has(user.userId)) {
    return res.status(409).json({
      error: 'Conflict',
      message: '2FA is already enabled. Disable it first to set up again.',
    });
  }

  try {
    const result = await twoFactorService.generateSecret(user.email);
    // Store secret temporarily — it's only activated after verifyToken succeeds
    totpSecretStore.set(user.userId, result.secret);

    return res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app, then call /2fa/verify to activate',
      data: {
        otpauthUrl: result.otpauthUrl,
        qrCodeDataUrl: result.qrCodeDataUrl,
        // Never return the raw secret in production; shown here only for CLI/debug
        ...(process.env.NODE_ENV !== 'production' && { secret: result.secret }),
      },
    });
  } catch (err) {
    logger.error('Failed to generate TOTP secret', { error: err });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/2fa/verify
// Confirm the TOTP token from the authenticator app and activate 2FA
// ---------------------------------------------------------------------------
router.post('/2fa/verify', authMiddleware, (req: Request, res: Response) => {
  const user = req.user!;
  const { totpToken } = req.body as { totpToken?: string };

  if (!totpToken) {
    return res.status(400).json({ error: 'Bad Request', message: 'totpToken is required' });
  }

  const secret = totpSecretStore.get(user.userId);
  if (!secret) {
    return res.status(400).json({
      error: 'Bad Request',
      message: '2FA setup not initiated. Call POST /auth/2fa/setup first.',
    });
  }

  if (!twoFactorService.verifyToken(secret, totpToken)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token. Check your authenticator app time and try again.',
    });
  }

  totpEnabledStore.add(user.userId);
  logger.info('2FA activated', { userId: user.userId, email: user.email });

  return res.json({
    success: true,
    message: '2FA successfully activated. All future logins require an authenticator token.',
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/auth/2fa/disable
// Disable 2FA for a user (SUPER_ADMIN only — to handle lost authenticator)
// ---------------------------------------------------------------------------
router.delete('/2fa/disable', authMiddleware, (req: Request, res: Response) => {
  const caller = req.user!;

  if (caller.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only SUPER_ADMIN can disable 2FA for users',
    });
  }

  const { targetUserId } = req.body as { targetUserId?: string };
  const userId = targetUserId ?? caller.userId;

  totpSecretStore.delete(userId);
  totpEnabledStore.delete(userId);

  logger.warn('2FA disabled', { targetUserId: userId, disabledBy: caller.userId });

  return res.json({
    success: true,
    message: `2FA disabled for user ${userId}. User must set up 2FA again before next login.`,
  });
});

export default router;
