/**
 * Financial Routes - Phase 7
 * Tax optimization and report generation endpoints
 */

import { Router, Request, Response } from 'express';
import { LegalTaxOptimizer, MonthlyOperationalData } from '../services/tax/LegalTaxOptimizer';
import { ReportGenerator } from '../services/reports/ReportGenerator';

const router = Router();
const taxOptimizer = new LegalTaxOptimizer();
const reportGenerator = new ReportGenerator();

// Default operational data helper
function defaultMonthData(systemId: string): MonthlyOperationalData {
  const now = new Date();
  return {
    systemId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    totalCyclesEquivalent: 45,
    avgDodPercent: 65,
    avgTemperatureCelsius: 32,
    participatedGridServices: true,
    participatedFrequencyRegulation: false,
    participatedDemandResponse: true,
    totalEnergyThroughputKwh: 9800,
    systemAcquisitionCostBrl: 350000,
    systemCapacityKwh: 200,
  };
}
/**
 * GET /api/v1/financial/:systemId/tax/optimization
 * Returns monthly tax optimization for the current month
 */
router.get('/:systemId/tax/optimization', (req: Request, res: Response) => {
  try {
    const { systemId } = req.params;
    const data = defaultMonthData(systemId);
    const result = taxOptimizer.calculateMonthlyOptimization(data);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * POST /api/v1/financial/:systemId/tax/optimization
 * Calculate tax optimization with provided operational data
 */
router.post('/:systemId/tax/optimization', (req: Request, res: Response) => {
  try {
    const { systemId } = req.params;
    const data: MonthlyOperationalData = { systemId, ...req.body };
    const result = taxOptimizer.calculateMonthlyOptimization(data);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
/**
 * GET /api/v1/financial/:systemId/reports/monthly?year=2026&month=2
 * Generate or fetch monthly report
 */
router.get('/:systemId/reports/monthly', (req: Request, res: Response) => {
  try {
    const { systemId } = req.params;
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const report = reportGenerator.generateMonthlyReport(systemId, year, month);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * GET /api/v1/financial/:systemId/depreciation/report
 * Generate full depreciation report (for accountant)
 */
router.get('/:systemId/depreciation/report', (req: Request, res: Response) => {
  try {
    const { systemId } = req.params;
    const data = defaultMonthData(systemId);
    const report = taxOptimizer.generateDepreciationReport(data, {
      description: 'Sistema BESS LiFePO4 200 kWh',
      acquisitionDate: '2024-08-01',
    });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
/**
 * GET /api/v1/financial/:systemId/roi
 * Quick ROI summary
 */
router.get('/:systemId/roi', (req: Request, res: Response) => {
  try {
    const { systemId } = req.params;
    const now = new Date();
    const report = reportGenerator.generateMonthlyReport(systemId, now.getFullYear(), now.getMonth() + 1);
    const { financial } = report;
    res.json({
      success: true,
      data: {
        systemId,
        currentMonthSavingBrl: financial.totalBenefitBrl,
        roiAccumulatedPercent: financial.roiAccumulatedPercent,
        paybackRemainingMonths: financial.paybackRemainingMonths,
        investmentCostBrl: financial.investmentCostBrl,
        breakdown: {
          peakShaving: financial.peakShavingSavingBrl,
          arbitrage: financial.arbitrageRevenueBrl,
          gridServices: financial.gridServicesRevenueBrl,
          taxSaving: financial.taxSavingBrl,
          chargingCost: -financial.energyCostForChargingBrl,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
