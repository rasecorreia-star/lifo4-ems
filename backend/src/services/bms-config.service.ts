/**
 * BMS Configuration Service for Lifo4 EMS
 * Handles BMS parameter editing with dependency validation
 */

import { getFirestore, Collections } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import {
  BMSConfiguration,
  VoltageProtectionParams,
  CurrentProtectionParams,
  TemperatureProtectionParams,
  SOCCalibrationParams,
  BalancingParams,
  CapacityPowerParams,
  CommunicationParams,
  AlarmSettings,
  ParameterDependency,
  DependencyRule,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ConfigurationChange,
  ParameterChange,
  BMSTemplate,
  ModbusRegisterMap,
} from '../models/bms-config.types.js';
import { UserRole } from '../models/types.js';

// ============================================
// DEFAULT CONFIGURATION FOR LiFePO4
// ============================================

const DEFAULT_LIFEPO4_CONFIG: Partial<BMSConfiguration> = {
  voltageProtection: {
    ovpThreshold: 3.65,
    ovpRecovery: 3.55,
    ovpDelay: 1000,
    uvpThreshold: 2.50,
    uvpRecovery: 2.70,
    uvpDelay: 1000,
    highVoltageAlarm: 3.55,
    lowVoltageAlarm: 2.80,
    cellDifferenceAlarm: 100,
    packOvervoltage: 58.4,  // 16 cells
    packUndervoltage: 40.0,
  },
  currentProtection: {
    ocpChargeThreshold: 100,
    ocpChargeDelay: 5000,
    ocpChargeRecovery: 90,
    ocpDischargeThreshold: 100,
    ocpDischargeDelay: 5000,
    ocpDischargeRecovery: 90,
    scpThreshold: 500,
    scpDelay: 100,
    highChargeCurrentAlarm: 80,
    highDischargeCurrentAlarm: 80,
  },
  temperatureProtection: {
    cotThreshold: 55,
    cotRecovery: 50,
    cutThreshold: 0,
    cutRecovery: 5,
    dotThreshold: 60,
    dotRecovery: 55,
    dutThreshold: -20,
    dutRecovery: -15,
    mosOverTemp: 100,
    mosOverTempRecovery: 90,
    tempCompensationEnabled: true,
    tempCompensationCoefficient: 3.0,
    highTempAlarm: 50,
    lowTempAlarm: 5,
  },
  socCalibration: {
    soc100Voltage: 3.50,
    soc0Voltage: 2.80,
    fullChargeCapacity: 100,
    designCapacity: 100,
    currentCapacity: 100,
    coulombCounterResetInterval: 30,
    autoCalibrationEnabled: true,
    calibrationVoltageHigh: 3.50,
    calibrationVoltageLow: 2.80,
    ocvTable: [
      { soc: 0, voltage: 2.80 },
      { soc: 10, voltage: 3.00 },
      { soc: 20, voltage: 3.15 },
      { soc: 30, voltage: 3.20 },
      { soc: 40, voltage: 3.22 },
      { soc: 50, voltage: 3.25 },
      { soc: 60, voltage: 3.27 },
      { soc: 70, voltage: 3.30 },
      { soc: 80, voltage: 3.32 },
      { soc: 90, voltage: 3.40 },
      { soc: 100, voltage: 3.50 },
    ],
    selfDischargeRate: 3,
    selfDischargeCompensation: true,
  },
  balancing: {
    balanceEnabled: true,
    balanceStartVoltage: 3.40,
    balanceDeltaTrigger: 30,
    balanceCurrent: 100,
    maxBalanceTime: 120,
    balanceDuringCharge: true,
    balanceDuringRest: true,
    balanceDuringDischarge: false,
    balanceType: 'passive',
    balanceTimeLimit: 500,
    balanceEfficiencyAlert: 80,
  },
  capacityPower: {
    nominalCapacity: 100,
    nominalVoltage: 51.2,
    nominalEnergy: 5.12,
    usableCapacity: 100,
    reserveCapacity: 10,
    maxChargePower: 5,
    maxDischargePower: 5,
    continuousChargePower: 3,
    continuousDischargePower: 3,
    powerRampRate: 1.0,
    maxChargeRate: 1.0,
    maxDischargeRate: 1.0,
    chargeEfficiency: 98,
    dischargeEfficiency: 98,
    inverterEfficiency: 96,
  },
  communication: {
    modbusAddress: 1,
    modbusBaudRate: 9600,
    modbusParity: 'none',
    modbusStopBits: 1,
    modbusDataBits: 8,
    canEnabled: false,
    canBaudRate: 250000,
    canNodeId: 1,
    canProtocol: 'standard',
    communicationTimeout: 10000,
    heartbeatInterval: 30,
    retryCount: 3,
    retryDelay: 1000,
    loggingInterval: 5,
    detailedLogging: false,
  },
};

