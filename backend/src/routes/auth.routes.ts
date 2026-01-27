import { Router } from 'express';
import {
  register,
  login,
  devLogin,
  refreshToken,
  logout,
  getProfile,
  changePassword,
  setup2FA,
  verify2FA,
  disable2FA,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { auditLog } from '../middlewares/audit.middleware.js';

const router = Router();

// Public routes (with rate limiting)
router.post('/register', authLimiter, auditLog('USER_REGISTER'), register);
router.post('/login', authLimiter, auditLog('USER_LOGIN'), login);
router.post('/dev-login', devLogin); // Development only - bypasses Firebase
router.post('/refresh', refreshToken);

// Protected routes
router.use(authenticate);

router.post('/logout', auditLog('USER_LOGOUT'), logout);
router.get('/me', getProfile);
router.post('/change-password', auditLog('PASSWORD_CHANGE'), changePassword);

// 2FA routes
router.post('/2fa/setup', setup2FA);
router.post('/2fa/verify', auditLog('2FA_ENABLE'), verify2FA);
router.post('/2fa/disable', auditLog('2FA_DISABLE'), disable2FA);

export default router;
