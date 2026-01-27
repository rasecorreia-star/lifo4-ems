/**
 * Fleet Management Service for Lifo4 EMS
 * Utility-scale fleet management with SLA tracking
 */

import { getFirestore, Collections } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import {
  Fleet,
  FleetStatus,
  FleetConfiguration,
  SLAConfiguration,
  SLAReport,
  SLAIncident,
  BulkOperation,
  BulkOperationType,
  BulkOperationStatus,
  BulkOperationResult,
  FleetAnalytics,
  SystemBenchmark,
  FirmwareVersion,
  FirmwareUpdate,
  FirmwareUpdateStatus,
  ConfigurationProfile,
  MaintenanceSchedule,
  MaintenanceStatus,
} from '../models/fleet.types.js';
import { BessSystem, SystemStatus, ConnectionStatus } from '../models/types.js';

export class FleetService {
  private db = getFirestore();

  // ============================================
  // FLEET CRUD
  // ============================================

  /**
   * Create a new fleet
   */
  async createFleet(
    organizationId: string,
    name: string,
    systemIds: string[],
    config?: Partial<FleetConfiguration>
  ): Promise<Fleet> {
    const now = new Date();

    const fleet: Omit<Fleet, 'id'> = {
      organizationId,
      name,
      systemIds,
      siteIds: [], // Will be populated from systems
      config: {
        centralizedControl: true,
        autoDispatch: true,
        alertAggregation: true,
        alertEscalation: {
          levels: [
            {
              level: 1,
              name: 'Operations',
              recipients: [],
              channels: ['email', 'push'],
              responseTimeout: 15,
            },
            {
              level: 2,
              name: 'Management',
              recipients: [],
              channels: ['email', 'sms', 'push'],
              responseTimeout: 30,
            },
            {
              level: 3,
              name: 'Emergency',
              recipients: [],
              channels: ['email', 'sms', 'phone'],
              responseTimeout: 60,
            },
          ],
          autoEscalate: true,
          escalationDelay: 15,
        },
        consolidatedReporting: true,
        benchmarkingEnabled: true,
        maintenanceCoordination: true,
        firmwareRolloutStrategy: 'staged',
        aggregatedGridServices: false,
        virtualPowerPlant: false,
        ...config,
      },
      status: await this.calculateFleetStatus(systemIds),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection(Collections.FLEETS).add(fleet);

    logger.info(`Fleet created: ${name}`, { fleetId: docRef.id, systemCount: systemIds.length });

    return { id: docRef.id, ...fleet };
  }

  /**
   * Get fleet by ID
   */
  async getFleet(fleetId: string): Promise<Fleet | null> {
    const doc = await this.db.collection(Collections.FLEETS).doc(fleetId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    } as Fleet;
  }

  /**
   * Get all fleets for an organization
   */
  async getFleetsByOrganization(organizationId: string): Promise<Fleet[]> {
    const snapshot = await this.db
      .collection(Collections.FLEETS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    })) as Fleet[];
  }

  /**
   * Update fleet status
   */
  async updateFleetStatus(fleetId: string): Promise<FleetStatus> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    const status = await this.calculateFleetStatus(fleet.systemIds);

    await this.db.collection(Collections.FLEETS).doc(fleetId).update({
      status,
      updatedAt: new Date(),
    });

    return status;
  }

  /**
   * Add systems to fleet
   */
  async addSystemsToFleet(fleetId: string, systemIds: string[]): Promise<Fleet> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    const newSystemIds = [...new Set([...fleet.systemIds, ...systemIds])];

    await this.db.collection(Collections.FLEETS).doc(fleetId).update({
      systemIds: newSystemIds,
      updatedAt: new Date(),
    });

    return this.getFleet(fleetId) as Promise<Fleet>;
  }

  /**
   * Remove systems from fleet
   */
  async removeSystemsFromFleet(fleetId: string, systemIds: string[]): Promise<Fleet> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    const newSystemIds = fleet.systemIds.filter(id => !systemIds.includes(id));

    await this.db.collection(Collections.FLEETS).doc(fleetId).update({
      systemIds: newSystemIds,
      updatedAt: new Date(),
    });

    return this.getFleet(fleetId) as Promise<Fleet>;
  }

  // ============================================
  // FLEET STATUS CALCULATION
  // ============================================

  private async calculateFleetStatus(systemIds: string[]): Promise<FleetStatus> {
    if (systemIds.length === 0) {
      return {
        totalSystems: 0,
        onlineSystems: 0,
        offlineSystems: 0,
        alertingSystems: 0,
        maintenanceSystems: 0,
        totalCapacity: 0,
        totalPower: 0,
        averageSoc: 0,
        averageSoh: 0,
        totalEnergyCharged: 0,
        totalEnergyDischarged: 0,
        totalSavingsToday: 0,
        totalRevenueToday: 0,
        activeGridServices: [],
        gridServicesRevenue: 0,
        lastUpdate: new Date(),
      };
    }

    // Fetch all systems
    const systemsSnapshot = await this.db
      .collection(Collections.SYSTEMS)
      .where('__name__', 'in', systemIds.slice(0, 10)) // Firestore limit
      .get();

    const systems = systemsSnapshot.docs.map(doc => doc.data() as BessSystem);

    // Fetch telemetry for each system
    const telemetryPromises = systemIds.map(id =>
      this.db.collection(Collections.TELEMETRY).doc(id).get()
    );
    const telemetryDocs = await Promise.all(telemetryPromises);

    let totalCapacity = 0;
    let totalPower = 0;
    let totalSoc = 0;
    let totalSoh = 0;
    let onlineSystems = 0;
    let offlineSystems = 0;
    let alertingSystems = 0;
    let maintenanceSystems = 0;

    systems.forEach((system, index) => {
      const telemetry = telemetryDocs[index]?.data();

      // Capacity
      totalCapacity += system.batterySpec?.energyCapacity || 0;

      // Status counts
      if (system.connectionStatus === ConnectionStatus.ONLINE) {
        onlineSystems++;
      } else {
        offlineSystems++;
      }

      if (system.status === SystemStatus.ERROR) {
        alertingSystems++;
      }

      if (system.status === SystemStatus.MAINTENANCE) {
        maintenanceSystems++;
      }

      // Telemetry aggregation
      if (telemetry) {
        totalPower += Math.abs(telemetry.power || 0) / 1000; // Convert to kW
        totalSoc += telemetry.soc || 0;
        totalSoh += telemetry.soh || 0;
      }
    });

    const systemCount = systems.length || 1;

    return {
      totalSystems: systemIds.length,
      onlineSystems,
      offlineSystems,
      alertingSystems,
      maintenanceSystems,
      totalCapacity: totalCapacity / 1000, // MWh
      totalPower: totalPower / 1000, // MW
      averageSoc: totalSoc / systemCount,
      averageSoh: totalSoh / systemCount,
      totalEnergyCharged: 0, // Would be calculated from daily stats
      totalEnergyDischarged: 0,
      totalSavingsToday: 0,
      totalRevenueToday: 0,
      activeGridServices: [],
      gridServicesRevenue: 0,
      lastUpdate: new Date(),
    };
  }

  // ============================================
  // SLA MANAGEMENT
  // ============================================

  /**
   * Create SLA configuration
   */
  async createSLAConfig(config: Omit<SLAConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<SLAConfiguration> {
    const now = new Date();

    const slaConfig: Omit<SLAConfiguration, 'id'> = {
      ...config,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection(Collections.SLA_CONFIGS).add(slaConfig);

    logger.info(`SLA config created`, { slaId: docRef.id, fleetId: config.fleetId, systemId: config.systemId });

    return { id: docRef.id, ...slaConfig };
  }

  /**
   * Get SLA configuration
   */
  async getSLAConfig(slaId: string): Promise<SLAConfiguration | null> {
    const doc = await this.db.collection(Collections.SLA_CONFIGS).doc(slaId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
      contractStart: doc.data()?.contractStart?.toDate(),
      contractEnd: doc.data()?.contractEnd?.toDate(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    } as SLAConfiguration;
  }

  /**
   * Calculate SLA metrics for a period
   */
  async calculateSLAReport(
    slaId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SLAReport> {
    const slaConfig = await this.getSLAConfig(slaId);
    if (!slaConfig) {
      throw new NotFoundError('SLA Configuration');
    }

    // Get incidents for the period
    const incidentsSnapshot = await this.db
      .collection(Collections.SLA_INCIDENTS)
      .where('slaConfigId', '==', slaId)
      .where('startTime', '>=', startDate)
      .where('startTime', '<=', endDate)
      .get();

    const incidents = incidentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data()?.startTime?.toDate(),
      endTime: doc.data()?.endTime?.toDate(),
    })) as SLAIncident[];

    // Calculate metrics
    const totalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    let downtimeHours = 0;
    let excludedHours = 0;
    let scheduledMaintenanceHours = 0;

    incidents.forEach(incident => {
      const duration = (incident.duration || 0) / 60; // Convert minutes to hours

      if (incident.excluded) {
        excludedHours += duration;
        if (incident.exclusionReason?.includes('maintenance')) {
          scheduledMaintenanceHours += duration;
        }
      } else {
        downtimeHours += duration;
      }
    });

    const effectiveTotalHours = totalHours - excludedHours;
    const uptimeHours = effectiveTotalHours - downtimeHours;
    const calculatedUptime = (uptimeHours / effectiveTotalHours) * 100;

    // Calculate MTTR and MTBF
    const affectingIncidents = incidents.filter(i => !i.excluded && i.affectedSla);
    const totalIncidents = affectingIncidents.length;
    const totalRepairTime = affectingIncidents.reduce((sum, i) => sum + (i.duration || 0), 0);
    const mttr = totalIncidents > 0 ? totalRepairTime / totalIncidents / 60 : 0;
    const mtbf = totalIncidents > 0 ? effectiveTotalHours / totalIncidents : effectiveTotalHours;

    // Determine compliance status
    const targetUptime = slaConfig.monthlyUptimeTarget;
    let complianceStatus: 'compliant' | 'warning' | 'breach' = 'compliant';

    if (calculatedUptime < targetUptime) {
      complianceStatus = 'breach';
    } else if (calculatedUptime < targetUptime + 0.5) {
      complianceStatus = 'warning';
    }

    // Calculate credits due
    let creditDue = 0;
    if (slaConfig.penalties) {
      for (const penalty of slaConfig.penalties) {
        if (calculatedUptime < penalty.thresholdValue) {
          if (penalty.penaltyType === 'credit_percentage') {
            // Calculate credit based on monthly fee (would need billing integration)
            creditDue = penalty.penaltyValue; // Simplified
          } else if (penalty.penaltyType === 'fixed_amount') {
            creditDue = penalty.penaltyValue;
          }
          break; // Use first matching penalty
        }
      }
    }

    const report: SLAReport = {
      id: '',
      slaConfigId: slaId,
      systemId: slaConfig.systemId,
      fleetId: slaConfig.fleetId,
      period: {
        start: startDate,
        end: endDate,
      },
      totalTime: totalHours,
      uptime: uptimeHours,
      downtime: downtimeHours,
      scheduledMaintenance: scheduledMaintenanceHours,
      excludedTime: excludedHours,
      calculatedUptime,
      targetUptime,
      slaAchieved: calculatedUptime >= targetUptime,
      incidents,
      totalIncidents,
      mttr,
      mtbf,
      averageEfficiency: 95, // Would be calculated from telemetry
      capacityAvailability: 98, // Would be calculated
      averageResponseTime: 150, // ms
      creditDue,
      creditApplied: false,
      complianceStatus,
      generatedAt: new Date(),
    };

    // Save the report
    const docRef = await this.db.collection(Collections.SLA_REPORTS).add(report);

    return { ...report, id: docRef.id };
  }

  /**
   * Record an SLA incident
   */
  async recordIncident(incident: Omit<SLAIncident, 'id'>): Promise<SLAIncident> {
    const docRef = await this.db.collection(Collections.SLA_INCIDENTS).add({
      ...incident,
      startTime: incident.startTime,
      endTime: incident.endTime || null,
    });

    logger.info(`SLA incident recorded`, { incidentId: docRef.id, type: incident.type });

    return { id: docRef.id, ...incident };
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Create a bulk operation
   */
  async createBulkOperation(
    organizationId: string,
    type: BulkOperationType,
    targetSystemIds: string[],
    payload: Record<string, unknown>,
    strategy: 'immediate' | 'staged' | 'scheduled' = 'staged',
    userId: string
  ): Promise<BulkOperation> {
    const now = new Date();

    const operation: Omit<BulkOperation, 'id'> = {
      organizationId,
      type,
      name: `${type} - ${targetSystemIds.length} systems`,
      targetSystemIds,
      targetSelection: 'selected',
      payload,
      strategy,
      stagedConfig: strategy === 'staged' ? {
        stages: [
          { percentage: 10, delayMinutes: 15, requireApproval: true },
          { percentage: 50, delayMinutes: 30, requireApproval: false },
          { percentage: 100, delayMinutes: 0, requireApproval: false },
        ],
        pauseOnFailure: true,
        failureThreshold: 10,
        rollbackOnFailure: true,
      } : undefined,
      status: BulkOperationStatus.PENDING,
      progress: {
        total: targetSystemIds.length,
        pending: targetSystemIds.length,
        inProgress: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      results: targetSystemIds.map(systemId => ({
        systemId,
        systemName: '', // Would be fetched
        status: 'pending',
      })),
      createdAt: now,
      createdBy: userId,
    };

    const docRef = await this.db.collection(Collections.BULK_OPERATIONS).add(operation);

    logger.info(`Bulk operation created`, {
      operationId: docRef.id,
      type,
      systemCount: targetSystemIds.length,
    });

    return { id: docRef.id, ...operation };
  }

  /**
   * Execute bulk operation
   */
  async executeBulkOperation(operationId: string): Promise<void> {
    const operationDoc = await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).get();

    if (!operationDoc.exists) {
      throw new NotFoundError('Bulk Operation');
    }

    const operation = operationDoc.data() as BulkOperation;

    // Update status to in progress
    await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
      status: BulkOperationStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    // Process based on strategy
    if (operation.strategy === 'immediate') {
      await this.executeAllSystems(operationId, operation);
    } else if (operation.strategy === 'staged') {
      await this.executeStagedRollout(operationId, operation);
    }
  }

  private async executeAllSystems(operationId: string, operation: BulkOperation): Promise<void> {
    const results: BulkOperationResult[] = [];

    for (const systemId of operation.targetSystemIds) {
      const result = await this.executeOnSystem(operation.type, systemId, operation.payload);
      results.push(result);

      // Update progress
      await this.updateOperationProgress(operationId, results);
    }

    // Mark as completed
    await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
      status: BulkOperationStatus.COMPLETED,
      completedAt: new Date(),
      results,
    });
  }

  private async executeStagedRollout(operationId: string, operation: BulkOperation): Promise<void> {
    const stages = operation.stagedConfig?.stages || [];
    const results: BulkOperationResult[] = [];
    let processedCount = 0;

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex];
      const targetCount = Math.ceil((stage.percentage / 100) * operation.targetSystemIds.length);
      const systemsForStage = operation.targetSystemIds.slice(processedCount, targetCount);

      // Update current stage
      await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
        'progress.currentStage': stageIndex + 1,
        'progress.totalStages': stages.length,
      });

      // If approval required, pause
      if (stage.requireApproval && stageIndex > 0) {
        await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
          status: BulkOperationStatus.PAUSED,
        });
        return; // Wait for approval
      }

      // Process systems in this stage
      for (const systemId of systemsForStage) {
        const result = await this.executeOnSystem(operation.type, systemId, operation.payload);
        results.push(result);

        // Check failure threshold
        const failedCount = results.filter(r => r.status === 'failed').length;
        const failureRate = (failedCount / results.length) * 100;

        if (operation.stagedConfig?.pauseOnFailure && failureRate >= (operation.stagedConfig.failureThreshold || 10)) {
          await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
            status: BulkOperationStatus.PAUSED,
            results,
          });
          logger.warn(`Bulk operation paused due to failure threshold`, { operationId, failureRate });
          return;
        }

        await this.updateOperationProgress(operationId, results);
      }

      processedCount = targetCount;

      // Wait before next stage
      if (stage.delayMinutes > 0 && stageIndex < stages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, stage.delayMinutes * 60 * 1000));
      }
    }

    // Mark as completed
    await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
      status: BulkOperationStatus.COMPLETED,
      completedAt: new Date(),
      results,
    });
  }

  private async executeOnSystem(
    type: BulkOperationType,
    systemId: string,
    payload: Record<string, unknown>
  ): Promise<BulkOperationResult> {
    const startedAt = new Date();

    try {
      // Execute based on type
      switch (type) {
        case BulkOperationType.SET_OPERATION_MODE:
          // Would call control service
          logger.info(`Setting operation mode for ${systemId}`, payload);
          break;
        case BulkOperationType.UPDATE_CONFIGURATION:
          // Would call BMS config service
          logger.info(`Updating configuration for ${systemId}`, payload);
          break;
        case BulkOperationType.FIRMWARE_UPDATE:
          // Would call firmware service
          logger.info(`Starting firmware update for ${systemId}`, payload);
          break;
        case BulkOperationType.EMERGENCY_STOP:
          // Would call control service
          logger.warn(`Emergency stop for ${systemId}`);
          break;
        default:
          logger.info(`Executing ${type} for ${systemId}`, payload);
      }

      return {
        systemId,
        systemName: '', // Would fetch
        status: 'success',
        startedAt,
        completedAt: new Date(),
      };
    } catch (error) {
      return {
        systemId,
        systemName: '',
        status: 'failed',
        startedAt,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updateOperationProgress(operationId: string, results: BulkOperationResult[]): Promise<void> {
    const completed = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const inProgress = results.filter(r => r.status === 'in_progress').length;
    const pending = results.filter(r => r.status === 'pending').length;

    await this.db.collection(Collections.BULK_OPERATIONS).doc(operationId).update({
      progress: {
        total: results.length,
        pending,
        inProgress,
        completed,
        failed,
        skipped: 0,
      },
      results,
    });
  }

  // ============================================
  // FLEET ANALYTICS
  // ============================================

  /**
   * Get fleet analytics for a period
   */
  async getFleetAnalytics(
    fleetId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FleetAnalytics> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    // This would aggregate data from multiple sources
    // For now, returning a template structure

    const analytics: FleetAnalytics = {
      fleetId,
      period: {
        start: startDate,
        end: endDate,
      },
      systemStatusDistribution: {
        online: fleet.status.onlineSystems,
        offline: fleet.status.offlineSystems,
        alerting: fleet.status.alertingSystems,
        maintenance: fleet.status.maintenanceSystems,
      },
      averageEfficiency: 95.5,
      averageSoc: fleet.status.averageSoc,
      averageSoh: fleet.status.averageSoh,
      averageUptime: 99.2,
      totalEnergyCharged: 0,
      totalEnergyDischarged: 0,
      totalEnergyThroughput: 0,
      totalCycles: 0,
      totalSavings: 0,
      totalRevenue: 0,
      savingsPerMwh: 0,
      totalAlerts: 0,
      alertsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      mostCommonAlerts: [],
      gridServicesParticipation: [],
      topPerformers: [],
      underPerformers: [],
      generatedAt: new Date(),
    };

    return analytics;
  }

  /**
   * Get system benchmarks within a fleet
   */
  async getSystemBenchmarks(fleetId: string): Promise<SystemBenchmark[]> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    const benchmarks: SystemBenchmark[] = [];

    for (const systemId of fleet.systemIds) {
      // Would calculate real metrics
      benchmarks.push({
        systemId,
        systemName: `System ${systemId.slice(0, 8)}`,
        siteName: 'Site',
        overallScore: Math.random() * 30 + 70, // 70-100
        efficiencyScore: Math.random() * 20 + 80,
        availabilityScore: Math.random() * 10 + 90,
        savingsScore: Math.random() * 30 + 70,
        efficiency: 94 + Math.random() * 4,
        uptime: 98 + Math.random() * 2,
        soh: 95 + Math.random() * 5,
        savingsPerKwh: 0.15 + Math.random() * 0.1,
        vsFleetEfficiency: (Math.random() - 0.5) * 10,
        vsFleetAvailability: (Math.random() - 0.5) * 5,
        vsFleetSavings: (Math.random() - 0.5) * 20,
      });
    }

    // Sort by overall score
    benchmarks.sort((a, b) => b.overallScore - a.overallScore);

    return benchmarks;
  }

  // ============================================
  // FIRMWARE MANAGEMENT
  // ============================================

  /**
   * Get available firmware versions
   */
  async getFirmwareVersions(modelFilter?: string): Promise<FirmwareVersion[]> {
    let query = this.db.collection(Collections.FIRMWARE_VERSIONS) as FirebaseFirestore.Query;

    if (modelFilter) {
      query = query.where('compatibleModels', 'array-contains', modelFilter);
    }

    const snapshot = await query.orderBy('releaseDate', 'desc').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      releaseDate: doc.data()?.releaseDate?.toDate(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    })) as FirmwareVersion[];
  }

  /**
   * Schedule firmware update for a system
   */
  async scheduleFirmwareUpdate(
    systemId: string,
    firmwareVersionId: string,
    scheduledAt: Date,
    userId: string
  ): Promise<FirmwareUpdate> {
    const firmwareDoc = await this.db.collection(Collections.FIRMWARE_VERSIONS).doc(firmwareVersionId).get();

    if (!firmwareDoc.exists) {
      throw new NotFoundError('Firmware Version');
    }

    const firmware = firmwareDoc.data() as FirmwareVersion;

    // Get current system firmware
    const systemDoc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
    const currentVersion = systemDoc.data()?.firmwareVersion || 'unknown';

    const update: Omit<FirmwareUpdate, 'id'> = {
      systemId,
      firmwareVersionId,
      targetVersion: firmware.version,
      status: FirmwareUpdateStatus.SCHEDULED,
      progress: 0,
      currentStep: 'Scheduled',
      scheduledAt,
      previousVersion: currentVersion,
      canRollback: true,
      rolledBack: false,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      createdBy: userId,
    };

    const docRef = await this.db.collection(Collections.FIRMWARE_UPDATES).add(update);

    logger.info(`Firmware update scheduled`, {
      updateId: docRef.id,
      systemId,
      targetVersion: firmware.version,
      scheduledAt,
    });

    return { id: docRef.id, ...update };
  }

  // ============================================
  // MAINTENANCE SCHEDULING
  // ============================================

  /**
   * Create maintenance schedule
   */
  async createMaintenanceSchedule(
    schedule: Omit<MaintenanceSchedule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MaintenanceSchedule> {
    const now = new Date();

    const maintenanceSchedule: Omit<MaintenanceSchedule, 'id'> = {
      ...schedule,
      status: MaintenanceStatus.SCHEDULED,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.db.collection(Collections.MAINTENANCE_SCHEDULES).add(maintenanceSchedule);

    logger.info(`Maintenance scheduled`, {
      scheduleId: docRef.id,
      systemId: schedule.systemId,
      type: schedule.type,
      scheduledStart: schedule.scheduledStart,
    });

    return { id: docRef.id, ...maintenanceSchedule };
  }

  /**
   * Get upcoming maintenance for a fleet
   */
  async getUpcomingMaintenance(fleetId: string, days: number = 30): Promise<MaintenanceSchedule[]> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Get maintenance for all systems in fleet
    const schedules: MaintenanceSchedule[] = [];

    for (const systemId of fleet.systemIds) {
      const snapshot = await this.db
        .collection(Collections.MAINTENANCE_SCHEDULES)
        .where('systemId', '==', systemId)
        .where('scheduledStart', '>=', startDate)
        .where('scheduledStart', '<=', endDate)
        .where('status', 'in', ['scheduled', 'confirmed'])
        .get();

      snapshot.docs.forEach(doc => {
        schedules.push({
          id: doc.id,
          ...doc.data(),
          scheduledStart: doc.data()?.scheduledStart?.toDate(),
          scheduledEnd: doc.data()?.scheduledEnd?.toDate(),
          createdAt: doc.data()?.createdAt?.toDate(),
          updatedAt: doc.data()?.updatedAt?.toDate(),
        } as MaintenanceSchedule);
      });
    }

    // Sort by scheduled start
    schedules.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());

    return schedules;
  }
}

export const fleetService = new FleetService();