// ============================================
// PARAMETER DEPENDENCY RULES
// ============================================

const DEPENDENCY_RULES: ParameterDependency[] = [
  // Voltage Protection Dependencies
  {
    parameter: 'voltageProtection.ovpRecovery',
    dependsOn: 'voltageProtection.ovpThreshold',
    rule: DependencyRule.LESS_THAN,
    gap: 0.05, // 50mV gap
    message: 'OVPR must be less than OVP threshold (recommended gap: 50mV)',
  },
  {
    parameter: 'voltageProtection.uvpRecovery',
    dependsOn: 'voltageProtection.uvpThreshold',
    rule: DependencyRule.GREATER_THAN,
    gap: 0.05,
    message: 'UVPR must be greater than UVP threshold (recommended gap: 50mV)',
  },
  {
    parameter: 'voltageProtection.highVoltageAlarm',
    dependsOn: 'voltageProtection.ovpThreshold',
    rule: DependencyRule.LESS_THAN,
    gap: 0.1,
    message: 'High voltage alarm must be lower than OVP threshold',
  },
  {
    parameter: 'voltageProtection.lowVoltageAlarm',
    dependsOn: 'voltageProtection.uvpThreshold',
    rule: DependencyRule.GREATER_THAN,
    gap: 0.1,
    message: 'Low voltage alarm must be higher than UVP threshold',
  },

  // SOC Calibration Dependencies
  {
    parameter: 'socCalibration.soc0Voltage',
    dependsOn: 'socCalibration.soc100Voltage',
    rule: DependencyRule.LESS_THAN,
    gap: 0.5,
    message: 'SOC 0% voltage must be at least 0.5V lower than SOC 100% voltage',
  },

  // Balancing Dependencies
  {
    parameter: 'balancing.balanceStartVoltage',
    dependsOn: 'voltageProtection.ovpThreshold',
    rule: DependencyRule.LESS_THAN,
    gap: 0.1,
    message: 'Balance start voltage must be at least 100mV below OVP threshold',
  },

  // Temperature Dependencies
  {
    parameter: 'temperatureProtection.cotRecovery',
    dependsOn: 'temperatureProtection.cotThreshold',
    rule: DependencyRule.LESS_THAN,
    gap: 5,
    message: 'COT recovery must be lower than COT threshold',
  },
  {
    parameter: 'temperatureProtection.cutRecovery',
    dependsOn: 'temperatureProtection.cutThreshold',
    rule: DependencyRule.GREATER_THAN,
    gap: 5,
    message: 'CUT recovery must be higher than CUT threshold',
  },

  // LiFePO4 Specific
  {
    parameter: 'temperatureProtection.cutThreshold',
    dependsOn: 'chemistry',
    rule: DependencyRule.DEPENDS_ON_CHEMISTRY,
    message: 'LiFePO4 batteries cannot charge below 0°C',
  },
];

// ============================================
// PARAMETER RANGES FOR VALIDATION
// ============================================

interface ParameterRange {
  min: number;
  max: number;
  unit: string;
  warningMin?: number;
  warningMax?: number;
}

