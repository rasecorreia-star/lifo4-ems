import { Request, Response, NextFunction } from 'express';
import { getFirestore, Collections } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to log all API requests for auditing
 */
export const auditLog = (
  action: string,
  getResourceInfo?: (req: Request) => { resource: string; resourceId?: string }
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Capture response for audit
    res.json = function (body: unknown) {
      // Log after response is sent
      setImmediate(async () => {
        try {
          const resourceInfo = getResourceInfo?.(req) || {
            resource: req.baseUrl + req.path,
            resourceId: req.params.id,
          };

          const db = getFirestore();
          await db.collection(Collections.AUDIT_LOGS).add({
            userId: req.user?.id || 'anonymous',
            organizationId: req.user?.organizationId || null,
            action,
            resource: resourceInfo.resource,
            resourceId: resourceInfo.resourceId,
            details: {
              method: req.method,
              path: req.originalUrl,
              statusCode: res.statusCode,
              body: sanitizeBody(req.body),
              query: req.query,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error('Failed to create audit log', { error });
        }
      });

      return originalJson(body);
    };

    next();
  };
};

/**
 * Remove sensitive fields from request body for logging
 */
function sanitizeBody(body: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!body) return undefined;

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'refreshToken', 'twoFactorCode'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Log critical actions with extra details
 */
export const logCriticalAction = async (
  userId: string,
  organizationId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> => {
  try {
    const db = getFirestore();
    await db.collection(Collections.AUDIT_LOGS).add({
      userId,
      organizationId,
      action,
      resource: 'critical_action',
      details,
      timestamp: new Date(),
      isCritical: true,
    });

    logger.warn(`Critical action: ${action}`, { userId, details });
  } catch (error) {
    logger.error('Failed to log critical action', { error, action, userId });
  }
};
