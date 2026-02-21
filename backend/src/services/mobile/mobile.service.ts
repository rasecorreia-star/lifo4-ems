/**
 * Mobile Service
 * Optimized data delivery for mobile applications
 */

import { firestore } from '../../config/firebase';
import { logger } from '../../utils/logger';

interface DashboardData {
  totalSystems: number;
  onlineSystems: number;
  totalCapacityKwh: number;
  currentPowerKw: number;
  averageSoc: number;
  activeAlerts: number;
  todayEnergyKwh: number;
  timestamp: string;
}

interface SystemSummary {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  soc: number;
  powerKw: number;
  alertCount: number;
  lastUpdate: string;
}

interface CompactSystemData {
  id: string;
  name: string;
  status: string;
  soc: number;
  soh: number;
  powerKw: number;
  tempC: number;
  voltageV: number;
  currentA: number;
  cycleCount: number;
  alerts: AlertSummary[];
  lastUpdate: string;
}

interface AlertSummary {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

interface ChartPoint {
  t: number;  // timestamp (unix ms)
  v: number;  // value
}

export class MobileService {
  private db = firestore;

  /**
   * Get optimized dashboard data
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    try {
      // Get user's systems
      const systemsSnap = await this.db
        .collection('bessSystems')
        .where('userId', '==', userId)
        .get();

      let totalCapacity = 0;
      let currentPower = 0;
      let socSum = 0;
      let onlineCount = 0;
      let alertCount = 0;

      systemsSnap.docs.forEach(doc => {
        const data = doc.data();
        totalCapacity += data.capacityKwh || 0;
        currentPower += data.currentPowerKw || 0;
        socSum += data.soc || 0;

        if (data.status === 'online') {
          onlineCount++;
        }
        alertCount += data.activeAlertCount || 0;
      });

      // Get today's energy
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const energySnap = await this.db
        .collection('energyMetrics')
        .where('userId', '==', userId)
        .where('timestamp', '>=', today)
        .get();

      let todayEnergy = 0;
      energySnap.docs.forEach(doc => {
        todayEnergy += doc.data().energyKwh || 0;
      });

      return {
        totalSystems: systemsSnap.size,
        onlineSystems: onlineCount,
        totalCapacityKwh: totalCapacity,
        currentPowerKw: currentPower,
        averageSoc: systemsSnap.size > 0 ? socSum / systemsSnap.size : 0,
        activeAlerts: alertCount,
        todayEnergyKwh: todayEnergy,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get summarized systems list
   */
  async getSystemsSummary(userId: string): Promise<SystemSummary[]> {
    try {
      const systemsSnap = await this.db
        .collection('bessSystems')
        .where('userId', '==', userId)
        .orderBy('name')
        .get();

      return systemsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          status: this.getSystemStatus(data),
          soc: data.soc || 0,
          powerKw: data.currentPowerKw || 0,
          alertCount: data.activeAlertCount || 0,
          lastUpdate: data.lastUpdate?.toDate?.().toISOString() || new Date().toISOString()
        };
      });
    } catch (error) {
      logger.error('Error getting systems summary:', error);
      throw error;
    }
  }

  /**
   * Get compact system data
   */
  async getCompactSystemData(systemId: string): Promise<CompactSystemData> {
    try {
      const doc = await this.db.collection('bessSystems').doc(systemId).get();

      if (!doc.exists) {
        throw new Error('System not found');
      }

      const data = doc.data()!;

      // Get active alerts
      const alertsSnap = await this.db
        .collection('alerts')
        .where('systemId', '==', systemId)
        .where('status', '==', 'active')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

      const alerts: AlertSummary[] = alertsSnap.docs.map(alertDoc => {
        const alertData = alertDoc.data();
        return {
          id: alertDoc.id,
          severity: alertData.severity,
          message: alertData.message,
          timestamp: alertData.timestamp?.toDate?.().toISOString() || new Date().toISOString()
        };
      });

      return {
        id: doc.id,
        name: data.name,
        status: this.getSystemStatus(data),
        soc: data.soc || 0,
        soh: data.soh || 100,
        powerKw: data.currentPowerKw || 0,
        tempC: data.temperature || 25,
        voltageV: data.voltage || 0,
        currentA: data.current || 0,
        cycleCount: data.cycleCount || 0,
        alerts,
        lastUpdate: data.lastUpdate?.toDate?.().toISOString() || new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting compact system data:', error);
      throw error;
    }
  }

  /**
   * Get real-time data (minimal payload)
   */
  async getRealtimeData(systemId: string): Promise<{
    soc: number;
    power: number;
    temp: number;
    status: string;
    ts: number;
  }> {
    try {
      const doc = await this.db.collection('bessSystems').doc(systemId).get();

      if (!doc.exists) {
        throw new Error('System not found');
      }

      const data = doc.data()!;

      return {
        soc: data.soc || 0,
        power: data.currentPowerKw || 0,
        temp: data.temperature || 25,
        status: this.getSystemStatus(data),
        ts: Date.now()
      };
    } catch (error) {
      logger.error('Error getting realtime data:', error);
      throw error;
    }
  }

  /**
   * Get widget data
   */
  async getWidgetData(userId: string, widgetType: string): Promise<any> {
    try {
      switch (widgetType) {
        case 'summary':
          return this.getWidgetSummary(userId);
        case 'alerts':
          return this.getWidgetAlerts(userId);
        case 'energy':
          return this.getWidgetEnergy(userId);
        case 'status':
          return this.getWidgetStatus(userId);
        default:
          return this.getWidgetSummary(userId);
      }
    } catch (error) {
      logger.error('Error getting widget data:', error);
      throw error;
    }
  }

  private async getWidgetSummary(userId: string) {
    const dashboard = await this.getDashboardData(userId);
    return {
      type: 'summary',
      data: {
        systems: `${dashboard.onlineSystems}/${dashboard.totalSystems}`,
        soc: Math.round(dashboard.averageSoc),
        power: Math.round(dashboard.currentPowerKw),
        alerts: dashboard.activeAlerts
      },
      updated: Date.now()
    };
  }

  private async getWidgetAlerts(userId: string) {
    const alertsSnap = await this.db
      .collection('alerts')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();

    return {
      type: 'alerts',
      data: alertsSnap.docs.map(doc => ({
        id: doc.id,
        severity: doc.data().severity,
        message: doc.data().message?.substring(0, 50)
      })),
      updated: Date.now()
    };
  }

  private async getWidgetEnergy(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const energySnap = await this.db
      .collection('energyMetrics')
      .where('userId', '==', userId)
      .where('timestamp', '>=', today)
      .get();

    let charged = 0;
    let discharged = 0;

    energySnap.docs.forEach(doc => {
      const data = doc.data();
      charged += data.chargedKwh || 0;
      discharged += data.dischargedKwh || 0;
    });

    return {
      type: 'energy',
      data: {
        charged: Math.round(charged * 10) / 10,
        discharged: Math.round(discharged * 10) / 10,
        net: Math.round((discharged - charged) * 10) / 10
      },
      updated: Date.now()
    };
  }

  private async getWidgetStatus(userId: string) {
    const systemsSnap = await this.db
      .collection('bessSystems')
      .where('userId', '==', userId)
      .get();

    const statuses = { online: 0, offline: 0, warning: 0, error: 0 };

    systemsSnap.docs.forEach(doc => {
      const status = this.getSystemStatus(doc.data());
      statuses[status as keyof typeof statuses]++;
    });

    return {
      type: 'status',
      data: statuses,
      updated: Date.now()
    };
  }

  /**
   * Execute quick command
   */
  async executeQuickCommand(
    userId: string,
    systemId: string,
    command: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify ownership
      const systemDoc = await this.db.collection('bessSystems').doc(systemId).get();
      if (!systemDoc.exists || systemDoc.data()?.userId !== userId) {
        throw new Error('System not found or access denied');
      }

      // Create command record
      await this.db.collection('commands').add({
        systemId,
        userId,
        command,
        source: 'mobile',
        status: 'pending',
        createdAt: new Date()
      });

      logger.info(`Quick command ${command} sent to system ${systemId} by user ${userId}`);

      return {
        success: true,
        message: `Command ${command} sent successfully`
      };
    } catch (error: any) {
      logger.error('Error executing quick command:', error);
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(userId: string): Promise<AlertSummary[]> {
    try {
      const alertsSnap = await this.db
        .collection('alerts')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      return alertsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          severity: data.severity,
          message: data.message,
          timestamp: data.timestamp?.toDate?.().toISOString() || new Date().toISOString()
        };
      });
    } catch (error) {
      logger.error('Error getting active alerts:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(userId: string, alertId: string, note?: string): Promise<void> {
    try {
      const alertRef = this.db.collection('alerts').doc(alertId);
      const alertDoc = await alertRef.get();

      if (!alertDoc.exists || alertDoc.data()?.userId !== userId) {
        throw new Error('Alert not found or access denied');
      }

      await alertRef.update({
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        acknowledgeNote: note || null
      });

      logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Get chart data optimized for mobile
   */
  async getChartData(
    systemId: string,
    metric: string,
    period: string,
    maxPoints: number
  ): Promise<{ points: ChartPoint[]; min: number; max: number; avg: number }> {
    try {
      const now = new Date();
      let startTime = new Date();

      switch (period) {
        case '1h':
          startTime.setHours(now.getHours() - 1);
          break;
        case '6h':
          startTime.setHours(now.getHours() - 6);
          break;
        case '24h':
          startTime.setDate(now.getDate() - 1);
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(now.getDate() - 30);
          break;
        default:
          startTime.setDate(now.getDate() - 1);
      }

      const metricsSnap = await this.db
        .collection('telemetry')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', startTime)
        .orderBy('timestamp', 'asc')
        .get();

      const allPoints = metricsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          t: data.timestamp?.toDate?.().getTime() || Date.now(),
          v: data[metric] || 0
        };
      });

      // Downsample if needed
      const points = this.downsample(allPoints, maxPoints);

      // Calculate stats
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;

      points.forEach(p => {
        if (p.v < min) min = p.v;
        if (p.v > max) max = p.v;
        sum += p.v;
      });

      return {
        points,
        min: points.length > 0 ? min : 0,
        max: points.length > 0 ? max : 0,
        avg: points.length > 0 ? sum / points.length : 0
      };
    } catch (error) {
      logger.error('Error getting chart data:', error);
      throw error;
    }
  }

  /**
   * Get quick reports
   */
  async getQuickReports(userId: string): Promise<any> {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());

      // Today's summary
      const todaySummary = await this.getEnergySummary(userId, today);
      const yesterdaySummary = await this.getEnergySummary(userId, yesterday);

      return {
        today: todaySummary,
        yesterday: yesterdaySummary,
        comparison: {
          energyChange: todaySummary.total - yesterdaySummary.total,
          efficiencyChange: todaySummary.efficiency - yesterdaySummary.efficiency
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting quick reports:', error);
      throw error;
    }
  }

  private async getEnergySummary(userId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const metricsSnap = await this.db
      .collection('energyMetrics')
      .where('userId', '==', userId)
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<=', endOfDay)
      .get();

    let charged = 0;
    let discharged = 0;

    metricsSnap.docs.forEach(doc => {
      const data = doc.data();
      charged += data.chargedKwh || 0;
      discharged += data.dischargedKwh || 0;
    });

    return {
      charged: Math.round(charged * 10) / 10,
      discharged: Math.round(discharged * 10) / 10,
      total: Math.round((charged + discharged) * 10) / 10,
      efficiency: charged > 0 ? Math.round((discharged / charged) * 100) : 0
    };
  }

  /**
   * Get today's energy summary
   */
  async getTodayEnergySummary(userId: string): Promise<any> {
    const today = new Date();
    return this.getEnergySummary(userId, today);
  }

  // Helper methods

  private getSystemStatus(data: any): 'online' | 'offline' | 'warning' | 'error' {
    if (data.status === 'error' || data.hasCriticalAlert) {
      return 'error';
    }
    if (data.status === 'warning' || data.hasWarning) {
      return 'warning';
    }
    if (data.status === 'offline' || !data.isConnected) {
      return 'offline';
    }
    return 'online';
  }

  private downsample(points: ChartPoint[], maxPoints: number): ChartPoint[] {
    if (points.length <= maxPoints) {
      return points;
    }

    const result: ChartPoint[] = [];
    const step = points.length / maxPoints;

    for (let i = 0; i < maxPoints; i++) {
      const index = Math.floor(i * step);
      result.push(points[index]);
    }

    return result;
  }
}
