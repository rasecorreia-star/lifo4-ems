/**
 * Prospect Analysis Service for Lifo4 EMS
 * Pre-sales analysis system with BESS dimensioning and proposal generation
 */

import { db, Collections } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import {
  Prospect,
  ProspectContact,
  ProspectCompany,
  ProspectAnalysis,
  ProspectNote,
  ProspectActivity,
  AnalyzerKit,
  AnalyzerKitStatus,
  AnalyzerStatus,
  PipelineStage,
  Proposal,
  ProposalStatus,
  SystemRecommendation,
  LoadProfile,
  DemandAnalysis,
  TariffAnalysis,
  EnergyOpportunities,
  SalesStatistics,
  ActivityType,
  CompanySegment,
} from '../models/prospect.types.js';

export class ProspectService {
  private db = db;

  // ============================================
  // PROSPECT CRUD
  // ============================================

  async createProspect(
    organizationId: string,
    contact: ProspectContact,
    company: ProspectCompany,
    assignedTo?: string
  ): Promise<Prospect> {
    const now = new Date();

    const prospect: Omit<Prospect, 'id'> = {
      organizationId,
      contact,
      company,
      analyzerStatus: AnalyzerStatus.NOT_ASSIGNED,
      pipeline: PipelineStage.LEAD,
      assignedTo,
      proposals: [],
      notes: [],
      activities: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection(Collections.PROSPECTS).add(prospect);

    // Log initial activity
    await this.addActivity(docRef.id, {
      type: ActivityType.OTHER,
      title: 'Prospect created',
      description: `New prospect created for ${company.name}`,
    }, 'system');

    logger.info(`Prospect created: ${docRef.id}`, { organizationId, company: company.name });

    return { id: docRef.id, ...prospect };
  }

  async getProspect(id: string): Promise<Prospect | null> {
    const doc = await this.db.collection(Collections.PROSPECTS).doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      lastContactDate: data.lastContactDate?.toDate(),
      expectedCloseDate: data.expectedCloseDate?.toDate(),
      convertedToCustomerAt: data.convertedToCustomerAt?.toDate(),
    } as Prospect;
  }

  async getProspectsByOrganization(organizationId: string, stage?: PipelineStage): Promise<Prospect[]> {
    let query = this.db.collection(Collections.PROSPECTS).where('organizationId', '==', organizationId);

    if (stage) {
      query = query.where('pipeline', '==', stage);
    }

    const snapshot = await query.orderBy('updatedAt', 'desc').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Prospect[];
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
    const ref = this.db.collection(Collections.PROSPECTS).doc(id);
    const doc = await ref.get();

    if (!doc.exists) throw new NotFoundError('Prospect');

    await ref.update({
      ...updates,
      updatedAt: new Date(),
    });

    const updated = await this.getProspect(id);
    if (!updated) throw new NotFoundError('Prospect');

    return updated;
  }

  async updatePipelineStage(id: string, stage: PipelineStage, userId: string): Promise<Prospect> {
    const prospect = await this.getProspect(id);
    if (!prospect) throw new NotFoundError('Prospect');

    const previousStage = prospect.pipeline;

    const updates: Partial<Prospect> = {
      pipeline: stage,
      lastContactDate: new Date(),
    };

    if (stage === PipelineStage.WON) {
      updates.convertedToCustomerAt = new Date();
    }

    await this.updateProspect(id, updates);

    await this.addActivity(id, {
      type: ActivityType.OTHER,
      title: `Pipeline stage changed`,
      description: `Changed from ${previousStage} to ${stage}`,
    }, userId);

    logger.info(`Prospect stage updated: ${id}`, { previousStage, newStage: stage });

    return (await this.getProspect(id))!;
  }

  // ============================================
  // ANALYZER KIT MANAGEMENT
  // ============================================

