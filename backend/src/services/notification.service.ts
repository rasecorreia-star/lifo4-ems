import nodemailer from 'nodemailer';
import axios from 'axios';
import { getFirestore, Collections } from '../config/firebase.js';
import { config } from '../config/index.js';
import { Alert, AlertSeverity, User, NotificationPreferences } from '../models/types.js';
import { logger } from '../utils/logger.js';

interface NotificationPayload {
  title: string;
  message: string;
  severity: AlertSeverity;
  systemId?: string;
  systemName?: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  private db = getFirestore();
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter(): void {
    if (!config.email.user || !config.email.password) {
      logger.warn('Email credentials not configured. Email notifications disabled.');
      return;
    }

    this.emailTransporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });

    // Verify connection
    this.emailTransporter.verify((error) => {
      if (error) {
        logger.error('Email transporter verification failed', { error });
      } else {
        logger.info('Email transporter ready');
      }
    });
  }

  /**
   * Send notification to all relevant users
   */
  async sendNotification(alert: Alert): Promise<void> {
    // Get users who should receive this notification
    const users = await this.getNotificationRecipients(alert.organizationId, alert.severity);

    // Get system name for context
    const systemDoc = await this.db.collection(Collections.SYSTEMS).doc(alert.systemId).get();
    const systemName = systemDoc.data()?.name || alert.systemId;

    const payload: NotificationPayload = {
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      systemId: alert.systemId,
      systemName,
      data: alert.data as Record<string, unknown>,
    };

    // Send to each user based on their preferences
    for (const user of users) {
      await this.sendToUser(user, payload);
    }

    // Store notification history
    await this.storeNotificationHistory(alert.id, users.map(u => u.id));
  }

  /**
   * Send notification to a specific user based on preferences
   */
  private async sendToUser(user: User, payload: NotificationPayload): Promise<void> {
    const prefs = user.notificationPreferences;

    // Check quiet hours
    if (this.isQuietHours(prefs)) {
      if (payload.severity !== AlertSeverity.CRITICAL) {
        return; // Skip non-critical during quiet hours
      }
    }

    // Send via enabled channels
    const promises: Promise<void>[] = [];

    if (prefs.email.enabled) {
      if (!prefs.email.criticalOnly || payload.severity === AlertSeverity.CRITICAL) {
        promises.push(this.sendEmail(user.email, payload));
      }
    }

    if (prefs.whatsapp.enabled && prefs.whatsapp.phone) {
      if (!prefs.whatsapp.criticalOnly || payload.severity === AlertSeverity.CRITICAL) {
        promises.push(this.sendWhatsApp(prefs.whatsapp.phone, payload));
      }
    }

    if (prefs.push.enabled) {
      promises.push(this.sendPushNotification(user.id, payload));
    }

    if (prefs.telegram.enabled && prefs.telegram.chatId) {
      promises.push(this.sendTelegram(prefs.telegram.chatId, payload));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send email notification
   */
  async sendEmail(to: string, payload: NotificationPayload): Promise<void> {
    if (!this.emailTransporter) {
      logger.warn('Email transporter not initialized');
      return;
    }

    const severityColors: Record<AlertSeverity, string> = {
      [AlertSeverity.CRITICAL]: '#dc2626',
      [AlertSeverity.HIGH]: '#ea580c',
      [AlertSeverity.MEDIUM]: '#ca8a04',
      [AlertSeverity.LOW]: '#16a34a',
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: ${severityColors[payload.severity]}; color: white; padding: 20px; }
          .content { padding: 20px; }
          .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; background: ${severityColors[payload.severity]}; color: white; }
          .system-info { background: #f9fafb; padding: 12px; border-radius: 4px; margin: 16px 0; }
          .footer { padding: 16px 20px; background: #f9fafb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">🔔 ${payload.title}</h1>
          </div>
          <div class="content">
            <span class="severity">${payload.severity}</span>

            <div class="system-info">
              <strong>Sistema:</strong> ${payload.systemName}<br>
              <strong>ID:</strong> ${payload.systemId}
            </div>

            <p style="color: #374151; line-height: 1.6;">${payload.message}</p>

            <p style="margin-top: 24px;">
              <a href="${config.frontendUrl}/systems/${payload.systemId}"
                 style="background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                Ver no Dashboard
              </a>
            </p>
          </div>
          <div class="footer">
            Lifo4 EMS - Sistema de Gerenciamento de Energia<br>
            Lifo4 Energia - Teresina, PI
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.emailTransporter.sendMail({
        from: config.email.from,
        to,
        subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        html,
      });
      logger.info(`Email sent to ${to}`);
    } catch (error) {
      logger.error(`Failed to send email to ${to}`, { error });
    }
  }

  /**
   * Send WhatsApp notification via Evolution API
   */
  async sendWhatsApp(phone: string, payload: NotificationPayload): Promise<void> {
    if (!config.whatsapp.apiUrl || !config.whatsapp.apiKey) {
      logger.warn('WhatsApp not configured');
      return;
    }

    const severityEmoji: Record<AlertSeverity, string> = {
      [AlertSeverity.CRITICAL]: '🚨',
      [AlertSeverity.HIGH]: '⚠️',
      [AlertSeverity.MEDIUM]: '📢',
      [AlertSeverity.LOW]: 'ℹ️',
    };

    const message = `${severityEmoji[payload.severity]} *${payload.title}*

*Sistema:* ${payload.systemName}
*Severidade:* ${payload.severity.toUpperCase()}

${payload.message}

_Lifo4 EMS_`;

    try {
      await axios.post(
        `${config.whatsapp.apiUrl}/message/sendText/${config.whatsapp.instance}`,
        {
          number: phone,
          textMessage: { text: message },
        },
        {
          headers: {
            apikey: config.whatsapp.apiKey,
          },
        }
      );
      logger.info(`WhatsApp message sent to ${phone}`);
    } catch (error) {
      logger.error(`Failed to send WhatsApp to ${phone}`, { error });
    }
  }

  /**
   * Send Telegram notification
   */
  async sendTelegram(chatId: string, payload: NotificationPayload): Promise<void> {
    if (!config.telegram.botToken) {
      logger.warn('Telegram not configured');
      return;
    }

    const severityEmoji: Record<AlertSeverity, string> = {
      [AlertSeverity.CRITICAL]: '🚨',
      [AlertSeverity.HIGH]: '⚠️',
      [AlertSeverity.MEDIUM]: '📢',
      [AlertSeverity.LOW]: 'ℹ️',
    };

    const message = `${severityEmoji[payload.severity]} <b>${payload.title}</b>

<b>Sistema:</b> ${payload.systemName}
<b>Severidade:</b> ${payload.severity.toUpperCase()}

${payload.message}

<i>Lifo4 EMS</i>`;

    try {
      await axios.post(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
      logger.info(`Telegram message sent to ${chatId}`);
    } catch (error) {
      logger.error(`Failed to send Telegram to ${chatId}`, { error });
    }
  }

  /**
   * Send push notification via Firebase Cloud Messaging
   */
  async sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
    // Get user's FCM tokens
    const userDevices = await this.db
      .collection(Collections.DEVICES)
      .where('userId', '==', userId)
      .where('fcmToken', '!=', null)
      .get();

    if (userDevices.empty) {
      return;
    }

    const tokens = userDevices.docs.map(doc => doc.data().fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      return;
    }

    // In production, use Firebase Admin SDK to send FCM messages
    // For now, we'll log the attempt
    logger.info(`Push notification would be sent to user ${userId}`, {
      tokens: tokens.length,
      payload,
    });
  }

  /**
   * Get users who should receive notifications for an organization
   */
  private async getNotificationRecipients(
    organizationId: string,
    severity: AlertSeverity
  ): Promise<User[]> {
    const snapshot = await this.db
      .collection(Collections.USERS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(user => {
        // Always include users for critical alerts
        if (severity === AlertSeverity.CRITICAL) {
          return true;
        }

        // Check if user wants this severity level
        const prefs = user.notificationPreferences;
        if (prefs.email.criticalOnly && prefs.whatsapp.criticalOnly) {
          return (severity as any) === AlertSeverity.CRITICAL || (severity as any) === AlertSeverity.HIGH;
        }

        return true;
      });
  }

  /**
   * Check if current time is within user's quiet hours
   */
  private isQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = prefs.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentTime >= startMinutes || currentTime <= endMinutes;
    }

    return currentTime >= startMinutes && currentTime <= endMinutes;
  }

  /**
   * Store notification history
   */
  private async storeNotificationHistory(alertId: string, userIds: string[]): Promise<void> {
    await this.db.collection(Collections.NOTIFICATION_HISTORY).add({
      alertId,
      userIds,
      sentAt: new Date(),
    });
  }

  /**
   * Send daily summary email to users
   */
  async sendDailySummary(organizationId: string): Promise<void> {
    // Get summary data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertsSnapshot = await this.db
      .collection(Collections.ALERTS)
      .where('organizationId', '==', organizationId)
      .where('createdAt', '>=', today)
      .get();

    const alertsBySeveArity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    alertsSnapshot.docs.forEach(doc => {
      const severity = doc.data().severity;
      alertsBySeveArity[severity] = (alertsBySeveArity[severity] || 0) + 1;
    });

    // Get users who want daily summaries
    const users = await this.db
      .collection(Collections.USERS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .where('notificationPreferences.email.enabled', '==', true)
      .get();

    for (const userDoc of users.docs) {
      const user = { id: userDoc.id, ...userDoc.data() } as User;
      // Send summary email
      // Implementation would go here
    }
  }
}

export const notificationService = new NotificationService();
