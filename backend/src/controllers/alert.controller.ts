import { Request, Response } from 'express';
import { getFirestore, Collections } from '../config/firebase.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { NotFoundError } from '../utils/errors.js';
import { alertQuerySchema, paginationSchema } from '../utils/validation.js';
import { UserRole, Alert } from '../models/types.js';

const db = getFirestore();

/**
 * Get alerts for organization
 * GET /api/v1/alerts
 */
export const getAlerts = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const pagination = paginationSchema.parse(req.query);
  const filters = alertQuerySchema.parse(req.query);

  let query = db.collection(Collections.ALERTS).orderBy('createdAt', 'desc');

  // Filter by organization (unless super admin)
  if (user.role !== UserRole.SUPER_ADMIN) {
    query = query.where('organizationId', '==', user.organizationId);
  }

  // Apply filters
  if (filters.systemId) {
    query = query.where('systemId', '==', filters.systemId);
  }

  if (filters.severity) {
    query = query.where('severity', '==', filters.severity);
  }

  if (filters.isRead !== undefined) {
    query = query.where('isRead', '==', filters.isRead);
  }

  if (filters.isAcknowledged !== undefined) {
    query = query.where('isAcknowledged', '==', filters.isAcknowledged);
  }

  // Get total count
  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;

  // Apply pagination
  query = query
    .offset((pagination.page! - 1) * pagination.limit!)
    .limit(pagination.limit!);

  const snapshot = await query.get();

  const alerts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    resolvedAt: doc.data().resolvedAt?.toDate(),
    acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
  })) as Alert[];

  res.status(200).json({
    success: true,
    data: alerts,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit!),
    },
  });
});

/**
 * Get alert by ID
 * GET /api/v1/alerts/:alertId
 */
export const getAlertById = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const doc = await db.collection(Collections.ALERTS).doc(alertId).get();

  if (!doc.exists) {
    throw new NotFoundError('Alert');
  }

  res.status(200).json({
    success: true,
    data: {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      resolvedAt: doc.data()?.resolvedAt?.toDate(),
      acknowledgedAt: doc.data()?.acknowledgedAt?.toDate(),
    },
  });
});

/**
 * Mark alert as read
 * POST /api/v1/alerts/:alertId/read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const alertRef = db.collection(Collections.ALERTS).doc(alertId);
  const doc = await alertRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Alert');
  }

  await alertRef.update({
    isRead: true,
    readAt: new Date(),
    readBy: req.user!.id,
  });

  res.status(200).json({
    success: true,
    message: 'Alert marked as read',
  });
});

/**
 * Acknowledge alert
 * POST /api/v1/alerts/:alertId/acknowledge
 */
export const acknowledgeAlert = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { notes } = req.body;

  const alertRef = db.collection(Collections.ALERTS).doc(alertId);
  const doc = await alertRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Alert');
  }

  await alertRef.update({
    isAcknowledged: true,
    acknowledgedAt: new Date(),
    acknowledgedBy: req.user!.id,
    acknowledgeNotes: notes || null,
  });

  res.status(200).json({
    success: true,
    message: 'Alert acknowledged',
  });
});

/**
 * Resolve alert
 * POST /api/v1/alerts/:alertId/resolve
 */
export const resolveAlert = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { notes } = req.body;

  const alertRef = db.collection(Collections.ALERTS).doc(alertId);
  const doc = await alertRef.get();

  if (!doc.exists) {
    throw new NotFoundError('Alert');
  }

  await alertRef.update({
    resolvedAt: new Date(),
    resolvedBy: req.user!.id,
    resolutionNotes: notes || null,
  });

  res.status(200).json({
    success: true,
    message: 'Alert resolved',
  });
});

/**
 * Mark multiple alerts as read
 * POST /api/v1/alerts/read-multiple
 */
export const markMultipleAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { alertIds } = req.body;

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    res.status(400).json({
      success: false,
      error: { message: 'Alert IDs array required' },
    });
    return;
  }

  const batch = db.batch();
  const now = new Date();

  for (const alertId of alertIds) {
    const alertRef = db.collection(Collections.ALERTS).doc(alertId);
    batch.update(alertRef, {
      isRead: true,
      readAt: now,
      readBy: req.user!.id,
    });
  }

  await batch.commit();

  res.status(200).json({
    success: true,
    message: `${alertIds.length} alerts marked as read`,
  });
});

/**
 * Get unread alerts count
 * GET /api/v1/alerts/unread-count
 */
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  let query = db.collection(Collections.ALERTS).where('isRead', '==', false);

  if (user.role !== UserRole.SUPER_ADMIN) {
    query = query.where('organizationId', '==', user.organizationId);
  }

  const countSnapshot = await query.count().get();

  res.status(200).json({
    success: true,
    data: {
      count: countSnapshot.data().count,
    },
  });
});

/**
 * Get alerts summary (for dashboard)
 * GET /api/v1/alerts/summary
 */
export const getAlertsSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  let baseQuery: any = db.collection(Collections.ALERTS);

  if (user.role !== UserRole.SUPER_ADMIN) {
    baseQuery = baseQuery.where('organizationId', '==', user.organizationId);
  }

  // Get counts by severity
  const snapshot = await baseQuery.where('createdAt', '>=', last24h).get();

  const summary = {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unread: 0,
    unacknowledged: 0,
  };

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    summary.total++;
    summary[data.severity as keyof typeof summary]++;

    if (!data.isRead) summary.unread++;
    if (!data.isAcknowledged) summary.unacknowledged++;
  });

  res.status(200).json({
    success: true,
    data: summary,
  });
});
