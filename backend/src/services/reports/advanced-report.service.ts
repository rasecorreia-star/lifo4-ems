/**
 * Advanced Report Service
 * Comprehensive reporting with analytics, exports, and scheduling
 */

import { firestore } from '../../config/firebase';
import { logger } from '../../utils/logger';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Report types
export enum ReportType {
  DAILY_SUMMARY = 'daily_summary',
  WEEKLY_SUMMARY = 'weekly_summary',
  MONTHLY_SUMMARY = 'monthly_summary',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  DEGRADATION_REPORT = 'degradation_report',
  FINANCIAL_REPORT = 'financial_report',
  MAINTENANCE_REPORT = 'maintenance_report',
  ALARM_HISTORY = 'alarm_history',
  EFFICIENCY_ANALYSIS = 'efficiency_analysis',
  CUSTOM = 'custom'
}

export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'xlsx',
  CSV = 'csv',
  JSON = 'json'
}

interface ReportConfig {
  type: ReportType;
  title: string;
  description?: string;
  systemIds: string[];
  startDate: Date;
  endDate: Date;
  options?: Record<string, any>;
  format: ExportFormat;
}

interface ReportResult {
  id: string;
  type: ReportType;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
  metadata: Record<string, any>;
}

interface DailySummary {
  date: string;
  totalEnergyCharged: number;
  totalEnergyDischarged: number;
  peakPowerKw: number;
  averageSoc: number;
  efficiency: number;
  cycleCount: number;
  alarmCount: number;
  revenue: number;
}

interface PerformanceMetrics {
  systemId: string;
  systemName: string;
  period: {
    start: string;
    end: string;
  };
  energy: {
    totalCharged: number;
    totalDischarged: number;
    netEnergy: number;
    roundTripEfficiency: number;
  };
  power: {
    peakCharge: number;
    peakDischarge: number;
    averagePower: number;
    capacityFactor: number;
  };
  availability: {
    uptimePercent: number;
    downtimeHours: number;
    mtbf: number; // Mean Time Between Failures
    mttr: number; // Mean Time To Repair
  };
  health: {
    socMin: number;
    socMax: number;
    socAverage: number;
    sohStart: number;
    sohEnd: number;
    degradationRate: number;
  };
  financial: {
    revenue: number;
    savings: number;
    operatingCost: number;
    netBenefit: number;
  };
}

interface DegradationData {
  systemId: string;
  measurements: {
    date: string;
    soh: number;
    capacityKwh: number;
    cycleCount: number;
  }[];
  projections: {
    date: string;
    estimatedSoh: number;
    estimatedCapacity: number;
  }[];
  endOfLife: {
    estimatedDate: string;
    remainingCycles: number;
    remainingYears: number;
    confidence: number;
  };
}

export class AdvancedReportService {
  private db = firestore;

  /**
   * Generate a report
   */
  async generateReport(userId: string, config: ReportConfig): Promise<ReportResult> {
    const reportId = this.db.collection('reports').doc().id;

    // Create report record
    const reportResult: ReportResult = {
      id: reportId,
      type: config.type,
      title: config.title,
      status: 'pending',
      createdAt: new Date(),
      metadata: {
        systemIds: config.systemIds,
        startDate: config.startDate.toISOString(),
        endDate: config.endDate.toISOString(),
        format: config.format,
        requestedBy: userId
      }
    };

    await this.db.collection('reports').doc(reportId).set(reportResult);

    // Process report asynchronously
    this.processReport(reportId, userId, config).catch(error => {
      logger.error(`Report ${reportId} failed:`, error);
    });

    return reportResult;
  }

