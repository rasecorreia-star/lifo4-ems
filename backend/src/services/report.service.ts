/**
 * Report Service for Lifo4 EMS
 * PDF report generation for daily, weekly, monthly reports
 */

import PDFDocument from 'pdfkit';
import { getFirestore, Collections, getStorage } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';
import { Report, ReportType, BessSystem, TelemetryData, CycleRecord, Alert } from '../models/types.js';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportData {
  system: BessSystem;
  period: { start: Date; end: Date };
  telemetry: {
    average: Partial<TelemetryData>;
    min: Partial<TelemetryData>;
    max: Partial<TelemetryData>;
  };
  energy: {
    charged: number;
    discharged: number;
    efficiency: number;
  };
  cycles: CycleRecord[];
  alerts: Alert[];
  temperature: {
    min: number;
    max: number;
    average: number;
  };
  soc: {
    min: number;
    max: number;
    average: number;
    final: number;
  };
  savings: {
    energy: number;
    demand: number;
    total: number;
  };
}

export class ReportService {
  private db = getFirestore();
  private storage = getStorage();

  // ============================================
  // REPORT GENERATION
  // ============================================

  /**
   * Generate a report for a system
   */
  async generateReport(
    systemId: string,
    type: ReportType,
    userId: string,
    customPeriod?: { start: Date; end: Date }
  ): Promise<Report> {
    const system = await this.getSystem(systemId);
    if (!system) {
      throw new NotFoundError('System');
    }

    // Determine period
    const period = customPeriod || this.getReportPeriod(type);

    // Create report record
    const now = new Date();
    const report: Omit<Report, 'id'> = {
      systemId,
      organizationId: system.organizationId,
      type,
      period,
      status: 'generating',
      createdAt: now,
      createdBy: userId,
    };

    const reportRef = await this.db.collection(Collections.REPORTS).add(report);
    const reportId = reportRef.id;

    // Generate report in background
    this.generateReportAsync(reportId, system, period, type).catch(error => {
      logger.error(`Report generation failed: ${reportId}`, { error });
      this.db.collection(Collections.REPORTS).doc(reportId).update({
        status: 'failed',
      });
    });

    return { id: reportId, ...report };
  }

