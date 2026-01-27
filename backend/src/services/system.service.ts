import { getFirestore, Collections } from '../config/firebase.js';
import {
  BessSystem,
  Site,
  Organization,
  ProtectionSettings,
  SystemStatus,
  ConnectionStatus,
  PaginationParams,
} from '../models/types.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { CreateSystemInput, UpdateSystemInput } from '../utils/validation.js';

export class SystemService {
  private db = getFirestore();

  /**
   * Create a new BESS system
   */
  async createSystem(input: CreateSystemInput, organizationId: string): Promise<BessSystem> {
    // Check if site exists and belongs to organization
    const siteDoc = await this.db.collection(Collections.SITES).doc(input.siteId).get();
    if (!siteDoc.exists) {
      throw new NotFoundError('Site');
    }

    const site = siteDoc.data() as Site;
    if (site.organizationId !== organizationId) {
      throw new NotFoundError('Site');
    }

    // Check for duplicate serial number
    const existingSystem = await this.db
      .collection(Collections.SYSTEMS)
      .where('serialNumber', '==', input.serialNumber)
      .get();

    if (!existingSystem.empty) {
      throw new ConflictError('System with this serial number already exists');
    }

    const systemRef = this.db.collection(Collections.SYSTEMS).doc();
    const now = new Date();

    const newSystem: Omit<BessSystem, 'id'> = {
      name: input.name,
      siteId: input.siteId,
      organizationId,
      serialNumber: input.serialNumber,
      model: input.model,
      manufacturer: input.manufacturer,
      installationDate: input.installationDate,
      warrantyExpiration: input.warrantyExpiration,
      batterySpec: input.batterySpec,
      status: SystemStatus.OFFLINE,
      connectionStatus: ConnectionStatus.OFFLINE,
      deviceId: input.deviceId,
      mqttTopic: input.mqttTopic,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await systemRef.set(newSystem);

    // Create default protection settings
    await this.createDefaultProtectionSettings(systemRef.id, input.batterySpec);

    logger.info(`New system created: ${systemRef.id}`);

    return { id: systemRef.id, ...newSystem };
  }

  /**
   * Get system by ID
   */
  async getSystemById(systemId: string): Promise<BessSystem | null> {
    const doc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      installationDate: data?.installationDate?.toDate() || new Date(),
      warrantyExpiration: data?.warrantyExpiration?.toDate(),
      lastCommunication: data?.lastCommunication?.toDate(),
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
    } as BessSystem;
  }

