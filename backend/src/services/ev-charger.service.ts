/**
 * EV Charger Service for Lifo4 EMS
 * Handles OCPP 1.6/2.0 charger management, sessions, authorization,
 * smart charging, and BESS integration
 */

import { getFirestore, Collections } from '../config/firebase.js';
import {
  EVCharger,
  ChargingSession,
  SessionStatus,
  StopReason,
  ConnectorStatus,
  Connector,
  AuthorizationEntry,
  EVTariff,
  ChargingProfile,
  ProfilePurpose,
  ProfileKind,
  LoadBalancingConfig,
  ChargerPriority,
  EVChargerStatistics,
  OCPPCommand,
  OCPPCommandType,
  Reservation,
  MeterValue,
  CostBreakdown,
} from '../models/ev-charger.types.js';
import { NotFoundError, ConflictError, BadRequestError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Extend Collections for EV Charger specific collections
const EVCollections = {
  ...Collections,
  EV_CHARGERS: 'ev_chargers',
  CHARGING_SESSIONS: 'charging_sessions',
  CHARGING_PROFILES: 'charging_profiles',
  EV_TARIFFS: 'ev_tariffs',
  LOAD_BALANCING_CONFIGS: 'load_balancing_configs',
  OCPP_COMMANDS: 'ocpp_commands',
  RESERVATIONS: 'reservations',
  EV_CHARGER_STATISTICS: 'ev_charger_statistics',
  LOCAL_AUTH_LIST: 'local_auth_list',
} as const;

// Pagination parameters interface
interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Session query parameters
interface SessionQueryParams extends PaginationParams {
  chargerId?: string;
  connectorId?: number;
  userId?: string;
  status?: SessionStatus;
  startDate?: Date;
  endDate?: Date;
}

// Statistics query parameters
interface StatisticsQueryParams {
  chargerId?: string;
  siteId?: string;
  startDate: Date;
  endDate: Date;
}

// OCPP command result interface
interface OCPPCommandResult {
  success: boolean;
  commandId: string;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'timeout';
  response?: Record<string, unknown>;
  error?: string;
}

// Smart charging request interface
interface SmartChargingRequest {
  chargerId: string;
  connectorId?: number;
  requestedPower: number;
  priority?: number;
  vehicleSoc?: number;
  targetSoc?: number;
  departureTime?: Date;
}

// BESS integration status
interface BESSIntegrationStatus {
  available: boolean;
  currentSoc: number;
  availablePower: number;
  preferBessOverGrid: boolean;
}

export class EVChargerService {
  private db = getFirestore();

  // ============================================
  // CHARGER CRUD OPERATIONS
  // ============================================

  /**
   * Create a new EV charger
   */
  async createCharger(
    input: Omit<EVCharger, 'id' | 'createdAt' | 'updatedAt'>,
    organizationId: string
  ): Promise<EVCharger> {
    // Check for duplicate serial number
    const existingCharger = await this.db
      .collection(EVCollections.EV_CHARGERS)
      .where('serialNumber', '==', input.serialNumber)
      .get();

    if (!existingCharger.empty) {
      throw new ConflictError('EV Charger with this serial number already exists');
    }

    // Validate site exists and belongs to organization
    const siteDoc = await this.db.collection(Collections.SITES).doc(input.siteId).get();
    if (!siteDoc.exists) {
      throw new NotFoundError('Site');
    }

    const site = siteDoc.data();
    if (site?.organizationId !== organizationId) {
      throw new NotFoundError('Site');
    }

    const chargerRef = this.db.collection(EVCollections.EV_CHARGERS).doc();
    const now = new Date();

    const newCharger: Omit<EVCharger, 'id'> = {
      ...input,
      organizationId,
      status: {
        state: 'offline',
        ...input.status,
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await chargerRef.set(newCharger);

    logger.info(`New EV charger created: ${chargerRef.id}`, {
      serialNumber: input.serialNumber,
      siteId: input.siteId,
    });

    return { id: chargerRef.id, ...newCharger };
  }

  /**
   * Get charger by ID
   */
  async getChargerById(chargerId: string): Promise<EVCharger | null> {
    const doc = await this.db.collection(EVCollections.EV_CHARGERS).doc(chargerId).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapChargerDocument(doc);
  }

  /**
   * Get chargers by organization
   */
  async getChargersByOrganization(
    organizationId: string,
    pagination: PaginationParams = {}
  ): Promise<{ chargers: EVCharger[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const countSnapshot = await this.db
      .collection(EVCollections.EV_CHARGERS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .count()
      .get();

    const total = countSnapshot.data().count;

    const snapshot = await this.db
      .collection(EVCollections.EV_CHARGERS)
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .orderBy(sortBy, sortOrder)
      .offset((page - 1) * limit)
      .limit(limit)
      .get();

    const chargers = snapshot.docs.map(doc => this.mapChargerDocument(doc));

    return { chargers, total };
  }

  /**
   * Get chargers by site
   */
  async getChargersBySite(siteId: string): Promise<EVCharger[]> {
    const snapshot = await this.db
      .collection(EVCollections.EV_CHARGERS)
      .where('siteId', '==', siteId)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map(doc => this.mapChargerDocument(doc));
  }

  /**
   * Update charger
   */
  async updateCharger(
    chargerId: string,
    input: Partial<Omit<EVCharger, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<EVCharger> {
    const chargerRef = this.db.collection(EVCollections.EV_CHARGERS).doc(chargerId);
    const doc = await chargerRef.get();

    if (!doc.exists) {
      throw new NotFoundError('EV Charger');
    }

    await chargerRef.update({
      ...input,
      updatedAt: new Date(),
    });

    const updated = await this.getChargerById(chargerId);
    if (!updated) {
      throw new NotFoundError('EV Charger');
    }

    logger.info(`EV charger updated: ${chargerId}`);

    return updated;
  }

  /**
   * Delete charger (soft delete)
   */
  async deleteCharger(chargerId: string): Promise<void> {
    const chargerRef = this.db.collection(EVCollections.EV_CHARGERS).doc(chargerId);
    const doc = await chargerRef.get();

    if (!doc.exists) {
      throw new NotFoundError('EV Charger');
    }

    await chargerRef.update({
      isActive: false,
      updatedAt: new Date(),
    });

    logger.info(`EV charger deleted: ${chargerId}`);
  }

  /**
   * Update charger connector status
   */
  async updateConnectorStatus(
    chargerId: string,
    connectorId: number,
    status: ConnectorStatus,
    errorCode?: string
  ): Promise<void> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    const connectorIndex = charger.connectors.findIndex(c => c.id === connectorId);
    if (connectorIndex === -1) {
      throw new NotFoundError('Connector');
    }

    charger.connectors[connectorIndex].status = status;
    if (errorCode) {
      charger.connectors[connectorIndex].errorCode = errorCode;
    }

    await this.db.collection(EVCollections.EV_CHARGERS).doc(chargerId).update({
      connectors: charger.connectors,
      lastSeen: new Date(),
      updatedAt: new Date(),
    });

    logger.debug(`Connector ${connectorId} status updated to ${status} for charger ${chargerId}`);
  }

  // ============================================
  // CHARGING SESSION MANAGEMENT
  // ============================================

  /**
   * Start a new charging session
   */
  async startChargingSession(
    chargerId: string,
    connectorId: number,
    options: {
      idTag?: string;
      userId?: string;
      vehicleId?: string;
      meterStart: number;
      tariffId?: string;
    }
  ): Promise<ChargingSession> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    const connector = charger.connectors.find(c => c.id === connectorId);
    if (!connector) {
      throw new NotFoundError('Connector');
    }

    if (connector.status !== ConnectorStatus.PREPARING && connector.status !== ConnectorStatus.AVAILABLE) {
      throw new BadRequestError(`Connector is not available. Current status: ${connector.status}`);
    }

    // Check for existing active session
    const existingSession = await this.getCurrentSession(chargerId, connectorId);
    if (existingSession) {
      throw new ConflictError('An active charging session already exists on this connector');
    }

    const sessionRef = this.db.collection(EVCollections.CHARGING_SESSIONS).doc();
    const now = new Date();

    const newSession: Omit<ChargingSession, 'id'> = {
      chargerId,
      connectorId,
      siteId: charger.siteId,
      organizationId: charger.organizationId,
      idTag: options.idTag,
      userId: options.userId,
      vehicleId: options.vehicleId,
      startTime: now,
      energyDelivered: 0,
      meterStart: options.meterStart,
      maxPowerDelivered: 0,
      averagePower: 0,
      tariffId: options.tariffId || this.getDefaultTariffId(charger),
      status: SessionStatus.IN_PROGRESS,
      meterValues: [],
      createdAt: now,
      updatedAt: now,
    };

    await sessionRef.set(newSession);

    // Update connector status
    await this.updateConnectorStatus(chargerId, connectorId, ConnectorStatus.CHARGING);

    logger.info(`Charging session started: ${sessionRef.id}`, {
      chargerId,
      connectorId,
      userId: options.userId,
    });

    return { id: sessionRef.id, ...newSession };
  }

  /**
   * Stop a charging session
   */
  async stopChargingSession(
    sessionId: string,
    options: {
      meterEnd: number;
      stopReason: StopReason;
      vehicleSocEnd?: number;
    }
  ): Promise<ChargingSession> {
    const sessionRef = this.db.collection(EVCollections.CHARGING_SESSIONS).doc(sessionId);
    const doc = await sessionRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Charging Session');
    }

    const session = this.mapSessionDocument(doc);

    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestError(`Session is not in progress. Current status: ${session.status}`);
    }

    const now = new Date();
    const duration = Math.floor((now.getTime() - session.startTime.getTime()) / 1000);
    const energyDelivered = (options.meterEnd - session.meterStart) / 1000; // Wh to kWh

    // Calculate cost
    const costBreakdown = await this.calculateSessionCost(session, energyDelivered, duration);

    const updateData: Partial<ChargingSession> = {
      endTime: now,
      duration,
      energyDelivered,
      meterEnd: options.meterEnd,
      vehicleSocEnd: options.vehicleSocEnd,
      status: SessionStatus.COMPLETED,
      stopReason: options.stopReason,
      costBreakdown,
      totalCost: costBreakdown.energyCost + costBreakdown.timeCost +
                 costBreakdown.connectionFee + costBreakdown.idleFee,
      updatedAt: now,
    };

    await sessionRef.update(updateData);

    // Update connector status
    await this.updateConnectorStatus(session.chargerId, session.connectorId, ConnectorStatus.FINISHING);

    logger.info(`Charging session stopped: ${sessionId}`, {
      duration,
      energyDelivered,
      stopReason: options.stopReason,
    });

    return { ...session, ...updateData } as ChargingSession;
  }

  /**
   * Get current active session for a connector
   */
  async getCurrentSession(chargerId: string, connectorId: number): Promise<ChargingSession | null> {
    const snapshot = await this.db
      .collection(EVCollections.CHARGING_SESSIONS)
      .where('chargerId', '==', chargerId)
      .where('connectorId', '==', connectorId)
      .where('status', '==', SessionStatus.IN_PROGRESS)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.mapSessionDocument(snapshot.docs[0]);
  }

  /**
   * Get session history
   */
  async getSessionHistory(
    organizationId: string,
    params: SessionQueryParams = {}
  ): Promise<{ sessions: ChargingSession[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'startTime', sortOrder = 'desc' } = params;

    let query = this.db
      .collection(EVCollections.CHARGING_SESSIONS)
      .where('organizationId', '==', organizationId) as FirebaseFirestore.Query;

    if (params.chargerId) {
      query = query.where('chargerId', '==', params.chargerId);
    }

    if (params.connectorId !== undefined) {
      query = query.where('connectorId', '==', params.connectorId);
    }

    if (params.userId) {
      query = query.where('userId', '==', params.userId);
    }

    if (params.status) {
      query = query.where('status', '==', params.status);
    }

    if (params.startDate) {
      query = query.where('startTime', '>=', params.startDate);
    }

    if (params.endDate) {
      query = query.where('startTime', '<=', params.endDate);
    }

    // Get total count
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    // Get paginated data
    const snapshot = await query
      .orderBy(sortBy, sortOrder)
      .offset((page - 1) * limit)
      .limit(limit)
      .get();

    const sessions = snapshot.docs.map(doc => this.mapSessionDocument(doc));

    return { sessions, total };
  }

  /**
   * Update meter values for an active session
   */
  async updateMeterValues(sessionId: string, meterValue: MeterValue): Promise<void> {
    const sessionRef = this.db.collection(EVCollections.CHARGING_SESSIONS).doc(sessionId);
    const doc = await sessionRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Charging Session');
    }

    const session = this.mapSessionDocument(doc);
    session.meterValues.push(meterValue);

    // Update average and max power from meter values
    const powerValues = meterValue.sampled
      .filter(s => s.measurand?.includes('Power.Active.Import'))
      .map(s => parseFloat(s.value));

    if (powerValues.length > 0) {
      const currentPower = Math.max(...powerValues) / 1000; // W to kW
      const maxPower = Math.max(session.maxPowerDelivered, currentPower);

      await sessionRef.update({
        meterValues: session.meterValues,
        maxPowerDelivered: maxPower,
        updatedAt: new Date(),
      });
    } else {
      await sessionRef.update({
        meterValues: session.meterValues,
        updatedAt: new Date(),
      });
    }
  }

  // ============================================
  // AUTHORIZATION MANAGEMENT
  // ============================================

  /**
   * Authorize an ID tag (RFID, app, etc.)
   */
  async authorize(
    chargerId: string,
    idTag: string
  ): Promise<{ authorized: boolean; entry?: AuthorizationEntry; reason?: string }> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      return { authorized: false, reason: 'Charger not found' };
    }

    // Check if free vend is enabled
    if (charger.configuration.freeVendEnabled) {
      return { authorized: true };
    }

    // Check if authorization is required
    if (!charger.configuration.authorizationEnabled) {
      return { authorized: true };
    }

    // Check local auth list
    const localEntry = charger.configuration.localAuthList.find(e => e.idTag === idTag);
    if (localEntry) {
      if (localEntry.status === 'blocked') {
        return { authorized: false, entry: localEntry, reason: 'ID tag is blocked' };
      }
      if (localEntry.status === 'expired' || (localEntry.expiryDate && localEntry.expiryDate < new Date())) {
        return { authorized: false, entry: localEntry, reason: 'ID tag has expired' };
      }
      if (localEntry.status === 'accepted') {
        return { authorized: true, entry: localEntry };
      }
    }

    // Check central auth list
    const centralEntry = await this.getCentralAuthEntry(chargerId, idTag);
    if (centralEntry) {
      if (centralEntry.status === 'accepted') {
        return { authorized: true, entry: centralEntry };
      }
      return { authorized: false, entry: centralEntry, reason: `ID tag status: ${centralEntry.status}` };
    }

    return { authorized: false, reason: 'ID tag not found' };
  }

  /**
   * Add authorization entry to local list
   */
  async addAuthorizationEntry(
    chargerId: string,
    entry: Omit<AuthorizationEntry, 'status'> & { status?: AuthorizationEntry['status'] }
  ): Promise<AuthorizationEntry> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    const newEntry: AuthorizationEntry = {
      ...entry,
      status: entry.status || 'accepted',
    };

    // Check for duplicate
    const existingIndex = charger.configuration.localAuthList.findIndex(e => e.idTag === entry.idTag);
    if (existingIndex >= 0) {
      charger.configuration.localAuthList[existingIndex] = newEntry;
    } else {
      charger.configuration.localAuthList.push(newEntry);
    }

    await this.db.collection(EVCollections.EV_CHARGERS).doc(chargerId).update({
      'configuration.localAuthList': charger.configuration.localAuthList,
      updatedAt: new Date(),
    });

    // Queue OCPP SendLocalList command
    await this.queueOCPPCommand(chargerId, OCPPCommandType.SEND_LOCAL_LIST, {
      listVersion: Date.now(),
      updateType: 'Differential',
      localAuthorizationList: [newEntry],
    });

    logger.info(`Authorization entry added for charger ${chargerId}`, { idTag: entry.idTag });

    return newEntry;
  }

  /**
   * Remove authorization entry
   */
  async removeAuthorizationEntry(chargerId: string, idTag: string): Promise<void> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    charger.configuration.localAuthList = charger.configuration.localAuthList.filter(
      e => e.idTag !== idTag
    );

    await this.db.collection(EVCollections.EV_CHARGERS).doc(chargerId).update({
      'configuration.localAuthList': charger.configuration.localAuthList,
      updatedAt: new Date(),
    });

    logger.info(`Authorization entry removed for charger ${chargerId}`, { idTag });
  }

  /**
   * Get authorization entry from central system
   */
  private async getCentralAuthEntry(
    chargerId: string,
    idTag: string
  ): Promise<AuthorizationEntry | null> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      return null;
    }

    const snapshot = await this.db
      .collection(EVCollections.LOCAL_AUTH_LIST)
      .where('organizationId', '==', charger.organizationId)
      .where('idTag', '==', idTag)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as AuthorizationEntry;
  }

  // ============================================
  // TARIFF MANAGEMENT
  // ============================================

  /**
   * Create a new tariff
   */
  async createTariff(
    organizationId: string,
    input: Omit<EVTariff, 'id'>
  ): Promise<EVTariff> {
    const tariffRef = this.db.collection(EVCollections.EV_TARIFFS).doc();

    // If this is default, unset other defaults
    if (input.isDefault) {
      await this.unsetDefaultTariffs(organizationId);
    }

    const newTariff: EVTariff = {
      id: tariffRef.id,
      ...input,
    };

    await tariffRef.set({
      ...newTariff,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info(`Tariff created: ${tariffRef.id}`, { name: input.name });

    return newTariff;
  }

  /**
   * Get tariffs for organization
   */
  async getTariffs(organizationId: string): Promise<EVTariff[]> {
    const snapshot = await this.db
      .collection(EVCollections.EV_TARIFFS)
      .where('organizationId', '==', organizationId)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as EVTariff[];
  }

  /**
   * Get applicable tariff for a session
   */
  async getApplicableTariff(
    organizationId: string,
    userId?: string,
    groupId?: string,
    timestamp: Date = new Date()
  ): Promise<EVTariff | null> {
    const tariffs = await this.getTariffs(organizationId);

    // Filter by time and day validity
    const dayOfWeek = timestamp.getDay();
    const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

    const validTariffs = tariffs.filter(t => {
      // Check date validity
      if (t.validFrom && t.validFrom > timestamp) return false;
      if (t.validUntil && t.validUntil < timestamp) return false;

      // Check day of week
      if (t.daysOfWeek && t.daysOfWeek.length > 0 && !t.daysOfWeek.includes(dayOfWeek)) return false;

      // Check time of day
      if (t.startTime && t.endTime) {
        if (timeStr < t.startTime || timeStr > t.endTime) return false;
      }

      // Check group eligibility
      if (t.groupIds && t.groupIds.length > 0) {
        if (!groupId || !t.groupIds.includes(groupId)) return false;
      }

      return true;
    });

    // Return most specific tariff or default
    if (validTariffs.length > 0) {
      // Prefer group-specific tariffs
      const groupTariff = validTariffs.find(t => t.groupIds && t.groupIds.length > 0);
      if (groupTariff) return groupTariff;

      return validTariffs[0];
    }

    // Return default tariff
    return tariffs.find(t => t.isDefault) || null;
  }

  /**
   * Update tariff
   */
  async updateTariff(
    tariffId: string,
    input: Partial<Omit<EVTariff, 'id'>>
  ): Promise<EVTariff> {
    const tariffRef = this.db.collection(EVCollections.EV_TARIFFS).doc(tariffId);
    const doc = await tariffRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Tariff');
    }

    await tariffRef.update({
      ...input,
      updatedAt: new Date(),
    });

    const updated = await tariffRef.get();
    return { id: tariffId, ...updated.data() } as EVTariff;
  }

  /**
   * Delete tariff
   */
  async deleteTariff(tariffId: string): Promise<void> {
    const tariffRef = this.db.collection(EVCollections.EV_TARIFFS).doc(tariffId);
    const doc = await tariffRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Tariff');
    }

    const tariff = doc.data() as EVTariff;
    if (tariff.isDefault) {
      throw new BadRequestError('Cannot delete default tariff');
    }

    await tariffRef.delete();

    logger.info(`Tariff deleted: ${tariffId}`);
  }

  private async unsetDefaultTariffs(organizationId: string): Promise<void> {
    const snapshot = await this.db
      .collection(EVCollections.EV_TARIFFS)
      .where('organizationId', '==', organizationId)
      .where('isDefault', '==', true)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isDefault: false, updatedAt: new Date() });
    });

    await batch.commit();
  }

  private getDefaultTariffId(charger: EVCharger): string | undefined {
    const defaultTariff = charger.configuration.tariffs.find(t => t.isDefault);
    return defaultTariff?.id;
  }

  // ============================================
  // SMART CHARGING PROFILE MANAGEMENT
  // ============================================

  /**
   * Create or update a charging profile
   */
  async setChargingProfile(
    profile: Omit<ChargingProfile, 'id'>
  ): Promise<ChargingProfile> {
    const profileRef = this.db.collection(EVCollections.CHARGING_PROFILES).doc();

    const newProfile: ChargingProfile = {
      id: profileRef.id,
      ...profile,
    };

    await profileRef.set({
      ...newProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // If charger specific, update charger and queue OCPP command
    if (profile.chargerId) {
      await this.db.collection(EVCollections.EV_CHARGERS).doc(profile.chargerId).update({
        chargingProfile: newProfile,
        updatedAt: new Date(),
      });

      await this.queueOCPPCommand(profile.chargerId, OCPPCommandType.SET_CHARGING_PROFILE, {
        connectorId: profile.connectorId || 0,
        csChargingProfiles: newProfile,
      });
    }

    logger.info(`Charging profile created: ${profileRef.id}`, {
      chargerId: profile.chargerId,
      purpose: profile.profilePurpose,
    });

    return newProfile;
  }

  /**
   * Get charging profile by ID
   */
  async getChargingProfile(profileId: string): Promise<ChargingProfile | null> {
    const doc = await this.db.collection(EVCollections.CHARGING_PROFILES).doc(profileId).get();

    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as ChargingProfile;
  }

  /**
   * Get charging profiles for a charger
   */
  async getChargingProfiles(chargerId: string): Promise<ChargingProfile[]> {
    const snapshot = await this.db
      .collection(EVCollections.CHARGING_PROFILES)
      .where('chargerId', '==', chargerId)
      .orderBy('stackLevel', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ChargingProfile[];
  }

  /**
   * Clear charging profile
   */
  async clearChargingProfile(
    chargerId: string,
    options?: {
      profileId?: string;
      connectorId?: number;
      profilePurpose?: ProfilePurpose;
      stackLevel?: number;
    }
  ): Promise<void> {
    let query = this.db
      .collection(EVCollections.CHARGING_PROFILES)
      .where('chargerId', '==', chargerId) as FirebaseFirestore.Query;

    if (options?.connectorId !== undefined) {
      query = query.where('connectorId', '==', options.connectorId);
    }

    if (options?.profilePurpose) {
      query = query.where('profilePurpose', '==', options.profilePurpose);
    }

    if (options?.stackLevel !== undefined) {
      query = query.where('stackLevel', '==', options.stackLevel);
    }

    const snapshot = await query.get();
    const batch = this.db.batch();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Queue OCPP command
    await this.queueOCPPCommand(chargerId, OCPPCommandType.CLEAR_CHARGING_PROFILE, {
      id: options?.profileId,
      connectorId: options?.connectorId,
      chargingProfilePurpose: options?.profilePurpose,
      stackLevel: options?.stackLevel,
    });

    logger.info(`Charging profiles cleared for charger ${chargerId}`);
  }

  /**
   * Get composite schedule for a connector
   */
  async getCompositeSchedule(
    chargerId: string,
    connectorId: number,
    duration: number
  ): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.GET_COMPOSITE_SCHEDULE, {
      connectorId,
      duration,
      chargingRateUnit: 'W',
    });
  }

  // ============================================
  // LOAD BALANCING CONFIGURATION
  // ============================================

  /**
   * Set load balancing configuration for a site
   */
  async setLoadBalancingConfig(config: LoadBalancingConfig): Promise<LoadBalancingConfig> {
    const configRef = this.db.collection(EVCollections.LOAD_BALANCING_CONFIGS).doc(config.siteId);

    await configRef.set({
      ...config,
      updatedAt: new Date(),
    });

    logger.info(`Load balancing config updated for site ${config.siteId}`);

    return config;
  }

  /**
   * Get load balancing configuration for a site
   */
  async getLoadBalancingConfig(siteId: string): Promise<LoadBalancingConfig | null> {
    const doc = await this.db.collection(EVCollections.LOAD_BALANCING_CONFIGS).doc(siteId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as LoadBalancingConfig;
  }

  /**
   * Calculate power allocation for chargers
   */
  async calculatePowerAllocation(siteId: string): Promise<Map<string, number>> {
    const config = await this.getLoadBalancingConfig(siteId);
    if (!config || !config.enabled) {
      return new Map();
    }

    const chargers = await this.getChargersBySite(siteId);
    const activeChargers = chargers.filter(c =>
      c.status.state === 'online' &&
      c.connectors.some(conn => conn.status === ConnectorStatus.CHARGING)
    );

    if (activeChargers.length === 0) {
      return new Map();
    }

    let availablePower = config.maxSitePower;

    // Check BESS integration
    if (config.bessIntegration?.enabled) {
      const bessStatus = await this.getBESSIntegrationStatus(config.bessIntegration.systemId);
      if (bessStatus.available && bessStatus.preferBessOverGrid) {
        availablePower += bessStatus.availablePower;
      }
    }

    // Check grid constraints
    if (config.gridConstraint?.enabled) {
      availablePower = Math.min(availablePower, config.gridConstraint.maxImportPower);
    }

    const allocation = new Map<string, number>();

    switch (config.priorityMode) {
      case 'equal':
        const equalShare = availablePower / activeChargers.length;
        activeChargers.forEach(c => {
          allocation.set(c.id, Math.min(equalShare, c.specifications.maxPower));
        });
        break;

      case 'fifo':
        // Sort by session start time
        const sortedChargers = [...activeChargers].sort((a, b) => {
          const sessionA = a.connectors.find(c => c.currentSession)?.currentSession;
          const sessionB = b.connectors.find(c => c.currentSession)?.currentSession;
          return (sessionA?.startTime.getTime() || 0) - (sessionB?.startTime.getTime() || 0);
        });

        let remainingPower = availablePower;
        for (const charger of sortedChargers) {
          const allocatedPower = Math.min(remainingPower, charger.specifications.maxPower);
          allocation.set(charger.id, allocatedPower);
          remainingPower -= allocatedPower;
          if (remainingPower <= 0) break;
        }
        break;

      case 'priority_based':
        const priorities = config.chargerPriorities || [];
        const priorityMap = new Map(priorities.map(p => [p.chargerId, p]));

        // Sort by priority (higher first)
        const prioritizedChargers = [...activeChargers].sort((a, b) => {
          const priorityA = priorityMap.get(a.id)?.priority || 0;
          const priorityB = priorityMap.get(b.id)?.priority || 0;
          return priorityB - priorityA;
        });

        let powerLeft = availablePower;

        // First pass: allocate minimum power
        for (const charger of prioritizedChargers) {
          const priority = priorityMap.get(charger.id);
          const minPower = priority?.minPower || 0;
          allocation.set(charger.id, minPower);
          powerLeft -= minPower;
        }

        // Second pass: allocate remaining power by priority
        for (const charger of prioritizedChargers) {
          if (powerLeft <= 0) break;
          const currentAllocation = allocation.get(charger.id) || 0;
          const maxAllocation = Math.min(
            powerLeft + currentAllocation,
            charger.specifications.maxPower
          );
          const additionalPower = maxAllocation - currentAllocation;
          allocation.set(charger.id, maxAllocation);
          powerLeft -= additionalPower;
        }
        break;
    }

    return allocation;
  }

  /**
   * Apply power allocation to chargers
   */
  async applyPowerAllocation(siteId: string): Promise<void> {
    const allocation = await this.calculatePowerAllocation(siteId);

    for (const [chargerId, power] of allocation) {
      // Create a temporary charging profile for power limit
      await this.setChargingProfile({
        chargerId,
        stackLevel: 0,
        profilePurpose: ProfilePurpose.CHARGE_POINT_MAX_PROFILE,
        kind: ProfileKind.ABSOLUTE,
        schedule: [
          {
            startPeriod: 0,
            limit: power * 1000, // kW to W
          },
        ],
      });
    }

    logger.info(`Power allocation applied for site ${siteId}`, {
      allocations: Object.fromEntries(allocation),
    });
  }

  // ============================================
  // OCPP COMMAND QUEUING AND STATUS TRACKING
  // ============================================

  /**
   * Queue an OCPP command for a charger
   */
  async queueOCPPCommand(
    chargerId: string,
    type: OCPPCommandType,
    payload: Record<string, unknown>,
    connectorId?: number
  ): Promise<OCPPCommandResult> {
    const commandRef = this.db.collection(EVCollections.OCPP_COMMANDS).doc();

    const command: Omit<OCPPCommand, 'response' | 'error'> = {
      type,
      chargerId,
      connectorId,
      payload,
      timestamp: new Date(),
      status: 'pending',
    };

    await commandRef.set(command);

    logger.debug(`OCPP command queued: ${type}`, { chargerId, commandId: commandRef.id });

    return {
      success: true,
      commandId: commandRef.id,
      status: 'pending',
    };
  }

  /**
   * Get pending OCPP commands for a charger
   */
  async getPendingCommands(chargerId: string): Promise<OCPPCommand[]> {
    const snapshot = await this.db
      .collection(EVCollections.OCPP_COMMANDS)
      .where('chargerId', '==', chargerId)
      .where('status', '==', 'pending')
      .orderBy('timestamp', 'asc')
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as OCPPCommand[];
  }

  /**
   * Update OCPP command status
   */
  async updateCommandStatus(
    commandId: string,
    status: OCPPCommand['status'],
    response?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const commandRef = this.db.collection(EVCollections.OCPP_COMMANDS).doc(commandId);

    await commandRef.update({
      status,
      response,
      error,
      updatedAt: new Date(),
    });

    logger.debug(`OCPP command status updated: ${commandId}`, { status });
  }

  /**
   * Get command status
   */
  async getCommandStatus(commandId: string): Promise<OCPPCommand | null> {
    const doc = await this.db.collection(EVCollections.OCPP_COMMANDS).doc(commandId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      ...data,
      timestamp: data?.timestamp?.toDate() || new Date(),
    } as OCPPCommand;
  }

  // ============================================
  // OCPP 1.6 COMMAND STUBS
  // ============================================

  /**
   * OCPP 1.6: Remote Start Transaction
   */
  async remoteStartTransaction(
    chargerId: string,
    connectorId: number,
    idTag: string,
    chargingProfile?: ChargingProfile
  ): Promise<OCPPCommandResult> {
    const payload: Record<string, unknown> = {
      connectorId,
      idTag,
    };

    if (chargingProfile) {
      payload.chargingProfile = chargingProfile;
    }

    return this.queueOCPPCommand(chargerId, OCPPCommandType.REMOTE_START_TRANSACTION, payload, connectorId);
  }

  /**
   * OCPP 1.6: Remote Stop Transaction
   */
  async remoteStopTransaction(chargerId: string, transactionId: number): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.REMOTE_STOP_TRANSACTION, {
      transactionId,
    });
  }

  /**
   * OCPP 1.6: Reset Charger
   */
  async resetCharger(chargerId: string, type: 'Hard' | 'Soft'): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.RESET, { type });
  }

  /**
   * OCPP 1.6: Unlock Connector
   */
  async unlockConnector(chargerId: string, connectorId: number): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.UNLOCK_CONNECTOR, { connectorId }, connectorId);
  }

  /**
   * OCPP 1.6: Change Availability
   */
  async changeAvailability(
    chargerId: string,
    connectorId: number,
    type: 'Inoperative' | 'Operative'
  ): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.CHANGE_AVAILABILITY, {
      connectorId,
      type,
    }, connectorId);
  }

  /**
   * OCPP 1.6: Get Configuration
   */
  async getConfiguration(chargerId: string, keys?: string[]): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.GET_CONFIGURATION, {
      key: keys,
    });
  }

  /**
   * OCPP 1.6: Change Configuration
   */
  async changeConfiguration(chargerId: string, key: string, value: string): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.CHANGE_CONFIGURATION, {
      key,
      value,
    });
  }

  /**
   * OCPP 1.6: Clear Cache
   */
  async clearCache(chargerId: string): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.CLEAR_CACHE, {});
  }

  /**
   * OCPP 1.6: Trigger Message
   */
  async triggerMessage(
    chargerId: string,
    requestedMessage: string,
    connectorId?: number
  ): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.TRIGGER_MESSAGE, {
      requestedMessage,
      connectorId,
    }, connectorId);
  }

  /**
   * OCPP 1.6: Update Firmware
   */
  async updateFirmware(
    chargerId: string,
    location: string,
    retrieveDate: Date,
    retries?: number,
    retryInterval?: number
  ): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.UPDATE_FIRMWARE, {
      location,
      retrieveDate: retrieveDate.toISOString(),
      retries,
      retryInterval,
    });
  }

  /**
   * OCPP 1.6: Get Diagnostics
   */
  async getDiagnostics(
    chargerId: string,
    location: string,
    options?: {
      startTime?: Date;
      stopTime?: Date;
      retries?: number;
      retryInterval?: number;
    }
  ): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.GET_DIAGNOSTICS, {
      location,
      startTime: options?.startTime?.toISOString(),
      stopTime: options?.stopTime?.toISOString(),
      retries: options?.retries,
      retryInterval: options?.retryInterval,
    });
  }

  // ============================================
  // OCPP 2.0 COMMAND STUBS
  // ============================================

  /**
   * OCPP 2.0: Request Start Transaction
   */
  async requestStartTransaction_OCPP20(
    chargerId: string,
    evseId: number,
    idToken: { idToken: string; type: string },
    chargingProfile?: ChargingProfile
  ): Promise<OCPPCommandResult> {
    const payload: Record<string, unknown> = {
      evseId,
      idToken,
    };

    if (chargingProfile) {
      payload.chargingProfile = chargingProfile;
    }

    return this.queueOCPPCommand(chargerId, OCPPCommandType.REMOTE_START_TRANSACTION, payload, evseId);
  }

  /**
   * OCPP 2.0: Request Stop Transaction
   */
  async requestStopTransaction_OCPP20(chargerId: string, transactionId: string): Promise<OCPPCommandResult> {
    return this.queueOCPPCommand(chargerId, OCPPCommandType.REMOTE_STOP_TRANSACTION, {
      transactionId,
    });
  }

  // ============================================
  // RESERVATION MANAGEMENT
  // ============================================

  /**
   * Create a reservation
   */
  async createReservation(
    chargerId: string,
    connectorId: number,
    userId: string,
    idTag: string,
    startTime: Date,
    expiryTime: Date
  ): Promise<Reservation> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    if (!charger.configuration.reservationEnabled) {
      throw new BadRequestError('Reservations are not enabled for this charger');
    }

    const connector = charger.connectors.find(c => c.id === connectorId);
    if (!connector) {
      throw new NotFoundError('Connector');
    }

    // Check for existing reservations
    const existingReservation = await this.getActiveReservation(chargerId, connectorId);
    if (existingReservation) {
      throw new ConflictError('A reservation already exists for this connector');
    }

    // Check if connector is available
    if (connector.status !== ConnectorStatus.AVAILABLE) {
      throw new BadRequestError(`Connector is not available. Current status: ${connector.status}`);
    }

    const reservationRef = this.db.collection(EVCollections.RESERVATIONS).doc();
    const now = new Date();

    const reservation: Omit<Reservation, 'id'> = {
      chargerId,
      connectorId,
      userId,
      idTag,
      startTime,
      expiryTime,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await reservationRef.set(reservation);

    // Queue OCPP ReserveNow command
    await this.queueOCPPCommand(chargerId, OCPPCommandType.RESERVE_NOW, {
      connectorId,
      expiryDate: expiryTime.toISOString(),
      idTag,
      reservationId: parseInt(reservationRef.id.slice(-8), 16), // Convert to numeric ID
    }, connectorId);

    logger.info(`Reservation created: ${reservationRef.id}`, { chargerId, connectorId, userId });

    return { id: reservationRef.id, ...reservation };
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(reservationId: string): Promise<void> {
    const reservationRef = this.db.collection(EVCollections.RESERVATIONS).doc(reservationId);
    const doc = await reservationRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Reservation');
    }

    const reservation = doc.data() as Reservation;

    if (reservation.status !== 'pending' && reservation.status !== 'active') {
      throw new BadRequestError(`Cannot cancel reservation with status: ${reservation.status}`);
    }

    await reservationRef.update({
      status: 'cancelled',
      updatedAt: new Date(),
    });

    // Queue OCPP CancelReservation command
    await this.queueOCPPCommand(reservation.chargerId, OCPPCommandType.CANCEL_RESERVATION, {
      reservationId: parseInt(reservationId.slice(-8), 16),
    }, reservation.connectorId);

    logger.info(`Reservation cancelled: ${reservationId}`);
  }

  /**
   * Get active reservation for a connector
   */
  async getActiveReservation(chargerId: string, connectorId: number): Promise<Reservation | null> {
    const now = new Date();
    const snapshot = await this.db
      .collection(EVCollections.RESERVATIONS)
      .where('chargerId', '==', chargerId)
      .where('connectorId', '==', connectorId)
      .where('status', 'in', ['pending', 'active'])
      .where('expiryTime', '>', now)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.mapReservationDocument(doc);
  }

  /**
   * Get user reservations
   */
  async getUserReservations(userId: string): Promise<Reservation[]> {
    const snapshot = await this.db
      .collection(EVCollections.RESERVATIONS)
      .where('userId', '==', userId)
      .orderBy('startTime', 'desc')
      .get();

    return snapshot.docs.map(doc => this.mapReservationDocument(doc));
  }

  /**
   * Mark reservation as used when session starts
   */
  async useReservation(reservationId: string, sessionId: string): Promise<void> {
    const reservationRef = this.db.collection(EVCollections.RESERVATIONS).doc(reservationId);

    await reservationRef.update({
      status: 'used',
      sessionId,
      updatedAt: new Date(),
    });

    logger.info(`Reservation used: ${reservationId}`, { sessionId });
  }

  // ============================================
  // STATISTICS AGGREGATION
  // ============================================

  /**
   * Get charger statistics
   */
  async getChargerStatistics(params: StatisticsQueryParams): Promise<EVChargerStatistics | null> {
    const { chargerId, siteId, startDate, endDate } = params;

    if (!chargerId && !siteId) {
      throw new ValidationError('Either chargerId or siteId must be provided');
    }

    let sessionsQuery = this.db
      .collection(EVCollections.CHARGING_SESSIONS)
      .where('startTime', '>=', startDate)
      .where('startTime', '<=', endDate) as FirebaseFirestore.Query;

    if (chargerId) {
      sessionsQuery = sessionsQuery.where('chargerId', '==', chargerId);
    } else if (siteId) {
      sessionsQuery = sessionsQuery.where('siteId', '==', siteId);
    }

    const sessionsSnapshot = await sessionsQuery.get();
    const sessions = sessionsSnapshot.docs.map(doc => this.mapSessionDocument(doc));

    if (sessions.length === 0) {
      return null;
    }

    // Calculate statistics
    const completedSessions = sessions.filter(s => s.status === SessionStatus.COMPLETED);
    const failedSessions = sessions.filter(s => s.status === SessionStatus.FAILED);

    const totalEnergy = completedSessions.reduce((sum, s) => sum + s.energyDelivered, 0);
    const totalRevenue = completedSessions.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const peakPower = Math.max(...completedSessions.map(s => s.maxPowerDelivered));
    const avgPower = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.averagePower, 0) / completedSessions.length
      : 0;

    // Calculate utilization
    const periodDuration = (endDate.getTime() - startDate.getTime()) / 1000;
    const utilizationRate = periodDuration > 0 ? (totalDuration / periodDuration) * 100 : 0;

    // Calculate peak hour
    const hourCounts = new Array(24).fill(0);
    completedSessions.forEach(s => {
      const hour = s.startTime.getHours();
      hourCounts[hour]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Calculate unique users and top users
    const userStats = new Map<string, { sessions: number; energy: number }>();
    completedSessions.forEach(s => {
      if (s.userId) {
        const current = userStats.get(s.userId) || { sessions: 0, energy: 0 };
        userStats.set(s.userId, {
          sessions: current.sessions + 1,
          energy: current.energy + s.energyDelivered,
        });
      }
    });

    const topUsers = Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    // Calculate uptime (simplified - based on session availability)
    const daysInPeriod = Math.ceil(periodDuration / 86400);
    const sessionsPerDay = sessions.length / daysInPeriod;

    const statistics: EVChargerStatistics = {
      chargerId: chargerId || siteId || '',
      period: { start: startDate, end: endDate },
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      failedSessions: failedSessions.length,
      averageSessionDuration: completedSessions.length > 0 ? totalDuration / completedSessions.length / 60 : 0,
      averageSessionEnergy: completedSessions.length > 0 ? totalEnergy / completedSessions.length : 0,
      totalEnergyDelivered: totalEnergy,
      peakPowerDelivered: peakPower,
      averagePower: avgPower,
      totalRevenue,
      averageRevenuePerSession: completedSessions.length > 0 ? totalRevenue / completedSessions.length : 0,
      utilizationRate: Math.min(utilizationRate, 100),
      peakHour,
      sessionsPerDay,
      uniqueUsers: userStats.size,
      topUsers,
      uptimePercentage: 99, // Placeholder - would be calculated from status history
      totalDowntime: 0,
      faultCount: failedSessions.length,
    };

    // Store statistics for historical reference
    await this.storeStatistics(statistics);

    return statistics;
  }

  /**
   * Store calculated statistics
   */
  private async storeStatistics(statistics: EVChargerStatistics): Promise<void> {
    const docId = `${statistics.chargerId}_${statistics.period.start.toISOString().split('T')[0]}_${statistics.period.end.toISOString().split('T')[0]}`;

    await this.db.collection(EVCollections.EV_CHARGER_STATISTICS).doc(docId).set({
      ...statistics,
      calculatedAt: new Date(),
    });
  }

  /**
   * Get aggregated statistics for multiple chargers
   */
  async getAggregatedStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EVChargerStatistics> {
    const chargers = await this.getChargersByOrganization(organizationId, { limit: 1000 });

    let totalSessions = 0;
    let completedSessions = 0;
    let failedSessions = 0;
    let totalEnergy = 0;
    let totalRevenue = 0;
    let totalDuration = 0;
    let peakPower = 0;
    let allSessionsCount = 0;
    let avgPowerSum = 0;

    for (const charger of chargers.chargers) {
      const stats = await this.getChargerStatistics({
        chargerId: charger.id,
        startDate,
        endDate,
      });

      if (stats) {
        totalSessions += stats.totalSessions;
        completedSessions += stats.completedSessions;
        failedSessions += stats.failedSessions;
        totalEnergy += stats.totalEnergyDelivered;
        totalRevenue += stats.totalRevenue;
        totalDuration += stats.averageSessionDuration * stats.completedSessions;
        peakPower = Math.max(peakPower, stats.peakPowerDelivered);
        avgPowerSum += stats.averagePower * stats.completedSessions;
        allSessionsCount += stats.completedSessions;
      }
    }

    return {
      chargerId: 'aggregated',
      period: { start: startDate, end: endDate },
      totalSessions,
      completedSessions,
      failedSessions,
      averageSessionDuration: allSessionsCount > 0 ? totalDuration / allSessionsCount : 0,
      averageSessionEnergy: completedSessions > 0 ? totalEnergy / completedSessions : 0,
      totalEnergyDelivered: totalEnergy,
      peakPowerDelivered: peakPower,
      averagePower: allSessionsCount > 0 ? avgPowerSum / allSessionsCount : 0,
      totalRevenue,
      averageRevenuePerSession: completedSessions > 0 ? totalRevenue / completedSessions : 0,
      utilizationRate: 0, // Aggregate utilization would need different calculation
      peakHour: 0,
      sessionsPerDay: 0,
      uniqueUsers: 0,
      topUsers: [],
      uptimePercentage: 0,
      totalDowntime: 0,
      faultCount: failedSessions,
    };
  }

  // ============================================
  // BESS INTEGRATION FOR SMART CHARGING
  // ============================================

  /**
   * Get BESS integration status
   */
  private async getBESSIntegrationStatus(systemId: string): Promise<BESSIntegrationStatus> {
    // Fetch BESS system status from telemetry
    const telemetryDoc = await this.db.collection(Collections.TELEMETRY).doc(systemId).get();

    if (!telemetryDoc.exists) {
      return {
        available: false,
        currentSoc: 0,
        availablePower: 0,
        preferBessOverGrid: false,
      };
    }

    const telemetry = telemetryDoc.data();

    return {
      available: true,
      currentSoc: telemetry?.soc || 0,
      availablePower: telemetry?.power ? Math.abs(telemetry.power) : 0,
      preferBessOverGrid: true,
    };
  }

  /**
   * Request smart charging power from BESS
   */
  async requestSmartChargingPower(request: SmartChargingRequest): Promise<{
    allocated: boolean;
    power: number;
    source: 'grid' | 'bess' | 'hybrid';
  }> {
    const charger = await this.getChargerById(request.chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    const loadBalancingConfig = await this.getLoadBalancingConfig(charger.siteId);

    // If no load balancing or BESS integration, return grid power
    if (!loadBalancingConfig?.bessIntegration?.enabled) {
      return {
        allocated: true,
        power: Math.min(request.requestedPower, charger.specifications.maxPower),
        source: 'grid',
      };
    }

    const bessStatus = await this.getBESSIntegrationStatus(loadBalancingConfig.bessIntegration.systemId);

    if (!bessStatus.available) {
      return {
        allocated: true,
        power: Math.min(request.requestedPower, charger.specifications.maxPower),
        source: 'grid',
      };
    }

    // Check BESS SOC threshold
    if (bessStatus.currentSoc < loadBalancingConfig.bessIntegration.minBessSocForCharging) {
      return {
        allocated: true,
        power: Math.min(request.requestedPower, charger.specifications.maxPower),
        source: 'grid',
      };
    }

    // Determine optimal power source
    const bessAvailablePower = bessStatus.availablePower;
    const requestedPower = Math.min(request.requestedPower, charger.specifications.maxPower);

    if (bessAvailablePower >= requestedPower && loadBalancingConfig.bessIntegration.preferBessOverGrid) {
      return {
        allocated: true,
        power: requestedPower,
        source: 'bess',
      };
    }

    if (bessAvailablePower > 0) {
      // Hybrid mode: use BESS + grid
      return {
        allocated: true,
        power: requestedPower,
        source: 'hybrid',
      };
    }

    return {
      allocated: true,
      power: requestedPower,
      source: 'grid',
    };
  }

  /**
   * Calculate optimal charging schedule considering BESS and grid tariffs
   */
  async calculateOptimalChargingSchedule(
    chargerId: string,
    vehicleSoc: number,
    targetSoc: number,
    vehicleBatteryCapacity: number,
    departureTime: Date
  ): Promise<ChargingProfile> {
    const charger = await this.getChargerById(chargerId);
    if (!charger) {
      throw new NotFoundError('EV Charger');
    }

    const energyNeeded = (targetSoc - vehicleSoc) / 100 * vehicleBatteryCapacity;
    const now = new Date();
    const availableTime = (departureTime.getTime() - now.getTime()) / 3600000; // hours
    const minPower = energyNeeded / availableTime;

    // Get tariffs to optimize charging times
    const tariffs = await this.getTariffs(charger.organizationId);
    const sortedTariffs = tariffs.sort((a, b) => a.pricePerKwh - b.pricePerKwh);

    // Create schedule periods based on tariff optimization
    const schedule: ChargingProfile['schedule'] = [];
    let remainingEnergy = energyNeeded;
    let currentTime = now;

    for (const tariff of sortedTariffs) {
      if (remainingEnergy <= 0) break;

      // Calculate charging period
      const power = Math.min(charger.specifications.maxPower, minPower * 1.2);
      const duration = remainingEnergy / power;
      const periodStart = Math.floor((currentTime.getTime() - now.getTime()) / 1000);

      schedule.push({
        startPeriod: periodStart,
        limit: power * 1000, // kW to W
        numberPhases: charger.specifications.phases,
      });

      remainingEnergy -= power * (availableTime / sortedTariffs.length);
      currentTime = new Date(currentTime.getTime() + duration * 3600000);
    }

    // Create the charging profile
    return this.setChargingProfile({
      chargerId,
      stackLevel: 1,
      profilePurpose: ProfilePurpose.TX_PROFILE,
      kind: ProfileKind.ABSOLUTE,
      validFrom: now,
      validTo: departureTime,
      schedule,
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Map Firestore document to EVCharger
   */
  private mapChargerDocument(doc: FirebaseFirestore.DocumentSnapshot): EVCharger {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      lastSeen: data?.lastSeen?.toDate(),
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
    } as EVCharger;
  }

  /**
   * Map Firestore document to ChargingSession
   */
  private mapSessionDocument(doc: FirebaseFirestore.DocumentSnapshot): ChargingSession {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startTime: data?.startTime?.toDate() || new Date(),
      endTime: data?.endTime?.toDate(),
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
      meterValues: (data?.meterValues || []).map((mv: any) => ({
        ...mv,
        timestamp: mv.timestamp?.toDate() || new Date(),
      })),
    } as ChargingSession;
  }

  /**
   * Map Firestore document to Reservation
   */
  private mapReservationDocument(doc: FirebaseFirestore.DocumentSnapshot): Reservation {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startTime: data?.startTime?.toDate() || new Date(),
      expiryTime: data?.expiryTime?.toDate() || new Date(),
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
    } as Reservation;
  }

  /**
   * Calculate session cost based on tariff
   */
  private async calculateSessionCost(
    session: ChargingSession,
    energyDelivered: number,
    duration: number
  ): Promise<CostBreakdown> {
    let tariff: EVTariff | null = null;

    if (session.tariffId) {
      const tariffDoc = await this.db
        .collection(EVCollections.EV_TARIFFS)
        .doc(session.tariffId)
        .get();
      if (tariffDoc.exists) {
        tariff = tariffDoc.data() as EVTariff;
      }
    }

    if (!tariff) {
      tariff = await this.getApplicableTariff(session.organizationId, session.userId);
    }

    if (!tariff) {
      return {
        energyCost: 0,
        timeCost: 0,
        connectionFee: 0,
        idleFee: 0,
      };
    }

    const energyCost = energyDelivered * tariff.pricePerKwh;
    const timeCost = tariff.pricePerMinute ? (duration / 60) * tariff.pricePerMinute : 0;
    const connectionFee = tariff.connectionFee || 0;

    // Calculate idle fee if applicable (session ended but vehicle still connected)
    // This would typically be calculated when the vehicle is unplugged
    const idleFee = 0;

    return {
      energyCost: Math.round(energyCost * 100) / 100,
      timeCost: Math.round(timeCost * 100) / 100,
      connectionFee,
      idleFee,
    };
  }
}

export const evChargerService = new EVChargerService();