  async createAnalyzerKit(data: Omit<AnalyzerKit, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnalyzerKit> {
    const now = new Date();

    const kit: Omit<AnalyzerKit, 'id'> = {
      ...data,
      status: AnalyzerKitStatus.AVAILABLE,
      measurementInterval: data.measurementInterval || 60,
      reportingInterval: data.reportingInterval || 300,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection('analyzer_kits').add(kit);

    logger.info(`Analyzer kit created: ${docRef.id}`, { serialNumber: data.serialNumber });

    return { id: docRef.id, ...kit };
  }

  async getAnalyzerKit(id: string): Promise<AnalyzerKit | null> {
    const doc = await this.db.collection('analyzer_kits').doc(id).get();
    if (!doc.exists) return null;

    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
      installationDate: doc.data()?.installationDate?.toDate(),
      expectedRemovalDate: doc.data()?.expectedRemovalDate?.toDate(),
      lastSeen: doc.data()?.lastSeen?.toDate(),
    } as AnalyzerKit;
  }

  async getAvailableAnalyzers(): Promise<AnalyzerKit[]> {
    const snapshot = await this.db.collection('analyzer_kits')
      .where('status', '==', AnalyzerKitStatus.AVAILABLE)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as AnalyzerKit[];
  }

  async assignAnalyzerToProspect(analyzerId: string, prospectId: string, expectedDays: number = 14): Promise<void> {
    const analyzer = await this.getAnalyzerKit(analyzerId);
    if (!analyzer) throw new NotFoundError('Analyzer Kit');

    if (analyzer.status !== AnalyzerKitStatus.AVAILABLE) {
      throw new BadRequestError('Analyzer kit is not available');
    }

    const prospect = await this.getProspect(prospectId);
    if (!prospect) throw new NotFoundError('Prospect');

    const now = new Date();
    const expectedRemovalDate = new Date(now.getTime() + expectedDays * 24 * 60 * 60 * 1000);

    // Update analyzer
    await this.db.collection('analyzer_kits').doc(analyzerId).update({
      status: AnalyzerKitStatus.ASSIGNED,
      currentProspectId: prospectId,
      installationDate: now,
      expectedRemovalDate,
      updatedAt: now,
    });

    // Update prospect
    await this.updateProspect(prospectId, {
      analyzerId,
      analyzerStatus: AnalyzerStatus.PENDING_INSTALLATION,
      pipeline: PipelineStage.ANALYSIS,
    });

    await this.addActivity(prospectId, {
      type: ActivityType.ANALYZER_INSTALLATION,
      title: 'Analyzer kit assigned',
      description: `Kit ${analyzer.serialNumber} assigned for ${expectedDays} days`,
    }, 'system');

    logger.info(`Analyzer assigned: ${analyzerId} to ${prospectId}`);
  }

  async markAnalyzerInstalled(prospectId: string): Promise<void> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect || !prospect.analyzerId) {
      throw new NotFoundError('Prospect or Analyzer');
    }

    await this.db.collection('analyzer_kits').doc(prospect.analyzerId).update({
      status: AnalyzerKitStatus.INSTALLED,
      updatedAt: new Date(),
    });

    await this.updateProspect(prospectId, {
      analyzerStatus: AnalyzerStatus.INSTALLED,
    });

    // Create analysis record
    await this.createAnalysis(prospectId, prospect.analyzerId);