  /**
   * Process report generation
   */
  private async processReport(
    reportId: string,
    userId: string,
    config: ReportConfig
  ): Promise<void> {
    try {
      await this.updateReportStatus(reportId, 'processing');

      let reportData: any;

      switch (config.type) {
        case ReportType.DAILY_SUMMARY:
          reportData = await this.generateDailySummary(config);
          break;
        case ReportType.WEEKLY_SUMMARY:
          reportData = await this.generateWeeklySummary(config);
          break;
        case ReportType.MONTHLY_SUMMARY:
          reportData = await this.generateMonthlySummary(config);
          break;
        case ReportType.PERFORMANCE_ANALYSIS:
          reportData = await this.generatePerformanceAnalysis(config);
          break;
        case ReportType.DEGRADATION_REPORT:
          reportData = await this.generateDegradationReport(config);
          break;
        case ReportType.FINANCIAL_REPORT:
          reportData = await this.generateFinancialReport(config);
          break;
        case ReportType.MAINTENANCE_REPORT:
          reportData = await this.generateMaintenanceReport(config);
          break;
        case ReportType.ALARM_HISTORY:
          reportData = await this.generateAlarmHistory(config);
          break;
        case ReportType.EFFICIENCY_ANALYSIS:
          reportData = await this.generateEfficiencyAnalysis(config);
          break;
        default:
          throw new Error(`Unknown report type: ${config.type}`);
      }

      // Export to requested format
      const fileBuffer = await this.exportReport(config, reportData);

      // Upload to storage and get URL
      const downloadUrl = await this.uploadReport(reportId, fileBuffer, config.format);

      await this.db.collection('reports').doc(reportId).update({
        status: 'completed',
        completedAt: new Date(),
        downloadUrl,
        'metadata.dataPoints': reportData.length || Object.keys(reportData).length
      });

      logger.info(`Report ${reportId} completed successfully`);
    } catch (error: any) {
      await this.db.collection('reports').doc(reportId).update({
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate daily summary report
   */
  private async generateDailySummary(config: ReportConfig): Promise<DailySummary[]> {
    const summaries: DailySummary[] = [];
    const current = new Date(config.startDate);

    while (current <= config.endDate) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      let totalCharged = 0;
      let totalDischarged = 0;
      let peakPower = 0;
      let socSum = 0;
      let socCount = 0;
      let alarmCount = 0;
      let revenue = 0;

      for (const systemId of config.systemIds) {
        // Get telemetry data
        const telemetrySnap = await this.db
          .collection('telemetry')
          .where('systemId', '==', systemId)
          .where('timestamp', '>=', dayStart)
          .where('timestamp', '<=', dayEnd)
          .get();

        telemetrySnap.docs.forEach(doc => {
          const data = doc.data();
          totalCharged += data.chargedKwh || 0;
          totalDischarged += data.dischargedKwh || 0;
          if (Math.abs(data.powerKw || 0) > peakPower) {
            peakPower = Math.abs(data.powerKw);
          }
          if (data.soc !== undefined) {
            socSum += data.soc;
            socCount++;
          }
        });

        // Get alarms
        const alarmsSnap = await this.db
          .collection('alerts')
          .where('systemId', '==', systemId)
          .where('timestamp', '>=', dayStart)
          .where('timestamp', '<=', dayEnd)
          .get();

        alarmCount += alarmsSnap.size;

        // Get revenue
        const revenueSnap = await this.db
          .collection('revenue')
          .where('systemId', '==', systemId)
          .where('date', '==', current.toISOString().split('T')[0])
          .get();

        revenueSnap.docs.forEach(doc => {
          revenue += doc.data().amount || 0;
        });
      }

      summaries.push({
        date: current.toISOString().split('T')[0],
        totalEnergyCharged: Math.round(totalCharged * 100) / 100,
        totalEnergyDischarged: Math.round(totalDischarged * 100) / 100,
        peakPowerKw: Math.round(peakPower * 100) / 100,
        averageSoc: socCount > 0 ? Math.round((socSum / socCount) * 10) / 10 : 0,
        efficiency: totalCharged > 0 ? Math.round((totalDischarged / totalCharged) * 1000) / 10 : 0,
        cycleCount: Math.round((totalCharged + totalDischarged) / 200),  // Assuming 100kWh system
        alarmCount,
        revenue: Math.round(revenue * 100) / 100
      });

      current.setDate(current.getDate() + 1);
    }

    return summaries;
  }

  /**
   * Generate weekly summary report
   */
  private async generateWeeklySummary(config: ReportConfig): Promise<any> {
    const dailyData = await this.generateDailySummary(config);

    // Group by week
    const weeks: Record<string, DailySummary[]> = {};

    dailyData.forEach(day => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(day);
    });

    return Object.entries(weeks).map(([weekStart, days]) => ({
      weekStart,
      weekEnd: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalEnergyCharged: days.reduce((sum, d) => sum + d.totalEnergyCharged, 0),
      totalEnergyDischarged: days.reduce((sum, d) => sum + d.totalEnergyDischarged, 0),
      peakPowerKw: Math.max(...days.map(d => d.peakPowerKw)),
      averageSoc: days.reduce((sum, d) => sum + d.averageSoc, 0) / days.length,
      averageEfficiency: days.reduce((sum, d) => sum + d.efficiency, 0) / days.length,
      totalAlarms: days.reduce((sum, d) => sum + d.alarmCount, 0),
      totalRevenue: days.reduce((sum, d) => sum + d.revenue, 0),
      daysReported: days.length
    }));
  }

  /**
   * Generate monthly summary report
   */
  private async generateMonthlySummary(config: ReportConfig): Promise<any> {
    const dailyData = await this.generateDailySummary(config);

    // Group by month
    const months: Record<string, DailySummary[]> = {};

    dailyData.forEach(day => {
      const monthKey = day.date.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) {
        months[monthKey] = [];
      }
      months[monthKey].push(day);
    });

    return Object.entries(months).map(([month, days]) => ({
      month,
      totalEnergyCharged: Math.round(days.reduce((sum, d) => sum + d.totalEnergyCharged, 0) * 100) / 100,
      totalEnergyDischarged: Math.round(days.reduce((sum, d) => sum + d.totalEnergyDischarged, 0) * 100) / 100,
      peakPowerKw: Math.max(...days.map(d => d.peakPowerKw)),
      averageSoc: Math.round((days.reduce((sum, d) => sum + d.averageSoc, 0) / days.length) * 10) / 10,
      averageEfficiency: Math.round((days.reduce((sum, d) => sum + d.efficiency, 0) / days.length) * 10) / 10,
      totalCycles: days.reduce((sum, d) => sum + d.cycleCount, 0),
      totalAlarms: days.reduce((sum, d) => sum + d.alarmCount, 0),
      totalRevenue: Math.round(days.reduce((sum, d) => sum + d.revenue, 0) * 100) / 100,
      daysReported: days.length
    }));
  }

  /**
   * Generate performance analysis report
   */
  private async generatePerformanceAnalysis(config: ReportConfig): Promise<PerformanceMetrics[]> {
    const metrics: PerformanceMetrics[] = [];

    for (const systemId of config.systemIds) {
      // Get system info
      const systemDoc = await this.db.collection('bessSystems').doc(systemId).get();
      const systemData = systemDoc.data() || {};

      // Get telemetry
      const telemetrySnap = await this.db
        .collection('telemetry')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', config.startDate)
        .where('timestamp', '<=', config.endDate)
        .orderBy('timestamp')
        .get();

      let totalCharged = 0;
      let totalDischarged = 0;
      let peakCharge = 0;
      let peakDischarge = 0;
      let powerSum = 0;
      let socMin = 100;
      let socMax = 0;
      let socSum = 0;
      let dataPoints = 0;

      telemetrySnap.docs.forEach(doc => {
        const data = doc.data();
        totalCharged += data.chargedKwh || 0;
        totalDischarged += data.dischargedKwh || 0;

        const power = data.powerKw || 0;
        if (power > 0 && power > peakDischarge) peakDischarge = power;
        if (power < 0 && Math.abs(power) > peakCharge) peakCharge = Math.abs(power);
        powerSum += Math.abs(power);

        const soc = data.soc || 50;
        if (soc < socMin) socMin = soc;
        if (soc > socMax) socMax = soc;
        socSum += soc;
        dataPoints++;
      });

      // Get alarms for MTBF/MTTR
      const alarmsSnap = await this.db
        .collection('alerts')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', config.startDate)
        .where('timestamp', '<=', config.endDate)
        .get();

      const periodHours = (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60);
      const failureCount = alarmsSnap.docs.filter(d => d.data().severity === 'critical').length;

      // Get revenue
      const revenueSnap = await this.db
        .collection('revenue')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', config.startDate)
        .where('timestamp', '<=', config.endDate)
        .get();

      let revenue = 0;
      let savings = 0;
      let cost = 0;

      revenueSnap.docs.forEach(doc => {
        const data = doc.data();
        revenue += data.revenue || 0;
        savings += data.savings || 0;
        cost += data.operatingCost || 0;
      });

      metrics.push({
        systemId,
        systemName: systemData.name || systemId,
        period: {
          start: config.startDate.toISOString(),
          end: config.endDate.toISOString()
        },
        energy: {
          totalCharged: Math.round(totalCharged * 100) / 100,
          totalDischarged: Math.round(totalDischarged * 100) / 100,
          netEnergy: Math.round((totalDischarged - totalCharged) * 100) / 100,
          roundTripEfficiency: totalCharged > 0 ? Math.round((totalDischarged / totalCharged) * 1000) / 10 : 0
        },
        power: {
          peakCharge: Math.round(peakCharge * 100) / 100,
          peakDischarge: Math.round(peakDischarge * 100) / 100,
          averagePower: dataPoints > 0 ? Math.round((powerSum / dataPoints) * 100) / 100 : 0,
          capacityFactor: systemData.powerKw ? Math.round((powerSum / dataPoints / systemData.powerKw) * 1000) / 10 : 0
        },
        availability: {
          uptimePercent: 99.5, // TODO: Calculate from actual uptime data
          downtimeHours: periodHours * 0.005,
          mtbf: failureCount > 0 ? periodHours / failureCount : periodHours,
          mttr: failureCount > 0 ? 2 : 0 // Assumed 2 hours average repair time
        },
        health: {
          socMin,
          socMax,
          socAverage: dataPoints > 0 ? Math.round((socSum / dataPoints) * 10) / 10 : 50,
          sohStart: systemData.sohStart || 100,
          sohEnd: systemData.soh || 100,
          degradationRate: (systemData.sohStart || 100) - (systemData.soh || 100)
        },
        financial: {
          revenue: Math.round(revenue * 100) / 100,
          savings: Math.round(savings * 100) / 100,
          operatingCost: Math.round(cost * 100) / 100,
          netBenefit: Math.round((revenue + savings - cost) * 100) / 100
        }
      });
    }

    return metrics;
  }

  /**
   * Generate degradation report
   */
  private async generateDegradationReport(config: ReportConfig): Promise<DegradationData[]> {
    const data: DegradationData[] = [];

    for (const systemId of config.systemIds) {
      // Get historical SOH data
      const sohSnap = await this.db
        .collection('sohHistory')
        .where('systemId', '==', systemId)
        .orderBy('timestamp')
        .get();

      const measurements = sohSnap.docs.map(doc => {
        const d = doc.data();
        return {
          date: d.timestamp?.toDate?.().toISOString().split('T')[0] || '',
          soh: d.soh || 100,
          capacityKwh: d.capacityKwh || 0,
          cycleCount: d.cycleCount || 0
        };
      });

      // Simple linear projection
      const projections: any[] = [];
      if (measurements.length >= 2) {
        const first = measurements[0];
        const last = measurements[measurements.length - 1];
        const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
        const sohDiff = first.soh - last.soh;
        const dailyDegradation = sohDiff / daysDiff;

        for (let i = 1; i <= 12; i++) {
          const futureDate = new Date();
          futureDate.setMonth(futureDate.getMonth() + i);
          const daysFuture = (futureDate.getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24);

          projections.push({
            date: futureDate.toISOString().split('T')[0],
            estimatedSoh: Math.max(0, last.soh - (dailyDegradation * daysFuture)),
            estimatedCapacity: last.capacityKwh * (1 - (dailyDegradation * daysFuture) / 100)
          });
        }

        // Calculate end of life (80% SOH)
        const daysToEol = ((last.soh - 80) / dailyDegradation);
        const eolDate = new Date();
        eolDate.setDate(eolDate.getDate() + daysToEol);

        data.push({
          systemId,
          measurements,
          projections,
          endOfLife: {
            estimatedDate: eolDate.toISOString().split('T')[0],
            remainingCycles: Math.round((last.soh - 80) / 0.02), // Assuming 0.02% per cycle
            remainingYears: Math.round((daysToEol / 365) * 10) / 10,
            confidence: measurements.length > 10 ? 0.85 : 0.6
          }
        });
      }
    }

    return data;
  }

  /**
   * Generate financial report
   */
  private async generateFinancialReport(config: ReportConfig): Promise<any> {
    const financial = {
      summary: {
        totalRevenue: 0,
        totalSavings: 0,
        totalCost: 0,
        netBenefit: 0,
        roi: 0
      },
      bySystem: [] as any[],
      byMonth: [] as any[],
      bySource: {
        arbitrage: 0,
        peakShaving: 0,
        frequencyRegulation: 0,
        demandResponse: 0,
        other: 0
      }
    };

    for (const systemId of config.systemIds) {
      const revenueSnap = await this.db
        .collection('revenue')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', config.startDate)
        .where('timestamp', '<=', config.endDate)
        .get();

      let systemRevenue = 0;
      let systemSavings = 0;
      let systemCost = 0;

      revenueSnap.docs.forEach(doc => {
        const data = doc.data();
        systemRevenue += data.revenue || 0;
        systemSavings += data.savings || 0;
        systemCost += data.operatingCost || 0;

        // By source
        financial.bySource.arbitrage += data.arbitrageRevenue || 0;
        financial.bySource.peakShaving += data.peakShavingRevenue || 0;
        financial.bySource.frequencyRegulation += data.frequencyRegulationRevenue || 0;
        financial.bySource.demandResponse += data.demandResponseRevenue || 0;
        financial.bySource.other += data.otherRevenue || 0;
      });

      financial.bySystem.push({
        systemId,
        revenue: Math.round(systemRevenue * 100) / 100,
        savings: Math.round(systemSavings * 100) / 100,
        cost: Math.round(systemCost * 100) / 100,
        netBenefit: Math.round((systemRevenue + systemSavings - systemCost) * 100) / 100
      });

      financial.summary.totalRevenue += systemRevenue;
      financial.summary.totalSavings += systemSavings;
      financial.summary.totalCost += systemCost;
    }

    financial.summary.netBenefit = financial.summary.totalRevenue + financial.summary.totalSavings - financial.summary.totalCost;
    financial.summary.roi = financial.summary.totalCost > 0
      ? Math.round((financial.summary.netBenefit / financial.summary.totalCost) * 1000) / 10
      : 0;

    return financial;
  }

  /**
   * Generate maintenance report
   */
  private async generateMaintenanceReport(config: ReportConfig): Promise<any> {
    const maintenance = {
      scheduled: [] as any[],
      completed: [] as any[],
      pending: [] as any[],
      costs: {
        total: 0,
        labor: 0,
        parts: 0,
        other: 0
      }
    };

    for (const systemId of config.systemIds) {
      const maintenanceSnap = await this.db
        .collection('maintenance')
        .where('systemId', '==', systemId)
        .where('scheduledDate', '>=', config.startDate)
        .where('scheduledDate', '<=', config.endDate)
        .get();

      maintenanceSnap.docs.forEach(doc => {
        const data = doc.data();
        const entry = {
          id: doc.id,
          systemId,
          type: data.type,
          description: data.description,
          scheduledDate: data.scheduledDate?.toDate?.().toISOString(),
          completedDate: data.completedDate?.toDate?.().toISOString(),
          status: data.status,
          cost: data.cost || 0,
          technician: data.technician
        };

        if (data.status === 'completed') {
          maintenance.completed.push(entry);
        } else if (data.status === 'pending') {
          maintenance.pending.push(entry);
        } else {
          maintenance.scheduled.push(entry);
        }

        maintenance.costs.total += data.cost || 0;
        maintenance.costs.labor += data.laborCost || 0;
        maintenance.costs.parts += data.partsCost || 0;
        maintenance.costs.other += (data.cost || 0) - (data.laborCost || 0) - (data.partsCost || 0);
      });
    }

    return maintenance;
  }

  /**
   * Generate alarm history report
   */
  private async generateAlarmHistory(config: ReportConfig): Promise<any> {
    const alarms = {
      summary: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        acknowledged: 0,
        resolved: 0
      },
      bySystem: [] as any[],
      byType: {} as Record<string, number>,
      timeline: [] as any[]
    };

    for (const systemId of config.systemIds) {
      const alarmsSnap = await this.db
        .collection('alerts')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', config.startDate)
        .where('timestamp', '<=', config.endDate)
        .orderBy('timestamp', 'desc')
        .get();

      let systemAlarms = { critical: 0, warning: 0, info: 0 };

      alarmsSnap.docs.forEach(doc => {
        const data = doc.data();

        alarms.summary.total++;
        if (data.severity === 'critical') {
          alarms.summary.critical++;
          systemAlarms.critical++;
        } else if (data.severity === 'warning') {
          alarms.summary.warning++;
          systemAlarms.warning++;
        } else {
          alarms.summary.info++;
          systemAlarms.info++;
        }

        if (data.acknowledgedAt) alarms.summary.acknowledged++;
        if (data.resolvedAt) alarms.summary.resolved++;

        // By type
        const type = data.type || 'unknown';
        alarms.byType[type] = (alarms.byType[type] || 0) + 1;

        alarms.timeline.push({
          timestamp: data.timestamp?.toDate?.().toISOString(),
          systemId,
          severity: data.severity,
          type: data.type,
          message: data.message,
          acknowledged: !!data.acknowledgedAt,
          resolved: !!data.resolvedAt
        });
      });

      alarms.bySystem.push({
        systemId,
        ...systemAlarms,
        total: systemAlarms.critical + systemAlarms.warning + systemAlarms.info
      });
    }

    return alarms;
  }

