/**
 * Offline Sync Service
 * Handles synchronization of offline changes from mobile devices
 */

import { firestore } from '../../config/firebase';
import { logger } from '../../utils/logger';

interface SyncChange {
  id: string;
  collection: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: string;
  clientVersion: number;
}

interface SyncResult {
  success: boolean;
  accepted: string[];
  rejected: SyncConflict[];
  serverChanges: ServerChange[];
  newSyncTimestamp: string;
}

interface SyncConflict {
  changeId: string;
  reason: string;
  serverData?: Record<string, any>;
}

interface ServerChange {
  collection: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: string;
}

interface SyncStatus {
  lastSyncTimestamp: string;
  pendingChanges: number;
  lastSyncSuccess: boolean;
  deviceCount: number;
}

// Collections that support offline sync
const SYNCABLE_COLLECTIONS = [
  'userSettings',
  'systemNotes',
  'maintenanceSchedule',
  'customAlerts',
  'dashboardPreferences',
  'reportTemplates'
];

class OfflineSyncService {
  private db = firestore;

  /**
   * Process offline changes from mobile
   */
  async processChanges(
    userId: string,
    changes: SyncChange[],
    lastSyncTimestamp: Date
  ): Promise<SyncResult> {
    const accepted: string[] = [];
    const rejected: SyncConflict[] = [];
    const serverChanges: ServerChange[] = [];

    try {
      // Get server changes since last sync
      const serverUpdates = await this.getServerChanges(userId, lastSyncTimestamp);
      serverChanges.push(...serverUpdates);

      // Process each client change
      for (const change of changes) {
        // Validate collection
        if (!SYNCABLE_COLLECTIONS.includes(change.collection)) {
          rejected.push({
            changeId: change.id,
            reason: `Collection ${change.collection} is not syncable`
          });
          continue;
        }

        // Check for conflicts
        const conflict = await this.checkConflict(userId, change, lastSyncTimestamp);

        if (conflict) {
          rejected.push(conflict);
          continue;
        }

        // Apply change
        try {
          await this.applyChange(userId, change);
          accepted.push(change.id);

          // Record sync event
          await this.recordSyncEvent(userId, change);
        } catch (error: any) {
          rejected.push({
            changeId: change.id,
            reason: error.message
          });
        }
      }

      // Update sync status
      const newTimestamp = new Date();
      await this.updateSyncStatus(userId, newTimestamp, accepted.length > 0);

      return {
        success: true,
        accepted,
        rejected,
        serverChanges,
        newSyncTimestamp: newTimestamp.toISOString()
      };
    } catch (error) {
      logger.error('Error processing sync changes:', error);
      throw error;
    }
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: string): Promise<SyncStatus> {
    try {
      const statusDoc = await this.db
        .collection('syncStatus')
        .doc(userId)
        .get();

      if (!statusDoc.exists) {
        return {
          lastSyncTimestamp: new Date(0).toISOString(),
          pendingChanges: 0,
          lastSyncSuccess: true,
          deviceCount: 0
        };
      }

      const data = statusDoc.data()!;

      // Get device count
      const devicesSnap = await this.db
        .collection('userDevices')
        .where('userId', '==', userId)
        .count()
        .get();

      return {
        lastSyncTimestamp: data.lastSyncTimestamp?.toDate?.().toISOString() || new Date(0).toISOString(),
        pendingChanges: data.pendingChanges || 0,
        lastSyncSuccess: data.lastSyncSuccess !== false,
        deviceCount: devicesSnap.data().count
      };
    } catch (error) {
      logger.error('Error getting sync status:', error);
      throw error;
    }
  }

  /**
   * Get delta changes since timestamp
   */
  async getDeltaChanges(userId: string, since: Date): Promise<ServerChange[]> {
    return this.getServerChanges(userId, since);
  }

  /**
   * Get server changes since timestamp
   */
  private async getServerChanges(userId: string, since: Date): Promise<ServerChange[]> {
    const changes: ServerChange[] = [];

    try {
      for (const collection of SYNCABLE_COLLECTIONS) {
        const docsSnap = await this.db
          .collection(collection)
          .where('userId', '==', userId)
          .where('updatedAt', '>', since)
          .get();

        docsSnap.docs.forEach(doc => {
          const data = doc.data();
          changes.push({
            collection,
            documentId: doc.id,
            operation: data._deleted ? 'delete' : 'update',
            data: data._deleted ? {} : data,
            timestamp: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString()
          });
        });
      }

      // Sort by timestamp
      changes.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return changes;
    } catch (error) {
      logger.error('Error getting server changes:', error);
      return [];
    }
  }

