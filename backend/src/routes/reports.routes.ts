/**
 * Advanced Reports Routes
 * API endpoints for comprehensive reporting
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  advancedReportService,
  ReportType,
  ExportFormat
} from '../services/reports/advanced-report.service';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * @route POST /api/reports/generate
 * @desc Generate a new report
 */
router.post(
  '/generate',
  body('type').isIn(Object.values(ReportType)),
  body('title').isString().isLength({ min: 1, max: 100 }),
  body('systemIds').isArray({ min: 1 }),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('format').optional().isIn(Object.values(ExportFormat)),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { type, title, systemIds, startDate, endDate, format, options } = req.body;

      const report = await advancedReportService.generateReport(userId, {
        type,
        title,
        systemIds,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        format: format || ExportFormat.PDF,
        options
      });

      res.status(202).json({
        success: true,
        report,
        message: 'Report generation started'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/reports/:id
 * @desc Get report status and details
 */
router.get(
  '/:id',
  param('id').isString(),
  async (req: Request, res: Response) => {
    try {
      const report = await advancedReportService.getReport(req.params.id);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/reports
 * @desc List user's reports
 */
router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const limit = parseInt(req.query.limit as string) || 20;

      const reports = await advancedReportService.listReports(userId, limit);

      res.json({
        count: reports.length,
        reports
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route POST /api/reports/schedule
 * @desc Schedule a recurring report
 */
router.post(
  '/schedule',
  body('type').isIn(Object.values(ReportType)),
  body('title').isString().isLength({ min: 1, max: 100 }),
  body('systemIds').isArray({ min: 1 }),
  body('format').optional().isIn(Object.values(ExportFormat)),
  body('schedule.frequency').isIn(['daily', 'weekly', 'monthly']),
  body('schedule.hour').isInt({ min: 0, max: 23 }),
  body('schedule.timezone').isString(),
  body('schedule.dayOfWeek').optional().isInt({ min: 0, max: 6 }),
  body('schedule.dayOfMonth').optional().isInt({ min: 1, max: 28 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { type, title, systemIds, format, schedule } = req.body;

      // Calculate date range based on frequency
      const endDate = new Date();
      const startDate = new Date();

      if (schedule.frequency === 'daily') {
        startDate.setDate(startDate.getDate() - 1);
      } else if (schedule.frequency === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const scheduleId = await advancedReportService.scheduleReport(
        userId,
        {
          type,
          title,
          systemIds,
          startDate,
          endDate,
          format: format || ExportFormat.PDF
        },
        schedule
      );

      res.json({
        success: true,
        scheduleId,
        message: 'Report scheduled successfully'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/reports/types
 * @desc Get available report types
 */
router.get('/meta/types', (req: Request, res: Response) => {
  res.json({
    types: [
      {
        id: ReportType.DAILY_SUMMARY,
        name: 'Resumo Diário',
        description: 'Resumo diário de operação do BESS'
      },
      {
        id: ReportType.WEEKLY_SUMMARY,
        name: 'Resumo Semanal',
        description: 'Resumo semanal agregado por semana'
      },
      {
        id: ReportType.MONTHLY_SUMMARY,
        name: 'Resumo Mensal',
        description: 'Resumo mensal com métricas agregadas'
      },
      {
        id: ReportType.PERFORMANCE_ANALYSIS,
        name: 'Análise de Performance',
        description: 'Análise detalhada de desempenho do sistema'
      },
      {
        id: ReportType.DEGRADATION_REPORT,
        name: 'Relatório de Degradação',
        description: 'Análise de degradação e projeções de vida útil'
      },
      {
        id: ReportType.FINANCIAL_REPORT,
        name: 'Relatório Financeiro',
        description: 'Análise de receitas, economias e custos'
      },
      {
        id: ReportType.MAINTENANCE_REPORT,
        name: 'Relatório de Manutenção',
        description: 'Histórico e planejamento de manutenções'
      },
      {
        id: ReportType.ALARM_HISTORY,
        name: 'Histórico de Alarmes',
        description: 'Histórico completo de alarmes e eventos'
      },
      {
        id: ReportType.EFFICIENCY_ANALYSIS,
        name: 'Análise de Eficiência',
        description: 'Análise detalhada de eficiência por condições'
      }
    ],
    formats: [
      { id: ExportFormat.PDF, name: 'PDF', extension: 'pdf' },
      { id: ExportFormat.EXCEL, name: 'Excel', extension: 'xlsx' },
      { id: ExportFormat.CSV, name: 'CSV', extension: 'csv' },
      { id: ExportFormat.JSON, name: 'JSON', extension: 'json' }
    ]
  });
});

/**
 * @route POST /api/reports/quick/daily
 * @desc Generate quick daily report
 */
router.post(
  '/quick/daily',
  body('systemIds').isArray({ min: 1 }),
  body('date').optional().isISO8601(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { systemIds, date } = req.body;

      const targetDate = date ? new Date(date) : new Date();
      const startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      const report = await advancedReportService.generateReport(userId, {
        type: ReportType.DAILY_SUMMARY,
        title: `Resumo Diário - ${targetDate.toLocaleDateString('pt-BR')}`,
        systemIds,
        startDate,
        endDate,
        format: ExportFormat.PDF
      });

      res.status(202).json({
        success: true,
        report,
        message: 'Daily report generation started'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route POST /api/reports/quick/performance
 * @desc Generate quick performance report for last 30 days
 */
router.post(
  '/quick/performance',
  body('systemIds').isArray({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { systemIds } = req.body;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const report = await advancedReportService.generateReport(userId, {
        type: ReportType.PERFORMANCE_ANALYSIS,
        title: `Análise de Performance - Últimos 30 dias`,
        systemIds,
        startDate,
        endDate,
        format: ExportFormat.PDF
      });

      res.status(202).json({
        success: true,
        report,
        message: 'Performance report generation started'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route POST /api/reports/quick/financial
 * @desc Generate quick financial report for current month
 */
router.post(
  '/quick/financial',
  body('systemIds').isArray({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.uid;
      const { systemIds } = req.body;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const report = await advancedReportService.generateReport(userId, {
        type: ReportType.FINANCIAL_REPORT,
        title: `Relatório Financeiro - ${startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        systemIds,
        startDate,
        endDate,
        format: ExportFormat.EXCEL
      });

      res.status(202).json({
        success: true,
        report,
        message: 'Financial report generation started'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @route GET /api/reports/download/:id
 * @desc Download report file (placeholder - would serve from storage)
 */
router.get(
  '/download/:id',
  param('id').isString(),
  async (req: Request, res: Response) => {
    try {
      const report = await advancedReportService.getReport(req.params.id.split('.')[0]);

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      if (report.status !== 'completed') {
        return res.status(400).json({
          error: 'Report not ready',
          status: report.status
        });
      }

      // In production, this would redirect to or stream from cloud storage
      res.json({
        message: 'Download redirect placeholder',
        reportId: report.id,
        url: report.downloadUrl
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