  /**
   * Generate efficiency analysis report
   */
  private async generateEfficiencyAnalysis(config: ReportConfig): Promise<any> {
    const analysis = {
      overall: {
        roundTripEfficiency: 0,
        chargeEfficiency: 0,
        dischargeEfficiency: 0
      },
      byTemperature: [] as any[],
      byPowerLevel: [] as any[],
      bySoc: [] as any[],
      trends: [] as any[]
    };

    let totalCharged = 0;
    let totalDischarged = 0;

    // Collect efficiency data
    for (const systemId of config.systemIds) {
      const telemetrySnap = await this.db
        .collection('telemetry')
        .where('systemId', '==', systemId)
        .where('timestamp', '>=', config.startDate)
        .where('timestamp', '<=', config.endDate)
        .get();

      telemetrySnap.docs.forEach(doc => {
        const data = doc.data();
        totalCharged += data.chargedKwh || 0;
        totalDischarged += data.dischargedKwh || 0;
      });
    }

    analysis.overall.roundTripEfficiency = totalCharged > 0
      ? Math.round((totalDischarged / totalCharged) * 1000) / 10
      : 0;

    // Efficiency by temperature ranges
    const tempRanges = [
      { min: 0, max: 15, label: '0-15°C' },
      { min: 15, max: 25, label: '15-25°C' },
      { min: 25, max: 35, label: '25-35°C' },
      { min: 35, max: 50, label: '35-50°C' }
    ];

    for (const range of tempRanges) {
      analysis.byTemperature.push({
        range: range.label,
        efficiency: 92 - (Math.abs(25 - (range.min + range.max) / 2) * 0.2) // Simulated
      });
    }

    // Efficiency by power level
    const powerLevels = ['0-25%', '25-50%', '50-75%', '75-100%'];
    powerLevels.forEach((level, i) => {
      analysis.byPowerLevel.push({
        level,
        efficiency: 94 - (i * 1.5) // Higher power = slightly lower efficiency
      });
    });

    return analysis;
  }

