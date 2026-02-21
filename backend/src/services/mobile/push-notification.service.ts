/**
 * Push Notification Service
 * Handles push notifications for iOS and Android devices
 */

import { firestore, messaging } from '../../config/firebase';
import { logger } from '../../utils/logger';

interface DeviceRegistration {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
}

interface NotificationSettings {
  alerts: boolean;
  warnings: boolean;
  reports: boolean;
  marketing: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'normal';
  category?: string;
}

interface NotificationHistoryEntry {
  id: string;
  title: string;
  body: string;
  category: string;
  sentAt: string;
  read: boolean;
}

class PushNotificationService {
  private db = firestore;

  /**
   * Register device for push notifications
   */
  async registerDevice(userId: string, device: DeviceRegistration): Promise<void> {
    try {
      const devicesRef = this.db.collection('userDevices');

      // Check if token already exists
      const existingSnap = await devicesRef
        .where('token', '==', device.token)
        .get();

      if (!existingSnap.empty) {
        // Update existing
        await existingSnap.docs[0].ref.update({
          userId,
          platform: device.platform,
          deviceId: device.deviceId || null,
          updatedAt: new Date()
        });
      } else {
        // Create new
        await devicesRef.add({
          userId,
          token: device.token,
          platform: device.platform,
          deviceId: device.deviceId || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Initialize settings if not exist
      const settingsRef = this.db.collection('notificationSettings').doc(userId);
      const settingsDoc = await settingsRef.get();

      if (!settingsDoc.exists) {
        await settingsRef.set({
          alerts: true,
          warnings: true,
          reports: true,
          marketing: false,
          quietHoursStart: null,
          quietHoursEnd: null
        });
      }

      logger.info(`Device registered for user ${userId}: ${device.platform}`);
    } catch (error) {
      logger.error('Error registering device:', error);
      throw error;
    }
  }

  /**
   * Unregister device
   */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    try {
      const devicesSnap = await this.db
        .collection('userDevices')
        .where('userId', '==', userId)
        .where('token', '==', token)
        .get();

      const batch = this.db.batch();
      devicesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      logger.info(`Device unregistered for user ${userId}`);
    } catch (error) {
      logger.error('Error unregistering device:', error);
      throw error;
    }
  }

  /**
   * Get notification settings
   */
  async getSettings(userId: string): Promise<NotificationSettings> {
    try {
      const settingsDoc = await this.db
        .collection('notificationSettings')
        .doc(userId)
        .get();

      if (!settingsDoc.exists) {
        return {
          alerts: true,
          warnings: true,
          reports: true,
          marketing: false,
          quietHoursStart: null,
          quietHoursEnd: null
        };
      }

      return settingsDoc.data() as NotificationSettings;
    } catch (error) {
      logger.error('Error getting notification settings:', error);
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    try {
      await this.db
        .collection('notificationSettings')
        .doc(userId)
        .set(settings, { merge: true });

      logger.info(`Notification settings updated for user ${userId}`);
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      throw error;
    }
  }

  /**
   * Get notification history
   */
  async getHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ notifications: NotificationHistoryEntry[]; total: number }> {
    try {
      const historyRef = this.db
        .collection('notificationHistory')
        .where('userId', '==', userId)
        .orderBy('sentAt', 'desc');

      const countSnap = await historyRef.count().get();
      const total = countSnap.data().count;

      const historySnap = await historyRef
        .offset(offset)
        .limit(limit)
        .get();

      const notifications: NotificationHistoryEntry[] = historySnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          body: data.body,
          category: data.category,
          sentAt: data.sentAt?.toDate?.().toISOString() || new Date().toISOString(),
          read: data.read || false
        };
      });

      return { notifications, total };
    } catch (error) {
      logger.error('Error getting notification history:', error);
      throw error;
    }
  }

  /**
   * Send notification to user
   */
  async sendToUser(
    userId: string,
    notification: NotificationPayload,
    category: string = 'general'
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    try {
      // Check settings
      const settings = await this.getSettings(userId);

      // Check category permissions
      if (category === 'alert' && !settings.alerts) {
        return { success: true, sent: 0, failed: 0 };
      }
      if (category === 'warning' && !settings.warnings) {
        return { success: true, sent: 0, failed: 0 };
      }
      if (category === 'report' && !settings.reports) {
        return { success: true, sent: 0, failed: 0 };
      }
      if (category === 'marketing' && !settings.marketing) {
        return { success: true, sent: 0, failed: 0 };
      }

      // Check quiet hours
      if (this.isQuietHours(settings)) {
        logger.info(`Notification blocked by quiet hours for user ${userId}`);
        return { success: true, sent: 0, failed: 0 };
      }

      // Get user devices
      const devicesSnap = await this.db
        .collection('userDevices')
        .where('userId', '==', userId)
        .get();

      if (devicesSnap.empty) {
        return { success: true, sent: 0, failed: 0 };
      }

      const tokens = devicesSnap.docs.map(doc => doc.data().token);

      // Send via FCM
      const result = await this.sendMultiple(tokens, notification);

      // Save to history
      await this.db.collection('notificationHistory').add({
        userId,
        title: notification.title,
        body: notification.body,
        category,
        data: notification.data || {},
        sentAt: new Date(),
        read: false
      });

      return result;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple tokens
   */
  private async sendMultiple(
    tokens: string[],
    notification: NotificationPayload
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        android: {
          priority: notification.priority === 'high' ? 'high' as const : 'normal' as const,
          notification: {
            sound: notification.sound || 'default',
            channelId: notification.category || 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: notification.badge,
              sound: notification.sound || 'default',
              category: notification.category
            }
          }
        }
      };

      let sent = 0;
      let failed = 0;
      const invalidTokens: string[] = [];

      // Send to each token
      for (const token of tokens) {
        try {
          await messaging.send({
            ...message,
            token
          });
          sent++;
        } catch (error: any) {
          failed++;
          // Check if token is invalid
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(token);
          }
          logger.error(`Failed to send to token: ${error.message}`);
        }
      }

      // Clean up invalid tokens
      if (invalidTokens.length > 0) {
        await this.cleanInvalidTokens(invalidTokens);
      }

      return { success: true, sent, failed };
    } catch (error) {
      logger.error('Error in sendMultiple:', error);
      throw error;
    }
  }

  /**
   * Send alert notification
   */
  async sendAlert(
    userId: string,
    systemId: string,
    systemName: string,
    alertMessage: string,
    severity: 'critical' | 'warning' | 'info'
  ): Promise<void> {
    const notification: NotificationPayload = {
      title: severity === 'critical' ? 'ALERTA CRÍTICO' : 'Alerta BESS',
      body: `${systemName}: ${alertMessage}`,
      priority: severity === 'critical' ? 'high' : 'normal',
      sound: severity === 'critical' ? 'alarm' : 'default',
      data: {
        type: 'alert',
        systemId,
        severity
      }
    };

    const category = severity === 'info' ? 'general' : severity === 'warning' ? 'warning' : 'alert';

    await this.sendToUser(userId, notification, category);
  }

  /**
   * Send report notification
   */
  async sendReport(userId: string, reportType: string, reportUrl: string): Promise<void> {
    const notification: NotificationPayload = {
      title: 'Relatório Disponível',
      body: `Seu relatório ${reportType} está pronto para visualização.`,
      priority: 'normal',
      data: {
        type: 'report',
        reportType,
        reportUrl
      }
    };

    await this.sendToUser(userId, notification, 'report');
  }

  // Helper methods

  private isQuietHours(settings: NotificationSettings): boolean {
    if (settings.quietHoursStart === null || settings.quietHoursEnd === null) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();

    if (settings.quietHoursStart < settings.quietHoursEnd) {
      return currentHour >= settings.quietHoursStart && currentHour < settings.quietHoursEnd;
    } else {
      // Quiet hours span midnight
      return currentHour >= settings.quietHoursStart || currentHour < settings.quietHoursEnd;
    }
  }

  private async cleanInvalidTokens(tokens: string[]): Promise<void> {
    try {
      const batch = this.db.batch();

      for (const token of tokens) {
        const devicesSnap = await this.db
          .collection('userDevices')
          .where('token', '==', token)
          .get();

        devicesSnap.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      await batch.commit();
      logger.info(`Cleaned ${tokens.length} invalid tokens`);
    } catch (error) {
      logger.error('Error cleaning invalid tokens:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