const PARAMETER_RANGES: Record<string, ParameterRange> = {
  // Voltage (V per cell)
  'voltageProtection.ovpThreshold': { min: 3.50, max: 3.75, unit: 'V', warningMax: 3.70 },
  'voltageProtection.ovpRecovery': { min: 3.45, max: 3.70, unit: 'V' },
  'voltageProtection.uvpThreshold': { min: 2.30, max: 2.80, unit: 'V', warningMin: 2.50 },
  'voltageProtection.uvpRecovery': { min: 2.40, max: 2.90, unit: 'V' },

  // Current (A)
  'currentProtection.ocpChargeThreshold': { min: 10, max: 200, unit: 'A' },
  'currentProtection.ocpDischargeThreshold': { min: 10, max: 200, unit: 'A' },
  'currentProtection.scpThreshold': { min: 200, max: 1000, unit: 'A' },

  // Temperature (°C)
  'temperatureProtection.cotThreshold': { min: 40, max: 70, unit: '°C', warningMax: 60 },
  'temperatureProtection.cutThreshold': { min: -20, max: 10, unit: '°C', warningMin: 0 },
  'temperatureProtection.dotThreshold': { min: 50, max: 80, unit: '°C', warningMax: 65 },
  'temperatureProtection.dutThreshold': { min: -30, max: 0, unit: '°C' },

  // SOC Voltage (V per cell)
  'socCalibration.soc100Voltage': { min: 3.45, max: 3.55, unit: 'V' },
  'socCalibration.soc0Voltage': { min: 2.50, max: 2.90, unit: 'V' },

  // Balancing
  'balancing.balanceStartVoltage': { min: 3.30, max: 3.50, unit: 'V' },
  'balancing.balanceDeltaTrigger': { min: 20, max: 100, unit: 'mV' },
  'balancing.balanceCurrent': { min: 50, max: 200, unit: 'mA' },

  // Communication
  'communication.modbusAddress': { min: 1, max: 247, unit: '' },
  'communication.heartbeatInterval': { min: 5, max: 60, unit: 's' },
};

// ============================================
// BMS CONFIG SERVICE
// ============================================

export class BMSConfigService {
  private db = getFirestore();

  /**
   * Get current BMS configuration for a system
   */
  async getConfiguration(systemId: string): Promise<BMSConfiguration | null> {
    const doc = await this.db
      .collection(Collections.BMS_CONFIGS)
      .doc(systemId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    } as BMSConfiguration;
  }

  /**
   * Create default configuration for a new system
   */
  async createDefaultConfiguration(
    systemId: string,
    chemistry: 'LiFePO4' | 'Li-ion' | 'Lead-acid',
    cellCount: number,
    userId: string
  ): Promise<BMSConfiguration> {
    const defaultConfig = this.getDefaultConfig(chemistry, cellCount);
    const now = new Date();

    const config: BMSConfiguration = {
      ...defaultConfig as BMSConfiguration,
      id: systemId,
      systemId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      pendingApproval: false,
    };

    await this.db
      .collection(Collections.BMS_CONFIGS)
      .doc(systemId)
      .set(config);

    logger.info(`Created default BMS config for system ${systemId}`);

    return config;
  }

