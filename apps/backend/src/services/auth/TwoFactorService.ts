/**
 * Two-Factor Authentication Service (TOTP)
 * Implements RFC 6238 time-based one-time passwords using otplib.
 *
 * Required for all SUPER_ADMIN and ADMIN accounts (enforced at login).
 */

import { authenticator } from 'otplib';
import { logger } from '../../lib/logger.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// otplib defaults: SHA-1, 6 digits, 30s window — standard for Google Authenticator
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1, // allow ±1 step to handle clock skew
};

const APP_NAME = process.env.APP_NAME ?? 'LIFO4 EMS';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  /** Base64-encoded QR code PNG — display in frontend for user to scan */
  qrCodeDataUrl: string;
}

// ---------------------------------------------------------------------------
// TwoFactorService
// ---------------------------------------------------------------------------

export class TwoFactorService {
  /**
   * Generate a new TOTP secret for a user.
   * The secret must be stored (encrypted) in the database before calling verifySetup().
   */
  async generateSecret(userEmail: string): Promise<TotpSetupResult> {
    const secret = authenticator.generateSecret(20); // 20 bytes = 160 bits
    const otpauthUrl = authenticator.keyuri(userEmail, APP_NAME, secret);

    let qrCodeDataUrl = '';
    try {
      // Dynamic import: qrcode is an optional dependency
      const qrcode = await import('qrcode');
      qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    } catch {
      logger.warn('qrcode package not installed — QR code will not be generated');
      qrCodeDataUrl = `data:text/plain,${encodeURIComponent(otpauthUrl)}`;
    }

    logger.info('TOTP secret generated', { email: userEmail });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Verify a TOTP token against the stored secret.
   * Returns true if the token is valid for the current 30-second window (±1 window for skew).
   */
  verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token: token.trim(), secret });
    } catch (err) {
      logger.warn('TOTP verification error', { error: err });
      return false;
    }
  }

  /**
   * Check whether the given role requires 2FA.
   * SUPER_ADMIN and ADMIN must have 2FA enabled.
   */
  roleRequires2FA(role: string): boolean {
    return role === 'SUPER_ADMIN' || role === 'ADMIN';
  }
}

export const twoFactorService = new TwoFactorService();
