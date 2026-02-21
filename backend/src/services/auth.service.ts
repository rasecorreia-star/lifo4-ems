import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getFirestore, getAuth, Collections } from '../config/firebase.js';
import { generateTokens, verifyRefreshToken } from '../middlewares/auth.middleware.js';
import { User, UserRole } from '../models/types.js';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { LoginInput, RegisterInput } from '../utils/validation.js';

const SALT_ROUNDS = 12;

export class AuthService {
  private db = getFirestore();

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    // Check if email already exists
    const existingUser = await this.db
      .collection(Collections.USERS)
      .where('email', '==', input.email.toLowerCase())
      .get();

    if (!existingUser.empty) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user document
    const userRef = this.db.collection(Collections.USERS).doc();
    const now = new Date();

    const newUser: Omit<User, 'id'> = {
      email: input.email.toLowerCase(),
      name: input.name,
      phone: input.phone,
      role: UserRole.VIEWER, // Default role
      organizationId: input.organizationId || '',
      permissions: [],
      isActive: true,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
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

    await userRef.set({
      ...newUser,
      password: hashedPassword,
    });

    const user: User = { id: userRef.id, ...newUser };
    const tokens = generateTokens(user);

    logger.info(`New user registered: ${user.email}`);

    return { user, tokens };
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<{
    user: User;
    tokens: { accessToken: string; refreshToken: string };
    requires2FA?: boolean;
  }> {
    // Find user by email
    const userSnapshot = await this.db
      .collection(Collections.USERS)
      .where('email', '==', input.email.toLowerCase())
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Check if user is active
    if (!userData.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, userData.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check 2FA
    if (userData.twoFactorEnabled) {
      if (!input.twoFactorCode) {
        return {
          user: null as unknown as User,
          tokens: { accessToken: '', refreshToken: '' },
          requires2FA: true,
        };
      }

      const isValid = speakeasy.totp.verify({
        secret: userData.twoFactorSecret,
        encoding: 'base32',
        token: input.twoFactorCode,
        window: 2,
      });

      if (!isValid) {
        throw new UnauthorizedError('Invalid 2FA code');
      }
    }

    // Update last login
    await userDoc.ref.update({
      lastLogin: new Date(),
    });

    // Create user object without password
    const user: User = {
      id: userDoc.id,
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      role: userData.role,
      organizationId: userData.organizationId,
      permissions: userData.permissions || [],
      isActive: userData.isActive,
      twoFactorEnabled: userData.twoFactorEnabled,
      lastLogin: new Date(),
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
      notificationPreferences: userData.notificationPreferences,
      language: userData.language || 'pt-BR',
      theme: userData.theme || 'dark',
    };

    const tokens = generateTokens(user);

    logger.info(`User logged in: ${user.email}`);

    return { user, tokens };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      // Get current user data
      const userDoc = await this.db.collection(Collections.USERS).doc(decoded.userId).get();

      if (!userDoc.exists) {
        throw new UnauthorizedError('User not found');
      }

      const userData = userDoc.data();
      if (!userData?.isActive) {
        throw new UnauthorizedError('Account is deactivated');
      }

      const user: User = {
        id: userDoc.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        organizationId: userData.organizationId,
        permissions: userData.permissions || [],
        isActive: userData.isActive,
        twoFactorEnabled: userData.twoFactorEnabled,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
        notificationPreferences: userData.notificationPreferences,
        language: userData.language || 'pt-BR',
        theme: userData.theme || 'dark',
      };

      return generateTokens(user);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const userDoc = await this.db.collection(Collections.USERS).doc(userId).get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const userData = userDoc.data();

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, userData?.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await userDoc.ref.update({
      password: hashedPassword,
      updatedAt: new Date(),
    });

    logger.info(`Password changed for user: ${userId}`);
  }

  /**
   * Setup 2FA
   */
  async setup2FA(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const userDoc = await this.db.collection(Collections.USERS).doc(userId).get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const userData = userDoc.data();

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Lifo4 EMS (${userData?.email})`,
      issuer: 'Lifo4 Energia',
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Store temporary secret (will be confirmed on verify)
    await userDoc.ref.update({
      twoFactorTempSecret: secret.base32,
    });

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  /**
   * Verify and enable 2FA
   */
  async verify2FA(userId: string, code: string): Promise<void> {
    const userDoc = await this.db.collection(Collections.USERS).doc(userId).get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const userData = userDoc.data();
    const tempSecret = userData?.twoFactorTempSecret;

    if (!tempSecret) {
      throw new BadRequestError('2FA setup not initiated');
    }

    // Verify code
    const isValid = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new UnauthorizedError('Invalid 2FA code');
    }

    // Enable 2FA
    await userDoc.ref.update({
      twoFactorEnabled: true,
      twoFactorSecret: tempSecret,
      twoFactorTempSecret: null,
      updatedAt: new Date(),
    });

    logger.info(`2FA enabled for user: ${userId}`);
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, code: string): Promise<void> {
    const userDoc = await this.db.collection(Collections.USERS).doc(userId).get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const userData = userDoc.data();

    if (!userData?.twoFactorEnabled) {
      throw new BadRequestError('2FA is not enabled');
    }

    // Verify code
    const isValid = speakeasy.totp.verify({
      secret: userData.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new UnauthorizedError('Invalid 2FA code');
    }

    // Disable 2FA
    await userDoc.ref.update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      updatedAt: new Date(),
    });

    logger.info(`2FA disabled for user: ${userId}`);
  }

  /**
   * Logout (invalidate session if using session storage)
   */
  async logout(userId: string, token: string): Promise<void> {
    // Store invalidated token (optional - for token blacklisting)
    // In production, you might want to use Redis for this
    logger.info(`User logged out: ${userId}`);
  }

  /**
   * Get user by Firebase UID (for OAuth)
   */
  async getUserByFirebaseUid(uid: string): Promise<User | null> {
    const userSnapshot = await this.db
      .collection(Collections.USERS)
      .where('firebaseUid', '==', uid)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return null;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    return {
      id: userDoc.id,
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      role: userData.role,
      organizationId: userData.organizationId,
      permissions: userData.permissions || [],
      isActive: userData.isActive,
      twoFactorEnabled: userData.twoFactorEnabled,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
      notificationPreferences: userData.notificationPreferences,
      language: userData.language || 'pt-BR',
      theme: userData.theme || 'dark',
    };
  }
}

export const authService = new AuthService();