  /**
   * Update BMS configuration with validation
   */
  async updateConfiguration(
    systemId: string,
    updates: Partial<BMSConfiguration>,
    userId: string,
    userRole: UserRole,
    reason: string
  ): Promise<{ config: BMSConfiguration; requiresApproval: boolean }> {
    // Get current configuration
    const currentConfig = await this.getConfiguration(systemId);
    if (!currentConfig) {
      throw new NotFoundError('BMS Configuration');
    }

    // Merge updates with current config
    const newConfig = this.mergeConfiguration(currentConfig, updates);

    // Validate the new configuration
    const validation = this.validateConfiguration(newConfig);

    if (!validation.isValid) {
      throw new BadRequestError(
        `Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`
      );
    }

    // Check if approval is required
    const changes = this.detectChanges(currentConfig, newConfig);
    const hasCriticalChanges = changes.some(c => c.isCritical);
    const requiresApproval = hasCriticalChanges && userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN;

    const now = new Date();

    // Update the configuration
    const updatedConfig: BMSConfiguration = {
      ...newConfig,
      version: currentConfig.version + 1,
      updatedAt: now,
      updatedBy: userId,
      pendingApproval: requiresApproval,
    };

    if (requiresApproval) {
      // Store pending changes
      await this.db
        .collection(Collections.BMS_CONFIG_PENDING)
        .doc(systemId)
        .set({
          ...updatedConfig,
          previousConfig: currentConfig,
          requestedAt: now,
          requestedBy: userId,
          reason,
        });
    } else {
      // Apply changes immediately
      await this.db
        .collection(Collections.BMS_CONFIGS)
        .doc(systemId)
        .set(updatedConfig);
    }

    // Log the change
    await this.logConfigurationChange({
      id: '',
      systemId,
      configurationId: systemId,
      timestamp: now,
      userId,
      userName: '', // would be filled from user service
      userRole,
      changeType: 'update',
      changes,
      reason,
      approvalRequired: requiresApproval,
      previousConfigSnapshot: currentConfig,
    });

    logger.info(`BMS config updated for system ${systemId}`, {
      changesCount: changes.length,
      requiresApproval,
    });

    return { config: updatedConfig, requiresApproval };
  }