  /**
   * Export report to requested format
   */
  private async exportReport(config: ReportConfig, data: any): Promise<Buffer> {
    switch (config.format) {
      case ExportFormat.JSON:
        return Buffer.from(JSON.stringify(data, null, 2));

      case ExportFormat.CSV:
        return this.exportToCsv(data);

      case ExportFormat.EXCEL:
        return this.exportToExcel(config, data);

      case ExportFormat.PDF:
        return this.exportToPdf(config, data);

      default:
        return Buffer.from(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Export to CSV
   */
  private exportToCsv(data: any): Buffer {
    const rows: string[] = [];

    if (Array.isArray(data)) {
      if (data.length > 0) {
        // Header
        rows.push(Object.keys(data[0]).join(','));
        // Data rows
        data.forEach(item => {
          rows.push(Object.values(item).map(v =>
            typeof v === 'object' ? JSON.stringify(v) : String(v)
          ).join(','));
        });
      }
    } else {
      // Object - flatten
      rows.push('key,value');
      Object.entries(data).forEach(([key, value]) => {
        rows.push(`${key},${typeof value === 'object' ? JSON.stringify(value) : value}`);
      });
    }

    return Buffer.from(rows.join('\n'));
  }

  /**
   * Export to Excel
   */
  private async exportToExcel(config: ReportConfig, data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EMS BESS Report Service';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(config.title.substring(0, 31));

    if (Array.isArray(data) && data.length > 0) {
      // Add headers
      const headers = Object.keys(data[0]);
      sheet.addRow(headers);

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Add data rows
      data.forEach(item => {
        sheet.addRow(Object.values(item).map(v =>
          typeof v === 'object' ? JSON.stringify(v) : v
        ));
      });

      // Auto-fit columns
      sheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Export to PDF
   */
  private exportToPdf(config: ReportConfig, data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument();

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text(config.title, { align: 'center' });
      doc.moveDown();

      // Period
      doc.fontSize(12).text(
        `Período: ${config.startDate.toLocaleDateString()} - ${config.endDate.toLocaleDateString()}`,
        { align: 'center' }
      );
      doc.moveDown(2);

      // Content
      if (Array.isArray(data)) {
        data.slice(0, 50).forEach((item, index) => {
          doc.fontSize(10).text(`${index + 1}. ${JSON.stringify(item)}`, {
            width: 500,
            continued: false
          });
          doc.moveDown(0.5);
        });

        if (data.length > 50) {
          doc.text(`... e mais ${data.length - 50} registros`);
        }
      } else {
        Object.entries(data).forEach(([key, value]) => {
          doc.fontSize(12).text(`${key}:`, { continued: true });
          doc.fontSize(10).text(` ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          doc.moveDown(0.5);
        });
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text(
        `Gerado em ${new Date().toLocaleString()} | EMS BESS Report Service`,
        { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Upload report to storage
   */
  private async uploadReport(
    reportId: string,
    buffer: Buffer,
    format: ExportFormat
  ): Promise<string> {
    // In a real implementation, this would upload to Firebase Storage or S3
    // For now, we'll return a mock URL
    const extension = format === ExportFormat.EXCEL ? 'xlsx' : format;
    return `/api/reports/download/${reportId}.${extension}`;
  }

  /**
   * Update report status
   */
  private async updateReportStatus(
    reportId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    await this.db.collection('reports').doc(reportId).update({ status });
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<ReportResult | null> {
    const doc = await this.db.collection('reports').doc(reportId).get();
    return doc.exists ? (doc.data() as ReportResult) : null;
  }

  /**
   * List user reports
   */
  async listReports(
    userId: string,
    limit: number = 20
  ): Promise<ReportResult[]> {
    const snap = await this.db
      .collection('reports')
      .where('metadata.requestedBy', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(doc => doc.data() as ReportResult);
  }

  /**
   * Schedule recurring report
   */
  async scheduleReport(
    userId: string,
    config: ReportConfig,
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      hour: number;
      timezone: string;
    }
  ): Promise<string> {
    const scheduleId = this.db.collection('scheduledReports').doc().id;

    await this.db.collection('scheduledReports').doc(scheduleId).set({
      userId,
      config,
      schedule,
      active: true,
      createdAt: new Date(),
      lastRun: null,
      nextRun: this.calculateNextRun(schedule)
    });

    logger.info(`Scheduled report ${scheduleId} for user ${userId}`);
    return scheduleId;
  }

  private calculateNextRun(schedule: any): Date {
    const now = new Date();
    const next = new Date();
    next.setHours(schedule.hour, 0, 0, 0);

    if (schedule.frequency === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (schedule.frequency === 'weekly') {
      next.setDate(next.getDate() + ((schedule.dayOfWeek - now.getDay() + 7) % 7));
      if (next <= now) next.setDate(next.getDate() + 7);
    } else if (schedule.frequency === 'monthly') {
      next.setDate(schedule.dayOfMonth);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }

    return next;
  }
}

export const advancedReportService = new AdvancedReportService();