  /**
   * Get systems for an organization
   */
  async getSystemsByOrganization(
    organizationId: string,
    pagination: PaginationParams = {}
  ): Promise<{ systems: BessSystem[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    // Get total count
    const countSnapshot = await this.db
      .collection(Collections.SYSTEMS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .count()
      .get();

    const total = countSnapshot.data().count;

    // Get paginated data
    let query = this.db
      .collection(Collections.SYSTEMS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .orderBy(sortBy, sortOrder)
      .offset((page - 1) * limit)
      .limit(limit);

    const snapshot = await query.get();

    const systems = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        installationDate: data.installationDate?.toDate() || new Date(),
        warrantyExpiration: data.warrantyExpiration?.toDate(),
        lastCommunication: data.lastCommunication?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as BessSystem;
    });

    return { systems, total };
  }

  /**
   * Get systems by site
   */
  async getSystemsBySite(siteId: string): Promise<BessSystem[]> {
    const snapshot = await this.db
      .collection(Collections.SYSTEMS)
      .where('siteId', '==', siteId)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        installationDate: data.installationDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as BessSystem;
    });
  }

  /**
   * Update system
   */
  async updateSystem(systemId: string, input: UpdateSystemInput): Promise<BessSystem> {
    const systemRef = this.db.collection(Collections.SYSTEMS).doc(systemId);
    const doc = await systemRef.get();

    if (!doc.exists) {
      throw new NotFoundError('System');
    }

    await systemRef.update({
      ...input,
      updatedAt: new Date(),
    });

    const updated = await this.getSystemById(systemId);
    if (!updated) {
      throw new NotFoundError('System');
    }

    logger.info(`System updated: ${systemId}`);

    return updated;
  }

  /**
   * Delete system (soft delete)
   */
  async deleteSystem(systemId: string): Promise<void> {
    const systemRef = this.db.collection(Collections.SYSTEMS).doc(systemId);
    const doc = await systemRef.get();

    if (!doc.exists) {
      throw new NotFoundError('System');
    }

    await systemRef.update({
      isActive: false,
      updatedAt: new Date(),
    });

    logger.info(`System deleted: ${systemId}`);
  }

  /**
   * Get protection settings for a system
   */
  async getProtectionSettings(systemId: string): Promise<ProtectionSettings | null> {
    const doc = await this.db.collection(Collections.PROTECTION_SETTINGS).doc(systemId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as ProtectionSettings;
  }

  /**
   * Update protection settings
   */
  async updateProtectionSettings(
    systemId: string,
    settings: Partial<ProtectionSettings>,
    updatedBy: string
  ): Promise<ProtectionSettings> {
    const settingsRef = this.db.collection(Collections.PROTECTION_SETTINGS).doc(systemId);

    await settingsRef.update({
      ...settings,
      updatedAt: new Date(),
      updatedBy,
    });

    const updated = await this.getProtectionSettings(systemId);
    if (!updated) {
      throw new NotFoundError('Protection settings');
    }

    logger.info(`Protection settings updated for system: ${systemId}`);

    return updated;
  }

  /**
   * Create default protection settings for LiFePO4 battery
   */
  private async createDefaultProtectionSettings(
    systemId: string,
    batterySpec: BessSystem['batterySpec']
  ): Promise<void> {
    const defaultSettings: Omit<ProtectionSettings, 'id'> = {
      systemId,

      // Voltage limits (LiFePO4 defaults)
      cellOvervoltage: batterySpec.maxChargeVoltage || 3.65,
      cellUndervoltage: batterySpec.minDischargeVoltage || 2.5,
      cellOvervoltageRecovery: 3.55,
      cellUndervoltageRecovery: 2.7,

      // Current limits
      maxChargeCurrent: batterySpec.maxChargeCurrent,
      maxDischargeCurrent: batterySpec.maxDischargeCurrent,

      // Temperature limits
      chargeHighTemp: 45,
      chargeLowTemp: 0,
      dischargeHighTemp: 55,
      dischargeLowTemp: -20,

      // Balance settings
      balanceStartVoltage: 3.4,
      balanceDeltaVoltage: 30, // mV

      // SOC limits
      minSoc: 10,
      maxSoc: 100,

      updatedAt: new Date(),
      updatedBy: 'system',
    };

    await this.db.collection(Collections.PROTECTION_SETTINGS).doc(systemId).set(defaultSettings);
  }

  /**
   * Get all systems (for super admin)
   */
  async getAllSystems(pagination: PaginationParams = {}): Promise<{ systems: BessSystem[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const countSnapshot = await this.db
      .collection(Collections.SYSTEMS)
      .where('isActive', '==', true)
      .count()
      .get();

    const total = countSnapshot.data().count;

    const snapshot = await this.db
      .collection(Collections.SYSTEMS)
      .where('isActive', '==', true)
      .orderBy(sortBy, sortOrder)
      .offset((page - 1) * limit)
      .limit(limit)
      .get();

    const systems = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        installationDate: data.installationDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as BessSystem;
    });

    return { systems, total };
  }

  /**
   * Get systems by IDs (for end users with allowedSystems)
   * This is used to filter systems based on user's allowedSystems array
   */
  async getSystemsByIds(
    systemIds: string[],
    pagination: PaginationParams = {}
  ): Promise<{ systems: BessSystem[]; total: number }> {
    if (systemIds.length === 0) {
      return { systems: [], total: 0 };
    }

    const { page = 1, limit = 20 } = pagination;

    // Firestore 'in' query has a limit of 30 items
    // For larger arrays, we need to batch the queries
    const batchSize = 10;
    const batches: string[][] = [];
    for (let i = 0; i < systemIds.length; i += batchSize) {
      batches.push(systemIds.slice(i, i + batchSize));
    }

    const allSystems: BessSystem[] = [];

    for (const batch of batches) {
      const snapshot = await this.db
        .collection(Collections.SYSTEMS)
        .where('__name__', 'in', batch)
        .where('isActive', '==', true)
        .get();

      const systems = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          installationDate: data.installationDate?.toDate() || new Date(),
          warrantyExpiration: data.warrantyExpiration?.toDate(),
          lastCommunication: data.lastCommunication?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as BessSystem;
      });

      allSystems.push(...systems);
    }

    // Sort by createdAt descending (most recent first)
    allSystems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const total = allSystems.length;
    const start = (page - 1) * limit;
    const paginatedSystems = allSystems.slice(start, start + limit);

    return { systems: paginatedSystems, total };
  }

  /**
   * Get systems overview for specific system IDs (for end users)
   */
  async getSystemsOverviewByIds(systemIds: string[]): Promise<{
    total: number;
    online: number;
    offline: number;
    error: number;
    charging: number;
    discharging: number;
  }> {
    if (systemIds.length === 0) {
      return { total: 0, online: 0, offline: 0, error: 0, charging: 0, discharging: 0 };
    }

    const { systems } = await this.getSystemsByIds(systemIds, { limit: 1000 });

    const overview = {
      total: 0,
      online: 0,
      offline: 0,
      error: 0,
      charging: 0,
      discharging: 0,
    };

    systems.forEach(system => {
      overview.total++;

      if (system.connectionStatus === ConnectionStatus.OFFLINE) {
        overview.offline++;
      } else {
        overview.online++;
      }

      if (system.status === SystemStatus.ERROR) {
        overview.error++;
      } else if (system.status === SystemStatus.CHARGING) {
        overview.charging++;
      } else if (system.status === SystemStatus.DISCHARGING) {
        overview.discharging++;
      }
    });

    return overview;
  }

  /**
   * Get systems with status (dashboard overview)
   */
  async getSystemsOverview(organizationId?: string): Promise<{
    total: number;
    online: number;
    offline: number;
    error: number;
    charging: number;
    discharging: number;
  }> {
    let query = this.db.collection(Collections.SYSTEMS).where('isActive', '==', true);

    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    const snapshot = await query.get();

    const overview = {
      total: 0,
      online: 0,
      offline: 0,
      error: 0,
      charging: 0,
      discharging: 0,
    };

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      overview.total++;

      if (data.connectionStatus === ConnectionStatus.OFFLINE) {
        overview.offline++;
      } else {
        overview.online++;
      }

      if (data.status === SystemStatus.ERROR) {
        overview.error++;
      } else if (data.status === SystemStatus.CHARGING) {
        overview.charging++;
      } else if (data.status === SystemStatus.DISCHARGING) {
        overview.discharging++;
      }
    });

    return overview;
  }
}

export const systemService = new SystemService();