  /**
   * Validate a configuration and return detailed results
   */
  validateConfiguration(config: BMSConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate ranges
    for (const [path, range] of Object.entries(PARAMETER_RANGES)) {
      const value = this.getNestedValue(config, path);
      if (value !== undefined) {
        if (value < range.min || value > range.max) {
          errors.push({
            parameter: path,
            value,
            message: `${path} must be between ${range.min} and ${range.max} ${range.unit}`,
            rule: 'range',
          });
        } else if (range.warningMin !== undefined && value < range.warningMin) {
          warnings.push({
            parameter: path,
            value,
            message: `${path} is below recommended minimum (${range.warningMin} ${range.unit})`,
            recommendation: `Consider setting to at least ${range.warningMin} ${range.unit}`,
          });
        } else if (range.warningMax !== undefined && value > range.warningMax) {
          warnings.push({
            parameter: path,
            value,
            message: `${path} is above recommended maximum (${range.warningMax} ${range.unit})`,
            recommendation: `Consider setting to at most ${range.warningMax} ${range.unit}`,
          });
        }
      }
    }

    // Validate dependencies
    for (const dep of DEPENDENCY_RULES) {
      const paramValue = this.getNestedValue(config, dep.parameter);
      const depValue = this.getNestedValue(config, dep.dependsOn);

      if (paramValue === undefined || depValue === undefined) continue;

      let isValid = true;
      const gap = dep.gap || 0;

      switch (dep.rule) {
        case DependencyRule.LESS_THAN:
          isValid = paramValue < depValue - gap;
          break;
        case DependencyRule.LESS_THAN_OR_EQUAL:
          isValid = paramValue <= depValue - gap;
          break;
        case DependencyRule.GREATER_THAN:
          isValid = paramValue > depValue + gap;
          break;
        case DependencyRule.GREATER_THAN_OR_EQUAL:
          isValid = paramValue >= depValue + gap;
          break;
        case DependencyRule.DEPENDS_ON_CHEMISTRY:
          // Special handling for chemistry-dependent rules
          if (dep.parameter === 'temperatureProtection.cutThreshold') {
            // LiFePO4 cannot charge below 0°C
            isValid = paramValue >= 0;
          }
          break;
      }

      if (!isValid) {
        errors.push({
          parameter: dep.parameter,
          value: paramValue,
          message: dep.message,
          rule: dep.rule,
          dependentParameter: dep.dependsOn,
          dependentValue: depValue,
          suggestedFix: this.getSuggestedFix(dep, paramValue, depValue),
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Preview what would change without applying
   */
  async previewChanges(
    systemId: string,
    updates: Partial<BMSConfiguration>
  ): Promise<{
    validation: ValidationResult;
    changes: ParameterChange[];
    requiresApproval: boolean;
  }> {
    const currentConfig = await this.getConfiguration(systemId);
    if (!currentConfig) {
      throw new NotFoundError('BMS Configuration');
    }

    const newConfig = this.mergeConfiguration(currentConfig, updates);
    const validation = this.validateConfiguration(newConfig);
    const changes = this.detectChanges(currentConfig, newConfig);
    const requiresApproval = changes.some(c => c.isCritical);

    return {
      validation,
      changes,
      requiresApproval,
    };
  }

  /**
   * Approve pending configuration change
   */
  async approveChange(
    systemId: string,
    approverId: string
  ): Promise<BMSConfiguration> {
    const pendingDoc = await this.db
      .collection(Collections.BMS_CONFIG_PENDING)
      .doc(systemId)
      .get();

    if (!pendingDoc.exists) {
      throw new NotFoundError('Pending configuration change');
    }

    const pendingConfig = pendingDoc.data() as BMSConfiguration & {
      previousConfig: BMSConfiguration;
      requestedAt: Date;
      requestedBy: string;
      reason: string;
    };

    const now = new Date();

    // Apply the approved configuration
    const approvedConfig: BMSConfiguration = {
      ...pendingConfig,
      pendingApproval: false,
      approvedBy: approverId,
      approvedAt: now,
    };

    await this.db
      .collection(Collections.BMS_CONFIGS)
      .doc(systemId)
      .set(approvedConfig);

    // Delete pending
    await this.db
      .collection(Collections.BMS_CONFIG_PENDING)
      .doc(systemId)
      .delete();

    // Log approval
    await this.logConfigurationChange({
      id: '',
      systemId,
      configurationId: systemId,
      timestamp: now,
      userId: approverId,
      userName: '',
      userRole: UserRole.ADMIN,
      changeType: 'approve',
      changes: [],
      reason: 'Configuration approved',
      approvalRequired: false,
      approvedBy: approverId,
      approvedAt: now,
    });

    logger.info(`BMS config approved for system ${systemId} by ${approverId}`);

    return approvedConfig;
  }

  /**
   * Reject pending configuration change
   */
  async rejectChange(
    systemId: string,
    rejecterId: string,
    reason: string
  ): Promise<void> {
    const pendingDoc = await this.db
      .collection(Collections.BMS_CONFIG_PENDING)
      .doc(systemId)
      .get();

    if (!pendingDoc.exists) {
      throw new NotFoundError('Pending configuration change');
    }

    const pendingConfig = pendingDoc.data();

    // Delete pending
    await this.db
      .collection(Collections.BMS_CONFIG_PENDING)
      .doc(systemId)
      .delete();

    // Log rejection
    await this.logConfigurationChange({
      id: '',
      systemId,
      configurationId: systemId,
      timestamp: new Date(),
      userId: rejecterId,
      userName: '',
      userRole: UserRole.ADMIN,
      changeType: 'reject',
      changes: [],
      reason,
      approvalRequired: false,
      rejectedBy: rejecterId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    });

    logger.info(`BMS config rejected for system ${systemId}`);
  }

  /**
   * Restore to a previous configuration version
   */
  async restoreConfiguration(
    systemId: string,
    versionToRestore: number,
    userId: string,
    reason: string
  ): Promise<BMSConfiguration> {
    // Get the version from history
    const historySnapshot = await this.db
      .collection(Collections.BMS_CONFIG_HISTORY)
      .where('systemId', '==', systemId)
      .where('version', '==', versionToRestore)
      .limit(1)
      .get();

    if (historySnapshot.empty) {
      throw new NotFoundError(`Configuration version ${versionToRestore}`);
    }

    const historicConfig = historySnapshot.docs[0].data() as BMSConfiguration;
    const currentConfig = await this.getConfiguration(systemId);

    const now = new Date();
    const restoredConfig: BMSConfiguration = {
      ...historicConfig,
      version: (currentConfig?.version || 0) + 1,
      updatedAt: now,
      updatedBy: userId,
      pendingApproval: false,
    };

    // Save current to history before overwriting
    if (currentConfig) {
      await this.db
        .collection(Collections.BMS_CONFIG_HISTORY)
        .add(currentConfig);
    }

    // Apply restored config
    await this.db
      .collection(Collections.BMS_CONFIGS)
      .doc(systemId)
      .set(restoredConfig);

    // Log the restore
    await this.logConfigurationChange({
      id: '',
      systemId,
      configurationId: systemId,
      timestamp: now,
      userId,
      userName: '',
      userRole: UserRole.TECHNICIAN,
      changeType: 'restore',
      changes: [],
      reason: `Restored to version ${versionToRestore}: ${reason}`,
      approvalRequired: false,
      previousConfigSnapshot: currentConfig || undefined,
    });

    logger.info(`BMS config restored to version ${versionToRestore} for system ${systemId}`);

    return restoredConfig;
  }

  /**
   * Restore factory defaults
   */
  async restoreFactoryDefaults(
    systemId: string,
    userId: string,
    chemistry: 'LiFePO4' | 'Li-ion' | 'Lead-acid' = 'LiFePO4',
    cellCount: number = 16
  ): Promise<BMSConfiguration> {
    const currentConfig = await this.getConfiguration(systemId);

    // Save current to history
    if (currentConfig) {
      await this.db
        .collection(Collections.BMS_CONFIG_HISTORY)
        .add(currentConfig);
    }

    const defaultConfig = this.getDefaultConfig(chemistry, cellCount);
    const now = new Date();

    const restoredConfig: BMSConfiguration = {
      ...defaultConfig as BMSConfiguration,
      id: systemId,
      systemId,
      version: (currentConfig?.version || 0) + 1,
      createdAt: currentConfig?.createdAt || now,
      updatedAt: now,
      updatedBy: userId,
      pendingApproval: false,
    };

    await this.db
      .collection(Collections.BMS_CONFIGS)
      .doc(systemId)
      .set(restoredConfig);

    // Log
    await this.logConfigurationChange({
      id: '',
      systemId,
      configurationId: systemId,
      timestamp: now,
      userId,
      userName: '',
      userRole: UserRole.TECHNICIAN,
      changeType: 'restore',
      changes: [],
      reason: 'Restored factory defaults',
      approvalRequired: false,
      previousConfigSnapshot: currentConfig || undefined,
    });

    logger.info(`Factory defaults restored for system ${systemId}`);

    return restoredConfig;
  }

  /**
   * Get configuration change history
   */
  async getConfigurationHistory(
    systemId: string,
    limit: number = 50
  ): Promise<ConfigurationChange[]> {
    const snapshot = await this.db
      .collection(Collections.BMS_CONFIG_CHANGES)
      .where('systemId', '==', systemId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as ConfigurationChange[];
  }

  /**
   * Get available BMS templates
   */
  async getTemplates(
    manufacturer?: string,
    chemistry?: string
  ): Promise<BMSTemplate[]> {
    let query = this.db.collection(Collections.BMS_TEMPLATES) as FirebaseFirestore.Query;

    if (manufacturer) {
      query = query.where('manufacturer', '==', manufacturer);
    }
    if (chemistry) {
      query = query.where('chemistry', '==', chemistry);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BMSTemplate[];
  }

  /**
   * Apply a template to a system
   */
  async applyTemplate(
    systemId: string,
    templateId: string,
    userId: string
  ): Promise<BMSConfiguration> {
    const templateDoc = await this.db
      .collection(Collections.BMS_TEMPLATES)
      .doc(templateId)
      .get();

    if (!templateDoc.exists) {
      throw new NotFoundError('BMS Template');
    }

    const template = templateDoc.data() as BMSTemplate;

    return this.updateConfiguration(
      systemId,
      template.defaultConfig as Partial<BMSConfiguration>,
      userId,
      UserRole.TECHNICIAN,
      `Applied template: ${template.name}`
    ).then(result => result.config);
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private getDefaultConfig(chemistry: string, cellCount: number): Partial<BMSConfiguration> {
    const config = { ...DEFAULT_LIFEPO4_CONFIG };

    // Adjust pack voltages based on cell count
    if (config.voltageProtection) {
      config.voltageProtection.packOvervoltage = config.voltageProtection.ovpThreshold * cellCount;
      config.voltageProtection.packUndervoltage = config.voltageProtection.uvpThreshold * cellCount;
    }

    // Adjust nominal voltage
    if (config.capacityPower) {
      config.capacityPower.nominalVoltage = 3.2 * cellCount; // 3.2V nominal for LiFePO4
    }

    return config;
  }

  private mergeConfiguration(
    current: BMSConfiguration,
    updates: Partial<BMSConfiguration>
  ): BMSConfiguration {
    return {
      ...current,
      voltageProtection: {
        ...current.voltageProtection,
        ...(updates.voltageProtection || {}),
      },
      currentProtection: {
        ...current.currentProtection,
        ...(updates.currentProtection || {}),
      },
      temperatureProtection: {
        ...current.temperatureProtection,
        ...(updates.temperatureProtection || {}),
      },
      socCalibration: {
        ...current.socCalibration,
        ...(updates.socCalibration || {}),
      },
      balancing: {
        ...current.balancing,
        ...(updates.balancing || {}),
      },
      capacityPower: {
        ...current.capacityPower,
        ...(updates.capacityPower || {}),
      },
      communication: {
        ...current.communication,
        ...(updates.communication || {}),
      },
      alarmSettings: updates.alarmSettings || current.alarmSettings,
    };
  }

  private detectChanges(
    oldConfig: BMSConfiguration,
    newConfig: BMSConfiguration
  ): ParameterChange[] {
    const changes: ParameterChange[] = [];
    const criticalCategories = ['voltageProtection', 'currentProtection', 'temperatureProtection'];

    const compareObjects = (
      oldObj: Record<string, unknown>,
      newObj: Record<string, unknown>,
      category: string
    ) => {
      for (const key of Object.keys(newObj)) {
        const oldValue = oldObj?.[key];
        const newValue = newObj[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            category,
            parameter: key,
            previousValue: oldValue,
            newValue,
            isCritical: criticalCategories.includes(category),
          });
        }
      }
    };

    if (newConfig.voltageProtection) {
      compareObjects(
        oldConfig.voltageProtection as unknown as Record<string, unknown>,
        newConfig.voltageProtection as unknown as Record<string, unknown>,
        'voltageProtection'
      );
    }
    if (newConfig.currentProtection) {
      compareObjects(
        oldConfig.currentProtection as unknown as Record<string, unknown>,
        newConfig.currentProtection as unknown as Record<string, unknown>,
        'currentProtection'
      );
    }
    if (newConfig.temperatureProtection) {
      compareObjects(
        oldConfig.temperatureProtection as unknown as Record<string, unknown>,
        newConfig.temperatureProtection as unknown as Record<string, unknown>,
        'temperatureProtection'
      );
    }
    if (newConfig.socCalibration) {
      compareObjects(
        oldConfig.socCalibration as unknown as Record<string, unknown>,
        newConfig.socCalibration as unknown as Record<string, unknown>,
        'socCalibration'
      );
    }
    if (newConfig.balancing) {
      compareObjects(
        oldConfig.balancing as unknown as Record<string, unknown>,
        newConfig.balancing as unknown as Record<string, unknown>,
        'balancing'
      );
    }

    return changes;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj as unknown);
  }

  private getSuggestedFix(
    dep: ParameterDependency,
    paramValue: number,
    depValue: number
  ): { adjustParameter: string; suggestedValue: unknown } | undefined {
    const gap = dep.gap || 0;

    switch (dep.rule) {
      case DependencyRule.LESS_THAN:
        return {
          adjustParameter: dep.parameter,
          suggestedValue: depValue - gap - 0.01,
        };
      case DependencyRule.GREATER_THAN:
        return {
          adjustParameter: dep.parameter,
          suggestedValue: depValue + gap + 0.01,
        };
      default:
        return undefined;
    }
  }

  private async logConfigurationChange(change: ConfigurationChange): Promise<void> {
    await this.db.collection(Collections.BMS_CONFIG_CHANGES).add({
      ...change,
      timestamp: new Date(),
    });
  }
}

export const bmsConfigService = new BMSConfigService();