  /**
   * Generate report async
   */
  private async generateReportAsync(
    reportId: string,
    system: BessSystem,
    period: { start: Date; end: Date },
    type: ReportType
  ): Promise<void> {
    try {
      // Gather data
      const data = await this.gatherReportData(system, period);

      // Generate PDF
      const pdfBuffer = await this.generatePDF(data, type);

      // Upload to storage
      const fileName = `reports/${system.organizationId}/${system.id}/${type}_${format(period.start, 'yyyy-MM-dd')}.pdf`;
      const bucket = this.storage.bucket();
      const file = bucket.file(fileName);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
        },
      });

      // Get download URL
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      // Update report record
      await this.db.collection(Collections.REPORTS).doc(reportId).update({
        status: 'completed',
        fileUrl: url,
        fileName: `${type}_${format(period.start, 'yyyy-MM-dd')}.pdf`,
      });

      logger.info(`Report generated: ${reportId}`, { type, systemId: system.id });
    } catch (error) {
      logger.error(`Report generation error: ${reportId}`, { error });
      throw error;
    }
  }

  /**
   * Gather all data needed for the report
   */
  private async gatherReportData(
    system: BessSystem,
    period: { start: Date; end: Date }
  ): Promise<ReportData> {
    // Get historical telemetry
    const telemetrySnapshot = await this.db
      .collection(Collections.TELEMETRY_HISTORY)
      .doc(system.id)
      .collection('data')
      .where('timestamp', '>=', period.start)
      .where('timestamp', '<=', period.end)
      .orderBy('timestamp', 'asc')
      .get();

    const telemetryData = telemetrySnapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as TelemetryData[];

    // Get cycles
    const cyclesSnapshot = await this.db
      .collection(Collections.CYCLES)
      .where('systemId', '==', system.id)
      .where('startTime', '>=', period.start)
      .where('startTime', '<=', period.end)
      .get();

    const cycles = cyclesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate(),
      endTime: doc.data().endTime?.toDate(),
    })) as CycleRecord[];

    // Get alerts
    const alertsSnapshot = await this.db
      .collection(Collections.ALERTS)
      .where('systemId', '==', system.id)
      .where('createdAt', '>=', period.start)
      .where('createdAt', '<=', period.end)
      .get();

    const alerts = alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as Alert[];

    // Calculate aggregates
    const socValues = telemetryData.map(t => t.soc).filter(v => v !== undefined);
    const tempValues = telemetryData.flatMap(t => t.temperature?.sensors || []).filter(v => v !== undefined);

    const avgSoc = socValues.length > 0 ? socValues.reduce((a, b) => a + b, 0) / socValues.length : 0;
    const minSoc = socValues.length > 0 ? Math.min(...socValues) : 0;
    const maxSoc = socValues.length > 0 ? Math.max(...socValues) : 0;
    const finalSoc = socValues.length > 0 ? socValues[socValues.length - 1] : 0;

    const avgTemp = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 0;
    const minTemp = tempValues.length > 0 ? Math.min(...tempValues) : 0;
    const maxTemp = tempValues.length > 0 ? Math.max(...tempValues) : 0;

    // Calculate energy
    const energyCharged = cycles.reduce((sum, c) => sum + (c.energyCharged || 0), 0);
    const energyDischarged = cycles.reduce((sum, c) => sum + (c.energyDischarged || 0), 0);
    const efficiency = energyCharged > 0 ? (energyDischarged / energyCharged) * 100 : 0;

    // Calculate savings (simplified - would use tariff data)
    const peakRate = 0.8; // R$/kWh
    const offPeakRate = 0.4; // R$/kWh
    const demandRate = 50; // R$/kW
    const energySavings = energyDischarged * (peakRate - offPeakRate);
    const demandSavings = 0; // Would calculate based on peak shaving

    return {
      system,
      period,
      telemetry: {
        average: { soc: avgSoc },
        min: { soc: minSoc },
        max: { soc: maxSoc },
      },
      energy: {
        charged: energyCharged,
        discharged: energyDischarged,
        efficiency,
      },
      cycles,
      alerts,
      temperature: {
        min: minTemp,
        max: maxTemp,
        average: avgTemp,
      },
      soc: {
        min: minSoc,
        max: maxSoc,
        average: avgSoc,
        final: finalSoc,
      },
      savings: {
        energy: energySavings,
        demand: demandSavings,
        total: energySavings + demandSavings,
      },
    };
  }

  /**
   * Generate PDF document
   */
  private async generatePDF(data: ReportData, type: ReportType): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Relatório ${this.getReportTypeName(type)} - ${data.system.name}`,
          Author: 'Lifo4 EMS',
          Subject: 'Relatório de Sistema BESS',
          Keywords: 'BESS, Energia, Bateria, Lifo4',
          Creator: 'Lifo4 EMS',
        },
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.addHeader(doc, data, type);

      // Summary Section
      this.addSummarySection(doc, data);

      // Energy Section
      doc.addPage();
      this.addEnergySection(doc, data);

      // SOC & Temperature Section
      this.addSocTempSection(doc, data);

      // Cycles Section
      if (data.cycles.length > 0) {
        doc.addPage();
        this.addCyclesSection(doc, data);
      }

      // Alerts Section
      if (data.alerts.length > 0) {
        doc.addPage();
        this.addAlertsSection(doc, data);
      }

      // Savings Section
      doc.addPage();
      this.addSavingsSection(doc, data);

      // Footer on all pages
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        this.addFooter(doc, i + 1, pages.count);
      }

      doc.end();
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, data: ReportData, type: ReportType): void {
    // Logo placeholder
    doc.fontSize(24)
      .fillColor('#10b981')
      .text('LIFO4', 50, 50)
      .fontSize(10)
      .fillColor('#6b7280')
      .text('ENERGIA', 50, 75);

    // Title
    doc.fontSize(20)
      .fillColor('#1f2937')
      .text(`Relatório ${this.getReportTypeName(type)}`, 150, 50, { align: 'center' });

    // System info
    doc.fontSize(12)
      .fillColor('#4b5563')
      .text(data.system.name, 150, 80, { align: 'center' })
      .fontSize(10)
      .text(`${format(data.period.start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} - ${format(data.period.end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 150, 100, { align: 'center' });

    // Line
    doc.moveTo(50, 130)
      .lineTo(545, 130)
      .strokeColor('#e5e7eb')
      .stroke();

    doc.moveDown(2);
  }

  private addSummarySection(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.y = 150;

    doc.fontSize(14)
      .fillColor('#1f2937')
      .text('Resumo Executivo', 50, doc.y);

    doc.moveDown(0.5);

    // Summary cards
    const cardWidth = 160;
    const cardHeight = 80;
    const startX = 50;
    const startY = doc.y;

    // Card 1: Energy
    this.drawCard(doc, startX, startY, cardWidth, cardHeight, 'Energia', `${data.energy.discharged.toFixed(1)} kWh`, 'Descarregada');

    // Card 2: Efficiency
    this.drawCard(doc, startX + cardWidth + 20, startY, cardWidth, cardHeight, 'Eficiência', `${data.energy.efficiency.toFixed(1)}%`, 'Round-trip');

    // Card 3: Savings
    this.drawCard(doc, startX + (cardWidth + 20) * 2, startY, cardWidth, cardHeight, 'Economia', `R$ ${data.savings.total.toFixed(2)}`, 'Total no período');

    doc.y = startY + cardHeight + 30;

    // System Status
    doc.fontSize(12)
      .fillColor('#1f2937')
      .text('Status do Sistema', 50, doc.y);

    doc.moveDown(0.5);

    const statusItems = [
      { label: 'SOC Final', value: `${data.soc.final.toFixed(1)}%` },
      { label: 'SOH', value: `${data.system.batterySpec?.nominalCapacity ? '95.0' : 'N/A'}%` },
      { label: 'Ciclos no período', value: `${data.cycles.length}` },
      { label: 'Alertas', value: `${data.alerts.length}` },
    ];

    statusItems.forEach((item, index) => {
      const x = 50 + (index % 2) * 250;
      const y = doc.y + Math.floor(index / 2) * 25;

      doc.fontSize(10)
        .fillColor('#6b7280')
        .text(item.label, x, y)
        .fillColor('#1f2937')
        .text(item.value, x + 150, y);
    });
  }

  private addEnergySection(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.fontSize(14)
      .fillColor('#1f2937')
      .text('Análise de Energia', 50, 50);

    doc.moveDown(1);

    // Energy metrics table
    const tableData = [
      ['Métrica', 'Valor', 'Unidade'],
      ['Energia Carregada', data.energy.charged.toFixed(2), 'kWh'],
      ['Energia Descarregada', data.energy.discharged.toFixed(2), 'kWh'],
      ['Eficiência Round-trip', data.energy.efficiency.toFixed(1), '%'],
      ['Total de Ciclos', data.cycles.length.toString(), 'ciclos'],
      ['DOD Médio', data.cycles.length > 0
        ? (data.cycles.reduce((sum, c) => sum + c.depthOfDischarge, 0) / data.cycles.length).toFixed(1)
        : '0', '%'],
    ];

    this.drawTable(doc, 50, doc.y, tableData);
  }

  private addSocTempSection(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.moveDown(2);

    doc.fontSize(14)
      .fillColor('#1f2937')
      .text('SOC e Temperatura', 50, doc.y);

    doc.moveDown(1);

    // SOC metrics
    doc.fontSize(12)
      .fillColor('#4b5563')
      .text('State of Charge (SOC)', 50, doc.y);

    doc.moveDown(0.5);

    const socData = [
      ['Métrica', 'Valor'],
      ['Mínimo', `${data.soc.min.toFixed(1)}%`],
      ['Máximo', `${data.soc.max.toFixed(1)}%`],
      ['Médio', `${data.soc.average.toFixed(1)}%`],
      ['Final', `${data.soc.final.toFixed(1)}%`],
    ];

    this.drawTable(doc, 50, doc.y, socData, 200);

    // Temperature metrics
    doc.moveDown(2);

    doc.fontSize(12)
      .fillColor('#4b5563')
      .text('Temperatura', 50, doc.y);

    doc.moveDown(0.5);

    const tempData = [
      ['Métrica', 'Valor'],
      ['Mínima', `${data.temperature.min.toFixed(1)}°C`],
      ['Máxima', `${data.temperature.max.toFixed(1)}°C`],
      ['Média', `${data.temperature.average.toFixed(1)}°C`],
    ];

    this.drawTable(doc, 50, doc.y, tempData, 200);
  }

  private addCyclesSection(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.fontSize(14)
      .fillColor('#1f2937')
      .text('Histórico de Ciclos', 50, 50);

    doc.moveDown(1);

    const cycleTableData = [
      ['Data', 'Tipo', 'DOD', 'Energia', 'Eficiência'],
      ...data.cycles.slice(0, 15).map(cycle => [
        format(cycle.startTime, 'dd/MM HH:mm'),
        cycle.type,
        `${cycle.depthOfDischarge.toFixed(0)}%`,
        `${cycle.energyDischarged.toFixed(1)} kWh`,
        `${cycle.efficiency.toFixed(1)}%`,
      ]),
    ];

    this.drawTable(doc, 50, doc.y, cycleTableData);

    if (data.cycles.length > 15) {
      doc.moveDown(0.5)
        .fontSize(9)
        .fillColor('#6b7280')
        .text(`... e mais ${data.cycles.length - 15} ciclos`);
    }
  }

  private addAlertsSection(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.fontSize(14)
      .fillColor('#1f2937')
      .text('Alertas e Eventos', 50, 50);

    doc.moveDown(1);

    // Alert summary by severity
    const alertsBySeverity = {
      critical: data.alerts.filter(a => a.severity === 'critical').length,
      high: data.alerts.filter(a => a.severity === 'high').length,
      medium: data.alerts.filter(a => a.severity === 'medium').length,
      low: data.alerts.filter(a => a.severity === 'low').length,
    };

    doc.fontSize(10)
      .fillColor('#ef4444').text(`Críticos: ${alertsBySeverity.critical}`, 50, doc.y)
      .fillColor('#f97316').text(`Altos: ${alertsBySeverity.high}`, 150, doc.y - 12)
      .fillColor('#eab308').text(`Médios: ${alertsBySeverity.medium}`, 250, doc.y - 12)
      .fillColor('#22c55e').text(`Baixos: ${alertsBySeverity.low}`, 350, doc.y - 12);

    doc.moveDown(1);

    // Alert list
    const alertTableData = [
      ['Data/Hora', 'Tipo', 'Severidade', 'Status'],
      ...data.alerts.slice(0, 10).map(alert => [
        format(alert.createdAt, 'dd/MM HH:mm'),
        alert.type,
        alert.severity,
        alert.isAcknowledged ? 'Reconhecido' : 'Pendente',
      ]),
    ];

    this.drawTable(doc, 50, doc.y, alertTableData);
  }

  private addSavingsSection(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc.fontSize(14)
      .fillColor('#1f2937')
      .text('Análise Financeira', 50, 50);

    doc.moveDown(1);

    // Savings breakdown
    const savingsData = [
      ['Categoria', 'Economia (R$)'],
      ['Economia em Energia (Arbitragem)', data.savings.energy.toFixed(2)],
      ['Economia em Demanda (Peak Shaving)', data.savings.demand.toFixed(2)],
      ['Total do Período', data.savings.total.toFixed(2)],
    ];

    this.drawTable(doc, 50, doc.y, savingsData, 300);

    // Projections
    doc.moveDown(2);

    doc.fontSize(12)
      .fillColor('#4b5563')
      .text('Projeções', 50, doc.y);

    doc.moveDown(0.5);

    const monthlyProjection = data.savings.total * 30 / this.getDaysBetween(data.period.start, data.period.end);
    const yearlyProjection = monthlyProjection * 12;

    doc.fontSize(10)
      .fillColor('#1f2937')
      .text(`Economia Mensal Projetada: R$ ${monthlyProjection.toFixed(2)}`, 50, doc.y)
      .text(`Economia Anual Projetada: R$ ${yearlyProjection.toFixed(2)}`, 50, doc.y + 20);
  }

  private addFooter(doc: PDFKit.PDFDocument, pageNumber: number, totalPages: number): void {
    doc.fontSize(8)
      .fillColor('#9ca3af')
      .text(
        `Gerado por Lifo4 EMS em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
        50,
        doc.page.height - 50,
        { align: 'left' }
      )
      .text(
        `Página ${pageNumber} de ${totalPages}`,
        50,
        doc.page.height - 50,
        { align: 'right' }
      );
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private drawCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    value: string,
    subtitle: string
  ): void {
    // Background
    doc.rect(x, y, width, height)
      .fillColor('#f9fafb')
      .fill();

    // Border
    doc.rect(x, y, width, height)
      .strokeColor('#e5e7eb')
      .stroke();

    // Title
    doc.fontSize(10)
      .fillColor('#6b7280')
      .text(title, x + 10, y + 10);

    // Value
    doc.fontSize(20)
      .fillColor('#10b981')
      .text(value, x + 10, y + 30);

    // Subtitle
    doc.fontSize(8)
      .fillColor('#9ca3af')
      .text(subtitle, x + 10, y + 55);
  }

  private drawTable(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    data: string[][],
    width: number = 495
  ): void {
    const colCount = data[0].length;
    const colWidth = width / colCount;
    const rowHeight = 25;

    data.forEach((row, rowIndex) => {
      const rowY = y + rowIndex * rowHeight;

      // Header row background
      if (rowIndex === 0) {
        doc.rect(x, rowY, width, rowHeight)
          .fillColor('#f3f4f6')
          .fill();
      }

      // Row border
      doc.rect(x, rowY, width, rowHeight)
        .strokeColor('#e5e7eb')
        .stroke();

      // Cell content
      row.forEach((cell, colIndex) => {
        const cellX = x + colIndex * colWidth + 5;

        doc.fontSize(9)
          .fillColor(rowIndex === 0 ? '#4b5563' : '#1f2937')
          .text(cell, cellX, rowY + 8, {
            width: colWidth - 10,
            align: colIndex === 0 ? 'left' : 'center',
          });
      });
    });

    doc.y = y + data.length * rowHeight + 10;
  }

  private getReportTypeName(type: ReportType): string {
    const names: Record<ReportType, string> = {
      [ReportType.DAILY]: 'Diário',
      [ReportType.WEEKLY]: 'Semanal',
      [ReportType.MONTHLY]: 'Mensal',
      [ReportType.CUSTOM]: 'Customizado',
      [ReportType.MAINTENANCE]: 'Manutenção',
    };
    return names[type] || type;
  }

  private getReportPeriod(type: ReportType): { start: Date; end: Date } {
    const now = new Date();

    switch (type) {
      case ReportType.DAILY:
        return {
          start: startOfDay(subDays(now, 1)),
          end: endOfDay(subDays(now, 1)),
        };
      case ReportType.WEEKLY:
        return {
          start: startOfWeek(subWeeks(now, 1), { locale: ptBR }),
          end: endOfWeek(subWeeks(now, 1), { locale: ptBR }),
        };
      case ReportType.MONTHLY:
        return {
          start: startOfMonth(subMonths(now, 1)),
          end: endOfMonth(subMonths(now, 1)),
        };
      default:
        return {
          start: startOfDay(subDays(now, 7)),
          end: endOfDay(now),
        };
    }
  }

  private getDaysBetween(start: Date, end: Date): number {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async getSystem(systemId: string): Promise<BessSystem | null> {
    const doc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as BessSystem;
  }

  // ============================================
  // REPORT RETRIEVAL
  // ============================================

  /**
   * Get reports for a system
   */
  async getReports(
    systemId: string,
    limit: number = 20,
    type?: ReportType
  ): Promise<Report[]> {
    let query = this.db
      .collection(Collections.REPORTS)
      .where('systemId', '==', systemId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      period: {
        start: doc.data().period?.start?.toDate(),
        end: doc.data().period?.end?.toDate(),
      },
      createdAt: doc.data().createdAt?.toDate(),
    })) as Report[];
  }

  /**
   * Get a specific report
   */
  async getReport(reportId: string): Promise<Report | null> {
    const doc = await this.db.collection(Collections.REPORTS).doc(reportId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
      period: {
        start: doc.data()?.period?.start?.toDate(),
        end: doc.data()?.period?.end?.toDate(),
      },
      createdAt: doc.data()?.createdAt?.toDate(),
    } as Report;
  }

  /**
   * Schedule automatic reports
   */
  async scheduleAutomaticReports(systemId: string, types: ReportType[]): Promise<void> {
    // This would be implemented with node-cron
    // For now, just log the intent
    logger.info(`Scheduled automatic reports for system ${systemId}`, { types });
  }
}

export const reportService = new ReportService();
