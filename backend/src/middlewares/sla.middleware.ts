/**
 * SLA Middleware
 * Automatic latency tracking and SLA enforcement for API requests
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { slaService } from '../services/sla/sla.service.js';
import { LatencyMeasurementType, SLATier, SLAComplianceStatus } from '../models/sla.types.js';

// ============================================
// TYPES
// ============================================

export interface SLAMiddlewareConfig {
  enabled: boolean;
  trackLatency: boolean;
  enforceTargets: boolean;
  warnOnSlowResponse: boolean;
  warnThresholdMs: number;
  addHeaders: boolean;
  excludePaths: string[];
}

export interface SLARequest extends Request {
  sla?: {
    trackingId: string;
    systemId?: string;
    tier?: SLATier;
    startTime: bigint;
  };
}

// ============================================
// DEFAULT CONFIG
// ============================================

const defaultConfig: SLAMiddlewareConfig = {
  enabled: true,
  trackLatency: true,
  enforceTargets: false,
  warnOnSlowResponse: true,
  warnThresholdMs: 1000,
  addHeaders: true,
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
};

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Main SLA tracking middleware
 */
export function slaMiddleware(config: Partial<SLAMiddlewareConfig> = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  return (req: SLARequest, res: Response, next: NextFunction) => {
    if (!mergedConfig.enabled) {
      return next();
    }

    // Skip excluded paths
    if (mergedConfig.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Extract system ID from various sources
    const systemId = extractSystemId(req);

    // Generate tracking ID
    const trackingId = `api-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store SLA context in request
    req.sla = {
      trackingId,
      systemId,
      tier: systemId ? slaService.getSystemTier(systemId) : undefined,
      startTime: process.hrtime.bigint(),
    };

    // Start latency tracking
    if (mergedConfig.trackLatency && systemId) {
      slaService.startLatencyTracking(
        trackingId,
        LatencyMeasurementType.API,
        systemId,
        {
          method: req.method,
          path: req.path,
          query: req.query,
        }
      );
    }

    // Intercept response
    const originalSend = res.send;
    const originalJson = res.json;

    const finalize = (body: unknown) => {
      const endTime = process.hrtime.bigint();
      const latencyNs = endTime - req.sla!.startTime;
      const latencyMs = Number(latencyNs) / 1_000_000;

      // End latency tracking
      if (mergedConfig.trackLatency && systemId) {
        slaService.endLatencyTracking(trackingId, {
          statusCode: res.statusCode,
          latencyMs,
        });
      }

      // Add SLA headers
      if (mergedConfig.addHeaders) {
        res.setHeader('X-SLA-Tracking-Id', trackingId);
        res.setHeader('X-SLA-Latency-Ms', latencyMs.toFixed(2));
        if (req.sla?.tier) {
          res.setHeader('X-SLA-Tier', req.sla.tier);
        }
      }

      // Warn on slow response
      if (mergedConfig.warnOnSlowResponse && latencyMs > mergedConfig.warnThresholdMs) {
        logger.warn('Slow API response detected', {
          trackingId,
          path: req.path,
          method: req.method,
          latencyMs,
          threshold: mergedConfig.warnThresholdMs,
          systemId,
        });
      }

      return body;
    };

    res.send = function (body) {
      finalize(body);
      return originalSend.call(this, body);
    };

    res.json = function (body) {
      finalize(body);
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Middleware to require minimum SLA tier
 */
export function requireSLATier(minimumTier: SLATier) {
  const tierPriority: Record<SLATier, number> = {
    [SLATier.PLATINUM]: 4,
    [SLATier.GOLD]: 3,
    [SLATier.SILVER]: 2,
    [SLATier.BRONZE]: 1,
  };

  return (req: SLARequest, res: Response, next: NextFunction) => {
    const systemId = extractSystemId(req);
    if (!systemId) {
      return res.status(400).json({
        error: 'System ID required',
        message: 'Cannot determine SLA tier without system identification',
      });
    }

    const tier = slaService.getSystemTier(systemId);
    if (!tier) {
      return res.status(403).json({
        error: 'No SLA assigned',
        message: 'System does not have an SLA profile assigned',
      });
    }

    if (tierPriority[tier] < tierPriority[minimumTier]) {
      return res.status(403).json({
        error: 'Insufficient SLA tier',
        message: `This endpoint requires ${minimumTier} tier or higher, system has ${tier}`,
        requiredTier: minimumTier,
        currentTier: tier,
      });
    }

    next();
  };
}

/**
 * Middleware to add SLA compliance status to response
 */
export function addComplianceStatus() {
  return (req: SLARequest, res: Response, next: NextFunction) => {
    const systemId = extractSystemId(req);
    if (!systemId) {
      return next();
    }

    const originalJson = res.json;

    res.json = function (body) {
      // Add compliance info to response
      const dashboard = slaService.getDashboardData(systemId);
      if (dashboard && typeof body === 'object' && body !== null) {
        (body as Record<string, unknown>)._sla = {
          status: dashboard.currentStatus,
          compliance: dashboard.compliance,
          tier: dashboard.tier,
        };
      }
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Middleware for rate limiting based on SLA tier
 */
export function slaRateLimit() {
  const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  const tierLimits: Record<SLATier, { requests: number; windowMs: number }> = {
    [SLATier.PLATINUM]: { requests: 10000, windowMs: 60000 },
    [SLATier.GOLD]: { requests: 5000, windowMs: 60000 },
    [SLATier.SILVER]: { requests: 1000, windowMs: 60000 },
    [SLATier.BRONZE]: { requests: 100, windowMs: 60000 },
  };

  return (req: SLARequest, res: Response, next: NextFunction) => {
    const systemId = extractSystemId(req);
    if (!systemId) {
      return next();
    }

    const tier = slaService.getSystemTier(systemId) || SLATier.BRONZE;
    const limits = tierLimits[tier];
    const now = Date.now();
    const key = `${systemId}:${req.ip}`;

    let record = requestCounts.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + limits.windowMs };
      requestCounts.set(key, record);
    }

    record.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', limits.requests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.requests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > limits.requests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded the rate limit for ${tier} tier`,
        limit: limits.requests,
        windowMs: limits.windowMs,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

/**
 * Middleware to track command latency
 */
export function trackCommandLatency() {
  return (req: SLARequest, res: Response, next: NextFunction) => {
    const systemId = extractSystemId(req);
    if (!systemId) {
      return next();
    }

    const trackingId = `cmd-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    slaService.startLatencyTracking(
      trackingId,
      LatencyMeasurementType.COMMAND,
      systemId,
      {
        method: req.method,
        path: req.path,
        body: req.body,
      }
    );

    // Store tracking ID for later
    req.sla = {
      ...req.sla,
      trackingId,
      systemId,
      startTime: process.hrtime.bigint(),
    } as SLARequest['sla'];

    const originalSend = res.send;

    res.send = function (body) {
      slaService.endLatencyTracking(trackingId, {
        statusCode: res.statusCode,
        success: res.statusCode < 400,
      });
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Error handler that tracks SLA violations
 */
export function slaErrorHandler() {
  return (err: Error, req: SLARequest, res: Response, next: NextFunction) => {
    const systemId = extractSystemId(req);

    if (systemId && req.sla?.trackingId) {
      // End tracking with error
      slaService.endLatencyTracking(req.sla.trackingId, {
        error: err.message,
        statusCode: 500,
      });
    }

    next(err);
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract system ID from request
 */
function extractSystemId(req: Request): string | undefined {
  // Try various sources
  return (
    req.params.systemId ||
    req.params.id ||
    (req.query.systemId as string) ||
    (req.body?.systemId as string) ||
    req.headers['x-system-id'] as string ||
    undefined
  );
}

/**
 * Create SLA-aware response helper
 */
export function createSLAResponse(req: SLARequest, res: Response) {
  return {
    success: <T>(data: T, meta?: Record<string, unknown>) => {
      const response: Record<string, unknown> = {
        success: true,
        data,
        meta: {
          ...meta,
          sla: req.sla ? {
            trackingId: req.sla.trackingId,
            tier: req.sla.tier,
          } : undefined,
        },
      };
      return res.json(response);
    },

    error: (message: string, statusCode: number = 400, details?: unknown) => {
      const response = {
        success: false,
        error: message,
        details,
        meta: {
          sla: req.sla ? {
            trackingId: req.sla.trackingId,
          } : undefined,
        },
      };
      return res.status(statusCode).json(response);
    },
  };
}

export default slaMiddleware;