  /**
   * Check for sync conflict
   */
  private async checkConflict(
    userId: string,
    change: SyncChange,
    lastSyncTimestamp: Date
  ): Promise<SyncConflict | null> {
    try {
      // For updates and deletes, check if document was modified on server
      if (change.operation !== 'create') {
        const docRef = this.db.collection(change.collection).doc(change.documentId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          if (change.operation === 'update') {
            return {
              changeId: change.id,
              reason: 'Document no longer exists on server'
            };
          }
          // Delete of non-existent doc is OK
          return null;
        }

        const serverData = docSnap.data()!;
        const serverUpdatedAt = serverData.updatedAt?.toDate?.() || new Date(0);

        // Check if server version is newer than client's last sync
        if (serverUpdatedAt > lastSyncTimestamp) {
          // Check if same fields were modified
          const clientFields = Object.keys(change.data);
          const conflictingFields = clientFields.filter(field => {
            // Field was modified on server after client's last sync
            return serverData[field] !== undefined;
          });

          if (conflictingFields.length > 0) {
            return {
              changeId: change.id,
              reason: `Conflict on fields: ${conflictingFields.join(', ')}`,
              serverData
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error checking conflict:', error);
      return {
        changeId: change.id,
        reason: 'Error checking for conflicts'
      };
    }
  }

  /**
   * Apply a sync change
   */
  private async applyChange(userId: string, change: SyncChange): Promise<void> {
    const docRef = this.db.collection(change.collection).doc(change.documentId);

    switch (change.operation) {
      case 'create':
        await docRef.set({
          ...change.data,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _syncedFrom: 'mobile',
          _clientTimestamp: change.timestamp
        });
        break;

      case 'update':
        await docRef.update({
          ...change.data,
          updatedAt: new Date(),
          _syncedFrom: 'mobile',
          _clientTimestamp: change.timestamp
        });
        break;

      case 'delete':
        // Soft delete to allow sync tracking
        await docRef.update({
          _deleted: true,
          _deletedAt: new Date(),
          updatedAt: new Date(),
          _syncedFrom: 'mobile'
        });
        break;
    }

    logger.debug(`Applied sync change: ${change.operation} on ${change.collection}/${change.documentId}`);
  }

  /**
   * Record sync event for auditing
   */
  private async recordSyncEvent(userId: string, change: SyncChange): Promise<void> {
    try {
      await this.db.collection('syncEvents').add({
        userId,
        changeId: change.id,
        collection: change.collection,
        documentId: change.documentId,
        operation: change.operation,
        clientTimestamp: change.timestamp,
        serverTimestamp: new Date()
      });
    } catch (error) {
      logger.error('Error recording sync event:', error);
    }
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(
    userId: string,
    timestamp: Date,
    success: boolean
  ): Promise<void> {
    try {
      await this.db.collection('syncStatus').doc(userId).set({
        lastSyncTimestamp: timestamp,
        lastSyncSuccess: success,
        pendingChanges: 0
      }, { merge: true });
    } catch (error) {
      logger.error('Error updating sync status:', error);
    }
  }

  /**
   * Mark changes as pending (when offline)
   */
  async markPendingChanges(userId: string, count: number): Promise<void> {
    try {
      await this.db.collection('syncStatus').doc(userId).set({
        pendingChanges: count
      }, { merge: true });
    } catch (error) {
      logger.error('Error marking pending changes:', error);
    }
  }

  /**
   * Get sync conflicts for manual resolution
   */
  async getPendingConflicts(userId: string): Promise<any[]> {
    try {
      const conflictsSnap = await this.db
        .collection('syncConflicts')
        .where('userId', '==', userId)
        .where('resolved', '==', false)
        .orderBy('timestamp', 'desc')
        .get();

      return conflictsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Error getting pending conflicts:', error);
      return [];
    }
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'client' | 'server' | 'merge',
    mergedData?: Record<string, any>
  ): Promise<void> {
    try {
      const conflictRef = this.db.collection('syncConflicts').doc(conflictId);
      const conflictDoc = await conflictRef.get();

      if (!conflictDoc.exists) {
        throw new Error('Conflict not found');
      }

      const conflict = conflictDoc.data()!;

      if (resolution === 'client' || resolution === 'merge') {
        const dataToApply = resolution === 'merge' ? mergedData : conflict.clientData;

        await this.db
          .collection(conflict.collection)
          .doc(conflict.documentId)
          .update({
            ...dataToApply,
            updatedAt: new Date(),
            _conflictResolved: true,
            _resolutionType: resolution
          });
      }

      await conflictRef.update({
        resolved: true,
        resolutionType: resolution,
        resolvedAt: new Date()
      });

      logger.info(`Conflict ${conflictId} resolved with ${resolution}`);
    } catch (error) {
      logger.error('Error resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Clean old sync events
   */
  async cleanOldSyncEvents(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      const oldEventsSnap = await this.db
        .collection('syncEvents')
        .where('serverTimestamp', '<', cutoff)
        .limit(500)
        .get();

      const batch = this.db.batch();
      oldEventsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info(`Cleaned ${oldEventsSnap.size} old sync events`);
      return oldEventsSnap.size;
    } catch (error) {
      logger.error('Error cleaning old sync events:', error);
      return 0;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