    logger.info(`Analyzer marked as installed: ${prospect.analyzerId}`);
  }

  async startMeasurement(prospectId: string): Promise<void> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect || !prospect.analyzerId) {
      throw new NotFoundError('Prospect or Analyzer');
    }

    await this.db.collection('analyzer_kits').doc(prospect.analyzerId).update({
      status: AnalyzerKitStatus.MEASURING,
      updatedAt: new Date(),
    });

    await this.updateProspect(prospectId, {
      analyzerStatus: AnalyzerStatus.MEASURING,
    });

    // Update analysis start date
    if (prospect.analysis?.id) {
      await this.db.collection('prospect_analyses').doc(prospect.analysis.id).update({
        startDate: new Date(),
        status: 'collecting',
        updatedAt: new Date(),
      });
    }

    logger.info(`Measurement started: ${prospect.analyzerId}`);
  }

  async removeAnalyzer(prospectId: string): Promise<void> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect || !prospect.analyzerId) {
      throw new NotFoundError('Prospect or Analyzer');
    }

    // Make analyzer available again
    await this.db.collection('analyzer_kits').doc(prospect.analyzerId).update({
      status: AnalyzerKitStatus.AVAILABLE,
      currentProspectId: null,
      installationDate: null,
      expectedRemovalDate: null,
      updatedAt: new Date(),
    });

    await this.updateProspect(prospectId, {
      analyzerStatus: AnalyzerStatus.REMOVED,
    });

    await this.addActivity(prospectId, {
      type: ActivityType.ANALYZER_REMOVAL,
      title: 'Analyzer kit removed',
      description: 'Measurement period completed',
    }, 'system');

    logger.info(`Analyzer removed from prospect: ${prospectId}`);
  }

  // ============================================
  // ANALYSIS
  // ============================================

  private async createAnalysis(prospectId: string, analyzerId: string): Promise<ProspectAnalysis> {
    const now = new Date();

    const analysis: Omit<ProspectAnalysis, 'id'> = {
      prospectId,
      analyzerId,
      startDate: now,
      measurementDays: 0,
      rawDataSummary: {
        totalDataPoints: 0,
        missingDataPoints: 0,
        dataCompleteness: 0,
        totalEnergyImport: 0,
        totalEnergyExport: 0,
        peakDemand: 0,
        peakDemandTimestamp: now,
        averagePower: 0,
        minPower: 0,
        averagePowerFactor: 1,
        minPowerFactor: 1,
        averageVoltage: 220,
        minVoltage: 200,
        maxVoltage: 240,
        voltageDeviations: 0,
        averageFrequency: 60,
        frequencyDeviations: 0,
      },
      loadProfile: {
        hourlyAverage: new Array(24).fill(0),
        hourlyMax: new Array(24).fill(0),
        hourlyMin: new Array(24).fill(0),
        dailyAverage: new Array(7).fill(0),
        dailyTotal: new Array(7).fill(0),
        projectedMonthlyConsumption: 0,
        projectedMonthlyDemand: 0,
        weekdayProfile: new Array(24).fill(0),
        weekendProfile: new Array(24).fill(0),
      },
      demandAnalysis: {
        measuredPeakDemand: 0,
        averageDemand: 0,
        loadFactor: 0,
        peakHours: [17, 18, 19, 20, 21],
        offPeakHours: [0, 1, 2, 3, 4, 5, 6],
        peakShavingPotential: 0,
        demandReductionSavings: 0,
      },
      tariffAnalysis: {
        currentMonthlyCost: 0,
        energyCost: 0,
        demandCost: 0,
        reactiveEnergyCost: 0,
        otherCharges: 0,
        peakEnergyCost: 0,
        offPeakEnergyCost: 0,
        peakConsumption: 0,
        offPeakConsumption: 0,
        peakPercentage: 0,
        arbitrageSavingsPotential: 0,
        demandSavingsPotential: 0,
        powerFactorSavingsPotential: 0,
      },
      qualityAnalysis: {
        averageVoltage: 220,
        voltageImbalance: 0,
        voltageDeviation: 0,
        voltageEvents: [],
        averagePowerFactor: 0.95,
        belowMinimumEvents: 0,
        reactiveEnergyImported: 0,
        harmonicsIssues: false,
      },
      patterns: {
        loadType: 'variable',
        predictability: 0,
        weekdayWeekendRatio: 1,
        hasSeasonality: false,
        anomalies: [],
      },
      opportunities: {
        peakShaving: { potential: 0, savings: 0, requiredBessSize: 0 },
        arbitrage: { potential: 0, savings: 0, requiredBessSize: 0 },
        solar: { estimatedGeneration: 0, selfConsumptionPotential: 0, exportPotential: 0, recommendedSize: 0 },
        backup: { criticalLoadEstimate: 0, backupHoursNeeded: 4, requiredBessSize: 0 },
        totalMonthlySavings: 0,
        totalAnnualSavings: 0,
      },
      recommendations: [],
      status: 'collecting',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection('prospect_analyses').add(analysis);

    // Link analysis to prospect
    await this.updateProspect(prospectId, { analysis: { id: docRef.id, ...analysis } as any });

    logger.info(`Analysis created: ${docRef.id}`, { prospectId, analyzerId });

    return { id: docRef.id, ...analysis };
  }

  async processAnalysisData(prospectId: string): Promise<ProspectAnalysis> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect || !prospect.analysis) {
      throw new NotFoundError('Prospect or Analysis');
    }

    const analysisRef = this.db.collection('prospect_analyses').doc(prospect.analysis.id);

    // Update status
    await analysisRef.update({
      status: 'processing',
      processingProgress: 0,
      updatedAt: new Date(),
    });

    try {
      // Fetch raw telemetry data
      const rawData = await this.fetchAnalyzerData(prospect.analyzerId!, prospect.analysis.startDate);

      // Process load profile
      const loadProfile = this.calculateLoadProfile(rawData);
      await analysisRef.update({ loadProfile, processingProgress: 25 });

      // Process demand analysis
      const demandAnalysis = this.calculateDemandAnalysis(rawData, prospect.company);
      await analysisRef.update({ demandAnalysis, processingProgress: 50 });

      // Process tariff analysis
      const tariffAnalysis = this.calculateTariffAnalysis(rawData, prospect.company, loadProfile);
      await analysisRef.update({ tariffAnalysis, processingProgress: 75 });

      // Generate opportunities
      const opportunities = this.calculateOpportunities(loadProfile, demandAnalysis, tariffAnalysis, prospect.company);
      await analysisRef.update({ opportunities, processingProgress: 90 });

      // Generate recommendations
      const recommendations = this.generateRecommendations(opportunities, prospect.company);

      // Complete analysis
      await analysisRef.update({
        recommendations,
        status: 'completed',
        processingProgress: 100,
        endDate: new Date(),
        updatedAt: new Date(),
      });

      // Update prospect
      await this.updateProspect(prospectId, {
        analyzerStatus: AnalyzerStatus.COMPLETED,
        pipeline: PipelineStage.PROPOSAL,
      });

      logger.info(`Analysis completed: ${prospect.analysis.id}`);

      const completed = await analysisRef.get();
      return { id: completed.id, ...completed.data() } as ProspectAnalysis;
    } catch (error) {
      await analysisRef.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      });
      throw error;
    }
  }

  private async fetchAnalyzerData(analyzerId: string, startDate: Date): Promise<any[]> {
    // In production, fetch from TimescaleDB or Firestore telemetry
    const snapshot = await this.db.collection('analyzer_telemetry')
      .where('analyzerId', '==', analyzerId)
      .where('timestamp', '>=', startDate)
      .orderBy('timestamp', 'asc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  private calculateLoadProfile(rawData: any[]): LoadProfile {
    const hourlyData: number[][] = Array.from({ length: 24 }, () => []);
    const dailyData: number[][] = Array.from({ length: 7 }, () => []);

    for (const point of rawData) {
      const date = point.timestamp?.toDate?.() || new Date(point.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      const power = point.activePower || 0;

      hourlyData[hour].push(power);
      dailyData[day].push(power);
    }

    const hourlyAverage = hourlyData.map(h => h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0);
    const hourlyMax = hourlyData.map(h => h.length ? Math.max(...h) : 0);
    const hourlyMin = hourlyData.map(h => h.length ? Math.min(...h) : 0);

    const dailyAverage = dailyData.map(d => d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0);
    const dailyTotal = dailyData.map(d => d.reduce((a, b) => a + b, 0) / 60); // kWh assuming 1-minute data

    // Calculate weekday/weekend profiles
    const weekdayHours: number[][] = Array.from({ length: 24 }, () => []);
    const weekendHours: number[][] = Array.from({ length: 24 }, () => []);

    for (const point of rawData) {
      const date = point.timestamp?.toDate?.() || new Date(point.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      const power = point.activePower || 0;

      if (day === 0 || day === 6) {
        weekendHours[hour].push(power);
      } else {
        weekdayHours[hour].push(power);
      }
    }

    const weekdayProfile = weekdayHours.map(h => h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0);
    const weekendProfile = weekendHours.map(h => h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0);

    return {
      hourlyAverage,
      hourlyMax,
      hourlyMin,
      dailyAverage,
      dailyTotal,
      projectedMonthlyConsumption: dailyTotal.reduce((a, b) => a + b, 0) * 4.33,
      projectedMonthlyDemand: Math.max(...hourlyMax),
      weekdayProfile,
      weekendProfile,
    };
  }

  private calculateDemandAnalysis(rawData: any[], company: ProspectCompany): DemandAnalysis {
    const powers = rawData.map(p => p.activePower || 0);
    const peakDemand = powers.length ? Math.max(...powers) : 0;
    const averageDemand = powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : 0;

    return {
      measuredPeakDemand: peakDemand,
      averageDemand,
      loadFactor: peakDemand > 0 ? (averageDemand / peakDemand) * 100 : 0,
      contractedDemand: company.contractedDemand,
      demandUtilization: company.contractedDemand ? (peakDemand / company.contractedDemand) * 100 : undefined,
      peakHours: [17, 18, 19, 20, 21],
      offPeakHours: [0, 1, 2, 3, 4, 5, 6, 22, 23],
      peakShavingPotential: peakDemand - averageDemand,
      demandReductionSavings: (peakDemand - averageDemand) * 30, // R$/kW estimate
    };
  }

  private calculateTariffAnalysis(rawData: any[], company: ProspectCompany, loadProfile: LoadProfile): TariffAnalysis {
    // Simplified tariff calculation for Brazil
    const peakHours = [17, 18, 19, 20, 21]; // Typical peak hours
    const monthlyConsumption = loadProfile.projectedMonthlyConsumption;

    // Calculate peak vs off-peak consumption
    let peakConsumption = 0;
    let offPeakConsumption = 0;

    loadProfile.hourlyAverage.forEach((power, hour) => {
      const hourlyEnergy = power * 30; // kWh per month for this hour
      if (peakHours.includes(hour)) {
        peakConsumption += hourlyEnergy;
      } else {
        offPeakConsumption += hourlyEnergy;
      }
    });

    // Tariff rates (approximate for Piauí)
    const peakRate = 0.95; // R$/kWh
    const offPeakRate = 0.55; // R$/kWh
    const demandRate = 35; // R$/kW

    const energyCost = peakConsumption * peakRate + offPeakConsumption * offPeakRate;
    const demandCost = (company.peakDemand || loadProfile.projectedMonthlyDemand) * demandRate;

    return {
      currentMonthlyCost: energyCost + demandCost,
      energyCost,
      demandCost,
      reactiveEnergyCost: 0,
      otherCharges: energyCost * 0.3, // Approximate taxes and fees
      peakEnergyCost: peakConsumption * peakRate,
      offPeakEnergyCost: offPeakConsumption * offPeakRate,
      peakConsumption,
      offPeakConsumption,
      peakPercentage: monthlyConsumption > 0 ? (peakConsumption / monthlyConsumption) * 100 : 0,
      arbitrageSavingsPotential: peakConsumption * (peakRate - offPeakRate) * 0.5,
      demandSavingsPotential: demandCost * 0.2,
      powerFactorSavingsPotential: 0,
    };
  }

  private calculateOpportunities(
    loadProfile: LoadProfile,
    demandAnalysis: DemandAnalysis,
    tariffAnalysis: TariffAnalysis,
    company: ProspectCompany
  ): EnergyOpportunities {
    // Peak shaving opportunity
    const peakShavingPotential = demandAnalysis.peakShavingPotential;
    const peakShavingSavings = peakShavingPotential * 30; // R$/month
    const peakShavingBessSize = peakShavingPotential * 4; // 4 hours of peak

    // Arbitrage opportunity
    const arbitragePotential = tariffAnalysis.peakConsumption * 0.5; // 50% shiftable
    const arbitrageSavings = tariffAnalysis.arbitrageSavingsPotential;
    const arbitrageBessSize = arbitragePotential / 30; // kWh

    // Solar opportunity (based on available area)
    const availableArea = company.availableArea || 100;
    const solarSize = availableArea * 0.15; // kWp per m²
    const solarGeneration = solarSize * 150; // 150 kWh/kWp/month in Teresina
    const selfConsumptionPotential = Math.min(solarGeneration / loadProfile.projectedMonthlyConsumption * 100, 100);

    // Backup opportunity
    const criticalLoad = demandAnalysis.averageDemand * 0.3; // 30% critical
    const backupHours = 4;
    const backupBessSize = criticalLoad * backupHours;

    const totalMonthlySavings = peakShavingSavings + arbitrageSavings;

    return {
      peakShaving: {
        potential: peakShavingPotential,
        savings: peakShavingSavings,
        requiredBessSize: peakShavingBessSize,
      },
      arbitrage: {
        potential: arbitragePotential,
        savings: arbitrageSavings,
        requiredBessSize: arbitrageBessSize,
      },
      solar: {
        estimatedGeneration: solarGeneration,
        selfConsumptionPotential,
        exportPotential: Math.max(0, solarGeneration - loadProfile.projectedMonthlyConsumption),
        recommendedSize: solarSize,
      },
      backup: {
        criticalLoadEstimate: criticalLoad,
        backupHoursNeeded: backupHours,
        requiredBessSize: backupBessSize,
      },
      totalMonthlySavings,
      totalAnnualSavings: totalMonthlySavings * 12,
    };
  }

  private generateRecommendations(opportunities: EnergyOpportunities, company: ProspectCompany): SystemRecommendation[] {
    const recommendations: SystemRecommendation[] = [];

    // Conservative option
    const conservativeBessSize = Math.max(
      opportunities.peakShaving.requiredBessSize,
      opportunities.backup.requiredBessSize
    );

    recommendations.push(this.createRecommendation(
      'conservative',
      'Basic BESS System',
      conservativeBessSize,
      conservativeBessSize / 4,
      undefined,
      'peak_shaving',
      opportunities
    ));

    // Recommended option
    const recommendedBessSize = conservativeBessSize * 1.5;
    const recommendedSolarSize = opportunities.solar.recommendedSize;

    recommendations.push(this.createRecommendation(
      'recommended',
      'Hybrid Solar + BESS',
      recommendedBessSize,
      recommendedBessSize / 4,
      recommendedSolarSize,
      'hybrid',
      opportunities,
      true
    ));

    // Premium option
    const premiumBessSize = recommendedBessSize * 2;
    const premiumSolarSize = recommendedSolarSize * 1.5;

    recommendations.push(this.createRecommendation(
      'premium',
      'Full Energy Independence',
      premiumBessSize,
      premiumBessSize / 4,
      premiumSolarSize,
      'self_consumption',
      opportunities
    ));

    return recommendations;
  }

  private createRecommendation(
    type: 'conservative' | 'recommended' | 'premium' | 'custom',
    name: string,
    bessSize: number,
    bessPower: number,
    solarSize: number | undefined,
    strategy: SystemRecommendation['strategy'],
    opportunities: EnergyOpportunities,
    isRecommended: boolean = false
  ): SystemRecommendation {
    // Equipment costs (approximate)
    const bessCostPerKwh = 1500; // R$/kWh
    const solarCostPerKwp = 3500; // R$/kWp

    const equipmentCost = bessSize * bessCostPerKwh + (solarSize || 0) * solarCostPerKwp;
    const installationCost = equipmentCost * 0.15;
    const totalCapex = equipmentCost + installationCost;

    // Calculate monthly savings based on strategy
    let monthlySavings = 0;
    switch (strategy) {
      case 'peak_shaving':
        monthlySavings = opportunities.peakShaving.savings;
        break;
      case 'arbitrage':
        monthlySavings = opportunities.arbitrage.savings;
        break;
      case 'hybrid':
        monthlySavings = opportunities.peakShaving.savings + opportunities.arbitrage.savings * 0.5;
        break;
      case 'self_consumption':
        monthlySavings = opportunities.totalMonthlySavings;
        break;
      case 'backup':
        monthlySavings = opportunities.peakShaving.savings * 0.5;
        break;
    }

    const annualSavings = monthlySavings * 12;
    const annualOpex = totalCapex * 0.02; // 2% maintenance
    const netAnnualSavings = annualSavings - annualOpex;

    const simplePayback = netAnnualSavings > 0 ? totalCapex / netAnnualSavings : 999;

    // Calculate NPV and IRR (simplified)
    const discountRate = 0.10;
    const lifetime = 10;
    let npv = -totalCapex;
    for (let year = 1; year <= lifetime; year++) {
      npv += netAnnualSavings / Math.pow(1 + discountRate, year);
    }

    const roi = lifetime > 0 ? ((netAnnualSavings * lifetime - totalCapex) / totalCapex) * 100 : 0;

    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      isRecommended,
      bessSize,
      bessPower,
      solarSize,
      strategy,
      strategyDescription: this.getStrategyDescription(strategy),
      financial: {
        equipmentCost,
        installationCost,
        totalCapex,
        annualOpex,
        monthlyEnergySavings: monthlySavings * 0.7,
        monthlyDemandSavings: monthlySavings * 0.3,
        totalMonthlySavings: monthlySavings,
        annualSavings,
        simplePayback,
        roi,
        irr: roi / lifetime,
        npv,
        lcoe: annualSavings > 0 ? totalCapex / (annualSavings * lifetime) : 0,
        cashFlow: this.generateCashFlow(totalCapex, annualSavings, annualOpex, lifetime),
      },
      environmental: {
        annualCo2Avoided: annualSavings / 100 * 0.5, // Approximate
        lifetimeCo2Avoided: annualSavings / 100 * 0.5 * lifetime,
        treesEquivalent: Math.round(annualSavings / 100 * 0.5 * lifetime / 0.02),
        carsOffRoad: Math.round(annualSavings / 100 * 0.5 / 4.6),
        renewableShare: solarSize ? Math.min(100, (solarSize * 150) / (opportunities.totalMonthlySavings * 10) * 100) : 0,
      },
      technical: {
        requiredArea: (solarSize || 0) / 0.15 + bessSize / 100,
        weightTotal: bessSize * 10 + (solarSize || 0) * 20,
        installationDays: Math.ceil((bessSize + (solarSize || 0)) / 50),
        expectedCycles: 250,
        expectedEfficiency: 92,
        expectedLifetime: 10,
        requiredGridUpgrade: bessPower > 100,
      },
    };
  }

  private getStrategyDescription(strategy: string): string {
    const descriptions: Record<string, string> = {
      peak_shaving: 'Reduce demand charges by storing off-peak energy and using during peak hours',
      arbitrage: 'Buy low, sell high - charge during off-peak tariffs and discharge during peak',
      self_consumption: 'Maximize use of solar generation, minimize grid dependency',
      backup: 'Provide backup power during grid outages',
      hybrid: 'Combine peak shaving, arbitrage, and self-consumption strategies',
    };
    return descriptions[strategy] || '';
  }

  private generateCashFlow(capex: number, annualSavings: number, annualOpex: number, years: number): any[] {
    const cashFlow = [];
    let cumulative = -capex;

    for (let year = 1; year <= years; year++) {
      const netCashFlow = annualSavings - annualOpex;
      cumulative += netCashFlow;
      cashFlow.push({
        year,
        savings: annualSavings,
        opex: annualOpex,
        netCashFlow,
        cumulativeCashFlow: cumulative,
      });
    }

    return cashFlow;
  }

  // ============================================
  // PROPOSALS
  // ============================================

  async createProposal(
    prospectId: string,
    recommendationId: string,
    createdBy: string,
    customizations?: any
  ): Promise<Proposal> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect) throw new NotFoundError('Prospect');

    const recommendation = prospect.analysis?.recommendations.find(r => r.id === recommendationId);
    if (!recommendation) throw new NotFoundError('Recommendation');

    const now = new Date();
    const version = prospect.proposals.length + 1;

    const proposal: Proposal = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prospectId,
      version,
      name: `Proposta v${version} - ${recommendation.name}`,
      recommendationId,
      recommendation,
      customizations,
      pricing: {
        equipmentPrice: recommendation.financial.equipmentCost,
        installationPrice: recommendation.financial.installationCost,
        additionalServices: [],
        subtotal: recommendation.financial.totalCapex,
        total: recommendation.financial.totalCapex,
      },
      paymentTerms: {
        method: 'installments',
        installments: 12,
        installmentValue: recommendation.financial.totalCapex / 12,
      },
      warranty: {
        equipmentWarranty: 5,
        installationWarranty: 2,
        performanceGuarantee: '80% capacity for 10 years',
        maintenanceIncluded: true,
        maintenancePeriod: 2,
      },
      deliverySchedule: '30-45 dias após aprovação',
      status: ProposalStatus.DRAFT,
      createdAt: now,
      createdBy,
      updatedAt: now,
    };

    const proposals = [...prospect.proposals, proposal];
    await this.updateProspect(prospectId, { proposals });

    logger.info(`Proposal created: ${proposal.id}`, { prospectId, version });

    return proposal;
  }

  async sendProposal(prospectId: string, proposalId: string): Promise<Proposal> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect) throw new NotFoundError('Prospect');

    const proposalIndex = prospect.proposals.findIndex(p => p.id === proposalId);
    if (proposalIndex === -1) throw new NotFoundError('Proposal');

    const now = new Date();
    prospect.proposals[proposalIndex].status = ProposalStatus.SENT;
    prospect.proposals[proposalIndex].sentAt = now;
    prospect.proposals[proposalIndex].updatedAt = now;

    await this.updateProspect(prospectId, { proposals: prospect.proposals });

    await this.addActivity(prospectId, {
      type: ActivityType.PROPOSAL_SENT,
      title: 'Proposal sent',
      description: `Proposal v${prospect.proposals[proposalIndex].version} sent to client`,
    }, 'system');

    return prospect.proposals[proposalIndex];
  }

  // ============================================
  // NOTES & ACTIVITIES
  // ============================================

  async addNote(prospectId: string, content: string, userId: string, userName: string): Promise<ProspectNote> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect) throw new NotFoundError('Prospect');

    const note: ProspectNote = {
      id: `note_${Date.now()}`,
      prospectId,
      content,
      createdAt: new Date(),
      createdBy: userId,
      createdByName: userName,
      isPinned: false,
    };

    const notes = [...prospect.notes, note];
    await this.updateProspect(prospectId, { notes });

    return note;
  }

  async addActivity(
    prospectId: string,
    data: Partial<ProspectActivity>,
    createdBy: string
  ): Promise<ProspectActivity> {
    const prospect = await this.getProspect(prospectId);
    if (!prospect) throw new NotFoundError('Prospect');

    const activity: ProspectActivity = {
      id: `act_${Date.now()}`,
      prospectId,
      type: data.type || ActivityType.OTHER,
      title: data.title || '',
      description: data.description,
      scheduledAt: data.scheduledAt,
      completedAt: data.completedAt,
      assignedTo: data.assignedTo,
      assignedToName: data.assignedToName,
      outcome: data.outcome,
      outcomeNotes: data.outcomeNotes,
      createdAt: new Date(),
      createdBy,
    };

    const activities = [...prospect.activities, activity];
    await this.updateProspect(prospectId, { activities, lastContactDate: new Date() });

    return activity;
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getSalesStatistics(organizationId: string, startDate: Date, endDate: Date): Promise<SalesStatistics> {
    const prospects = await this.getProspectsByOrganization(organizationId);

    const filtered = prospects.filter(p =>
      p.createdAt >= startDate && p.createdAt <= endDate
    );

    const prospectsByStage = {} as Record<PipelineStage, number>;
    Object.values(PipelineStage).forEach(stage => {
      prospectsByStage[stage] = filtered.filter(p => p.pipeline === stage).length;
    });

    const won = filtered.filter(p => p.pipeline === PipelineStage.WON);
    const totalRevenue = won.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);

    const activitiesByType = {} as Record<ActivityType, number>;
    Object.values(ActivityType).forEach(type => {
      activitiesByType[type] = filtered.reduce((sum, p) =>
        sum + p.activities.filter(a => a.type === type).length, 0
      );
    });

    return {
      period: { start: startDate, end: endDate },
      totalProspects: filtered.length,
      prospectsByStage,
      conversionRate: filtered.length > 0 ? (won.length / filtered.length) * 100 : 0,
      averageSalesCycle: 30, // Placeholder
      conversionBySource: {},
      totalRevenue,
      averageDealSize: won.length > 0 ? totalRevenue / won.length : 0,
      revenueBySegment: {} as Record<CompanySegment, number>,
      totalActivities: filtered.reduce((sum, p) => sum + p.activities.length, 0),
      activitiesByType,
      analyzersDeployed: filtered.filter(p => p.analyzerStatus !== AnalyzerStatus.NOT_ASSIGNED).length,
      averageMeasurementDays: 14,
      proposalsSent: filtered.reduce((sum, p) => sum + p.proposals.filter(prop => prop.status !== ProposalStatus.DRAFT).length, 0),
      proposalsAccepted: filtered.reduce((sum, p) => sum + p.proposals.filter(prop => prop.status === ProposalStatus.ACCEPTED).length, 0),
      proposalAcceptanceRate: 0,
      performanceByRep: [],
    };
  }
}

export const prospectService = new ProspectService();
